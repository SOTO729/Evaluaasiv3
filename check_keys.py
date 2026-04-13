import pymssql, hashlib, base64
from cryptography.fernet import Fernet

def get_key(secret):
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())

keys_to_try = [
    'BpnEgadGyeLAJZ2TVD85PvQM9so1YHOcwFiz0Nq7lxI6WrhCUKkStfXmb34juR',
    'dev-secret-key-change-in-production',
]

conn = pymssql.connect(
    server='evaluaasi-motorv2-sql.database.windows.net',
    user='evaluaasi_admin',
    password='EvalAasi2024_newpwd!',
    database='evaluaasi_dev'
)
cursor = conn.cursor()

cursor.execute("SELECT TOP 3 id, username, encrypted_password FROM users WHERE encrypted_password IS NOT NULL AND username IN ('FCURP2F22E2B2','JUAGAR','admin')")
rows = cursor.fetchall()

for uid, uname, enc_pwd in rows:
    print(f"\n{uname}: enc_pwd[0:50] = {enc_pwd[:50]}")
    for sk in keys_to_try:
        try:
            f = Fernet(get_key(sk))
            plain = f.decrypt(enc_pwd.encode()).decode()
            print(f"  -> DECRYPTED with [{sk[:20]}...]: {plain}")
            break
        except Exception as e:
            print(f"  -> FAILED with [{sk[:20]}...]: {type(e).__name__}")

conn.close()
