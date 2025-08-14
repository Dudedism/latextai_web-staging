from flask import Blueprint, jsonify, request
from datetime import datetime
from api_auth import requires_auth
from config import limiter
from database import Answer, PollResponse, Poll, Norms, NormResponses, User

api_user = Blueprint('api_user_blueprint', __name__, url_prefix='/api/user')

def percentile_rank(data, number):
    sorted_data = sorted(data)
    count = sum(x <= number for x in sorted_data)
    percentile = 100 * (count - 1) / len(sorted_data)
    return percentile

def getAnswers(norms, d, user, short_title):
    nr = None
    info = {}
    for i, obj in enumerate(norms['norms']):
        if (obj['details'].get('dimension', 'none') == d):
            if (obj.get('type', 'null') == 'scale'):
                continue
            feature = obj['details'].get('name', 'Custom')
            if (feature != 'Custom'):
                if (user.get('info', None) is None):
                    return None
                ans = user['info'][feature.lower()]
                if (ans == 'male'):
                    ans = 1
                if (ans == 'female'):
                    ans = 0
                if (feature == 'Age'):
                    if (not ans.isdigit()):
                        birth_date = datetime.strptime(ans, "%Y-%m-%d")
                        today = datetime.now()
                        ans = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
                info[feature] = (ans, i)
            else:
                nr = NormResponses(short_title=short_title, user_email=user['email'])
                nr = nr.find()
    if (nr is [] and info is {}):
        return None
    if (nr is None):
        nr = {'answers' : []}
    info_l = []
    for key,val in info.items():
        t = {'question_id': key, 'question_type': 'text', 'answer': val[0]}
        info_l.append(t)
    nr['answers'].extend(info_l)
    return [float(obj['answer']) for obj in nr['answers']]

@api_user.route('/profile', methods=['GET'])
@requires_auth
def get_profile():
    user_email = request.current_user['email']
    user = User(email=user_email)
    user_data = user.find()
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'email': user_data['email'],
        'info': user_data.get('info', {}),
        'created_at': user_data.get('created_at')
    }), 200

@api_user.route('/profile', methods=['PUT'])
@requires_auth
@limiter.limit("10 per minute")
def update_profile():
    user_email = request.current_user['email']
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    user = User(email=user_email)
    user_data = user.find()
    
    if not user_data:
        return jsonify({'error': 'User not found'}), 404
    
    if 'info' in data:
        user.data['info'] = data['info']
    
    if user.save():
        return jsonify({'message': 'Profile updated successfully'}), 200
    
    return jsonify({'error': 'Failed to update profile'}), 500

@api_user.route('/polls', methods=['GET'])
@requires_auth
def get_user_polls():
    user_email = request.current_user['email']
    
    responses = PollResponse.find_all({'user_email': user_email})
    
    return jsonify({
        'responses': responses
    }), 200

@api_user.route('/polls/<poll_id>/submit', methods=['POST'])
@requires_auth
@limiter.limit("20 per minute")
def submit_poll_response(poll_id):
    user_email = request.current_user['email']
    data = request.get_json()
    
    if not data or 'responses' not in data:
        return jsonify({'error': 'Responses are required'}), 400
    
    poll = Poll(_id=poll_id)
    if not poll.find():
        return jsonify({'error': 'Poll not found'}), 404
    
    existing_response = PollResponse(user_email=user_email, poll_id=poll_id)
    if existing_response.find():
        return jsonify({'error': 'You have already responded to this poll'}), 409
    
    poll_response = PollResponse(
        user_email=user_email,
        poll_id=poll_id,
        responses=data['responses']
    )
    
    if poll_response.save():
        return jsonify({'message': 'Poll response submitted successfully'}), 201
    
    return jsonify({'error': 'Failed to submit response'}), 500

@api_user.route('/norms/<short_title>/submit', methods=['POST'])
@requires_auth
@limiter.limit("20 per minute")
def submit_norm_response(short_title):
    user_email = request.current_user['email']
    data = request.get_json()
    
    if not data or 'answers' not in data:
        return jsonify({'error': 'Answers are required'}), 400
    
    norms = Norms(short_title=short_title)
    if not norms.find():
        return jsonify({'error': 'Norm not found'}), 404
    
    existing_response = NormResponses(user_email=user_email, short_title=short_title)
    if existing_response.find():
        existing_response.data['answers'] = data['answers']
        if existing_response.save():
            return jsonify({'message': 'Norm response updated successfully'}), 200
    else:
        norm_response = NormResponses(
            user_email=user_email,
            short_title=short_title,
            answers=data['answers']
        )
        if norm_response.save():
            return jsonify({'message': 'Norm response submitted successfully'}), 201
    
    return jsonify({'error': 'Failed to submit response'}), 500

@api_user.route('/answers', methods=['GET'])
@requires_auth
def get_user_answers():
    user_email = request.current_user['email']
    
    answers = Answer.find_all({'user_email': user_email})
    
    return jsonify({
        'answers': answers
    }), 200