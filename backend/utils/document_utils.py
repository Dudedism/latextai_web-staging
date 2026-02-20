"""
Document metadata extraction utilities.

Uses LibreOffice headless to convert DOCX to PDF for accurate page counting.
This is critical for pricing - we charge based on page count.

Also provides extract_docx_analysis() for extracting structural metrics
(images, charts, tables, equations, footnotes, etc.) directly from the DOCX
ZIP/XML without any external conversion.
"""

import os
import subprocess
from zipfile import ZipFile
from pypdf import PdfReader
from docx import Document
from lxml import etree


def get_accurate_page_count(docx_path, output_dir=None):
    """
    Get accurate page count by converting DOCX to PDF using LibreOffice.

    This is the ONLY reliable way to count pages for pricing purposes.
    XML parsing is unreliable, estimation is unacceptable for billing.

    Args:
        docx_path (str): Path to the .docx file
        output_dir (str): Directory to output PDF (default: same as docx_path)

    Returns:
        tuple: (page_count, pdf_path)
            - page_count (int): Accurate page count from rendered PDF
            - pdf_path (str): Path to generated PDF file

    Raises:
        FileNotFoundError: If docx_path doesn't exist
        subprocess.CalledProcessError: If LibreOffice conversion fails
        Exception: If PDF parsing fails
    """
    if not os.path.exists(docx_path):
        raise FileNotFoundError(f"File not found: {docx_path}")

    # Use same directory as DOCX if output_dir not specified
    if output_dir is None:
        output_dir = os.path.dirname(docx_path)

    try:
        # Convert DOCX to PDF using LibreOffice headless
        result = subprocess.run([
            'soffice',
            '--headless',
            '--convert-to', 'pdf',
            docx_path,
            '--outdir', output_dir
        ],
        capture_output=True,
        text=True,
        timeout=30,
        check=True
        )

        # Find the generated PDF (same name as DOCX but .pdf extension)
        pdf_filename = os.path.splitext(os.path.basename(docx_path))[0] + '.pdf'
        pdf_path = os.path.join(output_dir, pdf_filename)

        if not os.path.exists(pdf_path):
            raise Exception(f"LibreOffice conversion failed: PDF not created. Output: {result.stdout}")

        # Count pages in PDF
        with open(pdf_path, 'rb') as pdf_file:
            pdf_reader = PdfReader(pdf_file)
            page_count = len(pdf_reader.pages)

        return page_count, pdf_path

    except subprocess.TimeoutExpired:
        raise Exception("LibreOffice conversion timed out (>30s)")
    except subprocess.CalledProcessError as e:
        raise Exception(f"LibreOffice conversion failed: {e.stderr}")


def get_word_count(docx_path):
    """
    Count total words in a DOCX document.

    This is used to detect anomalous documents (e.g., PDFs saved as DOCX with
    very low word count but high page count).

    Args:
        docx_path (str): Path to .docx file

    Returns:
        int: Total word count across all paragraphs, tables, headers, and footers

    Raises:
        Exception: If document cannot be parsed
    """
    try:
        doc = Document(docx_path)
        word_count = 0

        # Count words in paragraphs
        for paragraph in doc.paragraphs:
            text = paragraph.text.strip()
            if text:
                # Split by whitespace and count non-empty tokens
                word_count += len([word for word in text.split() if word])

        # Count words in tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text = cell.text.strip()
                    if text:
                        word_count += len([word for word in text.split() if word])

        # Count words in headers
        for section in doc.sections:
            header = section.header
            for paragraph in header.paragraphs:
                text = paragraph.text.strip()
                if text:
                    word_count += len([word for word in text.split() if word])

            # Count words in footers
            footer = section.footer
            for paragraph in footer.paragraphs:
                text = paragraph.text.strip()
                if text:
                    word_count += len([word for word in text.split() if word])

        return word_count

    except Exception as e:
        print(f"❌ Error counting words: {e}")
        raise Exception(f"Failed to count words: {e}")


def extract_docx_metadata(docx_path, keep_pdf=False):
    """
    Extract complete metadata from DOCX file.

    Args:
        docx_path (str): Path to .docx file
        keep_pdf (bool): Whether to keep the generated PDF (default: False)

    Returns:
        dict: Metadata containing:
            - filesize (int): File size in bytes
            - page_count (int): Accurate page count from PDF conversion
            - word_count (int): Total word count in document
            - pdf_path (str): Path to PDF (if keep_pdf=True), None otherwise

    Example:
        metadata = extract_docx_metadata("/path/to/file.docx")
        print(f"Pages: {metadata['page_count']}, Words: {metadata['word_count']}, Size: {metadata['filesize']} bytes")
    """
    # Get file size
    filesize = os.path.getsize(docx_path)

    # Get word count
    try:
        word_count = get_word_count(docx_path)
    except Exception as e:
        print(f"⚠️  Warning: Could not count words, defaulting to 0: {e}")
        word_count = 0

    # Get accurate page count using LibreOffice
    try:
        page_count, pdf_path = get_accurate_page_count(docx_path)

        # Delete PDF unless keep_pdf is True
        if not keep_pdf and os.path.exists(pdf_path):
            os.remove(pdf_path)
            pdf_path = None

    except Exception as e:
        print(f"❌ Error getting page count: {e}")
        # For pricing purposes, we cannot fall back to estimation
        # Raise the error so caller can handle it
        raise Exception(f"Failed to determine page count: {e}")

    return {
        'filesize': filesize,
        'page_count': page_count,
        'word_count': word_count,
        'pdf_path': pdf_path
    }


def format_filesize(bytes):
    """
    Format file size in human-readable format.

    Args:
        bytes (int): File size in bytes

    Returns:
        str: Formatted file size (e.g., "1.5 MB", "500 KB")
    """
    if bytes < 1024:
        return f"{bytes} B"
    elif bytes < 1024 * 1024:
        return f"{bytes / 1024:.1f} KB"
    elif bytes < 1024 * 1024 * 1024:
        return f"{bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{bytes / (1024 * 1024 * 1024):.1f} GB"


def validate_docx_file(file_path, max_size_mb=30):
    """
    Validate a .docx file before processing.

    Args:
        file_path (str): Path to file
        max_size_mb (int): Maximum allowed file size in MB (default 30MB)

    Returns:
        tuple: (is_valid, error_message)
            - is_valid (bool): Whether file is valid
            - error_message (str): Error message if invalid, None if valid
    """
    # Check file exists
    if not os.path.exists(file_path):
        return False, "File not found"

    # Check file size
    filesize = os.path.getsize(file_path)
    max_size_bytes = max_size_mb * 1024 * 1024

    if filesize > max_size_bytes:
        return False, f"File size ({format_filesize(filesize)}) exceeds maximum allowed size ({max_size_mb} MB)"

    if filesize == 0:
        return False, "File is empty"

    return True, None


def validate_word_page_ratio(word_count, page_count):
    """
    Validate the word-to-page ratio to detect suspicious documents.

    This prevents:
    1. Documents with extremely dense text (suspiciously high word count)
    2. Nearly empty documents (very few words)

    Note: We do NOT enforce a minimum words/page ratio because low ratios
    benefit us (more pages = more revenue). We only prevent excessively
    dense documents that might be corrupted or fraudulent.

    Typical academic papers have 250-500 words per page.

    Args:
        word_count (int): Total word count in document
        page_count (int): Total page count

    Returns:
        tuple: (is_valid, error_message)
            - is_valid (bool): Whether ratio is valid
            - error_message (str): Error message if invalid, None if valid
    """
    # Edge case: single-page documents or documents with 0 pages
    if page_count == 0:
        return False, "Document has 0 pages"

    # Calculate words per page
    words_per_page = word_count / page_count

    # Maximum threshold: 3000 words per page
    # This catches extremely dense documents or corrupted files
    # Academic papers rarely exceed 750 words/page; 3000 is very generous
    MAX_WORDS_PER_PAGE = 3000
    if words_per_page > MAX_WORDS_PER_PAGE:
        return False, (
            f"Document appears to be invalid: {word_count} words across {page_count} page(s) "
            f"({words_per_page:.0f} words/page). This exceeds reasonable density. "
            f"Maximum: {MAX_WORDS_PER_PAGE} words/page."
        )

    # Minimum total word count: 100 words
    # This catches nearly empty documents
    MIN_TOTAL_WORDS = 100
    if word_count < MIN_TOTAL_WORDS:
        return False, (
            f"Document appears to be too short: only {word_count} words. "
            f"Minimum: {MIN_TOTAL_WORDS} words."
        )

    return True, None


def extract_docx_analysis(docx_path):
    """
    Extract structural metrics from a DOCX file without pandoc/LibreOffice.

    Opens the DOCX as a ZIP once and extracts all metrics in a single pass:
    images, charts, tables, equations, footnotes, hyperlinks, headings,
    table dimensions, shapes, and application metadata.

    Args:
        docx_path (str): Path to .docx file

    Returns:
        dict: All extracted metrics (counts default to 0, strings to None)
    """
    metrics = {
        'image_count': 0,
        'chart_count': 0,
        'table_count': 0,
        'equation_count': 0,
        'footnote_count': 0,
        'hyperlink_count': 0,
        'heading_count': 0,
        'max_table_cols': 0,
        'max_table_rows': 0,
        'table_cell_count': 0,
        'shape_count': 0,
        'app_name': None,
        'app_version': None,
    }

    try:
        with ZipFile(docx_path, 'r') as zf:
            names = zf.namelist()

            # Image count: files in word/media/
            metrics['image_count'] = len([f for f in names if f.startswith('word/media/')])

            # Chart count: word/charts/chartN.xml files
            metrics['chart_count'] = len([
                f for f in names
                if f.startswith('word/charts/chart') and f.endswith('.xml')
            ])

            # App metadata from docProps/app.xml
            if 'docProps/app.xml' in names:
                root = etree.fromstring(zf.read('docProps/app.xml'))
                ns = {'ep': 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'}
                name_elem = root.find('.//ep:Application', ns)
                if name_elem is not None and name_elem.text:
                    metrics['app_name'] = name_elem.text.split('/')[0]
                version_elem = root.find('.//ep:AppVersion', ns)
                if version_elem is not None and version_elem.text:
                    metrics['app_version'] = version_elem.text

            # Document XML metrics
            if 'word/document.xml' in names:
                root = etree.fromstring(zf.read('word/document.xml'))

                ns_w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
                ns_m = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
                ns_wps = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
                ns_v = 'urn:schemas-microsoft-com:vml'

                # Equations
                metrics['equation_count'] = len(root.findall(f'.//{{{ns_m}}}oMath'))

                # Hyperlinks
                metrics['hyperlink_count'] = len(root.findall(f'.//{{{ns_w}}}hyperlink'))

                # Shapes (WPS + VML)
                metrics['shape_count'] = (
                    len(root.findall(f'.//{{{ns_wps}}}wsp')) +
                    len(root.findall(f'.//{{{ns_v}}}shape'))
                )

                # Headings (paragraphs with Heading style)
                for para in root.findall(f'.//{{{ns_w}}}p'):
                    pstyle = para.find(f'{{{ns_w}}}pPr/{{{ns_w}}}pStyle')
                    if pstyle is not None:
                        style_val = pstyle.get(f'{{{ns_w}}}val', '')
                        if 'Heading' in style_val or 'heading' in style_val:
                            metrics['heading_count'] += 1

                # Table dimensions
                for tbl in root.findall(f'.//{{{ns_w}}}tbl'):
                    cols = len(tbl.findall(f'{{{ns_w}}}tblGrid/{{{ns_w}}}gridCol'))
                    rows = len(tbl.findall(f'{{{ns_w}}}tr'))
                    if cols > metrics['max_table_cols']:
                        metrics['max_table_cols'] = cols
                    if rows > metrics['max_table_rows']:
                        metrics['max_table_rows'] = rows
                    metrics['table_cell_count'] += cols * rows

            # Footnotes (subtract 2 built-in separator/continuation footnotes)
            if 'word/footnotes.xml' in names:
                fn_root = etree.fromstring(zf.read('word/footnotes.xml'))
                ns_w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
                footnotes = fn_root.findall(f'{{{ns_w}}}footnote')
                metrics['footnote_count'] = max(0, len(footnotes) - 2)

        # Table count via python-docx (more reliable than raw XML for nested tables)
        doc = Document(docx_path)
        metrics['table_count'] = len(doc.tables)

    except Exception as e:
        print(f"⚠️  [ANALYSIS] Error extracting document analysis: {e}")

    return metrics
