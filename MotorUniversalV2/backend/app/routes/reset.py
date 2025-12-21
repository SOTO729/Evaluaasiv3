"""
Script para limpiar y reinicializar la base de datos
"""
from flask import Blueprint, jsonify, request
from app import db
import os

reset_bp = Blueprint('reset', __name__)

INIT_TOKEN = os.getenv('INIT_TOKEN', 'temp-init-token-12345')


@reset_bp.route('/reset-database', methods=['POST'])
def reset_database():
    """Limpiar todas las tablas y recrear"""
    token = request.headers.get('X-Init-Token') or request.args.get('token')
    if token != INIT_TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        # Eliminar todas las tablas
        db.drop_all()
        # Recrear todas las tablas
        db.create_all()
        
        return jsonify({
            'status': 'success',
            'message': 'Base de datos limpiada y tablas recreadas. Ahora ejecuta /init-database'
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
