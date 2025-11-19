"""
Pricing calculation utilities for document conversion.

Pricing model matches frontend PricingPage.tsx:
- Base: $4.99 for up to 15 pages (one-sided) or 7 pages (two-sided)
- Additional pages: $0.50 per page

All prices in USD.
"""

# Pricing configuration (matches PricingPage.tsx)
PRICING_CONFIG = {
    'base_cost': 4.99,         # Base conversion fee
    'base_pages': 15,          # Pages included in base price (one-sided)
    'per_page_cost': 0.50,     # Cost per additional page beyond base_pages
    'min_cost': 4.99,          # Minimum charge (same as base_cost)
    'max_cost': 100.00,        # Maximum charge (safety limit)
}


def calculate_cost(page_count):
    """
    Calculate cost for document processing based on page count.

    Pricing model:
    - Base: $4.99 for up to 15 pages
    - Additional: $0.50 per page beyond 15

    Args:
        page_count (int): Number of pages in document (from LibreOffice PDF conversion)

    Returns:
        dict: Cost breakdown containing:
            - base_cost (float): Base conversion fee ($4.99)
            - additional_pages (int): Pages beyond base amount
            - additional_cost (float): Cost for additional pages
            - total (float): Total cost
            - breakdown (str): Human-readable breakdown

    Example:
        >>> calculate_cost(20)
        {
            'base_cost': 4.99,
            'additional_pages': 5,
            'additional_cost': 2.50,
            'total': 7.49,
            'breakdown': 'Base (15 pages): $4.99 + Additional (5 pages): $2.50'
        }
    """
    base = PRICING_CONFIG['base_cost']
    base_pages = PRICING_CONFIG['base_pages']

    # Calculate additional pages beyond base
    additional_pages = max(0, page_count - base_pages)

    # Calculate cost for additional pages
    additional_cost = additional_pages * PRICING_CONFIG['per_page_cost']

    # Calculate total
    total = base + additional_cost

    # Apply min/max limits
    total = max(PRICING_CONFIG['min_cost'], min(total, PRICING_CONFIG['max_cost']))

    # Create breakdown string
    if additional_pages > 0:
        breakdown = f"Base ({base_pages} pages): ${base:.2f} + Additional ({additional_pages} pages): ${additional_cost:.2f}"
    else:
        breakdown = f"Base (up to {base_pages} pages): ${base:.2f}"

    return {
        'base_cost': base,
        'additional_pages': additional_pages,
        'additional_cost': additional_cost,
        'total': round(total, 2),
        'breakdown': breakdown
    }


def get_pricing_config():
    """
    Get current pricing configuration.

    Returns:
        dict: Current pricing configuration
    """
    return PRICING_CONFIG.copy()
