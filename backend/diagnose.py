"""
Diagnostic script to debug 422 errors in api_latext.py endpoints
"""
import sys
import inspect
from flask import Flask
from flask_jwt_extended import JWTManager

# Create minimal Flask app
app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'test-key'
jwt = JWTManager(app)

# Import the blueprint
from api_latext import api_latext

# Register blueprint
app.register_blueprint(api_latext)

print("=" * 60)
print("ENDPOINT DIAGNOSTICS")
print("=" * 60)

# Check all routes in the blueprint
for rule in app.url_map.iter_rules():
    if rule.rule.startswith('/api/latex'):
        endpoint = rule.endpoint
        view_func = app.view_functions.get(endpoint)

        print(f"\n📍 Route: {rule.rule}")
        print(f"   Methods: {rule.methods}")
        print(f"   Endpoint: {endpoint}")

        if view_func:
            # Get the original function (before decorators)
            original_func = view_func
            while hasattr(original_func, '__wrapped__'):
                original_func = original_func.__wrapped__

            sig = inspect.signature(original_func)
            print(f"   Function: {original_func.__name__}")
            print(f"   Parameters: {list(sig.parameters.keys())}")
            print(f"   Has 'user': {'user' in sig.parameters}")
            print(f"   Has 'data': {'data' in sig.parameters}")

print("\n" + "=" * 60)
print("CHECKING SPECIFIC FUNCTIONS")
print("=" * 60)

# Import directly
from api_latext import get_projects, upload_file, get_pdf, get_tex

functions_to_check = [
    ('get_projects', get_projects),
    ('upload_file', upload_file),
    ('get_pdf', get_pdf),
    ('get_tex', get_tex)
]

for name, func in functions_to_check:
    # Unwrap decorators
    original = func
    while hasattr(original, '__wrapped__'):
        original = original.__wrapped__

    sig = inspect.signature(original)
    print(f"\n🔍 {name}:")
    print(f"   Parameters: {list(sig.parameters.keys())}")
    print(f"   Has 'data' param: {'data' in sig.parameters}")

print("\n" + "=" * 60)
print("TEST: Simulating request to /api/latex/projects")
print("=" * 60)

with app.test_client() as client:
    # Try without auth (should get 401, not 422)
    response = client.get('/api/latex/projects')
    print(f"\nGET /api/latex/projects (no auth):")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.get_json()}")

    # Try with invalid JSON on GET (should still work for GET)
    response = client.get('/api/latex/projects',
                          headers={'Content-Type': 'application/json'},
                          data='invalid json')
    print(f"\nGET /api/latex/projects (invalid JSON body):")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.get_json() if response.status_code != 500 else 'Error'}")

print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
