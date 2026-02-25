"""
Rutas públicas de verificación de certificados
Estas rutas NO requieren autenticación.
Soporta verificación de códigos actuales Y códigos históricos (QR anteriores).
"""
from flask import Blueprint, jsonify
from app import db

bp = Blueprint('verify', __name__, url_prefix='/verify')


def _build_verification_response(result, user, code, document_type, document_name, is_historical=False):
    """Construir respuesta de verificación a partir de un Result y User."""
    from app.models.exam import Exam
    from app.models.competency_standard import CompetencyStandard
    from app.models.partner import GroupMember, CandidateGroup, GroupExam

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
        memberships = GroupMember.query.filter_by(user_id=user.id).all()
        for membership in memberships:
            group = CandidateGroup.query.filter_by(id=membership.group_id, is_active=True).first()
            if group:
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
    date_to_format = getattr(result, 'end_date', None) or getattr(result, 'start_date', None)
    if date_to_format:
        meses = {
            1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
            5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
            9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
        }
        completion_date = f"{date_to_format.day} de {meses[date_to_format.month]} de {date_to_format.year}"

    response_data = {
        'valid': True,
        'document_type': document_type,
        'document_name': document_name,
        'verification_code': code,
        'is_historical': is_historical,
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


def _build_historical_only_response(history_record, code, document_type, document_name):
    """Construir respuesta de verificación usando SOLO datos del historial
    (cuando el Result original fue eliminado y el usuario ya no existe)."""
    from app.models.exam import Exam
    from app.models.competency_standard import CompetencyStandard

    exam = Exam.query.get(history_record.exam_id)
    exam_name = exam.name if exam else 'N/A'

    ecm_code = None
    ecm_name = None
    ecm_logo_url = None
    brand_logo_url = None
    brand_name = None

    if history_record.competency_standard_id:
        standard = CompetencyStandard.query.get(history_record.competency_standard_id)
        if standard:
            ecm_code = standard.code
            ecm_name = standard.name
            ecm_logo_url = standard.logo_url
            if standard.brand:
                brand_logo_url = standard.brand.logo_url
                brand_name = standard.brand.name

    completion_date = None
    date_to_format = history_record.end_date or history_record.start_date
    if date_to_format:
        meses = {
            1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
            5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
            9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
        }
        completion_date = f"{date_to_format.day} de {meses[date_to_format.month]} de {date_to_format.year}"

    response_data = {
        'valid': True,
        'document_type': document_type,
        'document_name': document_name,
        'verification_code': code,
        'is_historical': True,
        'candidate': {
            'full_name': 'Información no disponible'
        },
        'certification': {
            'exam_name': exam_name,
            'ecm_code': ecm_code,
            'ecm_name': ecm_name,
            'ecm_logo_url': ecm_logo_url,
            'brand_logo_url': brand_logo_url,
            'brand_name': brand_name,
            'completion_date': completion_date,
            'score': history_record.score if document_type == 'evaluation_report' else None,
            'result': 'Aprobado' if history_record.result_value == 1 else 'No Aprobado'
        }
    }

    return jsonify(response_data), 200


@bp.route('/<code>', methods=['GET'])
def verify_certificate(code):
    """
    Verificar un certificado o reporte de evaluación por su código.
    Esta ruta es PÚBLICA y no requiere autenticación.
    
    Busca primero en los códigos actuales de los resultados.
    Si no se encuentra, busca en el historial de códigos (QR anteriores).
    
    Códigos:
    - ZC... = Reporte de Evaluación
    - EC... = Certificado Eduit
    - BD... = Insignia Digital (Open Badges 3.0)
    """
    from app.models.result import Result
    from app.models.user import User

    if not code or len(code) < 3:
        return jsonify({
            'valid': False,
            'error': 'Código de verificación inválido'
        }), 400

    # Determinar tipo de documento por prefijo
    prefix = code[:2].upper()

    # ── Insignia Digital → delegar a badge routes ──
    if prefix == 'BD':
        try:
            from app.models.badge import IssuedBadge, BadgeTemplate
            badge = IssuedBadge.query.filter_by(badge_code=code).first()
            if not badge:
                return jsonify({'valid': False, 'error': 'Código de insignia no encontrado'}), 404

            badge.verify_count = (badge.verify_count or 0) + 1
            db.session.commit()

            template = BadgeTemplate.query.get(badge.badge_template_id)
            user = User.query.get(str(badge.user_id))

            name_parts = [user.name or ''] if user else ['N/A']
            if user and user.first_surname:
                name_parts.append(user.first_surname)
            if user and user.second_surname:
                name_parts.append(user.second_surname)
            full_name = ' '.join(name_parts).strip() or 'N/A'

            meses = {
                1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
                5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
                9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
            }
            issued_date = badge.issued_at
            formatted_date = f"{issued_date.day} de {meses[issued_date.month]} de {issued_date.year}" if issued_date else None

            from datetime import datetime
            is_expired = badge.expires_at and badge.expires_at < datetime.utcnow()

            return jsonify({
                'valid': badge.status == 'active' and not is_expired,
                'document_type': 'digital_badge',
                'document_name': 'Insignia Digital',
                'verification_code': code,
                'status': 'expired' if is_expired else badge.status,
                'candidate': {'full_name': full_name},
                'badge': {
                    'name': template.name if template else 'N/A',
                    'description': template.description if template else None,
                    'issuer_name': template.issuer_name if template else 'EduIT / Evaluaasi',
                    'image_url': badge.badge_image_url,
                    'issued_date': formatted_date,
                    'badge_uuid': badge.badge_uuid,
                    'credential_url': badge.credential_url,
                },
                'certification': {
                    'exam_name': template.name if template else 'N/A',
                    'completion_date': formatted_date,
                    'result': 'Verificada' if badge.status == 'active' and not is_expired else 'Expirada/Revocada',
                },
            }), 200
        except Exception as e:
            print(f"[VERIFY] Error verificando badge {code}: {e}")
            return jsonify({'valid': False, 'error': 'Error al verificar insignia'}), 500

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

    # ── Encontrado en códigos actuales ──
    if result:
        if document_type == 'eduit_certificate' and result.result != 1:
            return jsonify({
                'valid': False,
                'error': 'Este certificado no es válido porque el examen no fue aprobado'
            }), 400

        user = User.query.get(result.user_id)
        if not user:
            return jsonify({'valid': False, 'error': 'Usuario no encontrado'}), 404

        return _build_verification_response(result, user, code, document_type, document_name)

    # ── No encontrado → buscar en historial de códigos ──
    try:
        from app.models.certificate_code_history import CertificateCodeHistory
        history = CertificateCodeHistory.query.filter_by(code=code).first()
    except Exception:
        history = None

    if not history:
        return jsonify({
            'valid': False,
            'error': 'No se encontró ningún documento con este código de verificación'
        }), 404

    # Intentar obtener datos actualizados del resultado original
    result = Result.query.get(history.result_id)
    if result:
        if document_type == 'eduit_certificate' and result.result != 1:
            return jsonify({
                'valid': False,
                'error': 'Este certificado no es válido porque el examen no fue aprobado'
            }), 400

        user = User.query.get(result.user_id)
        if user:
            return _build_verification_response(result, user, code, document_type, document_name, is_historical=True)

    # El resultado fue eliminado — intentar con el user_id del historial
    user = User.query.get(history.user_id)
    if user and result:
        return _build_verification_response(result, user, code, document_type, document_name, is_historical=True)

    # Último recurso: usar solo datos del historial
    if history.result_value is not None:
        if document_type == 'eduit_certificate' and history.result_value != 1:
            return jsonify({
                'valid': False,
                'error': 'Este certificado no es válido porque el examen no fue aprobado'
            }), 400
        return _build_historical_only_response(history, code, document_type, document_name)

    return jsonify({
        'valid': False,
        'error': 'No se encontró ningún documento con este código de verificación'
    }), 404


@bp.route('/<code>', methods=['OPTIONS'])
def options_verify(code):
    """CORS preflight para verificación"""
    response = jsonify({'status': 'ok'})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response
