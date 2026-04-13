import requests, json

pk = "TEST-175b5e35-ee3b-454b-9566-dfcae8e875cf"

# Test token creation
card = {
    "card_number": "5474925432670366",
    "expiration_month": "11",
    "expiration_year": "2030",
    "security_code": "123",
    "cardholder": {"name": "TEST"}
}
r = requests.post(f"https://api.mercadopago.com/v1/card_tokens?public_key={pk}", json=card)
print(f"Token creation: {r.status_code}")
d = r.json()
print(f"Token ID: {d.get('id')}")
print(f"Token status: {d.get('status')}")
print(f"Payment method: {d.get('payment_method', {})}")

# Now check: what does cardBrand look like if detection worked?
bin_val = "547492"
r2 = requests.get(f"https://api.mercadopago.com/v1/payment_methods?public_key={pk}&bin={bin_val}")
methods = r2.json()
# Filter for card methods only
card_methods = [m for m in methods if m.get("payment_type_id") in ("credit_card", "debit_card")]
print(f"\nPayment methods for BIN {bin_val}:")
for m in card_methods:
    print(f"  id={m['id']}  name={m['name']}  type={m['payment_type_id']}")

# If no card methods found but results exist
if not card_methods and methods:
    print("\nAll methods returned:")
    for m in methods:
        print(f"  id={m['id']}  name={m['name']}  type={m['payment_type_id']}")
