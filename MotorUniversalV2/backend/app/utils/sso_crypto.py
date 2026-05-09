"""
Cifrado simétrico para API keys SSO de plantel.

Permite almacenar la API key de cada Campus cifrada (Fernet/AES-128-CBC + HMAC)
para que un usuario autorizado pueda revelarla bajo demanda.

La llave maestra viene de la variable de entorno SSO_KEY_ENC. Si no está
seteada, se deriva determinísticamente de SECRET_KEY usando HKDF-SHA256, lo
cual NO es ideal en producción (se recomienda setear SSO_KEY_ENC explícita)
pero permite que dev/local funcione sin configuración adicional.
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


_FERNET: Optional[Fernet] = None


def _derive_key_from_secret(secret: str) -> bytes:
    """Deriva una llave Fernet (32 bytes urlsafe-base64) desde SECRET_KEY."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'evaluaasi-sso-api-key-v1',
        info=b'fernet',
    )
    raw = hkdf.derive(secret.encode('utf-8'))
    return base64.urlsafe_b64encode(raw)


def _get_fernet() -> Fernet:
    global _FERNET
    if _FERNET is not None:
        return _FERNET

    enc_key = os.environ.get('SSO_KEY_ENC')
    if enc_key:
        try:
            # Aceptar tanto la forma urlsafe-base64 (44 chars) como hex (64 chars)
            if len(enc_key) == 64 and all(c in '0123456789abcdefABCDEF' for c in enc_key):
                key_bytes = base64.urlsafe_b64encode(bytes.fromhex(enc_key))
            else:
                # Validar Fernet-style (44 chars, urlsafe-b64)
                Fernet(enc_key.encode('utf-8'))
                key_bytes = enc_key.encode('utf-8')
        except Exception:
            # Llave inválida → fallback a derivar
            key_bytes = _derive_key_from_secret(enc_key)
    else:
        secret = os.environ.get('SECRET_KEY') or 'dev-fallback-secret-do-not-use-in-prod'
        key_bytes = _derive_key_from_secret(secret)

    _FERNET = Fernet(key_bytes)
    return _FERNET


def encrypt_api_key(plain: str) -> str:
    """Cifra una API key y devuelve un string base64 listo para persistir."""
    if not plain:
        raise ValueError('plain key is empty')
    return _get_fernet().encrypt(plain.encode('utf-8')).decode('utf-8')


def decrypt_api_key(token: str) -> Optional[str]:
    """Descifra el blob persistido. Devuelve None si está corrupto/inválido."""
    if not token:
        return None
    try:
        return _get_fernet().decrypt(token.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError, Exception):
        return None


def sha256_hex(s: str) -> str:
    """SHA-256 hex (helper general)."""
    return hashlib.sha256(s.encode('utf-8')).hexdigest()
