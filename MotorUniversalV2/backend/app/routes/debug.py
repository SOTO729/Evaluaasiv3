"""Endpoint temporal de debug"""
from flask import Blueprint, jsonify
import os
import subprocess
import inspect

debug_bp = Blueprint('debug', __name__)

@debug_bp.route('/check-study-topic-model', methods=['GET'])
def check_study_topic_model():
    """Verificar el modelo StudyTopic"""
    try:
        from app.models.study_content import StudyTopic
        
        # Ver columnas del modelo
        columns = [c.name for c in StudyTopic.__table__.columns]
        
        # Ver el código fuente de to_dict
        to_dict_source = inspect.getsource(StudyTopic.to_dict)
        
        # Verificar si estimated_time_minutes está en el modelo
        has_estimated_time = hasattr(StudyTopic, 'estimated_time_minutes')
        
        return jsonify({
            'columns': columns,
            'has_estimated_time_minutes': has_estimated_time,
            'to_dict_source_preview': to_dict_source[:500],
            'estimated_in_to_dict': 'estimated_time_minutes' in to_dict_source
        })
    except Exception as e:
        return jsonify({'error': str(e)})

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


@debug_bp.route('/migrate-voucher-nullable', methods=['POST'])
def migrate_voucher_nullable():
    """Aplicar migración para hacer voucher_id nullable en results"""
    try:
        from app import db
        from sqlalchemy import text
        
        # En SQL Server, necesitamos eliminar la restricción y volver a crear la columna
        # Primero verificar el estado actual
        check_query = text("""
            SELECT c.is_nullable 
            FROM sys.columns c
            JOIN sys.tables t ON c.object_id = t.object_id
            WHERE t.name = 'results' AND c.name = 'voucher_id'
        """)
        
        result = db.session.execute(check_query)
        row = result.fetchone()
        
        if row is None:
            return jsonify({
                'success': False,
                'error': 'Column voucher_id not found in results table'
            })
        
        is_nullable = row[0]
        
        if is_nullable == 1:
            return jsonify({
                'success': True,
                'message': 'Column voucher_id is already nullable',
                'migration_needed': False
            })
        
        # Hacer la columna nullable
        # Primero eliminar la restricción de clave foránea si existe
        try:
            db.session.execute(text("""
                DECLARE @sql NVARCHAR(MAX) = '';
                SELECT @sql = @sql + 'ALTER TABLE results DROP CONSTRAINT ' + QUOTENAME(fk.name) + '; '
                FROM sys.foreign_keys fk
                INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
                WHERE OBJECT_NAME(fk.parent_object_id) = 'results' AND c.name = 'voucher_id';
                IF @sql <> '' EXEC sp_executesql @sql;
            """))
            db.session.commit()
        except Exception as e:
            print(f"Note: Could not drop FK constraint (may not exist): {e}")
            db.session.rollback()
        
        # Alterar la columna para permitir NULL
        db.session.execute(text("""
            ALTER TABLE results ALTER COLUMN voucher_id INT NULL
        """))
        db.session.commit()
        
        # Recrear la clave foránea si es necesario (con nullable)
        try:
            db.session.execute(text("""
                ALTER TABLE results
                ADD CONSTRAINT FK_results_vouchers
                FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
            """))
            db.session.commit()
        except Exception as e:
            print(f"Note: Could not recreate FK constraint: {e}")
            db.session.rollback()
        
        return jsonify({
            'success': True,
            'message': 'Column voucher_id is now nullable',
            'migration_applied': True
        })
        
    except Exception as e:
        import traceback
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        })


@debug_bp.route('/migrate-report-url', methods=['POST'])
def migrate_report_url():
    """Agrega la columna report_url a la tabla results si no existe"""
    from app import db
    from sqlalchemy import text
    
    try:
        # Verificar si la columna ya existe (funciona para SQL Server y PostgreSQL)
        result = db.session.execute(text(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME='results' AND COLUMN_NAME='report_url'"
        ))
        
        if result.fetchone():
            return jsonify({
                'success': True,
                'message': 'La columna report_url ya existe',
                'migration_needed': False
            })
        
        # Agregar la columna (sintaxis SQL Server - sin COLUMN)
        db.session.execute(text('ALTER TABLE results ADD report_url VARCHAR(500)'))
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Columna report_url agregada exitosamente',
            'migration_needed': True,
            'migration_applied': True
        })
        
    except Exception as e:
        import traceback
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        })


@debug_bp.route('/check-result/<result_id>', methods=['GET'])
def check_result_data(result_id):
    """Ver los datos de un resultado específico"""
    from app import db
    from sqlalchemy import text
    import json
    
    try:
        result = db.session.execute(text(
            "SELECT id, score, result, answers_data FROM results WHERE id = :id"
        ), {'id': result_id})
        
        row = result.fetchone()
        if not row:
            return jsonify({'error': 'Resultado no encontrado'}), 404
        
        answers_data_raw = row[3]
        answers_data = None
        data_type = type(answers_data_raw).__name__
        
        # Intentar parsear si es string
        if isinstance(answers_data_raw, str):
            try:
                answers_data = json.loads(answers_data_raw)
            except:
                answers_data = None
        elif isinstance(answers_data_raw, dict):
            answers_data = answers_data_raw
        
        return jsonify({
            'id': row[0],
            'score': row[1],
            'result': row[2],
            'has_answers_data': bool(answers_data_raw),
            'answers_data_type': data_type,
            'answers_data_keys': list(answers_data.keys()) if isinstance(answers_data, dict) else 'not a dict',
            'has_evaluation_breakdown': 'evaluation_breakdown' in answers_data if isinstance(answers_data, dict) else False,
            'evaluation_breakdown': answers_data.get('evaluation_breakdown', {}) if isinstance(answers_data, dict) else None,
            'raw_preview': str(answers_data_raw)[:500] if answers_data_raw else None
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        })


@debug_bp.route('/recent-results', methods=['GET'])
def recent_results():
    """Ver los últimos resultados guardados"""
    from app import db
    from sqlalchemy import text
    
    try:
        result = db.session.execute(text(
            "SELECT TOP 5 id, score, result, created_at FROM results ORDER BY created_at DESC"
        ))
        
        rows = result.fetchall()
        results_list = []
        for row in rows:
            results_list.append({
                'id': row[0],
                'score': row[1],
                'result': row[2],
                'created_at': str(row[3]) if row[3] else None
            })
        
        return jsonify({
            'count': len(results_list),
            'results': results_list
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        })
