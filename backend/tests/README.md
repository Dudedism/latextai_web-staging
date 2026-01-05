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
- **test_upload_race_condition.py** - Security tests for parallel upload race conditions

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

---

## Upload Race Condition Tests (test_upload_race_condition.py)

### Architecture Overview

This project has **two separate backend services**:

1. **latext-site/backend** (Flask) - Main backend with auth, user management, free upload tracking
2. **latextai** (Flask microservice) - Separate service that does document conversion

```
User → latext-site/backend → latextai service
       (/api/latex/upload)    (/api/upload)
       [Checks free_project]  [Does conversion]
```

### Security Vulnerability Being Tested

**Race Condition:** A user could spam the claim-free button to send multiple parallel requests. If the `free_project_id` check and set operations are not atomic, multiple claims could all pass the check before any sets the field.

### Test Requirements

✅ **latext-site/backend running:** `python app.py` (port 5050)
✅ **MongoDB accessible:** Tests connect to staging MongoDB
❌ **latextai NOT required:** Tests will fail when forwarding to latextai, but that's expected

### How the Tests Work

The tests send multiple simultaneous requests to `/api/latex/claim-free`:

1. Request hits latext-site/backend
2. Backend checks `free_project_id` and card verification
3. Backend attempts to forward to latextai service
4. **Test expects latextai to fail** (connection refused is fine)
5. We verify only ONE request got past the lock/check

### Running Tests

```bash
# Create test user and manually verify in MongoDB
db.users.updateOne(
  { email: /^racetest_.*@test.com$/ },
  { $set: { is_verified: true } }
)

# Run the race condition tests
pytest tests/test_upload_race_condition.py -v -s
```

### Expected Results

1. Only **1 upload** gets HTTP 200/202 or passes the free_upload check
2. Other **2 uploads** get HTTP 409 (upload in progress) or 402 (already used)
3. Race condition is prevented by the `upload_in_progress` lock
