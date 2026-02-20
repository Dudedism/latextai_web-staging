# Anonymous Feature — Complete Specification

Every design decision from the discussion, organized by feature area. Includes exact page routes, component names, API endpoints, and flow sequences.

---

# 1. Anonymous Accounts

## Backend Identity
- When a user visits the site without an account, an invisible anonymous backend account is created automatically.
- Synthetic email pattern: `anon_{uuid_hex_16}@anonymous.user` — this keeps all existing email-keyed methods working (token storage, upload locks, etc.).
- The user never sees this account or email. It's purely a backend construct.
- JWT identity = the synthetic email, same as real users. All existing auth middleware works unchanged.
- Created via new endpoint: `POST /api/auth/anonymous`. Returns `{access_token, refresh_token, email, is_anonymous: true}`.

## Auto-Spawn Behavior
- `App.tsx` (`AppContent`) currently has a `NO_ANON_ROUTES` list. When a user hits an authenticated-area route (e.g. `/papers/new`) with no token and auth has finished loading, `anonSpawn()` fires automatically.
- This means the user never sees a sign-in page unless they actively choose to sign up or log in.
- `anonSpawn()` lives in `AuthContext.tsx` with a `useRef` mutex to prevent concurrent calls creating multiple anonymous users (same pattern as old implementation).

## Token Lifetimes
- Access token: normal expiry (same as real users).
- Refresh token: 7-day expiry (matches the stale cleanup window).
- If the refresh token is not used within ~1 week, the anonymous account is auto-deleted.

## UI Access
- Anonymous users can access ALL pages: Your Papers (`/papers`), Account (`/account`), upload flow (`/papers/new`), everything.
- Nothing is greyed out or gated at the page level. The gates are on specific actions (upload limits, download types).
- Gates may be added later if needed, but the default is fully open.

## Stale Cleanup
- Anonymous accounts where the refresh token hasn't been used in ~1 week are auto-deleted.
- Deletion is an orphan operation: PII is stripped, but the record and key metrics are preserved for analytics.
- Project files on the pipeline service are also cleaned up via `delete_project_on_latextai()` / `delete_user_on_latextai()`.
- Implementation: MongoDB TTL index or a cron/CLI script.

---

# 2. Upload & Processing Flows

There are two distinct flows depending on user state. Both share the same pages but diverge at the processing/payment step.

## Current Pages in the Flow (routes from `App.tsx`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/papers/new` | `NewPaperPage` | Pick file + pick template |
| `/papers/upload-confirm` | `UploadConfirmPage` | Confirm details, trigger upload + validate + (optionally) process |
| `/papers/:id/view` | `PreviewPage` | View processed document, download, payment/upgrade CTAs |
| `/papers` | `YourPapersPage` | List all user's papers |
| `/credits` | `CreditTopUpPage` | Buy credits via Stripe |
| `/papers/:projectId/payment` | `PaymentPage` | **DEPRECATED** — will redirect to `/papers/:id/view` |

---

## Flow A: Anonymous User (first-time visitor, no account)

### Step 1 — Pick file and template
**Page:** `NewPaperPage` (`/papers/new`)

User selects a `.docx` file (drag-and-drop or file picker), then picks a template from `ChooseTemplatePage`. For anonymous users, the data consent check (`GET /api/user/data-consent`) is skipped entirely — `handleTemplateSelect` immediately navigates forward.

**Navigation:** `navigate('/papers/upload-confirm', { state: { file, templateId, templateName } })`

### Step 2 — Confirm and process
**Page:** `UploadConfirmPage` (`/papers/upload-confirm`)

Shows filename and template name. User sees a reCAPTCHA v2 checkbox ("I'm not a robot") — must complete it before "Confirm Upload" is enabled. User clicks "Confirm Upload", which triggers `handleConfirmUpload()`:

1. **Upload:** `POST /api/latex/upload` with `FormData { file, template, captcha_token }` → returns `{ project_id }`
2. **Validate:** `POST /api/latex/validate` with `{ project_id }` → returns `{ page_count, word_count, cost_estimate, can_use_free }`. Page count and word count are displayed to the user during the loading overlay.
3. **Process (anonymous fast-path):** Because the user is anonymous, there is no payment step. `POST /api/latex/process` with `{ project_id }` is called immediately. The backend marks the project `is_preview=True` and sends it to the pipeline.

A full-screen loading overlay shows progress through stages: "Uploading..." → "Validating..." → "Processing..." → green success state.

**Navigation:** `navigate('/papers/${projectId}/view')`

### Step 3 — View preview and sign-up prompt
**Page:** `PreviewPage` (`/papers/:id/view`)

`checkStatus()` polls `GET /api/latex/project/${paperId}` until `status === 'converted'`. While processing, user sees a spinner ("Processing Your Document..."). All download buttons are greyed out / disabled during processing.

Once processing completes (`status === 'converted'`):
- `fetchPdf()` calls `GET /api/latex/project/${paperId}/pdf` which proxies to the pipeline's `/api/download/pdf-preview` endpoint (because `is_preview === true`). The 3-page preview PDF is rendered in an `<iframe>`.
- **Preview PDF download is allowed.** The 3-page preview is already visible in the iframe (with a built-in save button), so blocking downloads is pointless.
- **The .tex, .bib, and package buttons show lock icons** — these remain locked for anonymous users.
- A prominent sign-up component is displayed: **"Sign up to receive the full PDF download for free"** with a button navigating to `/signup`.

### Step 4 — User signs up
**Page:** `SignInPage` (`/signup`)

User creates an account (email + password). The frontend passes `anon_email` (from `AuthContext.isAnonymous` state) in the signup `POST /api/signup` request body. The backend:
1. Creates the real user account.
2. Calls `Project.transfer_to_user(anon_user_id, real_user_id, real_user_email)` — transfers the anonymous project.
3. Marks the anonymous record as deleted (`is_deleted=True`, `merged_into=real_user_id`).
4. The transferred project becomes the user's free upload. Its `is_preview` flag is set to `False` and `paid_with_free_upload` is set to `True`.
5. Returns tokens for the new real account.

**Navigation:** After signup, user is redirected to `/papers` (or `/papers/${projectId}/view`).

### Step 5 — User views their free upload
**Page:** `PreviewPage` (`/papers/:id/view`)

The project is now a full upload (`is_preview=False`, `paid_with_free_upload=True`). `fetchPdf()` calls `GET /api/latex/project/${paperId}/pdf` which now proxies to the pipeline's `/api/download/pdf` endpoint (full document).

- **PDF download button is enabled.** User can download the full compiled PDF.
- **All other download buttons (.tex, .bib, package) remain locked.** A component is shown: "Pay to unlock .tex and full LaTeX package."
- The feedback section (thumbs up/down) is visible since the document is complete.

**This is the end of the free flow.** The user has their full PDF. To get the .tex source or to upload another document, they must pay.

---

## Flow B: Signed-Up User (all subsequent uploads after the free one)

### Step 1 — Pick file and template
**Page:** `NewPaperPage` (`/papers/new`)

Same as Flow A, except:
- No reCAPTCHA needed (signed-in users skip it).
- Data consent check runs: `GET /api/user/data-consent`. If consent is `null` or `false`, the `ConsentModal` is shown.

**Navigation:** `navigate('/papers/upload-confirm', { state: { file, templateId, templateName } })`

### Step 2 — Confirm upload (NO processing yet)
**Page:** `UploadConfirmPage` (`/papers/upload-confirm`)

Shows filename, template name, page count, word count, and cost estimate. For signed-up users, `handleConfirmUpload()` does:

1. **Upload:** `POST /api/latex/upload` with `FormData { file, template }` → returns `{ project_id }`
2. **Validate:** `POST /api/latex/validate` with `{ project_id }` → returns metadata + cost estimate.
3. **No processing.** Unlike the anonymous flow, processing does NOT happen here. The document is uploaded and validated but not processed. The user must pay first.

**Navigation:** `navigate('/papers/${projectId}/view')`

### Step 3 — View document and pay
**Page:** `PreviewPage` (`/papers/:id/view`)

`checkStatus()` finds `status === 'validated'` and `paid === false`. The page:
- Fetches payment details: `GET /api/latex/project/${paperId}/payment-details` → returns `{ cost_estimate, can_use_free, credit_balance, has_sufficient_credits }`.
- Shows document metadata (filename, template, page count, word count, cost).
- **All download buttons are greyed out / locked.** No PDF to show yet — document hasn't been processed.
- A prominent payment component is displayed: **"Pay to process your document and get the full PDF + all downloads"** showing the cost in credits.

Payment options in the component:
- **"Pay N Credits"** button (if `has_sufficient_credits === true`): calls `POST /api/latex/process` with `{ project_id }`. The `/process` endpoint handles credit deduction atomically, marks project `paid=True`, and sends to the pipeline. Page transitions to processing spinner.
- **"Top Up Credits"** button (if `has_sufficient_credits === false`): `navigate('/credits')`. The credits page shows how much the document costs and lets the user buy credits via Stripe. After purchasing, the user returns to `/papers/:id/view` (via `?payment_success=true` or by navigating back from `/credits`).

### Step 4 — Processing and viewing
**Page:** `PreviewPage` (`/papers/:id/view`)

After payment + process call, `checkStatus()` polls until `status === 'converted'`. Spinner shown during processing. Once complete:

- `fetchPdf()` calls `GET /api/latex/project/${paperId}/pdf` → full PDF rendered in `<iframe>`.
- **All download buttons are enabled:**
  - Download PDF → `GET /api/latex/project/${paperId}/pdf`
  - Download .tex → `GET /api/latex/project/${paperId}/tex`
  - Download .bib → `GET /api/latex/project/${paperId}/bib`
  - Download Full Package → `GET /api/latex/project/${paperId}/package`
- Feedback section (thumbs up/down) is visible.

---

## Flow C: Verified User Preview Uploads (the 5 free previews)

Same as Flow A steps 1-3 but for a verified signed-up user (not anonymous). The key differences:

- No reCAPTCHA needed.
- Consent check runs.
- `UploadConfirmPage` calls `/process` immediately (same as anonymous fast-path) because this is a preview — no payment needed.
- The project is marked `is_preview=True`.
- On `PreviewPage`, user sees the 3-page preview with: **"Pay to get the full document + source files"**.
- If user pays, the project is upgraded: `is_preview` set to `False`, `paid=True`. Full PDF and all downloads become available.
- Preview count is tracked: `User.preview_count` incremented atomically with a `{'preview_count': {'$lt': 5}}` guard.

---

# 3. Preview System

## 3-Page Preview
- Anonymous users and verified users doing preview uploads see only the first 3 pages of the converted document.
- The preview is generated on the latextai pipeline side: after compilation, `pypdf` truncates the full PDF to 3 pages and saves as `output/preview_document.pdf`.
- The website backend controls which version the user sees: when `is_preview === true`, `GET /api/latex/project/:id/pdf` proxies to the pipeline's `/api/download/pdf-preview`. When `is_preview === false`, it proxies to `/api/download/pdf`.
- Anonymous users can see the preview in the `<iframe>` on PreviewPage but cannot download it. Signed-up users can download the preview PDF.

## Preview Limit Accounting
- Up to 5 successfully compiled previews max per verified user.
- Only successful compilations count. If a preview fails, it doesn't count against the 5.
- If a user pays for a preview (upgrading it to a full upload), it no longer counts against the 5 preview limit.
- The initial free upload (from anonymous merge) is classified as a full upload, not a preview. It does not count against the 5.
- Total possible for a verified user: 1 free full + 5 previews + unlimited paid.

## Preview Availability by Tier
- Anonymous: 1 upload, always a preview (3 pages). Cannot download.
- Signed up (unverified): 0 additional uploads. Only the merged free upload (now full).
- Signed up (verified): up to 5 additional preview uploads. Can download preview PDFs.
- Paid: unlimited full uploads. All downloads.

---

# 4. Download Tiering

## What Each Tier Gets

| Tier | View PDF in browser | Download PDF | Download .tex | Download .bib | Download package |
|------|-------------------|-------------|--------------|--------------|-----------------|
| Anonymous (preview) | 3-page preview | Yes (preview only) | No | No | No |
| Signed up, free upload | Full PDF | Yes | No | No | No |
| Signed up, preview upload | 3-page preview | Yes | No | No | No |
| Paid | Full PDF | Yes | Yes | Yes | Yes |

## .bib
- .bib is included for paid uploads. Users often use Zotero, but having the .bib as part of the paid package adds value.

## Payment Reframing
- Payment is NOT framed as "pay to get your document" (feels like ransom).
- Payment IS framed as "pay for the editable LaTeX source package" (feels like a premium feature).
- Casual users who just want a nice-looking PDF for a preprint server get it for free on signup.
- Power users who want .tex to tweak locally are the natural paying customers — they know LaTeX and are doing this regularly.

## Backend Download Endpoint Gating (`api_latext.py`)

| Endpoint | Anonymous | Free upload (signed up) | Preview (signed up) | Paid |
|----------|-----------|------------------------|--------------------|----|
| `GET /project/:id/pdf` | Serves preview PDF (3-page) via pipeline `/api/download/pdf-preview` | Serves full PDF via pipeline `/api/download/pdf` | Serves preview PDF via pipeline `/api/download/pdf-preview` | Serves full PDF via pipeline `/api/download/pdf` |
| `GET /project/:id/tex` | 403 | 403 | 403 | Serves .tex |
| `GET /project/:id/bib` | 403 | 403 | 403 | Serves .bib |
| `GET /project/:id/package` | 403 | 403 | 403 | Serves .zip |

The `/pdf` endpoint checks `project['is_preview']` to decide which pipeline endpoint to proxy to. The `/tex`, `/bib`, `/package` endpoints check `project['paid'] == True`.

---

# 5. Payment Flow Changes

## Old Flow (being removed)
1. `UploadConfirmPage` → navigates to `PaymentPage` (`/papers/:projectId/payment`)
2. `PaymentPage` shows cost, three options: free upload, credits, Stripe top-up
3. For free uploads: Stripe SetupIntent (card on file) → redirect back with `?setup_success=true` → `claimFreeAfterSetup()` → process
4. For credits: `POST /api/latex/process` directly
5. For Stripe: `navigate('/credits')` → buy credits → return
6. On success: `navigate('/papers/${projectId}/view')`

**Problems:** Users see a Stripe page when using free credits → confusion → drop-offs. Separate payment page creates a context switch away from the document.

## New Flow
- **`PaymentPage` is deprecated.** Route `/papers/:projectId/payment` redirects to `/papers/:id/view`.
- **No Stripe SetupIntent for free uploads.** The free upload (from anonymous merge) is claimed automatically during the signup merge — no card on file needed.
- **Payment UI lives on `PreviewPage`.** The user sees their document (or placeholder if not yet processed) alongside the payment/upgrade component.
- **Credits page (`/credits`)** is where users go to buy credits. The PreviewPage shows "Top Up Credits" which navigates to `/credits`. After purchasing, user returns to the view page.

## PreviewPage CTA Components (by state)

These are rendered on `PreviewPage` (`/papers/:id/view`) based on the project and user state:

### Anonymous, viewing 3-page preview (`is_preview=true`, `isAnonymous=true`)
- 3-page PDF shown in `<iframe>`.
- All download buttons disabled/locked.
- Component: **"Sign up to receive the full PDF download for free"**
- Button: "Sign Up Free" → `navigate('/signup')`

### Signed-up user, viewing free upload (`is_preview=false`, `paid_with_free_upload=true`)
- Full PDF shown in `<iframe>`.
- PDF download button enabled.
- .tex, .bib, package buttons locked.
- Component: **"Pay to unlock .tex and full LaTeX package"**
- Shows cost in credits.
- Button: "Pay N Credits" (if sufficient) or "Top Up Credits" → `navigate('/credits')`

### Signed-up verified user, viewing unpaid preview (`is_preview=true`, `isAnonymous=false`)
- 3-page PDF shown in `<iframe>`.
- Preview PDF download button enabled.
- .tex, .bib, package buttons locked.
- Component: **"Pay to get the full document + source files"**
- Shows cost in credits.
- Button: "Pay N Credits" (if sufficient) or "Top Up Credits" → `navigate('/credits')`

### Signed-up user, validated but not yet processed (`status='validated'`, `paid=false`)
- No PDF to show — document hasn't been processed yet.
- All download buttons disabled.
- Component: **"Pay to process your document"**
- Shows cost in credits, page count, word count.
- Button: "Pay N Credits" (if sufficient) → `POST /api/latex/process` → transitions to processing spinner
- Button: "Top Up Credits" (if insufficient) → `navigate('/credits')`

### Paid project, processing (`status='processing'`)
- Spinner: "Processing Your Document..."
- All download buttons disabled.

### Paid project, completed (`status='converted'`)
- Full PDF shown in `<iframe>`.
- All download buttons enabled: PDF, .tex, .bib, package.
- Feedback section (thumbs up/down) visible.
- No payment CTAs.

## Credits Page Flow
- User arrives at `/credits` (`CreditTopUpPage`) from PreviewPage's "Top Up Credits" button.
- The credits page should show/communicate how many credits the user's pending document costs so they can buy the right amount.
- After purchasing credits via Stripe checkout, user is redirected back. They navigate to their paper's view page and can now click "Pay N Credits".

## YourPapersPage Changes
- Paper cards navigate to `/papers/:id/view` for all states (already implemented — comment says "payment UI is now on PreviewPage").
- "New Paper" button: disabled with "Sign Up to Upload More" if `isAnonymous && papers.length > 0`.
- "Top Up Credits" button: hidden for anonymous users.

---

# 6. Account Merge & Tuck-Away

## Merge (on signup)
- When an anonymous user signs up, the frontend passes `anon_email` (the synthetic anonymous email) in the `POST /api/signup` request body.
- Backend finds the anonymous user via `User.find_by_email(anon_email)`.
- Calls `Project.transfer_to_user(anon_user_id, real_user_id, real_user_email)` to transfer all projects.
- The transferred anonymous upload's `is_preview` is set to `False` and `paid_with_free_upload` is set to `True` — it becomes the user's free upload.
- Copies `preview_count` from anonymous record to the new user.
- Marks the anonymous record as deleted (`is_deleted=True`, `merged_into=real_user_id`).
- Invalidates the anonymous user's refresh tokens via `User.invalidate_refresh_token(anon_email)`.
- Returns new account tokens. Frontend clears anon state and sets real user state.

## Tuck-Away (on login to existing account)
- When an anonymous user logs into an existing account, the frontend passes `anon_email` in the `POST /api/login` request body.
- The anonymous user's projects are NOT merged. The existing account's state takes priority.
- The anonymous record is marked as deleted/orphaned (`is_deleted=True`).
- The anonymous upload is abandoned.
- The user's existing account is unaffected.

## Google OAuth Merge
- Deferred. Will address later.
- Complication: OAuth redirects go through the backend (`POST /api/auth/google` → 302 redirect to `FRONTEND_URL/papers#access_token=...`), so the `anon_email` can't come from React state directly. Will need a cookie or query parameter mechanism.

## Frontend Merge Handling (`SignInPage` at `/signin` or `/signup`)
- `SignInPage` reads `isAnonymous` and the anon email from `AuthContext`.
- On signup form submit: includes `anon_email` in the POST body.
- On login form submit: includes `anon_email` in the POST body.
- The redirect guard at the top of `SignInPage` (which redirects authenticated users away) must be updated: only redirect if `isAuthenticated && !isAnonymous`, otherwise anon users get kicked off the page.

---

# 7. Verification

## Timing
- Verification does NOT gate the free upload. User signs up → immediately sees full PDF.
- A verification nag/banner is shown but doesn't block anything.
- Verification is required for:
  - Additional preview uploads (the 5-preview allowance)
  - Password reset (`POST /api/request-password-reset` already requires verified email)
  - Future features (newsletters, etc.)

## Rationale for Keeping Verification
- Password reset is useless without verified email.
- Newsletter/marketing emails to verified addresses is valuable long-term.
- Combined with 10-minute email detection, it catches almost all throwaway signups.
- The cost to the user is ~10 seconds — anyone who just saw their document converted is willing to do that.
- People who never verify were never going to become paying customers anyway.

## Google OAuth
- Google OAuth users are verified by default (Google already verified their email). The `User` constructor defaults `is_verified=True` and the Google OAuth endpoint doesn't override this.
- They skip the verification step entirely.

---

# 8. Anti-Abuse

## Google reCAPTCHA v2 (checkbox)
- Required only for anonymous uploads. Signed-in users don't need it.
- Visible checkbox widget ("I'm not a robot"). User must complete it before the "Confirm Upload" button is enabled on `UploadConfirmPage`.
- Doubles as a trust signal — users see Google branding and feel the site is legitimate.
- Frontend: script tag in `index.html` (same pattern as existing Google OAuth script). No npm package needed. Type `window.grecaptcha` in `vite-env.d.ts`.
- Backend verification: `POST https://www.google.com/recaptcha/api/siteverify` with `{ secret: RECAPTCHA_SECRET_KEY, response: captcha_token }` using existing `requests` library. Called in `POST /api/latex/upload` when `user.get('is_anonymous')`.
- The `captcha_token` is appended to the upload `FormData` by `UploadConfirmPage`.

## Disposable / 10-Minute Email Detection
- Checked on signup at `POST /api/signup` (not on anonymous account creation, since anon accounts have no real email).
- Implemented as a flat-file domain blocklist loaded at startup. No external API dependency.
- Applied after the existing email regex format check and MX record DNS validation (both already in `api_auth.py` `/signup`).
- Returns 400 with clear error if a disposable domain is detected.

## Rate Limiting
- `POST /api/auth/anonymous`: `@limiter.limit("10 per hour")` per IP.
- Anonymous `POST /api/latex/upload`: tightened beyond default.
- Anonymous `POST /api/latex/process`: tightened beyond default.
- These are secondary to CAPTCHA but provide defense-in-depth.
- Existing rate limits on `/signup` (30/min) and `/login` (60/min) remain.

## Stale Anonymous Cleanup
- See section 1 (Anonymous Accounts) above.

---

# 9. LatextAI Pipeline Changes (separate repo: `latextai`)

## Preview PDF Generation
- After PDF compilation in the pipeline, always generate a 3-page truncated copy using `pypdf` (already in pipeline requirements).
- Save as `output/preview_document.pdf` alongside `output/document.pdf`.
- This happens for every conversion automatically — no flag or parameter needed from the website's `/api/convert` call.

## Preview Download Endpoint (IMPLEMENTED)
- `GET /api/download/pdf-preview` on the pipeline's Flask server (`server.py`).
- Same pattern as the existing `/api/download/pdf` endpoint.
- Takes `user_email` and `project_id` query params.
- Serves `output/preview_document.pdf` instead of `output/document.pdf`.
- Protected by `@require_api_key`.

## No Changes to /api/convert
- The `/api/convert` endpoint is unchanged. No `preview` flag is passed.
- The website backend (`api_latext.py`) controls which pipeline download endpoint to proxy based on the project's `is_preview` field in MongoDB.

---

# 10. Environment & Configuration

## New Environment Variables
- Backend `.env.development` / `.env.staging`: `RECAPTCHA_SECRET_KEY`
- Backend `config.py`: `RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY')`
- Frontend `.env.development` / `.env.staging`: `VITE_RECAPTCHA_SITE_KEY`

## New Type Definitions (`frontend/src/vite-env.d.ts`)
- `Window.grecaptcha` type for reCAPTCHA v2 API (`render`, `getResponse`, `reset`)
- `ImportMetaEnv.VITE_RECAPTCHA_SITE_KEY`
- Should also type the existing untyped variables: `VITE_BACKEND_URL`, `VITE_FRONTEND_URL`

## No New npm Packages
- reCAPTCHA uses the script-tag approach (consistent with existing Google OAuth pattern in `index.html`).

## No New pip Packages for reCAPTCHA
- Backend verification uses existing `requests` library.

## Disposable Email Blocklist
- Either a flat text file loaded at startup, or a small pip package. No external API calls.

---

# 11. Database Changes

## User Model (`database.py` — `User` class)

New fields in constructor:
- `is_anonymous=False` — boolean, marks anonymous accounts
- `anonymous_id=None` — string, the 16-char hex identifier (unique)
- `preview_count=0` — int, tracks how many preview uploads the user has done

New class methods:
- `find_by_anonymous_id(cls, anonymous_id)` — query `{'anonymous_id': anonymous_id, 'is_anonymous': True, 'is_deleted': {'$ne': True}}`
- `increment_preview_count(cls, email)` — atomic `$inc` with condition `{'preview_count': {'$lt': 5}}`, returns new count or None if limit hit
- `merge_anonymous_into(cls, anon_email, real_user_id, real_user_email)` — calls `Project.transfer_to_user()`, copies `preview_count`, marks anon record deleted

## Project Model (`database.py` — `Project` class)

New field in constructor:
- `is_preview=False` — boolean, marks 3-page preview projects

No new class methods needed — `transfer_to_user()` already handles ownership transfer.

## Auth Decorator (`api_auth.py` — `requires_auth`)

New parameter:
- `allow_anonymous=False` — when `False` (default), returns 403 if `user.get('is_anonymous')`. Endpoints that anonymous users can access pass `allow_anonymous=True`.

---

# 12. Old Implementation Reference

The anonymous feature was previously implemented and then removed. Key commits:

| Commit | Date | What |
|--------|------|------|
| `3d875046` | Oct 31, 2025 | Original: client-generated key, stub merge, "tuck away" on delete |
| `f7dcc6c3` | Nov 2, 2025 | Major refactor: server-generated keys, full merge logic, AuthContext with isAnonymous |
| `f0d8f0d0` | Nov 2, 2025 | Race condition fix: anonSpawn deduplication with useRef, waitForToken polling |
| `1ce9ccea` | Nov 2, 2025 | Pre-removal cleanup: explicit marker commit |
| `5734a204` | Nov 3, 2025 | Complete removal of all anonymous functionality |

Key patterns from the old implementation that are being reused:
- Synthetic email pattern: `anon_{hex}@anonymous.user`
- `useRef` mutex on `anonSpawn()` to prevent concurrent calls
- `Project.transfer_to_user()` for merge (still exists in codebase)
- Tuck-away on login (orphan the anon record, don't merge)

Key differences from the old implementation:
- 3-page preview gating (old had no preview — full or nothing)
- Download tiering (.tex/.bib/package behind paywall — old had no tiering)
- Payment on the viewing page (old still used separate payment flow)
- reCAPTCHA v2 (old had no CAPTCHA)
- Disposable email detection (old had none)
- Preview count system (old had no concept of multiple previews)
- Stale cleanup with TTL (old had no auto-cleanup)
- Anonymous users cannot download preview PDF (old allowed full download)
