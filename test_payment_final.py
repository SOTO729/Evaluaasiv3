import requests, json

BASE = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
MP_KEY = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

# 1. Login candidato
r = requests.post(f"{BASE}/auth/login", json={"username": "GENERAGUATE3", "password": "pX74NMy9KvJV"})
print(f"Login: {r.status_code}")
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Card token
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

# 3. Pay with real email (not @testuser.com)
pay_data = {
    "group_exam_id": 12,
    "token": card_token,
    "payment_method_id": "master",
    "installments": 1,
    "payer_email": "buyer.evaluaasi.test@gmail.com"
}
r = requests.post(f"{BASE}/payments/candidate-pay", json=pay_data, headers=headers)
print(f"\nPay status: {r.status_code}")
print(json.dumps(r.json(), indent=2))
