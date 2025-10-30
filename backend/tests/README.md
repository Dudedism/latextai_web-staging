# Backend Tests

## Setup

1. Install test dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure the Flask server is running:
```bash
python app.py
```

## Running Tests

### Run all tests:
```bash
pytest tests/ -v
```

### Run with print statements visible:
```bash
pytest tests/ -v -s
```

### Run specific test file:
```bash
pytest tests/test_user_creation.py -v -s
pytest tests/test_refresh_tokens.py -v -s
```

### Run specific test:
```bash
pytest tests/test_refresh_tokens.py::test_token_reuse_no_rotation -v -s
```

## Test Structure

- **conftest.py** - Shared fixtures (test user creation, login)
- **test_user_creation.py** - Tests for user signup and verification
- **test_refresh_tokens.py** - Tests for JWT refresh token flow

## Test User

Tests use a hardcoded test user:
- Name: `TestUser_AutomatedTests`
- Email: `testuser_{random}@notarealemail.test`
- Password: Auto-generated secure password

The user is automatically created and verified before tests run.

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    cd backend
    pip install -r requirements.txt
    pytest tests/ -v
```

## Expected Results

**test_user_creation.py:**
- ✅ All tests should PASS

**test_refresh_tokens.py:**
- ✅ All tests (1-6) should PASS
- Test 4 specifically verifies that token rotation and reuse detection are working correctly
- The malicious token reuse attack should be blocked with a 401 error

## Security Features Tested

**Token Rotation:**
- Each time a refresh token is used, a new refresh token is issued
- The old refresh token is invalidated in the database

**Reuse Detection:**
- If an old (already-used) refresh token is presented, the system detects it
- All refresh tokens for that user are invalidated
- The attacker is blocked with a 401 error and security message

This implementation protects against token theft scenarios where an attacker steals a refresh token.
