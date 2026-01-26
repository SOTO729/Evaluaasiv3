"""
Utilidades de Cache para escalabilidad
"""
from functools import wraps
from flask import request
from app import cache
import hashlib
import json


def make_cache_key(*args, **kwargs):
    """
    Genera una clave de cache única basada en la ruta y parámetros de la request
    """
    path = request.path
    args_as_sorted_tuple = tuple(sorted(request.args.items()))
    
    # Crear hash de los argumentos para keys más cortas
    args_hash = hashlib.md5(
        json.dumps(args_as_sorted_tuple, sort_keys=True).encode()
    ).hexdigest()[:12]
    
    return f"{path}:{args_hash}"


def make_cache_key_with_user(*args, **kwargs):
    """
    Genera una clave de cache que incluye el ID del usuario
    """
    from flask_jwt_extended import get_jwt_identity
    
    try:
        user_id = get_jwt_identity()
    except:
        user_id = 'anon'
    
    path = request.path
    args_as_sorted_tuple = tuple(sorted(request.args.items()))
    
    args_hash = hashlib.md5(
        json.dumps(args_as_sorted_tuple, sort_keys=True).encode()
    ).hexdigest()[:12]
    
    return f"{path}:{user_id}:{args_hash}"


def cached_with_user(timeout=300):
    """
    Decorador para cachear respuestas incluyendo el usuario en la clave
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache_key = make_cache_key_with_user()
            
            # Intentar obtener del cache
            cached_response = cache.get(cache_key)
            if cached_response is not None:
                return cached_response
            
            # Ejecutar la función y cachear el resultado
            response = f(*args, **kwargs)
            cache.set(cache_key, response, timeout=timeout)
            
            return response
        return decorated_function
    return decorator


def invalidate_cache_pattern(pattern):
    """
    Invalida todas las claves de cache que coincidan con un patrón
    Útil cuando se modifica un recurso
    """
    try:
        # Obtener cliente Redis del cache
        redis_client = cache.cache._read_clients[0]
        
        # Buscar claves que coincidan con el patrón
        keys = redis_client.keys(f"flask_cache_{pattern}*")
        
        if keys:
            redis_client.delete(*keys)
            return len(keys)
        return 0
    except Exception as e:
        # Si Redis no está disponible, ignorar silenciosamente
        print(f"Warning: Could not invalidate cache pattern {pattern}: {e}")
        return 0


def invalidate_exams_cache():
    """Invalida todo el cache relacionado con exámenes"""
    return invalidate_cache_pattern("/api/exams")


def invalidate_standards_cache():
    """Invalida todo el cache relacionado con estándares"""
    # Limpiar por patrón de ruta y también por prefijo de función
    count = invalidate_cache_pattern("/api/competency-standards")
    count += invalidate_cache_pattern("standards_list")
    count += invalidate_cache_pattern("view//competency-standards")
    return count


def invalidate_study_contents_cache():
    """Invalida todo el cache relacionado con materiales de estudio"""
    return invalidate_cache_pattern("/api/study-contents")


# Cache keys para recursos específicos
def get_exam_cache_key(exam_id):
    return f"exam:{exam_id}"


def get_standard_cache_key(standard_id):
    return f"standard:{standard_id}"


def get_user_dashboard_cache_key(user_id):
    return f"dashboard:{user_id}"


def invalidate_user_dashboard(user_id):
    """
    Invalida el cache del dashboard de un usuario específico
    Llamar después de:
    - Completar un examen
    - Actualizar progreso de materiales
    - Cambiar datos del usuario
    """
    try:
        redis_client = cache.cache._read_clients[0]
        
        # Patrón para encontrar todas las claves del dashboard de este usuario
        patterns = [
            f"flask_cache_/api/users/me/dashboard:{user_id}:*",
            f"flask_cache_/api/users/me/editor-dashboard:{user_id}:*"
        ]
        
        deleted = 0
        for pattern in patterns:
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
                deleted += len(keys)
        
        print(f"[CACHE] Invalidado dashboard de usuario {user_id}: {deleted} claves")
        return deleted
    except Exception as e:
        print(f"[CACHE] Warning: Could not invalidate user dashboard: {e}")
        return 0


def invalidate_exam_results(user_id, exam_id=None):
    """
    Invalida cache de resultados de exámenes para un usuario
    Opcionalmente filtrar por exam_id específico
    """
    try:
        redis_client = cache.cache._read_clients[0]
        
        # Invalidar dashboard del usuario (contiene resultados)
        invalidate_user_dashboard(user_id)
        
        # Si hay exam_id específico, invalidar cache de ese examen
        if exam_id:
            pattern = f"flask_cache_/api/exams/{exam_id}*"
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
        
        return True
    except Exception as e:
        print(f"[CACHE] Warning: Could not invalidate exam results: {e}")
        return False


def invalidate_on_exam_complete(user_id, exam_id, competency_standard_id=None):
    """
    Invalidación completa cuando un usuario completa un examen
    - Invalida dashboard del usuario
    - Invalida resultados relacionados
    - Invalida cache de certificados
    """
    try:
        invalidate_user_dashboard(user_id)
        
        redis_client = cache.cache._read_clients[0]
        
        # Invalidar patterns relacionados
        patterns = [
            f"flask_cache_/api/exams/{exam_id}/results*",
            f"flask_cache_/api/exams/results/*"  # Resultados de exámenes
        ]
        
        if competency_standard_id:
            patterns.append(f"flask_cache_/api/competency-standards/{competency_standard_id}*")
        
        deleted = 0
        for pattern in patterns:
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
                deleted += len(keys)
        
        print(f"[CACHE] Invalidado cache al completar examen: {deleted} claves")
        return deleted
    except Exception as e:
        print(f"[CACHE] Warning: Could not invalidate on exam complete: {e}")
        return 0


def invalidate_on_progress_update(user_id, material_id=None):
    """
    Invalidación cuando se actualiza el progreso de estudio de un usuario
    """
    try:
        invalidate_user_dashboard(user_id)
        
        if material_id:
            redis_client = cache.cache._read_clients[0]
            pattern = f"flask_cache_/api/study-contents/{material_id}*"
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
        
        return True
    except Exception as e:
        print(f"[CACHE] Warning: Could not invalidate progress: {e}")
        return False
