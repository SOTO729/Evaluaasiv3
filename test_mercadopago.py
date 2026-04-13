"""
Test MercadoPago Payment Flow - DEV Environment
Tests the candidate payment process end-to-end using MP test cards.

Usage:
    python test_mercadopago.py
"""
import requests
import json
import sys

# ─── Config ──────────────────────────────────────────────────────────────────
BASE_URL = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
MP_PUBLIC_KEY = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"
MP_API_URL = "https://api.mercadopago.com"

# Payer email for test mode (must NOT be @testuser.com — that domain is reserved by MP)
MP_TEST_BUYER_EMAIL = "buyer_test@example.com"

# Candidate credentials (generated for testing)
CANDIDATE_USERNAME = "GENERAGUATE3"
CANDIDATE_PASSWORD = "pX74NMy9KvJV"

# Test card data - Visa APPROVED
TEST_CARD = {
    "card_number": "4075595716483764",
    "security_code": "123",
    "expiration_month": 11,
    "expiration_year": 2030,
    "cardholder": {
        "name": "APRO",  # APRO = approved
        "identification": {
            "type": "DNI",
            "number": "12345678"
        }
    }
}

# Test card for REJECTED scenario
TEST_CARD_REJECTED = {
    "card_number": "4075595716483764",
    "security_code": "123",
    "expiration_month": 11,
    "expiration_year": 2030,
    "cardholder": {
        "name": "OTHE",  # OTHE = rejected general error
        "identification": {
            "type": "DNI",
            "number": "12345678"
        }
    }
}

passed = 0
failed = 0
errors = []


def test(name, condition, detail=""):
    global passed, failed, errors
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        errors.append(f"{name}: {detail}")
        print(f"  ❌ {name} — {detail}")


def login(username, password):
    """Login and return token"""
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "username": username,
        "password": password
    }, timeout=30)
    if r.status_code == 200:
        return r.json().get("access_token")
    print(f"  ⚠️ Login failed for {username}: {r.status_code} - {r.text[:200]}")
    return None


def create_card_token(card_data):
    """Create a card token using MP's public key (simulates frontend tokenization)"""
    url = f"{MP_API_URL}/v1/card_tokens?public_key={MP_PUBLIC_KEY}"
    r = requests.post(url, json=card_data, timeout=15)
    if r.status_code in (200, 201):
        data = r.json()
        return data.get("id")
    print(f"  ⚠️ Token creation failed: {r.status_code} - {r.text[:300]}")
    return None


def main():
    global passed, failed

    print("=" * 60)
    print("MercadoPago Payment Flow Test - DEV")
    print("=" * 60)

    # ─── Step 1: Login as candidate ──────────────────────────────────────
    print("\n--- Step 1: Candidate Login ---")
    token = login(CANDIDATE_USERNAME, CANDIDATE_PASSWORD)
    test("Candidate login", token is not None, "Could not login")
    if not token:
        print("Cannot continue without login")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # ─── Step 2: Get candidate exams ─────────────────────────────────────
    print("\n--- Step 2: Get Candidate Exams ---")
    r = requests.get(f"{BASE_URL}/partners/mis-examenes", headers=headers, timeout=30)
    test("Get mis-examenes", r.status_code == 200, f"Status: {r.status_code}")

    if r.status_code == 200:
        exams = r.json().get("exams", [])
        test("Has exams assigned", len(exams) > 0, f"Found {len(exams)} exams")

        # Find an exam that requires payment and is not paid
        payable_exam = None
        for ex in exams:
            if ex.get("requires_payment") and not ex.get("is_paid"):
                payable_exam = ex
                break

        test("Has unpaid exam requiring payment", payable_exam is not None)

        if payable_exam:
            group_exam_id = payable_exam["group_exam_id"]
            cert_cost = payable_exam["certification_cost"]
            exam_name = payable_exam["name"]
            print(f"  📋 Using exam: {exam_name}")
            print(f"  📋 group_exam_id={group_exam_id}, cost=${cert_cost}")

            # ─── Step 3: Create card token (simulate frontend) ───────────
            print("\n--- Step 3: Create Card Token (APPROVED scenario) ---")
            card_token = create_card_token(TEST_CARD)
            test("Card token created", card_token is not None, "Token creation failed")

            if card_token:
                print(f"  📋 Token: {card_token[:20]}...")

                # ─── Step 4: Submit payment ──────────────────────────────
                print("\n--- Step 4: Submit Candidate Payment ---")
                payment_data = {
                    "group_exam_id": group_exam_id,
                    "token": card_token,
                    "payment_method_id": "visa",
                    "installments": 1,
                    "payer_email": MP_TEST_BUYER_EMAIL
                }
                print(f"  📋 Payer email: {MP_TEST_BUYER_EMAIL}")
                r = requests.post(
                    f"{BASE_URL}/payments/candidate-pay",
                    json=payment_data,
                    headers=headers,
                    timeout=60
                )
                print(f"  📋 Response status: {r.status_code}")
                try:
                    resp = r.json()
                except:
                    resp = {"raw": r.text[:500]}
                print(f"  📋 Response: {json.dumps(resp, indent=2)[:500]}")

                test("Payment endpoint responds", r.status_code in (200, 201),
                     f"Status {r.status_code}: {resp.get('error', 'unknown')}")

                if r.status_code in (200, 201):
                    test("Payment status is approved",
                         resp.get("mp_status") == "approved" or resp.get("status") == "approved",
                         f"Status: {resp.get('mp_status', resp.get('status'))}")
                    test("Credits applied", resp.get("credits_applied") == True,
                         f"credits_applied: {resp.get('credits_applied')}")

                    payment_id = resp.get("payment_id")
                    if payment_id:
                        print(f"  📋 Payment ID: {payment_id}")

                # ─── Step 5: Check my-payments ───────────────────────────
                print("\n--- Step 5: Check Payment History ---")
                r = requests.get(f"{BASE_URL}/payments/my-payments", headers=headers, timeout=30)
                test("My payments endpoint", r.status_code == 200, f"Status: {r.status_code}")
                if r.status_code == 200:
                    payments = r.json().get("payments", [])
                    test("Has payments in history", len(payments) > 0, f"Found {len(payments)} payments")
                    if payments:
                        latest = payments[0]
                        print(f"  📋 Latest payment: id={latest.get('id')}, status={latest.get('status')}, mp_status={latest.get('mp_status')}")

            # ─── Step 6: Test REJECTED scenario ──────────────────────────
            print("\n--- Step 6: Test REJECTED Payment ---")
            # Find another unpaid exam or use the second one
            rejected_exam = None
            for ex in exams:
                if ex.get("requires_payment") and not ex.get("is_paid") and ex.get("group_exam_id") != group_exam_id:
                    rejected_exam = ex
                    break

            if rejected_exam:
                rej_group_exam_id = rejected_exam["group_exam_id"]
                print(f"  📋 Using exam for rejection: {rejected_exam['name']}, group_exam_id={rej_group_exam_id}")

                rej_token = create_card_token(TEST_CARD_REJECTED)
                test("Rejected card token created", rej_token is not None)

                if rej_token:
                    payment_data = {
                        "group_exam_id": rej_group_exam_id,
                        "token": rej_token,
                        "payment_method_id": "visa",
                        "installments": 1,
                        "payer_email": MP_TEST_BUYER_EMAIL
                    }
                    r = requests.post(
                        f"{BASE_URL}/payments/candidate-pay",
                        json=payment_data,
                        headers=headers,
                        timeout=60
                    )
                    resp = r.json() if r.status_code in (200, 201, 400, 500, 502) else {}
                    print(f"  📋 Rejected payment response: {json.dumps(resp, indent=2)[:500]}")

                    # A rejected payment should still return 200/201 but with rejected status
                    test("Rejected payment endpoint responds", r.status_code in (200, 201),
                         f"Status {r.status_code}: {resp.get('error', 'unknown')}")
                    if r.status_code in (200, 201):
                        test("Payment status is rejected",
                             resp.get("mp_status") == "rejected" or resp.get("status") == "rejected",
                             f"Status: {resp.get('mp_status', resp.get('status'))}")
            else:
                print("  ⚠️ No second unpaid exam available for rejection test")

    # ─── Summary ─────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    if errors:
        print("\nFailed tests:")
        for e in errors:
            print(f"  ❌ {e}")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
