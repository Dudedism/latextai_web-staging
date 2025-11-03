import os
import shutil
import uuid
import json
import requests
from flask import jsonify, Blueprint, request, send_file, Response
from werkzeug.utils import secure_filename
from api_auth import requires_auth
from database import User, Project, Ticket
from datetime import datetime
from config import LATEXTAI_SERVICE_URL, LATEXTAI_API_KEY
from utils.document_utils import extract_docx_metadata, validate_docx_file
from utils.pricing import calculate_cost

api_latext = Blueprint('api_latext_blueprint', __name__, url_prefix='/api/latex')

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

@api_latext.route('/admin/mark-paid', methods=['POST'])
@requires_auth(require_verified=True)
def admin_mark_paid(user, data):
    """
    Admin-only endpoint to mark a project as paid (for debugging/testing).

    Request body:
        {
            "project_id": "uuid-here"
        }

    Returns:
        Success message
    """
    # Check if user is admin
    if not user.get('admin', False):
        return jsonify({'error': 'Admin access required'}), 403

    project_id = data.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    # Find project
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Check project has been validated
    if not project.get('validated', False):
        return jsonify({
            'error': 'Project must be validated before marking as paid',
            'requires_validation': True
        }), 400

    # Check project status (must be 'validated')
    if project.get('status') != 'validated':
        return jsonify({
            'error': f"Project must be validated before payment (current status: {project.get('status')})",
            'requires_validation': True
        }), 400

    # Mark as paid (admin bypass)
    from database import mongo
    mongo.db.projects.update_one(
        {'project_id': project_id},
        {'$set': {
            'paid': True,
            'is_free_project': False,
            'admin_marked_paid': True,  # Flag to track admin override
            'admin_marked_by': user['email'],
            'admin_marked_at': datetime.utcnow(),
            'status': 'validated'  # Ensure status remains validated
        }}
    )

    print(f"🔧 [ADMIN] Project {project_id} marked as paid by {user['email']}")

    return jsonify({
        'message': 'Project marked as paid',
        'project_id': project_id
    }), 200

@api_latext.route('/process', methods=['POST'])
@requires_auth(require_verified=True)
def process_project(user, data):
    """
    Initiate processing by forwarding to latextai service.

    This endpoint is called AFTER payment (either free or paid via Stripe).
    It forwards the uploaded DOCX file to latextai for conversion.

    Request body:
        {
            "project_id": "uuid-here"
        }

    Returns:
        Success message with processing status

    Prerequisites:
        - Project must exist and be 'uploaded'
        - Project must be marked as paid (paid=True)
    """
    project_id = data.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    # STEP 1: Find project
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # STEP 2: Verify project belongs to user
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # STEP 3: Check project is paid
    if not project.get('paid', False):
        return jsonify({
            'error': 'Project must be paid for before processing',
            'requires_payment': True
        }), 402  # 402 Payment Required

    # STEP 4: Check project status (must be 'validated')
    if project.get('status') != 'validated':
        return jsonify({
            'error': f"Project must be validated before processing (current status: {project.get('status')})"
        }), 400

    # STEP 4.5: Verify project has been validated (has metadata)
    if not project.get('validated', False):
        return jsonify({
            'error': 'Project has not been validated. Please validate before processing.'
        }), 400

    # STEP 5: Get template configuration
    template_id = project.get('template')
    is_valid, result = validate_template(template_id)
    if not is_valid:
        return jsonify({'error': f'Invalid template: {result}'}), 400

    template_config = result
    latextai_template_name = template_config['latextai_name']

    # STEP 6: Read file from local storage
    file_path = os.path.join(
        USER_PROJECTS_DIR,
        user['email'],
        project_id,
        f"{project_id}.docx"
    )

    if not os.path.exists(file_path):
        return jsonify({
            'error': 'Uploaded file not found. Please re-upload.'
        }), 404

    try:
        # STEP 7: Forward file to latextai service
        with open(file_path, 'rb') as f:
            files = {
                'file': (project.get('upload_filename'), f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            }
            form_data = {
                'user_email': user['email'],
                'project_id': project_id,
                'template': latextai_template_name
            }
            headers = {
                'X-API-Key': LATEXTAI_API_KEY
            }

            print(f"🚀 [PROCESS] Forwarding project {project_id} to latextai...")

            response = requests.post(
                f"{LATEXTAI_SERVICE_URL}/api/upload",
                files=files,
                data=form_data,
                headers=headers,
                timeout=30
            )

            print(f"📡 [PROCESS] LatextAI response: {response.status_code}")

            if response.status_code == 202:
                # STEP 8: Update project status to 'processing'
                project_obj = Project.find_by_id(project_id)
                if project_obj:
                    from database import mongo
                    mongo.db.projects.update_one(
                        {'project_id': project_id},
                        {'$set': {'status': 'processing'}}
                    )

                print(f"✅ [PROCESS] Project {project_id} sent to latextai successfully")

                return jsonify({
                    'message': 'Processing started successfully',
                    'project_id': project_id,
                    'status': 'processing'
                }), 202  # 202 Accepted

            else:
                # latextai returned error
                print(f"❌ [PROCESS] LatextAI error: {response.text}")
                return jsonify({
                    'error': f'Processing service error: {response.text}'
                }), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"❌ [PROCESS] Network error: {str(e)}")
        return jsonify({
            'error': f'Failed to connect to processing service: {str(e)}'
        }), 500

    except Exception as e:
        print(f"❌ [PROCESS] Error: {str(e)}")
        return jsonify({
            'error': f'Processing failed: {str(e)}'
        }), 500

@api_latext.route('/project/<project_id>/pdf', methods=['GET'])
@requires_auth(require_verified=True)
def get_pdf(user, project_id):
    """Proxy PDF download request to latextai service"""
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
@requires_auth(require_verified=True)
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

