import os
import shutil
import uuid
import json
from flask import jsonify, Blueprint, request
from werkzeug.utils import secure_filename
from api_auth import requires_auth
from database import User, Project, Ticket
from datetime import datetime
from utils.document_utils import extract_docx_metadata, validate_docx_file, validate_word_page_ratio
from utils.pricing import calculate_cost

api_project = Blueprint('api_project_blueprint', __name__, url_prefix='/api/latex')

# Base directory for user projects (local temporary storage before sending to latextai)
USER_PROJECTS_DIR = 'user_projects'

# Templates configuration file
TEMPLATES_FILE = 'templates.json'

def load_templates():
    """Load templates from JSON configuration file"""
    try:
        with open(TEMPLATES_FILE, 'r') as f:
            data = json.load(f)
            return data['templates']
    except Exception as e:
        print(f"Error loading templates: {e}")
        return []


def get_enabled_templates():
    """Get only enabled templates"""
    return [t for t in load_templates() if t.get('enabled', False)]

def get_template_by_id(template_id):
    """Get template configuration by ID"""
    templates = load_templates()
    for template in templates:
        if template['id'].lower() == template_id.lower():
            return template
    return None

def validate_template(template_id):
    """Validate that template exists and is enabled"""
    template = get_template_by_id(template_id)
    if not template:
        return False, "Template not found"
    if not template.get('enabled', False):
        return False, f"Template '{template['name']}' is not yet available"
    return True, template

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

@api_project.route('/templates', methods=['GET'])
def get_templates():
    """Get list of available templates (public endpoint, no auth required)"""
    templates = get_enabled_templates()

    # Return only frontend-needed fields
    formatted_templates = [{
        'id': t['id'],
        'name': t['name'],
        'publisher': t['publisher'],
        'year': t['year'],
        'thumbnail': t['thumbnail']
    } for t in templates]

    return jsonify({'templates': formatted_templates}), 200

@api_project.route('/upload', methods=['POST'])
@requires_auth(require_verified=True, use_form=True)
def upload_file(user, data):
    """
    Handle file upload - FAST, just save file.

    Flow:
    1. Upload file and save locally (< 1 second)
    2. Create database entry with validated=False
    3. Return project_id to frontend
    4. Frontend immediately calls /validate with project_id

    This splits the slow validation (LibreOffice, word count) into separate endpoint.
    """
    user_email = user['email']

    try:
        # STEP 1: Check upload limits (10 projects max until user has paid free project)
        project_count = Project.count_user_projects(user)
        has_paid_free = Project.has_paid_free_project(user)

        if project_count >= 10 and not has_paid_free:
            return jsonify({
                'error': 'Upload limit reached. Please complete payment for your free project or pay for a new one.',
                'project_count': project_count,
                'requires_payment': True
            }), 402  # 402 Payment Required

        # STEP 2: Validate file presence
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # STEP 3: Get and validate template
        template_id = request.form.get('template', 'mq').lower()
        is_valid, result = validate_template(template_id)
        if not is_valid:
            return jsonify({'error': result}), 400

        # STEP 4: Generate project ID and create directory structure
        project_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)

        # Create project directory: user_projects/{email}/{project_id}/
        project_dir = create_project_directory(user_email, project_id)

        # Save file as: user_projects/{email}/{project_id}/{project_id}.docx
        file_path = os.path.join(project_dir, f"{project_id}.docx")
        file.save(file_path)

        print(f"📤 [UPLOAD] Saved file to {file_path}")

        # STEP 5: Basic file validation (size and existence only - fast!)
        filesize = os.path.getsize(file_path)
        is_valid_file, error_msg = validate_docx_file(file_path, max_size_mb=30)
        if not is_valid_file:
            # Clean up failed upload
            shutil.rmtree(project_dir, ignore_errors=True)
            return jsonify({'error': error_msg}), 400

        # STEP 6: Create database entry with validated=False
        # No metadata yet - will be populated by /validate endpoint
        project = Project(
            project_id=project_id,
            user_id=user_email,
            upload_filename=filename,
            template=template_id,
            status='uploaded',  # Uploaded but not yet validated
            paid=False,
            is_free_project=False,
            total_cost=None,  # Will be calculated during validation
            filesize=filesize,
            page_count=None,  # Will be populated during validation
            word_count=None,  # Will be populated during validation
            validated=False  # NEW: Not yet validated
        )
        project.insert()

        print(f"✅ [UPLOAD] Project created: {project_id} (not yet validated)")

        # STEP 7: Return immediately - frontend will call /validate next
        return jsonify({
            'message': 'File uploaded successfully',
            'project_id': project_id,
            'status': 'uploaded',
            'validated': False,
            'metadata': {
                'filesize': filesize,
                'filename': filename
            }
        }), 200

    except Exception as e:
        print(f"❌ [UPLOAD] Error: {str(e)}")
        return jsonify({
            'error': f'Upload failed: {str(e)}'
        }), 500

@api_project.route('/validate', methods=['POST'])
@requires_auth(require_verified=True)
def validate_file(user, data):
    """
    Validate an uploaded file - SLOW (5-10 seconds).

    This endpoint:
    1. Runs LibreOffice conversion to get accurate page count
    2. Counts words using python-docx
    3. Validates word-to-page ratio
    4. Calculates cost estimate
    5. Updates project with validated=True

    Frontend calls this immediately after /upload.
    """
    user_email = user['email']

    try:
        # STEP 1: Get project_id from request
        project_id = data.get('project_id')
        if not project_id:
            return jsonify({'error': 'project_id is required'}), 400

        # STEP 2: Find project in database
        project = Project.find_by_id(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        # STEP 3: Verify ownership
        if project['user_id'] != user_email:
            return jsonify({'error': 'Unauthorized'}), 403

        # STEP 4: Check if already validated
        if project.get('validated', False):
            return jsonify({
                'error': 'Project has already been validated',
                'project_id': project_id,
                'validated': True
            }), 409  # 409 Conflict

        # STEP 5: Get file path
        project_dir = os.path.join(USER_PROJECTS_DIR, user_email, project_id)
        file_path = os.path.join(project_dir, f"{project_id}.docx")

        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found on server'}), 404

        # STEP 6: Extract metadata (SLOW - LibreOffice conversion)
        try:
            print(f"📊 [VALIDATE] Extracting metadata for {project_id}...")
            metadata = extract_docx_metadata(file_path, keep_pdf=False)
            page_count = metadata['page_count']
            word_count = metadata['word_count']
            filesize = metadata['filesize']

            print(f"✅ [VALIDATE] Metadata extracted: {page_count} pages, {word_count} words, {filesize} bytes")
        except Exception as e:
            # Validation failed - delete project and files
            print(f"❌ [VALIDATE] Document processing error: {str(e)}")
            Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)
            return jsonify({
                'error': f'Failed to process document: {str(e)}'
            }), 500

        # STEP 7: Validate word-to-page ratio
        is_valid_ratio, ratio_error = validate_word_page_ratio(word_count, page_count)
        if not is_valid_ratio:
            # Validation failed - delete project and files
            print(f"❌ [VALIDATE] Invalid word/page ratio: {ratio_error}")
            Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)
            return jsonify({'error': ratio_error}), 400

        print(f"✅ [VALIDATE] Word/page ratio valid: {word_count / page_count:.0f} words/page")

        # STEP 8: Calculate cost estimate
        cost_estimate = calculate_cost(page_count)
        print(f"💰 [VALIDATE] Cost calculated: ${cost_estimate['total']} for {page_count} pages")

        # STEP 9: Update project with validation results
        from database import mongo
        result = mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': {
                'page_count': page_count,
                'word_count': word_count,
                'total_cost': cost_estimate['total'],
                'validated': True,
                'validated_at': datetime.utcnow()
            }}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'Failed to update project'}), 500

        print(f"✅ [VALIDATE] Project validated: {project_id}")

        # STEP 10: Return validation results
        return jsonify({
            'message': 'File validated successfully',
            'project_id': project_id,
            'validated': True,
            'metadata': {
                'filesize': filesize,
                'page_count': page_count,
                'word_count': word_count,
                'filename': project['upload_filename']
            },
            'cost_estimate': cost_estimate,
            'can_use_free': not User.has_used_free_upload(user_email)
        }), 200

    except Exception as e:
        print(f"❌ [VALIDATE] Unexpected error: {str(e)}")
        # Clean up project and files on unexpected error
        try:
            if 'project_id' in locals() and project_id and 'user_email' in locals():
                Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)
        except Exception as cleanup_error:
            print(f"⚠️  [VALIDATE] Cleanup error: {str(cleanup_error)}")

        return jsonify({
            'error': f'Validation failed: {str(e)}'
        }), 500

@api_project.route('/cost-estimate', methods=['GET'])
@requires_auth(require_verified=True)
def get_cost_estimate(user):
    """
    Get cost estimate for an existing project.

    This endpoint can be called to recalculate cost for a project
    that has already been uploaded.

    Query params:
        project_id: UUID of the project

    Returns:
        Cost estimate breakdown
    """
    project_id = request.args.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    # Find project
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Get page count from project metadata
    page_count = project.get('page_count', 0)

    if page_count == 0:
        return jsonify({'error': 'Project metadata not available'}), 400

    # Calculate cost
    cost_estimate = calculate_cost(page_count)

    return jsonify({
        'project_id': project_id,
        'page_count': page_count,
        'cost_estimate': cost_estimate
    }), 200

@api_project.route('/claim-free', methods=['POST'])
@requires_auth(require_verified=True)
def claim_free_upload(user, data):
    """
    Atomically claim the free upload for a project.

    This is THE critical endpoint for fixing the race condition.
    Uses MongoDB's atomic conditional update to ensure only ONE
    request can successfully claim the free upload.

    Request body:
        {
            "project_id": "uuid-here"
        }

    Returns:
        Success message with project details

    Race condition prevention:
        - Uses MongoDB update_one with condition: free_upload_used=False
        - Only ONE simultaneous request will succeed
        - Others get modified_count=0 and return 409 Conflict
    """
    project_id = data.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    # STEP 1: Verify project exists and belongs to user
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # STEP 2: Check project status (must be 'uploaded')
    if project.get('status') != 'uploaded':
        return jsonify({
            'error': f"Project cannot be claimed (status: {project.get('status')})"
        }), 400

    # STEP 3: Check if project is already paid
    if project.get('paid', False):
        return jsonify({
            'error': 'Project is already paid for'
        }), 400

    # STEP 4: ATOMIC OPERATION - Try to claim free upload
    # This uses MongoDB's conditional update for race condition prevention
    from database import mongo

    result = mongo.db.users.update_one(
        {
            'email': user['email'],
            'free_upload_used': False  # CRITICAL: Only update if false
        },
        {
            '$set': {
                'free_upload_used': True,
                'free_upload_used_at': datetime.utcnow()
            }
        }
    )

    # STEP 5: Check if atomic operation succeeded
    if result.modified_count == 0:
        # Another request already claimed it, or user already used free upload
        has_used_free = User.has_used_free_upload(user['email'])
        if has_used_free:
            return jsonify({
                'error': 'You have already used your free upload',
                'race_condition_detected': False
            }), 409  # 409 Conflict
        else:
            # Race condition detected - another simultaneous request won
            return jsonify({
                'error': 'Free upload was just claimed by another request',
                'race_condition_detected': True
            }), 409  # 409 Conflict

    print(f"✅ [CLAIM-FREE] User {user['email']} claimed free upload for project {project_id}")

    # STEP 6: Mark project as paid and free
    success = Project.mark_as_paid(
        project_id=project_id,
        is_free=True,
        total_cost=0.0
    )

    if not success:
        # Rollback the free_upload_used flag
        mongo.db.users.update_one(
            {'email': user['email']},
            {'$set': {'free_upload_used': False}}
        )
        return jsonify({
            'error': 'Failed to mark project as paid'
        }), 500

    print(f"✅ [CLAIM-FREE] Project {project_id} marked as free and paid")

    return jsonify({
        'message': 'Free upload claimed successfully',
        'project_id': project_id,
        'paid': True,
        'is_free_project': True,
        'total_cost': 0.0
    }), 200

@api_project.route('/projects', methods=['GET'])
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
            'mq': {'name': 'Mankind Quarterly', 'thumbnail': '/MQ_logo_rectangular_small.png'},
        }

        template_info = template_map.get(
            proj.get('template', '').lower(),
            {'name': 'Unknown Template', 'thumbnail': '/default.svg'}
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

@api_project.route('/project/<project_id>', methods=['GET'])
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

# Support Ticket Endpoints

@api_project.route('/project/<project_id>/support', methods=['POST'])
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

@api_project.route('/project/<project_id>/tickets', methods=['GET'])
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

@api_project.route('/ticket/<ticket_id>', methods=['GET'])
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

@api_project.route('/ticket/<ticket_id>/message', methods=['POST'])
@requires_auth(require_verified=True)
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
