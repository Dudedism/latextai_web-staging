# TODO: Preview Flow — Block at Limit + Show Invoice During Processing

Two problems:
1. Users at preview limit can still walk through the upload flow, only to be rejected at the end
2. Preview processing shows a dead spinner — user should see the invoice card (their options) while the preview processes in the background

---

## Changes

### 1. Block upload page when at preview limit
- On NewPaperPage mount, check if the user can upload (preview count check)
- If at limit, redirect to `/papers?upload_limit=true`
- On YourPapersPage, show a notice when `upload_limit=true` query param is present: "You've reached the preview limit. Pay for an existing document to unlock more uploads."

### 2. PreviewPage: show invoice card during processing
- When `status === 'processing'` and the project is a preview, fetch payment details immediately and show a compact processing bar + the invoice card below it
- When processing completes → PDF preview appears above the invoice card (existing behavior)
- The full-screen spinner remains for non-preview processing (paid projects being compiled)

### 3. Update mock presets
- Add processing + invoice variants for the debug controls

---

# Phase 1: Block upload page at preview limit

- [x] Add preview limit check to NewPaperPage

  On mount, call the existing upload endpoint or a lightweight check. The simplest approach: call `GET /api/latex/can-upload` (new endpoint) that returns `{ can_upload: bool, reason?: string }`. If `can_upload=false`, redirect to `/papers?upload_limit=true`. Alternatively, count user projects client-side from YourPapersPage data, but a backend check is more reliable.

- [x] Add `GET /api/latex/can-upload` backend endpoint

  Checks preview_count for anonymous users (>= 1 → blocked) and verified users (>= 5 → blocked), plus the general 10-project limit. Returns `{ can_upload: true }` or `{ can_upload: false, reason: 'preview_limit' | 'project_limit' }`.

- [x] Show upload limit notice on YourPapersPage

  When `searchParams.get('upload_limit') === 'true'`, show a `notice--warning` box: "You've reached the upload limit. Pay for an existing document or purchase credits to continue."

# Phase 2: Show invoice card during preview processing

- [x] Fetch payment details when processing starts for preview projects

  In `checkStatus()`, when entering the processing state for a preview/anonymous project, also call `fetchPaymentDetails()` so the data is ready to render the invoice card.

- [x] Update PreviewPage rendering: processing state for previews shows compact spinner + invoice card

  When `status === 'processing'` and `(isPreview || effectiveAnonymous)`: instead of the full-screen spinner, show a compact processing indicator (small spinner + "Processing your document..." text) followed by the invoice card. The full-screen spinner remains for non-preview processing (paid projects).

- [x] Handle transition from processing → completed

  When processing finishes and status becomes `completed`, the PDF preview appears above the invoice card. The compact processing indicator disappears. This is mostly the existing behavior — just need to make sure the invoice card persists across the transition.

# Phase 3: Update mock presets

- [x] Add processing + invoice presets to debug controls

  Add: "Processing — Anonymous Preview", "Processing — Free Upload", "Processing — Has Credits", "Processing — Low Credits". These set `status='processing'`, `isPreview=true`, and appropriate payment details so the compact spinner + invoice card renders.

- [x] Remove standalone "Processing" preset or rename it

  The old "Processing..." preset becomes "Processing — Paid" (full-screen spinner, no invoice card). The new processing presets are the preview variants.
