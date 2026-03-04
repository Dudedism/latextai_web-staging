"""
Regional pricing (PPP) for LatextAI.

2-tier model: Standard (US/EU) and Emerging (India, South Asia, Africa, etc.)
Credits are the universal internal unit. Only the credit-to-money rate changes by region.

Standard:  1 credit = $0.005 USD  → 499 credits = $2.50
Emerging:  1 credit = ₹0.15 INR  → 499 credits = ₹75 (for India)
           1 credit = $0.00175 USD → 499 credits = $0.87 (for other emerging, ~65% off)
"""

import requests as http_requests
import datetime

# --- Country Sets ---

EMERGING_COUNTRIES = {
    # South Asia
    'IN', 'PK', 'BD', 'LK', 'NP', 'MM', 'BT', 'AF',
    # Southeast Asia (lower income)
    'VN', 'PH', 'ID', 'KH', 'LA', 'TH',
    # Africa
    'NG', 'KE', 'GH', 'TZ', 'UG', 'ET', 'ZA', 'EG',
    'DZ', 'MA', 'TN', 'SN', 'CM', 'CI', 'RW', 'MW',
    'ZM', 'ZW', 'MZ', 'AO', 'CD', 'BF', 'ML', 'NE',
    # Latin America
    'BR', 'MX', 'CO', 'PE', 'AR', 'CL', 'EC', 'VE',
    'GT', 'HN', 'SV', 'NI', 'BO', 'PY', 'UY',
    # Eastern Europe / Central Asia
    'UA', 'UZ', 'KZ', 'GE', 'AM', 'AZ', 'KG', 'TJ',
    # Middle East (lower income)
    'IQ', 'JO', 'LB', 'PS',
}

# Countries where INR is the display currency (all others in emerging use discounted USD)
INR_COUNTRIES = {'IN'}

# --- Pricing Tier Configuration ---

# For emerging USD: discount multiplier applied to standard USD pricing
EMERGING_USD_DISCOUNT = 0.175  # Pay 35% of standard price (~65% off)

PRICING_TIERS = {
    'standard': {
        'currency': 'usd',
        'currency_symbol': '$',
        'credits_to_minor_unit': 0.5,  # 1 credit = 0.5 cents USD
        'stripe_currency': 'usd',
        'subscription_prices': {
            'scholar': {'display': '$3.49/mo', 'price_minor': 349},
            'researcher': {'display': '$4.99/mo', 'price_minor': 499},
            'professor': {'display': '$6.99/mo', 'price_minor': 699},
        },
    },
    'emerging_inr': {
        'currency': 'inr',
        'currency_symbol': '₹',
        'credits_to_minor_unit': 15,  # 1 credit = 15 paisa (₹0.15)
        'stripe_currency': 'inr',
        'subscription_prices': {
            'scholar': {'display': '₹149/mo', 'price_minor': 14900},
            'researcher': {'display': '₹249/mo', 'price_minor': 24900},
            'professor': {'display': '₹349/mo', 'price_minor': 34900},
        },
    },
    'emerging_usd': {
        'currency': 'usd',
        'currency_symbol': '$',
        'credits_to_minor_unit': EMERGING_USD_DISCOUNT,  # 1 credit = 0.175 cents
        'stripe_currency': 'usd',
        'subscription_prices': {
            'scholar': {'display': '$3.49/mo', 'price_minor': 349},
            'researcher': {'display': '$4.99/mo', 'price_minor': 499},
            'professor': {'display': '$6.99/mo', 'price_minor': 699},
        },
    },
}


# --- IP Geolocation ---

def detect_country_from_ip(ip_address):
    """
    Detect country from IP address using free geolocation APIs.
    Returns ISO 3166-1 alpha-2 country code (e.g. 'IN', 'US') or None.
    """
    if not ip_address or ip_address in ('127.0.0.1', '::1', 'localhost'):
        return None

    apis = [
        (f'http://ipwhois.app/json/{ip_address}?objects=country_code', 'country_code'),
        (f'http://ip-api.com/json/{ip_address}?fields=countryCode', 'countryCode'),
    ]
    for url, key in apis:
        try:
            resp = http_requests.get(url, timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                code = data.get(key)
                if code and len(code) == 2:
                    return code.upper()
        except Exception:
            continue
    return None


# --- Tier Resolution ---

def resolve_pricing_tier(country_code):
    """
    Given a country code, return (tier_key, currency).

    Returns:
        tuple: ('standard', 'usd') | ('emerging_inr', 'inr') | ('emerging_usd', 'usd')
    """
    if not country_code:
        return 'standard', 'usd'

    country = country_code.upper()
    if country in EMERGING_COUNTRIES:
        if country in INR_COUNTRIES:
            return 'emerging_inr', 'inr'
        return 'emerging_usd', 'usd'
    return 'standard', 'usd'


def get_pricing_for_user(user):
    """
    Get the full pricing configuration for a user.
    Reads cached tier from user document, defaults to standard.
    """
    tier_key = user.get('pricing_tier', 'standard')
    tier = PRICING_TIERS.get(tier_key, PRICING_TIERS['standard'])
    return {
        'tier': tier_key,
        'currency': tier['currency'],
        'currency_symbol': tier['currency_symbol'],
        'credits_to_minor_unit': tier['credits_to_minor_unit'],
        'stripe_currency': tier['stripe_currency'],
    }


def credits_to_minor_units(credits, tier_key='standard'):
    """Convert credits to Stripe minor currency units (cents or paisa)."""
    tier = PRICING_TIERS.get(tier_key, PRICING_TIERS['standard'])
    return int(round(credits * tier['credits_to_minor_unit']))


def credits_to_display_amount(credits, tier_key='standard'):
    """Convert credit count to display money string like '$4.99' or '₹149'."""
    tier = PRICING_TIERS.get(tier_key, PRICING_TIERS['standard'])
    minor_units = credits * tier['credits_to_minor_unit']
    symbol = tier['currency_symbol']

    if tier['currency'] == 'inr':
        rupees = minor_units / 100
        return f'{symbol}{int(rupees)}' if rupees == int(rupees) else f'{symbol}{rupees:.2f}'
    else:
        dollars = minor_units / 100
        return f'{symbol}{dollars:.2f}'


# --- Subscription Price ID Resolution ---

def get_tier_display_prices(tier_key='standard'):
    """Get subscription display prices for a pricing tier."""
    tier = PRICING_TIERS.get(tier_key, PRICING_TIERS['standard'])
    return tier['subscription_prices']


def detect_and_resolve(ip_address):
    """
    Full detection pipeline: IP → country → tier.
    Used for signup and the public detect-pricing endpoint.

    Returns:
        dict with country, tier, currency, currency_symbol
    """
    country = detect_country_from_ip(ip_address)
    tier_key, currency = resolve_pricing_tier(country)
    tier = PRICING_TIERS.get(tier_key, PRICING_TIERS['standard'])
    return {
        'country': country,
        'tier': tier_key,
        'currency': currency,
        'currency_symbol': tier['currency_symbol'],
    }


def extract_client_ip(request_obj):
    """Extract client IP from Flask request, handling X-Forwarded-For."""
    ip = request_obj.headers.get('X-Forwarded-For', request_obj.remote_addr)
    if ip and ',' in ip:
        ip = ip.split(',')[0].strip()
    return ip
