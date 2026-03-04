import stripe
from flask import jsonify, Blueprint, request
from api_auth import requires_auth
from database import User, mongo
from config import (
    STRIPE_SECRET_KEY, FRONTEND_URL,
    STRIPE_PRICE_SCHOLAR, STRIPE_PRICE_RESEARCHER, STRIPE_PRICE_PROFESSOR,
)

api_subscription = Blueprint('api_subscription_blueprint', __name__, url_prefix='/api/subscription')

stripe.api_key = STRIPE_SECRET_KEY

SUBSCRIPTION_TIERS = {
    'scholar': {
        'name': 'Scholar',
        'price_id': STRIPE_PRICE_SCHOLAR,
        'credits': 5000,
        'price_cents': 349,
    },
    'researcher': {
        'name': 'Researcher',
        'price_id': STRIPE_PRICE_RESEARCHER,
        'credits': 8000,
        'price_cents': 499,
    },
    'professor': {
        'name': 'Professor',
        'price_id': STRIPE_PRICE_PROFESSOR,
        'credits': 10000,
        'price_cents': 699,
    },
}

# Reverse lookup: Stripe price_id → tier key
PRICE_ID_TO_TIER = {v['price_id']: k for k, v in SUBSCRIPTION_TIERS.items() if v['price_id']}


@api_subscription.route('/tiers', methods=['GET'])
def get_tiers():
    """Return available subscription tiers (public endpoint).
    Accepts ?pricing_tier=emerging_inr to return regional prices."""
    from utils.geo_pricing import PRICING_TIERS, get_tier_display_prices

    pricing_tier = request.args.get('pricing_tier', 'standard')
    tier_config = PRICING_TIERS.get(pricing_tier, PRICING_TIERS['standard'])
    display_prices = get_tier_display_prices(pricing_tier)

    tiers = []
    for key, tier in SUBSCRIPTION_TIERS.items():
        regional = display_prices.get(key, {})
        tiers.append({
            'id': key,
            'name': tier['name'],
            'credits': tier['credits'],
            'price_minor': regional.get('price_minor', tier['price_cents']),
            'price_display': regional.get('display', f"${tier['price_cents'] / 100:.2f}/mo"),
            'currency': tier_config['currency'],
            'currency_symbol': tier_config['currency_symbol'],
            # Keep legacy fields for backwards compat
            'price_cents': regional.get('price_minor', tier['price_cents']),
            'price_dollars': regional.get('price_minor', tier['price_cents']) / 100,
        })
    return jsonify({
        'tiers': tiers,
        'pricing_tier': pricing_tier,
        'currency': tier_config['currency'],
        'currency_symbol': tier_config['currency_symbol'],
    }), 200


@api_subscription.route('/create-checkout', methods=['POST'])
@requires_auth()
def create_checkout(user, data):
    """Create Stripe Checkout session for a subscription."""
    from utils.geo_pricing import get_pricing_for_user

    tier_key = data.get('tier')
    if tier_key not in SUBSCRIPTION_TIERS:
        return jsonify({'error': f'Invalid tier. Choose from: {", ".join(SUBSCRIPTION_TIERS.keys())}'}), 400

    pricing = get_pricing_for_user(user)
    price_id = SUBSCRIPTION_TIERS[tier_key]['price_id']

    if not price_id:
        return jsonify({'error': 'Subscription tier not configured'}), 500

    # Check if user already has an active subscription
    existing = mongo.db.users.find_one(
        {'email': user['email']},
        {'subscription_status': 1, 'stripe_customer_id': 1}
    )
    if existing and existing.get('subscription_status') == 'active':
        return jsonify({'error': 'You already have an active subscription. Manage it from your account page.'}), 400

    try:
        # Get or create Stripe customer
        stripe_customer_id = existing.get('stripe_customer_id') if existing else None
        if not stripe_customer_id:
            customer = stripe.Customer.create(
                email=user['email'],
                metadata={'user_email': user['email']},
            )
            stripe_customer_id = customer.id
            User.update_fields(user['email'], {'stripe_customer_id': stripe_customer_id})

        checkout_session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            line_items=[{'price': price_id, 'quantity': 1}],
            mode='subscription',
            currency=pricing['stripe_currency'],
            success_url=f'{FRONTEND_URL}/account?subscription_success=true&tier={tier_key}',
            cancel_url=f'{FRONTEND_URL}/pricing?subscription_cancelled=true',
            metadata={
                'type': 'subscription',
                'user_email': user['email'],
                'tier': tier_key,
                'pricing_tier': pricing['tier'],
            },
        )

        print(f"✅ [SUBSCRIPTION] Checkout session created for {SUBSCRIPTION_TIERS[tier_key]['name']} tier ({pricing['tier']}): {checkout_session.id}")
        return jsonify({'checkout_url': checkout_session.url}), 200

    except stripe.error.StripeError as e:
        print(f"❌ [SUBSCRIPTION] Stripe error: {e}")
        return jsonify({'error': 'Failed to create checkout session. Please try again.'}), 500


@api_subscription.route('/create-portal', methods=['POST'])
@requires_auth()
def create_portal(user, data):
    """Create Stripe Customer Portal session for subscription management."""
    db_user = mongo.db.users.find_one(
        {'email': user['email']},
        {'stripe_customer_id': 1}
    )
    stripe_customer_id = db_user.get('stripe_customer_id') if db_user else None

    if not stripe_customer_id:
        return jsonify({'error': 'No billing account found'}), 400

    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=f'{FRONTEND_URL}/account',
        )
        return jsonify({'portal_url': portal_session.url}), 200

    except stripe.error.StripeError as e:
        print(f"❌ [SUBSCRIPTION] Portal error: {e}")
        return jsonify({'error': 'Failed to open billing portal. Please try again.'}), 500


@api_subscription.route('/status', methods=['GET'])
@requires_auth()
def get_status(user):
    """Get user's current subscription status."""
    db_user = mongo.db.users.find_one(
        {'email': user['email']},
        {'subscription_id': 1, 'subscription_status': 1, 'subscription_tier': 1, 'subscription_current_period_end': 1}
    )

    if not db_user or not db_user.get('subscription_tier'):
        return jsonify({'active': False}), 200

    tier_key = db_user.get('subscription_tier')
    tier_config = SUBSCRIPTION_TIERS.get(tier_key, {})

    cancel_at_period_end = False
    sub_id = db_user.get('subscription_id')
    if sub_id and db_user.get('subscription_status') == 'active':
        try:
            sub = stripe.Subscription.retrieve(sub_id)
            cancel_at_period_end = sub.cancel_at_period_end
        except stripe.error.StripeError:
            pass

    return jsonify({
        'active': db_user.get('subscription_status') == 'active',
        'tier': tier_key,
        'tier_name': tier_config.get('name', tier_key),
        'credits_per_month': tier_config.get('credits', 0),
        'status': db_user.get('subscription_status'),
        'current_period_end': db_user.get('subscription_current_period_end').isoformat() if db_user.get('subscription_current_period_end') else None,
        'cancel_at_period_end': cancel_at_period_end,
    }), 200


@api_subscription.route('/cancel', methods=['POST'])
@requires_auth()
def cancel_subscription(user, data):
    """Cancel subscription at end of current billing period."""
    db_user = mongo.db.users.find_one(
        {'email': user['email']},
        {'subscription_id': 1, 'subscription_status': 1}
    )

    sub_id = db_user.get('subscription_id') if db_user else None
    if not sub_id or db_user.get('subscription_status') != 'active':
        return jsonify({'error': 'No active subscription to cancel'}), 400

    try:
        # Cancel at period end — user keeps access until current period expires
        stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        print(f"✅ [SUBSCRIPTION] Cancelled at period end for {user['email']}")
        return jsonify({'message': 'Subscription will be cancelled at the end of the current billing period.'}), 200

    except stripe.error.StripeError as e:
        print(f"❌ [SUBSCRIPTION] Cancel error: {e}")
        return jsonify({'error': 'Failed to cancel subscription. Please try again.'}), 500


@api_subscription.route('/reactivate', methods=['POST'])
@requires_auth()
def reactivate_subscription(user, data):
    """Reactivate a subscription that was set to cancel at period end."""
    db_user = mongo.db.users.find_one(
        {'email': user['email']},
        {'subscription_id': 1, 'subscription_status': 1}
    )

    sub_id = db_user.get('subscription_id') if db_user else None
    if not sub_id or db_user.get('subscription_status') != 'active':
        return jsonify({'error': 'No active subscription to reactivate'}), 400

    try:
        stripe.Subscription.modify(sub_id, cancel_at_period_end=False)
        print(f"✅ [SUBSCRIPTION] Reactivated for {user['email']}")
        return jsonify({'message': 'Subscription reactivated. It will renew automatically.'}), 200

    except stripe.error.StripeError as e:
        print(f"❌ [SUBSCRIPTION] Reactivate error: {e}")
        return jsonify({'error': 'Failed to reactivate subscription. Please try again.'}), 500


@api_subscription.route('/detect-pricing', methods=['GET'])
def detect_pricing():
    """Detect pricing tier from visitor IP (public endpoint, no auth required).
    Used by the frontend pricing page for unauthenticated visitors."""
    from utils.geo_pricing import extract_client_ip, detect_and_resolve
    from config import limiter

    client_ip = extract_client_ip(request)
    result = detect_and_resolve(client_ip)

    return jsonify(result), 200
