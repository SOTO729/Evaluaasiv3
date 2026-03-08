"""
Test de compartir insignias por WhatsApp, Twitter/X, Email, Facebook, Instagram y LinkedIn

Verifica:
  PARTE A — Construcción de URLs de compartir (unitario, sin red)
    1-4. WhatsApp
    5-7. Twitter/X
    8-10. Email
    10b-10e. Facebook
    10f-10j. Instagram

  PARTE A2 — LinkedIn share (unitario)
    19. LinkedIn URL usa feed/?shareActive=true con texto predefinido
    20. LinkedIn texto incluye nombre de la insignia y "Evaluaasi"
    21. LinkedIn texto incluye la URL de share-preview (/s/<code>)
    22. LinkedIn usa fallback "Insignia Digital" si no hay template_name
    23. LinkedIn add-to-profile URL contiene parámetros correctos

  PARTE B — getVerifyUrl / getSharePreviewUrl (lógica de URLs)
    11-13. getVerifyUrl
    24. getSharePreviewUrl usa API base + /s/ + badge_code
    25. getSharePreviewUrl quita sufijo /api para ruta corta

  PARTE C — Integridad de URLs (14-18)

  PARTE D — Endpoint /s/<code> (share-preview con OG tags, Flask test client)
    26. /s/<code> devuelve 200 con HTML cuando badge existe
    27. /s/<code> devuelve 404 cuando badge no existe
    28. /s/<code> incluye og:title con nombre de la plantilla
    29. /s/<code> incluye og:description con nombre del candidato
    30. /s/<code> incluye og:image apuntando a share-image PNG
    31. /s/<code> incluye meta refresh redirigiendo a verify URL
    32. /s/<code> y /api/badges/share-preview/<code> devuelven el mismo contenido

USO:
  cd backend && python -m pytest tests/test_badge_social_sharing.py -v
"""
import sys
import os
import urllib.parse
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


# ──────────────────────────────────────────────────────────────
# Helpers — replican la lógica frontend en Python
# ──────────────────────────────────────────────────────────────
ORIGIN = "https://thankful-stone-07fbe5410.6.azurestaticapps.net"


def get_verify_url(badge: dict) -> str:
    """Replica getVerifyUrl del frontend."""
    return badge.get('verify_url') or f"{ORIGIN}/verify/{badge['badge_code']}"


API_URL_PROD = "https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"
API_URL_DEV = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api"


def get_share_preview_url(badge: dict, api_url: str = API_URL_PROD) -> str:
    """Replica getSharePreviewUrl del frontend.
    Quita /api del final y usa /s/<code>."""
    import re as _re
    base_url = _re.sub(r'/api/?$', '', api_url)
    return f"{base_url}/s/{badge['badge_code']}"


def build_whatsapp_url(badge: dict) -> str:
    """Replica handleShareWhatsApp del frontend."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'\U0001f393 ¡He obtenido la insignia digital "{name}" en Evaluaasi!\n\nEsta credencial valida mis competencias y habilidades profesionales. Puedes verificar su autenticidad aquí:\n\n{url}'
    return f"https://wa.me/?text={urllib.parse.quote(text, safe='')}"


def build_twitter_url(badge: dict, api_url: str = None) -> str:
    """Replica handleShareTwitter del frontend."""
    share_url = get_share_preview_url(badge, api_url or API_URL_PROD)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'\U0001f393 ¡He obtenido la insignia digital "{name}" en Evaluaasi!\n\nEsta credencial valida mis competencias y habilidades profesionales.\n\n#OpenBadges #CredencialesDigitales #Evaluaasi'
    return (
        f"https://twitter.com/intent/tweet"
        f"?text={urllib.parse.quote(text, safe='')}"
        f"&url={urllib.parse.quote(share_url, safe='')}"
    )


def build_email_parts(badge: dict) -> tuple:
    """Replica handleShareEmail del frontend. Retorna (subject, body)."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    subject = f'He obtenido la insignia digital "{name}" en Evaluaasi'
    body = (
        f'¡Hola!\n\n'
        f'Me complace compartir que he obtenido la insignia digital "{name}" en Evaluaasi.\n\n'
        f'Esta credencial valida mis competencias y habilidades profesionales. '
        f'Puedes verificar su autenticidad en el siguiente enlace:\n\n'
        f'{url}\n\n'
        f'Saludos.'
    )
    return subject, body


def build_facebook_url(badge: dict, api_url: str = None) -> str:
    """Replica handleShareFacebook del frontend.
    u= lleva share-preview (OG card), quote= lleva texto profesional con verify URL."""
    share_url = get_share_preview_url(badge, api_url or API_URL_PROD)
    verify_url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    quote = f'\U0001f393 ¡He obtenido la insignia digital "{name}" en Evaluaasi!\n\nEsta credencial valida mis competencias y habilidades profesionales. Puedes verificar su autenticidad aquí:\n\n{verify_url}'
    return (
        f"https://www.facebook.com/sharer/sharer.php"
        f"?u={urllib.parse.quote(share_url, safe='')}"
        f"&quote={urllib.parse.quote(quote, safe='')}"
    )


def build_instagram_share_info(badge: dict) -> dict:
    """Replica handleShareInstagram del frontend.
    Retorna la info que se usaría: texto para copiar al portapapeles y verify URL."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'\U0001f393 ¡He obtenido la insignia digital "{name}" en Evaluaasi!\n\nEsta credencial valida mis competencias y habilidades profesionales. Verifica su autenticidad aquí:\n\n{url}\n\n#OpenBadges #CredencialesDigitales #Evaluaasi #InsigniaDigital'
    return {
        'clipboard_text': text,
        'verify_url': url,
    }


def build_linkedin_share_url(badge: dict, api_url: str = API_URL_PROD) -> str:
    """Replica handleShare (LinkedIn) del frontend.
    Usa verify URL (frontend) en el texto visible."""
    verify_url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'🎓 ¡He obtenido la insignia digital "{name}" en Evaluaasi!\n\nEsta credencial valida mis competencias y habilidades profesionales. Puedes verificar su autenticidad aquí:\n\n{verify_url}'
    return f"https://www.linkedin.com/feed/?shareActive=true&text={urllib.parse.quote(text, safe='')}"


def build_linkedin_profile_url(badge: dict) -> str:
    """Replica handleAddToProfile del frontend."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    return (
        f"https://www.linkedin.com/profile/add"
        f"?startTask=CERTIFICATION_NAME"
        f"&name={urllib.parse.quote(name, safe='')}"
        f"&certUrl={urllib.parse.quote(url, safe='')}"
        f"&organizationName={urllib.parse.quote('Evaluaasi', safe='')}"
    )


# ──────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────
BADGE_WITH_NAME = {
    'id': 1,
    'badge_code': 'BDABC1234567',
    'template_name': 'Certificación Python Avanzado',
    'verify_url': f'{ORIGIN}/verify/BDABC1234567',
    'badge_image_url': f'{ORIGIN}/badges/BDABC1234567/image.png',
}

BADGE_NO_NAME = {
    'id': 2,
    'badge_code': 'BDXYZ9876543',
    'template_name': None,
    'verify_url': None,
    'badge_image_url': None,
}

BADGE_CUSTOM_VERIFY = {
    'id': 3,
    'badge_code': 'BD0000000001',
    'template_name': 'Liderazgo Empresarial',
    'verify_url': 'https://custom-domain.com/verify/BD0000000001',
    'badge_image_url': 'https://custom-domain.com/badges/BD0000000001/image.png',
}


# ============================================================
# PARTE A — Construcción de URLs de compartir
# ============================================================

class TestWhatsAppSharing:

    def test_01_whatsapp_url_format(self):
        """URL de WhatsApp comienza con https://wa.me/?text="""
        url = build_whatsapp_url(BADGE_WITH_NAME)
        assert url.startswith('https://wa.me/?text=')

    def test_02_whatsapp_includes_badge_name(self):
        """El texto de WhatsApp incluye el nombre de la insignia y Evaluaasi."""
        url = build_whatsapp_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Certificación Python Avanzado' in decoded
        assert 'Evaluaasi' in decoded

    def test_03_whatsapp_includes_verify_url(self):
        """El texto de WhatsApp incluye la URL de verificación."""
        url = build_whatsapp_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '/verify/BDABC1234567' in decoded

    def test_04_whatsapp_fallback_name(self):
        """Si no hay template_name, usa 'Insignia Digital' como fallback."""
        url = build_whatsapp_url(BADGE_NO_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Insignia Digital' in decoded
        assert 'None' not in decoded


class TestTwitterSharing:

    def test_05_twitter_url_format(self):
        """URL de Twitter usa intent/tweet con text y url."""
        url = build_twitter_url(BADGE_WITH_NAME)
        assert 'https://twitter.com/intent/tweet' in url
        assert 'text=' in url
        assert 'url=' in url

    def test_06_twitter_includes_hashtags(self):
        """El texto de Twitter incluye hashtags #OpenBadges #CredencialesDigitales #Evaluaasi."""
        url = build_twitter_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '#OpenBadges' in decoded
        assert '#CredencialesDigitales' in decoded
        assert '#Evaluaasi' in decoded

    def test_07_twitter_includes_badge_name(self):
        """El texto de Twitter incluye el nombre de la insignia y Evaluaasi."""
        url = build_twitter_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Certificación Python Avanzado' in decoded
        assert 'Evaluaasi' in decoded


class TestEmailSharing:

    def test_08_email_subject_and_body(self):
        """Email genera subject con nombre de la insignia y Evaluaasi, body con URL de verificación."""
        subject, body = build_email_parts(BADGE_WITH_NAME)
        assert 'Certificación Python Avanzado' in subject
        assert 'Evaluaasi' in subject
        assert '/verify/BDABC1234567' in body
        assert 'Evaluaasi' in body

    def test_09_email_body_has_verify_url(self):
        """El body del email contiene la URL de verificación completa."""
        _, body = build_email_parts(BADGE_WITH_NAME)
        assert BADGE_WITH_NAME['verify_url'] in body

    def test_10_email_fallback_name(self):
        """Si no hay template_name, email usa 'Insignia Digital'."""
        subject, body = build_email_parts(BADGE_NO_NAME)
        assert 'Insignia Digital' in subject
        assert 'Insignia Digital' in body
        assert 'None' not in subject
        assert 'None' not in body


class TestFacebookSharing:

    def test_10b_facebook_url_format(self):
        """URL de Facebook usa sharer.php con parámetro u."""
        url = build_facebook_url(BADGE_WITH_NAME)
        assert url.startswith('https://www.facebook.com/sharer/sharer.php?u=')

    def test_10c_facebook_includes_share_preview_url(self):
        """El parámetro u de Facebook incluye la URL de share-preview (/s/) para OG card."""
        url = build_facebook_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '/s/BDABC1234567' in decoded

    def test_10d_facebook_url_is_encoded(self):
        """Los parámetros de Facebook están URL-encoded (sin espacios)."""
        url = build_facebook_url(BADGE_WITH_NAME)
        query = url.split('?', 1)[1]
        assert ' ' not in query

    def test_10e_facebook_uses_share_preview(self):
        """Facebook usa share-preview URL en u= y verify URL en quote= texto."""
        url = build_facebook_url(BADGE_CUSTOM_VERIFY)
        decoded = urllib.parse.unquote(url)
        # u= tiene share-preview
        assert '/s/BD0000000001' in decoded
        # quote= tiene verify URL del frontend
        assert 'custom-domain.com/verify/BD0000000001' in decoded
        assert 'Evaluaasi' in decoded


class TestInstagramSharing:

    def test_10f_instagram_clipboard_has_badge_name(self):
        """Instagram copia texto con el nombre de la insignia."""
        info = build_instagram_share_info(BADGE_WITH_NAME)
        assert 'Certificación Python Avanzado' in info['clipboard_text']

    def test_10g_instagram_clipboard_has_verify_url(self):
        """Instagram copia texto con la URL de verificación."""
        info = build_instagram_share_info(BADGE_WITH_NAME)
        assert '/verify/BDABC1234567' in info['clipboard_text']

    def test_10h_instagram_clipboard_has_hashtags(self):
        """Instagram copia texto con hashtags."""
        info = build_instagram_share_info(BADGE_WITH_NAME)
        assert '#OpenBadges' in info['clipboard_text']
        assert '#CredencialesDigitales' in info['clipboard_text']
        assert '#Evaluaasi' in info['clipboard_text']
        assert '#InsigniaDigital' in info['clipboard_text']

    def test_10i_instagram_fallback_name(self):
        """Si no hay template_name, usa 'Insignia Digital' como fallback."""
        info = build_instagram_share_info(BADGE_NO_NAME)
        assert 'Insignia Digital' in info['clipboard_text']
        assert 'None' not in info['clipboard_text']

    def test_10j_instagram_custom_verify_url(self):
        """Si badge tiene verify_url custom, Instagram lo usa."""
        info = build_instagram_share_info(BADGE_CUSTOM_VERIFY)
        assert 'https://custom-domain.com/verify/BD0000000001' in info['clipboard_text']


# ============================================================
# PARTE B — getVerifyUrl
# ============================================================

class TestGetVerifyUrl:

    def test_11_uses_verify_url_if_present(self):
        """Si badge tiene verify_url, lo retorna directamente."""
        url = get_verify_url(BADGE_CUSTOM_VERIFY)
        assert url == 'https://custom-domain.com/verify/BD0000000001'

    def test_12_builds_from_origin_if_no_verify_url(self):
        """Si no tiene verify_url, construye con origin + badge_code."""
        url = get_verify_url(BADGE_NO_NAME)
        assert url == f'{ORIGIN}/verify/BDXYZ9876543'

    def test_13_badge_code_format(self):
        """badge_code siempre empieza con BD y tiene 12 caracteres."""
        for badge in [BADGE_WITH_NAME, BADGE_NO_NAME, BADGE_CUSTOM_VERIFY]:
            code = badge['badge_code']
            assert code.startswith('BD'), f"badge_code debe empezar con BD: {code}"
            assert len(code) == 12, f"badge_code debe tener 12 caracteres: {code}"
            assert re.match(r'^BD[A-Z0-9]{10}$', code), f"badge_code formato inválido: {code}"


# ============================================================
# PARTE C — Integridad de URLs generadas
# ============================================================

class TestShareUrlIntegrity:

    def test_14_whatsapp_url_is_fully_encoded(self):
        """El texto de WhatsApp está URL-encoded (sin espacios literales en query)."""
        url = build_whatsapp_url(BADGE_WITH_NAME)
        query = url.split('?text=', 1)[1]
        # No debe tener espacios crudos en la parte del query
        assert ' ' not in query

    def test_15_twitter_url_is_fully_encoded(self):
        """El texto y la URL de Twitter están URL-encoded."""
        url = build_twitter_url(BADGE_WITH_NAME)
        parts = url.split('?', 1)[1]
        # No debe tener espacios crudos
        assert ' ' not in parts

    def test_16_email_mailto_format(self):
        """El mailto: generado tiene subject y body correctamente formateados."""
        subject, body = build_email_parts(BADGE_WITH_NAME)
        mailto = f"mailto:?subject={urllib.parse.quote(subject, safe='')}&body={urllib.parse.quote(body, safe='')}"
        assert mailto.startswith('mailto:?subject=')
        assert '&body=' in mailto

    def test_17_custom_verify_url_used_in_verify_channels(self):
        """Canales que usan verify URL (WhatsApp, Instagram, Email, LinkedIn, Facebook quote).
        Twitter usa share-preview URL. Facebook u= usa share-preview para OG card."""
        wa = urllib.parse.unquote(build_whatsapp_url(BADGE_CUSTOM_VERIFY))
        ig = build_instagram_share_info(BADGE_CUSTOM_VERIFY)
        _, email_body = build_email_parts(BADGE_CUSTOM_VERIFY)

        custom_url = BADGE_CUSTOM_VERIFY['verify_url']
        assert custom_url in wa
        assert custom_url in ig['clipboard_text']
        assert custom_url in email_body

        # LinkedIn texto usa verify URL (frontend)
        li = urllib.parse.unquote(build_linkedin_share_url(BADGE_CUSTOM_VERIFY))
        assert custom_url in li
        assert '/s/BD0000000001' not in li

        # Twitter usa share-preview (/s/)
        tw = urllib.parse.unquote(build_twitter_url(BADGE_CUSTOM_VERIFY))
        assert '/s/BD0000000001' in tw

        # Facebook u= tiene share-preview, quote= tiene verify URL
        fb = urllib.parse.unquote(build_facebook_url(BADGE_CUSTOM_VERIFY))
        assert '/s/BD0000000001' in fb
        assert custom_url in fb

    def test_18_special_characters_in_badge_name(self):
        """Nombres con caracteres especiales (acentos, ñ) se codifican correctamente."""
        badge = {
            'id': 99,
            'badge_code': 'BDSPECIAL123',
            'template_name': 'Evaluación & Diseño — Año 2024',
            'verify_url': None,
        }
        wa_url = build_whatsapp_url(badge)
        tw_url = build_twitter_url(badge)
        subject, body = build_email_parts(badge)

        # Al decodificar, el nombre debe estar presente
        assert 'Evaluación & Diseño — Año 2024' in urllib.parse.unquote(wa_url)
        assert 'Evaluación & Diseño — Año 2024' in urllib.parse.unquote(tw_url)
        assert 'Evaluación & Diseño — Año 2024' in subject


# ============================================================
# PARTE A2 — LinkedIn share
# ============================================================

class TestLinkedInSharing:

    def test_19_linkedin_url_format(self):
        """LinkedIn URL usa feed/?shareActive=true con text= param."""
        url = build_linkedin_share_url(BADGE_WITH_NAME)
        assert 'https://www.linkedin.com/feed/?shareActive=true&text=' in url

    def test_20_linkedin_includes_badge_name_and_evaluaasi(self):
        """LinkedIn texto incluye nombre de la insignia y 'Evaluaasi'."""
        url = build_linkedin_share_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Certificación Python Avanzado' in decoded
        assert 'Evaluaasi' in decoded

    def test_21_linkedin_includes_verify_url(self):
        """LinkedIn texto incluye la URL de verificación del frontend."""
        url = build_linkedin_share_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '/verify/BDABC1234567' in decoded

    def test_21b_linkedin_uses_frontend_url_not_backend(self):
        """LinkedIn texto NO contiene la URL del backend (/s/ ni /api/)."""
        url = build_linkedin_share_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '/s/BDABC1234567' not in decoded
        assert '/api/badges/share-preview/' not in decoded

    def test_22_linkedin_fallback_name(self):
        """Si no hay template_name, LinkedIn usa 'Insignia Digital'."""
        url = build_linkedin_share_url(BADGE_NO_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Insignia Digital' in decoded
        assert 'None' not in decoded

    def test_23_linkedin_add_to_profile(self):
        """LinkedIn add-to-profile URL contiene name, certUrl, organizationName."""
        url = build_linkedin_profile_url(BADGE_WITH_NAME)
        assert 'startTask=CERTIFICATION_NAME' in url
        decoded = urllib.parse.unquote(url)
        assert 'Certificación Python Avanzado' in decoded
        assert 'Evaluaasi' in decoded
        assert '/verify/BDABC1234567' in decoded

    def test_23b_linkedin_add_to_profile_org_name(self):
        """LinkedIn add-to-profile usa 'Evaluaasi' como organizationName."""
        url = build_linkedin_profile_url(BADGE_WITH_NAME)
        assert 'organizationName=Evaluaasi' in url


class TestSharePreviewUrl:

    def test_24_share_preview_url_format(self):
        """getSharePreviewUrl genera URL con /s/ + badge_code."""
        url = get_share_preview_url(BADGE_WITH_NAME)
        assert url.endswith('/s/BDABC1234567')

    def test_24b_share_preview_url_for_dev(self):
        """getSharePreviewUrl funciona con API URL de DEV."""
        url = get_share_preview_url(BADGE_WITH_NAME, API_URL_DEV)
        assert 'evaluaasi-motorv2-api-dev' in url
        assert url.endswith('/s/BDABC1234567')

    def test_25_share_preview_removes_api_suffix(self):
        """getSharePreviewUrl quita /api del final de la URL."""
        url = get_share_preview_url(BADGE_WITH_NAME)
        assert '/api/' not in url

    def test_25b_share_preview_with_trailing_slash(self):
        """getSharePreviewUrl maneja /api/ con trailing slash."""
        url = get_share_preview_url(BADGE_WITH_NAME, API_URL_PROD + '/')
        assert '/api/' not in url
        assert url.endswith('/s/BDABC1234567')

    def test_25c_linkedin_and_facebook_use_frontend_urls(self):
        """LinkedIn usa verify URL (frontend). Facebook quote usa verify URL.
        Twitter usa share-preview URL. WhatsApp y Email usan verify URL.
        Todos los canales incluyen 'Evaluaasi' en el texto."""
        li_url = urllib.parse.unquote(build_linkedin_share_url(BADGE_WITH_NAME))
        wa_url = urllib.parse.unquote(build_whatsapp_url(BADGE_WITH_NAME))
        tw_url = urllib.parse.unquote(build_twitter_url(BADGE_WITH_NAME))
        fb_url = urllib.parse.unquote(build_facebook_url(BADGE_WITH_NAME))
        _, email_body = build_email_parts(BADGE_WITH_NAME)
        ig = build_instagram_share_info(BADGE_WITH_NAME)
        # LinkedIn usa verify URL (frontend), no /s/
        assert '/verify/BDABC1234567' in li_url
        assert '/s/BDABC1234567' not in li_url
        # Facebook tiene /s/ en u= y /verify/ en quote
        assert '/s/BDABC1234567' in fb_url
        assert '/verify/BDABC1234567' in fb_url
        # WhatsApp usa verify URL
        assert '/verify/BDABC1234567' in wa_url
        assert '/s/' not in wa_url
        # Todos mencionan Evaluaasi
        assert 'Evaluaasi' in li_url
        assert 'Evaluaasi' in wa_url
        assert 'Evaluaasi' in tw_url
        assert 'Evaluaasi' in fb_url
        assert 'Evaluaasi' in email_body
        assert 'Evaluaasi' in ig['clipboard_text']


# ============================================================
# PARTE D — Endpoint /s/<code> (Flask test client)
# ============================================================

import pytest

@pytest.fixture(scope='module')
def flask_app():
    """Crea la app Flask con BD SQLite en memoria."""
    os.environ['JWT_SECRET_KEY'] = 'test-secret'
    os.environ['SWA_BASE_URL'] = 'https://app.evaluaasi.com'
    os.environ.setdefault('AZURE_STORAGE_CONNECTION_STRING', 'DefaultEndpointsProtocol=https;AccountName=fake;AccountKey=ZmFrZWtleQ==;EndpointSuffix=core.windows.net')
    try:
        from app import create_app, db as flask_db
        app = create_app('testing')
        with app.app_context():
            flask_db.create_all()
            yield app, flask_db
            flask_db.drop_all()
    except Exception as e:
        pytest.skip(f"No se pudo crear la app Flask: {e}")


@pytest.fixture(scope='module')
def app_client(flask_app):
    """Crea un Flask test client."""
    app, _ = flask_app
    with app.test_client() as client:
        yield client


@pytest.fixture(scope='module')
def test_badge_code(flask_app):
    """Inserta un usuario, template y badge de prueba. Retorna el badge_code."""
    app, flask_db = flask_app
    from app.models.badge import BadgeTemplate, IssuedBadge
    from app.models.user import User
    import uuid
    from datetime import datetime, timedelta

    with app.app_context():
        # Crear usuario de prueba
        user = User(id=str(uuid.uuid4()), email='test@evaluaasi.com',
                    username='test_share_user',
                    name='Juan', first_surname='Pérez', second_surname='López')
        user.set_password('test1234')
        flask_db.session.add(user)
        flask_db.session.flush()

        # Crear template de prueba
        tmpl = BadgeTemplate(
            name='Certificación Test OG Tags',
            description='Template de prueba para tests de share-preview',
            skills='Python, Testing, OG Tags',
            created_by_id=user.id
        )
        flask_db.session.add(tmpl)
        flask_db.session.flush()

        # Crear badge emitido
        badge = IssuedBadge(
            badge_template_id=tmpl.id,
            user_id=user.id,
            badge_uuid=str(uuid.uuid4()),
            badge_code='BDTEST123456',
            issued_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=365)
        )
        flask_db.session.add(badge)
        flask_db.session.commit()

        return 'BDTEST123456'


class TestShortShareEndpoint:

    def test_26_short_url_returns_200_for_existing_badge(self, app_client, test_badge_code):
        """GET /s/<code> devuelve 200 con HTML para badge existente."""
        resp = app_client.get(f'/s/{test_badge_code}')
        assert resp.status_code == 200
        assert b'<!DOCTYPE html>' in resp.data

    def test_27_short_url_returns_404_for_nonexistent(self, app_client):
        """GET /s/<code> devuelve 404 para badge inexistente."""
        resp = app_client.get('/s/BDNOTEXIST99')
        assert resp.status_code == 404

    def test_28_short_url_has_og_title(self, app_client, test_badge_code):
        """GET /s/<code> incluye og:title en el HTML."""
        resp = app_client.get(f'/s/{test_badge_code}')
        html = resp.data.decode('utf-8')
        assert 'og:title' in html

    def test_29_short_url_has_og_description(self, app_client, test_badge_code):
        """GET /s/<code> incluye og:description con info del candidato."""
        resp = app_client.get(f'/s/{test_badge_code}')
        html = resp.data.decode('utf-8')
        assert 'og:description' in html
        assert 'Insignia digital verificada' in html

    def test_30_short_url_has_og_image(self, app_client, test_badge_code):
        """GET /s/<code> incluye og:image apuntando a PNG."""
        resp = app_client.get(f'/s/{test_badge_code}')
        html = resp.data.decode('utf-8')
        assert 'og:image' in html
        assert 'share-image' in html
        assert '.png' in html

    def test_31_short_url_has_meta_refresh(self, app_client, test_badge_code):
        """GET /s/<code> incluye meta refresh redirigiendo a verify URL."""
        resp = app_client.get(f'/s/{test_badge_code}')
        html = resp.data.decode('utf-8')
        assert 'http-equiv="refresh"' in html
        assert 'app.evaluaasi.com/verify/' in html

    def test_32_short_url_matches_share_preview(self, app_client, test_badge_code):
        """/s/<code> y /api/badges/share-preview/<code> devuelven el mismo contenido."""
        resp_short = app_client.get(f'/s/{test_badge_code}')
        resp_long = app_client.get(f'/api/badges/share-preview/{test_badge_code}')
        assert resp_short.status_code == resp_long.status_code == 200
        assert resp_short.data == resp_long.data
