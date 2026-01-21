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


@bp.route('/warmup', methods=['GET'])
def warmup_database():
    """
    Keep database warm - call every 30-50 min to prevent cold starts
    ---
    tags:
      - Health
    responses:
      200:
        description: Database is warm and active
      503:
        description: Database is waking up or unavailable
    """
    import time
    start_time = time.time()
    
    try:
        # Query simple para despertar la BD
        db.session.execute(text('SELECT 1'))
        db.session.commit()
        
        elapsed_ms = (time.time() - start_time) * 1000
        
        return jsonify({
            'status': 'warm',
            'database': 'active',
            'response_time_ms': round(elapsed_ms, 2),
            'timestamp': datetime.utcnow().isoformat(),
            'message': 'Database is ready to serve requests'
        }), 200
        
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        
        return jsonify({
            'status': 'waking_up',
            'database': 'starting',
            'response_time_ms': round(elapsed_ms, 2),
            'error': str(e),
            'message': 'Database is waking up, please wait...'
        }), 503
