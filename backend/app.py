from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta
import traceback

from api_admin import api_admin
from api_anon import api_anon
from api_auth import api_auth
from api_latext import api_latext
from api_user import api_user
from config import *
from database import mongo

app = Flask(__name__)

CORS(app)

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
        if request.is_json:
            print(f"JSON: {request.get_json(silent=True)}")
        elif request.form:
            print(f"Form: {dict(request.form)}")
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
    print("\n🔥 422 ERROR CAUGHT!")
    print(f"Error: {e}")
    traceback.print_exc()
    return jsonify({'error': 'Unprocessable Entity', 'message': str(e)}), 422

# Add generic exception handler
@app.errorhandler(Exception)
def handle_exception(e):
    print("\n💥 UNHANDLED EXCEPTION!")
    print(f"Error: {e}")
    traceback.print_exc()
    return jsonify({'error': 'Internal Server Error', 'message': str(e)}), 500

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
app.register_blueprint(api_anon)
app.register_blueprint(api_admin)
app.register_blueprint(api_auth)
app.register_blueprint(api_latext)

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
    print(f"MongoDB URI: {MONGO_URI}")

@app.route('/')
def hello():
    return {'message': 'Hello from Flask LaTeX API!'}

if __name__ == '__main__':
    app.run(debug=True, port=8000)