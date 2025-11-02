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
from email_service import send_verification_email
from itsdangerous import URLSafeTimedSerializer

api_auth = Blueprint('api_auth_blueprint', __name__, url_prefix='/api')

s = URLSafeTimedSerializer(SECRET_KEY, salt=EMAIL_VERIFICATION_SALT)

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

    # Check for existing active (non-deleted) users with this email
    existing_user = User.find_by_email(data['email'], include_deleted=False)
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

    # Check if any deleted users with this email have used their free upload
    deleted_users = User.find_deleted_by_email(data['email'])
    free_upload_already_used = any(du.get('free_upload_used', False) for du in deleted_users)

    if free_upload_already_used:
        print(f"ℹ️  [SIGNUP] User {data['email']} has previously used free upload (from deleted account)")

    # Create user with is_verified=False (requires email verification)
    user = User(
        name=data['name'],
        email=data['email'],
        password=pwd,
        is_verified=False,  # User must verify email
        admin=False,
        free_upload_used=free_upload_already_used  # Inherit from deleted accounts
    )

    user.insert()

    print(f"✅ [SIGNUP] User registered: {data['email']}")

    # Generate verification token and URL
    token = s.dumps(data['email'])
    verify_url = f"{VERIFICATION_BASE_URL}/verify?token={token}"

    # Send verification email
    try:
        send_verification_email(data['email'], data['name'], verify_url)
        print(f"📧 [SIGNUP] Verification email sent to {data['email']}")
    except Exception as e:
        print(f"❌ [SIGNUP] Failed to send verification email: {e}")
        # Don't fail signup if email fails - user can still login but won't be verified
        # return jsonify({'message': 'User registered, but failed to send verification email.'}), 500

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
        'admin': False
    }), 201

@api_auth.route('/verify', methods=['GET'])
def verify():
    token = request.args.get('token')  # Get token from query string
    if not token:
        return jsonify({'error': 'Token not provided'}), 400

    try:
        # Decrypt the token to get the email
        email = s.loads(token, max_age=86400)  # 24 hour expiration

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

    # Only find active (non-deleted) users
    user = User.find_by_email(email, include_deleted=False)  # get the user object from the DB
    if user and user.get('password') and check_password_hash(user['password'], password):  # if the password is legit log in
        # Create tokens with Flask-JWT-Extended (allow unverified users to login)
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
            'name': user['name']
        }), 200
    else:  # if it's not legit, error
        return jsonify({'message': 'Invalid email or password.'}), 401


@api_auth.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh endpoint with TOKEN ROTATION and REUSE DETECTION.

    Security mechanism:
    1. Check if the refresh token JTI matches what's stored in database
    2. If it doesn't match -> TOKEN REUSE DETECTED -> Invalidate all tokens
    3. If it matches -> Generate new tokens and update stored JTI (rotation)
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

    # Generate NEW access token (15 minutes for all users)
    new_access_token = create_access_token(
        identity=identity,
        fresh=False  # Refreshed tokens are not fresh
    )

    # Generate NEW refresh token (7 days for all users)
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
        existing_user = User.find_by_email(email, include_deleted=False)

        # Create user if none exists (check deleted users for free upload history)
        if not existing_user:
            name = id_info['given_name'] + ' ' + id_info['family_name']
            pwd = generate_password_hash(str(uuid.uuid4()))

            # Check deleted users for free upload history
            deleted_users = User.find_deleted_by_email(email)
            free_upload_already_used = any(du.get('free_upload_used', False) for du in deleted_users)

            user = User(name=name, email=email, password=pwd, admin=False, free_upload_used=free_upload_already_used)
            user.insert()
            existing_user = User.find_by_email(email, include_deleted=False)

        # Check if user is verified
        if not existing_user.get('is_verified', False):
            return jsonify({'message': 'Account not verified'}), 401

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
    'Delete' user account by orphaning it.
    - Deletes all projects and tickets
    - Keeps user record with email and free_upload_used for tracking
    - Strips all personal information
    - Marks account as deleted
    - Sets random password to prevent login
    """
    print(f"🗑️  [DELETE ACCOUNT] User {user['email']} requested account deletion")

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

        # Orphan the user account (keep email + free_upload_used, strip everything else)
        orphan_data = {
            'is_deleted': True,
            'deleted_at': datetime.utcnow(),
            'name': '[DELETED]',
            'password': generate_password_hash(str(uuid.uuid4())),  # Random password
            'is_verified': False,
            'admin': False,
            'data_consent': None,
            # Keep: email, free_upload_used (if exists)
        }

        update_result = mongo.db.users.update_one(
            {'_id': user['_id']},
            {'$set': orphan_data}
        )

        if update_result.modified_count > 0:
            print(f"✅ [DELETE ACCOUNT] User account orphaned successfully")
            print(f"   Email retained: {user['email']}, free_upload_used: {user.get('free_upload_used', False)}")
            return jsonify({'message': 'Account deleted successfully!'}), 200
        else:
            print(f"❌ [DELETE ACCOUNT] Failed to orphan user account")
            return jsonify({'message': 'Failed to delete account'}), 500

    except Exception as e:
        print(f"❌ [DELETE ACCOUNT] Error: {str(e)}")
        return jsonify({'message': 'Error deleting account'}), 500

