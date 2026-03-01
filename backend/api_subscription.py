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
        'price_cents': 499,
    },
    'researcher': {
        'name': 'Researcher',
        'price_id': STRIPE_PRICE_RESEARCHER,
        'credits': 8000,
        'price_cents': 799,
    },
    'professor': {
        'name': 'Professor',
        'price_id': STRIPE_PRICE_PROFESSOR,
        'credits': 10000,
        'price_cents': 999,
    },
}

# Reverse lookup: Stripe price_id → tier key
PRICE_ID_TO_TIER = {v['price_id']: k for k, v in SUBSCRIPTION_TIERS.items() if v['price_id']}


@api_subscription.route('/tiers', methods=['GET'])
def get_tiers():
    """Return available subscription tiers (public endpoint)."""
    tiers = []
    for key, tier in SUBSCRIPTION_TIERS.items():
        tiers.append({
            'id': key,
            'name': tier['name'],
            'credits': tier['credits'],
            'price_cents': tier['price_cents'],
            'price_dollars': tier['price_cents'] / 100,
        })
    return jsonify({'tiers': tiers}), 200


@api_subscription.route('/create-checkout', methods=['POST'])
@requires_auth()
def create_checkout(user, data):
    """Create Stripe Checkout session for a subscription."""
    tier_key = data.get('tier')
    if tier_key not in SUBSCRIPTION_TIERS:
        return jsonify({'error': f'Invalid tier. Choose from: {", ".join(SUBSCRIPTION_TIERS.keys())}'}), 400

    tier = SUBSCRIPTION_TIERS[tier_key]
    if not tier['price_id']:
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
            line_items=[{'price': tier['price_id'], 'quantity': 1}],
            mode='subscription',
            success_url=f'{FRONTEND_URL}/account?subscription_success=true&tier={tier_key}',
            cancel_url=f'{FRONTEND_URL}/pricing?subscription_cancelled=true',
            metadata={
                'type': 'subscription',
                'user_email': user['email'],
                'tier': tier_key,
            },
        )

        print(f"✅ [SUBSCRIPTION] Checkout session created for {tier['name']} tier: {checkout_session.id}")
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

    return jsonify({
        'active': db_user.get('subscription_status') == 'active',
        'tier': tier_key,
        'tier_name': tier_config.get('name', tier_key),
        'credits_per_month': tier_config.get('credits', 0),
        'status': db_user.get('subscription_status'),
        'current_period_end': db_user.get('subscription_current_period_end').isoformat() if db_user.get('subscription_current_period_end') else None,
    }), 200
