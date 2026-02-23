# Task: Document Upload Decision Tree Audit

## Objective

Create a comprehensive decision tree that maps EVERY possible user journey through the document upload, payment, and download flow. For each terminal state, validate that:

1. The correct database fields are set on the User and Project documents
2. The correct UI is presented on PreviewPage (heading, features list, cost breakdown, CTA buttons, download locks)
3. Credits are correctly deducted (or not)
4. The `first_purchase_discount_used` flag is correctly managed
5. The `preview_count` is correctly incremented/decremented
6. The `is_preview` and `paid_with_free_upload` flags are consistent

## Context

This is a Flask/React app for document conversion (Word to LaTeX/PDF). Users upload documents, optionally pay with credits, and download results. The system has multiple user types (anonymous, unverified, verified), multiple payment states (preview, free credits, paid credits, insufficient), and multiple project states (uploaded, validated, processing, converted, failed).

We've been hitting whack-a-mole bugs because the interaction between these states isn't formally documented. This audit should produce a definitive reference.

## Reading List

Read these files IN ORDER before beginning analysis. Each file is essential.

### Core Backend Logic (read fully)

1. **`backend/database.py`** — User and Project models, `merge_anonymous_into`, `deduct_split_credits`, `get_all_balances`, `increment_preview_count`, `cleanup_expired_anonymous`
2. **`backend/utils/pricing.py`** — `calculate_cost` and `calculate_credit_split` — the core pricing engine. Understand how `access_level` is determined (`free_only` vs `full`)
3. **`backend/api_project.py`** — Upload endpoint (how `is_preview` is determined, `preview_count` increment), validate endpoint (cost calculation), `payment-details` endpoint (what it returns and when it 409s)
4. **`backend/api_latext.py`** — The critical `process_project` endpoint with ALL its branches, `_process_credit_payment` (how credits are deducted, how `paid_with_free_upload` vs `paid_with_credits` is decided), `_upgrade_preview`, and the new `unlock_full_access` endpoint
5. **`backend/api_auth.py`** — User creation paths (email signup, Google OAuth, anonymous), how `free_credit_balance` defaults to 750, inheritance from deleted accounts, anonymous merge trigger points
6. **`backend/api_credits.py`** — Credit top-up flow (Stripe checkout creation)
7. **`backend/api_stripe.py`** — Stripe webhooks for credit top-up completion and card verification setup

### Frontend Logic (read fully)

8. **`frontend/src/components/authenticated/PreviewPage.tsx`** — The main state machine. Understand: `checkStatus()` polling logic, `renderInvoiceCard()` (heading logic, feature lists, cost breakdown, CTA buttons), download section (lock states, context messaging for each `paidWithFreeUpload`/`canUnlock` branch), `handleProcessWithCredits`, `handleUnlockFullAccess`
9. **`frontend/src/components/authenticated/UploadConfirmPage.tsx`** — Upload flow: how it calls upload, validate, and conditionally calls process for previews
10. **`frontend/src/components/authenticated/CreditTopUpPage.tsx`** — Credit top-up page, how it receives `amount`/`project_id`/`return_to` params from PreviewPage

### Supporting Files (skim)

11. **`frontend/src/contexts/AuthContext.tsx`** — How `isAnonymous` is tracked, how `anonSpawn` works
12. **`frontend/src/components/authenticated/PreviewPage.css`** — CSS classes used in invoice card (`invoice-card`, `dl-section--locked`, `dl-card--locked`, etc.)

## Decision Tree Requirements

### Entry Points to Map

For each entry point, trace the FULL path through upload → validate → process → completion → download, noting every branch.

#### A. Anonymous User Flow
1. Anonymous user created (no account) → uploads document
2. Anonymous preview completes → user sees 3-page PDF
3. Anonymous user signs up (email) → merge happens → what state is the project in now?
4. Anonymous user signs up (Google OAuth) → merge happens
5. After merge: user has 750 free credits, project is `paid_with_free_upload=True`
   - What does PreviewPage show?
   - Can they download PDF? Source files?
   - What happens when they click "Unlock Full Access"?

#### B. New Signed-Up User (has 750 free credits, preview_count=0)
1. Uploads first document → `is_preview` should be true (preview_count < 5)
2. UploadConfirmPage auto-calls `/process` → preview processes
3. Preview completes → invoice card shown
4. User clicks "Use Free Credits" → `use_credits=true` sent to `/process`
   - What happens in `_process_credit_payment`?
   - Is `access_level` `free_only` or `full`?
   - Is `paid_with_free_upload` set?
   - What does `first_purchase_discount_used` become?
5. After payment: what does PreviewPage show?
   - Can they download all files or just PDF?
6. User uploads SECOND document → what's their `free_credit_balance` now? `preview_count`? `first_purchase_discount_used`?

#### C. User with 0 Free Credits, 0 Paid Credits (preview_count < 5)
1. Uploads document → `is_preview=true` (count < 5)
2. Preview processes → 3-page PDF shown + invoice card
3. Invoice card should show: "Use Credits to Unlock", cost breakdown, "Top Up Credits" button
4. User tops up credits → returns to PreviewPage
5. What happens now? Can they upgrade the preview?

#### D. User with 0 Free Credits, Has Paid Credits
1. Uploads document → `is_preview=true` or not? (depends on preview_count)
2. If preview: processes, then invoice card with "Pay X Credits"
3. If NOT preview (preview_count >= 5): needs_payment state, invoice card shown immediately
4. User clicks "Pay X Credits" → goes through credit payment
5. `access_level` should be `full` (paid credits used)
6. Full access to all downloads

#### E. User with Some Free Credits + Some Paid Credits
1. Uploads document → invoice card shows mixed split
2. Free credits applied first, then discount (if available), then paid
3. If total covered: `access_level=full` (paid credits involved), full access
4. Verify cost breakdown shows correct split

#### F. Returning User (first_purchase_discount already used)
1. Uploads new document
2. Discount should NOT appear in cost breakdown
3. `calculate_credit_split` called with `discount_available=False`

#### G. User with `paid_with_free_upload` Project (wants to unlock)
1. Project is `converted`, `paid=True`, `paid_with_free_upload=True`
2. PreviewPage shows full PDF + download section
3. Source files locked, PDF downloadable
4. Context message: "Ready to unlock?" or "Enjoying your results?" (depending on credits)
5. User clicks unlock → `/project/<id>/unlock` endpoint
6. Verify credits deducted, flags flipped, downloads unlocked

#### H. Compilation Failed Scenarios
1. `paid_with_free_upload + compilation_failed`: courtesy unlock, all source files available
2. `paid_with_credits + compilation_failed`: source files available, error message
3. Preview + compilation_failed: what happens?

#### I. Edge Cases
1. User uploads while previous upload is still processing
2. User refreshes PreviewPage during processing
3. Anonymous user hits preview limit (1), signs up, uploads again
4. User with exactly enough free credits (e.g., 499 free, cost=499)
5. User with free credits that DON'T cover cost, no paid credits, discount available
6. Two simultaneous tab sessions trying to pay for same project

### For Each Terminal State, Document

```
State: [descriptive name]
Entry path: [how user got here]

Database - User:
  - free_credit_balance: [expected value]
  - credit_balance: [expected value]
  - first_purchase_discount_used: [true/false]
  - preview_count: [expected value]

Database - Project:
  - status: [uploaded/validated/processing/converted/failed]
  - paid: [true/false]
  - is_preview: [true/false]
  - paid_with_free_upload: [true/false]
  - paid_with_credits: [true/false]
  - free_credits_used: [N]
  - paid_credits_used: [N]
  - discount_applied: [true/false]
  - discount_amount: [N]

PreviewPage UI:
  - Status shown: [processing/completed/failed/needs_payment]
  - Invoice card visible: [yes/no]
  - Invoice heading: [exact text]
  - Features list: [which variant]
  - Cost breakdown rows: [list what's shown]
  - CTA button: [exact text and action]
  - PDF visible: [yes/no, full or 3-page]
  - Downloads locked: [which ones]
  - Context message: [exact heading text]
```

## Output Format

Produce a structured Markdown document with:
1. A visual decision tree (use indented text or ASCII art)
2. A state table for every terminal state (using the template above)
3. A list of any inconsistencies found between what the code does and what should happen
4. Specific code locations (file:line) for each issue found

## Important Notes

- The `freeCredits` variable in PreviewPage.tsx uses the mock slider value when debug controls are active AND `mockAnonymous !== null`. When viewing REAL data, it uses `paymentDetails?.free_credit_balance ?? 0`.
- The `effectiveAnonymous` variable in PreviewPage.tsx uses `mockAnonymous` when it's not null, otherwise real `isAnonymous`.
- The `use_credits: true` flag was recently added to `handleProcessWithCredits` to prevent preview projects from skipping payment when the user explicitly clicks "Use Free Credits" or "Pay X Credits".
- The `payment-details` endpoint now allows `paid_with_free_upload` projects through (returns 200 instead of 409).
- Legacy fields (`free_project_id`, `free_upload_used`, `can_use_free`, `claim-free` endpoint) have been removed.
- `is_verified` is no longer required for preview uploads — all non-anonymous users get up to 5 previews.
