import os
import shutil
import uuid
from flask import jsonify, Blueprint, request, send_file
from werkzeug.utils import secure_filename
from api_auth import requires_auth
from database import User, Project, Ticket
from datetime import datetime

api_latext = Blueprint('api_latext_blueprint', __name__, url_prefix='/api/latex')

# Base directory for user projects (temporary - will move to latextai service)
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
    """Handle file upload - processing will be delegated to latextai service"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Get template from form data
    template = request.form.get('template', 'nature')

    # Generate unique project ID
    project_id = str(uuid.uuid4())

    # Save uploaded file temporarily (will be moved to latextai service)
    filename = secure_filename(file.filename)
    file_extension = os.path.splitext(filename)[1]

    # Create temporary project directory for uploaded file
    project_dir = create_project_directory(user['email'], project_id)
    upload_path = os.path.join(project_dir, f'{project_id}{file_extension}')
    file.save(upload_path)

    # Create database entry with 'unconverted' status
    # Processing will be handled by latextai service in future phase
    project = Project(
        project_id=project_id,
        user_id=user['email'],
        upload_filename=filename,
        tex_filename=None,  # Will be set after processing
        pdf_filename=None,  # Will be set after processing
        template=template.lower(),
        status='unconverted'  # Changed from 'converted'
    )
    project.insert()

    return jsonify({
        'message': 'File uploaded successfully',
        'project_id': project_id,
        'status': 'unconverted'
    }), 200

@api_latext.route('/projects', methods=['GET'])
@requires_auth
def get_projects(user, data):
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

        formatted_projects.append({
            'id': proj.get('project_id'),
            'title': title,
            'date': date_str,
            'template': template_info['name'],
            'thumbnail': template_info['thumbnail'],
            'status': 'completed' if proj.get('status') == 'converted' else 'processing'
        })

    return jsonify(formatted_projects), 200

@api_latext.route('/project/<project_id>', methods=['GET'])
@requires_auth
def get_project(user, data, project_id):
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
def get_pdf(user, data, project_id):
    """Serve the PDF file for a project (preview for unverified users, full for verified)

    NOTE: This endpoint will be replaced by a proxy to latextai service.
    Currently returns 404 if PDF doesn't exist (no more mock files).
    """
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    # Check user verification status to determine which PDF to serve
    if user.get('is_verified', False):
        # Verified user - serve full PDF
        pdf_filename = project.get('pdf_filename')
        if not pdf_filename:
            return jsonify({'error': 'PDF not available'}), 404
    else:
        # Unverified/anonymous user - serve preview only (first 3 pages)
        pdf_filename = f'preview_{project_id}.pdf'

    # Build PDF path
    pdf_path = os.path.join(
        USER_PROJECTS_DIR,
        str(project.get('user_id')),
        str(project_id),
        pdf_filename
    )

    if not os.path.exists(pdf_path):
        return jsonify({'error': 'PDF not found'}), 404

    return send_file(pdf_path, mimetype='application/pdf')

@api_latext.route('/project/<project_id>/tex', methods=['GET'])
@requires_auth
def get_tex(user, data, project_id):
    """Download the .tex file for a project (only for verified users)

    NOTE: This endpoint will be replaced by a proxy to latextai service.
    Currently returns 404 if TEX doesn't exist (no more mock files).
    """
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

    # Check if tex filename is set
    tex_filename = project.get('tex_filename')
    if not tex_filename:
        return jsonify({'error': 'LaTeX file not available'}), 404

    # Build tex path
    tex_path = os.path.join(
        USER_PROJECTS_DIR,
        str(project.get('user_id')),
        str(project_id),
        tex_filename
    )

    if not os.path.exists(tex_path):
        return jsonify({'error': 'LaTeX file not found'}), 404

    return send_file(
        tex_path,
        mimetype='text/plain',
        as_attachment=True,
        download_name=f"{project.get('upload_filename', 'document').rsplit('.', 1)[0]}.tex"
    )

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
def get_project_tickets(user, data, project_id):
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
def get_ticket_details(user, data, ticket_id):
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

