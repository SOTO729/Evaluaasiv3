import requests, json

login_url = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/auth/login"
payload = {"username": "UM2TUKZKQG", "password": "the_decrypted_password"} # I'll need to re-run or just fix the fetch logic

# Wait, let me just modify the existing verify_users.py to print the response body
# because items length 0 but total count 14 looks suspicious (maybe pagination or scope issue).

import pymssql, hashlib, base64, requests, json
from cryptography.fernet import Fernet
from collections import Counter

def get_key(secret):
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())

secret = 'BpnEgadGyeLAJZ2TVD85PvQM9so1YHOcwFiz0Nq7lxI6WrhCUKkStfXmb34juR'
f = Fernet(get_key(secret))

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'
)
cursor = conn.cursor()
cursor.execute("SELECT encrypted_password FROM users WHERE username='UM2TUKZKQG'")
row = cursor.fetchone()
enc_pwd = row[0]
conn.close()

password = f.decrypt(enc_pwd.encode()).decode()

login_url = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/auth/login"
r = requests.post(login_url, json={"username": "UM2TUKZKQG", "password": password})
token = r.json().get("access_token")

headers = {"Authorization": f"Bearer {token}"}
base_api_url = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api/user-management/users"

params = {"role": "responsable,responsable_partner,responsable_estatal,auxiliar", "page": 1, "per_page": 50}
r = requests.get(base_api_url, headers=headers, params=params)
print("Filtered JSON Response keys:", r.json().keys())
print("Filtered JSON items:", r.json().get("items"))
print("Filtered JSON data:", r.json())
