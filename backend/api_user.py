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