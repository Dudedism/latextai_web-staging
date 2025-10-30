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
from database import User
from repository import merge_account

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from itsdangerous import URLSafeTimedSerializer

api_auth = Blueprint('api_auth_blueprint', __name__, url_prefix='/api')

s = URLSafeTimedSerializer(SECRET_KEY)

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
    
    # WARNING: Placeholder - Auto-verified for development, remove this message in production
    return jsonify({'message': 'User registered successfully! You can now sign in.'}), 201

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
    anon_user = None
    if 'anon_key' in data.keys():
        anon_email = data['anon_key'] + '@anonymous.user'
        anon_user = User(email=anon_email).find()

    user = User.find_by_email(email)  # get the user object from the DB
    if user and user.get('password') and check_password_hash(user['password'], password):  # if the password is legit log in
        if user.get('is_verified', True) == False: # the account exists but the user is not verified
            return jsonify({'message': 'Account not verified'}), 401
        if anon_user:
            merge_account(anon_user, user)

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
            'name': user['name']
        }), 200
    else:  # if it's not legit, error
        return jsonify({'message': 'Invalid email or password.'}), 401

@api_auth.route('/loginAnonymously', methods=['POST'])
def login_anonymously():
    data = request.get_json()
    name = 'Anonymous'
    email = data['key'] + '@anonymous.user'
    # Password doesn't matter for anonymous users - just use the key as-is
    password = data['key']

    user = User.find_by_email(email)
    if not user:
        # Anonymous users are unverified by definition
        User(name=name, email=email, password=password, is_verified=False, admin=False).insert()

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

    return jsonify({
        'message': 'Logged in anonymously!',
        'access_token': access_token,
        'refresh_token': refresh_token,
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
        if 'anon_key' in data.keys():
            anon_email = data['anon_key'] + '@anonymous.user'
            anon_user = User(email=anon_email).find()
            if anon_user:
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
    anon_name = 'anonymous'
    anon_email = data['anon_key'] + '@anonymous.user'
    anon_password = data['anon_key']

    # Create anonymous version of user, if it doesn't already exist
    anon_user = User(email=anon_email).find()
    if not anon_user:
        User(name=anon_name, email=anon_email, password=anon_password).insert()
        anon_user = User(email=anon_email).find()

    # Merge current user into its anonymous-type user counterpart (the reverse of what we usually do with anon accounts)
    merge_account(user, anon_user)
    return jsonify({'message': 'Account deleted successfully!'}), 204

