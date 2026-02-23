# Phase 1: Security Headers & Input Validation

- [ ] Add security headers to Flask responses

  `app.py` — no security headers are set. Add an `@app.after_request` handler:
  ```python
  @app.after_request
  def set_security_headers(response):
      response.headers['X-Content-Type-Options'] = 'nosniff'
      response.headers['X-Frame-Options'] = 'DENY'
      response.headers['X-XSS-Protection'] = '1; mode=block'
      response.headers['Content-Security-Policy'] = "default-src 'self'"
      return response
  ```
  Adjust the CSP policy to allow required external resources (Google OAuth, Stripe, analytics).

- [ ] Add input type validation to prevent MongoDB injection

  Multiple endpoints pass `request.get_json()` values directly into MongoDB queries without checking types. If a user sends `{"email": {"$gt": ""}}` instead of a string, it becomes a MongoDB injection. Add type checks at the start of each endpoint:
  ```python
  email = data.get('email')
  if not isinstance(email, str):
      return jsonify({'error': 'Invalid email format'}), 400
  ```
  Affected endpoints in `api_auth.py`: signup, login, verify, password reset request/confirm, change password. Affected endpoints in `api_latext.py`: upload, process, delete.

- [ ] Strengthen password requirements

  `api_auth.py` lines 115-116 and 433-434 — only require 8 characters minimum. Add complexity requirements or use a strength checker. At minimum require: 10+ characters, or 8+ with mixed case and a number. Apply the same rule in both `signup` and `change_password`.

# Phase 2: Atomicity & Race Conditions

- [ ] Make free upload check atomic

  `api_latext.py` lines 254-288 — the free upload flow first reads `free_upload_used` then later does an atomic `update_one`. A user submitting concurrent requests could pass the initial check before either update lands. Remove the non-atomic read check and rely solely on the atomic `update_one` with filter `{'email': email, 'free_upload_used': {'$ne': True}}`. If the update modifies 0 documents, the free upload was already used.

- [ ] Make credit deduction + transaction logging atomic

  `api_latext.py` lines 305-343 — three separate operations: mark project paid, deduct credits, create transaction. If the app crashes between deduction and transaction creation, the ledger becomes inconsistent. Use a MongoDB multi-document transaction (requires replica set):
  ```python
  with mongo.cx.start_session() as session:
      with session.start_transaction():
          mongo.db.projects.update_one({...}, {...}, session=session)
          mongo.db.users.update_one({...}, {...}, session=session)
          mongo.db.credit_transactions.insert_one({...}, session=session)
  ```
  If transactions aren't available (standalone MongoDB), at minimum ensure deduction happens last so a crash results in unpaid projects (recoverable) rather than lost credits (not recoverable).

# Phase 3: Logging & Audit

- [ ] Add audit logging for sensitive operations

  Create an `audit_logs` collection. Log these events with timestamp, actor email, action type, and affected resource:
  - Account deletion
  - Password changes
  - Email verification
  - Credit purchases and deductions
  - Admin actions

  Simple implementation:
  ```python
  def log_audit(action, email, details=None):
      mongo.db.audit_logs.insert_one({
          'action': action,
          'email': email,
          'details': details,
          'timestamp': datetime.datetime.utcnow()
      })
  ```

- [ ] Remove or gate debug print statements

  Multiple endpoints in `api_auth.py` and `api_latext.py` have emoji-prefixed debug prints (e.g., `print(f"\n🔍 [VERIFY] Verification request received")`). These are fine for development but should not appear in production. Either:
  - Replace with proper `logging` module calls at DEBUG level, or
  - Gate behind an environment variable: `if os.getenv('DEBUG'): print(...)`

# Phase 4: Miscellaneous

- [ ] Validate email passed to external service

  `api_latext.py` lines 81-86 and 115-120 — user email is passed as a query parameter to the LatextAI pipeline service (`params={'user_email': user_email}`). While URL encoding handles most cases, validate the email format before sending. Also consider switching to a JSON request body instead of query params for consistency.

- [ ] Use absolute paths for USER_PROJECTS_DIR

  `api_auth.py` line 454 — `USER_PROJECTS_DIR = 'user_projects'` is a relative path that resolves differently depending on where the process starts. Use:
  ```python
  USER_PROJECTS_DIR = os.path.join(os.path.dirname(__file__), 'user_projects')
  ```
  Or make it configurable via environment variable.
