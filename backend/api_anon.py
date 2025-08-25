from flask import Blueprint, jsonify
from datetime import datetime

api_anon = Blueprint('api_anon_blueprint', __name__, url_prefix='/api')

@api_anon.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@api_anon.route('/info', methods=['GET'])
def get_app_info():
    return jsonify({
        'app_name': 'LaTeX Site API',
        'version': '1.0.0',
        'description': 'API for account management',
        'endpoints': {
            'auth': '/api/auth/*',
            'user': '/api/user/*',
            'admin': '/api/admin/*',
            'public': '/api/*'
        }
    }), 200