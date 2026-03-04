"""
Test del módulo de email — TEST_EMAIL_OVERRIDE y tokens de aprobación

Verifica:
  PARTE A — Generación y verificación de tokens (unitario, sin red)
    1. Token válido: genera → verifica → devuelve payload correcto
    2. Token con request_id único (int)
    3. Token con request_ids batch (list[int])
    4. Token firmado con secret distinto → rechazado
    5. Token expirado → rechazado
    6. Token malformado (sin punto) → rechazado
    7. Token con firma truncada → rechazado
    8. Token vacío → rechazado

  PARTE B — TEST_EMAIL_OVERRIDE (unitario, mock de _get_client)
    9. Sin override: send_email recibe destinatario original
   10. Con override: send_email redirige a TEST_EMAIL_OVERRIDE
   11. Con override: subject incluye prefijo [TEST→original]
   12. Con override: CC se anula
   13. Sin override: CC se mantiene

  PARTE C — URLs de aprobación (unitario)
   14. approve_url contiene API_URL configurado
   15. detail_url contiene APP_URL configurado
   16. approve_url contiene token firmado válido
   17. reject_url contiene token firmado válido
   18. Batch email genera URLs con lista de request_ids

  PARTE D — Endpoint email-action en DEV (integración, requiere red)
   19. Token inválido → respuesta HTML con "Enlace inválido"
   20. Token válido con request inexistente → POST devuelve error
   21. Token generado con SECRET_KEY incorrecto → rechazado

USO:
  python tests/test_email_override_and_tokens.py          # Todo
  python tests/test_email_override_and_tokens.py --unit   # Solo unit tests (sin red)
  python tests/test_email_override_and_tokens.py --integ  # Solo integración (con red)
"""
import sys
import os
import time
import json
import hmac
import hashlib
import base64
from unittest.mock import patch, MagicMock

# ─── Agregar backend al path ───
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ─── Constantes ───
DEV_API = "https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io"
DEV_SECRET = "evaluaasi-dev-secret-key-2024"

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {name}")
        passed += 1
    else:
        print(f"  ❌ {name} — {detail}")
        failed += 1


# ============================================================
# PARTE A — Generación y verificación de tokens
# ============================================================
def test_token_generation_and_verification():
    print("\n📋 PARTE A — Generación y verificación de tokens\n")

    from app.services.email_service import (
        generate_email_action_token,
        verify_email_action_token,
        EMAIL_ACTION_SECRET,
        EMAIL_TOKEN_MAX_AGE,
    )

    # 1. Token válido: genera → verifica → payload correcto
    token = generate_email_action_token(42, "user-123", "approve")
    payload = verify_email_action_token(token)
    test("1. Token válido se genera y verifica",
         payload is not None,
         f"payload={payload}")
    if payload:
        test("   - rid es correcto",
             payload.get('rid') == 42,
             f"rid={payload.get('rid')}")
        test("   - gid es correcto",
             payload.get('gid') == "user-123",
             f"gid={payload.get('gid')}")
        test("   - act es correcto",
             payload.get('act') == "approve",
             f"act={payload.get('act')}")
        test("   - ts es reciente (< 5s)",
             abs(time.time() - payload.get('ts', 0)) < 5,
             f"ts={payload.get('ts')}")

    # 2. Token con request_id único (int)
    token_single = generate_email_action_token(1, "g1", "reject")
    p = verify_email_action_token(token_single)
    test("2. Token con request_id int",
         p is not None and isinstance(p['rid'], int) and p['rid'] == 1,
         f"payload={p}")

    # 3. Token con request_ids batch (list[int])
    token_batch = generate_email_action_token([10, 20, 30], "g2", "approve")
    p = verify_email_action_token(token_batch)
    test("3. Token con request_ids list",
         p is not None and isinstance(p['rid'], list) and p['rid'] == [10, 20, 30],
         f"payload={p}")

    # 4. Token firmado con secret distinto → rechazado
    # Generar un token con un secret diferente
    fake_secret = "wrong-secret-key"
    payload_data = json.dumps({
        'rid': 99, 'gid': 'g3', 'act': 'approve', 'ts': int(time.time()),
    }, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_data.encode()).decode().rstrip('=')
    fake_sig = hmac.new(fake_secret.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:32]
    fake_token = f"{payload_b64}.{fake_sig}"
    test("4. Token con secret incorrecto → rechazado",
         verify_email_action_token(fake_token) is None,
         "Debería ser None")

    # 5. Token expirado → rechazado
    expired_payload = json.dumps({
        'rid': 99, 'gid': 'g4', 'act': 'approve',
        'ts': int(time.time()) - EMAIL_TOKEN_MAX_AGE - 100,  # Expirado
    }, separators=(',', ':'))
    expired_b64 = base64.urlsafe_b64encode(expired_payload.encode()).decode().rstrip('=')
    expired_sig = hmac.new(EMAIL_ACTION_SECRET.encode(), expired_b64.encode(), hashlib.sha256).hexdigest()[:32]
    expired_token = f"{expired_b64}.{expired_sig}"
    test("5. Token expirado → rechazado",
         verify_email_action_token(expired_token) is None,
         "Debería ser None")

    # 6. Token malformado (sin punto) → rechazado
    test("6. Token sin punto → rechazado",
         verify_email_action_token("nodottoken") is None,
         "Debería ser None")

    # 7. Token con firma truncada → rechazado
    valid_token = generate_email_action_token(50, "g5", "approve")
    truncated = valid_token[:len(valid_token) - 5] + "XXXXX"
    test("7. Token con firma truncada → rechazado",
         verify_email_action_token(truncated) is None,
         "Debería ser None")

    # 8. Token vacío → rechazado
    test("8. Token vacío → rechazado",
         verify_email_action_token("") is None,
         "Debería ser None")


# ============================================================
# PARTE B — TEST_EMAIL_OVERRIDE
# ============================================================
def test_email_override():
    print("\n📋 PARTE B — TEST_EMAIL_OVERRIDE\n")

    import app.services.email_service as email_mod

    # Crear un mock del EmailClient
    mock_client = MagicMock()
    mock_poller = MagicMock()
    mock_poller.result.return_value = {'id': 'test-msg-id'}
    mock_client.begin_send.return_value = mock_poller

    # 9. Sin override: send_email recibe destinatario original
    original_override = email_mod.TEST_EMAIL_OVERRIDE
    try:
        email_mod.TEST_EMAIL_OVERRIDE = ''
        with patch.object(email_mod, '_get_client', return_value=mock_client):
            mock_client.reset_mock()
            result = email_mod.send_email(
                to="real@example.com",
                subject="Test Subject",
                html="<p>Hello</p>",
                cc=["cc1@example.com"]
            )
            test("9. Sin override: email va a destinatario original",
                 result is True, f"result={result}")
            sent_message = mock_client.begin_send.call_args[0][0]
            actual_to = sent_message['recipients']['to'][0]['address']
            test("   - destinatario es real@example.com",
                 actual_to == "real@example.com",
                 f"actual={actual_to}")
            test("   - subject sin prefijo TEST",
                 sent_message['content']['subject'] == "Test Subject",
                 f"actual={sent_message['content']['subject']}")

        # 10. Con override: send_email redirige
        email_mod.TEST_EMAIL_OVERRIDE = 'test-inbox@company.com'
        with patch.object(email_mod, '_get_client', return_value=mock_client):
            mock_client.reset_mock()
            result = email_mod.send_email(
                to="real@example.com",
                subject="Test Subject",
                html="<p>Hello</p>",
            )
            test("10. Con override: email se redirige",
                 result is True, f"result={result}")
            sent_message = mock_client.begin_send.call_args[0][0]
            actual_to = sent_message['recipients']['to'][0]['address']
            test("   - destinatario es test-inbox@company.com",
                 actual_to == "test-inbox@company.com",
                 f"actual={actual_to}")

        # 11. Con override: subject incluye prefijo [TEST→original]
            actual_subject = sent_message['content']['subject']
            test("11. Subject incluye prefijo [TEST→original]",
                 "[TEST→real@example.com]" in actual_subject,
                 f"actual={actual_subject}")
            test("   - subject aún contiene el asunto original",
                 "Test Subject" in actual_subject,
                 f"actual={actual_subject}")

        # 12. Con override: CC se anula
        email_mod.TEST_EMAIL_OVERRIDE = 'test-inbox@company.com'
        with patch.object(email_mod, '_get_client', return_value=mock_client):
            mock_client.reset_mock()
            email_mod.send_email(
                to="real@example.com",
                subject="Test",
                html="<p>Hi</p>",
                cc=["cc1@example.com", "cc2@example.com"]
            )
            sent_message = mock_client.begin_send.call_args[0][0]
            has_cc = 'cc' in sent_message.get('recipients', {})
            test("12. Con override: CC se anula",
                 not has_cc,
                 f"recipients={sent_message.get('recipients', {})}")

        # 13. Sin override: CC se mantiene
        email_mod.TEST_EMAIL_OVERRIDE = ''
        with patch.object(email_mod, '_get_client', return_value=mock_client):
            mock_client.reset_mock()
            email_mod.send_email(
                to="real@example.com",
                subject="Test",
                html="<p>Hi</p>",
                cc=["cc1@example.com"]
            )
            sent_message = mock_client.begin_send.call_args[0][0]
            cc_list = sent_message.get('recipients', {}).get('cc', [])
            test("13. Sin override: CC se mantiene",
                 len(cc_list) == 1 and cc_list[0]['address'] == "cc1@example.com",
                 f"cc={cc_list}")

    finally:
        email_mod.TEST_EMAIL_OVERRIDE = original_override


# ============================================================
# PARTE C — URLs de aprobación
# ============================================================
def test_approval_urls():
    print("\n📋 PARTE C — URLs de aprobación en emails\n")

    import app.services.email_service as email_mod
    from app.services.email_service import (
        generate_email_action_token,
        verify_email_action_token,
    )

    # Guardar originales
    orig_api_url = email_mod.API_URL
    orig_app_url = email_mod.APP_URL
    orig_override = email_mod.TEST_EMAIL_OVERRIDE

    try:
        # Configurar como DEV
        email_mod.API_URL = "https://dev-api.example.com"
        email_mod.APP_URL = "https://dev-app.example.com"
        email_mod.TEST_EMAIL_OVERRIDE = ''  # No override para inspeccionar el HTML

        mock_client = MagicMock()
        mock_poller = MagicMock()
        mock_poller.result.return_value = {'id': 'test-msg-id'}
        mock_client.begin_send.return_value = mock_poller

        # 14 & 15. Verificar que send_balance_approval_email usa API_URL y APP_URL
        with patch.object(email_mod, '_get_client', return_value=mock_client):
            mock_client.reset_mock()
            email_mod.send_balance_approval_email(
                gerente_email="gerente@test.com",
                gerente_name="Test Gerente",
                gerente_id="gerente-1",
                request_id=100,
                coordinator_name="Test Coord",
                campus_name="Campus A",
                amount=5000.0,
                request_type="saldo",
                justification="Test justificación",
            )

            sent_message = mock_client.begin_send.call_args[0][0]
            html = sent_message['content']['html']
            plain = sent_message['content'].get('plainText', '')

            test("14. approve_url contiene API_URL configurado",
                 "https://dev-api.example.com/api/balance/email-action/" in html,
                 f"API_URL no encontrado en HTML (len={len(html)})")

            test("15. detail_url contiene APP_URL configurado",
                 "https://dev-app.example.com/gerente/aprobaciones/100" in html,
                 "APP_URL no encontrado en HTML")

            # 16. approve_url contiene un token firmado válido
            import re
            approve_matches = re.findall(
                r'https://dev-api\.example\.com/api/balance/email-action/([^\s"<]+)',
                html
            )
            test("16. approve_url contiene token firmado",
                 len(approve_matches) >= 1,
                 f"matches={len(approve_matches)}")
            if approve_matches:
                # El primer match debería ser approve
                approve_token = approve_matches[0]
                approve_payload = verify_email_action_token(approve_token)
                test("   - token approve es verificable",
                     approve_payload is not None and approve_payload.get('act') == 'approve',
                     f"payload={approve_payload}")
                test("   - token contiene request_id correcto",
                     approve_payload is not None and approve_payload.get('rid') == 100,
                     f"rid={approve_payload.get('rid') if approve_payload else 'None'}")

            # 17. reject_url contiene un token firmado válido
            reject_tokens = [m for m in approve_matches if verify_email_action_token(m) and verify_email_action_token(m).get('act') == 'reject']
            # Buscar reject en plain text también
            reject_matches = re.findall(
                r'https://dev-api\.example\.com/api/balance/email-action/([^\s"<]+)',
                plain + ' ' + html
            )
            reject_payloads = [verify_email_action_token(t) for t in reject_matches]
            reject_found = any(p and p.get('act') == 'reject' for p in reject_payloads)
            test("17. reject_url contiene token firmado válido",
                 reject_found,
                 f"reject tokens encontrados: {sum(1 for p in reject_payloads if p and p.get('act')=='reject')}")

        # 18. Batch email genera URLs con lista de request_ids
        with patch.object(email_mod, '_get_client', return_value=mock_client):
            mock_client.reset_mock()
            email_mod.send_balance_batch_approval_email(
                gerente_email="gerente@test.com",
                gerente_name="Test Gerente",
                gerente_id="gerente-2",
                coordinator_name="Test Coord",
                justification="Batch test",
                items=[
                    {'request_id': 201, 'campus_name': 'Campus A', 'group_name': 'Grupo 1',
                     'amount': 1000.0, 'request_type': 'saldo'},
                    {'request_id': 202, 'campus_name': 'Campus B', 'group_name': 'Grupo 2',
                     'amount': 2000.0, 'request_type': 'beca'},
                ],
            )
            sent_message = mock_client.begin_send.call_args[0][0]
            html = sent_message['content']['html']
            batch_matches = re.findall(
                r'https://dev-api\.example\.com/api/balance/email-action/([^\s"<]+)',
                html
            )
            batch_payloads = [verify_email_action_token(t) for t in batch_matches]
            batch_approve = [p for p in batch_payloads if p and p.get('act') == 'approve']
            test("18. Batch email: token approve contiene lista de request_ids",
                 len(batch_approve) >= 1 and batch_approve[0].get('rid') == [201, 202],
                 f"approve payloads={batch_approve}")

    finally:
        email_mod.API_URL = orig_api_url
        email_mod.APP_URL = orig_app_url
        email_mod.TEST_EMAIL_OVERRIDE = orig_override


# ============================================================
# PARTE D — Endpoint email-action en DEV (integración)
# ============================================================
def test_email_action_endpoint():
    print("\n📋 PARTE D — Endpoint email-action en DEV (integración)\n")

    try:
        import requests as http
    except ImportError:
        print("  ⚠️ requests no instalado, saltando tests de integración")
        return

    # 19. Token inválido → respuesta HTML con "Enlace inválido"
    r = http.get(f"{DEV_API}/api/balance/email-action/clearly-invalid-token", timeout=15)
    test("19. Token inválido → status 400",
         r.status_code == 400,
         f"status={r.status_code}")
    test("   - Respuesta contiene 'Enlace inválido'",
         "Enlace" in r.text and "lido" in r.text,
         f"text={r.text[:200]}")

    # 20. Token válido con request inexistente → POST devuelve error sobre solicitud
    valid_token = _generate_token_with_secret(999999, "nonexistent-user", "approve", DEV_SECRET)
    r_get = http.get(f"{DEV_API}/api/balance/email-action/{valid_token}", timeout=15)
    test("20. Token válido (request inexistente) → GET devuelve página de carga",
         r_get.status_code == 200 and "Procesando" in r_get.text,
         f"status={r_get.status_code}, text={r_get.text[:200]}")

    r_post = http.post(f"{DEV_API}/api/balance/email-action/{valid_token}", timeout=15)
    test("   - POST devuelve error (user no existe)",
         r_post.status_code in (400, 403),
         f"status={r_post.status_code}, body={r_post.text[:300]}")

    # 21. Token generado con SECRET incorrecto → rechazado
    bad_token = _generate_token_with_secret(1, "g1", "approve", "wrong-secret-totally")
    r = http.get(f"{DEV_API}/api/balance/email-action/{bad_token}", timeout=15)
    test("21. Token con SECRET incorrecto → rechazado (400)",
         r.status_code == 400,
         f"status={r.status_code}")
    test("   - Respuesta contiene 'Enlace inválido'",
         "Enlace" in r.text and "lido" in r.text,
         f"text={r.text[:200]}")


def _generate_token_with_secret(request_id, gerente_id, action, secret):
    """Genera un token HMAC con un secret específico (para testing)."""
    payload = json.dumps({
        'rid': request_id,
        'gid': gerente_id,
        'act': action,
        'ts': int(time.time()),
    }, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip('=')
    sig = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{payload_b64}.{sig}"


# ============================================================
# MAIN
# ============================================================
def main():
    global passed, failed

    run_unit = True
    run_integ = True

    if '--unit' in sys.argv:
        run_integ = False
    if '--integ' in sys.argv:
        run_unit = False

    print("=" * 60)
    print("TEST: Email Override, Tokens y URLs de Aprobación")
    print("=" * 60)

    if run_unit:
        test_token_generation_and_verification()
        test_email_override()
        test_approval_urls()

    if run_integ:
        test_email_action_endpoint()

    print("\n" + "=" * 60)
    total = passed + failed
    print(f"RESULTADO: {passed}/{total} tests pasaron")
    if failed:
        print(f"           {failed} tests FALLARON ❌")
    else:
        print("           ¡Todos los tests pasaron! ✅")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
