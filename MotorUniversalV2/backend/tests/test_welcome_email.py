"""
Test del email de bienvenida ejecutivo — send_welcome_email

Verifica:
  PARTE A — Lógica de la función (unitario, mock de send_email)
    1. Retorna False si user.email está vacío
    2. Retorna False si user.email es None
    3. Llama a send_email con destinatario correcto
    4. Subject contiene "Bienvenido" y "Evaluaasi"
    5. HTML contiene nombre completo del usuario
    6. HTML contiene username en credenciales
    7. HTML contiene contraseña temporal en credenciales
    8. HTML contiene botón "Iniciar Sesión"
    9. HTML contiene URL de login (APP_URL/login)
   10. HTML contiene sección "Primeros pasos"
   11. HTML contiene aviso de seguridad
   12. Plain text contiene credenciales
   13. Plain text contiene rol del usuario

  PARTE B — Mapa de roles (_ROLE_LABELS)
   14. Todos los roles conocidos mapeados correctamente
   15. Rol desconocido devuelve 'Usuario' por defecto
   16. User sin atributo role devuelve 'Usuario'

  PARTE C — Variantes de nombre
   17. Solo name → usa name
   18. Solo first_surname → usa surname
   19. Ambos campos → "name first_surname"
   20. Ningún campo pero username → usa username
   21. Ningún campo ni username → usa 'Usuario'

  PARTE D — Integración con send_email (mock de _get_client)
   22. send_welcome_email llega a send_email real (con ACS mockeado)
   23. Con TEST_EMAIL_OVERRIDE activo → redirige destinatario

USO:
  cd backend && python -m pytest tests/test_welcome_email.py -v
"""
import sys
import os
import types

# ─── backend en el path ───
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import patch, MagicMock, call


# ──────────────────────────────────────────────────────────────
# Helper: crear fake user con atributos opcionales
# ──────────────────────────────────────────────────────────────
def _fake_user(**kwargs):
    defaults = {
        'email': 'test@example.com',
        'username': 'usuario1',
        'name': 'Juan',
        'first_surname': 'Pérez',
        'role': 'candidato',
    }
    defaults.update(kwargs)
    return types.SimpleNamespace(**defaults)


# ============================================================
# PARTE A — Lógica de la función
# ============================================================

class TestSendWelcomeEmailLogic:
    """Tests unitarios con send_email mockeado."""

    @patch('app.services.email_service.send_email', return_value=True)
    def test_01_returns_false_empty_email(self, mock_send):
        from app.services.email_service import send_welcome_email
        user = _fake_user(email='')
        assert send_welcome_email(user, 'Temp1234!') is False
        mock_send.assert_not_called()

    @patch('app.services.email_service.send_email', return_value=True)
    def test_02_returns_false_none_email(self, mock_send):
        from app.services.email_service import send_welcome_email
        user = _fake_user(email=None)
        assert send_welcome_email(user, 'Temp1234!') is False
        mock_send.assert_not_called()

    @patch('app.services.email_service.send_email', return_value=True)
    def test_03_calls_send_email_with_correct_recipient(self, mock_send):
        from app.services.email_service import send_welcome_email
        user = _fake_user(email='dest@corp.com')
        send_welcome_email(user, 'Pass99!')
        mock_send.assert_called_once()
        assert mock_send.call_args.kwargs['to'] == 'dest@corp.com'

    @patch('app.services.email_service.send_email', return_value=True)
    def test_04_subject_contains_bienvenido_and_evaluaasi(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'X')
        subj = mock_send.call_args.kwargs['subject']
        assert 'Bienvenido' in subj
        assert 'Evaluaasi' in subj

    @patch('app.services.email_service.send_email', return_value=True)
    def test_05_html_contains_full_name(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(name='María', first_surname='López'), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'María López' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_06_html_contains_username(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(username='jperez99'), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'jperez99' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_07_html_contains_temporary_password(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'MyTemp$ecr3t!')
        html = mock_send.call_args.kwargs['html']
        assert 'MyTemp$ecr3t!' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_08_html_contains_login_button(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Iniciar Sesión' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_09_html_contains_login_url(self, mock_send):
        from app.services.email_service import send_welcome_email, APP_URL
        send_welcome_email(_fake_user(), 'X')
        html = mock_send.call_args.kwargs['html']
        assert f'{APP_URL}/login' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_10_html_contains_primeros_pasos(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Primeros pasos' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_11_html_contains_security_warning(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Seguridad' in html
        assert 'No compartas' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_12_plain_text_contains_credentials(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(username='usr1'), 'TmpPwd!')
        plain = mock_send.call_args.kwargs['plain_text']
        assert 'usr1' in plain
        assert 'TmpPwd!' in plain

    @patch('app.services.email_service.send_email', return_value=True)
    def test_13_plain_text_contains_role(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(role='coordinator'), 'X')
        plain = mock_send.call_args.kwargs['plain_text']
        assert 'Coordinador' in plain


# ============================================================
# PARTE B — Mapa de roles
# ============================================================

class TestRoleLabels:

    @patch('app.services.email_service.send_email', return_value=True)
    def test_14_all_known_roles_mapped(self, mock_send):
        from app.services.email_service import send_welcome_email, _ROLE_LABELS
        expected = {
            'candidato': 'Candidato',
            'responsable': 'Responsable de Plantel',
            'responsable_partner': 'Responsable de Partner',
            'auxiliar': 'Auxiliar de Coordinación',
            'coordinator': 'Coordinador',
            'editor': 'Editor de Contenido',
            'editor_invitado': 'Editor Invitado',
            'gerente': 'Gerente',
            'financiero': 'Financiero',
            'admin': 'Administrador',
        }
        for role_key, role_label in expected.items():
            send_welcome_email(_fake_user(role=role_key), 'X')
            html = mock_send.call_args.kwargs['html']
            assert role_label in html, f"Rol '{role_key}' debería generar '{role_label}'"

    @patch('app.services.email_service.send_email', return_value=True)
    def test_15_unknown_role_defaults_to_usuario(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(role='superadmin_custom'), 'X')
        html = mock_send.call_args.kwargs['html']
        # 'Usuario' es el fallback del .get()
        assert 'Usuario' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_16_no_role_attribute_defaults_to_usuario(self, mock_send):
        from app.services.email_service import send_welcome_email
        user = types.SimpleNamespace(
            email='a@b.com', username='u1', name='A', first_surname='B'
        )
        # No 'role' attr at all
        send_welcome_email(user, 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Usuario' in html


# ============================================================
# PARTE C — Variantes de nombre
# ============================================================

class TestNameVariants:

    @patch('app.services.email_service.send_email', return_value=True)
    def test_17_only_name(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(name='Carlos', first_surname=''), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Carlos' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_18_only_surname(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(name='', first_surname='Gómez'), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Gómez' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_19_both_name_and_surname(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(_fake_user(name='Ana', first_surname='Ruiz'), 'X')
        html = mock_send.call_args.kwargs['html']
        assert 'Ana Ruiz' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_20_no_name_falls_back_to_username(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(
            _fake_user(name='', first_surname='', username='fallback_user'), 'X'
        )
        html = mock_send.call_args.kwargs['html']
        assert 'fallback_user' in html

    @patch('app.services.email_service.send_email', return_value=True)
    def test_21_no_name_no_username_falls_back_to_usuario(self, mock_send):
        from app.services.email_service import send_welcome_email
        send_welcome_email(
            _fake_user(name='', first_surname='', username=''), 'X'
        )
        html = mock_send.call_args.kwargs['html']
        assert 'Usuario' in html


# ============================================================
# PARTE D — Integración con send_email (mock de _get_client)
# ============================================================

class TestIntegrationWithSendEmail:

    @patch('app.services.email_service._get_client')
    def test_22_reaches_real_send_email(self, mock_get_client):
        """send_welcome_email llega a send_email real, que intenta enviar via ACS."""
        from app.services.email_service import send_welcome_email

        mock_client = MagicMock()
        mock_poller = MagicMock()
        mock_poller.result.return_value = MagicMock(status='Succeeded')
        mock_client.begin_send.return_value = mock_poller
        mock_get_client.return_value = mock_client

        result = send_welcome_email(_fake_user(email='real@test.com'), 'Pass!')
        assert result is True
        mock_client.begin_send.assert_called_once()

        # Verificar que el message tiene los campos correctos
        sent_msg = mock_client.begin_send.call_args[0][0]
        assert sent_msg['recipients']['to'][0]['address'] == 'real@test.com'
        assert 'Bienvenido' in sent_msg['content']['subject']
        assert 'Pass!' in sent_msg['content']['html']

    @patch('app.services.email_service._get_client')
    @patch.dict(os.environ, {'TEST_EMAIL_OVERRIDE': 'override@test.com'})
    def test_23_test_email_override_redirects(self, mock_get_client):
        """Con TEST_EMAIL_OVERRIDE activo el email se redirige."""
        # Recargar el módulo para que tome el env var
        import importlib
        import app.services.email_service as mod
        original_override = mod.TEST_EMAIL_OVERRIDE
        mod.TEST_EMAIL_OVERRIDE = 'override@test.com'

        mock_client = MagicMock()
        mock_poller = MagicMock()
        mock_poller.result.return_value = MagicMock(status='Succeeded')
        mock_client.begin_send.return_value = mock_poller
        mock_get_client.return_value = mock_client

        try:
            mod.send_welcome_email(_fake_user(email='original@user.com'), 'Pwd!')
            sent_msg = mock_client.begin_send.call_args[0][0]
            assert sent_msg['recipients']['to'][0]['address'] == 'override@test.com'
            assert '[TEST' in sent_msg['content']['subject']
        finally:
            mod.TEST_EMAIL_OVERRIDE = original_override
