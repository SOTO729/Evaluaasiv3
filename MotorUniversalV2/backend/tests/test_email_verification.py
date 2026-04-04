"""
Tests para la funcionalidad de verificación de email.

Cubre:
  A) Token generation & verification (generate_email_verification_token, verify_email_verification_token)
  B) send_email_verification (con y sin credentials)
  C) send_email_reconfirmation
  D) Endpoint GET /api/auth/verify-email
  E) Endpoint POST /api/auth/resend-verification

Ejecutar:
  cd backend && python -m pytest tests/test_email_verification.py -v
"""

import json
import time
import types
import os
from unittest.mock import patch, MagicMock

# Set before any app imports to avoid AzureStorageService init failures
os.environ.setdefault(
    'AZURE_STORAGE_CONNECTION_STRING',
    'DefaultEndpointsProtocol=https;AccountName=fake;AccountKey=ZmFrZQ==;EndpointSuffix=core.windows.net'
)

import pytest

# ─── Helpers ─────────────────────────────────────────────────────────────

def _fake_user(**overrides):
    defaults = {
        'id': 'user-uuid-abc123',
        'username': 'juantest',
        'email': 'juan@test.com',
        'name': 'Juan',
        'first_surname': 'Pérez',
        'role': 'candidato',
        'is_verified': False,
        'is_active': True,
        'encrypted_password': None,
    }
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


# ═══════════════════════════════════════════════════════════════════════════
# PARTE A — Token generation & verification
# ═══════════════════════════════════════════════════════════════════════════

class TestTokenGeneration:

    def test_01_generate_returns_string_with_dot(self):
        from app.services.email_service import generate_email_verification_token
        token = generate_email_verification_token('uid-123')
        assert isinstance(token, str)
        assert '.' in token
        parts = token.split('.')
        assert len(parts) == 2, "Token must be payload.signature"

    def test_02_verify_valid_token_returns_uid(self):
        from app.services.email_service import (
            generate_email_verification_token,
            verify_email_verification_token,
        )
        uid = 'test-user-id-999'
        token = generate_email_verification_token(uid)
        result = verify_email_verification_token(token)
        assert result == uid

    def test_03_verify_tampered_payload_returns_none(self):
        from app.services.email_service import (
            generate_email_verification_token,
            verify_email_verification_token,
        )
        token = generate_email_verification_token('uid-tamper')
        payload_b64, sig = token.split('.')
        # Flip a character in the payload
        tampered = payload_b64[:-1] + ('A' if payload_b64[-1] != 'A' else 'B')
        result = verify_email_verification_token(f"{tampered}.{sig}")
        assert result is None

    def test_04_verify_tampered_signature_returns_none(self):
        from app.services.email_service import (
            generate_email_verification_token,
            verify_email_verification_token,
        )
        token = generate_email_verification_token('uid-sig')
        payload_b64, sig = token.split('.')
        bad_sig = sig[:-1] + ('a' if sig[-1] != 'a' else 'b')
        result = verify_email_verification_token(f"{payload_b64}.{bad_sig}")
        assert result is None

    def test_05_verify_expired_token_returns_none(self):
        from app.services.email_service import (
            generate_email_verification_token,
            verify_email_verification_token,
            EMAIL_TOKEN_MAX_AGE,
        )
        with patch('app.services.email_service.time') as mock_time:
            # Generate token "8 days ago"
            past = time.time() - EMAIL_TOKEN_MAX_AGE - 3600
            mock_time.time.return_value = past
            token = generate_email_verification_token('uid-expired')

        # Verify with real time → should be expired
        result = verify_email_verification_token(token)
        assert result is None

    def test_06_verify_empty_string_returns_none(self):
        from app.services.email_service import verify_email_verification_token
        assert verify_email_verification_token('') is None

    def test_07_verify_no_dot_returns_none(self):
        from app.services.email_service import verify_email_verification_token
        assert verify_email_verification_token('nodotstring') is None

    def test_08_verify_garbage_returns_none(self):
        from app.services.email_service import verify_email_verification_token
        assert verify_email_verification_token('abc.def.ghi') is None

    def test_09_verify_wrong_purpose_returns_none(self):
        """Token with purpose != 'email_verify' should fail."""
        import base64, hashlib, hmac as hmac_mod
        from app.services.email_service import EMAIL_ACTION_SECRET, verify_email_verification_token

        payload = json.dumps({
            'uid': 'uid-wrong-purpose',
            'purpose': 'password_reset',
            'ts': int(time.time()),
        }, separators=(',', ':'))
        payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip('=')
        sig = hmac_mod.new(EMAIL_ACTION_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:32]
        result = verify_email_verification_token(f"{payload_b64}.{sig}")
        assert result is None

    def test_10_different_uids_different_tokens(self):
        from app.services.email_service import generate_email_verification_token
        t1 = generate_email_verification_token('uid-A')
        t2 = generate_email_verification_token('uid-B')
        assert t1 != t2


# ═══════════════════════════════════════════════════════════════════════════
# PARTE B — send_email_verification
# ═══════════════════════════════════════════════════════════════════════════

class TestSendEmailVerification:

    @patch('app.services.email_service.send_email', return_value=True)
    def test_11_sends_verification_email(self, mock_send):
        from app.services.email_service import send_email_verification
        user = _fake_user()
        result = send_email_verification(user)
        assert result is True
        mock_send.assert_called_once()

    @patch('app.services.email_service.send_email', return_value=True)
    def test_12_subject_contains_confirma(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user())
        kwargs = mock_send.call_args[1]
        assert 'Confirma tu correo' in kwargs['subject']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_13_html_contains_verify_url(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user())
        kwargs = mock_send.call_args[1]
        assert '/verify-email?token=' in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_14_html_contains_user_name(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user(name='María', first_surname='García'))
        kwargs = mock_send.call_args[1]
        assert 'María García' in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_15_plain_text_contains_verify_url(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user())
        kwargs = mock_send.call_args[1]
        assert '/verify-email?token=' in kwargs['plain_text']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_16_returns_false_for_empty_email(self, mock_send):
        from app.services.email_service import send_email_verification
        user = _fake_user(email='')
        result = send_email_verification(user)
        assert result is False
        mock_send.assert_not_called()

    @patch('app.services.email_service.send_email', return_value=True)
    def test_17_returns_false_for_none_email(self, mock_send):
        from app.services.email_service import send_email_verification
        user = _fake_user(email=None)
        result = send_email_verification(user)
        assert result is False
        mock_send.assert_not_called()

    # --- include_credentials=True (resend) ---

    @patch('app.models.user.decrypt_password', return_value='miPassword123')
    @patch('app.services.email_service.send_email', return_value=True)
    def test_18_resend_includes_credentials_in_html(self, mock_send, mock_decrypt):
        from app.services.email_service import send_email_verification
        user = _fake_user(encrypted_password=b'encrypted_blob')
        send_email_verification(user, include_credentials=True)
        kwargs = mock_send.call_args[1]
        assert 'miPassword123' in kwargs['html']
        assert 'juantest' in kwargs['html']

    @patch('app.models.user.decrypt_password', return_value='miPassword123')
    @patch('app.services.email_service.send_email', return_value=True)
    def test_19_resend_includes_credentials_in_plain_text(self, mock_send, mock_decrypt):
        from app.services.email_service import send_email_verification
        user = _fake_user(encrypted_password=b'encrypted_blob')
        send_email_verification(user, include_credentials=True)
        kwargs = mock_send.call_args[1]
        assert 'miPassword123' in kwargs['plain_text']

    @patch('app.models.user.decrypt_password', return_value='miPassword123')
    @patch('app.services.email_service.send_email', return_value=True)
    def test_20_resend_subject_says_reenvio(self, mock_send, mock_decrypt):
        from app.services.email_service import send_email_verification
        user = _fake_user(encrypted_password=b'encrypted_blob')
        send_email_verification(user, include_credentials=True)
        kwargs = mock_send.call_args[1]
        assert 'Reenvío' in kwargs['subject'] or 'eenvío' in kwargs['subject']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_21_no_credentials_without_flag(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user())
        kwargs = mock_send.call_args[1]
        # Should NOT contain credentials block
        assert 'Tus credenciales de acceso' not in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_22_html_contains_expiration_warning(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user())
        kwargs = mock_send.call_args[1]
        assert '7 días' in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_23_sends_to_correct_email(self, mock_send):
        from app.services.email_service import send_email_verification
        send_email_verification(_fake_user(email='target@example.com'))
        kwargs = mock_send.call_args[1]
        assert kwargs['to'] == 'target@example.com'


# ═══════════════════════════════════════════════════════════════════════════
# PARTE C — send_email_reconfirmation
# ═══════════════════════════════════════════════════════════════════════════

class TestSendEmailReconfirmation:

    @patch('app.services.email_service.send_email', return_value=True)
    def test_24_sends_reconfirmation_email(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        result = send_email_reconfirmation(_fake_user())
        assert result is True
        mock_send.assert_called_once()

    @patch('app.services.email_service.send_email', return_value=True)
    def test_25_subject_contains_verifica(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        send_email_reconfirmation(_fake_user())
        kwargs = mock_send.call_args[1]
        assert 'Verifica tu nueva dirección' in kwargs['subject']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_26_html_mentions_responsable(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        send_email_reconfirmation(_fake_user())
        kwargs = mock_send.call_args[1]
        assert 'responsable de tu plantel' in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_27_html_contains_verify_url(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        send_email_reconfirmation(_fake_user())
        kwargs = mock_send.call_args[1]
        assert '/verify-email?token=' in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_28_plain_text_contains_verify_url(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        send_email_reconfirmation(_fake_user())
        kwargs = mock_send.call_args[1]
        assert '/verify-email?token=' in kwargs['plain_text']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_29_returns_false_for_empty_email(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        assert send_email_reconfirmation(_fake_user(email='')) is False
        mock_send.assert_not_called()

    @patch('app.services.email_service.send_email', return_value=True)
    def test_30_html_contains_user_name(self, mock_send):
        from app.services.email_service import send_email_reconfirmation
        send_email_reconfirmation(_fake_user(name='Ana', first_surname='López'))
        kwargs = mock_send.call_args[1]
        assert 'Ana López' in kwargs['html']


# ═══════════════════════════════════════════════════════════════════════════
# PARTE D — Endpoint GET /api/auth/verify-email
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def app():
    """Create a test Flask app with in-memory SQLite."""
    from app import create_app, db as _db
    app = create_app('testing')
    with app.app_context():
        _db.create_all()
    yield app
    with app.app_context():
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(app):
    from app import db as _db
    with app.app_context():
        yield _db


def _create_test_user(db, **overrides):
    """Insert a real User into the test database."""
    from app.models.user import User
    defaults = dict(
        username='testuser',
        email='test@example.com',
        is_verified=False,
        is_active=True,
        role='candidato',
        name='Test',
        first_surname='User',
    )
    defaults.update(overrides)
    user = User(**defaults)
    user.set_password('TestPass123!')
    db.session.add(user)
    db.session.commit()
    return user


class TestVerifyEmailEndpoint:

    def test_31_missing_token_returns_400(self, client):
        resp = client.get('/api/auth/verify-email')
        assert resp.status_code == 400
        data = resp.get_json()
        assert 'Token' in data.get('error', '') or 'token' in data.get('error', '').lower()

    @patch('app.services.email_service.verify_email_verification_token', return_value=None)
    def test_32_invalid_token_returns_400(self, mock_verify, client):
        resp = client.get('/api/auth/verify-email?token=invalid.token')
        assert resp.status_code == 400
        data = resp.get_json()
        assert 'expirado' in data.get('error', '') or 'inválido' in data.get('error', '').lower()

    def test_33_user_not_found_returns_404(self, client):
        """Token is valid but user_id doesn't exist in DB."""
        from app.services.email_service import generate_email_verification_token
        token = generate_email_verification_token('nonexistent-uid')
        resp = client.get(f'/api/auth/verify-email?token={token}')
        assert resp.status_code == 404

    def test_34_already_verified_returns_200_with_flag(self, client, db):
        user = _create_test_user(db, is_verified=True)
        from app.services.email_service import generate_email_verification_token
        token = generate_email_verification_token(str(user.id))
        resp = client.get(f'/api/auth/verify-email?token={token}')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get('already_verified') is True

    def test_35_successful_verification_sets_is_verified(self, client, db):
        user = _create_test_user(db, username='unverified', email='unv@test.com', is_verified=False)
        from app.services.email_service import generate_email_verification_token
        token = generate_email_verification_token(str(user.id))
        resp = client.get(f'/api/auth/verify-email?token={token}')
        assert resp.status_code == 200
        # Refresh from DB
        from app.models.user import User
        refreshed = db.session.get(User, user.id)
        assert refreshed.is_verified is True


# ═══════════════════════════════════════════════════════════════════════════
# PARTE E — Endpoint POST /api/auth/resend-verification
# ═══════════════════════════════════════════════════════════════════════════

class TestResendVerificationEndpoint:

    def test_36_missing_email_returns_400(self, client):
        resp = client.post('/api/auth/resend-verification',
                           json={},
                           content_type='application/json')
        assert resp.status_code == 400

    def test_37_nonexistent_email_returns_200(self, client):
        """Should always return 200 to not reveal email existence."""
        resp = client.post('/api/auth/resend-verification',
                           json={'email': 'noexiste@test.com'},
                           content_type='application/json')
        assert resp.status_code == 200

    def test_38_already_verified_returns_200_with_message(self, client, db):
        _create_test_user(db, username='verified_u', email='verified@test.com', is_verified=True)
        resp = client.post('/api/auth/resend-verification',
                           json={'email': 'verified@test.com'},
                           content_type='application/json')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'ya fue verificado' in data.get('message', '')

    @patch('app.services.email_service.send_email_verification', return_value=True)
    def test_39_unverified_user_triggers_send(self, mock_send_verif, client, db):
        _create_test_user(db, username='unverified_u', email='unverified@test.com', is_verified=False)
        resp = client.post('/api/auth/resend-verification',
                           json={'email': 'unverified@test.com'},
                           content_type='application/json')
        assert resp.status_code == 200
        mock_send_verif.assert_called_once()
        # Verify include_credentials=True was passed
        call_kwargs = mock_send_verif.call_args
        assert call_kwargs[1].get('include_credentials') is True or call_kwargs[0][1] is True


# ═══════════════════════════════════════════════════════════════════════════
# PARTE F — send_welcome_email now includes verify link
# ═══════════════════════════════════════════════════════════════════════════

class TestWelcomeEmailVerifyLink:

    @patch('app.services.email_service.send_email', return_value=True)
    def test_40_welcome_email_html_contains_verify_url(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'TempPass123')
        kwargs = mock_send.call_args[1]
        assert '/verify-email?token=' in kwargs['html']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_41_welcome_email_plain_text_contains_verify_url(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'TempPass123')
        kwargs = mock_send.call_args[1]
        assert '/verify-email?token=' in kwargs['plain_text']

    @patch('app.services.email_service.send_email', return_value=True)
    def test_42_welcome_email_has_verificar_button(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'TempPass123')
        kwargs = mock_send.call_args[1]
        assert 'Verificar mi correo' in kwargs['html']
