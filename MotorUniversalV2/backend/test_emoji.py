"""Test emoji support in chat messages."""
import requests
import time

API = 'https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'

# Login as admin
for i in range(3):
    r = requests.post(f'{API}/auth/login', json={'username': 'admin', 'password': 'admin123'}, timeout=30)
    if r.status_code == 200:
        break
    print(f'Login attempt {i+1} status: {r.status_code}, retrying...')
    time.sleep(5)

token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Get conversations
r = requests.get(f'{API}/support/chat/conversations', headers=headers, timeout=15)
print(f'Conversations: {r.status_code}')
convs = r.json().get('conversations', [])
if convs:
    conv_id = convs[0]['id']
    print(f'Using conversation {conv_id}')

    # Send emoji message
    emoji_msg = 'Test emoji support: \U0001f600\U0001f389\U0001f680\U0001f4af\U0001f525 Unicode!'
    r = requests.post(
        f'{API}/support/chat/conversations/{conv_id}/messages',
        headers=headers,
        json={'content': emoji_msg},
        timeout=15
    )
    print(f'Send status: {r.status_code}')
    if r.status_code in (200, 201):
        msg = r.json().get('message', r.json())
        content = msg.get('content', 'N/A')
        print(f'Stored content: {content}')
        if '\U0001f600' in content:
            print('SUCCESS: Emojis preserved correctly!')
        else:
            print('WARNING: Emojis may have been lost')
    else:
        print(f'Error: {r.text[:300]}')
else:
    print('No conversations found to test with')
