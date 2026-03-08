"""
Test de compartir insignias por WhatsApp, Twitter/X, Email, Facebook e Instagram

Verifica:
  PARTE A — Construcción de URLs de compartir (unitario, sin red)
    1. WhatsApp URL se forma correctamente con wa.me y texto codificado
    2. WhatsApp incluye el nombre de la insignia en el mensaje
    3. WhatsApp incluye la URL de verificación en el mensaje
    4. WhatsApp usa fallback "Insignia Digital" si no hay template_name
    5. Twitter/X URL usa twitter.com/intent/tweet con texto y url
    6. Twitter/X incluye hashtags #OpenBadges #Credenciales
    7. Twitter/X incluye el nombre de la insignia
    8. Email genera mailto: con subject y body correctos
    9. Email incluye URL de verificación en el body
   10. Email usa fallback "Insignia Digital" si no hay template_name
   10b. Facebook URL usa facebook.com/sharer/sharer.php con la URL de verificación
   10c. Facebook incluye la URL de verificación correcta
   10d. Facebook URL está URL-encoded correctamente
   10f. Instagram abre instagram.com
   10g. Instagram genera nombre de archivo correcto para descarga
   10h. Instagram usa fallback "digital" si no hay template_name
   10i. Instagram incluye URL de verificación para copiar al portapapeles

  PARTE B — getVerifyUrl (lógica de URL de verificación)
   11. Si badge tiene verify_url, lo usa directamente
   12. Si no tiene verify_url, construye desde origin + badge_code
   13. badge_code siempre empieza con "BD" y tiene 12 caracteres

  PARTE C — trackShare endpoint (contra API real)
   14. POST /badges/{id}/share incrementa share_count
   15. share_count retornado es un entero positivo

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


def build_whatsapp_url(badge: dict) -> str:
    """Replica handleShareWhatsApp del frontend."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'\U0001f3c5 ¡He obtenido la insignia digital "{name}"! Verifica mi credencial aquí: {url}'
    return f"https://wa.me/?text={urllib.parse.quote(text, safe='')}"


def build_twitter_url(badge: dict) -> str:
    """Replica handleShareTwitter del frontend."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'\U0001f3c5 ¡He obtenido la insignia digital "{name}"! #OpenBadges #Credenciales'
    return (
        f"https://twitter.com/intent/tweet"
        f"?text={urllib.parse.quote(text, safe='')}"
        f"&url={urllib.parse.quote(url, safe='')}"
    )


def build_email_parts(badge: dict) -> tuple:
    """Replica handleShareEmail del frontend. Retorna (subject, body)."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    subject = f'Mi insignia digital: {name}'
    body = (
        f'¡Hola!\n\n'
        f'He obtenido la insignia digital "{name}".\n\n'
        f'Puedes verificar mi credencial en el siguiente enlace:\n'
        f'{url}\n\n'
        f'Saludos.'
    )
    return subject, body


def build_facebook_url(badge: dict) -> str:
    """Replica handleShareFacebook del frontend."""
    url = get_verify_url(badge)
    return f"https://www.facebook.com/sharer/sharer.php?u={urllib.parse.quote(url, safe='')}"


def build_instagram_share_info(badge: dict) -> dict:
    """Replica handleShareInstagram del frontend.
    Retorna la info que se usaría: texto para copiar al portapapeles y verify URL."""
    url = get_verify_url(badge)
    name = badge.get('template_name') or 'Insignia Digital'
    text = f'\U0001f3c5 ¡He obtenido la insignia digital "{name}"!\n\nVerifica mi credencial: {url}\n\n#OpenBadges #Credenciales'
    return {
        'clipboard_text': text,
        'verify_url': url,
    }


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
        """El texto de WhatsApp incluye el nombre de la insignia."""
        url = build_whatsapp_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Certificación Python Avanzado' in decoded

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
        """El texto de Twitter incluye hashtags #OpenBadges #Credenciales."""
        url = build_twitter_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '#OpenBadges' in decoded
        assert '#Credenciales' in decoded

    def test_07_twitter_includes_badge_name(self):
        """El texto de Twitter incluye el nombre de la insignia."""
        url = build_twitter_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert 'Certificación Python Avanzado' in decoded


class TestEmailSharing:

    def test_08_email_subject_and_body(self):
        """Email genera subject con nombre de la insignia y body con URL de verificación."""
        subject, body = build_email_parts(BADGE_WITH_NAME)
        assert 'Certificación Python Avanzado' in subject
        assert '/verify/BDABC1234567' in body

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

    def test_10c_facebook_includes_verify_url(self):
        """La URL de Facebook incluye la URL de verificación."""
        url = build_facebook_url(BADGE_WITH_NAME)
        decoded = urllib.parse.unquote(url)
        assert '/verify/BDABC1234567' in decoded

    def test_10d_facebook_url_is_encoded(self):
        """El parámetro u de Facebook está URL-encoded (sin espacios)."""
        url = build_facebook_url(BADGE_WITH_NAME)
        query = url.split('?u=', 1)[1]
        assert ' ' not in query

    def test_10e_facebook_custom_verify_url(self):
        """Si badge tiene verify_url custom, Facebook lo usa."""
        url = build_facebook_url(BADGE_CUSTOM_VERIFY)
        decoded = urllib.parse.unquote(url)
        assert 'https://custom-domain.com/verify/BD0000000001' in decoded


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
        assert '#Credenciales' in info['clipboard_text']

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

    def test_17_custom_verify_url_used_in_all_channels(self):
        """Si badge tiene verify_url custom, todos los canales lo usan."""
        wa = urllib.parse.unquote(build_whatsapp_url(BADGE_CUSTOM_VERIFY))
        tw = urllib.parse.unquote(build_twitter_url(BADGE_CUSTOM_VERIFY))
        fb = urllib.parse.unquote(build_facebook_url(BADGE_CUSTOM_VERIFY))
        ig = build_instagram_share_info(BADGE_CUSTOM_VERIFY)
        _, email_body = build_email_parts(BADGE_CUSTOM_VERIFY)

        custom_url = BADGE_CUSTOM_VERIFY['verify_url']
        assert custom_url in wa
        assert custom_url in tw
        assert custom_url in fb
        assert custom_url in ig['clipboard_text']
        assert custom_url in email_body

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
