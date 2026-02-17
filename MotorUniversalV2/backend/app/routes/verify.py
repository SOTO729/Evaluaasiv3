"""
Rutas públicas de verificación de certificados
Estas rutas NO requieren autenticación
"""
from flask import Blueprint, jsonify
from app import db

bp = Blueprint('verify', __name__, url_prefix='/verify')


@bp.route('/<code>', methods=['GET'])
def verify_certificate(code):
    """
    Verificar un certificado o reporte de evaluación por su código.
    Esta ruta es PÚBLICA y no requiere autenticación.
    
    Códigos:
    - ZC... = Reporte de Evaluación
    - EC... = Certificado Eduit
    """
    from app.models.result import Result
    from app.models.exam import Exam
    from app.models.user import User
    from app.models.competency_standard import CompetencyStandard
    from app.models.partner import GroupMember, CandidateGroup, GroupExam
    
    if not code or len(code) < 3:
        return jsonify({
            'valid': False,
            'error': 'Código de verificación inválido'
        }), 400
    
    # Determinar tipo de documento por prefijo
    prefix = code[:2].upper()
    
    if prefix == 'ZC':
        document_type = 'evaluation_report'
        document_name = 'Reporte de Evaluación'
        result = Result.query.filter_by(certificate_code=code).first()
    elif prefix == 'EC':
        document_type = 'eduit_certificate'
        document_name = 'Certificado Eduit'
        result = Result.query.filter_by(eduit_certificate_code=code).first()
    else:
        return jsonify({
            'valid': False,
            'error': 'Código de verificación no reconocido'
        }), 400
    
    if not result:
        return jsonify({
            'valid': False,
            'error': 'No se encontró ningún documento con este código de verificación'
        }), 404
    
    # Solo mostrar si aprobó (result=1) para certificados Eduit
    if document_type == 'eduit_certificate' and result.result != 1:
        return jsonify({
            'valid': False,
            'error': 'Este certificado no es válido porque el examen no fue aprobado'
        }), 400
    
    # Obtener información del usuario
    user = User.query.get(result.user_id)
    if not user:
        return jsonify({
            'valid': False,
            'error': 'Usuario no encontrado'
        }), 404
    
    # Construir nombre completo
    name_parts = [user.name or '']
    if user.first_surname:
        name_parts.append(user.first_surname)
    if user.second_surname:
        name_parts.append(user.second_surname)
    full_name = ' '.join(name_parts).strip() or 'N/A'
    
    # Obtener información del examen
    exam = Exam.query.get(result.exam_id)
    exam_name = exam.name if exam else 'N/A'
    
    # Obtener ECM (Estándar de Competencia)
    ecm_code = None
    ecm_name = None
    ecm_logo_url = None
    brand_logo_url = None
    brand_name = None
    
    # Primero intentar desde el resultado directo
    if result.competency_standard_id:
        standard = CompetencyStandard.query.get(result.competency_standard_id)
        if standard:
            ecm_code = standard.code
            ecm_name = standard.name
            ecm_logo_url = standard.logo_url
            if standard.brand:
                brand_logo_url = standard.brand.logo_url
                brand_name = standard.brand.name
    
    # Si no hay ECM en el resultado, intentar desde el examen
    if not ecm_code and exam and exam.competency_standard_id:
        standard = CompetencyStandard.query.get(exam.competency_standard_id)
        if standard:
            ecm_code = standard.code
            ecm_name = standard.name
            ecm_logo_url = standard.logo_url
            if standard.brand:
                brand_logo_url = standard.brand.logo_url
                brand_name = standard.brand.name
    
    # Si aún no hay ECM, intentar desde el grupo del usuario
    if not ecm_code and user:
        # Buscar grupos activos del usuario
        memberships = GroupMember.query.filter_by(user_id=user.id).all()
        for membership in memberships:
            group = CandidateGroup.query.filter_by(id=membership.group_id, is_active=True).first()
            if group:
                # Buscar si este grupo tiene el examen asignado
                group_exam = GroupExam.query.filter_by(
                    group_id=group.id,
                    exam_id=result.exam_id,
                    is_active=True
                ).first()
                if group_exam and exam and exam.competency_standard_id:
                    standard = CompetencyStandard.query.get(exam.competency_standard_id)
                    if standard:
                        ecm_code = standard.code
                        ecm_name = standard.name
                        ecm_logo_url = standard.logo_url
                        if standard.brand:
                            brand_logo_url = standard.brand.logo_url
                            brand_name = standard.brand.name
                        break
    
    # Formatear fecha de certificación en español
    completion_date = None
    if result.end_date or result.start_date:
        date_to_format = result.end_date or result.start_date
        # Meses en español
        meses = {
            1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
            5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
            9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
        }
        completion_date = f"{date_to_format.day} de {meses[date_to_format.month]} de {date_to_format.year}"
    
    # Construir respuesta
    response_data = {
        'valid': True,
        'document_type': document_type,
        'document_name': document_name,
        'verification_code': code,
        'candidate': {
            'full_name': full_name
        },
        'certification': {
            'exam_name': exam_name,
            'ecm_code': ecm_code,
            'ecm_name': ecm_name,
            'ecm_logo_url': ecm_logo_url,
            'brand_logo_url': brand_logo_url,
            'brand_name': brand_name,
            'completion_date': completion_date,
            'score': result.score if document_type == 'evaluation_report' else None,
            'result': 'Aprobado' if result.result == 1 else 'No Aprobado'
        }
    }
    
    return jsonify(response_data), 200


@bp.route('/admin/restore-codes', methods=['POST'])
def restore_certificate_codes():
    """
    Endpoint TEMPORAL para restaurar códigos originales de certificados.
    Requiere admin_key para autenticación.
    
    Body JSON:
    {
        "admin_key": "restore-emergencia-2026",
        "group_name": "Emergencia Educare",
        "mappings": [
            {"student_name": "SOFIA_BANDERA_MINERO", "original_code": "EC2602066F7444FD"},
            ...
        ]
    }
    """
    from flask import request as flask_request
    from app.models.result import Result
    from app.models.user import User
    from app.models.partner import GroupMember, CandidateGroup
    from sqlalchemy import and_, func
    
    data = flask_request.get_json()
    if not data or data.get('admin_key') != 'restore-emergencia-2026':
        return jsonify({'error': 'Unauthorized'}), 403
    
    group_name = data.get('group_name', '')
    mappings = data.get('mappings', [])
    dry_run = data.get('dry_run', True)
    
    if not mappings:
        return jsonify({'error': 'No mappings provided'}), 400
    
    # Find the group
    group = CandidateGroup.query.filter(
        CandidateGroup.name.ilike(f'%{group_name}%')
    ).first()
    
    if not group:
        return jsonify({'error': f'Group not found: {group_name}'}), 404
    
    # Get group members
    members = GroupMember.query.filter_by(group_id=group.id, status='active').all()
    member_user_ids = [m.user_id for m in members]
    
    # Get all users in the group
    users = User.query.filter(User.id.in_(member_user_ids)).all()
    
    results_log = []
    updated = 0
    not_found = 0
    already_correct = 0
    
    for mapping in mappings:
        student_name_raw = mapping.get('student_name', '')
        original_code = mapping.get('original_code', '')
        
        if not student_name_raw or not original_code:
            results_log.append({'student': student_name_raw, 'status': 'skipped', 'reason': 'missing data'})
            continue
        
        # Convert STUDENT_NAME_FORMAT to searchable parts
        name_parts = student_name_raw.replace('_', ' ').strip().upper()
        
        # Find the user by matching name parts
        matched_user = None
        for u in users:
            full = f"{(u.name or '').upper()} {(u.first_surname or '').upper()} {(u.second_surname or '').upper()}".strip()
            # Normalize accents for comparison
            import unicodedata
            def normalize(s):
                return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode('ascii')
            
            if normalize(full) == normalize(name_parts) or normalize(name_parts) in normalize(full):
                matched_user = u
                break
        
        if not matched_user:
            results_log.append({'student': student_name_raw, 'status': 'not_found', 'reason': 'user not found in group'})
            not_found += 1
            continue
        
        # Find their approved results (could have multiple exams)
        user_results = Result.query.filter(
            and_(
                Result.user_id == matched_user.id,
                Result.status == 1,
                Result.result == 1
            )
        ).all()
        
        if not user_results:
            results_log.append({'student': student_name_raw, 'status': 'not_found', 'reason': 'no approved results'})
            not_found += 1
            continue
        
        # Check if any result already has the original code
        already_has = [r for r in user_results if r.eduit_certificate_code == original_code]
        if already_has:
            results_log.append({'student': student_name_raw, 'status': 'already_correct', 'result_id': already_has[0].id})
            already_correct += 1
            continue
        
        # For students with multiple results, we need to match by exam
        # Since the user might have taken multiple exams, pick one that doesn't have the original code
        # For students with exactly 1 result, it's straightforward
        if len(user_results) == 1:
            target_result = user_results[0]
        else:
            # Multiple results - find one whose code isn't an original from our mapping
            all_original_codes = set(m.get('original_code', '') for m in mappings)
            # Find results that need updating (their current code is not one of our originals)
            candidates = [r for r in user_results if r.eduit_certificate_code not in all_original_codes]
            if candidates:
                target_result = candidates[0]
            else:
                results_log.append({'student': student_name_raw, 'status': 'ambiguous', 'reason': f'{len(user_results)} results, cannot determine which to update'})
                not_found += 1
                continue
        
        old_code = target_result.eduit_certificate_code
        
        if not dry_run:
            target_result.eduit_certificate_code = original_code
            db.session.add(target_result)
        
        results_log.append({
            'student': student_name_raw,
            'user_name': f"{matched_user.name} {matched_user.first_surname or ''} {matched_user.second_surname or ''}".strip(),
            'status': 'updated' if not dry_run else 'would_update',
            'result_id': target_result.id,
            'old_code': old_code,
            'new_code': original_code
        })
        updated += 1
    
    if not dry_run:
        db.session.commit()
    
    return jsonify({
        'group': {'id': group.id, 'name': group.name},
        'dry_run': dry_run,
        'total_mappings': len(mappings),
        'updated': updated,
        'not_found': not_found,
        'already_correct': already_correct,
        'details': results_log
    }), 200


@bp.route('/<code>', methods=['OPTIONS'])
def options_verify(code):
    """CORS preflight para verificación"""
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response
