from flask import Blueprint, jsonify, request
from api_auth import requires_auth
from config import limiter
from database import User

api_admin = Blueprint('api_admin_blueprint', __name__, url_prefix='/api/admin')

def requires_admin(f):
    from functools import wraps
    @wraps(f)
    def admin_wrapper(*args, **kwargs):
        user_email = request.current_user.get('email', '')
        if not user_email.endswith('@admin.com'):  # Simple admin check
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return admin_wrapper

@api_admin.route('/users', methods=['GET'])
@requires_auth
@requires_admin
def get_all_users():
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
@requires_auth
@requires_admin
@limiter.limit("10 per minute")
def delete_user(user_email):
    user = User(email=user_email)
    user_data = user.find()
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    
    if user.delete():
        return jsonify({'message': 'User deleted successfully'}), 200
    
    return jsonify({'error': 'Failed to delete user'}), 500

@api_admin.route('/stats', methods=['GET'])
@requires_auth
@requires_admin
def get_admin_stats():
    total_users = len(User.find_all())
    
    return jsonify({
        'stats': {
            'total_users': total_users
        }
    }), 200