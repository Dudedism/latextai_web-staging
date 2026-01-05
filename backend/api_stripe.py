import stripe
from stripe import SignatureVerificationError
from flask import jsonify, Blueprint, request
from api_auth import requires_auth
from database import Project, User, CreditTransaction, mongo
from datetime import datetime
from config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL

api_stripe = Blueprint('api_stripe_blueprint', __name__, url_prefix='/api/stripe')

stripe.api_key = STRIPE_SECRET_KEY

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

    if User.has_claimed_free_project(user['email']):
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


@api_stripe.route('/webhook', methods=['POST'])
def stripe_webhook():
    """
    Handle Stripe webhook events.

    Events handled:
        - checkout.session.completed (type=credit_topup): Add credits to user balance
        - checkout.session.completed (mode=setup): Store card fingerprint for free upload verification
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

    return jsonify({'received': True}), 200


def handle_setup_completed(session, project_id, user_email):
    """
    Handle setup mode completion: extract fingerprint and store on user, mark project as card verified.
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

        mongo.db.projects.update_one(
            {'project_id': project_id},
            {'$set': {
                'stripe_setup_session_id': session['id'],
                'stripe_setup_intent': session.get('setup_intent'),
                'card_verified_at': datetime.utcnow(),
            }}
        )

        print(f"✅ [STRIPE] Card verified for project {project_id}, fingerprint added to user {user_email}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing setup: {str(e)}")
        return jsonify({'error': str(e)}), 500


def handle_credit_topup_completed(session, metadata):
    """Handle credit top-up completion: add credits to user balance."""
    user_email = metadata.get('user_email')
    credits = int(metadata.get('credits', 0))

    if not user_email or not credits:
        print(f"❌ [STRIPE] Missing user_email or credits in metadata")
        return jsonify({'error': 'Invalid metadata'}), 400

    print(f"💳 [STRIPE] Credit top-up completed for {user_email}: {credits} credits")

    try:
        new_balance = User.add_credits(user_email, credits)
        if new_balance is None:
            print(f"❌ [STRIPE] User {user_email} not found")
            return jsonify({'error': 'User not found'}), 404

        CreditTransaction.create(
            user_id=user_email,
            transaction_type='topup',
            amount=credits,
            balance_after=new_balance,
            description=f'Top-up: {credits} credits (${credits / 100:.2f})',
            stripe_session_id=session['id']
        )

        print(f"✅ [STRIPE] Added {credits} credits to {user_email}, new balance: {new_balance}")
        return jsonify({'received': True}), 200

    except Exception as e:
        print(f"❌ [STRIPE] Error processing credit top-up: {str(e)}")
        return jsonify({'error': str(e)}), 500
