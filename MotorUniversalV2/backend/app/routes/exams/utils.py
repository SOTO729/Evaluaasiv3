"""
Utilidades compartidas para el módulo de exámenes
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models.user import User


def require_permission(permission):
    """Decorador para verificar permisos"""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            
            if not user or not user.has_permission(permission):
                return jsonify({'error': 'Permiso denegado'}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def calculate_text_similarity(user_answer: str, correct_answer: str) -> float:
    """
    Calcula la similitud entre dos textos usando distancia de Levenshtein normalizada
    """
    if not user_answer or not correct_answer:
        return 0.0
    
    # Normalizar textos
    s1 = user_answer.lower().strip()
    s2 = correct_answer.lower().strip()
    
    if s1 == s2:
        return 1.0
    
    # Calcular distancia de Levenshtein
    len1, len2 = len(s1), len(s2)
    
    # Crear matriz de distancias
    dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    
    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j
    
    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            if s1[i-1] == s2[j-1]:
                dp[i][j] = dp[i-1][j-1]
            else:
                dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    
    distance = dp[len1][len2]
    max_len = max(len1, len2)
    
    return 1.0 - (distance / max_len) if max_len > 0 else 1.0
