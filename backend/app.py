from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
import os
import threading
import time

from api_public import api_public
from api_auth import api_auth
from api_latext import api_latext
from api_project import api_project
from api_user import api_user
from api_stripe import api_stripe
from api_credits import api_credits
from api_subscription import api_subscription
from config import *
from database import mongo, User

app = Flask(__name__)

CORS(app)

# Security: Block access to sensitive files
BLOCKED_EXTENSIONS = {'.env', '.yml', '.yaml', '.json', '.py', '.pyc', '.sh', '.md', '.txt', '.log', '.sql', '.db', '.sqlite', '.html'}
BLOCKED_FILENAMES = {
    '.env', '.env.local', '.env.development', '.env.staging', '.env.production',
    'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '.dockerignore',
    'requirements.txt', 'package.json', 'package-lock.json',
    '.gitignore', '.git', 'config.py', 'database.py',
    'api_auth.py', 'api_user.py', 'api_latext.py', 'api_project.py', 'api_public.py',
    'app.py', 'api_subscription.py', 'email_service.py', 'templates.json', 'verification_email.html',
    'deploy.sh', 'diagnose.py'
}
BLOCKED_PATTERNS = {'/api', '/.env', '/docker', '/config', '/database', '/__pycache__'}

@app.before_request
def block_sensitive_files():
    """Block access to sensitive configuration and source files"""
    path = request.path.lower()

    # Check for blocked filenames
    for blocked in BLOCKED_FILENAMES:
        if blocked.lower() in path:
            print(f"🚨 [SECURITY] Blocked attempt to access sensitive file: {request.path}")
            return jsonify({'error': 'Forbidden'}), 403

    # Check for blocked file extensions (except for allowed routes)
    if not path.startswith('/api/'):
        for ext in BLOCKED_EXTENSIONS:
            if path.endswith(ext):
                print(f"🚨 [SECURITY] Blocked attempt to access file with sensitive extension: {request.path}")
                return jsonify({'error': 'Forbidden'}), 403

    return None

# Add request logging
@app.before_request
def log_request():
    print(f"\n{'='*60}")
    print(f"📥 {request.method} {request.path}")
    print(f"{'='*60}")
    print(f"Content-Type: {request.content_type}")

    # Log Authorization header (redacted)
    auth_header = request.headers.get('Authorization', '')
    if auth_header:
        if len(auth_header) > 50:
            print(f"Authorization: {auth_header[:20]}...{auth_header[-10:]}")
        else:
            print(f"Authorization: {auth_header}")

        # Check JWT format
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            segments = token.split('.')
            print(f"JWT Segments: {len(segments)} (should be 3)")
            if len(segments) != 3:
                print(f"⚠️  INVALID JWT: Expected 3 segments, got {len(segments)}")
    else:
        print("Authorization: [NONE]")

    if request.method in ['POST', 'PUT', 'PATCH']:
        if request.files:
            print(f"Files: {list(request.files.keys())}")
    print(f"{'='*60}\n")

@app.after_request
def log_response(response):
    if response.status_code >= 400:
        print(f"\n🚨 ERROR RESPONSE: {response.status_code}")
        print(f"Body: {response.get_data(as_text=True)[:500]}\n")
    return response

# Add 422 error handler
@app.errorhandler(422)
def handle_unprocessable_entity(e):
    print(f"\n🔥 422 ERROR: {e}")
    return jsonify({'error': 'Invalid request data'}), 422

# Add generic exception handler
@app.errorhandler(Exception)
def handle_exception(e):
    print(f"\n💥 UNHANDLED EXCEPTION: {e}")
    return jsonify({'error': 'An unexpected error occurred'}), 500

# Basic Flask config
app.config["MONGO_URI"] = MONGO_URI
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['SECRET_KEY'] = SECRET_KEY

# Flask-JWT-Extended config
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=JWT_ACCESS_TOKEN_EXPIRES)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(seconds=JWT_REFRESH_TOKEN_EXPIRES)
app.config['JWT_TOKEN_LOCATION'] = ['headers']  # Accept tokens in Authorization header
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

# Initialize extensions
jwt = JWTManager(app)
limiter.init_app(app)
mongo.init_app(app)

app.register_blueprint(api_user)
app.register_blueprint(api_public)
app.register_blueprint(api_auth)
app.register_blueprint(api_latext)
app.register_blueprint(api_project)
app.register_blueprint(api_stripe)
app.register_blueprint(api_credits)
app.register_blueprint(api_subscription)

# Test MongoDB connection
try:
    # Try to get server info to verify connection
    with app.app_context():
        info = mongo.db.command('serverStatus')
        print(f"MongoDB connected successfully! Version: {info.get('version', 'unknown')}")
        # List databases to verify access
        print(f"Database name: {mongo.db.name}")
except Exception as e:
    print(f"ERROR: Failed to connect to MongoDB: {e}")


def _run_anonymous_cleanup(app):
    """Background thread: clean up expired anonymous users every 6 hours."""
    INTERVAL = 6 * 60 * 60  # 6 hours
    time.sleep(60)  # Initial delay — let app fully start
    while True:
        try:
            with app.app_context():
                count = User.cleanup_expired_anonymous(max_age_days=3)
                if count > 0:
                    print(f"[CLEANUP] Deleted {count} expired anonymous users")
        except Exception as e:
            print(f"[CLEANUP] Error: {e}")
        time.sleep(INTERVAL)


# Start cleanup thread (guard against duplicate in Flask debug reloader)
if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN'):
    cleanup_thread = threading.Thread(target=_run_anonymous_cleanup, args=(app,), daemon=True)
    cleanup_thread.start()


@app.route('/')
def hello():
    return {'message': 'Hello from Flask LaTeX API!', 'autodeploy': True}

if __name__ == '__main__':
    app.run(debug=True, port=8000)