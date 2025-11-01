from flask import Blueprint, jsonify, request
from api_auth import requires_auth
from config import limiter
from database import User

api_user = Blueprint('api_user_blueprint', __name__, url_prefix='/api/user')

@api_user.route('/profile', methods=['GET'])
@requires_auth
def get_profile(user):
    return jsonify({
        'email': user['email'],
        'name': user.get('name', ''),
        'info': user.get('info', {}),
        'created_at': user.get('created_at')
    }), 200

@api_user.route('/profile', methods=['PUT'])
@requires_auth
@limiter.limit("10 per minute")
def update_profile(user, data):
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    user_obj = User(email=user['email'])
    user_data = user_obj.find()
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    
    if 'info' in data:
        user_obj.data['info'] = data['info']
    if 'name' in data:
        user_obj.data['name'] = data['name']
    
    if user_obj.save():
        return jsonify({'message': 'Profile updated successfully'}), 200

    return jsonify({'error': 'Failed to update profile'}), 500

@api_user.route('/data-consent', methods=['POST'])
@requires_auth
@limiter.limit("10 per minute")
def update_data_consent(user, data):
    """
    Update user's data consent preference.
    Request body: { "consent": true/false }
    """
    if not data or 'consent' not in data:
        return jsonify({'error': 'Consent value required'}), 400

    consent = data['consent']
    if not isinstance(consent, bool):
        return jsonify({'error': 'Consent must be a boolean'}), 400

    # Update consent in database
    success = User.update_data_consent(user['email'], consent)

    if success:
        return jsonify({
            'message': 'Data consent updated successfully',
            'consent': consent
        }), 200

    return jsonify({'error': 'Failed to update consent'}), 500

@api_user.route('/data-consent', methods=['GET'])
@requires_auth
def get_data_consent(user):
    """
    Get user's current data consent status.
    Returns: { "consent": true/false/null }
    """
    user_data = User.find_by_email(user['email'])

    if not user_data:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'consent': user_data.get('data_consent'),
        'consent_updated_at': user_data.get('consent_updated_at')
    }), 200