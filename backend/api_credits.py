import stripe
from flask import jsonify, Blueprint, request
from api_auth import requires_auth
from database import User, CreditTransaction
from config import STRIPE_SECRET_KEY, FRONTEND_URL

api_credits = Blueprint('api_credits_blueprint', __name__, url_prefix='/api/credits')

stripe.api_key = STRIPE_SECRET_KEY

MIN_TOPUP_CREDITS = 100
TOPUP_BONUS_CREDITS = 150  # Introductory bonus: extra credits on every top-up
TOPUP_BONUS_MIN_CREDITS = 250  # Bonus only applies for purchases >= $2.50


@api_credits.route('/balance', methods=['GET'])
@requires_auth()
def get_balance(user):
    """Get user's current credit balance (paid + free)"""
    balances = User.get_all_balances(user['email'])
    balance = balances['credit_balance']
    free_balance = balances['free_credit_balance']
    return jsonify({
        'balance': balance,
        'free_balance': free_balance,
        'formatted': f'${balance / 100:.2f}'
    }), 200


@api_credits.route('/history', methods=['GET'])
@requires_auth()
def get_history(user):
    """Get user's credit transaction history"""
    limit = request.args.get('limit', 50, type=int)
    limit = min(limit, 100)

    transactions = CreditTransaction.get_user_transactions(str(user['_id']), limit)

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
@requires_auth()
def create_topup_session(user, data):
    """
    Create Stripe Checkout session for credit top-up.

    Request body:
        {
            "credits": 100  # minimum 100 (= $1)
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

    bonus = TOPUP_BONUS_CREDITS if credits >= TOPUP_BONUS_MIN_CREDITS else 0
    total_credits = credits + bonus
    bonus_desc = f' + {bonus} bonus' if bonus else ''

    try:
        checkout_session = stripe.checkout.Session.create(
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': amount_cents,
                    'product_data': {
                        'name': 'LaTeX.ai Credits',
                        'description': f'{credits} credits{bonus_desc}' + (' (introductory offer)' if bonus else ''),
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            allow_promotion_codes=True,
            success_url=f'{FRONTEND_URL}/credits?topup_success=true&credits={total_credits}',
            cancel_url=f'{FRONTEND_URL}/credits?topup_cancelled=true',
            metadata={
                'type': 'credit_topup',
                'user_email': user['email'],
                'credits': credits,
                'bonus_credits': bonus,
            },
        )

        print(f"✅ [CREDITS] Top-up session created: {checkout_session.id}")
        print(f"💰 [CREDITS] Amount: {credits} credits")

        return jsonify({
            'checkout_url': checkout_session.url
        }), 200

    except stripe.error.StripeError as e:
        print(f"❌ [CREDITS] Stripe error: {e}")
        return jsonify({
            'error': 'Failed to create checkout session. Please try again.'
        }), 500
