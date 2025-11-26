import stripe
from stripe import SignatureVerificationError
from flask import jsonify, Blueprint, request
from api_auth import requires_auth
from database import Project, User, mongo
from datetime import datetime
from config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL

api_stripe = Blueprint('api_stripe_blueprint', __name__, url_prefix='/api/stripe')

stripe.api_key = STRIPE_SECRET_KEY

@api_stripe.route('/create-checkout-session', methods=['POST'])
@requires_auth(require_verified=True)
def create_checkout_session(user, data):
    """
    Create Stripe Checkout session with dynamic pricing.

    Request body:
        {
            "project_id": "uuid-here"
        }

    Returns:
        {
            "checkout_url": "https://checkout.stripe.com/..."
        }

    Flow:
        1. Validate project exists and belongs to user
        2. Get cost from project (already calculated during validation)
        3. Create Stripe Checkout session with dynamic price_data
        4. Return checkout URL to frontend
    """
    project_id = data.get('project_id')

    if not project_id:
        return jsonify({'error': 'project_id is required'}), 400

    # STEP 1: Find project
    project = Project.find_by_id(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404

    # STEP 2: Verify ownership
    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    # STEP 3: Check project is validated
    if not project.get('validated', False):
        return jsonify({
            'error': 'Project must be validated before payment',
            'requires_validation': True
        }), 400

    # STEP 4: Check if already paid
    if project.get('paid', False):
        return jsonify({'error': 'Project already paid'}), 409

    # STEP 5: Get cost from project
    total_cost = project.get('total_cost')
    page_count = project.get('page_count')
    filename = project.get('upload_filename', 'document.docx')

    if total_cost is None or page_count is None:
        return jsonify({'error': 'Project cost not calculated'}), 400

    # STEP 6: Convert to cents for Stripe
    total_cents = int(total_cost * 100)

    try:
        # STEP 7: Create Stripe Checkout session with dynamic pricing
        checkout_session = stripe.checkout.Session.create(
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': total_cents,
                    'product_data': {
                        'name': 'LaTeX Document Conversion',
                        'description': f'{page_count} pages - {filename}',
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{FRONTEND_URL}/papers/{project_id}/view?payment_success=true',
            cancel_url=f'{FRONTEND_URL}/papers/{project_id}/payment?payment_cancelled=true',
            metadata={
                'project_id': project_id,
                'user_email': user['email'],
                'page_count': page_count,
            },
        )

        print(f"✅ [STRIPE] Checkout session created: {checkout_session.id} for project {project_id}")
        print(f"💰 [STRIPE] Amount: ${total_cost} ({total_cents} cents)")

        # STEP 8: Return checkout URL
        return jsonify({
            'checkout_url': checkout_session.url
        }), 200

    except stripe.error.StripeError as e:
        print(f"❌ [STRIPE] Error creating checkout session: {str(e)}")
        return jsonify({
            'error': f'Failed to create checkout session: {str(e)}'
        }), 500


@api_stripe.route('/create-setup-session', methods=['POST'])
@requires_auth(require_verified=True)
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

    if project.get('user_id') != user['email']:
        return jsonify({'error': 'Unauthorized'}), 403

    if not project.get('validated', False):
        return jsonify({
            'error': 'Project must be validated before payment',
            'requires_validation': True
        }), 400

    if project.get('paid', False):
        return jsonify({'error': 'Project already paid'}), 409

    if User.has_used_free_upload(user['email']):
        return jsonify({'error': 'Free upload already used'}), 409

    try:
        checkout_session = stripe.checkout.Session.create(
            mode='setup',
            currency='usd',
            success_url=f'{FRONTEND_URL}/papers/{project_id}/payment?setup_success=true&session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{FRONTEND_URL}/papers/{project_id}/payment?setup_cancelled=true',
            metadata={
                'project_id': project_id,
                'user_email': user['email'],
                'session_type': 'free_upload_verification',
            },
        )

        print(f"✅ [STRIPE] Setup session created: {checkout_session.id} for project {project_id}")

        return jsonify({
            'checkout_url': checkout_session.url
        }), 200

    except stripe.error.StripeError as e:
        print(f"❌ [STRIPE] Error creating setup session: {str(e)}")
        return jsonify({
            'error': f'Failed to create setup session: {str(e)}'
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


def extract_fingerprint_from_payment_session(session):
    """
    Extract card fingerprint from a payment mode checkout session.
    """
    payment_intent_id = session.get('payment_intent')
    if not payment_intent_id:
        return None

    try:
        payment_intent = stripe.PaymentIntent.retrieve(
            payment_intent_id,
            expand=['payment_method']
        )
        payment_method = payment_intent.payment_method
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
        - checkout.session.completed (mode=payment): Mark project as paid
        - checkout.session.completed (mode=setup): Store card fingerprint for free upload verification

    Flow:
        1. Verify webhook signature
        2. Parse event
        3. Route to appropriate handler based on session mode
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

        project_id = session.get('metadata', {}).get('project_id')
        user_email = session.get('metadata', {}).get('user_email')

        if not project_id:
            print("❌ [STRIPE] No project_id in session metadata")
            return jsonify({'error': 'No project_id in metadata'}), 400

        if session_mode == 'setup':
            return handle_setup_completed(session, project_id, user_email)
        elif session_mode == 'payment':
            return handle_payment_completed(session, project_id, user_email)
        else:
            print(f"⚠️ [STRIPE] Unknown session mode: {session_mode}")
            return jsonify({'received': True}), 200

    return jsonify({'received': True}), 200


def handle_setup_completed(session, project_id, user_email):
    """
    Handle setup mode completion: extract fingerprint and store on user/project.
    Does NOT mark project as paid. Frontend must call /claim-free after this.
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
        Project.set_card_fingerprint(project_id, fingerprint)

        mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': {
                'stripe_setup_session_id': session['id'],
                'stripe_setup_intent': session.get('setup_intent'),
                'card_verified_at': datetime.utcnow(),
            }}
        )

        print(f"✅ [STRIPE] Fingerprint stored for project {project_id}, user {user_email}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing setup: {str(e)}")
        return jsonify({'error': str(e)}), 500


def handle_payment_completed(session, project_id, user_email):
    """Handle payment mode completion: mark project as paid."""
    print(f"💳 [STRIPE] Payment completed for project {project_id}")

    try:
        project = Project.find_by_id(project_id)
        if not project:
            print(f"❌ [STRIPE] Project {project_id} not found")
            return jsonify({'error': 'Project not found'}), 404

        total_cost = project.get('total_cost', 0.0)

        fingerprint = extract_fingerprint_from_payment_session(session)
        if fingerprint:
            User.add_card_fingerprint(user_email, fingerprint)

        update_data = {
            'paid': True,
            'is_free_project': False,
            'stripe_session_id': session['id'],
            'stripe_payment_intent': session.get('payment_intent'),
            'paid_at': datetime.utcnow(),
            'status': 'validated'
        }
        if fingerprint:
            update_data['card_fingerprint'] = fingerprint

        mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': update_data}
        )

        print(f"✅ [STRIPE] Project {project_id} marked as paid (${total_cost})")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing payment: {str(e)}")
        return jsonify({'error': str(e)}), 500
