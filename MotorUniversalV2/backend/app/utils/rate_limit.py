"""
Rate Limiting utilities para proteger endpoints sensibles
"""
from functools import wraps
from flask import request, jsonify
from app import cache
import os
import time

# Variable global para deshabilitar rate limiting temporalmente
# Configurar RATE_LIMIT_ENABLED=false en variables de entorno para desactivar
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() in ('true', '1')


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


def unlock_account(username: str):
    """Desbloquear cuenta manualmente y resetear intentos fallidos"""
    try:
        lock_key = f"account_locked:{username.lower()}"
        fail_key = f"failed_login:{username.lower()}"
        cache.delete(lock_key)
        cache.delete(fail_key)
        print(f"🔓 Cuenta desbloqueada manualmente: {username}")
        return True
    except Exception as e:
        print(f"Error desbloqueando cuenta: {e}")
        return False


def _get_redis_client():
    """Obtener el cliente Redis subyacente de Flask-Caching o crear uno nuevo."""
    try:
        # Método 1: Intentar obtener del backend de Flask-Caching
        backend = getattr(cache, 'cache', None)
        if backend:
            for attr in ('_read_client', '_write_client', 'client', '_client'):
                client = getattr(backend, attr, None)
                if client is not None:
                    if isinstance(client, (list, tuple)):
                        client = client[0] if client else None
                    if client is not None:
                        return client
        
        # Método 2: Crear directamente desde la URL de configuración
        import redis as redis_lib
        redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        return redis_lib.from_url(redis_url)
        
    except Exception as e:
        print(f"⚠️ Error obteniendo Redis client: {e}")
        import traceback
        traceback.print_exc()
    
    return None


def _get_cache_prefix():
    """Obtener el prefijo de keys de Flask-Caching."""
    try:
        backend = getattr(cache, 'cache', cache)
        prefix = getattr(backend, 'key_prefix', None)
        if prefix:
            return prefix
    except Exception:
        pass
    return 'flask_cache_'


def _deserialize_cache_value(raw_val):
    """
    Deserializar un valor almacenado por Flask-Caching en Redis.
    Flask-Caching agrega un byte marker (0x21 = '!') antes del pickle.
    """
    import pickle
    if raw_val is None:
        return None
    
    # Intentar pickle directo
    try:
        return pickle.loads(raw_val)
    except Exception:
        pass
    
    # Intentar sin el primer byte (marker de Flask-Caching)
    if len(raw_val) > 1:
        try:
            return pickle.loads(raw_val[1:])
        except Exception:
            pass
    
    # Intentar como string/float/int
    try:
        return float(raw_val)
    except Exception:
        pass
    
    try:
        return int(raw_val)
    except Exception:
        pass
    
    return None


def get_all_locked_accounts() -> list:
    """
    Obtener todas las cuentas actualmente bloqueadas desde Redis.
    Usa SCAN para iterar sobre las keys de forma segura.
    """
    locked_accounts = []
    try:
        redis_client = _get_redis_client()
        
        if redis_client is None:
            print("⚠️ No se pudo obtener cliente Redis para scan")
            return locked_accounts
        
        now = time.time()
        prefix = _get_cache_prefix()
        pattern = f"{prefix}account_locked:*"
        
        for key in redis_client.scan_iter(match=pattern, count=100):
            key_str = key.decode() if isinstance(key, bytes) else key
            raw_val = redis_client.get(key)
            if raw_val is None:
                continue
            
            # Deserializar valor de Flask-Caching
            unlock_time = _deserialize_cache_value(raw_val)
            if unlock_time is None:
                continue
            
            remaining = int(unlock_time - now)
            if remaining <= 0:
                continue
            
            # Extraer username de la key (quitar prefijo)
            username = key_str.replace(prefix, '').replace('account_locked:', '')
            
            # Buscar intentos fallidos
            fail_count = 0
            fail_val = redis_client.get(f"{prefix}failed_login:{username}")
            if fail_val:
                deserialized = _deserialize_cache_value(fail_val)
                if deserialized is not None:
                    fail_count = int(deserialized)
            
            locked_accounts.append({
                'username': username,
                'remaining_seconds': remaining,
                'remaining_minutes': remaining // 60,
                'failed_attempts': fail_count,
                'unlock_time': unlock_time,
            })
        
    except Exception as e:
        print(f"Error obteniendo cuentas bloqueadas: {e}")
        import traceback
        traceback.print_exc()
    
    return locked_accounts


def get_all_failed_attempts() -> list:
    """
    Obtener todas las cuentas con intentos fallidos (no necesariamente bloqueadas).
    """
    failed_accounts = []
    try:
        redis_client = _get_redis_client()
        
        if redis_client is None:
            return failed_accounts
        
        prefix = _get_cache_prefix()
        pattern = f"{prefix}failed_login:*"
        
        for key in redis_client.scan_iter(match=pattern, count=100):
            key_str = key.decode() if isinstance(key, bytes) else key
            raw_val = redis_client.get(key)
            if raw_val is None:
                continue
            
            count = _deserialize_cache_value(raw_val)
            if count is None:
                continue
            
            username = key_str.replace(prefix, '').replace('failed_login:', '')
            
            # Check if also locked
            is_locked, remaining = is_account_locked(username)
            
            failed_accounts.append({
                'username': username,
                'failed_attempts': count,
                'is_locked': is_locked,
                'remaining_seconds': remaining,
            })
        
    except Exception as e:
        print(f"Error obteniendo intentos fallidos: {e}")
    
    return failed_accounts


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
            # Bypass global: si rate limiting está deshabilitado, pasar directo
            if not RATE_LIMIT_ENABLED:
                return f(*args, **kwargs)
            
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
            # Bypass global: si rate limiting está deshabilitado, pasar directo
            if not RATE_LIMIT_ENABLED:
                return f(*args, **kwargs)
            
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
