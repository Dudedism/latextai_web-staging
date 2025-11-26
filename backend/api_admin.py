from flask import Blueprint, jsonify, request
from api_auth import requires_admin
from config import limiter
from database import User, Ticket, Project

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

###############
# Admin Panel #
###############

########################
# Support Ticket APIs  #
########################

@api_admin.route('/tickets', methods=['GET'])
@requires_admin
def get_all_tickets(user, data):
    """Get ALL tickets across all projects with optional filters"""
    # Get query parameters
    status_filter = request.args.get('status')
    user_filter = request.args.get('user_id')
    project_filter = request.args.get('project_id')

    # Validate filter lengths
    if status_filter and len(status_filter) > 20:
        return jsonify({'error': 'Invalid status filter'}), 400
    if user_filter and len(user_filter) > 254:
        return jsonify({'error': 'Invalid user filter'}), 400
    if project_filter and len(project_filter) > 36:
        return jsonify({'error': 'Invalid project filter'}), 400

    # Build query
    query = {}
    if status_filter:
        query['status'] = status_filter
    if user_filter:
        query['user_id'] = user_filter
    if project_filter:
        query['project_id'] = project_filter

    # Get all tickets matching query
    tickets = Ticket.find_all(query)

    # Format tickets for response with additional context
    formatted_tickets = []
    for ticket in tickets:
        # Get project info for context
        project = Project.find_by_id(ticket.get('project_id'))

        formatted_tickets.append({
            'ticket_id': ticket.get('ticket_id'),
            'subject': ticket.get('subject'),
            'status': ticket.get('status'),
            'user_id': ticket.get('user_id'),
            'user_email': ticket.get('user_id'),  # user_id is actually the email
            'project_id': ticket.get('project_id'),
            'project_filename': project.get('upload_filename', 'Unknown') if project else 'Unknown',
            'created_at': ticket.get('created_at').isoformat() if ticket.get('created_at') else None,
            'message_count': len(ticket.get('messages', []))
        })

    # Sort by created_at descending (newest first)
    formatted_tickets.sort(key=lambda x: x['created_at'] if x['created_at'] else '', reverse=True)

    return jsonify({'tickets': formatted_tickets}), 200

@api_admin.route('/ticket/<ticket_id>', methods=['GET'])
@requires_admin
def get_ticket_details(user, data, ticket_id):
    """Get full ticket details with all messages and context"""
    # Validate ticket_id length (UUID format, max 36 chars)
    if len(ticket_id) > 36:
        return jsonify({'error': 'Invalid ticket_id format'}), 400

    ticket_data = Ticket.find_by_id(ticket_id)
    if not ticket_data:
        return jsonify({'error': 'Ticket not found'}), 404

    # Get project and user info for context
    project = Project.find_by_id(ticket_data.get('project_id'))
    ticket_user = User.find_by_email(ticket_data.get('user_id'))

    # Format messages
    formatted_messages = []
    for msg in ticket_data.get('messages', []):
        formatted_messages.append({
            'message_id': msg.get('message_id'),
            'content': msg.get('content'),
            'sender': msg.get('sender'),
            'sender_id': msg.get('sender_id'),
            'timestamp': msg.get('timestamp').isoformat() if msg.get('timestamp') else None
        })

    return jsonify({
        'ticket_id': ticket_data.get('ticket_id'),
        'subject': ticket_data.get('subject'),
        'status': ticket_data.get('status'),
        'user_email': ticket_data.get('user_id'),
        'user_name': ticket_user.get('name', 'Unknown') if ticket_user else 'Unknown',
        'project_id': ticket_data.get('project_id'),
        'project_name': project.get('upload_filename', 'Unknown') if project else 'Unknown',
        'created_at': ticket_data.get('created_at').isoformat() if ticket_data.get('created_at') else None,
        'messages': formatted_messages
    }), 200

@api_admin.route('/ticket/<ticket_id>/reply', methods=['POST'])
@requires_admin
def reply_to_ticket(user, data, ticket_id):
    """Admin reply to a support ticket"""
    # Validate ticket_id length (UUID format, max 36 chars)
    if len(ticket_id) > 36:
        return jsonify({'error': 'Invalid ticket_id format'}), 400

    # Get request data
    request_data = request.get_json()
    message = request_data.get('message', '').strip()

    # Validate message length
    if len(message) < 10 or len(message) > 2000:
        return jsonify({'error': 'Message must be between 10 and 2000 characters'}), 400

    # Find the ticket
    ticket = Ticket()
    ticket_data = ticket.find({'ticket_id': ticket_id})
    if not ticket_data:
        return jsonify({'error': 'Ticket not found'}), 404

    # Add admin message
    success = ticket.add_message(
        content=message,
        sender='admin',
        sender_id=user['email']
    )

    if success:
        # Update status to in_progress if it was open
        if ticket.data.get('status') == 'open':
            ticket.update_status('in_progress')

        return jsonify({
            'success': True,
            'message': 'Reply sent successfully'
        }), 200
    else:
        return jsonify({'error': 'Failed to send reply'}), 500

@api_admin.route('/ticket/<ticket_id>/status', methods=['PATCH'])
@requires_admin
def update_ticket_status(user, data, ticket_id):
    """Update ticket status"""
    # Validate ticket_id length (UUID format, max 36 chars)
    if len(ticket_id) > 36:
        return jsonify({'error': 'Invalid ticket_id format'}), 400

    request_data = request.get_json()
    new_status = request_data.get('status')

    # Validate status
    valid_statuses = ['open', 'in_progress', 'resolved', 'closed']
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400

    # Find and update ticket
    ticket = Ticket()
    ticket_data = ticket.find({'ticket_id': ticket_id})
    if not ticket_data:
        return jsonify({'error': 'Ticket not found'}), 404

    success = ticket.update_status(new_status)

    if success:
        return jsonify({
            'success': True,
            'message': f'Ticket status updated to {new_status}'
        }), 200
    else:
        return jsonify({'error': 'Failed to update status'}), 500

