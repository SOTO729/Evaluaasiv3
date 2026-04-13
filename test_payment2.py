import requests, json

token = "TEST-4848891651901365-032108-03d1eaa48d88411fd54246db942eb3c5-3270549789"

# Create test buyer user
r = requests.post("https://api.mercadopago.com/users/test_user",
    json={"site_id": "MLM"},
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
print(f"Create test user: {r.status_code}")
data = r.json()
print(json.dumps(data, indent=2))

if r.status_code in (200, 201):
    buyer_email = data.get("email")
    print(f"\nBuyer email: {buyer_email}")
    
    # Now test payment with this buyer email
    BASE = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
    MP_KEY = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

    # Login
    r = requests.post(f"{BASE}/auth/login", json={"username": "GENERAGUATE3", "password": "pX74NMy9KvJV"})
    cand_token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {cand_token}"}

    # Card token
    card_data = {
        "card_number": "5474925432670366",
        "expiration_month": "11",
        "expiration_year": "2030",
        "security_code": "123",
        "cardholder": {"name": "APRO TEST"}
    }
    r = requests.post(f"https://api.mercadopago.com/v1/card_tokens?public_key={MP_KEY}", json=card_data)
    card_token = r.json()["id"]
    print(f"Card token: {card_token}")

    # Pay with buyer email
    pay_data = {
        "group_exam_id": 12,
        "token": card_token,
        "payment_method_id": "master",
        "installments": 1,
        "payer_email": buyer_email
    }
    r = requests.post(f"{BASE}/payments/candidate-pay", json=pay_data, headers=headers)
    print(f"\nPay status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
