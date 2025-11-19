"""
Document metadata extraction utilities.

Uses LibreOffice headless to convert DOCX to PDF for accurate page counting.
This is critical for pricing - we charge based on page count.
"""

import os
import subprocess
from pypdf import PdfReader
from docx import Document


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
