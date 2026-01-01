"""Endpoint temporal de debug"""
from flask import Blueprint, jsonify
import os
import subprocess

debug_bp = Blueprint('debug', __name__)

@debug_bp.route('/ffmpeg-status', methods=['GET'])
def ffmpeg_status():
    """Verificar si FFmpeg está disponible"""
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=10
        )
        version_line = result.stdout.split('\n')[0] if result.stdout else 'Unknown'
        return jsonify({
            'ffmpeg_available': result.returncode == 0,
            'version': version_line,
            'compression_enabled': True
        })
    except FileNotFoundError:
        return jsonify({
            'ffmpeg_available': False,
            'compression_enabled': False,
            'error': 'FFmpeg not installed'
        })
    except Exception as e:
        return jsonify({
            'ffmpeg_available': False,
            'error': str(e)
        })

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
