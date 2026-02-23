# Design Prompt: Payment Page for LaTexT AI

## What is this?

LaTexT AI converts Word documents into professionally formatted LaTeX PDFs. Users upload a .docx, pick a journal template (IEEE, Nature, etc.), and pay credits (1 credit = $0.01) for conversion.

## The page

A payment page shown after the user uploads and validates their document, but before processing. The user needs to pay to proceed. The page should convince them it's worth it.

The page contains a single centered card on a white background, between a minimal nav bar and footer. No PDF preview, no greyed-out download buttons, no lock icons. Just one focused, well-designed card that communicates value and asks for payment.

## What the card must contain

- **Document metadata:** Filename, template name, page count, word count. Keep it compact.
- **Value proposition:** What the user gets when they pay — compiled PDF, editable .tex source, .bib bibliography, complete compilation package with images and build files.
- **Cost breakdown:** Receipt-style. Base fee of 499 credits for up to 15 pages, plus 50 credits per additional page. Show the math. A 24-page document = 499 + (9 extra pages x 50) = 949 credits ($9.49).
- **CTA button:** A prominent "Pay X Credits" action.

## Site design language

- **Minimal monochrome.** Almost entirely black (#000) and white (#fff). Grey for secondary text and borders. One accent: blue (#3b82f6), used sparingly.
- **Clean sans-serif typography.** System fonts. Generous whitespace.
- **Buttons:** Black pill-shaped for primary, outlined for secondary.
- **Cards:** White, thin grey border, subtle shadow, rounded corners.
- **Feel:** Professional, academic, trustworthy. Stripe checkout meets a clean academic journal.

## Deliverable

A high-fidelity desktop mockup (1440px viewport) that looks like a real website, not a wireframe.
