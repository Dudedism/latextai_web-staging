"""
Test for Claim-Free Race Condition Vulnerability

This test suite verifies that users cannot bypass the "one free upload" rule
by sending multiple simultaneous claim-free requests (race condition exploit).

Security Issue:
- A malicious user could spam the claim-free button to send multiple parallel requests
- If the `free_project_id` check and set operations are not atomic,
  multiple claims could all pass the check before any sets the field

Expected Behavior:
- Only ONE claim-free request should succeed with HTTP 200
- All other simultaneous requests should fail with HTTP 409 (Conflict)

Test Strategy:
1. Create a verified test user with free_project_id=None
2. Create 3 uploaded projects in the database (status='uploaded', paid=False)
3. Launch 3 parallel claim-free requests for EACH project (9 total parallel requests)
4. Verify that only ONE request succeeded across all 9 attempts
"""

import os
import pytest
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime

# Import database models and test utilities
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import mongo, User, Project
from app import app
from tests.test_utils import create_test_user, create_test_project, delete_test_user

# Base URL from environment variable (no default - must be set)
BASE_URL = os.getenv('BACKEND_URL')


@pytest.fixture(scope="module")
def test_user_with_projects():
    """Create a verified test user with 3 uploaded projects."""
    with app.app_context():
        # Create verified test user with tokens
        user = create_test_user(
            name="Claim Free Race Test User",
            is_verified=True,
            free_project_id=None,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )

        # Create 3 uploaded projects directly in database
        project_ids = []
        for i in range(3):
            project = create_test_project(
                user_email=user['email'],
                upload_filename=f"test_document_{i+1}.docx",
                template='ieee',
                status='uploaded',  # Must be 'uploaded' to claim free
                paid=False,  # Must be unpaid to claim free
                total_cost=4.99,
                filesize=50000,
                page_count=10,
                word_count=3000,
                validated=True,  # Must be validated
                card_verified_at=datetime.utcnow(),  # Card must be verified
                mongo_db=mongo.db
            )
            project_ids.append(project['project_id'])
            print(f"✅ Created project {i+1}: {project['project_id']}")

        print(f"\n📦 Test setup complete:")
        print(f"   User: {user['email']}")
        print(f"   Projects: {len(project_ids)}")
        print(f"   Free project: None")

        user['project_ids'] = project_ids

        yield user

        # Cleanup: Delete user and all their projects
        delete_test_user(user['email'], mongo.db)


@pytest.fixture(scope="module")
def test_user_token(test_user_with_projects):
    """Return test user with tokens (already logged in)."""
    return test_user_with_projects


def claim_free_request(access_token, project_id, request_id):
    """
    Helper function to perform a single claim-free request.

    Args:
        access_token: JWT access token
        project_id: Project UUID to claim free upload for
        request_id: Identifier for this request (for logging)

    Returns:
        dict with request_id, status_code, response_data
    """
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "project_id": project_id
    }

    print(f"🚀 [Request {request_id}] Claiming free for project {project_id[:8]}...")

    try:
        response = requests.post(
            f"{BASE_URL}/api/latex/claim-free",
            headers=headers,
            json=payload,
            timeout=10
        )

        status_code = response.status_code
        response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        symbol = "✅" if status_code == 200 else "❌"
        print(f"{symbol} [Request {request_id}] Response: {status_code}")

        return {
            "request_id": request_id,
            "project_id": project_id,
            "status_code": status_code,
            "response_data": response_data
        }
    except Exception as e:
        print(f"❌ [Request {request_id}] Exception: {e}")
        return {
            "request_id": request_id,
            "project_id": project_id,
            "status_code": None,
            "response_data": {"error": str(e)},
            "exception": e
        }


def test_parallel_claim_free_race_condition(test_user_token):
    """
    TEST: Parallel Claim-Free Race Condition

    This test sends 9 simultaneous claim-free requests (3 per project) to check
    if the atomic MongoDB operation properly prevents multiple claims.

    Test Strategy:
    - 3 projects, each gets 3 parallel claim-free attempts
    - Total: 9 parallel requests competing for 1 free upload

    Expected Results:
    1. Only ONE request should succeed (HTTP 200)
    2. All other 8 requests should fail with HTTP 409 (Conflict)
    3. Database should show free_project_id is set
    4. Only ONE project should be marked as paid
    """
    print("\n" + "="*80)
    print("TEST: Parallel Claim-Free Race Condition (9 Simultaneous Requests)")
    print("="*80)

    access_token = test_user_token['access_token']
    project_ids = test_user_token['project_ids']

    print(f"\n📋 Test configuration:")
    print(f"   Projects: {len(project_ids)}")
    print(f"   Requests per project: 3")
    print(f"   Total parallel requests: {len(project_ids) * 3}")

    # Prepare all requests
    num_requests_per_project = 3
    all_requests = []

    request_counter = 0
    for project_id in project_ids:
        for _ in range(num_requests_per_project):
            all_requests.append((access_token, project_id, request_counter))
            request_counter += 1

    print(f"\n🚀 Launching {len(all_requests)} parallel claim-free requests...")
    print("="*80)

    results = []

    # Execute all requests in parallel
    with ThreadPoolExecutor(max_workers=len(all_requests)) as executor:
        # Submit all requests simultaneously
        futures = [
            executor.submit(claim_free_request, *req)
            for req in all_requests
        ]

        # Collect results as they complete
        for future in as_completed(futures):
            result = future.result()
            results.append(result)

    # Sort results by request_id for consistent output
    results.sort(key=lambda x: x['request_id'])

    print("\n" + "="*80)
    print("RESULTS SUMMARY:")
    print("="*80)

    # Group results by project
    for project_id in project_ids:
        project_results = [r for r in results if r['project_id'] == project_id]
        print(f"\nProject {project_id[:8]}:")
        for result in project_results:
            status = result['status_code']
            req_id = result['request_id']
            symbol = "✅" if status == 200 else "❌"
            print(f"  {symbol} Request {req_id}: HTTP {status}")
            if status not in [200, 409]:
                print(f"      Response: {result['response_data']}")

    # ASSERTION 1: Count successful claims
    successful_claims = [r for r in results if r['status_code'] == 200]
    failed_claims_409 = [r for r in results if r['status_code'] == 409]  # Free upload already used
    failed_claims_400 = [r for r in results if r['status_code'] == 400]  # Project already paid (race condition on same project)
    failed_claims_total = failed_claims_409 + failed_claims_400
    other_responses = [r for r in results if r['status_code'] not in [200, 409, 400]]

    print(f"\n📊 RESULTS:")
    print(f"   ✅ Successful claims: {len(successful_claims)}")
    print(f"   ❌ Failed claims (409 - Free upload used): {len(failed_claims_409)}")
    print(f"   ❌ Failed claims (400 - Project already paid): {len(failed_claims_400)}")
    print(f"   ⚠️  Other responses: {len(other_responses)}")

    # CRITICAL ASSERTION: Only 1 claim should succeed
    assert len(successful_claims) == 1, (
        f"Expected exactly 1 successful claim, got {len(successful_claims)}. "
        f"RACE CONDITION VULNERABILITY DETECTED!"
    )

    # ASSERTION 2: All failed claims should return 409 or 400
    # 409 = Free upload already used (atomic check passed)
    # 400 = Project already paid (race condition on same project - acceptable)
    assert len(failed_claims_total) == 8, (
        f"Expected 8 failed claims (409 or 400), got {len(failed_claims_total)}"
    )

    # ASSERTION 2b: All 400 errors should be for the SAME project
    # If 400s occur across multiple projects, that means multiple projects were marked as paid (CRITICAL BUG)
    if len(failed_claims_400) > 0:
        projects_with_400 = set([r['project_id'] for r in failed_claims_400])
        assert len(projects_with_400) == 1, (
            f"400 errors should only occur for ONE project (the one that succeeded), "
            f"but got 400s for {len(projects_with_400)} projects: {projects_with_400}. "
            f"MULTIPLE PROJECTS WERE MARKED AS PAID - CRITICAL RACE CONDITION!"
        )
        print(f"   ℹ️  All 400 errors are for same project: {list(projects_with_400)[0][:8]} (expected)")

    # ASSERTION 3: No unexpected response codes
    assert len(other_responses) == 0, (
        f"Got {len(other_responses)} unexpected response codes: {[r['status_code'] for r in other_responses]}"
    )

    # ASSERTION 4: Verify database state
    print(f"\n🔍 Verifying database state...")
    with app.app_context():
        # Check user's free_project_id is set
        user = User.find_by_email(test_user_token['email'])
        assert user is not None, "User not found in database"
        assert user.get('free_project_id') is not None, "User's free_project_id should be set"
        print(f"   ✅ User free_project_id = {user.get('free_project_id')[:8]}...")

        # Count paid projects
        paid_projects = 0
        for project_id in project_ids:
            project = Project.find_by_id(project_id)
            if project and project.get('paid'):
                paid_projects += 1

        assert paid_projects == 1, f"Expected 1 paid project, got {paid_projects}"

        # Verify the free_project_id matches the paid project
        assert user.get('free_project_id') in project_ids, "free_project_id should be one of the test projects"
        print(f"   ✅ Exactly 1 project marked as paid")

    print("\n" + "="*80)
    print("✅ TEST PASSED: Race condition properly prevented by atomic operation")
    print("="*80)


def test_claim_free_already_used(test_user_token):
    """
    TEST: Claim-Free After Already Used

    This test verifies that after the free upload has been claimed,
    subsequent attempts are properly rejected.

    Expected Results:
    1. Request should fail with HTTP 409 (Conflict)
    2. Error message should indicate free upload already used
    """
    print("\n" + "="*80)
    print("TEST: Claim-Free After Already Used")
    print("="*80)

    access_token = test_user_token['access_token']
    # Use any project ID (doesn't matter since free is already used)
    project_id = test_user_token['project_ids'][1]

    print(f"\n📤 Attempting to claim free for project {project_id[:8]}...")

    result = claim_free_request(access_token, project_id, "post-race")

    print(f"\n📥 Response: HTTP {result['status_code']}")
    print(f"   Data: {result['response_data']}")

    # Should get 409 Conflict
    assert result['status_code'] == 409, (
        f"Expected HTTP 409 (free upload already used), got {result['status_code']}"
    )

    # Check error message
    assert 'error' in result['response_data'], "Response should contain error message"
    error_msg = result['response_data']['error'].lower()
    assert 'already used' in error_msg or 'already claimed' in error_msg, (
        f"Error message should mention 'already used', got: {result['response_data']['error']}"
    )

    print("\n✅ TEST PASSED: Subsequent claim properly rejected")
    print("="*80)




if __name__ == "__main__":
    print("""
    ╔══════════════════════════════════════════════════════════════════════════════╗
    ║                 CLAIM-FREE RACE CONDITION SECURITY TEST                      ║
    ╚══════════════════════════════════════════════════════════════════════════════╝

    This test suite checks for a critical security vulnerability where users could
    bypass the "one free upload" limit by sending multiple simultaneous claim-free
    requests for different projects.

    Test Strategy:
    - Create 1 verified user with 3 uploaded projects
    - Launch 9 parallel claim-free requests (3 per project)
    - Verify only 1 request succeeds (atomic MongoDB operation)

    To run this test:
    1. Start the backend server: python app.py
    2. Run pytest: pytest tests/test_claim_free_race_condition.py -v -s

    Expected Output:
    ✅ Only 1 claim-free request succeeds (HTTP 200)
    ❌ 8 claim-free requests fail (HTTP 409 Conflict)
    ✅ Database shows free_project_id is set
    ✅ Only 1 project is marked as paid
    """)
