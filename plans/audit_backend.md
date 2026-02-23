# Backend Audit Findings

Audit of `backend/` changes pulled to staging on 2026-02-19.

Files reviewed: `.env.development`, `api_auth.py`, `api_latext.py`, `database.py`

---

## Critical

### Hardcoded Production Secrets in `.env.development`

Multiple production API keys and credentials are committed to the repository:

- **MONGO_URI**: MongoDB connection string with admin credentials exposed (`mongodb://admin:<hash>@staging.latext.ai:27017/latext_db`)
- **BREVO_API_KEY**: Email service API key (`xkeysib-...`)
- **STRIPE_SECRET_KEY**: Payment processing secret key (`sk_test_...`)
- **STRIPE_WEBHOOK_SECRET**: Webhook validation key (`whsec_...`)
- **LATEXTAI_API_KEY**: Microservice authentication key
- **GOOGLE_CLIENT_ID**: OAuth credentials

**Action:**
- [ ] Rotate ALL exposed credentials immediately
- [ ] Remove `.env.development` from git history using `git filter-branch` or BFG Repo-Cleaner
- [ ] Ensure `.env*` files are in `.gitignore`
- [ ] Use environment-specific secrets management going forward

---

## High

### Token Refresh Race Condition

`api_auth.py` refresh endpoint (lines ~286-340).

The token rotation implementation checks `stored_token_jti != current_token_jti` and then stores a new token in separate operations. Between checking and storing, concurrent requests with a stolen token could bypass reuse detection.

- [ ] Use atomic database transactions for JTI comparison and update
- [ ] Implement distributed locks if using multi-process deployment

### User Email Passed as Query Parameter to External Service

`api_latext.py` lines ~81-86, ~115-120. `delete_user_on_latextai` and `delete_project_on_latextai` pass user email directly as a query parameter to the latextai service.

- [ ] Validate and sanitize email before passing
- [ ] Consider using JSON body instead of query params for safer API format

### No Rate Limiting on `/verify` Endpoint

`api_auth.py` line ~190. The verification endpoint has no rate limiting, unlike `/signup` and `/login` which have `@limiter.limit("30 per minute")`. Could allow brute force of verification tokens.

- [ ] Add `@limiter.limit("5 per minute")` to the verify endpoint

---

## Medium

### Free Upload Race Condition

`api_latext.py` lines ~254-288. The free upload logic checks `free_upload_used` in one query, then atomically sets it in a separate `update_one`. A fast attacker could submit concurrent requests between the check and the atomic update.

- [ ] Remove the initial non-atomic check
- [ ] Only rely on the atomic `update_one` operation to handle check-and-set

### Same Serializer Salt for Email Verification and Password Reset

`api_auth.py` line ~589. The `URLSafeTimedSerializer` uses `EMAIL_VERIFICATION_SALT` for both email verification AND password reset tokens. These should have separate salts to prevent cross-use.

- [ ] Create separate serializers:
  ```python
  email_serializer = URLSafeTimedSerializer(SECRET_KEY, salt='email-verification')
  password_serializer = URLSafeTimedSerializer(SECRET_KEY, salt='password-reset')
  ```

### Weak Password Requirements

`api_auth.py` lines ~115-116 (signup), ~433-434 (change_password). Only requirement is 8 characters minimum. No complexity requirements.

- [ ] Implement zxcvbn or similar password strength checker
- [ ] Require minimum complexity (e.g., 12 chars OR 8 chars with mixed case/numbers/symbols)

### OAuth Tokens Passed in URL Fragment

`api_auth.py` line ~395 (login_google). Redirect URL contains tokens in the fragment: `#access_token=...&refresh_token=...`. Visible in browser history and potentially in referrer headers.

- [ ] Switch to secure HttpOnly cookies for token delivery
- [ ] Or use postMessage API to pass tokens to frontend

### Google OAuth Auto-Verification Without Explicit Consent

`api_auth.py` lines ~379-382. Google users are automatically set to `is_verified: True` without explicit user action, which bypasses the email verification flow.

- [ ] Document that Google OAuth counts as verified (intentional decision)
- [ ] Or require explicit confirmation on first OAuth login

### Missing Security Headers

`app.py`. No security headers implemented on responses.

- [ ] Add security headers in `@app.after_request`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Content-Security-Policy: default-src 'self'`

---

## Low

### Credit Transaction Not Atomic with Project Payment

`api_latext.py` lines ~305-343. Credit deduction (`User.deduct_credits`), project marking (`projects.update_one`), and transaction creation (`CreditTransaction.create`) are three separate operations. If the app crashes between them, data becomes inconsistent.

- [ ] Use MongoDB transactions (4.0+) to make all three operations atomic

### No Audit Logging for Account Deletions

`api_auth.py` lines ~440-546. Account deletion orphans the record but doesn't log the event to any audit trail.

- [ ] Create an `audit_logs` collection for sensitive operations (deletions, password changes, permission changes)

### MongoDB Injection Risk

Multiple files. String inputs from `request.get_json()` are used directly in MongoDB queries without type validation. If a user sends an object instead of a string, MongoDB operators could be injected.

- [ ] Validate input types: `assert isinstance(email, str)`
- [ ] Consider using Pydantic or Marshmallow for strict schema validation

### Hardcoded Relative File Path

`api_auth.py` line ~454. `USER_PROJECTS_DIR = 'user_projects'` is a relative path that could resolve unexpectedly in different deployment environments.

- [ ] Use absolute paths or environment variable

### Debug Print Statements in Production Code

Multiple files. Extensive `print()` logging with emoji prefixes throughout auth and processing endpoints. These go to stdout and could leak information in production logs.

- [ ] Replace with structured logging (Python `logging` module)
- [ ] Ensure sensitive data is not logged
