from flask import Blueprint, jsonify, request, send_file
from datetime import datetime
import os
from api_auth import requires_auth
from config import limiter, ADMIN_IMAGES_DIR
from database import Answer, PollResponse, Poll, Norms, NormResponses, User

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

@api_admin.route('/polls', methods=['GET'])
@requires_auth
@requires_admin
def get_all_polls():
    polls = Poll.find_all()
    return jsonify({'polls': polls}), 200

@api_admin.route('/polls', methods=['POST'])
@requires_auth
@requires_admin
@limiter.limit("20 per minute")
def create_poll():
    data = request.get_json()
    
    if not data or 'title' not in data or 'questions' not in data:
        return jsonify({'error': 'Title and questions are required'}), 400
    
    poll = Poll(
        title=data['title'],
        short_title=data.get('short_title', data['title']),
        questions=data['questions']
    )
    
    if poll.save():
        return jsonify({'message': 'Poll created successfully', 'poll_id': str(poll.data['_id'])}), 201
    
    return jsonify({'error': 'Failed to create poll'}), 500

@api_admin.route('/polls/<poll_id>', methods=['PUT'])
@requires_auth
@requires_admin
@limiter.limit("20 per minute")
def update_poll(poll_id):
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    poll = Poll(_id=poll_id)
    poll_data = poll.find()
    
    if not poll_data:
        return jsonify({'error': 'Poll not found'}), 404
    
    if 'title' in data:
        poll.data['title'] = data['title']
    if 'short_title' in data:
        poll.data['short_title'] = data['short_title']
    if 'questions' in data:
        poll.data['questions'] = data['questions']
    
    if poll.save():
        return jsonify({'message': 'Poll updated successfully'}), 200
    
    return jsonify({'error': 'Failed to update poll'}), 500

@api_admin.route('/polls/<poll_id>', methods=['DELETE'])
@requires_auth
@requires_admin
@limiter.limit("10 per minute")
def delete_poll(poll_id):
    poll = Poll(_id=poll_id)
    poll_data = poll.find()
    
    if not poll_data:
        return jsonify({'error': 'Poll not found'}), 404
    
    if poll.delete():
        return jsonify({'message': 'Poll deleted successfully'}), 200
    
    return jsonify({'error': 'Failed to delete poll'}), 500

@api_admin.route('/norms', methods=['GET'])
@requires_auth
@requires_admin
def get_all_norms():
    norms = Norms.find_all()
    return jsonify({'norms': norms}), 200

@api_admin.route('/norms', methods=['POST'])
@requires_auth
@requires_admin
@limiter.limit("20 per minute")
def create_norm():
    data = request.get_json()
    
    if not data or 'name' not in data or 'norms' not in data:
        return jsonify({'error': 'Name and norms are required'}), 400
    
    norm = Norms(
        name=data['name'],
        short_title=data.get('short_title', data['name']),
        norms=data['norms']
    )
    
    if norm.save():
        return jsonify({'message': 'Norm created successfully', 'norm_id': str(norm.data['_id'])}), 201
    
    return jsonify({'error': 'Failed to create norm'}), 500

@api_admin.route('/responses/poll/<poll_id>', methods=['GET'])
@requires_auth
@requires_admin
def get_poll_responses(poll_id):
    responses = PollResponse.find_all({'poll_id': poll_id})
    return jsonify({'responses': responses}), 200

@api_admin.route('/responses/norm/<short_title>', methods=['GET'])
@requires_auth
@requires_admin
def get_norm_responses(short_title):
    responses = NormResponses.find_all({'short_title': short_title})
    return jsonify({'responses': responses}), 200

@api_admin.route('/stats', methods=['GET'])
@requires_auth
@requires_admin
def get_admin_stats():
    total_users = len(User.find_all())
    total_polls = len(Poll.find_all())
    total_norms = len(Norms.find_all())
    total_poll_responses = len(PollResponse.find_all())
    total_norm_responses = len(NormResponses.find_all())
    
    return jsonify({
        'stats': {
            'total_users': total_users,
            'total_polls': total_polls,
            'total_norms': total_norms,
            'total_poll_responses': total_poll_responses,
            'total_norm_responses': total_norm_responses
        }
    }), 200

@api_admin.route('/images/<filename>', methods=['GET'])
@requires_auth
@requires_admin
def get_admin_image(filename):
    try:
        return send_file(os.path.join(ADMIN_IMAGES_DIR, filename))
    except FileNotFoundError:
        return jsonify({'error': 'Image not found'}), 404