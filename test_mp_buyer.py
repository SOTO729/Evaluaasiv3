import requests, json

token = "TEST-4848891651901365-032108-03d1eaa48d88411fd54246db942eb3c5-3270549789"
public_key = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

# 1. Get account info
r = requests.get("https://api.mercadopago.com/users/me", headers={"Authorization": f"Bearer {token}"})
print("=== ACCOUNT INFO ===")
me = r.json()
print(f"User ID: {me.get('id')}")
print(f"Email: {me.get('email')}")
print(f"Site: {me.get('site_id')}")

# 2. Create test user as buyer (using PROD credentials from the app owner)
# The test user needs to be the buyer, not the seller
# Let's try using the seller's own email but a different one
seller_email = me.get("email")
print(f"\nSeller email (this one should NOT be used as payer): {seller_email}")

# 3. Try payment with a known test user email pattern
# MercadoPago requires that in TEST mode, the payer email must be from a test user
# created via the test_user endpoint
r = requests.post("https://api.mercadopago.com/users/test_user",
    json={"site_id": "MLM", "description": "buyer"},
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
print(f"\n=== CREATE TEST USER === Status: {r.status_code}")
test_user = r.json()
print(json.dumps(test_user, indent=2))

if r.status_code == 201:
    buyer_email = test_user["email"]
    buyer_token = test_user.get("access_token")
    
    # Create card token using the PUBLIC key (not the buyer's token)
    card_data = {
        "card_number": "5474925432670366",
        "expiration_month": "11",
        "expiration_year": "2030",
        "security_code": "123",
        "cardholder": {"name": "APRO TEST"}
    }
    r = requests.post(f"https://api.mercadopago.com/v1/card_tokens?public_key={public_key}",
        json=card_data)
    card_token = r.json()["id"]
    print(f"\nCard token: {card_token}")

    # Try payment with buyer's email
    payment_body = {
        "transaction_amount": 200.00,
        "token": card_token,
        "description": "Test payment",
        "installments": 1,
        "payment_method_id": "master",
        "payer": {
            "email": buyer_email
        }
    }
    r = requests.post(
        "https://api.mercadopago.com/v1/payments",
        json=payment_body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": f"test-buyer-{test_user['id']}"
        }
    )
    print(f"\n=== PAYMENT RESULT === Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
