import stripe
from flask import jsonify, Blueprint, request
from api_auth import requires_auth
from database import User, CreditTransaction
from config import STRIPE_SECRET_KEY, FRONTEND_URL

api_credits = Blueprint('api_credits_blueprint', __name__, url_prefix='/api/credits')

stripe.api_key = STRIPE_SECRET_KEY

MIN_TOPUP_CREDITS = 500


@api_credits.route('/balance', methods=['GET'])
@requires_auth(require_verified=True)
def get_balance(user):
    """Get user's current credit balance"""
    balance = User.get_credit_balance(user['email'])
    return jsonify({
        'balance': balance,
        'formatted': f'${balance / 100:.2f}'
    }), 200


@api_credits.route('/history', methods=['GET'])
@requires_auth(require_verified=True)
def get_history(user):
    """Get user's credit transaction history"""
    limit = request.args.get('limit', 50, type=int)
    limit = min(limit, 100)

    transactions = CreditTransaction.get_user_transactions(user['email'], limit)

    result = []
    for txn in transactions:
        result.append({
            'transaction_id': txn.get('transaction_id'),
            'type': txn.get('transaction_type'),
            'amount': txn.get('amount'),
            'balance_after': txn.get('balance_after'),
            'description': txn.get('description'),
            'project_id': txn.get('project_id'),
            'created_at': txn.get('created_at').isoformat() if txn.get('created_at') else None
        })

    return jsonify({'transactions': result}), 200


@api_credits.route('/topup', methods=['POST'])
@requires_auth(require_verified=True)
def create_topup_session(user, data):
    """
    Create Stripe Checkout session for credit top-up.

    Request body:
        {
            "credits": 500  # minimum 500 (= $5)
        }

    Returns:
        {
            "checkout_url": "https://checkout.stripe.com/..."
        }
    """
    credits = data.get('credits')

    if not credits or not isinstance(credits, int):
        return jsonify({'error': 'credits must be an integer'}), 400

    if credits < MIN_TOPUP_CREDITS:
        return jsonify({
            'error': f'Minimum top-up is {MIN_TOPUP_CREDITS} credits (${MIN_TOPUP_CREDITS / 100:.2f})'
        }), 400

    amount_cents = credits

    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': 'LaTeX.ai Credits',
                        'description': f'{credits} credits',
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{FRONTEND_URL}/credits?topup_success=true&credits={credits}',
            cancel_url=f'{FRONTEND_URL}/credits?topup_cancelled=true',
            metadata={
                'type': 'credit_topup',
                'user_email': user['email'],
                'credits': credits,
            },
        )

        print(f"✅ [CREDITS] Top-up session created: {checkout_session.id} for {user['email']}")
        print(f"💰 [CREDITS] Amount: {credits} credits (${credits / 100:.2f})")

        return jsonify({
            'checkout_url': checkout_session.url
        }), 200

    except stripe.error.StripeError as e:
        print(f"❌ [CREDITS] Error creating top-up session: {str(e)}")
        return jsonify({
            'error': f'Failed to create checkout session: {str(e)}'
        }), 500
