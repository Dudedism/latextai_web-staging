"""
Pytest configuration and shared fixtures.

This file is automatically loaded by pytest and provides fixtures
that can be used across all test files.
"""

import pytest
import requests
import uuid
import os

BASE_URL = os.getenv('BACKEND_URL')

# Hardcoded test user credentials
TEST_USER_EMAIL = f"testuser_{uuid.uuid4().hex[:8]}@gmail.com"
TEST_USER_PASSWORD = "TestPassword123!_SecureEnough"


@pytest.fixture(scope="session")
def test_user_credentials():
    """
    Test user credentials that will be used across all tests.
    Uses session scope so the same user is used for all tests.

    Email has a unique ID to avoid conflicts between test runs.
    """
    return {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }


@pytest.fixture(scope="session")
def test_user(test_user_credentials):
    """
    Create a test user that will be used for all tests.
    This runs once per test session.

    The user is automatically verified (backend sets is_verified=True by default).
    """
    print(f"\n🔧 Creating test user for session")
    print(f"   Email: {test_user_credentials['email']}")

    response = requests.post(f"{BASE_URL}/api/signup", json=test_user_credentials)

    if response.status_code == 201:
        print(f"✅ Test user created successfully")
    elif response.status_code == 400 and "already exists" in response.json().get('message', ''):
        print(f"⚠️  Test user already exists (from previous test run)")
    else:
        pytest.fail(f"Failed to create test user: {response.json()}")

    # Return credentials for use in tests
    return test_user_credentials


@pytest.fixture
def login_tokens(test_user):
    """
    Login the test user and return access and refresh tokens.
    This runs before each test that needs it.
    """
    print(f"\n🔐 Logging in as {test_user['email']}")

    login_payload = {
        "email": test_user['email'],
        "password": test_user['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)

    if response.status_code != 200:
        pytest.fail(f"Login failed: {response.json()}")

    data = response.json()
    print(f"✅ Login successful")
    print(f"   Access Token: {data['access_token'][:30]}...")
    print(f"   Refresh Token: {data['refresh_token'][:30]}...")

    return {
        "access_token": data['access_token'],
        "refresh_token": data['refresh_token']
    }
