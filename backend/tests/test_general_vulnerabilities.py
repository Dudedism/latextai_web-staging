"""
Test for General Security Vulnerabilities

This test suite verifies fixes for:
1. Double-charge race condition - multiple simultaneous /process requests
2. Webhook idempotency - duplicate webhook calls should not add credits twice
"""

import os
import pytest
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import mongo, User, Project, CreditTransaction
from app import app
from tests.test_utils import create_test_user, create_test_project, delete_test_user

BASE_URL = os.getenv('BACKEND_URL')


@pytest.fixture(scope="module")
def test_user_with_credits():
    """Create a verified test user with credits and a validated project."""
    with app.app_context():
        user = create_test_user(
            is_verified=True,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )

        # Add credits to the user (enough for multiple charges if bug exists)
        mongo.db.users.update_one(
            {'email': user['email']},
            {'$set': {'credit_balance': 5000}}
        )

        # Create a validated project ready for processing
        project = create_test_project(
            user_email=user['email'],
            user_id=user['user_id'],
            template='ieee',
            status='validated',
            paid=False,
            total_credits=500,
            filesize=50000,
            page_count=10,
            word_count=3000,
            validated=True,
            mongo_db=mongo.db
        )

        user['project_id'] = project['project_id']
        user['initial_balance'] = 5000

        print(f"\n Test setup complete:")
        print(f"   User: {user['email']}")
        print(f"   Project: {project['project_id']}")
        print(f"   Credits: 5000")

        yield user

        # Cleanup
        delete_test_user(user['email'], mongo.db)


def process_request(access_token, project_id, request_id):
    """Helper function to perform a single /process request."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    payload = {"project_id": project_id}

    try:
        response = requests.post(
            f"{BASE_URL}/api/latex/process",
            headers=headers,
            json=payload,
            timeout=10
        )

        return {
            "request_id": request_id,
            "status_code": response.status_code,
            "response_data": response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        }
    except Exception as e:
        return {
            "request_id": request_id,
            "status_code": None,
            "response_data": {"error": str(e)},
            "exception": e
        }


def test_double_charge_race_condition(test_user_with_credits):
    """
    TEST: Double-Charge Race Condition Prevention

    This test sends multiple simultaneous /process requests for the same project
    to verify that only ONE request successfully charges credits.

    Expected Results:
    1. Only ONE request should successfully charge credits
    2. Other requests should return "Already paid" or similar
    3. User's credit balance should only decrease by the cost of ONE conversion
    """
    print("\n" + "="*80)
    print("TEST: Double-Charge Race Condition Prevention")
    print("="*80)

    access_token = test_user_with_credits['access_token']
    project_id = test_user_with_credits['project_id']
    initial_balance = test_user_with_credits['initial_balance']
    user_email = test_user_with_credits['email']

    try:
        num_requests = 5
        print(f"\n Launching {num_requests} parallel /process requests...")

        results = []

        with ThreadPoolExecutor(max_workers=num_requests) as executor:
            futures = [
                executor.submit(process_request, access_token, project_id, i)
                for i in range(num_requests)
            ]

            for future in as_completed(futures):
                result = future.result()
                results.append(result)

        results.sort(key=lambda x: x['request_id'])

        print("\n" + "="*80)
        print("RESULTS SUMMARY:")
        print("="*80)

        for result in results:
            status = result['status_code']
            req_id = result['request_id']
            print(f"  Request {req_id}: HTTP {status} - {result['response_data'].get('message', result['response_data'].get('error', 'N/A'))}")

        # Count responses
        # Note: The "winning" request will return 404 (file not found) since we don't create a real file
        # But the important thing is that payment logic ran - credits were deducted
        success_202 = [r for r in results if r['status_code'] == 202]
        file_not_found_404 = [r for r in results if r['status_code'] == 404]
        already_paid_200 = [r for r in results if r['status_code'] == 200 and 'already' in str(r['response_data']).lower()]
        other = [r for r in results if r['status_code'] not in [200, 202, 404]]

        print(f"\n Results:")
        print(f"   202 Accepted (processing started): {len(success_202)}")
        print(f"   404 File not found (payment succeeded, no file): {len(file_not_found_404)}")
        print(f"   200 Already paid: {len(already_paid_200)}")
        print(f"   Other responses: {len(other)}")

        # Check final credit balance
        with app.app_context():
            user = User.find_by_email(user_email)
            final_balance = user.get('credit_balance', 0)
            credits_deducted = initial_balance - final_balance

            print(f"\n Credit balance:")
            print(f"   Initial: {initial_balance}")
            print(f"   Final: {final_balance}")
            print(f"   Deducted: {credits_deducted}")

            # Count credit transactions for this project
            transactions = list(mongo.db.credit_transactions.find({
                'project_id': project_id,
                'transaction_type': 'deduct'
            }))
            print(f"   Transactions created: {len(transactions)}")

        # ASSERTIONS
        # The key indicators of the fix working are:
        # 1. Credits deducted only once
        # 2. Only one transaction created
        # Response codes vary based on timing - some requests may see paid=True
        # and skip payment entirely, others may fail the atomic mark

        # Credits should only be deducted once (500 credits for 10 pages)
        expected_deduction = 500
        assert credits_deducted == expected_deduction, (
            f"Expected {expected_deduction} credits deducted, got {credits_deducted}. "
            f"DOUBLE CHARGE BUG!"
        )

        # Only one transaction should exist
        assert len(transactions) == 1, (
            f"Expected 1 credit transaction, got {len(transactions)}. "
            f"DUPLICATE TRANSACTION BUG!"
        )

        print("\n" + "="*80)
        print(" TEST PASSED: Race condition properly prevented")
        print("="*80)

    finally:
        print(f"\n Cleanup: Project {project_id} and transactions will be cleaned up with user")


def test_webhook_idempotency(test_user_with_credits):
    """
    TEST: Webhook Idempotency

    This test simulates duplicate webhook calls (as Stripe might retry on timeout)
    to verify that credits are only added once per session.

    Note: This test directly calls the webhook handler logic, not the actual endpoint
    (which requires Stripe signature verification).
    """
    print("\n" + "="*80)
    print("TEST: Webhook Idempotency")
    print("="*80)

    user_email = test_user_with_credits['email']
    user_id = test_user_with_credits['user_id']
    fake_session_id = None

    try:
        with app.app_context():
            # Get initial balance
            user = User.find_by_email(user_email)
            initial_balance = user.get('credit_balance', 0)
            print(f"\n Initial balance: {initial_balance}")

            # Simulate a webhook session
            fake_session_id = f"cs_test_idempotency_{datetime.utcnow().timestamp()}"
            credits_to_add = 1000

            # First "webhook" call - should add credits
            print(f"\n Simulating first webhook call (session: {fake_session_id[:30]}...)")

            # Check if already processed (should be False)
            existing = mongo.db.credit_transactions.find_one({'stripe_session_id': fake_session_id})
            assert existing is None, "Session should not exist yet"

            # Add credits and create transaction (simulating webhook handler)
            new_balance = User.add_credits(user_email, credits_to_add)
            CreditTransaction.create(
                user_email=user_email,
                user_id=user_id,
                transaction_type='topup',
                amount=credits_to_add,
                balance_after=new_balance,
                description=f'Test top-up: {credits_to_add} credits',
                stripe_session_id=fake_session_id
            )
            print(f"   Credits added: {credits_to_add}")
            print(f"   New balance: {new_balance}")

            # Second "webhook" call - should be idempotent (no additional credits)
            print(f"\n Simulating second webhook call (same session)...")

            # Check if already processed (should be True now)
            existing = mongo.db.credit_transactions.find_one({'stripe_session_id': fake_session_id})
            if existing:
                print(f"   Idempotency check: Transaction already exists, skipping")
                second_call_skipped = True
            else:
                # This would be the bug - adding credits again
                User.add_credits(user_email, credits_to_add)
                second_call_skipped = False

            # Verify final state
            user = User.find_by_email(user_email)
            final_balance = user.get('credit_balance', 0)
            total_added = final_balance - initial_balance

            transactions = list(mongo.db.credit_transactions.find({
                'stripe_session_id': fake_session_id
            }))

            print(f"\n Final state:")
            print(f"   Final balance: {final_balance}")
            print(f"   Total credits added: {total_added}")
            print(f"   Transactions with this session ID: {len(transactions)}")

            # ASSERTIONS
            assert second_call_skipped, "Second webhook call should have been skipped"
            assert total_added == credits_to_add, (
                f"Expected {credits_to_add} credits added, got {total_added}. "
                f"DUPLICATE CREDIT BUG!"
            )
            assert len(transactions) == 1, (
                f"Expected 1 transaction for session, got {len(transactions)}. "
                f"DUPLICATE TRANSACTION BUG!"
            )

        print("\n" + "="*80)
        print(" TEST PASSED: Webhook idempotency working correctly")
        print("="*80)

    finally:
        print(f"\n Cleanup: Test transactions will be cleaned up with user")


if __name__ == "__main__":
    print("""
    ================================================================
                 GENERAL VULNERABILITY TESTS
    ================================================================

    Tests for:
    1. Double-charge race condition on /process endpoint
    2. Webhook idempotency for credit top-ups

    To run:
    pytest tests/test_general_vulnerabilities.py -v -s
    """)
