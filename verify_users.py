import pymssql, hashlib, base64, requests, json
from cryptography.fernet import Fernet
from collections import Counter

def get_key(secret):
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())

secret = 'BpnEgadGyeLAJZ2TVD85PvQM9so1YHOcwFiz0Nq7lxI6WrhCUKkStfXmb34juR'
f = Fernet(get_key(secret))

print("--- Step 1: Connecting to DB and fetching encrypted password ---")
conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'
)
cursor = conn.cursor()
cursor.execute("SELECT encrypted_password FROM users WHERE username='UM2TUKZKQG'")
row = cursor.fetchone()
if not row:
    print("User UM2TUKZKQG not found in DB.")
    conn.close()
    exit()

enc_pwd = row[0]
conn.close()

print("--- Step 2: Decrypting password ---")
try:
    password = f.decrypt(enc_pwd.encode()).decode()
    print("Password decrypted successfully.")
except Exception as e:
    print(f"Decryption failed: {e}")
    exit()

print("--- Step 3: Logging in to API ---")
login_url = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/auth/login"
payload = {"username": "UM2TUKZKQG", "password": password}
r = requests.post(login_url, json=payload)
if r.status_code != 200:
    print(f"Login failed: {r.status_code}")
    print(r.text)
    exit()

token = r.json().get("access_token")
print("Login successful, token obtained.")

headers = {"Authorization": f"Bearer {token}"}
base_api_url = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/user-management/users"

def fetch_and_print(params, label):
    print(f"\n--- {label} ---")
    r = requests.get(base_api_url, headers=headers, params=params)
    if r.status_code != 200:
        print(f"Failed to fetch users: {r.status_code}")
        print(r.text)
        return
    
    data = r.json()
    items = data.get("items", [])
    total = data.get("total", 0)
    
    print(f"Total count: {total}")
    print(f"Items length: {len(items)}")
    
    roles = [item.get("role") for item in items]
    role_counts = Counter(roles)
    print("Role breakdown:")
    for role, count in role_counts.items():
        print(f"  {role}: {count}")

# Step 4 & 5
fetch_and_print(
    {"role": "responsable,responsable_partner,responsable_estatal,auxiliar", "page": 1, "per_page": 50},
    "Filtered Request"
)

# Step 6
fetch_and_print(
    {"page": 1, "per_page": 50},
    "Unfiltered Request"
)
