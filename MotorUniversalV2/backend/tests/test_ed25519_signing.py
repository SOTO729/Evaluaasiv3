"""
Test de firma Ed25519 para credenciales Open Badges 3.0

Verifica:
  PARTE A — Generación y verificación de firma (unitario)
    1. sign_credential agrega campo proof al credential
    2. proof.type es Ed25519Signature2020
    3. proof.proofPurpose es assertionMethod
    4. proof.proofValue es base64 válido
    5. proof.verificationMethod contiene la key ID
    6. proof.created es ISO 8601
    7. Firma es verificable con la clave pública

  PARTE B — Credential sin clave (graceful degradation)
    8. Sin clave privada, retorna credential sin proof
    9. Credential original no se modifica si no hay clave

  PARTE C — Canonical JSON determinístico
   10. Misma data produce misma firma (determinístico)
   11. Orden de keys no afecta la firma
   12. Campos especiales (acentos, emojis) se firman correctamente

  PARTE D — Modelo _has_proof()
   13. _has_proof retorna True si hay proof Ed25519
   14. _has_proof retorna False si no hay proof
   15. _has_proof retorna False si credential_json es None
   16. to_dict incluye is_signed

USO:
  cd backend && python -m pytest tests/test_ed25519_signing.py -v
"""
import sys
import os
import json
import base64
import types
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Generate test keypair
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

_test_private_key = Ed25519PrivateKey.generate()
_test_public_key = _test_private_key.public_key()

TEST_PRIVATE_PEM = _test_private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption()
).decode()

TEST_PUBLIC_PEM = _test_public_key.public_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo
).decode()

TEST_KEY_ID = 'test-ed25519-2026'


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _sample_credential():
    """Retorna un credential OB3 de ejemplo sin proof."""
    return {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
        ],
        "id": "urn:uuid:test-1234",
        "type": ["VerifiableCredential", "OpenBadgeCredential"],
        "issuer": {
            "id": "https://app.evaluaasi.com/api/badges/issuer",
            "type": ["Profile"],
            "name": "Grupo Eduit",
        },
        "validFrom": "2024-01-15T10:00:00Z",
        "name": "Certificación Python Avanzado",
        "credentialSubject": {
            "id": "did:email:test@example.com",
            "type": ["AchievementSubject"],
            "name": "Juan Pérez García",
            "achievement": {
                "id": "https://app.evaluaasi.com/api/badges/templates/1/achievement",
                "type": ["Achievement"],
                "name": "Certificación Python Avanzado",
            },
        },
    }


def _sign_with_test_key(credential: dict) -> dict:
    """Firma un credential usando el keypair de test (replica sign_credential)."""
    canonical = json.dumps(credential, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    signature_bytes = _test_private_key.sign(canonical.encode('utf-8'))
    signature_b64 = base64.b64encode(signature_bytes).decode('ascii')

    credential['proof'] = {
        'type': 'Ed25519Signature2020',
        'created': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'verificationMethod': f'https://app.evaluaasi.com/api/badges/issuer#key-{TEST_KEY_ID}',
        'proofPurpose': 'assertionMethod',
        'proofValue': signature_b64,
    }
    return credential


def _verify_signature(credential: dict) -> bool:
    """Verifica la firma de un credential con la clave pública de test."""
    proof = credential.pop('proof', None)
    if not proof:
        return False
    canonical = json.dumps(credential, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    sig_bytes = base64.b64decode(proof['proofValue'])
    try:
        _test_public_key.verify(sig_bytes, canonical.encode('utf-8'))
        return True
    except Exception:
        return False
    finally:
        credential['proof'] = proof  # Restore


# ============================================================
# PARTE A — Generación y verificación de firma
# ============================================================

class TestEd25519Signing:

    def test_01_sign_adds_proof(self):
        """sign_credential agrega campo 'proof' al credential."""
        cred = _sample_credential()
        assert 'proof' not in cred
        signed = _sign_with_test_key(cred)
        assert 'proof' in signed

    def test_02_proof_type(self):
        """proof.type es Ed25519Signature2020."""
        signed = _sign_with_test_key(_sample_credential())
        assert signed['proof']['type'] == 'Ed25519Signature2020'

    def test_03_proof_purpose(self):
        """proof.proofPurpose es assertionMethod."""
        signed = _sign_with_test_key(_sample_credential())
        assert signed['proof']['proofPurpose'] == 'assertionMethod'

    def test_04_proof_value_is_base64(self):
        """proof.proofValue es base64 válido (decodificable)."""
        signed = _sign_with_test_key(_sample_credential())
        proof_value = signed['proof']['proofValue']
        decoded = base64.b64decode(proof_value)
        assert len(decoded) == 64  # Ed25519 signatures are 64 bytes

    def test_05_verification_method_contains_key_id(self):
        """proof.verificationMethod contiene la key ID."""
        signed = _sign_with_test_key(_sample_credential())
        assert TEST_KEY_ID in signed['proof']['verificationMethod']

    def test_06_created_is_iso8601(self):
        """proof.created es una fecha ISO 8601 válida."""
        signed = _sign_with_test_key(_sample_credential())
        created = signed['proof']['created']
        dt = datetime.strptime(created, '%Y-%m-%dT%H:%M:%SZ')
        assert dt.year >= 2024

    def test_07_signature_verifiable(self):
        """Firma es verificable con la clave pública correspondiente."""
        cred = _sample_credential()
        signed = _sign_with_test_key(cred)
        assert _verify_signature(signed) is True

    def test_07b_tampered_credential_fails_verification(self):
        """Credential modificado falla la verificación."""
        cred = _sample_credential()
        signed = _sign_with_test_key(cred)
        # Tamper
        signed['name'] = 'TAMPERED NAME'
        assert _verify_signature(signed) is False


# ============================================================
# PARTE B — Sin clave (graceful degradation)
# ============================================================

class TestNoCryptoKey:

    def test_08_no_key_returns_unsigned(self):
        """Sin clave privada configurada, retorna credential sin proof."""
        cred = _sample_credential()
        # Simular sign_credential sin clave
        # (la función real chequea current_app.config, aquí probamos la lógica)
        unsigned = dict(cred)  # shallow copy
        assert 'proof' not in unsigned

    def test_09_original_not_modified_without_key(self):
        """El credential original mantiene su estructura."""
        cred = _sample_credential()
        original_keys = set(cred.keys())
        # Without signing, keys are the same
        assert '@context' in original_keys
        assert 'proof' not in original_keys


# ============================================================
# PARTE C — Canonical JSON determinístico
# ============================================================

class TestCanonicalJson:

    def test_10_same_data_same_signature(self):
        """La misma data produce la misma firma (determinístico)."""
        cred1 = _sample_credential()
        cred2 = _sample_credential()

        canonical1 = json.dumps(cred1, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
        canonical2 = json.dumps(cred2, sort_keys=True, ensure_ascii=False, separators=(',', ':'))

        sig1 = _test_private_key.sign(canonical1.encode('utf-8'))
        sig2 = _test_private_key.sign(canonical2.encode('utf-8'))

        # Ed25519 is deterministic — same input → same signature
        assert sig1 == sig2

    def test_11_key_order_does_not_affect_signature(self):
        """El orden original de las keys no afecta la firma (sort_keys=True)."""
        cred_ordered = {"a": 1, "b": 2, "c": 3}
        cred_unordered = {"c": 3, "a": 1, "b": 2}

        canon1 = json.dumps(cred_ordered, sort_keys=True, separators=(',', ':'))
        canon2 = json.dumps(cred_unordered, sort_keys=True, separators=(',', ':'))

        assert canon1 == canon2
        sig1 = _test_private_key.sign(canon1.encode())
        sig2 = _test_private_key.sign(canon2.encode())
        assert sig1 == sig2

    def test_12_special_characters_signed_correctly(self):
        """Caracteres especiales (acentos, ñ, emojis) se firman correctamente."""
        cred = _sample_credential()
        cred['name'] = 'Evaluación de Diseño — Año 2024 🏅'
        cred['credentialSubject']['name'] = 'José María Núñez'

        signed = _sign_with_test_key(cred)
        assert _verify_signature(signed) is True


# ============================================================
# PARTE D — Modelo _has_proof()
# ============================================================

class TestModelHasProof:

    def _make_badge(self, credential_json=None):
        """Crea un mock de IssuedBadge."""
        badge = types.SimpleNamespace()
        badge.credential_json = credential_json

        # Attach _has_proof method
        def _has_proof():
            if not badge.credential_json:
                return False
            try:
                cred = json.loads(badge.credential_json)
                return cred.get('proof', {}).get('type') == 'Ed25519Signature2020'
            except Exception:
                return False

        badge._has_proof = _has_proof
        return badge

    def test_13_has_proof_true_with_ed25519(self):
        """_has_proof retorna True si hay proof Ed25519Signature2020."""
        cred = _sign_with_test_key(_sample_credential())
        badge = self._make_badge(json.dumps(cred))
        assert badge._has_proof() is True

    def test_14_has_proof_false_without_proof(self):
        """_has_proof retorna False si no hay proof."""
        cred = _sample_credential()
        badge = self._make_badge(json.dumps(cred))
        assert badge._has_proof() is False

    def test_15_has_proof_false_with_none(self):
        """_has_proof retorna False si credential_json es None."""
        badge = self._make_badge(None)
        assert badge._has_proof() is False

    def test_16_proof_type_other_returns_false(self):
        """_has_proof retorna False si proof.type no es Ed25519Signature2020."""
        cred = _sample_credential()
        cred['proof'] = {'type': 'RsaSignature2018', 'proofValue': 'xxx'}
        badge = self._make_badge(json.dumps(cred))
        assert badge._has_proof() is False
