import stripe
from stripe import SignatureVerificationError
from flask import jsonify, Blueprint, request
from api_auth import requires_auth
from database import Project, User, CreditTransaction, mongo
from datetime import datetime
from config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL
from api_subscription import SUBSCRIPTION_TIERS, PRICE_ID_TO_TIER

api_stripe = Blueprint('api_stripe_blueprint', __name__, url_prefix='/api/stripe')

stripe.api_key = STRIPE_SECRET_KEY


def get_subscription_period_end(sub):
    """Extract current_period_end from a Stripe subscription object.
    In newer API versions, this moved from the subscription to the item level."""
    # Try item-level first (newer API versions)
    items = sub.get('items', {}).get('data', [])
    if items and items[0].get('current_period_end'):
        return items[0]['current_period_end']
    # Fallback to subscription-level (older API versions)
    return sub.get('current_period_end')

@api_stripe.route('/create-setup-session', methods=['POST'])
@requires_auth()
def create_setup_session(user, data):
    """
    Create Stripe Checkout session in setup mode for free upload card verification.
    This performs a $0 authorization to verify the card without charging.

    Request body:
        {
            "project_id": "uuid-here"
        }

    Returns:
        {
            "checkout_url": "https://checkout.stripe.com/..."
        }
    """
    project_id = data.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    if project.get('user_id') != str(user['_id']):
        return jsonify({'error': 'Unauthorized'}), 403

    if not project.get('validated', False):
        return jsonify({
            'error': 'Project must be validated before payment',
            'requires_validation': True
        }), 400

    if project.get('paid', False):
        return jsonify({'error': 'Project already paid'}), 409

    try:
        checkout_session = stripe.checkout.Session.create(
            mode='setup',
            currency='usd',
            success_url=f'{FRONTEND_URL}/papers/{project_id}/view?setup_success=true&session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{FRONTEND_URL}/papers/{project_id}/view?setup_cancelled=true',
            metadata={
                'project_id': project_id,
                'user_email': user['email'],
                'session_type': 'free_upload_verification',
            },
        )

        print(f"✅ [STRIPE] Setup session created for project {project_id}")

        return jsonify({
            'checkout_url': checkout_session.url
        }), 200

    except stripe.error.StripeError as e:
        print(f"❌ [STRIPE] Error creating setup session: {e}")
        return jsonify({
            'error': 'Failed to create setup session. Please try again.'
        }), 500


def extract_fingerprint_from_setup_session(session):
    """
    Extract card fingerprint from a setup mode checkout session.
    Uses Stripe API expansion to get fingerprint in minimal calls.
    """
    setup_intent_id = session.get('setup_intent')
    if not setup_intent_id:
        return None

    try:
        setup_intent = stripe.SetupIntent.retrieve(
            setup_intent_id,
            expand=['payment_method']
        )
        payment_method = setup_intent.payment_method
        if payment_method and hasattr(payment_method, 'card') and payment_method.card:
            return payment_method.card.fingerprint
    except stripe.error.StripeError as e:
        print(f"❌ [STRIPE] Error retrieving fingerprint: {str(e)}")
    return None


@api_stripe.route('/webhook', methods=['POST'])
def stripe_webhook():
    """
    Handle Stripe webhook events.

    Events handled:
        - checkout.session.completed (type=credit_topup): Add credits to user balance
        - checkout.session.completed (type=subscription): Activate subscription + grant credits
        - checkout.session.completed (mode=setup): Store card fingerprint for free upload verification
        - invoice.payment_succeeded: Monthly subscription renewal credits
        - customer.subscription.updated: Subscription plan changes
        - customer.subscription.deleted: Subscription cancellation
    """
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')

    if not sig_header:
        print("❌ [STRIPE] No signature header")
        return jsonify({'error': 'No signature header'}), 400

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
        print(f"✅ [STRIPE] Webhook verified: {event['type']}")

    except ValueError as e:
        print(f"❌ [STRIPE] Invalid payload: {str(e)}")
        return jsonify({'error': 'Invalid payload'}), 400
    except SignatureVerificationError as e:
        print(f"❌ [STRIPE] Invalid signature: {str(e)}")
        return jsonify({'error': 'Invalid signature'}), 400

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        session_mode = session.get('mode')
        metadata = session.get('metadata', {})

        if metadata.get('type') == 'credit_topup':
            return handle_credit_topup_completed(session, metadata)

        if metadata.get('type') == 'subscription':
            return handle_subscription_checkout_completed(session, metadata)

        project_id = metadata.get('project_id')
        user_email = metadata.get('user_email')

        if not project_id:
            print("❌ [STRIPE] No project_id in session metadata")
            return jsonify({'error': 'No project_id in metadata'}), 400

        if session_mode == 'setup':
            return handle_setup_completed(session, project_id, user_email)
        else:
            print(f"⚠️ [STRIPE] Unknown session mode: {session_mode}")
            return jsonify({'received': True}), 200

    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        return handle_invoice_payment_succeeded(invoice)

    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        return handle_subscription_updated(subscription)

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        return handle_subscription_deleted(subscription)

    return jsonify({'received': True}), 200


def handle_setup_completed(session, project_id, user_email):
    """
    Handle setup mode completion: extract fingerprint and store on user, mark project as card verified.
    Does NOT mark project as paid.
    """
    print(f"🔐 [STRIPE] Setup completed for project {project_id}")

    fingerprint = extract_fingerprint_from_setup_session(session)
    if not fingerprint:
        print(f"❌ [STRIPE] Could not extract fingerprint for project {project_id}")
        return jsonify({'error': 'Could not extract card fingerprint'}), 500

    try:
        project = Project.find_by_id(project_id)
        if not project:
            print(f"❌ [STRIPE] Project {project_id} not found")
            return jsonify({'error': 'Project not found'}), 404

        User.add_card_fingerprint(user_email, fingerprint)

        mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': {
                'stripe_setup_session_id': session['id'],
                'stripe_setup_intent': session.get('setup_intent'),
                'card_verified_at': datetime.utcnow(),
            }}
        )

        print(f"✅ [STRIPE] Card verified for project {project_id}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing setup: {e}")
        return jsonify({'error': 'Failed to process card verification'}), 500


def handle_subscription_checkout_completed(session, metadata):
    """Handle subscription checkout: activate subscription and grant initial credits."""
    user_email = metadata.get('user_email')
    tier_key = metadata.get('tier')
    session_id = session['id']
    subscription_id = session.get('subscription')

    if not user_email or not tier_key:
        print(f"❌ [STRIPE] Missing user_email or tier in subscription metadata")
        return jsonify({'error': 'Invalid metadata'}), 400

    tier = SUBSCRIPTION_TIERS.get(tier_key)
    if not tier:
        print(f"❌ [STRIPE] Unknown subscription tier: {tier_key}")
        return jsonify({'error': 'Unknown tier'}), 400

    print(f"💳 [STRIPE] Subscription checkout completed: {tier['name']} for {user_email}")

    try:
        # Idempotency: check if this session was already processed
        existing_txn = mongo.db.credit_transactions.find_one({'stripe_session_id': session_id})
        if existing_txn:
            print(f"⚠️  [STRIPE] Subscription checkout already processed for session {session_id}")
            return jsonify({'received': True}), 200

        user = User.find_by_email(user_email)
        if not user:
            print(f"❌ [STRIPE] User not found: {user_email}")
            return jsonify({'error': 'User not found'}), 404

        # Retrieve subscription details from Stripe
        sub = stripe.Subscription.retrieve(subscription_id)
        period_end_ts = get_subscription_period_end(sub)
        current_period_end = datetime.utcfromtimestamp(period_end_ts) if period_end_ts else None

        # Update user subscription fields
        User.update_fields(user_email, {
            'subscription_id': subscription_id,
            'subscription_status': 'active',
            'subscription_tier': tier_key,
            'subscription_current_period_end': current_period_end,
            'stripe_customer_id': session.get('customer'),
        })

        # Grant credits
        credits = tier['credits']
        new_balance = User.add_credits(user_email, credits)

        CreditTransaction.create(
            user_email=user_email,
            user_id=str(user['_id']),
            transaction_type='subscription',
            amount=credits,
            balance_after=new_balance,
            description=f'Subscription: {tier["name"]} — {credits} credits',
            stripe_session_id=session_id,
        )

        print(f"✅ [STRIPE] Subscription activated: {tier['name']}, +{credits} credits, balance: {new_balance}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing subscription checkout: {e}")
        return jsonify({'error': 'Failed to process subscription'}), 500


def handle_invoice_payment_succeeded(invoice):
    """Handle monthly subscription renewal: grant credits for the new billing period."""
    # Only handle subscription invoices (not one-time payments)
    subscription_id = invoice.get('subscription')
    if not subscription_id:
        return jsonify({'received': True}), 200

    # Skip the first invoice — that's handled by checkout.session.completed
    billing_reason = invoice.get('billing_reason')
    if billing_reason == 'subscription_create':
        print(f"⚠️  [STRIPE] Skipping initial subscription invoice (handled by checkout)")
        return jsonify({'received': True}), 200

    invoice_id = invoice['id']
    customer_id = invoice.get('customer')

    print(f"💳 [STRIPE] Subscription renewal invoice: {invoice_id}")

    try:
        # Idempotency
        existing_txn = mongo.db.credit_transactions.find_one({'stripe_invoice_id': invoice_id})
        if existing_txn:
            print(f"⚠️  [STRIPE] Invoice already processed: {invoice_id}")
            return jsonify({'received': True}), 200

        # Find user by stripe_customer_id
        db_user = mongo.db.users.find_one({'stripe_customer_id': customer_id})
        if not db_user:
            print(f"❌ [STRIPE] No user found for customer {customer_id}")
            return jsonify({'error': 'User not found'}), 404

        user_email = db_user['email']
        tier_key = db_user.get('subscription_tier')
        tier = SUBSCRIPTION_TIERS.get(tier_key)

        if not tier:
            print(f"❌ [STRIPE] Unknown tier {tier_key} for user {user_email}")
            return jsonify({'error': 'Unknown tier'}), 400

        # Update period end
        sub = stripe.Subscription.retrieve(subscription_id)
        period_end_ts = get_subscription_period_end(sub)
        current_period_end = datetime.utcfromtimestamp(period_end_ts) if period_end_ts else None
        User.update_fields(user_email, {
            'subscription_status': 'active',
            'subscription_current_period_end': current_period_end,
        })

        # Grant monthly credits
        credits = tier['credits']
        new_balance = User.add_credits(user_email, credits)

        CreditTransaction.create(
            user_email=user_email,
            user_id=str(db_user['_id']),
            transaction_type='subscription_renewal',
            amount=credits,
            balance_after=new_balance,
            description=f'Renewal: {tier["name"]} — {credits} credits',
            stripe_invoice_id=invoice_id,
        )

        print(f"✅ [STRIPE] Renewal: {tier['name']}, +{credits} credits for {user_email}, balance: {new_balance}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing renewal: {e}")
        return jsonify({'error': 'Failed to process renewal'}), 500


def handle_subscription_updated(subscription):
    """Handle subscription plan changes (upgrade/downgrade)."""
    subscription_id = subscription['id']
    customer_id = subscription.get('customer')
    status = subscription.get('status')

    print(f"🔄 [STRIPE] Subscription updated: {subscription_id}, status: {status}")

    try:
        db_user = mongo.db.users.find_one({'stripe_customer_id': customer_id})
        if not db_user:
            print(f"❌ [STRIPE] No user found for customer {customer_id}")
            return jsonify({'error': 'User not found'}), 404

        user_email = db_user['email']

        # Determine new tier from subscription items
        new_tier_key = None
        items = subscription.get('items', {}).get('data', [])
        for item in items:
            price_id = item.get('price', {}).get('id')
            if price_id in PRICE_ID_TO_TIER:
                new_tier_key = PRICE_ID_TO_TIER[price_id]
                break

        update_fields = {
            'subscription_status': status,
        }
        if new_tier_key:
            update_fields['subscription_tier'] = new_tier_key

        period_end_ts = get_subscription_period_end(subscription)
        if period_end_ts:
            update_fields['subscription_current_period_end'] = datetime.utcfromtimestamp(period_end_ts)

        User.update_fields(user_email, update_fields)

        print(f"✅ [STRIPE] Subscription updated for {user_email}: tier={new_tier_key}, status={status}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error updating subscription: {e}")
        return jsonify({'error': 'Failed to update subscription'}), 500


def handle_subscription_deleted(subscription):
    """Handle subscription cancellation."""
    subscription_id = subscription['id']
    customer_id = subscription.get('customer')

    print(f"🚫 [STRIPE] Subscription cancelled: {subscription_id}")

    try:
        db_user = mongo.db.users.find_one({'stripe_customer_id': customer_id})
        if not db_user:
            print(f"❌ [STRIPE] No user found for customer {customer_id}")
            return jsonify({'error': 'User not found'}), 404

        user_email = db_user['email']

        # Mark subscription as cancelled but keep credits
        User.update_fields(user_email, {
            'subscription_status': 'cancelled',
        })

        print(f"✅ [STRIPE] Subscription cancelled for {user_email}. Credits retained.")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error cancelling subscription: {e}")
        return jsonify({'error': 'Failed to cancel subscription'}), 500


def handle_credit_topup_completed(session, metadata):
    """Handle credit top-up completion: add credits + introductory bonus to user balance."""
    user_email = metadata.get('user_email')
    credits = int(metadata.get('credits', 0))
    bonus_credits = int(metadata.get('bonus_credits', 0))
    total_credits = credits + bonus_credits
    session_id = session['id']

    if not user_email or not credits:
        print(f"❌ [STRIPE] Missing user_email or credits in metadata")
        return jsonify({'error': 'Invalid metadata'}), 400

    print(f"💳 [STRIPE] Credit top-up completed: {credits} credits + {bonus_credits} bonus")

    try:
        # IDEMPOTENCY CHECK: Prevent duplicate credit additions from webhook retries
        existing_txn = mongo.db.credit_transactions.find_one({'stripe_session_id': session_id})
        if existing_txn:
            print(f"⚠️  [STRIPE] Webhook already processed for session {session_id} (idempotent)")
            return jsonify({'received': True}), 200

        user = User.find_by_email(user_email)
        if not user:
            print(f"❌ [STRIPE] User not found")
            return jsonify({'error': 'User not found'}), 404

        new_balance = User.add_credits(user_email, total_credits)
        if new_balance is None:
            print(f"❌ [STRIPE] Failed to add credits")
            return jsonify({'error': 'Failed to add credits'}), 500

        bonus_desc = f' + {bonus_credits} bonus' if bonus_credits else ''
        CreditTransaction.create(
            user_email=user_email,
            user_id=str(user['_id']),
            transaction_type='topup',
            amount=total_credits,
            balance_after=new_balance,
            description=f'Top-up: {credits} credits{bonus_desc} (${credits / 100:.2f})',
            stripe_session_id=session_id
        )

        print(f"✅ [STRIPE] Added {total_credits} credits ({credits} + {bonus_credits} bonus), new balance: {new_balance}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing credit top-up: {e}")
        return jsonify({'error': 'Failed to process credit top-up'}), 500
