from flask import Blueprint, jsonify, request
from api_auth import requires_admin
from config import limiter
from database import User

api_admin = Blueprint('api_admin_blueprint', __name__, url_prefix='/api/admin')

@api_admin.route('/users', methods=['GET'])
@requires_admin
def get_all_users(user, data):
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    
    users = User.find_all()
    
    total = len(users)
    start = (page - 1) * limit
    end = start + limit
    paginated_users = users[start:end]
    
    for user in paginated_users:
        if 'password_hash' in user:
            del user['password_hash']
    
    return jsonify({
        'users': paginated_users,
        'total': total,
        'page': page,
        'limit': limit
    }), 200

@api_admin.route('/users/<user_email>', methods=['DELETE'])
@requires_admin
@limiter.limit("300 per minute")
def delete_user(admin_user, data, user_email):
    user = User(email=user_email)
    user_data = user.find()
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    
    if user.delete():
        return jsonify({'message': 'User deleted successfully'}), 200
    
    return jsonify({'error': 'Failed to delete user'}), 500

@api_admin.route('/stats', methods=['GET'])
@requires_admin
def get_admin_stats(user, data):
    total_users = len(User.find_all())
    
    return jsonify({
        'stats': {
            'total_users': total_users
        }
    }), 200
