# Phase 1: Credential & Secret Rotation

- [ ] Remove `.env.development` from git history

  The file contains hardcoded production secrets: MongoDB URI with admin credentials, Stripe secret key, Stripe webhook secret, Brevo API key, LatextAI API key, and Google Client ID. Use `git filter-branch` or BFG Repo-Cleaner to purge the file from all commits. Add `.env*` to `.gitignore` afterward (keep a `.env.example` with placeholder values).

- [ ] Rotate all exposed credentials

  Every secret committed to the repo must be considered compromised. Rotate:
  - MongoDB admin password (in `MONGO_URI`)
  - Brevo API key (`BREVO_API_KEY`)
  - Stripe secret key (`STRIPE_SECRET_KEY`)
  - Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`)
  - LatextAI API key (`LATEXTAI_API_KEY`)
  - Google OAuth Client ID (`GOOGLE_CLIENT_ID`) — regenerate in Google Cloud Console

- [ ] Create `.env.example` with placeholder values

  Provide a template file so developers know which variables are needed without exposing real values. Example:
  ```
  MONGO_URI=mongodb://user:password@host:27017/latext_db
  STRIPE_SECRET_KEY=sk_test_...
  ```

- [ ] Move Google OAuth Client ID to environment variable in frontend

  `frontend/src/components/static/SignInPage.tsx` line 99 has the client ID hardcoded:
  ```typescript
  client_id: '720160772474-...',
  ```
  Replace with `import.meta.env.VITE_GOOGLE_CLIENT_ID`. Add the variable to `.env.development` and `.env.staging`.

# Phase 2: Token Storage & Transport

- [ ] Switch token storage from localStorage to HttpOnly cookies

  `AuthContext.tsx` stores access and refresh tokens in `localStorage`, which is accessible to any JavaScript running on the page (XSS risk). Backend change required: set tokens as HttpOnly, Secure, SameSite=Strict cookies in auth responses. Frontend change: remove `localStorage.setItem('token', ...)` and `localStorage.setItem('refreshToken', ...)`, rely on cookies being sent automatically.

  Affected files:
  - `backend/api_auth.py` — login, signup, refresh, Google OAuth responses must set cookies
  - `frontend/src/contexts/AuthContext.tsx` — remove localStorage token reads/writes
  - `frontend/src/components/static/SignInPage.tsx` — remove localStorage token handling
  - Fetch interceptor — remove manual Authorization header injection (cookies go automatically)

- [ ] Stop passing OAuth tokens in URL fragment

  `api_auth.py` line 395 redirects with tokens in the URL hash:
  ```python
  redirect_url = f"{FRONTEND_URL}/papers#access_token={access_token}&refresh_token=..."
  ```
  Tokens are visible in browser history and potentially in referrer headers. After switching to HttpOnly cookies (above), the redirect can simply go to `/papers` with tokens already set as cookies. If cookies aren't feasible yet, use a short-lived authorization code exchanged via a backend endpoint instead.

# Phase 3: Auth Endpoint Hardening

- [ ] Add rate limiting to `/verify` endpoint

  `api_auth.py` — the `/verify` endpoint has no rate limiter, unlike `/signup` (30/min) and `/login` (30/min). Add `@limiter.limit("5 per minute")` to prevent brute-force of verification tokens.

- [ ] Use separate serializer salts for email verification vs password reset

  `api_auth.py` uses the same `URLSafeTimedSerializer` (with `EMAIL_VERIFICATION_SALT`) for both email verification tokens and password reset tokens. A token generated for one purpose could potentially be used for the other. Create separate serializers:
  ```python
  email_serializer = URLSafeTimedSerializer(SECRET_KEY, salt='email-verification')
  password_serializer = URLSafeTimedSerializer(SECRET_KEY, salt='password-reset')
  ```

- [ ] Fix token refresh race condition

  `api_auth.py` lines 286-340 — the JTI comparison and new token storage are not atomic. Between checking `stored_token_jti != current_token_jti` and storing the new JTI, concurrent requests with a stolen token could pass the check. Use MongoDB's `findOneAndUpdate` with the old JTI as a filter condition so the check-and-update is a single atomic operation:
  ```python
  result = mongo.db.users.find_one_and_update(
      {'email': email, 'refresh_token_jti': current_token_jti},
      {'$set': {'refresh_token_jti': new_token_jti}},
  )
  if result is None:
      # Token was already rotated — possible theft, invalidate all
  ```
