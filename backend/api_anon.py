from flask import Blueprint, jsonify, request
from datetime import datetime
from config import limiter
from database import Poll, Norms, PollResponse, NormResponses

api_anon = Blueprint('api_anon_blueprint', __name__, url_prefix='/api')

@api_anon.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@api_anon.route('/polls/public', methods=['GET'])
@limiter.limit("100 per minute")
def get_public_polls():
    polls = Poll.find_all()
    
    public_polls = []
    for poll in polls:
        public_polls.append({
            '_id': str(poll['_id']),
            'title': poll.get('title', ''),
            'short_title': poll.get('short_title', ''),
            'created_at': poll.get('created_at'),
            'question_count': len(poll.get('questions', []))
        })
    
    return jsonify({'polls': public_polls}), 200

@api_anon.route('/polls/<poll_id>/details', methods=['GET'])
@limiter.limit("50 per minute")
def get_poll_details(poll_id):
    poll = Poll(_id=poll_id)
    poll_data = poll.find()
    
    if not poll_data:
        return jsonify({'error': 'Poll not found'}), 404
    
    return jsonify({
        'poll': {
            '_id': str(poll_data['_id']),
            'title': poll_data.get('title', ''),
            'short_title': poll_data.get('short_title', ''),
            'questions': poll_data.get('questions', []),
            'created_at': poll_data.get('created_at')
        }
    }), 200

@api_anon.route('/norms/public', methods=['GET'])
@limiter.limit("100 per minute")
def get_public_norms():
    norms = Norms.find_all()
    
    public_norms = []
    for norm in norms:
        public_norms.append({
            '_id': str(norm['_id']),
            'name': norm.get('name', ''),
            'short_title': norm.get('short_title', ''),
            'created_at': norm.get('created_at'),
            'norm_count': len(norm.get('norms', []))
        })
    
    return jsonify({'norms': public_norms}), 200

@api_anon.route('/norms/<short_title>/details', methods=['GET'])
@limiter.limit("50 per minute")
def get_norm_details(short_title):
    norm = Norms(short_title=short_title)
    norm_data = norm.find()
    
    if not norm_data:
        return jsonify({'error': 'Norm not found'}), 404
    
    return jsonify({
        'norm': {
            '_id': str(norm_data['_id']),
            'name': norm_data.get('name', ''),
            'short_title': norm_data.get('short_title', ''),
            'norms': norm_data.get('norms', []),
            'created_at': norm_data.get('created_at')
        }
    }), 200

@api_anon.route('/polls/<poll_id>/stats', methods=['GET'])
@limiter.limit("30 per minute")
def get_poll_stats(poll_id):
    poll = Poll(_id=poll_id)
    if not poll.find():
        return jsonify({'error': 'Poll not found'}), 404
    
    responses = PollResponse.find_all({'poll_id': poll_id})
    
    return jsonify({
        'poll_id': poll_id,
        'total_responses': len(responses),
        'last_response': max([r.get('submitted_at') for r in responses], default=None)
    }), 200

@api_anon.route('/norms/<short_title>/stats', methods=['GET'])
@limiter.limit("30 per minute")
def get_norm_stats(short_title):
    norm = Norms(short_title=short_title)
    if not norm.find():
        return jsonify({'error': 'Norm not found'}), 404
    
    responses = NormResponses.find_all({'short_title': short_title})
    
    return jsonify({
        'short_title': short_title,
        'total_responses': len(responses),
        'last_response': max([r.get('submitted_at') for r in responses], default=None)
    }), 200

@api_anon.route('/info', methods=['GET'])
def get_app_info():
    return jsonify({
        'app_name': 'LaTeX Survey API',
        'version': '1.0.0',
        'description': 'API for managing surveys, polls, and norms',
        'endpoints': {
            'auth': '/api/auth/*',
            'user': '/api/user/*',
            'admin': '/api/admin/*',
            'public': '/api/*'
        }
    }), 200