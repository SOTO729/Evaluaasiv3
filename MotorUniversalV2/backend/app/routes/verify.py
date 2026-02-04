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
    
    # Primero intentar desde el resultado directo
    if result.competency_standard_id:
        standard = CompetencyStandard.query.get(result.competency_standard_id)
        if standard:
            ecm_code = standard.code
            ecm_name = standard.name
    
    # Si no hay ECM en el resultado, intentar desde el examen
    if not ecm_code and exam and exam.competency_standard_id:
        standard = CompetencyStandard.query.get(exam.competency_standard_id)
        if standard:
            ecm_code = standard.code
            ecm_name = standard.name
    
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
                        break
    
    # Formatear fecha de completación en español
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
            'completion_date': completion_date,
            'score': result.score if document_type == 'evaluation_report' else None,
            'result': 'Aprobado' if result.result == 1 else 'No Aprobado'
        }
    }
    
    return jsonify(response_data), 200


@bp.route('/<code>', methods=['OPTIONS'])
def options_verify(code):
    """CORS preflight para verificación"""
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response
