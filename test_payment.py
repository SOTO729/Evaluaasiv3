import requests, json

BASE = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
MP_KEY = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

# 1. Login candidato
print("=== LOGIN ===")
r = requests.post(f"{BASE}/auth/login", json={"username": "GENERAGUATE3", "password": "pX74NMy9KvJV"})
print(f"Login: {r.status_code}")
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Crear card token con MercadoPago
print("\n=== CARD TOKEN ===")
card_data = {
    "card_number": "5474925432670366",
    "expiration_month": "11",
    "expiration_year": "2030",
    "security_code": "123",
    "cardholder": {"name": "APRO TEST"}
}
r = requests.post(f"https://api.mercadopago.com/v1/card_tokens?public_key={MP_KEY}", json=card_data)
print(f"Token status: {r.status_code}")
card_token = r.json().get("id")
print(f"Token ID: {card_token}")

# 3. Check mis-examenes first
print("\n=== MIS-EXAMENES ===")
r = requests.get(f"{BASE}/partners/mis-examenes", headers=headers)
print(f"Mis examenes: {r.status_code}")
data = r.json()
if isinstance(data, dict) and 'exams' in data:
    exams = data['exams']
elif isinstance(data, list):
    exams = data
else:
    print(json.dumps(data, indent=2))
    exams = []
for e in exams:
    if isinstance(e, dict):
        print(f"  group_exam_id={e.get('group_exam_id')} | exam={e.get('exam_name')} | is_paid={e.get('is_paid')} | needs_payment={e.get('needs_payment')}")

# 4. Pay
print("\n=== CANDIDATE-PAY ===")
pay_data = {
    "group_exam_id": 12,
    "token": card_token,
    "payment_method_id": "master",
    "installments": 1,
    "payer_email": "test_payer_buyer@testuser.com"
}
r = requests.post(f"{BASE}/payments/candidate-pay", json=pay_data, headers=headers)
print(f"Pay status: {r.status_code}")
print(json.dumps(r.json(), indent=2))
