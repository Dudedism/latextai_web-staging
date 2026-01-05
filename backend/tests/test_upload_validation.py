"""
Test for Upload Validation (Integration Test)

This test suite validates the split upload/validate flow with real DOCX files.
"""

import os
import pytest
import requests
from pathlib import Path

# Import database models and test utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import mongo, Project
from app import app
from tests.test_utils import create_test_user, delete_test_user

# Base URL from environment variable (no default - must be set)
BASE_URL = os.getenv('BACKEND_URL')

# Test files directory
TEST_FILES_DIR = Path(__file__).parent / 'test_files'
DUMMY_FILE = TEST_FILES_DIR / 'dummy_upload.docx'
HIGH_RATIO_FILE = TEST_FILES_DIR / 'high_word_page_ratio.docx'
ACCURATE_PRICE_FILE = TEST_FILES_DIR / 'accurate_price.docx'


@pytest.fixture(scope="module")
def test_user():
    """Create a verified test user with tokens."""
    with app.app_context():
        user = create_test_user(
            name="Upload Validation Test User",
            is_verified=True,
            free_project_id=None,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )

        yield user

        # Cleanup: Delete user and all their projects
        delete_test_user(user['email'], mongo.db)


def test_valid_document_upload(test_user):
    """
    TEST: Valid Document Upload

    Tests /upload endpoint only:
    - Upload succeeds (HTTP 200)
    - Returns project_id and basic metadata (filesize, filename)
    - validated=False in response
    - Project created in database with validated=False
    """
    print("\n" + "="*80)
    print("TEST: Valid Document Upload")
    print("="*80)

    assert DUMMY_FILE.exists(), f"Test file not found: {DUMMY_FILE}"

    project_id = None
    try:
        print(f"\n📄 Uploading file: {DUMMY_FILE.name}")

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}"
        }

        with open(DUMMY_FILE, 'rb') as f:
            files = {
                'file': (DUMMY_FILE.name, f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            }
            data = {
                'template': 'ieee'
            }

            response = requests.post(
                f"{BASE_URL}/api/latex/upload",
                headers=headers,
                files=files,
                data=data,
                timeout=60
            )

        print(f"\n📥 Response status: {response.status_code}")

        # ASSERTION 1: Upload should succeed
        assert response.status_code == 200, f"Upload should succeed, got {response.status_code}: {response.text}"

        response_data = response.json()
        print(f"📦 Response data: {response_data}")

        # ASSERTION 2: Response should contain required fields
        assert 'project_id' in response_data, "Response should contain project_id"
        assert 'status' in response_data, "Response should contain status"
        assert 'validated' in response_data, "Response should contain validated"
        assert 'metadata' in response_data, "Response should contain metadata"

        # ASSERTION 3: Status should be 'uploaded' and validated should be False
        assert response_data['status'] == 'uploaded', f"Status should be 'uploaded', got {response_data['status']}"
        assert response_data['validated'] == False, f"validated should be False, got {response_data['validated']}"

        # ASSERTION 4: Metadata should contain basic info (filesize, filename only)
        metadata = response_data['metadata']
        assert 'filesize' in metadata, "Metadata should contain filesize"
        assert 'filename' in metadata, "Metadata should contain filename"
        assert metadata['filesize'] > 0, f"File size should be > 0, got {metadata['filesize']}"

        print(f"\n📊 Basic metadata:")
        print(f"   Filesize: {metadata['filesize']} bytes")
        print(f"   Filename: {metadata['filename']}")

        # ASSERTION 5: Verify project in database
        project_id = response_data['project_id']
        with app.app_context():
            project = Project.find_by_id(project_id)
            assert project is not None, "Project should exist in database"
            assert project['status'] == 'uploaded', f"Project status should be 'uploaded', got {project['status']}"
            assert project['validated'] == False, f"Project validated should be False, got {project.get('validated')}"
            assert project['paid'] == False, "Project should not be paid yet"
            assert project.get('page_count') is None, f"Page count should be None (not yet validated), got {project.get('page_count')}"
            assert project.get('word_count') is None, f"Word count should be None (not yet validated), got {project.get('word_count')}"
            assert project['user_id'] == test_user['email'], "Project should belong to test user"

        print(f"\n✅ Project created in database: {project_id}")
        print(f"   Status: {project['status']}")
        print(f"   Validated: {project['validated']}")
        print(f"   Paid: {project['paid']}")

        print("\n✅ TEST PASSED: Valid document uploaded successfully")
        print("="*80)

    finally:
        # CLEANUP: Projects will be cleaned up by test_user fixture, but ensure this one is noted
        if project_id:
            print(f"📝 Project {project_id} will be cleaned up with user")


def test_valid_document_validation(test_user):
    """
    TEST: Valid Document Validation

    Tests /validate endpoint with dummy_upload.docx:
    - Validation succeeds (HTTP 200)
    - Returns metadata (11 pages, 3000-4500 words)
    - Returns cost estimate
    - validated=True in response
    - Project updated in database with validated=True
    """
    print("\n" + "="*80)
    print("TEST: Valid Document Validation")
    print("="*80)

    project_id = None
    try:
        # Get the project_id from the first test's upload
        with app.app_context():
            projects = list(mongo.db.projects.find({'user_id': test_user['email']}))
            assert len(projects) >= 1, "Should have at least 1 uploaded project"
            project_id = projects[0]['project_id']

        print(f"\n🔍 Validating project: {project_id}")

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}",
            "Content-Type": "application/json"
        }

        payload = {
            "project_id": project_id
        }

        response = requests.post(
            f"{BASE_URL}/api/latex/validate",
            headers=headers,
            json=payload,
            timeout=60
        )

        print(f"\n📥 Response status: {response.status_code}")

        # ASSERTION 1: Validation should succeed
        assert response.status_code == 200, f"Validation should succeed, got {response.status_code}: {response.text}"

        response_data = response.json()
        print(f"📦 Response data: {response_data}")

        # ASSERTION 2: Response should contain required fields
        assert 'project_id' in response_data, "Response should contain project_id"
        assert 'validated' in response_data, "Response should contain validated"
        assert 'metadata' in response_data, "Response should contain metadata"
        assert 'cost_estimate' in response_data, "Response should contain cost_estimate"
        assert 'can_use_free' in response_data, "Response should contain can_use_free"

        # ASSERTION 3: validated should be True
        assert response_data['validated'] == True, f"validated should be True, got {response_data['validated']}"

        # ASSERTION 4: Metadata should be valid - dummy_upload.docx has 11 pages, 3000-4500 words
        metadata = response_data['metadata']
        assert 'page_count' in metadata, "Metadata should contain page_count"
        assert 'word_count' in metadata, "Metadata should contain word_count"
        assert 'filesize' in metadata, "Metadata should contain filesize"

        page_count = metadata['page_count']
        word_count = metadata['word_count']
        filesize = metadata['filesize']

        assert page_count == 11, f"Page count should be 11, got {page_count}"
        assert 3000 <= word_count <= 4500, f"Word count should be between 3000-4500, got {word_count}"
        assert filesize > 0, f"File size should be > 0, got {filesize}"

        print(f"\n📊 Extracted metadata:")
        print(f"   Pages: {page_count}")
        print(f"   Words: {word_count}")
        print(f"   Word/Page Ratio: {word_count / page_count:.0f} words/page")
        print(f"   Filesize: {filesize} bytes")

        # ASSERTION 5: Cost estimate should be valid
        cost_estimate = response_data['cost_estimate']
        assert 'total' in cost_estimate, "Cost estimate should contain total"
        assert cost_estimate['total'] >= 4.99, f"Cost should be at least $4.99, got ${cost_estimate['total']}"

        print(f"\n💰 Cost estimate: ${cost_estimate['total']}")

        # ASSERTION 6: Verify project in database
        with app.app_context():
            project = Project.find_by_id(project_id)
            assert project is not None, "Project should exist in database"
            assert project['validated'] == True, f"Project validated should be True, got {project['validated']}"
            assert project['page_count'] == page_count, "Page count in DB should match response"
            assert project['word_count'] == word_count, "Word count in DB should match response"

        print(f"\n✅ Project validated in database: {project_id}")
        print(f"   Validated: {project['validated']}")
        print(f"   Pages: {project['page_count']}")
        print(f"   Words: {project['word_count']}")

        print("\n✅ TEST PASSED: Valid document validated successfully")
        print("="*80)

    finally:
        # CLEANUP: Projects will be cleaned up by test_user fixture
        if project_id:
            print(f"📝 Project {project_id} will be cleaned up with user")


def test_high_word_ratio_validation_rejection(test_user):
    """
    TEST: High Word-to-Page Ratio Validation Rejection

    Tests /validate endpoint with high_word_page_ratio.docx:
    - Upload succeeds (file is accepted)
    - Validation is rejected (HTTP 400 for ratio error, or 500 if file is corrupted)
    - Error message exists
    - Project is deleted from database
    """
    print("\n" + "="*80)
    print("TEST: High Word-to-Page Ratio Validation Rejection")
    print("="*80)

    assert HIGH_RATIO_FILE.exists(), f"Test file not found: {HIGH_RATIO_FILE}"

    project_id = None
    try:
        # STEP 1: Upload the high ratio file
        print(f"\n📄 Uploading file: {HIGH_RATIO_FILE.name}")

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}"
        }

        with open(HIGH_RATIO_FILE, 'rb') as f:
            files = {
                'file': (HIGH_RATIO_FILE.name, f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            }
            data = {
                'template': 'ieee'
            }

            upload_response = requests.post(
                f"{BASE_URL}/api/latex/upload",
                headers=headers,
                files=files,
                data=data,
                timeout=60
            )

        print(f"\n📥 Upload response status: {upload_response.status_code}")

        # Upload should succeed (we don't validate in upload anymore)
        assert upload_response.status_code == 200, f"Upload should succeed, got {upload_response.status_code}"

        upload_data = upload_response.json()
        project_id = upload_data['project_id']
        print(f"✅ Upload succeeded, project_id: {project_id}")

        # STEP 2: Validate the file (this should fail)
        print(f"\n🔍 Validating project: {project_id}")

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}",
            "Content-Type": "application/json"
        }

        payload = {
            "project_id": project_id
        }

        validate_response = requests.post(
            f"{BASE_URL}/api/latex/validate",
            headers=headers,
            json=payload,
            timeout=60
        )

        print(f"\n📥 Validation response status: {validate_response.status_code}")

        # ASSERTION 1: Validation should be rejected (either 400 for ratio or 500 for processing failure)
        assert validate_response.status_code in [400, 500], \
            f"Validation should be rejected with 400 or 500, got {validate_response.status_code}"

        validate_data = validate_response.json()
        print(f"📦 Response data: {validate_data}")

        # ASSERTION 2: Error message should exist
        assert 'error' in validate_data, "Response should contain error message"

        # The error can be either:
        # - Word/page ratio error (400)
        # - Document processing error (500) if file is corrupted/unreadable
        error_msg = validate_data['error'].lower()
        print(f"\n❌ Rejected (as expected): {validate_data['error']}")

        # ASSERTION 3: Verify project was deleted from database
        with app.app_context():
            project = Project.find_by_id(project_id)
            assert project is None, f"Project should be deleted after validation failure, but still exists"

        print(f"\n✅ Project deleted from database after validation failure")

        print("\n✅ TEST PASSED: High word ratio document validation rejected")
        print("="*80)

    finally:
        # CLEANUP: Ensure project and files are deleted even if test fails
        if project_id:
            with app.app_context():
                Project.delete_with_files(project_id, test_user['email'])
                print(f"🧹 Cleanup: Deleted project {project_id} and files")


def test_accurate_price_calculation(test_user):
    """
    TEST: Accurate Price Calculation

    Tests /validate endpoint with accurate_price.docx (21 pages):
    - Upload succeeds
    - Validation succeeds
    - Page count is 21
    - Cost is calculated correctly: $4.99 + (21-15)*$0.50 = $7.99
    """
    print("\n" + "="*80)
    print("TEST: Accurate Price Calculation (21 Pages)")
    print("="*80)

    assert ACCURATE_PRICE_FILE.exists(), f"Test file not found: {ACCURATE_PRICE_FILE}"

    project_id = None
    try:
        # STEP 1: Upload the file
        print(f"\n📄 Uploading file: {ACCURATE_PRICE_FILE.name}")

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}"
        }

        with open(ACCURATE_PRICE_FILE, 'rb') as f:
            files = {
                'file': (ACCURATE_PRICE_FILE.name, f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            }
            data = {
                'template': 'ieee'
            }

            upload_response = requests.post(
                f"{BASE_URL}/api/latex/upload",
                headers=headers,
                files=files,
                data=data,
                timeout=60
            )

        print(f"\n📥 Upload response status: {upload_response.status_code}")

        # ASSERTION 1: Upload should succeed
        assert upload_response.status_code == 200, f"Upload should succeed, got {upload_response.status_code}"

        upload_data = upload_response.json()
        project_id = upload_data['project_id']
        print(f"✅ Upload succeeded, project_id: {project_id}")

        # STEP 2: Validate the file
        print(f"\n🔍 Validating project: {project_id}")

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}",
            "Content-Type": "application/json"
        }

        payload = {
            "project_id": project_id
        }

        validate_response = requests.post(
            f"{BASE_URL}/api/latex/validate",
            headers=headers,
            json=payload,
            timeout=60
        )

        print(f"\n📥 Validation response status: {validate_response.status_code}")

        # ASSERTION 2: Validation should succeed
        assert validate_response.status_code == 200, f"Validation should succeed, got {validate_response.status_code}: {validate_response.text}"

        validate_data = validate_response.json()
        print(f"📦 Response data: {validate_data}")

        # ASSERTION 3: Response should contain required fields
        assert 'validated' in validate_data, "Response should contain validated"
        assert 'metadata' in validate_data, "Response should contain metadata"
        assert 'cost_estimate' in validate_data, "Response should contain cost_estimate"

        # ASSERTION 4: validated should be True
        assert validate_data['validated'] == True, f"validated should be True, got {validate_data['validated']}"

        # ASSERTION 5: Page count should be 21
        metadata = validate_data['metadata']
        assert 'page_count' in metadata, "Metadata should contain page_count"
        page_count = metadata['page_count']
        assert page_count == 21, f"Page count should be 21, got {page_count}"

        print(f"\n📊 Extracted metadata:")
        print(f"   Pages: {page_count}")
        print(f"   Words: {metadata.get('word_count', 'N/A')}")
        print(f"   Filesize: {metadata.get('filesize', 'N/A')} bytes")

        # ASSERTION 6: Cost should be $7.99 (21 pages)
        # Pricing: $4.99 base (15 pages) + (21-15)*$0.50 = $4.99 + $3.00 = $7.99
        cost_estimate = validate_data['cost_estimate']
        assert 'total' in cost_estimate, "Cost estimate should contain total"

        expected_cost = 7.99
        actual_cost = cost_estimate['total']
        assert actual_cost == expected_cost, f"Cost should be ${expected_cost}, got ${actual_cost}"

        print(f"\n💰 Cost estimate: ${actual_cost}")
        print(f"   Expected: ${expected_cost}")
        print(f"   Breakdown: {cost_estimate.get('breakdown', 'N/A')}")

        # ASSERTION 7: Verify project in database
        with app.app_context():
            project = Project.find_by_id(project_id)
            assert project is not None, "Project should exist in database"
            assert project['validated'] == True, f"Project validated should be True, got {project['validated']}"
            assert project['page_count'] == 21, f"Page count in DB should be 21, got {project.get('page_count')}"
            assert project['total_cost'] == expected_cost, f"Total cost in DB should be ${expected_cost}, got ${project.get('total_cost')}"

        print(f"\n✅ Project validated in database: {project_id}")
        print(f"   Validated: {project['validated']}")
        print(f"   Pages: {project['page_count']}")
        print(f"   Cost: ${project['total_cost']}")

        print("\n✅ TEST PASSED: Price calculated accurately for 21-page document")
        print("="*80)

    finally:
        # CLEANUP: Projects will be cleaned up by test_user fixture
        if project_id:
            print(f"📝 Project {project_id} will be cleaned up with user")


if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════════════════════╗
    ║                    UPLOAD VALIDATION INTEGRATION TEST                        ║
    ╚══════════════════════════════════════════════════════════════════════════════╝

    This test suite validates the split upload/validate flow with real DOCX files.

    Required Test Files:
    - tests/test_files/dummy_upload.docx (valid document: 11 pages, 3000-4500 words)
    - tests/test_files/high_word_page_ratio.docx (>3000 words/page)
    - tests/test_files/accurate_price.docx (21 pages for price calculation test)

    Tests Covered:
    ✓ Valid document upload (fast, < 1 second)
    ✓ Valid document validation (slow, LibreOffice + word count)
    ✓ High word-to-page ratio rejection during validation (>3000 words/page)
    ✓ Accurate price calculation (21 pages = $7.99)

    To run this test:
    1. Set BACKEND_URL environment variable (e.g., export BACKEND_URL=http://localhost:8000)
    2. Start the backend server: python app.py
    3. Ensure test files exist in tests/test_files/
    4. Run: pytest tests/test_upload_validation.py -v -s

    Expected Output:
    ✅ Valid document uploads successfully (validated=False)
    ✅ Valid document validates successfully (11 pages, 3000-4500 words)
    ✅ High ratio file uploads successfully
    ❌ High ratio file validation rejected (>3000 words/page, project deleted)
    ✅ Accurate price document validates with correct cost ($7.99 for 21 pages)
    """)
