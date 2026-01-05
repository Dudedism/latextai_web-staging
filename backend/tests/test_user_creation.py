"""
Test user creation and signup functionality.

Run with: pytest tests/test_user_creation.py -v -s
"""

import os
import pytest
import requests
from pathlib import Path

# Import test utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import mongo
from app import app
from tests.test_utils import create_test_user, delete_test_user

BASE_URL = os.getenv('BACKEND_URL')


@pytest.fixture(scope="module")
def test_user():
    """Create a verified test user with tokens."""
    with app.app_context():
        user = create_test_user(
            name="User Creation Test User",
            is_verified=True,
            free_project_id=None,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )

        yield user

        # Cleanup: Delete user and all their projects
        delete_test_user(user['email'], mongo.db)


def test_user_creation(test_user):
    """
    Test that the test user was created successfully.
    """
    print("\n" + "="*60)
    print("TEST: User Creation")
    print("="*60)

    print(f"✅ Test user exists: {test_user['email']}")
    print(f"   Name: {test_user['name']}")
    print(f"   Email: {test_user['email']}")

    # Verify user can login (which proves they were created and verified)
    login_payload = {
        "email": test_user['email'],
        "password": test_user['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)

    assert response.status_code == 200, f"User cannot login: {response.json()}"

    data = response.json()
    assert 'access_token' in data
    assert 'refresh_token' in data
    assert data['name'] == test_user['name']

    print("✅ TEST PASSED: User was created and can login")


def test_duplicate_user_rejected(test_user):
    """
    Test that creating a duplicate user is rejected.
    """
    print("\n" + "="*60)
    print("TEST: Duplicate User Creation")
    print("="*60)

    # Try to create a user with the same email as test_user (which already exists)
    duplicate_payload = {
        "name": "Duplicate User",
        "email": test_user['email'],  # Same email as existing test user
        "password": "DifferentPassword123"
    }

    print(f"📤 Attempting to create duplicate user: {test_user['email']}")

    response = requests.post(f"{BASE_URL}/api/signup", json=duplicate_payload)

    print(f"📥 Response status: {response.status_code}")

    # Should be rejected with 400
    assert response.status_code == 400, f"Expected 400 (duplicate), got {response.status_code}"

    response_data = response.json()
    error_message = response_data.get('message', '').lower()

    assert "already exists" in error_message or "duplicate" in error_message, \
        f"Expected 'already exists' or 'duplicate' in error message, got: {response_data.get('message', '')}"

    print(f"❌ Duplicate rejected (as expected): {response_data.get('message', '')}")
    print("✅ TEST PASSED: Duplicate user creation rejected")


def test_invalid_email_rejected():
    """
    Test that invalid email formats are rejected.
    """
    print("\n" + "="*60)
    print("TEST: Invalid Email Format")
    print("="*60)

    invalid_payload = {
        "name": "Invalid User",
        "email": "not-an-email",  # Invalid email format
        "password": "SomePassword123"
    }

    response = requests.post(f"{BASE_URL}/api/signup", json=invalid_payload)

    assert response.status_code == 400, "Invalid email should be rejected"

    print("✅ TEST PASSED: Invalid email format rejected")


def test_user_is_verified(test_user):
    """
    Test that the created user is automatically verified.
    """
    print("\n" + "="*60)
    print("TEST: User Auto-Verification")
    print("="*60)

    # If user can login, they are verified (unverified users get 401)
    login_payload = {
        "email": test_user['email'],
        "password": test_user['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)

    assert response.status_code == 200, "User should be able to login (verified)"

    print("✅ TEST PASSED: User is automatically verified")
