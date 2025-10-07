import os
import shutil
import uuid
from flask import jsonify, Blueprint, request, send_file
from werkzeug.utils import secure_filename
from api_auth import requires_auth
from database import User, Project, Ticket
from datetime import datetime
from PyPDF2 import PdfReader, PdfWriter

api_latext = Blueprint('api_latext_blueprint', __name__, url_prefix='/api/latex')

# Base directory for user projects
USER_PROJECTS_DIR = 'user_projects'
MOCK_FILES_DIR = os.path.join(USER_PROJECTS_DIR, 'mock_files')

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

def copy_mock_files(project_directory, project_id):
    """Copy mock .tex and .pdf files to the project directory"""
    # Copy mock.tex with project_id naming
    mock_tex = os.path.join(MOCK_FILES_DIR, 'mock.tex')
    if os.path.exists(mock_tex):
        shutil.copy(mock_tex, os.path.join(project_directory, f'{project_id}.tex'))

    # Copy mock.pdf with project_id naming
    mock_pdf = os.path.join(MOCK_FILES_DIR, 'mock.pdf')
    if os.path.exists(mock_pdf):
        shutil.copy(mock_pdf, os.path.join(project_directory, f'{project_id}.pdf'))

    return True

def generate_pdf_preview(pdf_path, preview_path, max_pages=3):
    """Generate a preview PDF with only the first N pages"""
    try:
        # Read the full PDF
        pdf_reader = PdfReader(pdf_path)
        pdf_writer = PdfWriter()

        # Get the number of pages to extract (min of total pages or max_pages)
        num_pages = min(len(pdf_reader.pages), max_pages)

        # Add first N pages to the writer
        for page_num in range(num_pages):
            pdf_writer.add_page(pdf_reader.pages[page_num])

        # Write the preview PDF
        with open(preview_path, 'wb') as preview_file:
            pdf_writer.write(preview_file)

        return True
    except Exception as e:
        print(f"Error generating PDF preview: {e}")
        return False

@api_latext.route('/upload', methods=['POST'])
@requires_auth
def upload_file(user, data):
    """Handle file upload and create mock project"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Get template from form data
    template = request.form.get('template', 'nature')

    # Generate unique project ID
    project_id = str(uuid.uuid4())

    # Create project directory
    project_dir = create_project_directory(user['email'], project_id)

    # Save uploaded file with project_id naming
    filename = secure_filename(file.filename)
    file_extension = os.path.splitext(filename)[1]
    upload_path = os.path.join(project_dir, f'{project_id}{file_extension}')
    file.save(upload_path)

    # Copy mock files with project_id naming
    mock_tex = os.path.join(MOCK_FILES_DIR, 'mock.tex')
    mock_pdf = os.path.join(MOCK_FILES_DIR, 'mock.pdf')

    if os.path.exists(mock_tex):
        shutil.copy(mock_tex, os.path.join(project_dir, f'{project_id}.tex'))
    if os.path.exists(mock_pdf):
        full_pdf_path = os.path.join(project_dir, f'{project_id}.pdf')
        shutil.copy(mock_pdf, full_pdf_path)

        # Generate preview PDF (first 3 pages)
        preview_pdf_path = os.path.join(project_dir, f'preview_{project_id}.pdf')
        generate_pdf_preview(full_pdf_path, preview_pdf_path, max_pages=3)

    # Create database entry
    project = Project(
        project_id=project_id,
        user_id=user['email'],
        upload_filename=filename,
        tex_filename=f'{project_id}.tex',
        pdf_filename=f'{project_id}.pdf',
        template=template.lower(),
        status='converted'
    )
    project.insert()

    return jsonify({
        'message': 'File uploaded successfully',
        'project_id': project_id
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
    """Serve the PDF file for a project (preview for unverified users, full for verified)"""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check user verification status to determine which PDF to serve
    if user.get('is_verified', False):
        # Verified user - serve full PDF
        pdf_filename = project.get('pdf_filename', f'{project_id}.pdf')
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
    """Download the .tex file for a project (only for verified users)"""
    # Check user verification status first
    if not user.get('is_verified', False):
        return jsonify({'error': 'Please sign up to download LaTeX files'}), 403

    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Build tex path
    tex_path = os.path.join(
        USER_PROJECTS_DIR,
        str(project.get('user_id')),
        str(project_id),
        project.get('tex_filename', f'{project_id}.tex')
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

