import os
import shutil
import uuid
import requests
from flask import jsonify, Blueprint, request, send_file, Response
from werkzeug.utils import secure_filename
from api_auth import requires_auth
from database import User, Project, Ticket
from datetime import datetime
from config import LATEXTAI_SERVICE_URL, LATEXTAI_API_KEY

api_latext = Blueprint('api_latext_blueprint', __name__, url_prefix='/api/latex')

# Base directory for user projects (local temporary storage before sending to latextai)
USER_PROJECTS_DIR = 'user_projects'

def create_user_directory(user_id):
    """Create a directory for a user's projects if it doesn't exist"""
    user_dir = os.path.join(USER_PROJECTS_DIR, str(user_id))
    if not os.path.exists(user_dir):
        os.makedirs(user_dir, exist_ok=True)
    return user_dir

def create_project_directory(user_id, project_id):
    """Create a specific project directory for a user"""
    user_dir = create_user_directory(user_id)
    project_dir = os.path.join(user_dir, str(project_id))
    if not os.path.exists(project_dir):
        os.makedirs(project_dir, exist_ok=True)
    return project_dir

@api_latext.route('/upload', methods=['POST'])
@requires_auth
def upload_file(user, data):
    """Handle file upload and forward to latextai service for processing"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Get template from form data (but always use MQ for now)
    template = 'MQ'  # Always use MQ template for now

    # Generate unique project ID
    project_id = str(uuid.uuid4())

    # Get filename
    filename = secure_filename(file.filename)

    # Create database entry with 'processing' status
    project = Project(
        project_id=project_id,
        user_id=user['email'],
        upload_filename=filename,
        tex_filename=None,  # Will be set after processing by latextai
        pdf_filename=None,  # Will be set after processing by latextai
        template=template,
        status='processing'  # Start as processing
    )
    project.insert()

    try:
        # Forward file to latextai service
        files = {'file': (filename, file.stream, file.content_type)}
        form_data = {
            'user_email': user['email'],
            'project_id': project_id,
            'template': template
        }
        headers = {
            'X-API-Key': LATEXTAI_API_KEY
        }

        response = requests.post(
            f"{LATEXTAI_SERVICE_URL}/api/upload",
            files=files,
            data=form_data,
            headers=headers,
            timeout=30
        )

        if response.status_code == 202:
            # Successfully forwarded to latextai
            return jsonify({
                'message': 'File uploaded successfully. Processing started in background.',
                'project_id': project_id,
                'status': 'processing'
            }), 202
        else:
            # Failed to forward to latextai
            # Update project status to failed
            project_obj = Project.find_by_id(project_id)
            if project_obj:
                p = Project(**project_obj)
                p.data['status'] = 'failed'
                p.save()

            return jsonify({
                'error': f'Failed to process file: {response.text}'
            }), response.status_code

    except requests.exceptions.RequestException as e:
        # Network error or timeout
        # Update project status to failed
        project_obj = Project.find_by_id(project_id)
        if project_obj:
            p = Project(**project_obj)
            p.data['status'] = 'failed'
            p.save()

        return jsonify({
            'error': f'Failed to connect to processing service: {str(e)}'
        }), 500

@api_latext.route('/projects', methods=['GET'])
@requires_auth
def get_projects(user):
    """Get all projects for the authenticated user"""
    projects = Project.find_by_user(user['email'])

    # Format projects for frontend
    formatted_projects = []
    for proj in projects:
        # Extract title from filename (remove extension)
        title = proj.get('upload_filename', 'Untitled')
        if '.' in title:
            title = title.rsplit('.', 1)[0]

        # Format date
        created_at = proj.get('created_at', datetime.utcnow())
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        date_str = created_at.strftime('%m/%d/%y')

        # Map template to display name and thumbnail
        template_map = {
            'nature': {'name': 'Nature Communications', 'thumbnail': '/nature.svg'},
            'the lancet': {'name': 'The Lancet', 'thumbnail': '/lancet.svg'},
            'springer': {'name': 'Springer Journal', 'thumbnail': '/springer.svg'},
            'elsevier': {'name': 'Elsevier Journal', 'thumbnail': '/elsevier.svg'},
            'ieee': {'name': 'IEEE Transactions', 'thumbnail': '/ieee.svg'},
        }

        template_info = template_map.get(
            proj.get('template', 'nature'),
            {'name': 'Nature Communications', 'thumbnail': '/nature.svg'}
        )

        # Map database status to frontend status
        db_status = proj.get('status', 'processing')
        if db_status == 'converted':
            frontend_status = 'completed'
        elif db_status in ['processing', 'unconverted']:
            frontend_status = 'processing'
        else:  # failed
            frontend_status = 'failed'

        formatted_projects.append({
            'id': proj.get('project_id'),
            'title': title,
            'date': date_str,
            'template': template_info['name'],
            'thumbnail': template_info['thumbnail'],
            'status': frontend_status
        })

    return jsonify(formatted_projects), 200

@api_latext.route('/project/<project_id>', methods=['GET'])
@requires_auth
def get_project(user, project_id):
    """Get a single project by ID"""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    return jsonify(project), 200

@api_latext.route('/project/<project_id>/pdf', methods=['GET'])
@requires_auth
def get_pdf(user, project_id):
    """Proxy PDF download request to latextai service (preview for unverified users, full for verified)"""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    # Determine preview mode based on user verification status
    preview = 'false' if user.get('is_verified', False) else 'true'

    try:
        # Proxy request to latextai service
        params = {
            'user_email': user['email'],
            'project_id': project_id,
            'preview': preview
        }
        headers = {
            'X-API-Key': LATEXTAI_API_KEY
        }

        response = requests.get(
            f"{LATEXTAI_SERVICE_URL}/api/download/pdf",
            params=params,
            headers=headers,
            stream=True,
            timeout=30
        )

        if response.status_code == 200:
            # Stream the PDF file back to client
            return Response(
                response.iter_content(chunk_size=8192),
                content_type='application/pdf',
                headers={
                    'Content-Disposition': f'inline; filename="{project_id}.pdf"'
                }
            )
        else:
            return jsonify({'error': 'PDF not found'}), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to download PDF: {str(e)}'}), 500

@api_latext.route('/project/<project_id>/tex', methods=['GET'])
@requires_auth
def get_tex(user, project_id):
    """Proxy TEX download request to latextai service (only for verified users)"""
    # Check user verification status first
    if not user.get('is_verified', False):
        return jsonify({'error': 'Please sign up to download LaTeX files'}), 403

    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    try:
        # Proxy request to latextai service
        params = {
            'user_email': user['email'],
            'project_id': project_id
        }
        headers = {
            'X-API-Key': LATEXTAI_API_KEY
        }

        response = requests.get(
            f"{LATEXTAI_SERVICE_URL}/api/download/tex",
            params=params,
            headers=headers,
            stream=True,
            timeout=30
        )

        if response.status_code == 200:
            # Get filename from uploaded file
            filename = project.get('upload_filename', 'document').rsplit('.', 1)[0] + '.tex'

            # Stream the TEX file back to client
            return Response(
                response.iter_content(chunk_size=8192),
                content_type='text/plain',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}"'
                }
            )
        else:
            return jsonify({'error': 'LaTeX file not found'}), response.status_code

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to download LaTeX file: {str(e)}'}), 500

# Support Ticket Endpoints

@api_latext.route('/project/<project_id>/support', methods=['POST'])
@requires_auth
def create_support_ticket(user, data, project_id):
    """Create a new support ticket for a project"""
    # Check user verification status
    if not user.get('is_verified', False):
        return jsonify({'error': 'Please sign up to submit support tickets'}), 401

    # Get request data
    request_data = request.get_json()
    subject = request_data.get('subject', '').strip()
    message = request_data.get('message', '').strip()

    # Validate subject length (5-30 characters)
    if len(subject) < 5 or len(subject) > 30:
        return jsonify({'error': 'Subject must be between 5 and 30 characters'}), 400

    # Validate message length (10-2000 characters)
    if len(message) < 10 or len(message) > 2000:
        return jsonify({'error': 'Message must be between 10 and 2000 characters'}), 400

    # Check if project exists and belongs to user
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check for existing open ticket for this project
    existing_open_ticket = Ticket.find_open_ticket_by_project(project_id)
    if existing_open_ticket:
        return jsonify({
            'error': 'An open ticket already exists for this project. Please close it before creating a new one.'
        }), 400

    # Create new ticket
    ticket = Ticket(
        project_id=project_id,
        user_id=user['email'],
        subject=subject
    )

    # Add initial message
    ticket.data['messages'] = [{
        'message_id': 0,
        'content': message,
        'sender': 'user',
        'sender_id': user['email'],
        'timestamp': datetime.utcnow()
    }]

    # Save ticket to database
    ticket.insert()

    return jsonify({
        'success': True,
        'ticket_id': ticket.data['ticket_id']
    }), 201

@api_latext.route('/project/<project_id>/tickets', methods=['GET'])
@requires_auth
def get_project_tickets(user, project_id):
    """Get all tickets for a project"""
    # Check if project exists and belongs to user
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Get all tickets for this project
    tickets = Ticket.find_by_project(project_id)

    # Format tickets for response (exclude full messages, just include count)
    formatted_tickets = []
    for ticket in tickets:
        formatted_tickets.append({
            'ticket_id': ticket.get('ticket_id'),
            'subject': ticket.get('subject'),
            'status': ticket.get('status'),
            'created_at': ticket.get('created_at').isoformat() if ticket.get('created_at') else None,
            'message_count': len(ticket.get('messages', []))
        })

    # Sort by created_at descending (newest first)
    formatted_tickets.sort(key=lambda x: x['created_at'] if x['created_at'] else '', reverse=True)

    return jsonify({'tickets': formatted_tickets}), 200

@api_latext.route('/ticket/<ticket_id>', methods=['GET'])
@requires_auth
def get_ticket_details(user, ticket_id):
    """Get full ticket details with all messages"""
    # Find the ticket
    ticket_data = Ticket.find_by_id(ticket_id)
    if not ticket_data:
        return jsonify({'error': 'Ticket not found'}), 404

    # Verify ticket belongs to user's project
    project = Project.find_by_id(ticket_data.get('project_id'))
    if not project or project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Format messages for response
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
        'project_id': ticket_data.get('project_id'),
        'subject': ticket_data.get('subject'),
        'status': ticket_data.get('status'),
        'created_at': ticket_data.get('created_at').isoformat() if ticket_data.get('created_at') else None,
        'messages': formatted_messages
    }), 200

@api_latext.route('/ticket/<ticket_id>/message', methods=['POST'])
@requires_auth
def add_ticket_message(user, data, ticket_id):
    """Add a message to an existing ticket"""
    # Check user verification status
    if not user.get('is_verified', False):
        return jsonify({'error': 'Please sign up to send messages'}), 401

    # Get request data
    request_data = request.get_json()
    message = request_data.get('message', '').strip()

    # Validate message length (10-2000 characters)
    if len(message) < 10 or len(message) > 2000:
        return jsonify({'error': 'Message must be between 10 and 2000 characters'}), 400

    # Find the ticket
    ticket = Ticket()
    ticket_data = ticket.find({'ticket_id': ticket_id})
    if not ticket_data:
        return jsonify({'error': 'Ticket not found'}), 404

    # Verify ticket belongs to user's project
    project = Project.find_by_id(ticket.data.get('project_id'))
    if not project or project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check ticket status (can't message closed tickets)
    if ticket.data.get('status') not in ['open', 'in_progress']:
        return jsonify({'error': 'Cannot add messages to closed or resolved tickets'}), 400

    # Check rate limiting (max 5 messages per hour from user)
    message_count = ticket.count_user_messages_in_last_hour()
    if message_count >= 5:
        return jsonify({
            'error': 'Rate limit exceeded. You can only send 5 messages per hour per ticket.'
        }), 429

    # Add the message
    success = ticket.add_message(
        content=message,
        sender='user',
        sender_id=user['email']
    )

    if success:
        return jsonify({
            'success': True,
            'message': 'Message added successfully'
        }), 200
    else:
        return jsonify({'error': 'Failed to add message'}), 500

