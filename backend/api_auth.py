import datetime
import inspect
import uuid
import os
import shutil
import hashlib
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
from database import User, Project, UsedToken, mongo
from email_service import send_verification_email, send_password_reset_email
from itsdangerous import URLSafeTimedSerializer

api_auth = Blueprint('api_auth_blueprint', __name__, url_prefix='/api')

s = URLSafeTimedSerializer(SECRET_KEY, salt=EMAIL_VERIFICATION_SALT)

def generate_verification_url(email):
    """
    Generate a verification URL for the given email.
    Points to frontend /verify route which will call backend API.

    Args:
        email: User's email address

    Returns:
        str: Full verification URL with token
    """
    token = s.dumps(email)
    return f"{FRONTEND_URL}/verify?token={token}"

def requires_auth(func=None, require_admin=False, require_verified=False, use_form=False):
    """
    Decorator to apply user authentication using Flask-JWT-Extended.
    Decorator can also provide `data` and `user` parsed from the request body.

    :param func: The Flask API function to be decorated with authentication.
    :param require_admin: Optional boolean indicating whether admin access is required. Default is False.
    :param require_verified: Optional boolean indicating whether email verification is required. Default is False.
    :param use_form: Optional boolean indicating whether to use form data. Default is False.
    :return: A wrapper function that authenticates the user before calling the decorated function.
    """
    if func is None:
        return partial(requires_auth, require_admin=require_admin, require_verified=require_verified, use_form=use_form)

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

        if require_verified and not user.get('is_verified', False):
            return jsonify({'message': 'Email verification required.'}), 403

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
@limiter.limit("30 per minute")
def signup():
    data = request.get_json()

    # Validate required fields exist
    if not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required.'}), 400

    # Validate input lengths
    if len(data['email']) > 254:
        return jsonify({'message': 'Email must be 254 characters or less.'}), 400
    if len(data['password']) > 128:
        return jsonify({'message': 'Password must be 128 characters or less.'}), 400
    if len(data['password']) < 8:
        return jsonify({'message': 'Password must be at least 8 characters.'}), 400

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

    # Check if any deleted users with this email have used their free upload or have card fingerprints
    deleted_users = User.find_deleted_by_email(data['email'])
    inherited_free_project_id = None
    inherited_card_fingerprints = []
    for du in deleted_users:
        if du.get('free_project_id'):
            inherited_free_project_id = du.get('free_project_id')
        if du.get('card_fingerprints'):
            inherited_card_fingerprints.extend(du.get('card_fingerprints', []))
    inherited_card_fingerprints = list(set(inherited_card_fingerprints))

    if inherited_free_project_id:
        print(f"ℹ️  [SIGNUP] User has previously used free upload (from deleted account)")

    # Create user with is_verified=False (requires email verification)
    user = User(
        email=data['email'],
        password=pwd,
        is_verified=False,
        admin=False,
        free_project_id=inherited_free_project_id,
        card_fingerprints=inherited_card_fingerprints
    )

    user.insert()

    print(f"✅ [SIGNUP] User registered")

    # Note: Verification email is NOT sent automatically on signup
    # User will see a modal prompting them to request verification when needed

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
        'admin': False
    }), 201

@api_auth.route('/verify', methods=['GET'])
def verify():
    token = request.args.get('token')  # Get token from query string
    print(f"\n🔍 [VERIFY] Verification request received")

    if not token:
        print(f"❌ [VERIFY] No token provided")
        return jsonify({'error': 'Token not provided'}), 400

    # Create hash of token for database lookup
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Check if token has already been used
    if UsedToken.is_token_used(token_hash):
        print(f"❌ [VERIFY] Token already used")
        return jsonify({'error': 'This verification link has already been used'}), 400

    try:
        # Decrypt the token to get the email
        email = s.loads(token, max_age=86400)  # 24 hour expiration
        print(f"✅ [VERIFY] Token decrypted successfully")

        # Find the user by email
        user = User.find_by_email(email, include_deleted=False)

        if not user:
            print(f"❌ [VERIFY] User not found")
            return jsonify({'error': 'User not found'}), 404

        # Check if the user is already verified
        if user.get('is_verified', False):
            print(f"ℹ️  [VERIFY] User already verified")
            return jsonify({
                'message': 'Email already verified',
                'email': email,
                'is_verified': True
            }), 200

        # Mark token as used BEFORE verifying user
        UsedToken.mark_token_used(token_hash, 'email_verification', email)

        User.update_fields(email, {"is_verified": True})
        print(f"✅ [VERIFY] User verification successful")

        # Return JSON response with user email for frontend to update auth state
        return jsonify({
            'message': 'Email verified successfully!',
            'email': email,
            'is_verified': True
        }), 200

    except Exception as e:
        print(f"❌ [VERIFY] Verification failed: {e}")
        return jsonify({'error': 'The verification link has expired or is invalid'}), 400

@api_auth.route('/login', methods=['POST'])
@limiter.limit("60 per minute")
def login():
    data = request.get_json()

    # Validate required fields exist
    if not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required.'}), 400

    # Validate input lengths
    if len(data['email']) > 254:
        return jsonify({'message': 'Email must be 254 characters or less.'}), 400
    if len(data['password']) > 128:
        return jsonify({'message': 'Password must be 128 characters or less.'}), 400

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
            'is_verified': user.get('is_verified', False)
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

    print(f"\n🔄 Refresh request")

    # Get the stored refresh token JTI from database
    stored_token_jti = User.get_refresh_token_jti(identity)

    # REUSE DETECTION: Check if this token was already used
    if stored_token_jti != current_token_jti:
        print(f"🚨 TOKEN REUSE DETECTED - Invalidating all refresh tokens")

        # Invalidate all refresh tokens for this user
        User.invalidate_refresh_token(identity)

        return jsonify({
            'error': 'Token reuse detected. All refresh tokens have been invalidated for security.',
            'message': 'Please log in again.'
        }), 401

    # Token is valid - proceed with rotation
    print(f"✅ Token valid - rotating")

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

    print(f"✅ Tokens rotated")

    return jsonify({
        'access_token': new_access_token,
        'refresh_token': new_refresh_token
    }), 200

@api_auth.route('/auth/google', methods=['POST'])
def login_google():
    """
    Handle Google Sign-In callback.
    Google sends the credential as form data when using redirect mode.
    """
    # Get credential from form data (Google sends it as form-urlencoded)
    credential = request.form.get('credential')
    
    if not credential:
        # Fallback to JSON if form data is empty
        data = request.get_json() or {}
        credential = data.get('credential')
    
    if not credential:
        return redirect(f"{FRONTEND_URL}/signin?error=missing_credential")

    try:
        id_info = id_token.verify_oauth2_token(credential, requests.Request(), GOOGLE_CLIENT_ID)
        email = id_info['email']
        existing_user = User.find_by_email(email, include_deleted=False)

        # Create user if none exists (check deleted users for free upload history)
        if not existing_user:
            name = id_info.get('given_name', '') + ' ' + id_info.get('family_name', '')
            name = name.strip() or email.split('@')[0]  # Fallback to email prefix if no name
            pwd = generate_password_hash(str(uuid.uuid4()))

            # Check deleted users for free upload history
            deleted_users = User.find_deleted_by_email(email)
            free_upload_already_used = any(du.get('free_upload_used', False) for du in deleted_users)

            # Google users are automatically verified (is_verified=True by default in User constructor)
            user = User(name=name, email=email, password=pwd, admin=False, free_upload_used=free_upload_already_used)
            user.insert()
            existing_user = User.find_by_email(email, include_deleted=False)
        
        # Auto-verify existing Google users if not already verified
        if not existing_user.get('is_verified', False):
            User.update_fields(email, {'is_verified': True})
            existing_user = User.find_by_email(email, include_deleted=False)

        # Create tokens with Flask-JWT-Extended
        access_token = create_access_token(identity=email, fresh=True)
        refresh_token = create_refresh_token(identity=email)

        # Store refresh token JTI in database for rotation and reuse detection
        refresh_token_decoded = decode_token(refresh_token)
        refresh_token_jti = refresh_token_decoded['jti']
        User.store_refresh_token(email, refresh_token_jti)

        # Redirect to frontend with tokens in URL fragment (more secure than query params)
        # The frontend will extract these and store them in AuthContext
        redirect_url = f"{FRONTEND_URL}/papers#access_token={access_token}&refresh_token={refresh_token}&email={email}&admin={str(existing_user.get('admin', False)).lower()}"
        
        print(f"✅ [GOOGLE LOGIN] User logged in: {email}")
        return redirect(redirect_url)

    except ValueError as e:
        print(f"❌ [GOOGLE LOGIN] Token verification failed: {e}")
        return redirect(f"{FRONTEND_URL}/signin?error=invalid_token")
    except Exception as e:
        print(f"❌ [GOOGLE LOGIN] Error: {e}")
        return redirect(f"{FRONTEND_URL}/signin?error=auth_failed")

@api_auth.route('/logout', methods=['POST'])
@requires_auth
def logout(user):
    """
    Logout user by invalidating their refresh token.
    This prevents the refresh token from being used to get new access tokens.
    """
    try:
        User.invalidate_refresh_token(user['email'])
        print(f"🚪 [LOGOUT] User logged out")
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        print(f"❌ [LOGOUT] Error logging out: {e}")
        return jsonify({'error': 'Failed to logout'}), 500

@api_auth.route('/changePassword', methods=['POST'])
@requires_auth
def change_password(user, data):
    new_password = data.get('new_password')

    if not new_password:
        return jsonify({'message': 'New password is required.'}), 400

    # Validate password length
    if len(new_password) > 128:
        return jsonify({'message': 'Password must be 128 characters or less.'}), 400
    if len(new_password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters.'}), 400

    new_pass = generate_password_hash(new_password)
    User.update_password(user['email'], new_pass)
    return jsonify({'message': 'Password changed successfully!'}), 200

@api_auth.route('/deleteAccount', methods=['POST'])
@requires_auth
def delete_account(user, data):
    """
    'Delete' user account by orphaning it.
    - Orphans all projects (removes user_email, keeps user_id for stats)
    - Orphans all credit transactions (removes user_email, keeps user_id)
    - Deletes all used tokens
    - Deletes local uploaded files
    - Sends deletion request to latextai server
    - Keeps user record with _id, free_project_id, and card_fingerprints for abuse tracking
    - Strips email and personal information
    - Marks account as deleted
    """
    USER_PROJECTS_DIR = 'user_projects'
    user_id = str(user['_id'])

    print(f"🗑️  [DELETE ACCOUNT] Account deletion requested")

    try:
        # Get all projects owned by user (includes non-orphaned only)
        projects = Project.find_by_user(user_id)
        print(f"   Found {len(projects)} projects to orphan")

        # Delete local files for each project, then orphan the project in DB
        projects_orphaned = 0
        for project in projects:
            project_id = project.get('project_id')

            # Delete local files
            project_dir = os.path.join(USER_PROJECTS_DIR, user['email'], project_id)
            if os.path.exists(project_dir):
                shutil.rmtree(project_dir, ignore_errors=True)

            # Orphan project in database (remove user_email, keep user_id for stats)
            mongo.db.projects.update_one(
                {'project_id': project_id},
                {
                    '$set': {
                        'user_email': None,
                        'upload_filename': None,
                        'error_message': None,
                        'is_orphaned': True,
                        'orphaned_at': datetime.datetime.utcnow()
                    }
                }
            )
            projects_orphaned += 1

        print(f"   Orphaned {projects_orphaned} projects")

        # Orphan credit transactions (remove user_email, keep user_id)
        txn_result = mongo.db.credit_transactions.update_many(
            {'user_id': user_id},
            {'$set': {'user_email': None}}
        )
        print(f"   Orphaned {txn_result.modified_count} credit transactions")

        # Delete used tokens
        tokens_deleted = UsedToken.delete_by_email(user['email'])
        print(f"   Deleted {tokens_deleted} used tokens")

        # Delete user directory if it exists
        user_dir = os.path.join(USER_PROJECTS_DIR, user['email'])
        if os.path.exists(user_dir):
            shutil.rmtree(user_dir, ignore_errors=True)
            print(f"   Deleted local user directory: {user_dir}")

        # Send deletion request to latextai server
        from api_latext import delete_user_on_latextai
        latextai_success, latextai_message = delete_user_on_latextai(user['email'])
        if latextai_success:
            print(f"   ✅ Latextai: {latextai_message}")
        else:
            print(f"   ⚠️  Latextai: {latextai_message}")

        # Invalidate user's refresh tokens
        User.invalidate_refresh_token(user['email'])
        print(f"   Invalidated refresh tokens")

        # Orphan the user account (keep _id, free_project_id, card_fingerprints for abuse tracking)
        orphan_data = {
            'is_deleted': True,
            'deleted_at': datetime.datetime.utcnow(),
            'email': None,
            'password': generate_password_hash(str(uuid.uuid4())),
            'is_verified': False,
            'admin': False,
            'data_consent': None,
            'credit_balance': 0,
        }

        update_result = mongo.db.users.update_one(
            {'_id': user['_id']},
            {'$set': orphan_data}
        )

        if update_result.modified_count > 0:
            print(f"✅ [DELETE ACCOUNT] User account orphaned successfully")
            return jsonify({'message': 'Account deleted successfully!'}), 200
        else:
            print(f"❌ [DELETE ACCOUNT] Failed to orphan user account")
            return jsonify({'message': 'Failed to delete account'}), 500

    except Exception as e:
        print(f"❌ [DELETE ACCOUNT] Error: {str(e)}")
        return jsonify({'message': 'Error deleting account'}), 500


@api_auth.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    """
    Request a password reset email.
    Only verified users can request password resets.

    Request body:
        {
            "email": "user@example.com"
        }

    Returns:
        Success message (always returns success to prevent email enumeration)
    """
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    # Validate email length
    if len(email) > 254:
        return jsonify({'error': 'Email must be 254 characters or less'}), 400

    print(f"🔑 [PASSWORD RESET] Password reset requested")

    # Find user by email
    user = User.find_by_email(email, include_deleted=False)

    # Always return success to prevent email enumeration
    if not user:
        print(f"⚠️  [PASSWORD RESET] User not found (returning success anyway)")
        return jsonify({'message': 'If this email is registered and verified, a password reset link has been sent'}), 200

    # Check if user is verified
    if not user.get('is_verified', False):
        print(f"⚠️  [PASSWORD RESET] User not verified (returning success anyway)")
        return jsonify({'message': 'If this email is registered and verified, a password reset link has been sent'}), 200

    # Generate password reset token (expires in 1 hour)
    reset_token = s.dumps(email)  # Uses EMAIL_VERIFICATION_SALT from serializer
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    print(f"   Generated reset token")

    # Send password reset email
    email_sent = send_password_reset_email(
        email,
        'User',
        reset_url
    )

    if email_sent:
        print(f"✅ [PASSWORD RESET] Reset email sent")
    else:
        print(f"❌ [PASSWORD RESET] Failed to send email")

    # Always return success to prevent email enumeration
    return jsonify({'message': 'If this email is registered and verified, a password reset link has been sent'}), 200


@api_auth.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Reset password using token from email.

    Request body:
        {
            "token": "reset-token-from-email",
            "new_password": "new-password"
        }

    Returns:
        Success message
    """
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    # Validate password length
    if len(new_password) > 128:
        return jsonify({'error': 'Password must be 128 characters or less'}), 400
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    # Create hash of token for database lookup
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Check if token has already been used
    if UsedToken.is_token_used(token_hash):
        print(f"❌ [PASSWORD RESET] Token already used")
        return jsonify({'error': 'This reset link has already been used'}), 400

    # Validate token (1 hour expiry) - uses EMAIL_VERIFICATION_SALT from serializer
    try:
        email = s.loads(token, max_age=3600)
        print(f"🔑 [PASSWORD RESET] Valid token")
    except Exception as e:
        print(f"❌ [PASSWORD RESET] Invalid or expired token")
        return jsonify({'error': 'Invalid or expired reset link'}), 400

    # Find user
    user = User.find_by_email(email, include_deleted=False)
    if not user:
        print(f"❌ [PASSWORD RESET] User not found")
        return jsonify({'error': 'User not found'}), 404

    # Mark token as used BEFORE updating password
    UsedToken.mark_token_used(token_hash, 'password_reset', email)

    # Update password
    hashed_password = generate_password_hash(new_password)
    User.update_password(email, hashed_password)

    # Invalidate all refresh tokens (force re-login)
    User.invalidate_refresh_token(email)

    print(f"✅ [PASSWORD RESET] Password reset successful")
    return jsonify({'message': 'Password reset successful'}), 200

