import os
import shutil
import uuid
import json
import requests
from flask import jsonify, Blueprint, request, send_file, Response
from api_auth import requires_auth
from database import User, Project, CreditTransaction, mongo
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


def create_user_directory(user_email):
    """Create a directory for a user's projects if it doesn't exist"""
    user_dir = os.path.join(USER_PROJECTS_DIR, str(user_email))
    if not os.path.exists(user_dir):
        os.makedirs(user_dir, exist_ok=True)
    return user_dir

def create_project_directory(user_email, project_id):
    """Create a specific project directory for a user"""
    user_dir = create_user_directory(user_email)
    project_dir = os.path.join(user_dir, str(project_id))
    if not os.path.exists(project_dir):
        os.makedirs(project_dir, exist_ok=True)
    return project_dir


def delete_user_on_latextai(user_email):
    """
    Send deletion request to latextai server to delete user's project files.

    Args:
        user_email: User's email address

    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        response = requests.delete(
            f"{LATEXTAI_SERVICE_URL}/api/user",
            headers={'X-API-Key': LATEXTAI_API_KEY},
            params={'user_email': user_email},
            timeout=30
        )

        if response.status_code == 200:
            return True, "User deleted from latextai"
        elif response.status_code == 404:
            return True, "User not found on latextai (already deleted or never existed)"
        else:
            return False, f"Latextai deletion failed: {response.status_code}"

    except requests.exceptions.ConnectionError:
        return False, "Could not connect to latextai server"
    except requests.exceptions.Timeout:
        return False, "Latextai server timeout"
    except Exception as e:
        return False, f"Latextai deletion error: {str(e)}"


def delete_project_on_latextai(user_email, project_id):
    """
    Send deletion request to latextai server to delete a single project's files.

    Args:
        user_email: User's email address
        project_id: Project UUID

    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        response = requests.delete(
            f"{LATEXTAI_SERVICE_URL}/api/project/{project_id}",
            headers={'X-API-Key': LATEXTAI_API_KEY},
            params={'user_email': user_email},
            timeout=30
        )

        if response.status_code == 200:
            return True, "Project deleted from latextai"
        elif response.status_code == 404:
            return True, "Project not found on latextai (already deleted or never existed)"
        else:
            return False, f"Latextai deletion failed: {response.status_code}"

    except requests.exceptions.ConnectionError:
        return False, "Could not connect to latextai server"
    except requests.exceptions.Timeout:
        return False, "Latextai server timeout"
    except Exception as e:
        return False, f"Latextai deletion error: {str(e)}"


@api_latext.route('/admin/mark-paid', methods=['POST'])
@requires_auth()
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
    mongo.db.projects.update_one(
        {'project_id': project_id},
        {'$set': {
            'paid': True,
            'admin_marked_paid': True,  # Flag to track admin override
            'admin_marked_by': user['email'],
            'admin_marked_at': datetime.utcnow(),
            'status': 'validated'  # Ensure status remains validated
        }}
    )

    print(f"🔧 [ADMIN] Project {project_id} marked as paid")

    return jsonify({
        'message': 'Project marked as paid',
        'project_id': project_id
    }), 200

def _upgrade_preview(user, data, project, project_id):
    """
    Upgrade a converted preview project to a full paid project.
    Handles credit deduction and flag flipping without re-processing.
    """
    use_free_upload = data.get('use_free_upload', False)

    if use_free_upload:
        user_data = User.find_by_email(user['email'])
        if user_data.get('free_upload_used', False):
            return jsonify({
                'error': 'Your free upload has already been used. Please use credits.',
                'free_upload_exhausted': True
            }), 409

        user_update = mongo.db.users.update_one(
            {'email': user['email'], 'free_upload_used': {'$ne': True}},
            {'$set': {'free_upload_used': True, 'free_upload_used_at': datetime.utcnow()}}
        )

        if user_update.modified_count == 0:
            return jsonify({
                'error': 'Your free upload has already been used. Please use credits.',
                'free_upload_exhausted': True
            }), 409

        project_update = mongo.db.projects.update_one(
            {'project_id': project_id, 'paid': False},
            {'$set': {
                'paid': True,
                'is_preview': False,
                'paid_with_free_upload': True,
                'paid_at': datetime.utcnow()
            }}
        )
        if project_update.modified_count == 0:
            # Project already paid — rollback the user's free_upload_used
            mongo.db.users.update_one(
                {'email': user['email']},
                {'$set': {'free_upload_used': False, 'free_upload_used_at': None}}
            )
            return jsonify({'message': 'Project already paid'}), 200
        print(f"🎁 [UPGRADE] Preview upgraded with free upload for project {project_id}")
    else:
        page_count = project.get('page_count', 0)
        cost_info = calculate_cost(page_count)
        credits_required = cost_info['total_credits']

        current_balance = User.get_credit_balance(user['email'])
        if current_balance < credits_required:
            return jsonify({
                'error': 'Insufficient credits',
                'credits_required': credits_required,
                'credits_available': current_balance,
                'requires_topup': True
            }), 402

        mark_result = mongo.db.projects.update_one(
            {'project_id': project_id, 'paid': False},
            {'$set': {
                'paid': True,
                'is_preview': False,
                'paid_with_credits': True,
                'credits_charged': credits_required,
                'paid_at': datetime.utcnow()
            }}
        )

        if mark_result.modified_count == 0:
            return jsonify({'message': 'Project already paid'}), 200

        new_balance = User.deduct_credits(user['email'], credits_required)
        if new_balance is None:
            mongo.db.projects.update_one(
                {'project_id': project_id},
                {'$set': {'paid': False, 'is_preview': True, 'paid_with_credits': False, 'credits_charged': None, 'paid_at': None}}
            )
            return jsonify({
                'error': 'Failed to deduct credits. Please try again.',
                'requires_topup': True
            }), 402

        CreditTransaction.create(
            user_email=user['email'],
            user_id=str(user['_id']),
            transaction_type='deduct',
            amount=-credits_required,
            balance_after=new_balance,
            description=f"Upgrade: {project.get('upload_filename', 'document.docx')} ({page_count} pages)",
            project_id=project_id
        )
        print(f"💳 [UPGRADE] Preview upgraded with {credits_required} credits for project {project_id}")

    # Decrement preview_count since this is now a paid upload
    mongo.db.users.update_one(
        {'email': user['email'], 'preview_count': {'$gt': 0}},
        {'$inc': {'preview_count': -1}}
    )

    return jsonify({
        'message': 'Preview upgraded successfully',
        'project_id': project_id,
        'paid': True,
        'is_preview': False,
        'upgraded': True
    }), 200


@api_latext.route('/process', methods=['POST'])
@requires_auth(allow_anonymous=True)
def process_project(user, data):
    """
    Initiate processing by forwarding to latextai service.

    This endpoint handles payment via credits OR processes already-paid projects
    (free upload, admin bypass).

    Request body:
        {
            "project_id": "uuid-here"
        }

    Returns:
        Success message with processing status

    Flow:
        1. If already paid (free upload/admin), proceed directly
        2. If not paid, deduct credits and mark as paid
        3. Forward to latextai for processing
    """
    project_id = data.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    # STEP 1: Find project
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # STEP 2: Verify project belongs to user
    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # STEP 3: Check project status
    project_status = project.get('status')
    if project_status == 'processing':
        return jsonify({'message': 'Project is already being processed'}), 200
    if project_status == 'failed':
        return jsonify({'message': 'Project processing has failed'}), 200

    # Handle preview upgrade: converted preview that hasn't been paid for
    if project_status == 'converted' and project.get('is_preview', False) and not project.get('paid', False):
        return _upgrade_preview(user, data, project, project_id)

    if project_status == 'converted':
        return jsonify({'message': 'Project has already been converted'}), 200
    if project_status != 'validated':
        return jsonify({
            'error': f"Project must be validated before processing (current status: {project_status})"
        }), 400

    # STEP 3.5: Verify project has been validated (has metadata)
    if not project.get('validated', False):
        return jsonify({
            'error': 'Project has not been validated. Please validate before processing.'
        }), 400

    # STEP 4: Handle payment - either already paid, free upload, or deduct credits
    is_anonymous = user.get('is_anonymous', False)
    is_preview_project = project.get('is_preview', False)
    use_free_upload = data.get('use_free_upload', False)

    # Preview projects (anonymous or verified user previews) skip payment
    if is_anonymous or is_preview_project:
        mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': {'is_preview': True}}
        )
        print(f"👁️  [PREVIEW] Preview processing for project {project_id} (anonymous={is_anonymous})")
    elif not project.get('paid', False):
        # Check if user wants to use free upload
        if use_free_upload:
            # Check if user has free upload available
            user_data = User.find_by_email(user['email'])
            if user_data.get('free_upload_used', False):
                return jsonify({
                    'error': 'Your free upload has already been used. Please use credits.',
                    'free_upload_exhausted': True
                }), 409
            
            # Atomically mark user's free upload as used AND project as paid
            user_update = mongo.db.users.update_one(
                {'email': user['email'], 'free_upload_used': {'$ne': True}},
                {'$set': {'free_upload_used': True, 'free_upload_used_at': datetime.utcnow()}}
            )
            
            if user_update.modified_count == 0:
                return jsonify({
                    'error': 'Your free upload has already been used. Please use credits.',
                    'free_upload_exhausted': True
                }), 409
            
            # Mark project as paid with free upload
            mongo.db.projects.update_one(
                {'project_id': project_id},
                {'$set': {
                    'paid': True,
                    'paid_with_free_upload': True,
                    'paid_at': datetime.utcnow()
                }}
            )
            
            print(f"🎁 [FREE] Free upload used for project {project_id}")
        else:
            # Regular credit payment
            page_count = project.get('page_count', 0)
            cost_info = calculate_cost(page_count)
            credits_required = cost_info['total_credits']

            current_balance = User.get_credit_balance(user['email'])
            if current_balance < credits_required:
                return jsonify({
                    'error': 'Insufficient credits',
                    'credits_required': credits_required,
                    'credits_available': current_balance,
                    'requires_topup': True
                }), 402

            # ATOMIC: Mark project as paid FIRST to prevent double-charge race condition
            # Only one concurrent request can succeed with this update
            mark_result = mongo.db.projects.update_one(
                {'project_id': project_id, 'paid': False},
                {'$set': {
                    'paid': True,
                    'paid_with_credits': True,
                    'credits_charged': credits_required,
                    'paid_at': datetime.utcnow()
                }}
            )

            if mark_result.modified_count == 0:
                # Another request already marked this project as paid
                print(f"⚠️  [CREDITS] Project {project_id} already paid (race condition prevented)")
                return jsonify({'message': 'Project already paid'}), 200

            # Now deduct credits (we own the project payment)
            new_balance = User.deduct_credits(user['email'], credits_required)
            if new_balance is None:
                # Rollback: Clear paid status since we couldn't charge
                mongo.db.projects.update_one(
                    {'project_id': project_id},
                    {'$set': {'paid': False, 'paid_with_credits': False, 'credits_charged': None, 'paid_at': None}}
                )
                return jsonify({
                    'error': 'Failed to deduct credits. Please try again.',
                    'requires_topup': True
                }), 402

            CreditTransaction.create(
                user_email=user['email'],
                user_id=str(user['_id']),
                transaction_type='deduct',
                amount=-credits_required,
                balance_after=new_balance,
                description=f"Conversion: {project.get('upload_filename', 'document.docx')} ({page_count} pages)",
                project_id=project_id
            )

            print(f"💳 [CREDITS] Charged {credits_required} credits for project {project_id}")

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
                f"{LATEXTAI_SERVICE_URL}/api/convert",
                files=files,
                data=form_data,
                headers=headers,
                timeout=30
            )

            print(f"📡 [PROCESS] LatextAI response: {response.status_code}")

            if response.status_code == 202:
                # STEP 8: Update project status to 'processing'
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
        print(f"❌ [PROCESS] Network error: {e}")
        return jsonify({
            'error': 'Failed to connect to processing service. Please try again.'
        }), 500

    except Exception as e:
        print(f"❌ [PROCESS] Error: {e}")
        return jsonify({
            'error': 'Processing failed. Please try again.'
        }), 500

@api_latext.route('/project/<project_id>/pdf', methods=['GET'])
@requires_auth(allow_anonymous=True)
def get_pdf(user, project_id):
    """Proxy PDF download request to latextai service. Preview projects get 3-page PDF."""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    # Determine which PDF to serve: preview (3-page) or full
    is_preview = project.get('is_preview', False) and not project.get('paid', False)
    download_endpoint = '/api/download/pdf-preview' if is_preview else '/api/download/pdf'

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
            f"{LATEXTAI_SERVICE_URL}{download_endpoint}",
            params=params,
            headers=headers,
            stream=True,
            timeout=30
        )

        if response.status_code == 200:
            # Stream the PDF file back to client
            return Response(
                response.iter_content(chunk_size=8192),
                content_type='application/pdf'
            )
        elif is_preview and response.status_code == 404:
            # Preview endpoint might not exist yet — fallback to full PDF
            response = requests.get(
                f"{LATEXTAI_SERVICE_URL}/api/download/pdf",
                params=params,
                headers=headers,
                stream=True,
                timeout=30
            )
            if response.status_code == 200:
                return Response(
                    response.iter_content(chunk_size=8192),
                    content_type='application/pdf'
                )
            return jsonify({'error': 'PDF not found'}), response.status_code
        else:
            return jsonify({'error': 'PDF not found'}), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"❌ [DOWNLOAD] PDF download error: {e}")
        return jsonify({'error': 'Failed to download PDF'}), 500

@api_latext.route('/project/<project_id>/tex', methods=['GET'])
@requires_auth()
def get_tex(user, project_id):
    """Proxy TEX download request to latextai service. Requires payment."""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    # Gate: require payment for .tex download
    if not project.get('paid', False):
        return jsonify({'error': 'Payment required to download LaTeX source files', 'upgrade_required': True}), 403

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
            # Stream the TEX file back to client
            return Response(
                response.iter_content(chunk_size=8192),
                content_type='text/plain'
            )
        else:
            return jsonify({'error': 'LaTeX file not found'}), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"❌ [DOWNLOAD] TeX download error: {e}")
        return jsonify({'error': 'Failed to download LaTeX file'}), 500

@api_latext.route('/project/<project_id>/bib', methods=['GET'])
@requires_auth()
def get_bib(user, project_id):
    """Proxy BibTeX download request to latextai service. Requires payment."""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    # Gate: require payment for .bib download
    if not project.get('paid', False):
        return jsonify({'error': 'Payment required to download BibTeX files', 'upgrade_required': True}), 403

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
            f"{LATEXTAI_SERVICE_URL}/api/download/bib",
            params=params,
            headers=headers,
            stream=True,
            timeout=30
        )

        if response.status_code == 200:
            # Stream the BibTeX file back to client
            return Response(
                response.iter_content(chunk_size=8192),
                content_type='application/x-bibtex'
            )
        else:
            return jsonify({'error': 'BibTeX file not found'}), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"❌ [DOWNLOAD] BibTeX download error: {e}")
        return jsonify({'error': 'Failed to download BibTeX file'}), 500

@api_latext.route('/project/<project_id>/package', methods=['GET'])
@requires_auth()
def get_package(user, project_id):
    """Proxy package download request to latextai service. Requires payment."""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify project belongs to user
    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project has been processed
    if project.get('status') != 'converted':
        return jsonify({'error': 'Document not yet processed'}), 404

    # Gate: require payment for package download
    if not project.get('paid', False):
        return jsonify({'error': 'Payment required to download compilation package', 'upgrade_required': True}), 403

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
            f"{LATEXTAI_SERVICE_URL}/api/download/package",
            params=params,
            headers=headers,
            stream=True,
            timeout=30
        )

        if response.status_code == 200:
            # Stream the package file back to client
            return Response(
                response.iter_content(chunk_size=8192),
                content_type='application/zip'
            )
        else:
            return jsonify({'error': 'Compilation package not found'}), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"❌ [DOWNLOAD] Package download error: {e}")
        return jsonify({'error': 'Failed to download compilation package'}), 500

