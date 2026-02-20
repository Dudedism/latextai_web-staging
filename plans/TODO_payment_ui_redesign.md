# TODO: Payment UI Redesign (PreviewPage Invoice Card + CreditTopUpPage Params)

Redesign the `needs_payment` state on PreviewPage from fragmented locked-download buttons into a single unified invoice card that sells the product. Also update CreditTopUpPage to accept query parameters for seamless credit top-up flow.

Reference: `plans/design_idea_payment.png` for the visual mockup.

---

## Design Overview

The PreviewPage currently shows a sparse "Pay to Process" box, then separate "Download your files here!" and "Full Package Download" sections with greyed-out locked buttons. This is replaced by a **single invoice card** that varies by user state. The download buttons section is removed entirely for unpaid projects — downloads only appear after payment.

The invoice card has up to 5 sections stacked vertically inside one `.card`:

1. **Document metadata bar** — compact filename/template/pages/words line
2. **"What's included" checklist** — the value proposition (PDF, .tex, .bib, package)
3. **Cost breakdown** — receipt-style detail-grid with balance
4. **Promo/info box** (conditional) — free upload notice or insufficient credits warning
5. **CTA button(s)** — action appropriate to user state

---

## User States & What They See

### State A: Anonymous user viewing their 3-page preview
- **Context:** Anonymous user uploaded, processed as preview, viewing result on PreviewPage. `isAnonymous=true`, `is_preview=true`, `status='converted'`.
- **Above the card:** 3-page preview PDF in iframe + yellow "This is a 3-page preview" banner (existing).
- **Card contents:**
  - Document metadata bar (filename, template, pages, words)
  - "What's included" checklist with descriptions
  - **No cost breakdown.** Anonymous users don't see pricing — they haven't signed up yet.
  - Messaging: "Sign up to see the full PDF for free and unlock the complete LaTeX source package."
  - CTA: **"Sign Up Free"** button (`btn--primary btn--lg btn--pill`) → `/signup`

### State B: Signed-up user with free upload available
- **Context:** User signed up (merged from anon), project transferred as `paid_with_free_upload=true`. OR: verified user with `can_use_free=true` on a validated unpaid project. `isAnonymous=false`, `can_use_free=true`.
- **Card contents:**
  - Document metadata bar
  - "What's included" checklist
  - Cost breakdown with the normal receipt, BUT with a final line item "First-time promotion: −X credits" and total showing **0 credits ($0.00)**. This communicates value while making it clear they're not being charged.
  - Balance row inside the cost breakdown (informational only)
  - Blue promo box (`notice--info` style): "Your first conversion is free! No payment required."
  - CTA: **"Use Free Upload"** button (blue accent, `btn--lg btn--pill`, background `var(--accent)`)

### State C: Signed-up user with sufficient credits (no free upload)
- **Context:** `can_use_free=false`, `has_sufficient_credits=true`.
- **Card contents:**
  - Document metadata bar
  - "What's included" checklist
  - Cost breakdown receipt (base + additional pages + total)
  - Balance row inside cost breakdown, shown in **green** (`text-success`) with a checkmark
  - CTA: **"Pay X Credits"** button (green background, `btn--lg btn--pill`, custom green `#2e7d32` matching `--color-success`)

### State D: Signed-up user with insufficient credits (no free upload)
- **Context:** `can_use_free=false`, `has_sufficient_credits=false`.
- **Card contents:**
  - Document metadata bar
  - "What's included" checklist
  - Cost breakdown receipt (base + additional pages + total)
  - Balance row inside cost breakdown, shown in **red** (`text-error`) with shortfall: "Need X more credits"
  - CTA: **"Top Up Credits"** button (blue accent, `btn--lg btn--pill`, background `var(--accent)`) → `/credits?amount={credits_needed}&project_name={filename}&project_id={id}`

### State E: Preview upgrade (verified user paying for preview → full)
- **Context:** `is_preview=true`, `status='converted'`, `isAnonymous=false`, `paid=false`. This is a verified user who used a free preview and now wants to pay for the full document.
- **Same as State C or D** depending on credit balance, but the messaging says "Upgrade to Full Access" instead of "Pay to Process."
- The cost breakdown uses the same receipt format.

---

## Component Structure (PreviewPage)

### What changes

The `needs_payment` block (currently inline JSX in PreviewPage with inline styles) and the entire download section below it are replaced by a new `<InvoiceCard>` component (or inline JSX, keeping it simple).

The `needsUpgrade` block (for preview upgrades and free upload upsells) is also replaced by the same card structure.

### What stays the same

- Processing spinner state — unchanged
- Awaiting payment state — unchanged
- Completed + paid state (PDF iframe + enabled download buttons + feedback) — unchanged
- Failed state — unchanged
- Admin debug controls — unchanged

### New data requirements

The `payment-details` endpoint already returns everything needed:
- `cost_estimate.base_credits`, `cost_estimate.additional_pages`, `cost_estimate.additional_credits`, `cost_estimate.total_credits`, `cost_estimate.total_dollars`
- `can_use_free`, `credit_balance`, `has_sufficient_credits`
- `metadata.filename`, `metadata.page_count`, `metadata.word_count`, `metadata.template`

No backend changes needed for PreviewPage. The data is all there.

---

## CreditTopUpPage Changes

### New query parameters

| Param | Description | Example |
|-------|-------------|---------|
| `amount` | Pre-fill the credit input with this amount | `949` |
| `project_name` | Filename of the document that needs credits | `your_thesis.docx` |
| `project_id` | Project UUID for return navigation | `abc-123-def` |

### Behavior when params are present

1. **Pre-fill credit amount:** Set `creditAmount` state to `amount` param value on mount.
2. **Context banner:** Show a `notice--info` box at the top of the "Top Up Credits" card: "**your_thesis.docx** requires **949 credits** to process."
3. **Button text:** Change from generic "Top Up $X.XX" to "Top Up for your_thesis.docx ($X.XX)"
4. **Return navigation:** After successful top-up (`topup_success=true`), if `project_id` is in the URL, show a "Return to Document" button that navigates to `/papers/{project_id}/view`. The existing success modal can include this as the action button.

### Behavior without params

Unchanged — generic credit top-up page as it works today.

---

## CSS Changes

### New styles needed (in PreviewPage.css or a shared location)

**Invoice card container:**
- Uses existing `.card` class with `max-width: 600px`, `margin: 0 auto`
- No hover transform (not interactive in that sense)

**Document metadata bar:**
- Single line of text, centered, `--color-gray-600` text, `--fs-sm`
- Filename in `font-semibold`, rest in `font-regular`
- Background: `--color-gray-50`, padding, top border-radius matching card
- Separator dots (·) between items

**"What's included" checklist:**
- Reuse the `.pc-features` pattern from PricingCompare.css
- Blue accent checkmarks (`var(--accent)` = `#3b82f6`)
- Each item: main text + optional subtitle in `--color-gray-500` for the package description
- Left-aligned within the card, good spacing between items

**Cost breakdown:**
- Uses existing `.detail-grid` + `.detail-item` pattern
- Total row: `border-top: 2px solid var(--color-gray-300)`, `font-bold`
- Dollar amount below total in `--color-gray-400`, `--fs-sm`
- Balance row: same `.detail-item`, green or red text for the value
- Strikethrough for free upload: `text-decoration: line-through` on the total credit value, with "0 credits" next to it

**CTA button variants:**
- Green button: new `.btn--success` class — `background: var(--color-success)`, `color: white`, hover darkens
- Blue/accent button: new `.btn--accent` class — `background: var(--accent)`, `color: white`, hover darkens
- Both use existing `btn--lg btn--pill` modifiers

**Free promo box:**
- Uses existing `.notice--info` pattern (blue background, blue border)
- Contains bold text + subtitle + button

---

## Phases

# Phase 1: CSS additions

- [x] Add `.btn--success` and `.btn--accent` button variant classes to `global.css`

  `.btn--success`: background `var(--color-success)`, color white, hover `#1b5e20`. `.btn--accent`: background `var(--accent)`, color white, hover `#2563eb`. Both inherit existing `.btn` base styles.

- [x] Add invoice card styles to `PreviewPage.css`

  `.invoice-card`: max-width 600px, margin 0 auto, uses existing card border/radius/shadow. `.invoice-meta`: the document metadata bar — centered text, grey-50 background, padding 12px 20px, border-bottom 1px solid gray-200. `.invoice-meta strong`: font-semibold for filename. `.invoice-features`: the "What's included" list, replicating the `.pc-features` checkmark pattern. `.invoice-features li::before`: content "✓", color var(--accent). `.invoice-breakdown`: wrapper around `.detail-grid` within the card. `.invoice-total`: the bold total row with thicker top border. `.invoice-strikethrough`: text-decoration line-through for the free upload discount display.

# Phase 2: PreviewPage invoice card (needs_payment state)

- [x] Fetch full payment details including metadata for the invoice

  Currently `fetchPaymentDetails()` is called but the response isn't fully used. Update the `PaymentDetails` interface to include `metadata` (filename, page_count, word_count, template) and `cost_estimate` breakdown fields (base_credits, additional_pages, additional_credits). Store these in state.

- [x] Build the invoice card JSX for `needs_payment` status

  Replace the current `status === 'needs_payment'` block with the new invoice card. Sections: metadata bar, features checklist, cost breakdown detail-grid, conditional promo/CTA. The card renders inside a centered container, no inline styles — all class-based.

- [x] Implement State A (anonymous user viewing preview)

  When `isAnonymous && status === 'completed' && isPreview && !projectPaid`: show invoice card without cost breakdown, with "Sign up to see the full PDF for free" messaging and "Sign Up Free" button. This replaces the current `needsUpgrade` block for anonymous users.

- [x] Implement State B (free upload available)

  When `!isAnonymous && paymentDetails?.can_use_free`: show full invoice card with cost breakdown including strikethrough/discount line, blue promo box, "Use Free Upload" button. Wire button to existing `handleUseFreeUpload()`.

- [x] Implement State C (sufficient credits)

  When `!isAnonymous && !paymentDetails?.can_use_free && paymentDetails?.has_sufficient_credits`: show invoice card with cost breakdown, green balance row, green "Pay X Credits" button. Wire to existing `handleProcessWithCredits()`.

- [x] Implement State D (insufficient credits)

  When `!isAnonymous && !paymentDetails?.can_use_free && !paymentDetails?.has_sufficient_credits`: show invoice card with cost breakdown, red balance row with shortfall, blue "Top Up Credits" button. Button navigates to `/credits?amount={total_credits}&project_name={filename}&project_id={paperId}`.

- [x] Implement State E (preview upgrade)

  When `status === 'completed' && isPreview && !projectPaid && !isAnonymous`: same as C/D but with "Upgrade to Full Access" heading. This replaces the current `needsUpgrade` block for non-anonymous users.

# Phase 3: Remove old download sections for unpaid state

- [x] Remove "Download your files here!" and "Full Package Download" sections for unpaid projects

  The download buttons section (`content-section` with Download PDF, .tex, .bib, and Full Package) should only render when `projectPaid === true`. For unpaid projects, the invoice card is the only content below the PDF preview (or in place of it if no preview exists). Clean up the old `needsUpgrade` block entirely — its functionality is now handled by the invoice card states.

# Phase 4: CreditTopUpPage query parameter support

- [x] Read query parameters on CreditTopUpPage mount

  Read `amount`, `project_name`, `project_id` from `searchParams`. If `amount` is present and valid (>= 500), pre-fill `creditAmount` state. Store `project_name` and `project_id` in state.

- [x] Show context banner when navigated from a project

  When `project_name` is present, render a `notice--info` box above the "Top Up Credits" card: "**{project_name}** requires **{amount} credits** (${dollars}) to process." This immediately tells the user why they're here and how much they need.

- [x] Update button text for project-specific top-up

  When `project_name` is present, change the top-up button label from "Top Up ${dollars}" to "Top Up for {project_name} (${dollars})".

- [x] Add "Return to Document" after successful top-up

  When `project_id` is in the URL and `topup_success=true`, change the success modal's action button from generic "Continue" to "Return to Document" which navigates to `/papers/{project_id}/view`.

# Phase 5: Polish and edge cases

- [x] Handle payment details loading state in invoice card

  While `paymentDetails` is being fetched, show a skeleton or spinner inside the invoice card area (not the full-page LoadingScreen). The card outline can render immediately with a small spinner inside.

- [x] Responsive design for invoice card

  At mobile widths (< 768px): card goes full-width with reduced padding. Metadata bar wraps to two lines if needed. Feature list stays single-column. Cost breakdown remains readable. CTA button goes full-width.

- [x] Test all 5 states manually

  Walk through each state: (A) anonymous preview, (B) free upload, (C) sufficient credits, (D) insufficient credits → top-up flow → return, (E) preview upgrade. Verify the card renders correctly and buttons work.
