"""Endpoint temporal de debug"""
from flask import Blueprint, jsonify
import os

debug_bp = Blueprint('debug', __name__)

@debug_bp.route('/debug-code', methods=['GET'])
def debug_code():
    """Ver código actual del init.py"""
    try:
        init_file = '/app/app/routes/init.py'
        if os.path.exists(init_file):
            with open(init_file, 'r') as f:
                content = f.read()
            # Buscar la línea con CURP
            lines = content.split('\n')
            curp_lines = [f"Line {i}: {line}" for i, line in enumerate(lines, 1) if 'curp=' in line.lower()]
            return jsonify({
                'file_exists': True,
                'curp_lines_found': len(curp_lines),
                'curp_lines': curp_lines[:10]
            })
        return jsonify({'file_exists': False})
    except Exception as e:
        return jsonify({'error': str(e)})
