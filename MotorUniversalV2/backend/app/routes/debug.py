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


@debug_bp.route('/exam-relations', methods=['GET'])
def debug_exam_relations():
    """Verificar relaciones de exámenes en materiales"""
    try:
        from app import db
        from sqlalchemy import text
        
        # Verificar si la tabla existe
        check_table = db.session.execute(text("""
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'study_material_exams'
        """))
        table_exists = check_table.scalar() > 0
        
        if not table_exists:
            return jsonify({
                'table_exists': False,
                'message': 'La tabla study_material_exams no existe'
            })
        
        # Contar relaciones
        count_result = db.session.execute(text("""
            SELECT COUNT(*) FROM study_material_exams
        """))
        relation_count = count_result.scalar()
        
        # Obtener algunas relaciones de ejemplo
        sample_result = db.session.execute(text("""
            SELECT TOP 10 sme.study_material_id, sc.title as material_title, 
                   sme.exam_id, e.name as exam_name
            FROM study_material_exams sme
            JOIN study_contents sc ON sme.study_material_id = sc.id
            JOIN exams e ON sme.exam_id = e.id
        """))
        samples = [{'material_id': r[0], 'material_title': r[1], 'exam_id': r[2], 'exam_name': r[3]} for r in sample_result.fetchall()]
        
        # Listar materiales
        materials_result = db.session.execute(text("""
            SELECT id, title, exam_id FROM study_contents
        """))
        materials = [{'id': r[0], 'title': r[1], 'legacy_exam_id': r[2]} for r in materials_result.fetchall()]
        
        return jsonify({
            'table_exists': True,
            'relation_count': relation_count,
            'sample_relations': samples,
            'materials': materials
        })
    except Exception as e:
        return jsonify({'error': str(e)})


@debug_bp.route('/material-detail/<int:material_id>', methods=['GET'])
def debug_material_detail(material_id):
    """Verificar el to_dict de un material específico"""
    try:
        from app.models.study_content import StudyMaterial
        material = StudyMaterial.query.get_or_404(material_id)
        return jsonify({
            'material_id': material_id,
            'to_dict_result': material.to_dict(include_sessions=False),
            'exam_ids_direct': [e.id for e in material.exams] if material.exams else [],
            'exams_count': len(material.exams) if material.exams else 0
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()})


@debug_bp.route('/routes', methods=['GET'])
def list_routes():
    """Listar todas las rutas registradas en la aplicación"""
    from flask import current_app
    routes = []
    for rule in current_app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
            'route': str(rule.rule)
        })
    return jsonify({
        'total_routes': len(routes),
        'routes': sorted(routes, key=lambda x: x['route'])
    })
