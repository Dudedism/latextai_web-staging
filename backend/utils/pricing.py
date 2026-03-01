"""
Pricing calculation utilities for document conversion.

Credit-based pricing model:
- 1 credit = 1 cent ($0.01)
- Base: 499 credits for up to 15 pages
- Additional pages: 50 credits per page
"""

PRICING_CONFIG = {
    'base_credits': 499,
    'base_pages': 15,
    'per_page_credits': 50,
    'min_credits': 499,
    'max_credits': 10000,
}


def calculate_cost(page_count):
    """
    Calculate credit cost for document processing based on page count.

    Args:
        page_count (int): Number of pages in document

    Returns:
        dict: Cost breakdown containing:
            - base_credits (int): Base conversion fee (499)
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


def calculate_credit_split(total_cost, free_balance, paid_balance, discount_available, first_full_conversion_available=False):
    """
    Calculate how to split a payment across free credits, paid credits, and first-purchase discount.

    Free credits are applied first, then the first-purchase discount (50% off remaining),
    then paid credits cover whatever is left.

    Args:
        total_cost (int): Total credits required
        free_balance (int): User's free credit balance
        paid_balance (int): User's paid credit balance
        discount_available (bool): Whether first-purchase 50% discount is available
        first_full_conversion_available (bool): Whether this is the user's first conversion (full access with free credits)

    Returns:
        dict: Split breakdown containing:
            - free_credits_used (int)
            - paid_credits_used (int)
            - discount_applied (bool)
            - discount_amount (int): Credits saved by discount
            - access_level (str): 'full', 'first_full', or 'free_only'
            - sufficient (bool): Whether user can afford the total
            - total_after_discount (int): Effective total after free credits and discount
    """
    from math import ceil

    # Apply free credits first
    free_used = min(total_cost, free_balance)
    remaining = total_cost - free_used

    # Apply first-purchase discount on remaining (paid portion)
    discount_applied = False
    discount_amount = 0
    if discount_available and remaining > 0:
        discount_amount = remaining - ceil(remaining / 2)
        remaining = ceil(remaining / 2)
        discount_applied = True

    # Apply paid credits
    paid_used = min(remaining, paid_balance)
    sufficient = (free_used + paid_used + discount_amount) >= total_cost

    # Access level: 'full' if paid credits used, 'first_full' for first free conversion, else 'free_only'
    if paid_used > 0:
        access_level = 'full'
    elif first_full_conversion_available and sufficient:
        access_level = 'first_full'
    else:
        access_level = 'free_only'

    return {
        'free_credits_used': free_used,
        'paid_credits_used': paid_used,
        'discount_applied': discount_applied,
        'discount_amount': discount_amount,
        'access_level': access_level,
        'sufficient': sufficient,
        'total_after_discount': total_cost - discount_amount,
    }


def get_pricing_config():
    """Get current pricing configuration."""
    return PRICING_CONFIG.copy()
