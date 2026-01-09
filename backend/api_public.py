from flask import Blueprint, jsonify
from datetime import datetime

api_public = Blueprint('api_public_blueprint', __name__, url_prefix='/api')

@api_public.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@api_public.route('/info', methods=['GET'])
def get_app_info():
    return jsonify({
        'app_name': 'LaTeX Site API',
        'version': '1.0.0',
        'description': 'API for account management',
        'endpoints': {
            'auth': '/api/auth/*',
            'user': '/api/user/*',
            'public': '/api/*'
        }
    }), 200