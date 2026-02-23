"""
Test for Duplicate Upload Prevention (Integration Test)

Verifies that rapidly uploading the same file (e.g. page refresh during upload)
does not create duplicate projects. The backend should return 409 with the
existing project_id on the second attempt.
"""

import os
import pytest
import requests
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import mongo, Project
from app import app
from tests.test_utils import create_test_user, delete_test_user

BASE_URL = os.getenv('BACKEND_URL')

TEST_FILES_DIR = Path(__file__).parent / 'test_files'
DUMMY_FILE = TEST_FILES_DIR / 'dummy_upload.docx'


@pytest.fixture(scope="module")
def test_user():
    """Create a verified test user with tokens."""
    with app.app_context():
        user = create_test_user(
            is_verified=True,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )
        # Ensure preview_count exists so atomic increment works
        mongo.db.users.update_one(
            {'email': user['email']},
            {'$set': {'preview_count': 0}}
        )

        yield user

        delete_test_user(user['email'], mongo.db)


def _upload_file(test_user):
    """Helper: upload dummy file and return (status_code, response_json)."""
    headers = {
        "Authorization": f"Bearer {test_user['access_token']}"
    }
    with open(DUMMY_FILE, 'rb') as f:
        files = {
            'file': (DUMMY_FILE.name, f,
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        }
        data = {'template': 'ieee'}
        response = requests.post(
            f"{BASE_URL}/api/latex/upload",
            headers=headers,
            files=files,
            data=data,
            timeout=60
        )
    return response.status_code, response.json()


def test_duplicate_upload_returns_409(test_user):
    """
    TEST: Rapid duplicate upload returns 409 with existing project_id.

    1. Upload a file → 200, get project_id
    2. Upload again immediately → 409, same project_id
    3. Only 1 project exists in DB for this user
    """
    print("\n" + "=" * 80)
    print("TEST: Duplicate Upload Returns 409")
    print("=" * 80)

    assert DUMMY_FILE.exists(), f"Test file not found: {DUMMY_FILE}"

    project_ids = []
    try:
        # First upload — should succeed
        status1, data1 = _upload_file(test_user)
        print(f"\n📤 First upload: {status1}")
        assert status1 == 200, f"First upload should succeed, got {status1}: {data1}"
        project_id_1 = data1['project_id']
        project_ids.append(project_id_1)
        print(f"   project_id: {project_id_1}")

        # Second upload — should be blocked with 409
        status2, data2 = _upload_file(test_user)
        print(f"\n📤 Second upload: {status2}")
        assert status2 == 409, f"Second upload should return 409, got {status2}: {data2}"
        assert data2.get('duplicate') is True, "Response should have duplicate=True"
        assert data2.get('project_id') == project_id_1, \
            f"409 should return same project_id. Expected {project_id_1}, got {data2.get('project_id')}"
        print(f"   duplicate=True, project_id: {data2.get('project_id')}")

        # Verify only 1 project in DB
        with app.app_context():
            user_projects = list(mongo.db.projects.find({
                'user_id': test_user['user_id'],
                'is_orphaned': {'$ne': True}
            }))
            assert len(user_projects) == 1, \
                f"Should have exactly 1 project, found {len(user_projects)}"
            assert user_projects[0]['project_id'] == project_id_1

        print(f"\n✅ Only 1 project in DB: {project_id_1}")
        print("\n✅ TEST PASSED: Duplicate upload correctly blocked")
        print("=" * 80)

    finally:
        with app.app_context():
            for pid in project_ids:
                mongo.db.projects.delete_one({'project_id': pid})
                mongo.db.document_analysis.delete_one({'project_id': pid})
            print(f"🧹 Cleanup: deleted {len(project_ids)} test projects")


def test_upload_allowed_after_validation(test_user):
    """
    TEST: New upload allowed after previous project is validated.

    1. Upload a file → 200
    2. Validate it → 200 (status changes to 'validated')
    3. Upload again → 200 (new project, not blocked)
    """
    print("\n" + "=" * 80)
    print("TEST: Upload Allowed After Validation")
    print("=" * 80)

    assert DUMMY_FILE.exists(), f"Test file not found: {DUMMY_FILE}"

    project_ids = []
    try:
        # First upload
        status1, data1 = _upload_file(test_user)
        assert status1 == 200, f"First upload should succeed, got {status1}: {data1}"
        project_id_1 = data1['project_id']
        project_ids.append(project_id_1)
        print(f"\n📤 First upload: {project_id_1}")

        # Validate it
        headers = {
            "Authorization": f"Bearer {test_user['access_token']}",
            "Content-Type": "application/json"
        }
        validate_response = requests.post(
            f"{BASE_URL}/api/latex/validate",
            headers=headers,
            json={"project_id": project_id_1},
            timeout=60
        )
        assert validate_response.status_code == 200, \
            f"Validation should succeed, got {validate_response.status_code}: {validate_response.text}"
        print(f"   Validated: {project_id_1}")

        # Second upload — should now succeed (previous project is validated)
        status2, data2 = _upload_file(test_user)
        assert status2 == 200, f"Second upload should succeed after validation, got {status2}: {data2}"
        project_id_2 = data2['project_id']
        project_ids.append(project_id_2)
        print(f"\n📤 Second upload: {project_id_2}")

        assert project_id_1 != project_id_2, "Should be different project IDs"

        # Verify 2 projects in DB
        with app.app_context():
            user_projects = list(mongo.db.projects.find({
                'user_id': test_user['user_id'],
                'is_orphaned': {'$ne': True}
            }))
            assert len(user_projects) == 2, \
                f"Should have 2 projects, found {len(user_projects)}"

        print(f"\n✅ 2 projects in DB after validate + re-upload")
        print("\n✅ TEST PASSED: Upload allowed after previous project validated")
        print("=" * 80)

    finally:
        with app.app_context():
            import shutil
            for pid in project_ids:
                mongo.db.projects.delete_one({'project_id': pid})
                mongo.db.document_analysis.delete_one({'project_id': pid})
                project_dir = os.path.join('user_projects', test_user['email'], pid)
                if os.path.exists(project_dir):
                    shutil.rmtree(project_dir, ignore_errors=True)
            print(f"🧹 Cleanup: deleted {len(project_ids)} test projects")


def test_validate_409_on_already_validated(test_user):
    """
    TEST: Calling /validate on already-validated project returns 409.

    Simulates the case where a user refreshes during validation and the
    original request already completed.
    """
    print("\n" + "=" * 80)
    print("TEST: Validate Returns 409 on Already-Validated Project")
    print("=" * 80)

    assert DUMMY_FILE.exists(), f"Test file not found: {DUMMY_FILE}"

    project_ids = []
    try:
        # Upload
        status, data = _upload_file(test_user)
        assert status == 200, f"Upload should succeed, got {status}: {data}"
        project_id = data['project_id']
        project_ids.append(project_id)

        headers = {
            "Authorization": f"Bearer {test_user['access_token']}",
            "Content-Type": "application/json"
        }
        payload = {"project_id": project_id}

        # First validate — should succeed
        resp1 = requests.post(
            f"{BASE_URL}/api/latex/validate",
            headers=headers,
            json=payload,
            timeout=60
        )
        assert resp1.status_code == 200, \
            f"First validate should succeed, got {resp1.status_code}: {resp1.text}"
        print(f"\n✅ First validate: 200")

        # Second validate — should return 409
        resp2 = requests.post(
            f"{BASE_URL}/api/latex/validate",
            headers=headers,
            json=payload,
            timeout=60
        )
        assert resp2.status_code == 409, \
            f"Second validate should return 409, got {resp2.status_code}: {resp2.text}"
        resp2_data = resp2.json()
        assert resp2_data.get('validated') is True
        assert resp2_data.get('project_id') == project_id
        print(f"✅ Second validate: 409 (already validated)")

        print("\n✅ TEST PASSED: Re-validation correctly returns 409")
        print("=" * 80)

    finally:
        with app.app_context():
            import shutil
            for pid in project_ids:
                mongo.db.projects.delete_one({'project_id': pid})
                mongo.db.document_analysis.delete_one({'project_id': pid})
                project_dir = os.path.join('user_projects', test_user['email'], pid)
                if os.path.exists(project_dir):
                    shutil.rmtree(project_dir, ignore_errors=True)
            print(f"🧹 Cleanup: deleted {len(project_ids)} test projects")


if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════════════════════╗
    ║               DUPLICATE UPLOAD PREVENTION INTEGRATION TEST                   ║
    ╚══════════════════════════════════════════════════════════════════════════════╝

    Tests that the backend prevents duplicate project creation when users
    refresh or double-submit the upload form.

    Tests Covered:
    ✓ Rapid duplicate upload returns 409 with existing project_id
    ✓ Upload allowed again after previous project is validated
    ✓ Calling /validate on already-validated project returns 409

    To run:
    1. Set BACKEND_URL (e.g., export BACKEND_URL=http://localhost:8000)
    2. Start the backend: python app.py
    3. Run: pytest tests/test_duplicate_upload.py -v -s
    """)
