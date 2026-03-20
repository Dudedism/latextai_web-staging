"""Blurred preview generation for LaTeXt.ai.

Renders ALL pages of the final PDF. 3 strategically selected pages
(title, content with table/figure, references) are kept clear;
every other page gets a full Gaussian blur.
Simple, fast, no external API calls.
"""
from __future__ import annotations

import os

import fitz  # PyMuPDF
from PIL import Image, ImageFilter

BLUR_RADIUS = 6
RENDER_DPI = 150
_MAX_SCAN_PAGES = 30


def _select_preview_pages(doc: fitz.Document) -> list[int]:
    """Pick 3 strategic pages: title, a content page, references. Returns 0-indexed."""
    n = len(doc)
    if n <= 3:
        return list(range(n))

    scan_limit = min(n, _MAX_SCAN_PAGES)
    pages = [0]

    # Find first page with a table
    content_page = None
    for i in range(1, scan_limit):
        blocks = doc[i].get_text('dict')['blocks']
        for block in blocks:
            if block['type'] == 0:
                lines = block.get('lines', [])
                if len(lines) >= 3:
                    total_text = ''.join(
                        s.get('text', '') for l in lines for s in l.get('spans', [])
                    )
                    if len(total_text) / max(1, len(lines)) < 40:
                        content_page = i
                        break
        if content_page is not None:
            break

    # Fallback: first page with a figure
    if content_page is None:
        for i in range(1, scan_limit):
            blocks = doc[i].get_text('dict')['blocks']
            if any(b['type'] == 1 for b in blocks):
                content_page = i
                break

    # Fallback: second page
    if content_page is None and n > 1:
        content_page = 1

    if content_page is not None and content_page not in pages:
        pages.append(content_page)

    # Find references page
    refs_page = None
    for i in range(1, n):
        text = doc[i].get_text()[:200].strip()
        if text.startswith('References') or '\nReferences' in text[:200]:
            refs_page = i
            break

    if refs_page is not None and refs_page not in pages:
        pages.append(refs_page)

    # Fill remaining slots
    if len(pages) < 3:
        for i in range(1, n):
            if i not in pages:
                pages.append(i)
            if len(pages) == 3:
                break

    return sorted(pages[:3])


def _render_page_to_pil(doc: fitz.Document, page_num: int, dpi: int = RENDER_DPI) -> Image.Image:
    """Render a PDF page to a PIL Image."""
    page = doc[page_num]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)


def generate_blurred_preview(pdf_path: str, output_dir: str) -> list[str]:
    """Generate preview images for all pages: 3 clear, rest blurred.

    Returns list of generated filenames (blurred_page_1.jpg, ...).
    """
    doc = fitz.open(pdf_path)
    filenames = []
    try:
        total_pages = len(doc)
        if total_pages == 0:
            return []

        clear_pages = set(_select_preview_pages(doc))
        clear_str = ', '.join(str(p + 1) for p in sorted(clear_pages))
        print(f"🖼️ [BLUR] {total_pages} pages, clear: [{clear_str}], blurring rest")

        for i in range(total_pages):
            img = _render_page_to_pil(doc, i)

            if i not in clear_pages:
                img = img.filter(ImageFilter.GaussianBlur(radius=BLUR_RADIUS))

            filename = f'blurred_page_{i + 1}.jpg'
            img.save(os.path.join(output_dir, filename), 'JPEG', quality=85)
            filenames.append(filename)

        print(f"🖼️ [BLUR] Generated {len(filenames)} preview pages ({len(clear_pages)} clear, {len(filenames) - len(clear_pages)} blurred)")
    finally:
        doc.close()

    return filenames
