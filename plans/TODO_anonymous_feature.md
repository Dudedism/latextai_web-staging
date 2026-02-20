# TODO: Anonymous User Feature

Implementation plan for anonymous upload, preview gating, account merge, download tiering, and payment flow relocation.

Reference: `plans/anonymous_feature_proposals.md` for full design spec.

# Phase 1: Backend — User Model & Anonymous Auth Endpoint

- [ ] Add anonymous user fields to User model in `database.py`

  Add to User constructor: `is_anonymous=False`, `anonymous_id=None`, `preview_count=0`. Anonymous users will use a synthetic email pattern `anon_{uuid}@anonymous.user` (same convention as the old implementation) so all existing email-keyed methods (token storage, upload locks, etc.) work unchanged. Add class methods: `find_by_anonymous_id(anonymous_id)`, `increment_preview_count(email)` (atomic `$inc` with `{'preview_count': {'$lt': 5}}` guard), `merge_anonymous_into(anon_email, real_user_id, real_user_email)`.

- [ ] Add `is_preview` field to Project model in `database.py`

  Add `is_preview=False` to Project constructor. Preview projects are 3-page conversions that haven't been paid for. `Project.transfer_to_user()` already exists and handles ownership transfer — no changes needed there.

- [ ] Create `POST /api/auth/anonymous` endpoint in `api_auth.py`

  Generate `anonymous_id = uuid4().hex[:16]`, construct email as `anon_{anonymous_id}@anonymous.user`. Create User record with `is_anonymous=True`. Issue JWT tokens — access token with normal expiry, refresh token with 7-day expiry (matches auto-cleanup window). Return `access_token`, `refresh_token`, `email` (the synthetic one). Rate limit: `@limiter.limit("10 per hour")` per IP.

- [ ] Update `requires_auth` decorator in `api_auth.py`

  No structural changes needed — the synthetic email pattern means `get_jwt_identity()` returns the anon email, and `User.find_by_email()` finds the anon user record. Add a `require_real_user=True` parameter (default True for backward compatibility). When True, return 403 if `user.get('is_anonymous')`. Endpoints that anonymous users can access will pass `require_real_user=False`.

# Phase 2: Frontend — Auth Foundation

- [ ] Add `isAnonymous` to AuthContext in `frontend/src/contexts/AuthContext.tsx`

  Extend `User` interface with `isAnonymous: boolean`. Add `isAnonymous` to `localStorage` key management. On cold load, check `localStorage.getItem('isAnonymous')` to restore anon state. Add `anonSpawn()` method: calls `POST /api/auth/anonymous`, stores tokens and `isAnonymous=true` in localStorage, sets user state. Include `useRef` mutex to prevent concurrent anonSpawn calls (same pattern as old implementation). Expose `isAnonymous` and `anonSpawn` in context.

- [ ] Update `clearAuthTokens()` in `frontend/src/utils/auth.ts`

  Add `isAnonymous` to the list of keys removed on logout/clear.

- [ ] Update `fetchInterceptor.ts` for anonymous token handling

  Currently redirects to `/signin` on 401 when refresh fails. For anonymous users: instead of redirecting to `/signin`, call `anonSpawn()` to create a fresh anonymous session. Add the `/api/auth/anonymous` endpoint to the `authEndpoints` exclusion list so it doesn't trigger the refresh loop.

- [ ] Auto-spawn anonymous session for unauthenticated visitors

  In `App.tsx` or `AuthContext`, when a user hits a protected route with no token and no anon session, automatically call `anonSpawn()` instead of redirecting to `/signin`. This makes the anonymous experience seamless — users never see a sign-in page unless they choose to.

# Phase 3: Anonymous Upload & CAPTCHA

- [ ] Add reCAPTCHA v2 script to `frontend/index.html`

  Use the script-tag approach (consistent with existing Google OAuth pattern). Add `<script src="https://www.google.com/recaptcha/api.js?render=SITE_KEY"></script>`. Add `VITE_RECAPTCHA_SITE_KEY` to frontend `.env.development` and `.env.staging`. Add `Window.grecaptcha` type and `ImportMetaEnv.VITE_RECAPTCHA_SITE_KEY` type to `frontend/src/vite-env.d.ts`.

- [ ] Add `RECAPTCHA_SECRET_KEY` to backend config

  Add to `backend/.env.development`, `backend/.env.staging`, and `backend/config.py` (`RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY')`).

- [ ] Create CAPTCHA verification utility in backend

  Inline in `api_auth.py` or a small utility. Simple POST to `https://www.google.com/recaptcha/api/siteverify` with `secret` and `response` params. `requests` is already installed. Return `True` if score >= 0.5 (configurable threshold).

- [ ] Update `NewPaperPage.tsx` to allow anonymous users

  Change auth guard from `!isAuthenticated → redirect /signin` to allow `isAnonymous` users through. After the anon user's first upload, grey out the upload button with "Sign up to upload more" message. Check `user.hasAnonUploaded` or fetch from backend on mount.

- [ ] Add CAPTCHA token to anonymous upload flow

  In `UploadConfirmPage.tsx` (or `NewPaperPage.tsx`), render the reCAPTCHA v2 checkbox widget for anonymous users. The user must complete the CAPTCHA before the upload button is enabled. Pass the CAPTCHA response token in the upload request body. Backend `/upload` endpoint verifies the token before processing for anonymous users.

- [ ] Update `/upload` endpoint in `api_project.py` for anonymous users

  Set `require_real_user=False` on `@requires_auth`. For anonymous users: verify CAPTCHA token, check `preview_count < 5` (or 1 for unverified), use `anon_{anonymous_id}` as directory name instead of email. For real users: existing logic unchanged.

- [ ] Mark preview projects in `/process` endpoint in `api_latext.py`

  For anonymous users and preview uploads: set `is_preview=True` on the project in the database. No changes needed to the `/api/convert` call — the pipeline always generates both the full PDF and a 3-page preview as a side effect of compilation. The website controls which version the user sees by hitting either `/api/download/pdf` (full) or `/api/download/preview` (3-page) on the pipeline service.

# Phase 4: Account Merge & Tuck-Away

- [ ] Implement merge logic in `/signup` endpoint in `api_auth.py`

  Accept optional `anon_email` in signup request body. If present: find the anonymous user, call `Project.transfer_to_user(anon_user_id, new_user_id, new_user_email)` to transfer all projects, copy `preview_count` if relevant, mark the anonymous record as merged (set `is_deleted=True`, `merged_into=new_user_id`). Then proceed with normal signup. The transferred anonymous upload becomes the new user's free upload.

- [ ] Implement tuck-away logic in `/login` endpoint in `api_auth.py`

  Accept optional `anon_email` in login request body. If present: the anonymous user's projects are NOT merged (the real account's state takes priority). Simply mark the anonymous record as deleted/orphaned. The anonymous upload is abandoned — the user logged into their existing account and doesn't need it.

- [ ] Implement merge/tuck-away for Google OAuth in `api_auth.py`

  The Google OAuth flow redirects to the backend, so the `anon_email` can't come from React state. Options: (a) pass `anon_email` as a query parameter on the OAuth `login_uri`, (b) store it in a short-lived cookie before the redirect. The backend `/auth/google` endpoint reads the anon email from whichever mechanism is chosen, then applies merge (new Google user) or tuck-away (existing Google user) logic.

- [ ] Update `SignInPage.tsx` to pass anon email on signup/login

  When `isAnonymous` is true in AuthContext, capture the anon email. On signup: include `anon_email` in the POST body. On login: include `anon_email` in the POST body. For Google OAuth: set the anon email in a cookie or query param before the OAuth redirect. Fix the `isAuthenticated` redirect guard (line ~49-53): only redirect if `isAuthenticated && !isAnonymous`, otherwise anon users get kicked off the page before they can sign up.

# Phase 5: Download Tiering & Viewing Page

- [ ] Gate download endpoints in `api_latext.py`

  `/project/<id>/pdf`: allow all authenticated users (including anonymous for preview projects — serves 3-page PDF). `/project/<id>/tex`: require `project['paid'] == True` — return 403 with `{upgrade_required: true}` otherwise. `/project/<id>/package`: same gate as `/tex`. `/project/<id>/bib`: remove or gate (users use Zotero — don't serve .bib at all, or gate behind payment).

- [ ] Move payment UI from `PaymentPage.tsx` to `PreviewPage.tsx`

  `PreviewPage.tsx` currently shows the processed document and download buttons. Add a payment/upgrade section that shows based on user state:
  - **Anonymous viewing preview**: "Sign up to see the full document for free" CTA
  - **Signed-up user viewing free upload**: Full PDF displayed + "Pay to unlock .tex and full LaTeX package" with credit/Stripe options
  - **Signed-up verified user viewing a 3-page preview**: "Pay to get the full document + source files" with credit/Stripe options
  - **Paid project**: All download buttons enabled, no upgrade CTAs

  Port the payment logic from `PaymentPage`: free upload claim, credit payment, Stripe checkout. Fetch `/api/latex/project/:id/payment-details` on this page when project is unpaid.

- [ ] Update Stripe callback URLs

  The backend creates Stripe checkout/setup sessions with a `success_url` pointing to `/papers/:id/payment?setup_success=true`. Update this to `/papers/:id/view?setup_success=true`. Port the `claimFreeAfterSetup()` logic from `PaymentPage` to `PreviewPage`.

- [ ] Deprecate `PaymentPage.tsx`

  Once all payment logic lives on `PreviewPage`, remove or redirect the `/papers/:projectId/payment` route. Update `YourPapersPage` — the "Pay" button on unpaid paper cards should navigate to `/papers/:id/view` instead of `/papers/:id/payment`. Remove `PaymentPage.tsx` if no longer needed.

# Phase 6: Anti-Abuse

- [ ] Implement disposable/temp email detection in `api_auth.py`

  On `/signup`, after email format and MX record validation (both already exist), add a check against a disposable email domain blocklist. Options: (a) use the `disposable-email-domains` npm-style list as a flat text file loaded at startup, (b) call a free API like `open.kickbox.com/v1/disposable/{domain}`, (c) install a Python package. The flat-file approach is simplest and has no external dependency. Return 400 with a clear error if detected.

- [ ] Implement stale anonymous account cleanup

  Create a MongoDB TTL index on `created_at` for anonymous users, or a scheduled cleanup job. Target: delete anonymous accounts where the refresh token hasn't been used in ~7 days. On deletion: orphan the user record (strip synthetic email, keep `_id` and `anonymous_id` for metrics), delete associated project files. This can be a simple Python script run via cron, or a Flask CLI command.

- [ ] Add rate limiting to anonymous-specific endpoints

  `POST /api/auth/anonymous`: 10 per hour per IP (already noted in Phase 1). Anonymous `/upload`: 3 per hour per IP. Anonymous `/process` (preview): 5 per day per IP. These are secondary to CAPTCHA but provide defense-in-depth.

# Phase 7: UI Polish

- [ ] Update `YourPapersPage.tsx` for anonymous users

  Allow anonymous users through the auth guard. Hide "Top Up Credits" for anon users. Replace "New Paper" with disabled state + "Sign up to upload more" after first upload. Paper cards: replace "Pay" button with "Sign up" CTA for anon users. Empty state: adjust copy for anonymous context.

- [ ] Update `AccountPage.tsx` for anonymous users

  Allow anonymous users through the auth guard. Show minimal view: "You are browsing as a guest. Sign up to access your full account." Hide email verification, password reset, and consent sections. Keep "Sign out" (reworded as "Clear session") and optionally "Delete session data."

- [ ] Update download buttons on `PreviewPage.tsx`

  Replace `alert('Please sign up to download...')` stubs (leftover from old anon implementation) with proper inline UI. For anonymous: show lock icons on .tex/.package buttons with tooltips. For signed-up unpaid: show lock icons with "Pay to unlock" messaging. For paid: all buttons enabled.

- [ ] Handle consent flow for anonymous users

  `NewPaperPage` currently checks data consent before upload. Anonymous users likely skip consent (no PII stored). When they sign up and merge, prompt consent at that point. Alternatively, show a simplified consent notice for anonymous users.

# Phase 8: Testing

- [ ] Write integration tests for anonymous auth flow

  Test in `backend/tests/`: anonymous user creation, token refresh, merge on signup, tuck-away on login, stale cleanup. Use the existing fixture pattern with try/finally cleanup.

- [ ] Write integration tests for preview upload and download tiering

  Test: anonymous upload with CAPTCHA bypass (test mode), 3-page PDF generation, preview count limits, download gating (PDF allowed, .tex blocked), payment unlocks full access.

- [ ] Manual sanity checks

  End-to-end walkthrough: land on site → auto-anon → upload → see 3 pages → sign up → see full PDF → pay → get .tex package. Verify merge, verify stale cleanup, verify temp email blocking.

# Phase 9: LatextAI Pipeline — Preview Endpoint (separate repo: latextai)

- [ ] Add 3-page preview generation to the pipeline's compilation step

  After PDF compilation, always generate a 3-page truncated copy using `pypdf` (already in requirements). Save as `output/preview.pdf` alongside `output/document.pdf`. This happens for every conversion — no flag or parameter needed.

- [ ] Add `GET /api/download/preview` endpoint to `server.py`

  Same pattern as the existing `/api/download/pdf` endpoint. Takes `user_email` and `project_id` query params, serves `output/preview.pdf` instead of `output/document.pdf`. Protected by `@require_api_key`.
