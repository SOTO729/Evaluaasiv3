"""
LinkedIn API v2 Integration Service
Handles OAuth2 flow and Share API for posting badges with images.

Required env vars:
  LINKEDIN_CLIENT_ID       – App client ID from developers.linkedin.com
  LINKEDIN_CLIENT_SECRET   – App client secret
  LINKEDIN_REDIRECT_URI    – OAuth2 callback URL (e.g. https://<api-host>/api/badges/linkedin/callback)
"""
import os
import requests
from urllib.parse import urlencode, quote


# LinkedIn endpoints
LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts'
LINKEDIN_IMAGES_URL = 'https://api.linkedin.com/rest/images'

# Scopes needed for sharing posts with images
LINKEDIN_SCOPES = 'openid profile w_member_social'


def get_config():
    """Return LinkedIn app config from env vars."""
    return {
        'client_id': os.environ.get('LINKEDIN_CLIENT_ID', ''),
        'client_secret': os.environ.get('LINKEDIN_CLIENT_SECRET', ''),
        'redirect_uri': os.environ.get('LINKEDIN_REDIRECT_URI', ''),
    }


def is_configured():
    """Check if LinkedIn API credentials are set."""
    cfg = get_config()
    return bool(cfg['client_id'] and cfg['client_secret'] and cfg['redirect_uri'])


def build_authorize_url(state: str) -> str:
    """Build LinkedIn OAuth2 authorization URL."""
    cfg = get_config()
    params = {
        'response_type': 'code',
        'client_id': cfg['client_id'],
        'redirect_uri': cfg['redirect_uri'],
        'state': state,
        'scope': LINKEDIN_SCOPES,
    }
    return f"{LINKEDIN_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_token(code: str) -> dict:
    """Exchange OAuth2 authorization code for access token."""
    cfg = get_config()
    resp = requests.post(LINKEDIN_TOKEN_URL, data={
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': cfg['redirect_uri'],
        'client_id': cfg['client_id'],
        'client_secret': cfg['client_secret'],
    }, headers={'Content-Type': 'application/x-www-form-urlencoded'}, timeout=15)
    resp.raise_for_status()
    return resp.json()


def get_linkedin_user_id(access_token: str) -> str:
    """Get the LinkedIn member URN (person ID) from the access token."""
    resp = requests.get(LINKEDIN_USERINFO_URL, headers={
        'Authorization': f'Bearer {access_token}',
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get('sub', '')


def initialize_image_upload(access_token: str, person_urn: str) -> dict:
    """
    Initialize an image upload to LinkedIn.
    Returns the upload URL and the image URN.
    """
    resp = requests.post(LINKEDIN_IMAGES_URL, json={
        'initializeUploadRequest': {
            'owner': person_urn,
        }
    }, headers={
        'Authorization': f'Bearer {access_token}',
        'LinkedIn-Version': '202401',
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    value = data.get('value', {})
    return {
        'upload_url': value.get('uploadUrl', ''),
        'image_urn': value.get('image', ''),
    }


def upload_image_binary(upload_url: str, access_token: str, image_bytes: bytes, content_type: str = 'image/png'):
    """Upload the actual image binary to LinkedIn's upload URL."""
    resp = requests.put(upload_url, data=image_bytes, headers={
        'Authorization': f'Bearer {access_token}',
        'Content-Type': content_type,
    }, timeout=30)
    resp.raise_for_status()


def create_share_post(access_token: str, person_urn: str, title: str, text: str,
                      article_url: str = None, image_urn: str = None) -> dict:
    """
    Create a LinkedIn share post.
    If image_urn is provided → post with image.
    If article_url is provided → post with article link (OG preview).
    Otherwise → text-only post.
    """
    post_body = {
        'author': person_urn,
        'commentary': text,
        'visibility': 'PUBLIC',
        'distribution': {
            'feedDistribution': 'MAIN_FEED',
            'targetEntities': [],
            'thirdPartyDistributionChannels': [],
        },
        'lifecycleState': 'PUBLISHED',
    }

    if image_urn:
        # Post with image
        post_body['content'] = {
            'media': {
                'title': title,
                'id': image_urn,
            }
        }
    elif article_url:
        # Post with article (link preview)
        post_body['content'] = {
            'article': {
                'source': article_url,
                'title': title,
                'description': text[:200],
            }
        }

    resp = requests.post(LINKEDIN_POSTS_URL, json=post_body, headers={
        'Authorization': f'Bearer {access_token}',
        'LinkedIn-Version': '202401',
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
    }, timeout=20)
    resp.raise_for_status()
    return resp.json() if resp.content else {'status': 'created', 'header': dict(resp.headers)}


def share_badge_with_image(access_token: str, badge, template, image_bytes: bytes) -> dict:
    """
    Full flow: upload badge image to LinkedIn, then create a post with it.
    Returns the API response.
    """
    # 1. Get the LinkedIn user's person URN
    sub = get_linkedin_user_id(access_token)
    person_urn = f'urn:li:person:{sub}'

    # 2. Initialize image upload
    upload_info = initialize_image_upload(access_token, person_urn)
    upload_url = upload_info['upload_url']
    image_urn = upload_info['image_urn']

    # 3. Upload image binary
    upload_image_binary(upload_url, access_token, image_bytes, 'image/png')

    # 4. Build post text
    badge_name = template.name if template else 'Insignia Digital'
    issuer = template.issuer_name if template else 'Grupo Eduit'

    text_parts = [
        f'🏆 He obtenido la insignia digital "{badge_name}" emitida por {issuer}.',
    ]
    if template and template.skills:
        skills_list = [s.strip() for s in template.skills.split(',') if s.strip()]
        if skills_list:
            text_parts.append(f'📋 Aptitudes: {", ".join(skills_list)}')

    if template and template.description:
        desc = template.description[:150]
        text_parts.append(f'📝 {desc}')

    text_parts.append(f'\n🔗 Verifica mi insignia: {badge.verify_url}')
    text_parts.append('\n#InsigniaDigital #Evaluaasi #GrupoEduit #Certificación')

    text = '\n'.join(text_parts)

    # 5. Create the post
    return create_share_post(
        access_token=access_token,
        person_urn=person_urn,
        title=badge_name,
        text=text,
        image_urn=image_urn,
    )
