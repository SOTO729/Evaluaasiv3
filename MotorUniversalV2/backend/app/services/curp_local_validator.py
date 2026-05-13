"""
Validación local de CURP (sin RENAPO).

Sustituye temporalmente al flujo RENAPO mientras la infraestructura del worker
se estabiliza. Se controla con el feature flag CURP_RENAPO_ENABLED (env var):
  - "false" / "0" / "no" / unset → modo LOCAL (este módulo).
  - "true"  / "1"  / "yes"       → modo RENAPO (curp_queue_worker activo).

La validación local cubre:
  • Longitud (18 chars).
  • Regex oficial RFC SAT/RENAPO.
  • Entidad federativa (catálogo).
  • Dígito verificador (checksum mod 10).
  • CURP genérica de extranjero (se acepta automáticamente).

Esta implementación reutiliza validate_curp_format / is_generic_foreign_curp
del módulo renapo_service para no duplicar reglas. NO toca red.
"""
from __future__ import annotations

import os
import logging
from typing import Tuple, Optional

from app.services.renapo_service import (
    validate_curp_format,
    is_generic_foreign_curp,
)

logger = logging.getLogger(__name__)


_TRUTHY = {'1', 'true', 'yes', 'on', 'enabled'}


def is_renapo_enabled() -> bool:
    """Lee la env var CURP_RENAPO_ENABLED. Default: False (modo local).

    Mientras la infraestructura del worker RENAPO se estabiliza, este flag
    queda OFF en todos los ambientes. Para reactivar el worker basta con
    setear CURP_RENAPO_ENABLED=true sin redeploy de código.
    """
    val = (os.getenv('CURP_RENAPO_ENABLED', '') or '').strip().lower()
    return val in _TRUTHY


def validate_curp_local(curp: str) -> Tuple[bool, Optional[str], bool]:
    """Validación local sin RENAPO.

    Returns:
        (is_valid, error_message, is_generic_foreign)
        - is_valid: True si pasa formato + dígito verificador o es genérica.
        - error_message: descripción del fallo si is_valid es False.
        - is_generic_foreign: True para CURPs genéricas de extranjero
          (válidas pero sin datos personales que aplicar).
    """
    if not curp:
        return False, 'CURP vacía', False

    curp_norm = curp.upper().strip()

    # CURP genérica de extranjero: válida, no aplicar datos personales
    if is_generic_foreign_curp(curp_norm):
        return True, None, True

    is_valid, error = validate_curp_format(curp_norm)
    return is_valid, error, False


def apply_local_validation_to_user(user, mark_verified: bool = True) -> None:
    """Marca al usuario como verificado por validación local.

    Se usa cuando la CURP pasa la validación local. NO aplica datos personales
    porque RENAPO está deshabilitado (no tenemos nombre/apellidos oficiales).
    Los datos del usuario provienen del input del coordinador.
    """
    from datetime import datetime
    if mark_verified:
        user.curp_verified = True
        if hasattr(user, 'curp_verified_at'):
            user.curp_verified_at = datetime.utcnow()
