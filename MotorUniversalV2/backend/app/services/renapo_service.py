"""
Servicio de validación de CURP contra RENAPO (gob.mx)
Usa Playwright + Chromium headless para navegar la página de consulta CURP.
La página tiene un challenge de bot-protection (~25s) y reCAPTCHA Enterprise,
por lo que se necesita un browser real para resolverlos.
"""
import asyncio
import json
import re
import logging
import random
import threading
import time as _time
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Singleton para reutilizar el browser entre llamadas
_browser_lock = threading.Lock()
_playwright_instance = None
_browser_instance = None

RENAPO_URL = 'https://www.gob.mx/curp/'
RENAPO_API_URL = 'https://www.gob.mx/v1/renapoCURP/consulta'
CHALLENGE_MAX_WAIT = 60  # segundos máximos para resolver el challenge
CHALLENGE_POLL_INTERVAL = 3  # segundos entre checks del challenge

# CURPs genéricos de extranjero — NO se validan contra RENAPO
GENERIC_FOREIGN_CURPS = {'XEXX010101HNEXXXA4', 'XEXX010101MNEXXXA8'}

# Retry config — 7 intentos con backoff exponencial + jitter
MAX_RETRIES = 7
RETRY_BASE_DELAY = 2  # seconds (base para backoff exponencial)
RETRY_MAX_DELAY = 30  # segundos máximo entre reintentos
RETRY_JITTER = 0.5    # ±50% jitter aleatorio sobre el delay calculado

# Circuit breaker — evitar bombardear RENAPO cuando está caído
_circuit_lock = threading.Lock()
_consecutive_failures = 0
_CIRCUIT_THRESHOLD = 10       # tras N fallos consecutivos, abrir circuito
_CIRCUIT_COOLDOWN = 120       # segundos de espera antes de reintentar
_circuit_opened_at = 0.0      # timestamp cuando se abrió
_BROWSER_RESTART_AFTER = 3    # reiniciar browser tras N fallos seguidos en un call

# ── Validación de formato CURP ──
# Entidades federativas válidas (2 letras)
_VALID_STATES = {
    'AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG',
    'GT', 'GR', 'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC',
    'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ',
    'YN', 'ZS', 'NE',  # NE = nacido en el extranjero
}

_CURP_REGEX = re.compile(
    r'^[A-Z]{4}'        # 4 letras iniciales (apellidos + nombre)
    r'\d{2}'            # año de nacimiento (00-99)
    r'(0[1-9]|1[0-2])'  # mes (01-12)
    r'(0[1-9]|[12]\d|3[01])'  # día (01-31)
    r'[HM]'             # sexo (H o M)
    r'[A-Z]{2}'         # entidad federativa (se valida aparte)
    r'[A-Z]{3}'         # consonantes internas
    r'[A-Z0-9]'         # homoclave
    r'\d$'              # dígito verificador
)


def validate_curp_format(curp: str) -> tuple:
    """Valida el formato de una CURP mexicana.
    Retorna (is_valid: bool, error: str | None)"""
    if not curp:
        return False, 'CURP vacía'

    curp = curp.upper().strip()

    if len(curp) != 18:
        return False, f'CURP debe tener 18 caracteres, tiene {len(curp)}'

    if not _CURP_REGEX.match(curp):
        return False, 'Formato de CURP inválido'

    # Validar entidad federativa
    state = curp[11:13]
    if state not in _VALID_STATES:
        return False, f'Entidad federativa inválida: {state}'

    return True, None


class RenapoValidationResult:
    """Resultado de una validación CURP contra RENAPO"""

    def __init__(self, curp: str, valid: bool, name: str = None,
                 first_surname: str = None, second_surname: str = None,
                 gender: str = None, error: str = None):
        self.curp = curp
        self.valid = valid
        self.name = name
        self.first_surname = first_surname
        self.second_surname = second_surname
        self.gender = gender
        self.error = error

    def to_dict(self):
        return {
            'curp': self.curp,
            'valid': self.valid,
            'name': self.name,
            'first_surname': self.first_surname,
            'second_surname': self.second_surname,
            'gender': self.gender,
            'error': self.error,
        }


def is_generic_foreign_curp(curp: str) -> bool:
    """Verifica si un CURP es el genérico de extranjero (se salta validación RENAPO)"""
    return curp and curp.upper().strip() in GENERIC_FOREIGN_CURPS


def _calc_retry_delay(attempt: int) -> float:
    """Calcula delay con exponential backoff + jitter.
    attempt es 1-based. Ejemplo con base=2, max=30:
      attempt 1 → ~2s, 2 → ~4s, 3 → ~8s, 4 → ~16s, 5+ → ~30s (cap)
    """
    delay = min(RETRY_BASE_DELAY * (2 ** (attempt - 1)), RETRY_MAX_DELAY)
    jitter = delay * RETRY_JITTER * (2 * random.random() - 1)  # ±50%
    return max(1.0, min(delay + jitter, RETRY_MAX_DELAY))


def _check_circuit_breaker() -> bool:
    """Retorna True si el circuito está abierto (RENAPO caído, no intentar)."""
    global _consecutive_failures, _circuit_opened_at
    with _circuit_lock:
        if _consecutive_failures < _CIRCUIT_THRESHOLD:
            return False
        elapsed = _time.time() - _circuit_opened_at
        if elapsed < _CIRCUIT_COOLDOWN:
            return True  # aún en cooldown
        # Cooldown expiró — half-open, dejar pasar un intento
        logger.info(f"[RENAPO-CB] Circuit half-open tras {elapsed:.0f}s cooldown, permitiendo intento")
        return False


def _record_renapo_success():
    """Registra éxito en RENAPO — resetea circuit breaker."""
    global _consecutive_failures
    with _circuit_lock:
        if _consecutive_failures > 0:
            logger.info(f"[RENAPO-CB] Éxito tras {_consecutive_failures} fallo(s), reseteando circuito")
        _consecutive_failures = 0


def _record_renapo_failure():
    """Registra fallo en RENAPO — incrementa contador y abre circuito si necesario."""
    global _consecutive_failures, _circuit_opened_at
    with _circuit_lock:
        _consecutive_failures += 1
        if _consecutive_failures >= _CIRCUIT_THRESHOLD:
            _circuit_opened_at = _time.time()
            logger.warning(f"[RENAPO-CB] Circuit ABIERTO tras {_consecutive_failures} fallos consecutivos, cooldown {_CIRCUIT_COOLDOWN}s")


async def _ensure_browser():
    """Obtiene o crea la instancia singleton del browser Playwright"""
    global _playwright_instance, _browser_instance

    if _browser_instance and _browser_instance.is_connected():
        return _browser_instance

    # Limpiar instancia anterior si existe pero está desconectada
    if _browser_instance:
        try:
            await _browser_instance.close()
        except Exception:
            pass
        _browser_instance = None
    if _playwright_instance:
        try:
            await _playwright_instance.stop()
        except Exception:
            pass
        _playwright_instance = None

    from playwright.async_api import async_playwright
    _playwright_instance = await async_playwright().start()
    _browser_instance = await _playwright_instance.chromium.launch(
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
        ]
    )
    logger.info("Playwright browser iniciado para validación RENAPO")
    return _browser_instance


async def _restart_browser():
    """Forzar cierre y reinicio del browser (útil tras fallos consecutivos)."""
    global _playwright_instance, _browser_instance
    logger.warning("[RENAPO] Reiniciando browser Playwright")
    if _browser_instance:
        try:
            await _browser_instance.close()
        except Exception:
            pass
        _browser_instance = None
    if _playwright_instance:
        try:
            await _playwright_instance.stop()
        except Exception:
            pass
        _playwright_instance = None
    return await _ensure_browser()


async def _close_browser():
    """Cierra el browser (para shutdown limpio)"""
    global _playwright_instance, _browser_instance
    if _browser_instance:
        await _browser_instance.close()
        _browser_instance = None
    if _playwright_instance:
        await _playwright_instance.stop()
        _playwright_instance = None


async def _wait_for_challenge(page, timeout: int = CHALLENGE_MAX_WAIT) -> bool:
    """Espera a que el challenge de bot-protection se resuelva.
    Returns True si se resolvió, False si timeout."""
    import time
    start = time.time()
    while time.time() - start < timeout:
        title = await page.title()
        if 'Challenge' not in title:
            elapsed = time.time() - start
            logger.info(f"Challenge resuelto en {elapsed:.1f}s")
            return True
        await asyncio.sleep(CHALLENGE_POLL_INTERVAL)
    logger.warning(f"Challenge NO resuelto después de {timeout}s")
    return False


async def _consultar_renapo_async(curp: str) -> RenapoValidationResult:
    """Consulta una CURP en RENAPO vía Playwright.
    
    Flujo:
    1. Navega a gob.mx/curp
    2. Espera que se resuelva el challenge de bot-protection (~25s primera vez)
    3. Llena CURP y hace clic en Buscar
    4. Intercepta la respuesta JSON del API para obtener datos estructurados
    5. Si no se puede interceptar, extrae datos del HTML
    """
    curp = curp.upper().strip()

    if is_generic_foreign_curp(curp):
        return RenapoValidationResult(curp=curp, valid=True,
                                       error='CURP genérico extranjero — no requiere validación')

    consecutive_errors = 0  # fallos seguidos en ESTA llamada (para browser restart)

    for attempt in range(1, MAX_RETRIES + 1):
        context = None
        try:
            # Reiniciar browser si hubo muchos fallos seguidos
            if consecutive_errors >= _BROWSER_RESTART_AFTER:
                browser = await _restart_browser()
                consecutive_errors = 0
            else:
                browser = await _ensure_browser()

            context = await browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            )
            page = await context.new_page()

            # Anti-detección: remover propiedad webdriver
            await page.add_init_script('Object.defineProperty(navigator, "webdriver", {get: () => undefined})')

            # Variable para capturar la respuesta API
            api_response_data = {}

            async def capture_response(response):
                """Intercepta la respuesta del API de RENAPO"""
                if RENAPO_API_URL in response.url:
                    try:
                        body = await response.text()
                        data = json.loads(body)
                        api_response_data.update(data)
                        logger.info(f"RENAPO API response codigo={data.get('codigo')}")
                    except Exception as e:
                        logger.warning(f"Error parseando respuesta RENAPO API: {e}")

            page.on('response', capture_response)

            # Navegar a la página de consulta
            await page.goto(RENAPO_URL, wait_until='domcontentloaded', timeout=30000)

            # Esperar que se resuelva el challenge de bot-protection
            if not await _wait_for_challenge(page):
                raise Exception("Timeout esperando challenge de bot-protection")

            # Llenar CURP y buscar
            textbox = page.get_by_role("textbox", name="Clave Única de Registro de")
            await textbox.click(timeout=10000)
            await textbox.fill(curp)

            logger.info(f"RENAPO: Buscando CURP {curp} (intento {attempt}/{MAX_RETRIES})")
            await page.get_by_role("button", name=" Buscar").click()

            # Esperar a que llegue la respuesta API (max 30s)
            for _ in range(30):
                await asyncio.sleep(1)
                if api_response_data:
                    break

            await context.close()
            context = None

            # Procesar respuesta API interceptada
            if api_response_data:
                _record_renapo_success()
                return _parse_renapo_response(curp, api_response_data)

            # Sin respuesta API — contar como fallo para retry
            consecutive_errors += 1
            _record_renapo_failure()

            if attempt < MAX_RETRIES:
                delay = _calc_retry_delay(attempt)
                logger.warning(f"CURP {curp}: Sin respuesta API en intento {attempt}/{MAX_RETRIES}, retry en {delay:.1f}s")
                await asyncio.sleep(delay)
                continue

            return RenapoValidationResult(
                curp=curp, valid=False,
                error=f'No se recibió respuesta del API de RENAPO tras {MAX_RETRIES} intentos'
            )

        except Exception as e:
            consecutive_errors += 1
            _record_renapo_failure()
            logger.error(f"RENAPO error (intento {attempt}/{MAX_RETRIES}) para CURP {curp}: {e}")
            if context:
                try:
                    await context.close()
                except Exception:
                    pass
                context = None
            if attempt < MAX_RETRIES:
                delay = _calc_retry_delay(attempt)
                logger.info(f"CURP {curp}: Reintentando en {delay:.1f}s")
                await asyncio.sleep(delay)
                continue
            return RenapoValidationResult(
                curp=curp, valid=False,
                error=f'Error de conexión con RENAPO tras {MAX_RETRIES} intentos: {str(e)[:100]}'
            )


def _parse_renapo_response(curp: str, data: dict) -> RenapoValidationResult:
    """Parsea la respuesta JSON del API de RENAPO.
    
    Respuesta exitosa (codigo='01'):
    {
        "codigo": "01",
        "mensaje": "...",
        "registros": [{
            "curp": "...",
            "nombres": "JUAN",
            "primerApellido": "PEREZ",
            "segundoApellido": "LOPEZ",
            "sexo": "HOMBRE",
            "statusCurp": "...",
            ...
        }]
    }
    """
    codigo = data.get('codigo', '')
    mensaje = data.get('mensaje', '')

    if codigo != '01':
        logger.warning(f"RENAPO CURP {curp}: codigo={codigo} mensaje={mensaje[:100]}")
        return RenapoValidationResult(
            curp=curp, valid=False,
            error=f'CURP no encontrada en RENAPO: {mensaje[:150]}'
        )

    registros = data.get('registros', [])
    if not registros:
        return RenapoValidationResult(
            curp=curp, valid=False,
            error='RENAPO respondió sin registros'
        )

    reg = registros[0]
    name = _clean_name(reg.get('nombres'))
    first_surname = _clean_name(reg.get('primerApellido'))
    second_surname = _clean_name(reg.get('segundoApellido'))

    sexo_raw = (reg.get('sexo') or '').upper()
    gender = 'M' if 'HOMBRE' in sexo_raw else ('F' if 'MUJER' in sexo_raw else None)

    logger.info(f"RENAPO OK: {curp} → {name} {first_surname} {second_surname} ({gender})")
    return RenapoValidationResult(
        curp=curp,
        valid=True,
        name=name,
        first_surname=first_surname,
        second_surname=second_surname,
        gender=gender,
    )


def _clean_name(value: Optional[str]) -> Optional[str]:
    """Limpia y normaliza un nombre extraído de RENAPO"""
    if not value:
        return None
    # Remover caracteres especiales, múltiples espacios
    cleaned = re.sub(r'\s+', ' ', value.strip())
    # Capitalizar correctamente
    cleaned = cleaned.title()
    return cleaned if cleaned else None


def validate_curp_renapo(curp: str) -> RenapoValidationResult:
    """Valida una CURP contra RENAPO (síncrono).
    Incluye hasta 7 reintentos con backoff exponencial + jitter,
    circuit breaker para proteger contra caídas de RENAPO,
    y reinicio automático del browser tras fallos consecutivos.
    """
    curp = (curp or '').upper().strip()

    if not curp:
        return RenapoValidationResult(curp='', valid=False, error='CURP vacía')

    if is_generic_foreign_curp(curp):
        return RenapoValidationResult(curp=curp, valid=True,
                                       error='CURP genérico extranjero — no requiere validación')

    # Validar formato básico antes de consultar RENAPO
    curp_pattern = re.compile(r'^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$')
    if not curp_pattern.match(curp):
        return RenapoValidationResult(curp=curp, valid=False,
                                       error='Formato de CURP inválido')

    # Circuit breaker: si RENAPO lleva muchos fallos seguidos, esperar cooldown
    if _check_circuit_breaker():
        logger.warning(f"[RENAPO-CB] Circuito abierto, rechazando CURP {curp} temporalmente")
        return RenapoValidationResult(
            curp=curp, valid=False,
            error='Servicio RENAPO temporalmente no disponible (demasiados fallos), reintente en unos minutos'
        )

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_consultar_renapo_async(curp))
        return result
    except Exception as e:
        _record_renapo_failure()
        logger.error(f"Error en validate_curp_renapo para {curp}: {e}")
        return RenapoValidationResult(curp=curp, valid=False,
                                       error=f'Error interno: {str(e)[:100]}')
    finally:
        try:
            loop.close()
        except Exception:
            pass


def validate_curps_batch(curps: list, progress_callback=None) -> list:
    """Valida un lote de CURPs contra RENAPO secuencialmente.
    
    Args:
        curps: Lista de strings CURP.
        progress_callback: Función opcional llamada con (index, total, result) después de cada validación.
    
    Returns:
        Lista de RenapoValidationResult.
    """
    import time
    results = []
    total = len(curps)

    for i, curp in enumerate(curps):
        curp = (curp or '').upper().strip()

        # Saltar vacíos y genéricos
        if not curp:
            result = RenapoValidationResult(curp='', valid=False, error='CURP vacía')
        elif is_generic_foreign_curp(curp):
            result = RenapoValidationResult(curp=curp, valid=True,
                                             error='CURP genérico extranjero')
        else:
            result = validate_curp_renapo(curp)

        results.append(result)

        if progress_callback:
            progress_callback(i + 1, total, result)

        # Pausa entre consultas para no saturar RENAPO (rate limiting)
        if i < total - 1 and not is_generic_foreign_curp(curp) and curp:
            time.sleep(2)

    return results


def apply_renapo_to_user(user, renapo_result: RenapoValidationResult):
    """Aplica los datos de RENAPO a un usuario (sobrescribe nombre/apellidos).
    
    Args:
        user: Instancia de User (SQLAlchemy).
        renapo_result: Resultado de validación RENAPO.
    
    Returns:
        dict con los cambios aplicados.
    """
    changes = {}

    if not renapo_result.valid:
        return changes

    user.curp_verified = True
    user.curp_verified_at = datetime.utcnow()
    changes['curp_verified'] = True

    # Guardar datos RENAPO originales
    if renapo_result.name:
        user.curp_renapo_name = renapo_result.name
        changes['curp_renapo_name'] = renapo_result.name
    if renapo_result.first_surname:
        user.curp_renapo_first_surname = renapo_result.first_surname
        changes['curp_renapo_first_surname'] = renapo_result.first_surname
    if renapo_result.second_surname:
        user.curp_renapo_second_surname = renapo_result.second_surname
        changes['curp_renapo_second_surname'] = renapo_result.second_surname

    # Sobrescribir nombre/apellidos del usuario con datos RENAPO
    if renapo_result.name:
        old_name = user.name
        user.name = renapo_result.name.upper()
        if old_name != user.name:
            changes['name'] = {'old': old_name, 'new': user.name}

    if renapo_result.first_surname:
        old_fs = user.first_surname
        user.first_surname = renapo_result.first_surname.upper()
        if old_fs != user.first_surname:
            changes['first_surname'] = {'old': old_fs, 'new': user.first_surname}

    if renapo_result.second_surname is not None:
        old_ss = user.second_surname
        user.second_surname = renapo_result.second_surname.upper() if renapo_result.second_surname else renapo_result.second_surname
        if old_ss != user.second_surname:
            changes['second_surname'] = {'old': old_ss, 'new': user.second_surname}

    return changes
