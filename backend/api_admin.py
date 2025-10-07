import os
import json
import shutil
import zipfile
import tempfile
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename
from api_auth import requires_admin
from config import limiter
from database import User, Project, Ticket

api_admin = Blueprint('api_admin_blueprint', __name__, url_prefix='/api/admin')

# Base directory for user projects
USER_PROJECTS_DIR = 'user_projects'

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

############################
# Project Management APIs  #
############################

@api_admin.route('/projects', methods=['GET'])
@requires_admin
def get_all_projects(user, data):
    """Get ALL projects with optional filters"""
    # Get query parameters
    user_filter = request.args.get('user_id')
    status_filter = request.args.get('status')
    search_query = request.args.get('search', '').lower()

    # Build query
    query = {}
    if user_filter:
        query['user_id'] = user_filter
    if status_filter:
        query['status'] = status_filter

    # Get all projects matching query
    projects = Project.find_all(query)

    # Format projects for response
    formatted_projects = []
    for project in projects:
        # Filter by search query if provided
        if search_query:
            filename = project.get('upload_filename', '').lower()
            user_email = project.get('user_id', '').lower()
            if search_query not in filename and search_query not in user_email:
                continue

        formatted_projects.append({
            'project_id': project.get('project_id'),
            'user_id': project.get('user_id'),
            'user_email': project.get('user_id'),  # user_id is actually the email
            'upload_filename': project.get('upload_filename'),
            'template': project.get('template'),
            'status': project.get('status'),
            'created_at': project.get('created_at').isoformat() if project.get('created_at') else None
        })

    # Sort by created_at descending
    formatted_projects.sort(key=lambda x: x['created_at'] if x['created_at'] else '', reverse=True)

    return jsonify({'projects': formatted_projects}), 200

@api_admin.route('/project/<project_id>', methods=['GET'])
@requires_admin
def get_project_details(user, data, project_id):
    """Get specific project details with file list"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Get list of files in project directory
    project_dir = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id))
    files = []

    if os.path.exists(project_dir):
        for filename in os.listdir(project_dir):
            file_path = os.path.join(project_dir, filename)
            if os.path.isfile(file_path):
                file_stat = os.stat(file_path)
                files.append({
                    'filename': filename,
                    'size': file_stat.st_size,
                    'last_modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                })

    return jsonify({
        'project_id': project.get('project_id'),
        'user_id': project.get('user_id'),
        'upload_filename': project.get('upload_filename'),
        'template': project.get('template'),
        'status': project.get('status'),
        'created_at': project.get('created_at').isoformat() if project.get('created_at') else None,
        'files': files
    }), 200

@api_admin.route('/project/<project_id>/files', methods=['GET'])
@requires_admin
def get_project_files(user, data, project_id):
    """List all files in project directory"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    project_dir = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id))
    files = []

    if os.path.exists(project_dir):
        for filename in os.listdir(project_dir):
            file_path = os.path.join(project_dir, filename)
            if os.path.isfile(file_path):
                file_stat = os.stat(file_path)
                files.append({
                    'filename': filename,
                    'size': file_stat.st_size,
                    'last_modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                    'path': file_path
                })

    return jsonify({'files': files}), 200

@api_admin.route('/project/<project_id>/file/<path:filename>', methods=['GET'])
@requires_admin
def download_project_file(user, data, project_id, filename):
    """Download specific file from project"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    file_path = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id), filename)

    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404

    # Determine mimetype based on extension
    if filename.endswith('.pdf'):
        mimetype = 'application/pdf'
    elif filename.endswith('.tex'):
        mimetype = 'text/plain'
    elif filename.endswith('.docx'):
        mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    elif filename.endswith('.doc'):
        mimetype = 'application/msword'
    else:
        mimetype = 'application/octet-stream'

    return send_file(file_path, mimetype=mimetype, as_attachment=True, download_name=filename)

@api_admin.route('/project/<project_id>/file', methods=['POST'])
@requires_admin
def upload_file_to_project(user, data, project_id):
    """Upload file to project directory"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Get optional custom filename, otherwise use original
    custom_filename = request.form.get('filename')
    if custom_filename:
        filename = secure_filename(custom_filename)
    else:
        filename = secure_filename(file.filename)

    # Save file to project directory
    project_dir = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id))
    os.makedirs(project_dir, exist_ok=True)

    file_path = os.path.join(project_dir, filename)
    file.save(file_path)

    # Get file info
    file_stat = os.stat(file_path)

    return jsonify({
        'success': True,
        'file': {
            'filename': filename,
            'size': file_stat.st_size,
            'last_modified': datetime.fromtimestamp(file_stat.st_mtime).isoformat()
        }
    }), 200

@api_admin.route('/project/<project_id>/file/<path:filename>', methods=['DELETE'])
@requires_admin
def delete_project_file(user, data, project_id, filename):
    """Delete specific file from project"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    project_dir = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id))
    file_path = os.path.join(project_dir, filename)

    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404

    # Check if this is the last file in the project
    files_in_dir = [f for f in os.listdir(project_dir) if os.path.isfile(os.path.join(project_dir, f))]
    if len(files_in_dir) <= 1:
        return jsonify({'error': 'Cannot delete the last file in the project. Delete the entire project instead.'}), 400

    # Delete the file
    try:
        os.remove(file_path)
        return jsonify({
            'success': True,
            'message': f'File {filename} deleted successfully'
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete file: {str(e)}'}), 500

@api_admin.route('/project/<project_id>/archive', methods=['GET'])
@requires_admin
def download_project_archive(user, data, project_id):
    """Download entire project as ZIP archive"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    project_dir = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id))

    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project directory not found'}), 404

    # Create temporary ZIP file
    temp_dir = tempfile.gettempdir()
    zip_filename = f'project_{project_id}.zip'
    zip_path = os.path.join(temp_dir, zip_filename)

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(project_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, project_dir)
                    zipf.write(file_path, arcname)

        # Send file and clean up after
        def remove_file(response):
            try:
                os.remove(zip_path)
            except Exception:
                pass
            return response

        return send_file(
            zip_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )
    except Exception as e:
        return jsonify({'error': f'Failed to create archive: {str(e)}'}), 500

@api_admin.route('/project/<project_id>', methods=['DELETE'])
@requires_admin
def delete_project(user, data, project_id):
    """Delete entire project including database entry, all files, and associated tickets"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Delete all tickets associated with this project (cascade delete)
    tickets = Ticket.find_all({'project_id': project_id})
    tickets_deleted = 0
    for ticket_data in tickets:
        ticket_obj = Ticket()
        ticket_obj.data = ticket_data
        if ticket_obj.delete():
            tickets_deleted += 1

    # Delete from database
    project_obj = Project()
    project_obj.data = project
    delete_success = project_obj.delete()

    if not delete_success:
        return jsonify({'error': 'Failed to delete project from database'}), 500

    # Delete project directory
    project_dir = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id))
    if os.path.exists(project_dir):
        try:
            shutil.rmtree(project_dir)
        except Exception as e:
            # Project deleted from DB but files remain - log this
            return jsonify({
                'warning': f'Project deleted from database but files could not be removed: {str(e)}',
                'success': True,
                'tickets_deleted': tickets_deleted
            }), 200

    return jsonify({
        'success': True,
        'message': f'Project {project_id} deleted successfully',
        'tickets_deleted': tickets_deleted
    }), 200

@api_admin.route('/user/<user_id>/export', methods=['GET'])
@requires_admin
def export_user_data(user, data, user_id):
    """Export all user data as JSON (GDPR compliance)"""
    # Get user account info
    user_data = User.find_by_email(user_id)
    if not user_data:
        return jsonify({'error': 'User not found'}), 404

    # Get all projects for user
    projects = Project.find_by_user(user_id)

    # Get all tickets for user
    tickets = Ticket.find_by_user(user_id)

    # Prepare export data
    export_data = {
        'user': {
            'email': user_data.get('email'),
            'name': user_data.get('name'),
            'admin': user_data.get('admin'),
            'is_verified': user_data.get('is_verified'),
            'created_at': user_data.get('created_at').isoformat() if user_data.get('created_at') else None
        },
        'projects': [],
        'tickets': []
    }

    # Format projects
    for project in projects:
        export_data['projects'].append({
            'project_id': project.get('project_id'),
            'upload_filename': project.get('upload_filename'),
            'template': project.get('template'),
            'status': project.get('status'),
            'created_at': project.get('created_at').isoformat() if project.get('created_at') else None
        })

    # Format tickets
    for ticket in tickets:
        export_data['tickets'].append({
            'ticket_id': ticket.get('ticket_id'),
            'subject': ticket.get('subject'),
            'status': ticket.get('status'),
            'project_id': ticket.get('project_id'),
            'created_at': ticket.get('created_at').isoformat() if ticket.get('created_at') else None,
            'messages': ticket.get('messages', [])
        })

    # Create JSON file
    temp_dir = tempfile.gettempdir()
    json_filename = f'user_data_{user_id}.json'
    json_path = os.path.join(temp_dir, json_filename)

    with open(json_path, 'w') as f:
        json.dump(export_data, f, indent=2, default=str)

    # Send file
    def remove_file(response):
        try:
            os.remove(json_path)
        except Exception:
            pass
        return response

    return send_file(
        json_path,
        mimetype='application/json',
        as_attachment=True,
        download_name=json_filename
    )