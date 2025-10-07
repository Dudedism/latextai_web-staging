import datetime
import inspect
import uuid
from functools import wraps, partial
import re
import dns.resolver

import jwt
from flask import jsonify, Blueprint, request, url_for, redirect, send_file
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

def _make_jwt(email):
    return jwt.encode(
        {
            'email': email,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS)
        }, SECRET_KEY, algorithm='HS256')

def _decode_jwt(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def _process_token(data):
    token = data['token']
    payload = _decode_jwt(token)  # verify the account for security
    if payload is None:
        return None, None
    email = payload['email']
    user = User.find_by_email(email)  # Use find_by_email to avoid default values issue
    return payload, user

def _authenticate(data, require_admin=False):
    payload, user = _process_token(data)

    if payload is None:
        return None, (jsonify({'message': 'Invalid or expired token.'}), 401)

    elif not user:
        return None, (jsonify({'message': 'User not found.'}), 401)

    elif require_admin and not user['admin']:
        return None, (jsonify({'message': 'User not admin.'}), 403)

    else:
        return user, None

def requires_auth(func=None, require_admin=False, use_form=False):
    """
    Decorator to apply user authentication. Decorator can also provide `data` and `user` parsed from the request body.
    :param func: The Flask API function to be decorated with authentication.
    :param require_admin: Optional boolean indicating whether admin access is required. Default is False.
    :param use_form: Optional boolean indicating whether to use form data. Default is False.
    :return: A wrapper function that authenticates the user before calling the decorated function.
    """
    if func is None:
        return partial(requires_auth, require_admin=require_admin, use_form=use_form)

    @wraps(func)
    def function_wrapper(*args, **kwargs):

        def get_data_source():
            """Determine the source of data"""
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split("Bearer ")[1]
                return { 'token': token }
            return request.form if use_form else request.get_json()

        def prepare_extra_parameters(authenticated_user, sourced_data):
            """Check the parameters of the decorated function and prepare a dictionary for extra parameters"""
            params_dict = dict()
            sig = inspect.signature(func)
            if 'user' in sig.parameters:
                params_dict['user'] = authenticated_user
            if 'data' in sig.parameters:
                params_dict['data'] = sourced_data
            return params_dict

        data = get_data_source()
        user, auth_error = _authenticate(data, require_admin)
        if auth_error:
            return auth_error

        extra_params = prepare_extra_parameters(user, data)
        return func(*args, **kwargs, **extra_params)

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
            return redirect('http://localhost:5173')  # Redirect to frontend

        # Update the user's is_verified status to True using the insertdate method
        User.insertdate(email, {"is_verified": True})

        # Return an HTML page with a JavaScript alert and a redirect
        return '''
        <html>
            <head>
                <script type="text/javascript">
                    alert('Verification successful!');
                    window.location.href = 'http://localhost:5173/signin';
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
        jwtoken = _make_jwt(email)
        return jsonify({'message': 'Login successful!', 'token': jwtoken, 'admin': user['admin'], 'name': user['name'] }), 200
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

    jwt_token = _make_jwt(email)
    return jsonify({'message': 'Logged in anonymously!', 'token': jwt_token, 'name': name}), 200

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

        jwtoken = _make_jwt(email)
        return jsonify({'message': 'Login successful!',
                        'token': jwtoken,
                        'email': email,
                        'admin': existing_user['admin']}), 200

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

