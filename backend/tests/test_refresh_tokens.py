"""
Test refresh token functionality using pytest.

Run tests with:
    pytest tests/test_refresh_tokens.py -v

Run with output:
    pytest tests/test_refresh_tokens.py -v -s
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

# Test configuration
BASE_URL = os.getenv('BACKEND_URL')


@pytest.fixture(scope="module")
def test_user():
    """Create a verified test user with tokens."""
    with app.app_context():
        user = create_test_user(
            name="Refresh Token Test User",
            is_verified=True,
            free_upload_used=False,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )

        yield user

        # Cleanup: Delete user and all their projects
        delete_test_user(user['email'], mongo.db)


def test_normal_login(test_user):
    """Test 1: User can login and receive both access and refresh tokens"""
    print("\n" + "="*60)
    print("TEST 1: Normal Login Flow")
    print("="*60)

    # User already has tokens from create_test_user, but let's test login again
    login_payload = {
        "email": test_user['email'],
        "password": test_user['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)

    assert response.status_code == 200, f"Login failed: {response.json()}"

    data = response.json()
    assert 'access_token' in data, "No access_token in response"
    assert 'refresh_token' in data, "No refresh_token in response"
    assert data['name'] == test_user['name'], f"Expected name {test_user['name']}, got {data['name']}"

    print("✅ TEST PASSED: User received both tokens")


def test_access_protected_route(test_user):
    """Test 2: Access token works for protected routes"""
    print("\n" + "="*60)
    print("TEST 2: Access Protected Route")
    print("="*60)

    print("🐱 User accessing protected route with access token")

    headers = {"Authorization": f"Bearer {test_user['access_token']}"}
    response = requests.get(f"{BASE_URL}/api/user/profile", headers=headers)

    assert response.status_code == 200, f"Protected route failed: {response.status_code}"

    print("✅ TEST PASSED: Access token works for protected routes")


def test_refresh_token_flow(test_user):
    """Test 3: Refresh token can be used to get new access token"""
    print("\n" + "="*60)
    print("TEST 3: Refresh Token Flow")
    print("="*60)

    print("🐱 User uses refresh token to get new access token")

    headers = {"Authorization": f"Bearer {test_user['refresh_token']}"}
    response = requests.post(f"{BASE_URL}/api/refresh", headers=headers)

    assert response.status_code == 200, f"Refresh failed: {response.json()}"

    data = response.json()
    assert 'access_token' in data, "No access_token in refresh response"

    new_access_token = data['access_token']
    print(f"✅ Received new access token: {new_access_token[:20]}...")

    # Verify new access token works
    print("🐱 User tests new access token")
    headers = {"Authorization": f"Bearer {new_access_token}"}
    response = requests.get(f"{BASE_URL}/api/user/profile", headers=headers)

    assert response.status_code == 200, "New access token doesn't work"

    print("✅ TEST PASSED: Refresh token flow works correctly")


def test_token_reuse_detection_with_rotation(test_user):
    """
    Test 4: Token Reuse Detection with Rotation - Security Test

    🐱 Legitimate User has 🔄 Refresh Token 1 and 🔑 Access Token 1.
    😈 Malicious User manages to steal 🔄 Refresh Token 1 from 🐱 Legitimate User.
    🐱 Legitimate User uses 🔄 Refresh Token 1 to get new tokens (rotation happens).
    😈 Malicious User attempts to use stolen 🔄 Refresh Token 1 (reuse detection triggers).

    Expected: Malicious user should be BLOCKED (401) with reuse detection message.
    This test verifies that token rotation and reuse detection are working correctly.
    """
    print("\n" + "="*60)
    print("TEST 4: Token Reuse Detection & Rotation")
    print("="*60)
    print("✅ This test verifies token rotation security is working")

    # Step 1: Legitimate user logs in
    print("\n🐱 Step 1: Legitimate user logs in")
    login_payload = {
        "email": test_user['email'],
        "password": test_user['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)
    assert response.status_code == 200, f"Login failed: {response.json()}"

    data = response.json()
    refresh_token_1 = data['refresh_token']
    print(f"✅ Legitimate user has 🔄 Refresh Token 1: {refresh_token_1[:20]}...")

    # Step 2: Malicious user steals token
    print("\n😈 Step 2: Malicious user steals 🔄 Refresh Token 1")
    stolen_token = refresh_token_1
    print(f"⚠️  Malicious user now has: {stolen_token[:20]}...")

    # Step 3: Legitimate user refreshes (triggers rotation)
    print("\n🐱 Step 3: Legitimate user uses 🔄 Refresh Token 1")
    print("   (This should rotate tokens and update database)")
    headers = {"Authorization": f"Bearer {refresh_token_1}"}
    response = requests.post(f"{BASE_URL}/api/refresh", headers=headers)

    assert response.status_code == 200, f"Refresh failed: {response.json()}"
    refresh_data = response.json()
    new_access_token = refresh_data['access_token']
    new_refresh_token = refresh_data['refresh_token']
    print(f"✅ Legitimate user got new 🔑 Access Token 2: {new_access_token[:20]}...")
    print(f"✅ Legitimate user got new 🔄 Refresh Token 2: {new_refresh_token[:20]}...")
    print("   (Old Refresh Token 1 is now invalidated in database)")

    # Step 4: Malicious user tries to use stolen token (should be blocked)
    print("\n😈 Step 4: Malicious user attempts to use stolen 🔄 Refresh Token 1")
    print("   (This should be detected as reuse and blocked)")
    headers = {"Authorization": f"Bearer {stolen_token}"}
    response = requests.post(f"{BASE_URL}/api/refresh", headers=headers)

    # Verify malicious user is blocked
    assert response.status_code == 401, \
        f"Expected 401 (blocked), got {response.status_code}. Token reuse was not detected!"

    response_data = response.json()
    assert 'error' in response_data, "No error message in response"
    assert 'reuse detected' in response_data['error'].lower(), \
        f"Expected 'reuse detected' message, got: {response_data.get('error', '')}"

    print("❌ Malicious user was BLOCKED with status 401")
    print(f"   Error: {response_data.get('error', 'No error message')}")
    print("✅ TEST PASSED: Token rotation and reuse detection working correctly!")


def test_invalid_refresh_token():
    """Test 5: Invalid refresh token is rejected"""
    print("\n" + "="*60)
    print("TEST 5: Invalid Refresh Token")
    print("="*60)

    print("😈 Attacker uses fake/invalid refresh token")

    fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fakepayload.fakesignature"
    headers = {"Authorization": f"Bearer {fake_token}"}
    response = requests.post(f"{BASE_URL}/api/refresh", headers=headers)

    assert response.status_code == 422 or response.status_code == 401, \
        "Invalid token should be rejected"

    print("✅ TEST PASSED: Invalid tokens are rejected")


def test_access_token_used_for_refresh(test_user):
    """Test 6: Access token cannot be used for refresh (wrong token type)"""
    print("\n" + "="*60)
    print("TEST 6: Wrong Token Type")
    print("="*60)

    # Login
    login_payload = {
        "email": test_user['email'],
        "password": test_user['password']
    }

    response = requests.post(f"{BASE_URL}/api/login", json=login_payload)
    assert response.status_code == 200, f"Login failed: {response.json()}"

    data = response.json()
    access_token = data['access_token']

    print("😈 Attacker tries to use access token for refresh endpoint")

    # Try to use access token for refresh
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(f"{BASE_URL}/api/refresh", headers=headers)

    assert response.status_code != 200, \
        "Access token should not work for refresh endpoint"

    print("✅ TEST PASSED: Access tokens cannot be used for refresh")


if __name__ == "__main__":
    print("Run tests with: pytest tests/test_refresh_tokens.py -v -s")
