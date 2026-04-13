import requests, json

seller_token = "TEST-4848891651901365-032108-03d1eaa48d88411fd54246db942eb3c5-3270549789"
seller_public_key = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

# 1. Create test buyer
r = requests.post("https://api.mercadopago.com/users/test_user",
    json={"site_id": "MLM", "description": "buyer_v2"},
    headers={"Authorization": f"Bearer {seller_token}", "Content-Type": "application/json"})
print(f"Create buyer: {r.status_code}")
buyer = r.json()
buyer_email = buyer["email"]
print(f"Buyer email: {buyer_email}")
print(f"Buyer ID: {buyer.get('id')}")

# 2. Get buyer's access token by getting their own test credentials
# The buyer needs their own access_token from MP
# Actually, in MP v2 test mode, the buyer test user should have an access_token
# Let me check if it's returned

# Actually the key thing in MP sandbox:
# - The seller uses their TEST access_token to CREATE the payment
# - The buyer's email just needs to NOT match the seller
# - The card token should be created with the seller's PUBLIC key
# - But the buyer email must be a REAL test_user email

# Let me try: maybe we need a test user created by a DIFFERENT app/credentials
# The issue might be that test users created by the same credentials can't be used as payer

# Let's try with a completely different approach - use MP's own test credentials
# Or try with just a random email that's NOT a test_user pattern

emails_to_try = [
    "buyer.evaluaasi.test@gmail.com",           # Regular email
    "TESTUSER8006735335438989693@testuser.com",  # Nickname as email
    buyer_email,                                  # Test user email
]

for test_email in emails_to_try:
    # Fresh card token each time
    card_data = {
        "card_number": "5474925432670366",
        "expiration_month": "11",
        "expiration_year": "2030",
        "security_code": "123",
        "cardholder": {"name": "APRO TEST"}
    }
    r = requests.post(f"https://api.mercadopago.com/v1/card_tokens?public_key={seller_public_key}",
        json=card_data)
    card_token = r.json()["id"]

    payment_body = {
        "transaction_amount": 200.00,
        "token": card_token,
        "description": "Test payment",
        "installments": 1,
        "payment_method_id": "master",
        "payer": {"email": test_email}
    }
    
    import time
    idem_key = f"test-{int(time.time())}-{test_email[:10]}"
    
    r = requests.post(
        "https://api.mercadopago.com/v1/payments",
        json=payment_body,
        headers={
            "Authorization": f"Bearer {seller_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": idem_key
        }
    )
    result = r.json()
    status = result.get("status", result.get("error", "?"))
    detail = result.get("status_detail", result.get("message", ""))
    print(f"\nEmail: {test_email}")
    print(f"  Result: {r.status_code} | status={status} | detail={detail}")
    if r.status_code in (200, 201):
        print(f"  PAYMENT ID: {result.get('id')}")
        break
