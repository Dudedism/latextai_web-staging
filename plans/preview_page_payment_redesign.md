# PreviewPage Payment State — Design Vision

The PreviewPage (`/papers/:id/view`) is the central page users see after uploading a document. When the document is validated but not yet paid for, the page currently shows a fragmented layout: a basic payment box at the top, then separate "Download your files here!" and "Full Package Download" sections with greyed-out locked buttons below.

This redesign consolidates everything into a single invoice-style card that sells the product.

---

## Current Problems

1. The payment card and download sections are disconnected — two separate visual blocks with no cohesion.
2. Greyed-out download buttons with "(Locked)" labels feel punitive, not aspirational.
3. No cost breakdown — just a single "499 credits ($4.99)" line. The old PaymentPage had a proper receipt; this lost it.
4. "Download your files here!" is generic and doesn't sell anything.
5. "Full Package Download" is a separate section describing what's in the package, but it should be part of the pitch, not a footnote.

## Design Principles

- **Sell, don't gate.** Show what the user will receive, not what's locked.
- **One card, one action.** Everything the user needs to decide and act is in one place.
- **Receipt aesthetic.** Clean label-value rows, right-aligned numbers, separator lines. Familiar invoice language.
- **Value before price.** The "what's included" list comes before the cost breakdown.

---

## Card Structure (top to bottom)

### 1. Document Metadata (compact header)

A single line of grey secondary text at the top of the card. Not a grid, not a section — just context.

```
your_thesis.docx  ·  IEEE Template  ·  24 pages  ·  12,400 words
```

Uses `--fs-sm`, `--color-gray-500`. Dot-separated. Mirrors the compact metadata style from paper cards on YourPapersPage.

### 2. What's Included (value proposition)

A checklist of deliverables using the `pc-features` pattern (blue checkmarks). This is the hero of the card — the part that sells.

```
What's included

✓  Professionally compiled PDF document
✓  Editable LaTeX source file (.tex)
✓  Bibliography file (.bib)
✓  Complete compilation package
   Source files, extracted images, PDF, and all build files
```

Each item is a single row. The last item has a sub-description in lighter text. Checkmarks use `--accent` blue.

### 3. Cost Breakdown (receipt)

Uses the existing `detail-grid` + `detail-item` pattern. Grey background (#fafafa), rounded corners, label-value rows with border-bottom separators.

```
Cost Breakdown

Base conversion (up to 15 pages)       499 credits
Additional pages (9 × 50)              450 credits
────────────────────────────────────────────────────
Total                                  949 credits
                                       ($9.49)
```

- Labels left-aligned in `--color-gray-500`, values right-aligned in `--color-black`
- Total row: `font-bold`, `border-top: 2px solid var(--color-gray-300)`
- Dollar amount on a second line below the credit total, smaller text, `--color-gray-400`
- For documents ≤15 pages, only one row: "Base conversion (up to 15 pages) — 499 credits"

### 4. Credit Balance (conditional)

Only shown for signed-in users with an existing credit balance. A single row below the receipt:

```
Your balance                          1,200 credits   (green)
```

If insufficient credits:
```
Your balance                            200 credits   (red)
You need 749 more credits
```

Uses `text-success` / `text-error` classes for the balance color.

### 5. Free Upload Callout (conditional)

When `can_use_free === true`, show a `notice--info` style callout inside the card:

```
┌─ notice--info ─────────────────────────────────────────┐
│  Your first conversion is free!                        │
│  No payment required.                                  │
│                                                        │
│  [ Use Free Upload ]  (btn--primary btn--lg btn--pill) │
└────────────────────────────────────────────────────────┘
```

When `can_use_free` is true, the cost breakdown is still shown but with a visual indicator that the user won't be charged (e.g. a strikethrough on the total, or a "FREE" badge). This communicates value — "this would normally cost $9.49."

### 6. CTA Buttons

At the bottom of the card:

- **Sufficient credits:** `btn--primary btn--lg btn--pill` → "Pay 949 Credits"
- **Insufficient credits:** `btn--outline btn--lg btn--pill` → "Top Up Credits" (navigates to `/credits`)
- **Free upload available:** The CTA is inside the free upload callout above; no separate button needed.

---

## What Disappears (pre-payment state only)

These elements are removed from the `needs_payment` state:

- "Download your files here!" heading
- Individual download buttons (PDF, .tex, .bib) with "(Locked)" labels
- "Full Package Download" heading and description
- "Download Full Package (Locked)" button

These download buttons still exist in the `completed` (post-payment) state — they just don't appear before payment.

---

## States Reference

| State | What the user sees |
|-------|-------------------|
| `needs_payment` | The invoice card described above |
| `processing` | Spinning circle with "Processing Your Document..." (unchanged) |
| `awaiting_payment` | Spinning circle with "Confirming Payment..." (unchanged) |
| `completed` + `paid` | PDF iframe + enabled download buttons + feedback section |
| `completed` + `!paid` (preview) | PDF iframe + upgrade CTA (sign up / pay) |
| `failed` | Error state (unchanged) |

---

## CSS Patterns to Reuse

- `.card` — bordered container (1px solid #e0e0e0, border-radius 12px, shadow-sm)
- `.detail-grid` + `.detail-item` — receipt rows (grey bg, label-value, border-bottom)
- `.pc-features` — checkmark list (blue ✓, left-padded)
- `.notice--info` — blue callout box
- `.btn--primary`, `.btn--outline`, `.btn--lg`, `.btn--pill` — CTA buttons
- `.text-success`, `.text-error` — balance coloring

## Backend Data Available

The `/api/latex/project/:id/payment-details` endpoint returns:

```json
{
  "metadata": {
    "filename": "your_thesis.docx",
    "page_count": 24,
    "word_count": 12400,
    "filesize": 1048576,
    "template": "IEEE"
  },
  "cost_estimate": {
    "base_credits": 499,
    "additional_pages": 9,
    "additional_credits": 450,
    "total_credits": 949,
    "total_dollars": 9.49,
    "breakdown": "Base (15 pages): 499 credits + Additional (9 pages): 450 credits"
  },
  "can_use_free": true,
  "credit_balance": 1200,
  "has_sufficient_credits": true
}
```

All fields needed for the invoice card are already returned by the API.
