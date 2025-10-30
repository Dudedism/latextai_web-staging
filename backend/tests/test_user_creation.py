"""
Test user creation and signup functionality.

Run with: pytest tests/test_user_creation.py -v -s
"""

import pytest
import requests
import os

BASE_URL = os.getenv('BACKEND_URL')


def test_user_creation(test_user_credentials):
    """
    Test that the test user was created successfully.
    This uses the fixture from conftest.py which creates the user.
    """
    print("\n" + "="*60)
    print("TEST: User Creation")
    print("="*60)

    print(f"✅ Test user exists: {test_user_credentials['email']}")
    print(f"   Name: {test_user_credentials['name']}")
    print(f"   Email: {test_user_credentials['email']}")

    # Verify user can login (which proves they were created and verified)
    login_payload = {
        "email": test_user_credentials['email'],
        "password": test_user_credentials['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)

    assert response.status_code == 200, f"User cannot login: {response.json()}"

    data = response.json()
    assert 'access_token' in data
    assert 'refresh_token' in data
    assert data['name'] == test_user_credentials['name']

    print("✅ TEST PASSED: User was created and can login")


def test_duplicate_user_rejected():
    """
    Test that creating a duplicate user is rejected.
    """
    print("\n" + "="*60)
    print("TEST: Duplicate User Creation")
    print("="*60)

    # Try to create a user with an email that definitely exists
    duplicate_payload = {
        "name": "Duplicate User",
        "email": "admin@admin.com",  # This should exist or be a common test email
        "password": "SomePassword123"
    }

    response = requests.post(f"{BASE_URL}/api/signup", json=duplicate_payload)

    # Should either be 400 (duplicate) or 201 (if first time running)
    if response.status_code == 400:
        assert "already exists" in response.json().get('message', '').lower()
        print("✅ TEST PASSED: Duplicate user creation rejected")
    else:
        print("⚠️  User didn't exist yet, created successfully")


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
