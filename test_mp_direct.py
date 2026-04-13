import requests, json

# Test directo contra MP API (sin nuestro backend)
access_token = "TEST-4848891651901365-032108-03d1eaa48d88411fd54246db942eb3c5-3270549789"
public_key = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

# 1. Card token
card_data = {
    "card_number": "5474925432670366",
    "expiration_month": "11",
    "expiration_year": "2030",
    "security_code": "123",
    "cardholder": {"name": "APRO TEST"}
}
r = requests.post(f"https://api.mercadopago.com/v1/card_tokens?public_key={public_key}", json=card_data)
print(f"Card token: {r.status_code}")
card_token_id = r.json()["id"]
print(f"Token ID: {card_token_id}")

# 2. Try payment directly with MP
payment_body = {
    "transaction_amount": 200.00,
    "token": card_token_id,
    "description": "Test payment",
    "installments": 1,
    "payment_method_id": "master",
    "payer": {
        "email": "test_payer_evaluaasi@testuser.com"
    }
}

r = requests.post(
    "https://api.mercadopago.com/v1/payments",
    json=payment_body,
    headers={
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": "test-direct-eval-001"
    }
)
print(f"\nPayment status: {r.status_code}")
print(json.dumps(r.json(), indent=2))
