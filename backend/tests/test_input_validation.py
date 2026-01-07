"""
Test input validation limits across all API endpoints.

Run with: pytest tests/test_input_validation.py -v -s
"""

import os
import uuid
import pytest
import requests
from pathlib import Path

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
            is_verified=True,
            free_project_id=None,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )

        yield user

        delete_test_user(user['email'], mongo.db)


class TestSignupValidation:
    """Test /api/signup input validation."""

    def test_email_too_long(self):
        """Email over 254 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Signup - Email too long (>254 chars)")
        print("="*60)

        payload = {
            "email": "a" * 250 + "@test.com",
            "password": "ValidPass123!"
        }

        response = requests.post(f"{BASE_URL}/api/signup", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Email >254 chars rejected")

    def test_password_too_long(self):
        """Password over 128 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Signup - Password too long (>128 chars)")
        print("="*60)

        payload = {
            "email": "test_pwlong@gmail.com",
            "password": "A" * 129
        }

        response = requests.post(f"{BASE_URL}/api/signup", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "128" in response.json().get('message', '')

        print("✅ TEST PASSED: Password >128 chars rejected")

    def test_password_too_short(self):
        """Password under 8 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Signup - Password too short (<8 chars)")
        print("="*60)

        payload = {
            "email": "test_pwshort@gmail.com",
            "password": "Short1!"
        }

        response = requests.post(f"{BASE_URL}/api/signup", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "8" in response.json().get('message', '')

        print("✅ TEST PASSED: Password <8 chars rejected")

    def test_missing_fields(self):
        """Missing required fields should be rejected."""
        print("\n" + "="*60)
        print("TEST: Signup - Missing fields")
        print("="*60)

        payload = {"email": "only@email.com"}

        response = requests.post(f"{BASE_URL}/api/signup", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Missing fields rejected")


class TestLoginValidation:
    """Test /api/login input validation."""

    def test_email_too_long(self):
        """Email over 254 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Login - Email too long (>254 chars)")
        print("="*60)

        payload = {
            "email": "a" * 250 + "@test.com",
            "password": "ValidPass123!"
        }

        response = requests.post(f"{BASE_URL}/api/login", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Email >254 chars rejected")

    def test_password_too_long(self):
        """Password over 128 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Login - Password too long (>128 chars)")
        print("="*60)

        payload = {
            "email": "valid@test.com",
            "password": "A" * 129
        }

        response = requests.post(f"{BASE_URL}/api/login", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Password >128 chars rejected")

    def test_missing_fields(self):
        """Missing required fields should be rejected."""
        print("\n" + "="*60)
        print("TEST: Login - Missing fields")
        print("="*60)

        payload = {"email": "only@email.com"}

        response = requests.post(f"{BASE_URL}/api/login", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Missing fields rejected")


class TestPasswordResetValidation:
    """Test password reset endpoint validation."""

    def test_request_reset_email_too_long(self):
        """Email over 254 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Request Password Reset - Email too long")
        print("="*60)

        payload = {"email": "a" * 250 + "@test.com"}

        response = requests.post(f"{BASE_URL}/api/request-password-reset", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Email >254 chars rejected")

    def test_reset_password_too_long(self):
        """New password over 128 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Reset Password - Password too long")
        print("="*60)

        payload = {
            "token": "fake_token_for_validation_test",
            "new_password": "A" * 129
        }

        response = requests.post(f"{BASE_URL}/api/reset-password", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "128" in response.json().get('error', '')

        print("✅ TEST PASSED: Password >128 chars rejected")

    def test_reset_password_too_short(self):
        """New password under 8 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Reset Password - Password too short")
        print("="*60)

        payload = {
            "token": "fake_token_for_validation_test",
            "new_password": "Short1!"
        }

        response = requests.post(f"{BASE_URL}/api/reset-password", json=payload)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "8" in response.json().get('error', '')

        print("✅ TEST PASSED: Password <8 chars rejected")


class TestChangePasswordValidation:
    """Test /api/changePassword validation."""

    def test_password_too_long(self, test_user):
        """New password over 128 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Change Password - Password too long")
        print("="*60)

        headers = {"Authorization": f"Bearer {test_user['access_token']}"}
        payload = {"new_password": "A" * 129}

        response = requests.post(f"{BASE_URL}/api/changePassword", json=payload, headers=headers)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Password >128 chars rejected")

    def test_password_too_short(self, test_user):
        """New password under 8 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Change Password - Password too short")
        print("="*60)

        headers = {"Authorization": f"Bearer {test_user['access_token']}"}
        payload = {"new_password": "Short1!"}

        response = requests.post(f"{BASE_URL}/api/changePassword", json=payload, headers=headers)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Password <8 chars rejected")


class TestProjectValidation:
    """Test project endpoint validation."""

    def test_validate_project_id_too_long(self, test_user):
        """Project ID over 36 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Validate - Project ID too long")
        print("="*60)

        headers = {"Authorization": f"Bearer {test_user['access_token']}"}
        payload = {"project_id": "a" * 37}

        response = requests.post(f"{BASE_URL}/api/latex/validate", json=payload, headers=headers)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "invalid" in response.json().get('error', '').lower()

        print("✅ TEST PASSED: Project ID >36 chars rejected")

    def test_claim_free_project_id_too_long(self, test_user):
        """Project ID over 36 chars should be rejected."""
        print("\n" + "="*60)
        print("TEST: Claim Free - Project ID too long")
        print("="*60)

        headers = {"Authorization": f"Bearer {test_user['access_token']}"}
        payload = {"project_id": "a" * 37}

        response = requests.post(f"{BASE_URL}/api/latex/claim-free", json=payload, headers=headers)

        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        print("✅ TEST PASSED: Project ID >36 chars rejected")


class TestValidInputsAccepted:
    """Test that valid inputs at the boundary are accepted."""

    @pytest.fixture(autouse=True)
    def setup_cleanup(self):
        """Clean up any test users created during boundary tests."""
        yield
        with app.app_context():
            mongo.db.users.delete_many({'email': {'$regex': '^boundary_test_'}})
            print("🧹 Cleaned up boundary test users")

    def test_password_at_min_limit(self):
        """Password exactly 8 chars should be accepted."""
        print("\n" + "="*60)
        print("TEST: Signup - Password at min limit (8 chars)")
        print("="*60)

        payload = {
            "email": f"boundary_test_pw_{uuid.uuid4().hex[:8]}@gmail.com",
            "password": "Valid12!"
        }

        response = requests.post(f"{BASE_URL}/api/signup", json=payload)

        # Should pass length validation
        if response.status_code == 400:
            msg = response.json().get('message', '').lower()
            assert "8" not in msg or "least" not in msg, "Password at 8 chars should not be rejected for length"

        print("✅ TEST PASSED: Password at 8 chars not rejected for length")


if __name__ == "__main__":
    print("Run tests with: pytest tests/test_input_validation.py -v -s")
