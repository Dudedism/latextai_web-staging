# TODO: Download Section Icons

4 icons needed for the download cards on a document conversion SaaS. Generate as **images** (PNG with white background), not SVG code. Attached is a screenshot of the current component we want to improve.

---

## Prompt 1: Full Package (.zip)

An icon is needed for the download cards on a document conversion SaaS. Generate as **images** (PNG with white background). Attached is a screenshot of the current component we want to improve.

Generate an icon image for a "Full Package" download button. A zip folder overflowing with a panoply of documents fanning out over the top — .pdf, .tex, .bib, .sty, .bst files, image files, all spilling out as a rich bundle. The folder has a zipper texture down the center. The documents overlap, angled to create a fan effect suggesting abundance. Dark charcoal (#333) line art with light gray (#f5f5f5) fills for the document bodies. Flat, minimal, modern SaaS style. Not cartoonish, white background, PNG.

## Prompt 2: PDF Document (.pdf)

An icon is needed for the download cards on a document conversion SaaS. Generate as **images** (PNG with white background). Attached is a screenshot of the current component we want to improve.

Generate an icon image for a "PDF Document" download button. A single page/document icon with a folded corner (dog-ear, top-right). The text "PDF" is written in bold across the face of the document. Light gray (#f5f5f5) document fill, slightly darker fold (#e0e0e0), dark charcoal (#333) outlines and text. Flat, minimal, modern SaaS style. Not cartoonish, white background, PNG.

## Prompt 3: LaTeX Source (.tex)

An icon is needed for the download cards on a document conversion SaaS. Generate as **images** (PNG with white background). Attached is a screenshot of the current component we want to improve.

Generate an icon image for a "LaTeX Source" download button. A single page/document icon with a folded corner (dog-ear, top-right) — same base shape as a PDF document icon. The iconic TeX logo is displayed on the face of the document — using the distinctive TeX typographic styling where the "E" is lowered below the baseline (T‍ᴇX). A couple of faint horizontal lines above and below to suggest source code. Light gray (#f5f5f5) document fill, slightly darker fold (#e0e0e0), dark charcoal (#333) outlines and text. Flat, minimal, modern SaaS style. Not cartoonish, white background, PNG.

## Prompt 4: Bibliography (.bib)

An icon is needed for the download cards on a document conversion SaaS. Generate as **images** (PNG with white background). Attached is a screenshot of the current component we want to improve.

Generate an icon image for a "Bibliography" download button. An open book viewed from the front, two page spreads visible with a spine/binding in the center. The iconic BibTeX logo is tastefully displayed across the open pages — using the distinctive TeX typographic styling where the "E" is lowered (BibT‍ᴇX). Dark charcoal (#333) outlines and text, light gray fills. Same visual weight and style as a document icon with dog-ear corner. Flat, minimal, modern SaaS style. Not cartoonish, white background, PNG.

---

## Where they go

Save generated icons to:
- `frontend/public/icons/dl-package.png`
- `frontend/public/icons/dl-pdf.png`
- `frontend/public/icons/dl-tex.png`
- `frontend/public/icons/dl-bib.png`

Then update PreviewPage.tsx to replace the inline SVG placeholders with `<img src="/icons/dl-package.png" ...>` etc.

## Tasks

- [ ] Generate Full Package icon using Prompt 1
- [ ] Generate PDF Document icon using Prompt 2
- [ ] Generate LaTeX Source icon using Prompt 3
- [ ] Generate Bibliography icon using Prompt 4
- [ ] Replace inline SVGs in PreviewPage.tsx with `<img>` references
