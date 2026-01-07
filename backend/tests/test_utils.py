"""
Test utilities for creating users and projects in tests.
"""

import os
import uuid
import requests
from datetime import datetime
from werkzeug.security import generate_password_hash


def create_test_user(email=None, password=None, is_verified=True,
                     free_project_id=None, admin=False, mongo_db=None,
                     base_url=None):
    """Create a test user directly in MongoDB and get auth tokens via API."""
    # Generate defaults if not provided
    if email is None:
        email = f"test_{uuid.uuid4().hex[:8]}@test.com"
    if password is None:
        password = f"TestPass_{uuid.uuid4().hex[:8]}!"
    if base_url is None:
        base_url = os.getenv('BACKEND_URL')

    # Validate required parameters
    if mongo_db is None:
        raise ValueError("mongo_db is required. Call within app.app_context()")
    if base_url is None:
        raise ValueError("base_url is required. Set BACKEND_URL env variable")

    # Create user directly in MongoDB
    user_doc = {
        'email': email,
        'password': generate_password_hash(password),
        'is_verified': is_verified,
        'free_project_id': free_project_id,
        'admin': admin,
        'data_consent': None,
        'is_deleted': False,
        'created_at': datetime.utcnow()
    }

    result = mongo_db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    print(f"✅ Created test user: {email} (user_id: {user_id})")

    # Login via API to get tokens
    login_response = requests.post(
        f"{base_url}/api/login",
        json={'email': email, 'password': password},
        timeout=10
    )

    if login_response.status_code != 200:
        raise Exception(f"Failed to login test user: {login_response.json()}")

    tokens = login_response.json()

    return {
        'email': email,
        'password': password,
        'user_id': user_id,
        'is_verified': is_verified,
        'free_project_id': free_project_id,
        'admin': admin,
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token']
    }


def delete_test_user(email, mongo_db):
    """Delete a test user, all their data from MongoDB, and all their files."""
    import os
    import shutil
    from bson import ObjectId

    if mongo_db is None:
        raise ValueError("mongo_db is required. Call within app.app_context()")

    # Get user_id before deletion (needed to clean up orphaned projects)
    user = mongo_db.users.find_one({'email': email})
    user_id = str(user['_id']) if user else None

    # Delete user's project files
    user_projects_dir = os.path.join('user_projects', email)
    if os.path.exists(user_projects_dir):
        shutil.rmtree(user_projects_dir, ignore_errors=True)
        print(f"🧹 Deleted files for user: {email}")

    # Delete from database (by email OR user_id to catch orphaned records)
    users_deleted = mongo_db.users.delete_many({'email': email}).deleted_count
    projects_deleted = mongo_db.projects.delete_many({
        '$or': [{'user_email': email}, {'user_id': user_id}]
    }).deleted_count if user_id else mongo_db.projects.delete_many({'user_email': email}).deleted_count
    transactions_deleted = mongo_db.credit_transactions.delete_many({
        '$or': [{'user_email': email}, {'user_id': user_id}]
    }).deleted_count if user_id else mongo_db.credit_transactions.delete_many({'user_email': email}).deleted_count
    tokens_deleted = mongo_db.used_tokens.delete_many({'email': email}).deleted_count

    print(f"🧹 Deleted test user: {email} ({projects_deleted} projects, {transactions_deleted} transactions)")

    return {
        'users_deleted': users_deleted,
        'projects_deleted': projects_deleted,
        'transactions_deleted': transactions_deleted,
        'tokens_deleted': tokens_deleted
    }


def create_test_project(user_email, user_id, project_id=None, upload_filename=None,
                       template='ieee', status='uploaded', paid=False,
                       total_credits=None, filesize=50000,
                       page_count=None, word_count=None, validated=False,
                       card_verified_at=None, mongo_db=None):
    """Create a test project directly in MongoDB."""
    # Validate required parameters
    if mongo_db is None:
        raise ValueError("mongo_db is required. Call within app.app_context()")
    if user_id is None:
        raise ValueError("user_id is required")

    # Generate defaults if not provided
    if project_id is None:
        project_id = str(uuid.uuid4())
    if upload_filename is None:
        upload_filename = f"test_document_{uuid.uuid4().hex[:8]}.docx"

    # Create project document
    project_doc = {
        'project_id': project_id,
        'user_email': user_email,
        'user_id': user_id,
        'upload_filename': upload_filename,
        'tex_filename': None,
        'pdf_filename': None,
        'template': template,
        'status': status,
        'paid': paid,
        'total_credits': total_credits,
        'filesize': filesize,
        'page_count': page_count,
        'word_count': word_count,
        'validated': validated,
        'created_at': datetime.utcnow()
    }
    if card_verified_at:
        project_doc['card_verified_at'] = card_verified_at

    mongo_db.projects.insert_one(project_doc)
    print(f"✅ Created test project: {project_id}")

    return {
        'project_id': project_id,
        'user_email': user_email,
        'user_id': user_id,
        'upload_filename': upload_filename,
        'template': template,
        'status': status,
        'paid': paid,
        'total_credits': total_credits,
        'filesize': filesize,
        'page_count': page_count,
        'word_count': word_count,
        'validated': validated,
        'card_verified_at': card_verified_at
    }


def refresh_access_token(refresh_token, base_url=None):
    """Use a refresh token to get a new access token."""
    if base_url is None:
        base_url = os.getenv('BACKEND_URL')

    if base_url is None:
        raise ValueError("base_url is required. Set BACKEND_URL env variable")

    headers = {"Authorization": f"Bearer {refresh_token}"}
    response = requests.post(f"{base_url}/api/refresh", headers=headers, timeout=10)

    if response.status_code != 200:
        raise Exception(f"Failed to refresh token: {response.json()}")

    return response.json()
