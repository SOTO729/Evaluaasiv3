"""Endpoint temporal de debug"""
from flask import Blueprint, jsonify
import os
import subprocess
import inspect

debug_bp = Blueprint('debug', __name__)

@debug_bp.route('/test-conocer-upload', methods=['GET'])
def test_conocer_upload():
    """Probar el servicio de upload de CONOCER"""
    try:
        from app.services.conocer_blob_service import get_conocer_blob_service, FallbackBlobService
        from app.utils.azure_storage import azure_storage
        
        result = {
            'azure_storage_configured': azure_storage is not None,
            'azure_storage_has_blob_client': azure_storage.blob_service_client is not None if azure_storage else False,
            'azure_storage_container': azure_storage.container_name if azure_storage else None,
        }
        
        # Obtener el servicio
        blob_service = get_conocer_blob_service()
        result['conocer_service_type'] = type(blob_service).__name__
        
        if isinstance(blob_service, FallbackBlobService):
            result['fallback_has_blob_client'] = blob_service.blob_client is not None
            result['fallback_container'] = blob_service.container_name
        
        # Intentar un upload de prueba pequeño
        test_content = b"test pdf content"
        try:
            blob_name, file_hash, size = blob_service.upload_certificate(
                file_content=test_content,
                user_id="test-user",
                certificate_number="TEST-001",
                standard_code="TEST"
            )
            result['test_upload_success'] = True
            result['test_blob_name'] = blob_name[:80] if blob_name else None
        except Exception as e:
            result['test_upload_success'] = False
            result['test_upload_error'] = str(e)
        
        return jsonify(result)
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        })

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

@debug_bp.route('/result-data/<result_id>', methods=['GET'])
def debug_result_data(result_id):
    """Ver datos raw de un resultado - SIN AUTH para debug"""
    try:
        from app.models.result import Result
        import json
        
        result = Result.query.filter_by(id=result_id).first()
        if not result:
            return jsonify({'error': 'Resultado no encontrado', 'result_id': result_id}), 404
        
        # Obtener answers_data raw
        answers_data_raw = result.answers_data
        answers_data_type = str(type(answers_data_raw))
        
        # Parsear si es string
        if isinstance(answers_data_raw, str):
            try:
                answers_data = json.loads(answers_data_raw)
            except:
                answers_data = {'parse_error': True, 'raw': answers_data_raw[:500]}
        else:
            answers_data = answers_data_raw or {}
        
        # Buscar evaluation_breakdown
        evaluation_breakdown = {}
        if isinstance(answers_data, dict):
            evaluation_breakdown = answers_data.get('evaluation_breakdown', {})
            if not evaluation_breakdown:
                summary = answers_data.get('summary', {})
                if isinstance(summary, dict):
                    evaluation_breakdown = summary.get('evaluation_breakdown', {})
        
        return jsonify({
            'result_id': result_id,
            'score': result.score,
            'result_status': result.result,
            'answers_data_type': answers_data_type,
            'answers_data_keys': list(answers_data.keys()) if isinstance(answers_data, dict) else None,
            'evaluation_breakdown': evaluation_breakdown,
            'summary': answers_data.get('summary') if isinstance(answers_data, dict) else None
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

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


@debug_bp.route('/ensure-ecm-tables', methods=['POST'])
def ensure_ecm_tables():
    """
    Crear las tablas ECM (competency_standards y deletion_requests) 
    y agregar las columnas FK a exams y results si no existen
    """
    from app import db
    from sqlalchemy import text, inspect
    import traceback
    
    results = {
        'competency_standards': {'status': 'unknown'},
        'deletion_requests': {'status': 'unknown'},
        'exams_fk': {'status': 'unknown'},
        'results_fk': {'status': 'unknown'}
    }
    
    try:
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()
        
        # 1. Crear tabla competency_standards
        if 'competency_standards' not in existing_tables:
            try:
                db.session.execute(text('''
                    CREATE TABLE competency_standards (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        code NVARCHAR(50) NOT NULL UNIQUE,
                        name NVARCHAR(255) NOT NULL,
                        description NVARCHAR(MAX),
                        sector NVARCHAR(100),
                        level INT,
                        validity_years INT DEFAULT 5,
                        certifying_body NVARCHAR(255) DEFAULT 'CONOCER',
                        is_active BIT DEFAULT 1 NOT NULL,
                        created_by NVARCHAR(36) NOT NULL,
                        created_at DATETIME2 DEFAULT GETUTCDATE() NOT NULL,
                        updated_by NVARCHAR(36),
                        updated_at DATETIME2
                    )
                '''))
                db.session.execute(text('''
                    CREATE INDEX ix_competency_standards_code ON competency_standards(code)
                '''))
                db.session.execute(text('''
                    CREATE INDEX ix_competency_standards_is_active ON competency_standards(is_active)
                '''))
                db.session.commit()
                results['competency_standards'] = {'status': 'created'}
            except Exception as e:
                db.session.rollback()
                results['competency_standards'] = {'status': 'error', 'error': str(e)}
        else:
            results['competency_standards'] = {'status': 'already_exists'}
        
        # 2. Crear tabla deletion_requests
        if 'deletion_requests' not in existing_tables:
            try:
                db.session.execute(text('''
                    CREATE TABLE deletion_requests (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        entity_type NVARCHAR(50) NOT NULL,
                        entity_id INT NOT NULL,
                        entity_name NVARCHAR(255),
                        reason NVARCHAR(MAX) NOT NULL,
                        status NVARCHAR(20) DEFAULT 'pending' NOT NULL,
                        admin_response NVARCHAR(MAX),
                        reviewed_by NVARCHAR(36),
                        reviewed_at DATETIME2,
                        requested_by NVARCHAR(36) NOT NULL,
                        requested_at DATETIME2 DEFAULT GETUTCDATE() NOT NULL
                    )
                '''))
                db.session.execute(text('''
                    CREATE INDEX ix_deletion_requests_status ON deletion_requests(status)
                '''))
                db.session.execute(text('''
                    CREATE INDEX ix_deletion_requests_entity ON deletion_requests(entity_type, entity_id)
                '''))
                db.session.commit()
                results['deletion_requests'] = {'status': 'created'}
            except Exception as e:
                db.session.rollback()
                results['deletion_requests'] = {'status': 'error', 'error': str(e)}
        else:
            results['deletion_requests'] = {'status': 'already_exists'}
        
        # 3. Agregar columna competency_standard_id a exams
        try:
            exam_columns = [col['name'] for col in inspector.get_columns('exams')]
            if 'competency_standard_id' not in exam_columns:
                db.session.execute(text('''
                    ALTER TABLE exams ADD competency_standard_id INT NULL
                '''))
                db.session.commit()
                results['exams_fk'] = {'status': 'column_added'}
            else:
                results['exams_fk'] = {'status': 'already_exists'}
        except Exception as e:
            db.session.rollback()
            results['exams_fk'] = {'status': 'error', 'error': str(e)}
        
        # 4. Agregar columna competency_standard_id a results
        try:
            result_columns = [col['name'] for col in inspector.get_columns('results')]
            if 'competency_standard_id' not in result_columns:
                db.session.execute(text('''
                    ALTER TABLE results ADD competency_standard_id INT NULL
                '''))
                db.session.commit()
                results['results_fk'] = {'status': 'column_added'}
            else:
                results['results_fk'] = {'status': 'already_exists'}
        except Exception as e:
            db.session.rollback()
            results['results_fk'] = {'status': 'error', 'error': str(e)}
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        })


@debug_bp.route('/migrate-results-to-ecm', methods=['POST'])
def migrate_results_to_ecm():
    """
    Migrar resultados existentes para asociarlos al ECM de su examen.
    
    Esto permite que los resultados históricos se agrupen por ECM,
    manteniendo el historial unificado entre versiones de examen.
    """
    from app import db
    from app.models.result import Result
    from app.models.exam import Exam
    from sqlalchemy import text
    import traceback
    
    try:
        # Contar resultados que necesitan migración
        results_to_migrate = Result.query.filter(
            Result.competency_standard_id.is_(None)
        ).all()
        
        total_to_migrate = len(results_to_migrate)
        migrated = 0
        skipped = 0
        errors = []
        
        for result in results_to_migrate:
            try:
                # Obtener el examen asociado
                exam = Exam.query.get(result.exam_id)
                
                if exam and exam.competency_standard_id:
                    # Actualizar el resultado con el ECM del examen
                    result.competency_standard_id = exam.competency_standard_id
                    migrated += 1
                else:
                    # El examen no tiene ECM asociado
                    skipped += 1
                    
            except Exception as e:
                errors.append({
                    'result_id': result.id,
                    'exam_id': result.exam_id,
                    'error': str(e)
                })
        
        # Guardar cambios
        db.session.commit()
        
        return jsonify({
            'success': True,
            'total_to_migrate': total_to_migrate,
            'migrated': migrated,
            'skipped': skipped,
            'errors': errors[:10] if errors else [],  # Mostrar máximo 10 errores
            'total_errors': len(errors)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        })


@debug_bp.route('/results-ecm-status', methods=['GET'])
def results_ecm_status():
    """
    Obtener el estado actual de los resultados respecto a ECM
    """
    from app import db
    from app.models.result import Result
    from sqlalchemy import func
    import traceback
    
    try:
        total_results = Result.query.count()
        results_with_ecm = Result.query.filter(
            Result.competency_standard_id.isnot(None)
        ).count()
        results_without_ecm = Result.query.filter(
            Result.competency_standard_id.is_(None)
        ).count()
        
        # Muestra de resultados sin ECM
        sample_without_ecm = []
        results_sample = Result.query.filter(
            Result.competency_standard_id.is_(None)
        ).limit(5).all()
        
        for r in results_sample:
            from app.models.exam import Exam
            exam = Exam.query.get(r.exam_id)
            sample_without_ecm.append({
                'result_id': r.id[:8] + '...',
                'exam_id': r.exam_id,
                'exam_has_ecm': exam.competency_standard_id if exam else None,
                'created_at': r.created_at.isoformat() if r.created_at else None
            })
        
        return jsonify({
            'success': True,
            'total_results': total_results,
            'results_with_ecm': results_with_ecm,
            'results_without_ecm': results_without_ecm,
            'percentage_migrated': round(results_with_ecm / total_results * 100, 2) if total_results > 0 else 0,
            'sample_without_ecm': sample_without_ecm
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        })
