# Anonymous Feature Proposals

# Nathan's Proposal

Extracted from meeting transcript (Nathan Lomeli, ~Feb 2026).

## Core Principle

> "You really have to just show people more and get people farther in the process while asking for less."

Nathan's concern: Users land on the site, hit "Try Free Now", are immediately forced to sign up, then hit a Stripe payment page for their free credit. Each step is a drop-off cliff. Academic users are privacy-cautious and won't trust an unknown site with their email or card details before seeing proof the product works.

## Nathan's Ideal Flow

### Step 1: Upload without account
- User lands on site
- Uploads a DOCX and selects a template — no sign-up required
- Document is processed in the background

### Step 2: Preview result (no account)
- User sees a preview of the converted document — first page only
- This is the "proof moment" where the user decides the site is functional and trustworthy
- User cannot download anything or see the full document

### Step 3: Sign up to unlock full document
- User creates an account (email + password or Google OAuth)
- In exchange, they can now see/download the full converted document
- This is still free — no payment involved
- The anonymous upload is transferred to their new account

### Step 4: Add payment method for future use
- After seeing the full document, user is prompted to add a credit card
- NOT charged — just card on file
- Could unlock an additional free credit or future credits
- This step is optional / skippable

## Nathan's Variation

Nathan also mentioned a tiered unlock model:

| Action | What user sees |
|--------|---------------|
| No account | First page preview only |
| Create account (free) | Almost all pages (e.g., all except last page) |
| Add card on file (not charged) | Full document access |

> "They can see the first page without signing up. They sign up to unlock almost all of it but except the last page... when they add credit card details — not paying but adding credit card details — they can get access to the full document."

He noted this is just one variation and the team should experiment.

## What Nathan Explicitly Does NOT Want

1. **No sign-up before seeing proof** — the current flow forces account creation before the user sees any result
2. **No payment page for free credits** — users see Stripe and think something went wrong or feel pressured. Drop the payment step entirely for the first free upload
3. **No friction before the "proof moment"** — the user must see a converted document before being asked for anything (email, password, card)

## Nathan's Reasoning

- Academics are "paranoid" about data privacy and creating accounts
- The sign-up → payment page flow explains the high account deletion rate (~1/3 of uploaders deleted their accounts)
- 26 signups from $80 ad spend is "insane" for an unknown product — removing friction would multiply conversions
- The Stripe "Link" payment UI looks unfamiliar and untrustworthy to users
- Showing the product working builds trust; asking for info before showing anything destroys it

-----------------------------------------------------------

# Lewis's Proposal

## Flow Overview

### Tier 1: Anonymous (no account)
- User lands on site, automatically gets an anonymous backend account (invisible to user)
- Can upload 1 file and have it processed
- Can only see the first 3 pages of the result (blurred/gated beyond that)
- CAPTCHA (Google reCAPTCHA) required at upload time to prevent bot abuse
- If the auth token is not refreshed within ~1 week, the anonymous account is auto-deleted (orphaned — key data metrics preserved, PII stripped)

### Tier 2: Signed up (verified account)
- User signs up with email + password or Google OAuth
- Anonymous account is merged into the new real account
- The 1 file they already uploaded becomes their free upload — now viewable in full (no verification gate)
- All features unlocked: profile, account deletion, download, future uploads (paid)

### Payment Flow Change
- No more redirect to Stripe after upload confirmation
- The current payment page redirect is removed entirely for free/preview uploads
- Payment options are displayed on the document viewing page itself, alongside the partial paper
- User sees their 3-page preview (or full free PDF) with a clear display of what paying unlocks (full .tex, compilation package, etc.)
- Stripe checkout is embedded/triggered from the viewing page — the user never leaves the context of their document
- This keeps the user in the "proof moment" while presenting the upsell — no context switch, no redirect anxiety

### Anti-Abuse
- 10-minute email detection (temp mail services blocked at signup)
- Google reCAPTCHA only on anonymous upload (signed-in users don't need it)
- Google OAuth users are verified by default (Google already verified their email)

-----------------------------------------------------------

# Comparison

| Aspect | Nathan | Lewis |
|--------|--------|-------|
| Preview without account | First 1 page | First 3 pages |
| What triggers processing | Upload without account | Upload without account |
| Sign-up incentive | See full document | See full document |
| Free upload count | 1 (the anonymous one) | 1 (the anonymous one, unlocked on signup) |
| Card on file step | Optional step for bonus credits | Not included — keep it simple |
| Anti-abuse | Not discussed | 10-min email detection + CAPTCHA on anonymous |
| Stale anonymous cleanup | Not discussed | Auto-delete after ~1 week of inactivity |
| Google OAuth | Not discussed | Verified by default, auto-signed-up |

### Key Differences

1. **3 pages vs 1 page preview** — Lewis shows more upfront. More generous preview = more trust-building, but also gives away more for free.

2. **No card-on-file step** — Nathan proposed an optional "add card to unlock everything" tier between signup and payment. Lewis skips this — signup alone unlocks the full document. Simpler funnel.

3. **Anti-abuse is built in** — Nathan didn't address abuse prevention. Lewis's design includes CAPTCHA for anonymous users and temp-email blocking at signup, which is necessary since anonymous uploads have real processing cost.

4. **Stale cleanup** — Lewis handles the inevitable abandoned anonymous accounts with auto-deletion after 1 week. Keeps the database clean while preserving metrics.

5. **Verification gate** — Lewis requires email verification before full document access. Nathan's flow didn't mention verification — just "create account = see full doc." This adds one more step but prevents throwaway signups.

## Resolved Decisions

1. **Free upload presentation** — Same UI as paid uploads. No visual distinction. Just gated at 3 pages until signup. Pipeline side handles this by only returning 3 pages.

2. **Second anonymous upload** — Upload button greyed out with message to sign up.

3. **Download tiering:**

| Tier | PDF | .tex | Full package (.cls, .bst, .sty, etc.) | .bib |
|------|-----|------|---------------------------------------|------|
| Anonymous (no account) | 3-page PDF only | No | No | No |
| Signed up (free upload) | Full PDF | No | No | No |
| Paid | Full PDF | Yes | Yes | No (users have Zotero) |

Payment reframed: you're not paying to "get your document" (feels like ransom), you're paying for the editable LaTeX source package (feels like a premium feature). Casual users who just want a PDF for a preprint server get it free. Power users who want to tweak .tex locally are the natural paying customers.

4. **Verification timing** — Don't gate the free upload behind verification. User signs up → immediately sees full PDF. Verification prompt shown as banner/nag. Verification required for additional previews and future features (password reset, newsletters, etc.).

5. **Additional previews after signup** — Verified users can upload up to 5 documents total as 3-page previews (no full PDF, no source). These are unpaid. Rationale: each costs ~$0.15 to process, but at $5/document conversion, even a 3% conversion rate on preview users is profitable. More previews = more bait = more chances to convert. Unverified users get only their 1 free full upload, no additional previews.

6. **Upload/download limits summary:**

| Tier | Uploads | PDF download | Source download |
|------|---------|-------------|----------------|
| Anonymous | 1 (3-page preview) | 3-page PDF | No |
| Signed up (unverified) | 0 additional | Full PDF of free upload | No |
| Signed up (verified) | Up to 5 additional previews (3-page) | Full PDF of free upload, 3-page PDFs of previews | No |
| Paid | Unlimited | Full PDF | Full .tex + package |

7. **Anonymous UI access** — Anonymous users can access all pages (Your Papers, Account, etc.). No greying out or gating. Gates may be added later if needed but default is open.

8. **Login to existing account from anonymous** — Anonymous upload is tucked away (not merged). If someone uploads anonymously then logs into their existing paid account, the anonymous session is set aside. Same behavior as the old implementation.

9. **Failed uploads** — A failed upload still counts. Paid users can get credits refunded, anonymous/free users don't get a retry. Agents will bring failure rate from ~10% to <1% imminently, so this is acceptable.

10. **Viewing page components** — Same page, different CTAs based on state:
    - Anonymous viewing their 3-page preview → "Sign up to claim the full document for free"
    - Signed-up user viewing their free full upload → full document displayed + "Pay to unlock .tex and full LaTeX package"
    - Signed-up verified user viewing a 3-page preview → "Pay to get the full document + source"

11. **Preview limit accounting** — Up to 5 successfully compiled previews max. If a user pays for a preview, it becomes a full upload and no longer counts against the 5. The initial free upload is classified as a full, not a preview. So a verified user could do: 1 free full + 5 previews + unlimited paid.

12. **Google OAuth anonymous merge** — Deferred. Will address later.
