# Phase 1: SEO Meta Tags

- [ ] Add canonical URL tag

  `frontend/index.html` — missing `<link rel="canonical">` which can cause duplicate content issues in search engines. Add inside `<head>`:
  ```html
  <link rel="canonical" href="https://latext.ai/" />
  ```

- [ ] Add Open Graph meta tags

  `frontend/index.html` — missing OG tags for social media link previews (Facebook, LinkedIn, etc.). Add inside `<head>`:
  ```html
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Latext AI — Word to LaTeX PDF Converter" />
  <meta property="og:description" content="Convert Word documents to professionally formatted LaTeX PDFs. Upload your .docx file and get publication-ready output in minutes." />
  <meta property="og:url" content="https://latext.ai/" />
  <meta property="og:image" content="https://latext.ai/icon-512.png" />
  <meta property="og:site_name" content="Latext AI" />
  ```

- [ ] Add Twitter Card meta tags

  `frontend/index.html` — missing Twitter Card tags for link previews on Twitter/X. Add inside `<head>`:
  ```html
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="Latext AI — Word to LaTeX PDF Converter" />
  <meta name="twitter:description" content="Convert Word documents to professionally formatted LaTeX PDFs." />
  <meta name="twitter:image" content="https://latext.ai/icon-512.png" />
  ```

# Phase 2: PWA Improvements

- [ ] Add maskable icon to web manifest

  `frontend/public/site.webmanifest` — modern Android devices use maskable icons for adaptive icon displays. Create a maskable version of the 512x512 icon (with safe zone padding) and add to the manifest:
  ```json
  {
    "src": "icon-512-maskable.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "maskable"
  }
  ```
  The existing icons should keep `"purpose": "any"` (or omit it, since `any` is the default).

- [ ] Add categories to web manifest

  `frontend/public/site.webmanifest` — add categories for app store optimization:
  ```json
  "categories": ["productivity", "education"]
  ```

# Phase 3: Minor HTML Improvements

- [ ] Move Google Analytics script after charset declaration

  `frontend/index.html` — the gtag script is placed before the charset meta tag. Best practice is charset first, then scripts. Move the `<script async src="https://www.googletagmanager.com/gtag/js?...">` block to after the `<meta charset="UTF-8" />` line. This is a minor best-practice fix — no functional impact.
