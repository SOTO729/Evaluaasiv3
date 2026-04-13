import requests, json, sys

base = 'https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'

print('Step 1: Login...')
sys.stdout.flush()
try:
    r = requests.post(f'{base}/auth/login', json={'username':'admin','password':'admin123'}, timeout=120)
    print(f'Login status: {r.status_code}')
    sys.stdout.flush()
    token = r.json().get('access_token','')
except Exception as e:
    print(f'Login FAILED: {e}')
    sys.exit(1)

print('Step 2: Calling guacamole-check...')
sys.stdout.flush()
try:
    r2 = requests.get(f'{base}/vm-sessions/guacamole-check', headers={'Authorization':f'Bearer {token}'}, timeout=90)
    print(f'Check status: {r2.status_code}')
    print(json.dumps(r2.json(), indent=2))
except Exception as e:
    print(f'Check FAILED: {e}')

print('ALL DONE')
