"""
Rutas de health check
"""
from flask import Blueprint, jsonify
from sqlalchemy import text
from app import db
from datetime import datetime

bp = Blueprint('health', __name__)


@bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    ---
    tags:
      - Health
    responses:
      200:
        description: Servicio saludable
    """
    # Verificar conexión a DB
    db_status = 'healthy'
    try:
        db.session.execute(text('SELECT 1'))
    except Exception as e:
        db_status = f'unhealthy: {str(e)}'
    
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'database': db_status,
        'version': '2.0.0'
    }), 200


@bp.route('/ping', methods=['GET'])
def ping():
    """Endpoint simple para keep-alive"""
    return jsonify({'message': 'pong'}), 200
