"""
Rate Limiting utilities para proteger endpoints sensibles
"""
from functools import wraps
from flask import request, jsonify
from app import cache
import time


def get_client_ip():
    """Obtener IP del cliente, considerando proxies"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr or 'unknown'


# ============= BLOQUEO DE CUENTA POR INTENTOS FALLIDOS =============

def get_failed_login_count(username: str) -> int:
    """Obtener el número de intentos fallidos para un usuario"""
    try:
        cache_key = f"failed_login:{username.lower()}"
        count = cache.get(cache_key)
        return count if count else 0
    except Exception:
        return 0


def increment_failed_login(username: str) -> int:
    """Incrementar contador de intentos fallidos. Retorna el nuevo conteo."""
    try:
        cache_key = f"failed_login:{username.lower()}"
        current = cache.get(cache_key) or 0
        new_count = current + 1
        # Mantener el contador por 30 minutos
        cache.set(cache_key, new_count, timeout=1800)
        return new_count
    except Exception:
        return 0


def reset_failed_login(username: str):
    """Resetear contador de intentos fallidos después de login exitoso"""
    try:
        cache_key = f"failed_login:{username.lower()}"
        cache.delete(cache_key)
    except Exception:
        pass


def is_account_locked(username: str) -> tuple:
    """
    Verificar si una cuenta está bloqueada.
    Retorna (is_locked, seconds_remaining)
    """
    try:
        lock_key = f"account_locked:{username.lower()}"
        locked_until = cache.get(lock_key)
        
        if locked_until:
            remaining = int(locked_until - time.time())
            if remaining > 0:
                return True, remaining
            # El bloqueo expiró, limpiar
            cache.delete(lock_key)
        
        return False, 0
    except Exception:
        return False, 0


def lock_account(username: str, duration_seconds: int = 900):
    """
    Bloquear cuenta por un período de tiempo.
    Default: 15 minutos (900 segundos)
    """
    try:
        lock_key = f"account_locked:{username.lower()}"
        unlock_time = time.time() + duration_seconds
        cache.set(lock_key, unlock_time, timeout=duration_seconds)
        print(f"🔒 Cuenta bloqueada: {username} por {duration_seconds}s")
    except Exception as e:
        print(f"Error bloqueando cuenta: {e}")


# Configuración de bloqueo
MAX_FAILED_ATTEMPTS = 5  # Bloquear después de 5 intentos fallidos
LOCKOUT_DURATION = 900   # 15 minutos de bloqueo


def rate_limit(limit=10, window=60, key_prefix='rl'):
    """
    Decorador para limitar la tasa de requests
    
    Args:
        limit: Número máximo de requests permitidas
        window: Ventana de tiempo en segundos
        key_prefix: Prefijo para la clave de cache
    
    Returns:
        429 Too Many Requests si se excede el límite
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = get_client_ip()
            endpoint = request.endpoint or 'unknown'
            
            # Crear clave única para este cliente y endpoint
            cache_key = f"{key_prefix}:{endpoint}:{client_ip}"
            
            try:
                # Obtener contador actual
                current = cache.get(cache_key)
                
                if current is None:
                    # Primera request - inicializar contador
                    cache.set(cache_key, 1, timeout=window)
                    current = 1
                elif current >= limit:
                    # Límite excedido
                    return jsonify({
                        'error': 'Too Many Requests',
                        'message': f'Límite de {limit} requests por {window} segundos excedido. Intenta más tarde.',
                        'retry_after': window
                    }), 429
                else:
                    # Incrementar contador
                    cache.set(cache_key, current + 1, timeout=window)
                    current += 1
                
                # Agregar headers de rate limit a la respuesta
                response = f(*args, **kwargs)
                
                # Si la respuesta es una tupla (jsonify, status_code)
                if isinstance(response, tuple):
                    resp_data, status_code = response[0], response[1] if len(response) > 1 else 200
                    # No podemos modificar headers fácilmente aquí, pero lo dejamos para el middleware
                    return response
                
                return response
                
            except Exception as e:
                # Si Redis no está disponible, permitir la request
                print(f"Rate limit warning: {e}")
                return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def rate_limit_login(limit=5, window=300):
    """
    Rate limiting específico para login
    Más estricto: 5 intentos cada 5 minutos por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_login')


def rate_limit_register(limit=3, window=3600):
    """
    Rate limiting específico para registro
    Muy estricto: 3 registros por hora por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_register')


def rate_limit_password_reset(limit=3, window=3600):
    """
    Rate limiting para reset de contraseña
    3 intentos por hora por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_pwreset')


def rate_limit_api(limit=100, window=60):
    """
    Rate limiting general para API
    100 requests por minuto por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_api')


def rate_limit_exams(limit=50, window=60):
    """
    Rate limiting para listado de exámenes
    50 requests por minuto por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_exams')


def rate_limit_evaluation(limit=10, window=60):
    """
    Rate limiting para evaluación de exámenes
    10 evaluaciones por minuto por IP (anti-scraping)
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_eval')


def rate_limit_pdf(limit=5, window=60):
    """
    Rate limiting para generación de PDFs
    5 PDFs por minuto por IP (son costosos de generar)
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_pdf')


def rate_limit_study_contents(limit=60, window=60):
    """
    Rate limiting para contenidos de estudio
    60 requests por minuto por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_study')


def rate_limit_upload(limit=10, window=60):
    """
    Rate limiting para uploads
    10 uploads por minuto por IP
    """
    return rate_limit(limit=limit, window=window, key_prefix='rl_upload')


def rate_limit_by_user(limit=200, window=60):
    """
    Rate limiting por usuario autenticado (no por IP)
    200 requests por minuto por usuario
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
            
            try:
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
                
                if not user_id:
                    # Si no hay usuario, usar IP
                    client_ip = get_client_ip()
                    cache_key = f"rl_user:ip:{client_ip}"
                else:
                    cache_key = f"rl_user:{user_id}"
                
                current = cache.get(cache_key)
                
                if current is None:
                    cache.set(cache_key, 1, timeout=window)
                elif current >= limit:
                    return jsonify({
                        'error': 'Too Many Requests',
                        'message': f'Límite de {limit} requests por minuto excedido.',
                        'retry_after': window
                    }), 429
                else:
                    cache.set(cache_key, current + 1, timeout=window)
                
                return f(*args, **kwargs)
                
            except Exception as e:
                print(f"Rate limit by user warning: {e}")
                return f(*args, **kwargs)
        
        return decorated_function
    return decorator
