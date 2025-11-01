import datetime
import inspect
import uuid
from datetime import timedelta
from functools import wraps, partial
import re
import dns.resolver

import jwt
from flask import jsonify, Blueprint, request, url_for, redirect, send_file
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    decode_token
)
from google.auth.transport import requests
from google.oauth2 import id_token
from werkzeug.security import generate_password_hash, check_password_hash

from config import *
from database import User, Project, Ticket, mongo

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from itsdangerous import URLSafeTimedSerializer

api_auth = Blueprint('api_auth_blueprint', __name__, url_prefix='/api')

s = URLSafeTimedSerializer(SECRET_KEY)

def merge_account(anon_user, main_user):
    """
    Merge anonymous user account into registered user account.
    Transfers all projects and tickets from anonymous user to registered user,
    then deletes the anonymous user.

    Safety checks:
    - Only allows merging if source user is anonymous (email ends with @anonymous.user)
    - Prevents merging registered user into anonymous user (reverse direction)

    Args:
        anon_user: Source user (must be anonymous)
        main_user: Target user (registered user)

    Returns:
        bool: True if merge successful, False otherwise
    """
    print(f"\n🔀 [MERGE] Attempting to merge accounts")
    print(f"   From: {anon_user.get('email')} (ID: {anon_user.get('_id')})")
    print(f"   To:   {main_user.get('email')} (ID: {main_user.get('_id')})")

    # CRITICAL SAFETY CHECK: Prevent registered user -> anonymous user merge
    if not anon_user.get('email', '').endswith('@anonymous.user'):
        print(f"❌ [MERGE] BLOCKED: Source user is not anonymous!")
        print(f"   Source email: {anon_user.get('email')}")
        print(f"   Cannot merge registered user into another account")
        return False

    # SAFETY CHECK: Prevent anonymous -> anonymous merge
    if main_user.get('email', '').endswith('@anonymous.user'):
        print(f"❌ [MERGE] BLOCKED: Target user is anonymous!")
        print(f"   Target email: {main_user.get('email')}")
        print(f"   Cannot merge into anonymous user")
        return False

    # SAFETY CHECK: Verify both users exist and have IDs
    if not anon_user.get('_id') or not main_user.get('_id'):
        print(f"❌ [MERGE] BLOCKED: Missing user IDs")
        return False

    try:
        # Transfer projects using convenience function
        projects_transferred = Project.transfer_to_user(anon_user, main_user)
        print(f"✅ [MERGE] Transferred {projects_transferred} projects")

        # Transfer tickets using convenience function
        tickets_transferred = Ticket.transfer_to_user(anon_user, main_user)
        print(f"✅ [MERGE] Transferred {tickets_transferred} tickets")

        # Transfer user properties (data_consent and any future fields)
        # Fields to NEVER transfer (core identity):
        protected_fields = {'_id', 'name', 'email', 'password', 'is_verified',
                          'created_at', 'refresh_token_jti', 'token_updated_at'}

        # Build update dict with transferable fields from anonymous user
        update_fields = {}
        for key, value in anon_user.items():
            if key not in protected_fields and value is not None:
                update_fields[key] = value
                print(f"   Transferring field: {key} = {value}")

        # Update main user with transferred fields
        if update_fields:
            mongo.db.users.update_one(
                {'_id': main_user['_id']},
                {'$set': update_fields}
            )
            print(f"✅ [MERGE] Transferred {len(update_fields)} user properties: {list(update_fields.keys())}")
        else:
            print(f"ℹ️  [MERGE] No additional user properties to transfer")

        # Invalidate anonymous user's refresh tokens for security
        User.invalidate_refresh_token(anon_user['email'])
        print(f"✅ [MERGE] Invalidated anonymous user tokens")

        delete_result = mongo.db.users.delete_one({'_id': anon_user['_id']})
        if delete_result.deleted_count > 0:
            print(f"✅ [MERGE] Deleted anonymous user account")
        else:
            print(f"⚠️  [MERGE] Warning: Could not delete anonymous user")

        print(f"✅ [MERGE] Account merge completed successfully")
        return True

    except Exception as e:
        print(f"❌ [MERGE] Error during merge: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def send_verification_email(user_email, user_name, verify_url):
    """Send email using smtplib with a custom server."""
    subject = 'Verify Your Account'
    
    # Compose the HTML body
    html_body = f'''
    <p>Hi {user_name},</p>
    <p>Thank you for registering. Please click the link below to verify your account:</p>
    <p><a href="{verify_url}">Verify Account</a></p>
    <p>If you did not sign up for this account, please ignore this email.</p>
    '''
    
    # Create the email
    msg = MIMEMultipart()
    msg['From'] = SMTP_FROM
    msg['To'] = user_email
    msg['Subject'] = subject
    msg.attach(MIMEText(html_body, 'html'))

    # Connect to the SMTP server and send the email
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.set_debuglevel(1)  # Enables debug output for SMTP
        server.starttls()  # Use TLS
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_USERNAME, user_email, msg.as_string())
        server.quit()
        print("Email sent successfully")
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise e

def requires_auth(func=None, require_admin=False, use_form=False):
    """
    Decorator to apply user authentication using Flask-JWT-Extended.
    Decorator can also provide `data` and `user` parsed from the request body.

    :param func: The Flask API function to be decorated with authentication.
    :param require_admin: Optional boolean indicating whether admin access is required. Default is False.
    :param use_form: Optional boolean indicating whether to use form data. Default is False.
    :return: A wrapper function that authenticates the user before calling the decorated function.
    """
    if func is None:
        return partial(requires_auth, require_admin=require_admin, use_form=use_form)

    @wraps(func)
    @jwt_required()  # Flask-JWT-Extended handles token validation
    def function_wrapper(*args, **kwargs):
        # Get user email from JWT token
        email = get_jwt_identity()
        user = User.find_by_email(email)

        if not user:
            return jsonify({'message': 'User not found.'}), 401

        if require_admin and not user.get('admin', False):
            return jsonify({'message': 'User not admin.'}), 403

        # Prepare extra parameters based on function signature
        params_dict = dict()
        sig = inspect.signature(func)

        if 'user' in sig.parameters:
            params_dict['user'] = user

        if 'data' in sig.parameters:
            # Get data from form or JSON
            data = request.form if use_form else request.get_json()
            params_dict['data'] = data

        return func(*args, **kwargs, **params_dict)

    return function_wrapper

def requires_admin(func):
    """
    Decorator for admin-only endpoints. This is a convenience wrapper around requires_auth.
    """
    return requires_auth(func, require_admin=True)

@api_auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()

    if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', data['email']):
        return jsonify({'message': 'Invalid email format.'}), 400

    existing_user = User.find_by_email(data['email'])
    if existing_user:
        return jsonify({'message': 'User with this email already exists!'}), 400

    domain = data['email'].split('@')[-1]

    try:
        dns.resolver.resolve(domain, 'MX')
    except dns.resolver.NoAnswer:
        return jsonify({'message': 'Invalid email domain. No MX records found.'}), 400
    except dns.resolver.NXDOMAIN:
        return jsonify({'message': 'Invalid email domain. Domain does not exist.'}), 400
    except dns.exception.DNSException:
        return jsonify({'message': 'An error occurred while checking the email domain.'}), 400

    pwd = generate_password_hash(data['password'])

    # WARNING: Placeholder - Email verification disabled until email API developed
    # In production, is_verified should be False and email verification should be required
    user = User(name=data['name'], email=data['email'], password=pwd, is_verified=True, admin=False)

    # WARNING: Placeholder - Email sending disabled until email API developed
    # Uncomment below when email service is configured
    # token = s.dumps(data['email'], salt='email-confirm-salt')
    # verify_url = url_for('api_auth_blueprint.verify', token=token, _external=True)
    # try:
    #     send_verification_email(data['email'], data['name'], verify_url)
    # except Exception as e:
    #     return jsonify({'message': 'User registered, but failed to send verification email.'}), 500

    user.insert()

    print(f"✅ [SIGNUP] User registered: {data['email']}")

    # Check for anonymous account to merge
    anon_user = None
    merge_successful = False
    if 'current_email' in data:
        current_email = data['current_email']
        # Safety check: Only merge if current user is anonymous
        if current_email.endswith('@anonymous.user'):
            anon_user = User.find_by_email(current_email)
            if anon_user:
                print(f"🔀 [SIGNUP] Will merge anonymous user: {current_email}")
                # Get fresh user data after insert
                registered_user = User.find_by_email(data['email'])
                merge_successful = merge_account(anon_user, registered_user)
            else:
                print(f"⚠️  [SIGNUP] Anonymous user not found: {current_email}")
        else:
            print(f"⚠️  [SIGNUP] Ignoring current_email - not anonymous: {current_email}")

    # Auto-login: Create tokens for the new user
    email = data['email']
    access_token = create_access_token(identity=email, fresh=True)
    refresh_token = create_refresh_token(identity=email)

    # Store refresh token JTI in database for rotation and reuse detection
    refresh_token_decoded = decode_token(refresh_token)
    refresh_token_jti = refresh_token_decoded['jti']
    User.store_refresh_token(email, refresh_token_jti)

    print(f"✅ [SIGNUP] Auto-login successful, tokens generated")

    return jsonify({
        'message': 'User registered successfully!',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'email': email,
        'name': data['name'],
        'admin': False,
        'merge_successful': merge_successful if anon_user else None
    }), 201

@api_auth.route('/verify', methods=['GET'])
def verify():
    token = request.args.get('token')  # Get token from query string
    if not token:
        return jsonify({'error': 'Token not provided'}), 400

    try:
        # Decrypt the token to get the email
        email = s.loads(token, salt='email-confirm-salt', max_age=3600)  # 1 hour expiration

        # Find the user by email
        user = User(email=email).find()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Check if the user is already verified
        if user.get('is_verified', False):
            return redirect(FRONTEND_URL)  # Redirect to frontend

        # Update the user's is_verified status to True using the insertdate method
        User.insertdate(email, {"is_verified": True})

        # Return an HTML page with a JavaScript alert and a redirect
        return f'''
        <html>
            <head>
                <script type="text/javascript">
                    alert('Verification successful!');
                    window.location.href = '{FRONTEND_URL}/signin';
                </script>
            </head>
            <body></body>
        </html>
        '''

    except Exception as e:
        return jsonify({'error': 'The verification link has expired or is invalid'}), 400

@api_auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data['email']
    password = data['password']

    # Safety check: Prevent login to anonymous accounts
    if email.endswith('@anonymous.user'):
        return jsonify({'message': 'Invalid login attempt'}), 400

    anon_user = None
    # Check for current_email (anonymous user to merge)
    if 'current_email' in data.keys():
        current_email = data['current_email']

        # Safety check: Only merge if current user is anonymous
        if current_email.endswith('@anonymous.user'):
            anon_user = User.find_by_email(current_email)
            if anon_user:
                print(f"🔀 [LOGIN] Will merge anonymous user: {current_email}")
            else:
                print(f"⚠️  [LOGIN] Anonymous user not found: {current_email}")
        else:
            print(f"⚠️  [LOGIN] Ignoring current_email - not anonymous: {current_email}")

    user = User.find_by_email(email)  # get the user object from the DB
    if user and user.get('password') and check_password_hash(user['password'], password):  # if the password is legit log in
        if user.get('is_verified', True) == False: # the account exists but the user is not verified
            return jsonify({'message': 'Account not verified'}), 401

        # Merge anonymous account if present
        merge_successful = False
        if anon_user:
            merge_successful = merge_account(anon_user, user)

        # Create tokens with Flask-JWT-Extended (regular users get standard expiry)
        access_token = create_access_token(identity=email, fresh=True)
        refresh_token = create_refresh_token(identity=email)

        # Store refresh token JTI in database for rotation and reuse detection
        refresh_token_decoded = decode_token(refresh_token)
        refresh_token_jti = refresh_token_decoded['jti']
        User.store_refresh_token(email, refresh_token_jti)

        return jsonify({
            'message': 'Login successful!',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'admin': user['admin'],
            'name': user['name'],
            'merge_successful': merge_successful if anon_user else None
        }), 200
    else:  # if it's not legit, error
        return jsonify({'message': 'Invalid email or password.'}), 401

@api_auth.route('/loginAnonymously', methods=['POST'])
def login_anonymously():
    """
    Create anonymous user session with server-generated UUID-based key.
    Frontend no longer needs to generate the anonymous key - server does it.
    Returns the full email in response so frontend can store it.
    """
    # Generate unique anonymous key on server side
    anon_key = f"anon_{uuid.uuid4().hex[:16]}"
    email = f"{anon_key}@anonymous.user"
    name = 'Anonymous User'
    # Password is hashed but doesn't matter for anonymous users (no manual login)
    password = generate_password_hash(anon_key)

    print(f"👤 [ANON LOGIN] Creating anonymous user: {email}")

    # Check if user already exists (shouldn't happen with UUID, but just in case)
    user = User.find_by_email(email)
    if not user:
        # Anonymous users are unverified by definition
        User(name=name, email=email, password=password, is_verified=False, admin=False).insert()
        print(f"✅ [ANON LOGIN] Anonymous user created in database")
    else:
        print(f"⚠️  [ANON LOGIN] Anonymous user already exists (reusing)")

    # Anonymous users: 1 hour access token, NEVER-expiring refresh token
    # (they have no password to log back in!)
    access_token = create_access_token(
        identity=email,
        expires_delta=timedelta(seconds=JWT_ANON_ACCESS_TOKEN_EXPIRES)
    )
    refresh_token = create_refresh_token(
        identity=email,
        expires_delta=False  # Never expires for anonymous users
    )

    # Store refresh token JTI in database for rotation and reuse detection
    refresh_token_decoded = decode_token(refresh_token)
    refresh_token_jti = refresh_token_decoded['jti']
    User.store_refresh_token(email, refresh_token_jti)

    print(f"✅ [ANON LOGIN] Tokens generated and stored")

    return jsonify({
        'message': 'Logged in anonymously!',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'email': email,  # IMPORTANT: Return full email so frontend can store it
        'name': name
    }), 200

@api_auth.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh endpoint with TOKEN ROTATION and REUSE DETECTION.

    Security mechanism:
    1. Check if the refresh token JTI matches what's stored in database
    2. If it doesn't match -> TOKEN REUSE DETECTED -> Invalidate all tokens
    3. If it matches -> Generate new tokens and update stored JTI (rotation)

    Note: Anonymous users have never-expiring refresh tokens since they
    have no password to recover access.
    """
    # Get the identity and JTI from the refresh token
    identity = get_jwt_identity()
    current_token_jti = get_jwt()['jti']

    print(f"\n🔄 Refresh request from: {identity}")
    print(f"   Token JTI: {current_token_jti}")

    # Get the stored refresh token JTI from database
    stored_token_jti = User.get_refresh_token_jti(identity)
    print(f"   Stored JTI: {stored_token_jti}")

    # REUSE DETECTION: Check if this token was already used
    if stored_token_jti != current_token_jti:
        print(f"🚨 TOKEN REUSE DETECTED for {identity}!")
        print(f"   Expected JTI: {stored_token_jti}")
        print(f"   Received JTI: {current_token_jti}")
        print(f"   Action: Invalidating all refresh tokens for this user")

        # Invalidate all refresh tokens for this user
        User.invalidate_refresh_token(identity)

        return jsonify({
            'error': 'Token reuse detected. All refresh tokens have been invalidated for security.',
            'message': 'Please log in again.'
        }), 401

    # Token is valid - proceed with rotation
    print(f"✅ Token valid - proceeding with rotation")

    # Check if user is anonymous to determine expiry times
    is_anonymous = identity.endswith('@anonymous.user')

    # Generate NEW access token
    if is_anonymous:
        # Anonymous users get 1 hour access token
        new_access_token = create_access_token(
            identity=identity,
            expires_delta=timedelta(seconds=JWT_ANON_ACCESS_TOKEN_EXPIRES),
            fresh=False  # Refreshed tokens are not fresh
        )
    else:
        # Regular users get 15 minute access token
        new_access_token = create_access_token(
            identity=identity,
            fresh=False  # Refreshed tokens are not fresh
        )

    # Generate NEW refresh token (rotation)
    if is_anonymous:
        new_refresh_token = create_refresh_token(
            identity=identity,
            expires_delta=False  # Never expires for anonymous
        )
    else:
        new_refresh_token = create_refresh_token(identity=identity)

    # Store the NEW refresh token JTI in database
    new_refresh_token_decoded = decode_token(new_refresh_token)
    new_refresh_token_jti = new_refresh_token_decoded['jti']
    User.store_refresh_token(identity, new_refresh_token_jti)

    print(f"✅ Tokens rotated successfully")
    print(f"   New Refresh JTI: {new_refresh_token_jti}")

    return jsonify({
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    }), 200

@api_auth.route('/loginGoogle', methods=['POST'])
def login_google():
    data = request.get_json()

    try:
        id_info = id_token.verify_oauth2_token(data['credential'], requests.Request(), GOOGLE_CLIENT_ID)
        email = id_info['email']
        existing_user = User(email=email).find()

        # Create user if none exists.
        if not existing_user:
            name = id_info['given_name'] + ' ' + id_info['family_name']
            pwd = generate_password_hash(str(uuid.uuid4()))
            user = User(name=name, email=email, password=pwd, admin=False)
            user.insert()
            existing_user = User(email=email).find()

        # Merge anon user into main user.
        if 'current_email' in data.keys():
            current_email = data['current_email']
            # Safety check: Only merge if current user is anonymous
            if current_email.endswith('@anonymous.user'):
                anon_user = User.find_by_email(current_email)
                if anon_user:
                    print(f"🔀 [GOOGLE LOGIN] Merging anonymous user: {current_email}")
                    merge_account(anon_user, existing_user)

        # Create tokens with Flask-JWT-Extended
        access_token = create_access_token(identity=email, fresh=True)
        refresh_token = create_refresh_token(identity=email)

        # Store refresh token JTI in database for rotation and reuse detection
        refresh_token_decoded = decode_token(refresh_token)
        refresh_token_jti = refresh_token_decoded['jti']
        User.store_refresh_token(email, refresh_token_jti)

        return jsonify({
            'message': 'Login successful!',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'email': email,
            'admin': existing_user['admin']
        }), 200

    except (ValueError, KeyError):
        return jsonify({'message': 'Authentication failed.'}), 401

@api_auth.route('/changePassword', methods=['POST'])
@requires_auth
def change_password(user, data):
    new_pass = generate_password_hash(data['new_password'])
    User.update_password(user['email'], new_pass)
    return jsonify({'message': 'Password changed successfully!'}), 200

@api_auth.route('/deleteAccount', methods=['POST'])
@requires_auth
def delete_account(user, data):
    """
    Delete user account and all associated data.
    This is a complete removal - user, projects, tickets all deleted.
    Only registered users can delete their accounts (anonymous users are auto-created).
    """
    print(f"🗑️  [DELETE ACCOUNT] User {user['email']} requested account deletion")

    # Safety check: Only registered users should explicitly delete accounts
    if user['email'].endswith('@anonymous.user'):
        print(f"⚠️  [DELETE ACCOUNT] Anonymous users cannot delete accounts")
        return jsonify({'message': 'Anonymous users cannot delete accounts'}), 400

    try:
        # Delete all projects owned by user using convenience function
        projects_deleted = Project.delete_by_user(user)
        print(f"   Deleted {projects_deleted} projects")

        # Delete all tickets created by user using convenience function
        tickets_deleted = Ticket.delete_by_user(user)
        print(f"   Deleted {tickets_deleted} tickets")

        # Invalidate user's refresh tokens
        User.invalidate_refresh_token(user['email'])
        print(f"   Invalidated refresh tokens")

        # Delete the user account
        delete_result = mongo.db.users.delete_one({'_id': user['_id']})

        if delete_result.deleted_count > 0:
            print(f"✅ [DELETE ACCOUNT] User account and all data deleted successfully")
            return jsonify({'message': 'Account deleted successfully!'}), 200
        else:
            print(f"❌ [DELETE ACCOUNT] Failed to delete user account")
            return jsonify({'message': 'Failed to delete account'}), 500

    except Exception as e:
        print(f"❌ [DELETE ACCOUNT] Error: {str(e)}")
        return jsonify({'message': 'Error deleting account'}), 500

