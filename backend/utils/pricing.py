"""
Pricing calculation utilities for document conversion.

Credit-based pricing model:
- 1 credit = 1 cent ($0.01)
- Base: 500 credits for up to 15 pages
- Additional pages: 50 credits per page
"""

PRICING_CONFIG = {
    'base_credits': 500,
    'base_pages': 15,
    'per_page_credits': 50,
    'min_credits': 500,
    'max_credits': 10000,
}


def calculate_cost(page_count):
    """
    Calculate credit cost for document processing based on page count.

    Args:
        page_count (int): Number of pages in document

    Returns:
        dict: Cost breakdown containing:
            - base_credits (int): Base conversion fee (500)
            - additional_pages (int): Pages beyond base amount
            - additional_credits (int): Credits for additional pages
            - total_credits (int): Total credits required
            - total_dollars (float): Dollar equivalent
            - breakdown (str): Human-readable breakdown
    """
    base = PRICING_CONFIG['base_credits']
    base_pages = PRICING_CONFIG['base_pages']

    additional_pages = max(0, page_count - base_pages)
    additional_credits = additional_pages * PRICING_CONFIG['per_page_credits']

    total = base + additional_credits
    total = max(PRICING_CONFIG['min_credits'], min(total, PRICING_CONFIG['max_credits']))

    if additional_pages > 0:
        breakdown = f"Base ({base_pages} pages): {base} credits + Additional ({additional_pages} pages): {additional_credits} credits"
    else:
        breakdown = f"Base (up to {base_pages} pages): {base} credits"

    return {
        'base_credits': base,
        'additional_pages': additional_pages,
        'additional_credits': additional_credits,
        'total_credits': total,
        'total_dollars': total / 100,
        'breakdown': breakdown
    }


def get_pricing_config():
    """Get current pricing configuration."""
    return PRICING_CONFIG.copy()
