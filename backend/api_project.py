import os
import shutil
import uuid
import json
import requests as http_requests
from flask import jsonify, Blueprint, request
from werkzeug.utils import secure_filename
from api_auth import requires_auth
from database import User, Project, DocumentAnalysis
from datetime import datetime, timedelta
from utils.document_utils import extract_docx_metadata, validate_docx_file, validate_word_page_ratio, extract_docx_analysis
from utils.pricing import calculate_cost, calculate_credit_split
from config import RECAPTCHA_SECRET_KEY

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

def verify_captcha(token):
    """Verify a reCAPTCHA v2 token. Returns True if valid, False otherwise."""
    if not RECAPTCHA_SECRET_KEY:
        print("⚠️  [CAPTCHA] No RECAPTCHA_SECRET_KEY configured, skipping verification")
        return True
    try:
        response = http_requests.post('https://www.google.com/recaptcha/api/siteverify', data={
            'secret': RECAPTCHA_SECRET_KEY,
            'response': token
        }, timeout=5)
        result = response.json()
        if not result.get('success'):
            print(f"❌ [CAPTCHA] Verification failed: {result}")
            return False
        return True
    except Exception as e:
        print(f"❌ [CAPTCHA] Error verifying: {e}")
        return False


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

@api_project.route('/can-upload', methods=['GET'])
@requires_auth(allow_anonymous=True)
def can_upload(user):
    """Check if user is eligible to upload (preview limit + project limit)."""
    is_anonymous = user.get('is_anonymous', False)

    if is_anonymous:
        preview_count = user.get('preview_count', 0)
        if preview_count >= 1:
            return jsonify({'can_upload': False, 'reason': 'preview_limit'}), 200

    user_id = str(user['_id'])
    project_count = Project.count_user_projects(user_id)
    has_paid_free = Project.has_paid_free_project(user_id)

    if project_count >= 10 and not has_paid_free:
        return jsonify({'can_upload': False, 'reason': 'project_limit'}), 200

    return jsonify({'can_upload': True}), 200

@api_project.route('/upload', methods=['POST'])
@requires_auth(use_form=True, allow_anonymous=True)
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
    is_anonymous = user.get('is_anonymous', False)

    try:
        # For anonymous users: verify CAPTCHA and check preview limits
        if is_anonymous:
            captcha_token = request.form.get('captcha_token')
            if RECAPTCHA_SECRET_KEY:
                if not captcha_token:
                    return jsonify({'error': 'CAPTCHA verification required.'}), 403
                if not verify_captcha(captcha_token):
                    return jsonify({'error': 'CAPTCHA verification failed. Please try again.'}), 403
            elif not captcha_token:
                print("⚠️  [CAPTCHA] No RECAPTCHA_SECRET_KEY configured, skipping CAPTCHA requirement")

            # Check preview count limit (anonymous gets exactly 1 preview, ever)
            preview_count = user.get('preview_count', 0)
            if preview_count >= 1:
                return jsonify({
                    'error': 'Anonymous upload limit reached. Please sign up to continue.',
                    'requires_signup': True
                }), 403

        # STEP 1: Check upload limits (10 projects max until user has paid free project)
        user_id = str(user['_id'])
        project_count = Project.count_user_projects(user_id)
        has_paid_free = Project.has_paid_free_project(user_id)

        if project_count >= 10 and not has_paid_free:
            return jsonify({
                'error': 'Upload limit reached. Please complete payment for your free project or pay for a new one.',
                'project_count': project_count,
                'requires_payment': True
            }), 402  # 402 Payment Required

        # STEP 1b: Reject duplicate uploads (prevent refresh/double-submit spam)
        from database import mongo
        recent_cutoff = datetime.utcnow() - timedelta(seconds=60)
        existing_upload = mongo.db.projects.find_one({
            'user_id': user_id,
            'validated': False,
            'status': 'uploaded',
            'created_at': {'$gte': recent_cutoff},
            'is_orphaned': {'$ne': True}
        })
        if existing_upload:
            print(f"⚠️  [UPLOAD] Duplicate upload blocked for user {user_id}, existing project: {existing_upload['project_id']}")
            return jsonify({
                'error': 'An upload is already in progress.',
                'project_id': existing_upload['project_id'],
                'duplicate': True
            }), 409

        # STEP 2: Validate file presence
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # STEP 3: Get and validate template
        template_id = request.form.get('template', 'mq').lower()

        # Validate template_id length (prevent excessively long inputs)
        if len(template_id) > 50:
            return jsonify({'error': 'Template ID must be 50 characters or less'}), 400

        is_valid, result = validate_template(template_id)
        if not is_valid:
            return jsonify({'error': result}), 400

        # STEP 4: Generate project ID and create directory structure
        project_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)

        # Validate filename length (after secure_filename sanitization)
        if len(filename) > 255:
            return jsonify({'error': 'Filename must be 255 characters or less'}), 400

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

        # STEP 6: Determine if this is a preview upload
        # Anonymous users always get previews. Signed-up users get previews if they have quota (5 max).
        is_preview_upload = is_anonymous or user.get('preview_count', 0) < 5

        # STEP 7: Create database entry with validated=False
        # No metadata yet - will be populated by /validate endpoint
        project = Project(
            project_id=project_id,
            user_email=user_email,
            user_id=user_id,
            upload_filename=filename,
            template=template_id,
            status='uploaded',  # Uploaded but not yet validated
            paid=False,
            total_credits=None,  # Will be calculated during validation
            filesize=filesize,
            page_count=None,  # Will be populated during validation
            word_count=None,  # Will be populated during validation
            validated=False,
            is_preview=is_preview_upload
        )
        project.insert()

        # Increment preview count for preview uploads
        if is_preview_upload:
            new_count = User.increment_preview_count(user_email)
            if new_count is None:
                # Limit reached concurrently — clean up and reject
                from database import mongo
                mongo.db.projects.delete_one({'project_id': project_id})
                shutil.rmtree(project_dir, ignore_errors=True)
                return jsonify({
                    'error': 'Preview upload limit reached. Please sign up to continue.' if is_anonymous else 'Preview upload limit reached. Please pay for full uploads.',
                    'requires_signup': is_anonymous
                }), 403

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
        print(f"❌ [UPLOAD] Error: {e}")
        return jsonify({
            'error': 'Upload failed. Please try again.'
        }), 500

@api_project.route('/validate', methods=['POST'])
@requires_auth(allow_anonymous=True)
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

        # Validate project_id format (should be UUID, max 36 chars)
        if len(project_id) > 36:
            return jsonify({'error': 'Invalid project_id format'}), 400

        # STEP 2: Find project in database
        project = Project.find_by_id(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        # STEP 3: Verify ownership
        if project.get('user_id') != str(user['_id']):
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
            print(f"❌ [VALIDATE] Document processing error: {e}")
            Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)
            DocumentAnalysis.delete_by_project(project_id)
            return jsonify({
                'error': 'Failed to process document. Please ensure it is a valid Word file.'
            }), 500

        # STEP 6b: Extract document analysis (FAST - pure DOCX ZIP/XML parsing)
        analysis = extract_docx_analysis(file_path)
        doc_analysis = DocumentAnalysis(project_id=project_id, **analysis)
        doc_analysis.insert()
        print(f"📊 [VALIDATE] Document analysis stored: {analysis['image_count']} images, {analysis['table_count']} tables, {analysis['equation_count']} equations")

        # STEP 7: Validate word-to-page ratio
        is_valid_ratio, ratio_error = validate_word_page_ratio(word_count, page_count)
        if not is_valid_ratio:
            # Validation failed - delete project and files
            print(f"❌ [VALIDATE] Invalid word/page ratio: {ratio_error}")
            Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)
            DocumentAnalysis.delete_by_project(project_id)
            return jsonify({'error': ratio_error}), 400

        print(f"✅ [VALIDATE] Word/page ratio valid: {word_count / page_count:.0f} words/page")

        # STEP 8: Calculate cost estimate
        cost_estimate = calculate_cost(page_count)
        print(f"💰 [VALIDATE] Cost calculated: {cost_estimate['total_credits']} credits for {page_count} pages")

        # STEP 9: Update project with validation results
        from database import mongo
        result = mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': {
                'page_count': page_count,
                'word_count': word_count,
                'total_credits': cost_estimate['total_credits'],
                'validated': True,
                'validated_at': datetime.utcnow(),
                'status': 'validated'  # Transition from 'uploaded' to 'validated'
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
            'is_preview': project.get('is_preview', False),
            'metadata': {
                'filesize': filesize,
                'page_count': page_count,
                'word_count': word_count,
                'filename': project['upload_filename']
            },
            'cost_estimate': cost_estimate,
            'document_analysis': analysis
        }), 200

    except Exception as e:
        print(f"❌ [VALIDATE] Unexpected error: {e}")
        # Clean up project and files on unexpected error
        try:
            if 'project_id' in locals() and project_id and 'user_email' in locals():
                Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)
                DocumentAnalysis.delete_by_project(project_id)
        except Exception as cleanup_error:
            print(f"⚠️  [VALIDATE] Cleanup error: {cleanup_error}")

        return jsonify({
            'error': 'Validation failed. Please try again.'
        }), 500

@api_project.route('/cost-estimate', methods=['GET'])
@requires_auth(allow_anonymous=True)
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
    if project.get('user_id') != str(user['_id']):
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

@api_project.route('/projects', methods=['GET'])
@requires_auth(allow_anonymous=True)
def get_projects(user):
    """Get all projects for the authenticated user"""
    projects = Project.find_by_user(str(user['_id']))

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

        # Get template info from templates.json
        template_id = proj.get('template', '').lower()
        template_config = get_template_by_id(template_id)
        if template_config:
            template_info = {'name': template_config['name'], 'thumbnail': template_config['thumbnail']}
        else:
            template_info = {'name': 'Unknown Template', 'thumbnail': '/default.svg'}

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
            'status': frontend_status,
            'paid': proj.get('paid', False)
        })

    return jsonify(formatted_projects), 200

@api_project.route('/project/<project_id>', methods=['DELETE'])
@requires_auth(allow_anonymous=True)
def delete_project(user, project_id):
    """Delete a project: orphan DB record, delete local files, notify latextai server"""
    from api_latext import delete_project_on_latextai

    user_email = user['email']

    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Delete local files and orphan database record
    success, message = Project.delete_with_files(project_id, user_email, USER_PROJECTS_DIR)

    if not success:
        return jsonify({'error': message}), 500

    # Notify latextai server to delete its copy of the files
    latextai_success, latextai_message = delete_project_on_latextai(user_email, project_id)
    if latextai_success:
        print(f"✅ [DELETE] Latextai: {latextai_message}")
    else:
        print(f"⚠️  [DELETE] Latextai: {latextai_message}")

    return jsonify({'message': message}), 200

@api_project.route('/project/<project_id>', methods=['GET'])
@requires_auth(allow_anonymous=True)
def get_project(user, project_id):
    """Get a single project by ID (minimal fields for frontend)"""
    project = Project.find_by_id(project_id)

    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Look up document analysis
    analysis_doc = DocumentAnalysis.find_by_project(project_id)
    document_analysis = None
    if analysis_doc:
        document_analysis = {k: v for k, v in analysis_doc.items() if k not in ('_id', 'project_id', 'created_at')}

    return jsonify({
        'project_id': project.get('project_id'),
        'upload_filename': project.get('upload_filename'),
        'status': project.get('status'),
        'paid': project.get('paid', False),
        'is_preview': project.get('is_preview', False),
        'paid_with_free_upload': project.get('paid_with_free_upload', False),
        'compilation_failed': project.get('compilation_failed', False),
        'feedback': project.get('feedback'),
        'document_analysis': document_analysis,
    }), 200

@api_project.route('/project/<project_id>/payment-details', methods=['GET'])
@requires_auth(allow_anonymous=True)
def get_payment_details(user, project_id):
    """Get payment details for a project (cost estimate, metadata, etc.)"""
    user_email = user['email']

    # Find project
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # Verify ownership
    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if project is validated
    if not project.get('validated', False):
        return jsonify({'error': 'Project not yet validated'}), 400

    # Check if already paid (allow through for free-upload projects — frontend needs cost data for upgrade CTA)
    if project.get('paid', False) and not project.get('paid_with_free_upload', False):
        return jsonify({'error': 'Project already paid'}), 409

    # Get metadata
    page_count = project.get('page_count')
    word_count = project.get('word_count')
    filesize = project.get('filesize')
    filename = project.get('upload_filename', 'document.docx')
    template_id = project.get('template', '')
    template_config = get_template_by_id(template_id)
    template_name = template_config['name'] if template_config else 'Unknown Template'

    if page_count is None:
        return jsonify({'error': 'Project cost not calculated'}), 400

    # Calculate cost estimate (same as validation)
    cost_estimate = calculate_cost(page_count)

    # Get all balances in one query
    balances = User.get_all_balances(user_email)
    credit_balance = balances['credit_balance']
    free_credit_balance = balances['free_credit_balance']
    first_purchase_discount_used = balances['first_purchase_discount_used']

    # Pre-compute credit split
    credit_split = calculate_credit_split(
        cost_estimate['total_credits'],
        free_credit_balance,
        credit_balance,
        not first_purchase_discount_used
    )

    # Look up document analysis
    analysis_doc = DocumentAnalysis.find_by_project(project_id)
    document_analysis = None
    if analysis_doc:
        document_analysis = {k: v for k, v in analysis_doc.items() if k not in ('_id', 'project_id', 'created_at')}

    return jsonify({
        'project_id': project_id,
        'metadata': {
            'filename': filename,
            'page_count': page_count,
            'word_count': word_count,
            'filesize': filesize,
            'template': template_name
        },
        'cost_estimate': cost_estimate,
        'credit_balance': credit_balance,
        'free_credit_balance': free_credit_balance,
        'first_purchase_discount_available': not first_purchase_discount_used,
        'credit_split': credit_split,
        'has_sufficient_credits': credit_split['sufficient'],
        'document_analysis': document_analysis
    }), 200

@api_project.route('/project/<project_id>/feedback', methods=['POST'])
@requires_auth(allow_anonymous=True)
def submit_feedback(user, data, project_id):
    """Submit user feedback for a completed project"""
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    if project.get('status') != 'converted':
        return jsonify({'error': 'Can only submit feedback for completed projects'}), 400

    request_data = request.get_json()
    feedback = request_data.get('feedback')

    valid_values = ['positive', 'negative', None]
    if feedback not in valid_values:
        return jsonify({'error': 'Invalid feedback value'}), 400

    Project.set_feedback(project_id, feedback)

    return jsonify({'success': True, 'feedback': feedback}), 200
