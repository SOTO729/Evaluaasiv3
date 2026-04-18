"""
Endpoints para gestión de sesiones de máquinas virtuales.

Roles permitidos:
  - candidato: solo ve/crea/cancela sesiones propias (si su grupo lo permite)
  - responsable: ve/crea sesiones de candidatos en su plantel (según modo del grupo)
  - admin/coordinator: ve/crea/cancela sesiones de cualquier campus

Las VDIs disponibles se leen de la base de datos EvaluaasiConfig (dbo.Equipo).
La capacidad depende de cuántas VDIs estén activas (actualmente 18 de Office).
Asignación secuencial: se llenan las VDIs por orden de EquipoId.
"""
import os
import logging
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.vm_session import VmSession
from app.models.partner import CandidateGroup, GroupMember, Campus, GroupExam

logger = logging.getLogger(__name__)

bp = Blueprint('vm_sessions', __name__)

# Fallback si no se puede conectar a EvaluaasiConfig
FALLBACK_MAX_SESSIONS = 18

def get_candidate_vm_context(user_id):
    """Obtener campus_id, group_id, y config de sesiones del candidato."""
    membership = GroupMember.query.filter_by(
        user_id=str(user_id),
        status='active'
    ).first()
    
    if not membership:
        return None, None, False, 'leader_only'
    
    group = CandidateGroup.query.get(membership.group_id)
    if not group or not group.campus:
        return None, None, False, 'leader_only'
    
    campus = group.campus
    
    # Config efectiva: grupo override → campus
    vm_enabled = False
    if group.enable_virtual_machines_override is not None:
        vm_enabled = group.enable_virtual_machines_override
    elif campus.enable_virtual_machines is not None:
        vm_enabled = campus.enable_virtual_machines
    
    session_calendar = False
    if group.enable_session_calendar_override is not None:
        session_calendar = group.enable_session_calendar_override
    elif campus.enable_session_calendar is not None:
        session_calendar = campus.enable_session_calendar

    scheduling_mode = (
        group.session_scheduling_mode_override
        if group.session_scheduling_mode_override
        else (campus.session_scheduling_mode or 'leader_only')
    )
    
    # El candidato puede agendar si VMs o calendario están habilitados
    enabled = vm_enabled or session_calendar
    
    return campus.id, group.id, enabled, scheduling_mode


def _get_global_slot_count(session_date, start_hour):
    """Contar sesiones agendadas globalmente en un slot (date + hour)."""
    return VmSession.query.filter_by(
        session_date=session_date,
        start_hour=start_hour,
        status='scheduled'
    ).count()


def _get_max_concurrent_sessions():
    """
    Obtener el número máximo de sesiones simultáneas basado en VDIs activas.
    Lee de EvaluaasiConfig; usa fallback si no puede conectar.
    """
    try:
        from app.services.evaluaasi_config_service import get_active_workstations
        vdis = get_active_workstations()
        if vdis:
            return len(vdis)
    except Exception as e:
        logger.warning(f"No se pudo conectar a EvaluaasiConfig, usando fallback: {e}")
    return FALLBACK_MAX_SESSIONS


def _assign_workstation_for_session(session_date, start_hour, campus_id=None):
    """
    Asignar una VDI disponible para un slot.
    Usa llenado secuencial (menor EquipoId primero).
    Resuelve el cert_type dinámicamente desde la configuración del campus.
    
    Returns:
        Dict con workstation info o None si no hay disponibles.
    """
    try:
        from app.services.evaluaasi_config_service import assign_workstation, get_cert_type_for_estandar
        
        # Resolver cert_type desde el campus
        cert_type = 'OFFICE-2019'  # default
        if campus_id:
            campus = Campus.query.get(campus_id)
            if campus and campus.config_certificacion_id:
                cert_type = get_cert_type_for_estandar(campus.config_certificacion_id)
        
        result = assign_workstation(session_date, start_hour, cert_type=cert_type)
        
        # Failover: si no hay VDIs del tipo primario, intentar con tipo alternativo  
        if result is None and cert_type == 'OFFICE-2019':
            result = assign_workstation(session_date, start_hour, cert_type='OFFICE-2016')
        
        return result
    except Exception as e:
        logger.warning(f"No se pudo asignar VDI desde EvaluaasiConfig: {e}")
        return None


def _sync_session_to_config(vm_session, user):
    """
    Sincronizar una sesión de Evaluaasi V2 a EvaluaasiConfig (dbo.Sesion).
    Esto alimenta al sistema legacy (EXE que crea usuarios AD y conexiones Guacamole).
    - SubsistemaId se resuelve desde el Partner del campus.
    - PlantelId, CertificacionId, EtapaId se resuelven desde el Campus.
    - Nombre es el nombre completo del candidato.
    """
    try:
        from app.services.evaluaasi_config_service import create_config_session, SESSION_TYPES
        
        session_type_int = SESSION_TYPES.get(vm_session.session_type, 1)
        inicio = datetime.combine(vm_session.session_date, 
                                  datetime.min.time().replace(hour=vm_session.start_hour))
        final = inicio + timedelta(hours=1)
        
        # Usar el username del candidato (mismo que usará en AD/Guacamole)
        nombre_usuario = user.username if user else ''
        
        # Nombre completo del candidato
        nombre = ''
        if user:
            parts = [user.name or '', user.first_surname or '', user.second_surname or '']
            nombre = ' '.join(p for p in parts if p).strip()
        
        # SubsistemaId: desde el Partner del campus
        subsistema_id = 14  # Fallback: Grupo EduIT
        plantel_id = 2      # Fallback
        
        campus = Campus.query.get(vm_session.campus_id) if vm_session.campus_id else None
        if campus:
            # Subsistema viene del Partner
            if campus.partner:
                if campus.partner.config_subsistema_id:
                    subsistema_id = campus.partner.config_subsistema_id
            if campus.config_plantel_id:
                plantel_id = campus.config_plantel_id
        
        certificacion_id = 1  # Default (ECM0054)
        etapa_id = 1  # Default
        
        if campus:
            if campus.config_certificacion_id:
                certificacion_id = campus.config_certificacion_id
            if campus.config_etapa_id:
                etapa_id = campus.config_etapa_id
        
        config_session_id = create_config_session(
            subsistema_id=subsistema_id,
            plantel_id=plantel_id,
            equipo_id=vm_session.workstation_id or 1,
            certificacion_id=certificacion_id,
            etapa_id=etapa_id,
            nombre_usuario=nombre_usuario,
            tipo=session_type_int,
            inicio=inicio,
            final=final,
            nombre=nombre,
        )
        
        if config_session_id:
            vm_session.config_session_id = config_session_id
            db.session.commit()
            logger.info(f"Sesión sincronizada a EvaluaasiConfig: {config_session_id} (sub={subsistema_id}, plantel={plantel_id})")
        
        return config_session_id
    except Exception as e:
        logger.error(f"Error sincronizando sesión a EvaluaasiConfig: {e}")
        return None


@bp.route('/check-access', methods=['GET'])
@jwt_required()
def check_vm_access():
    """Verificar si el usuario actual tiene acceso a VMs."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'has_access': False}), 200
    
    if user.role in ['admin']:
        return jsonify({
            'has_access': True,
            'role': user.role,
            'scope': 'all'
        })
    
    if user.role == 'coordinator':
        # Obtener lista de campuses del coordinador
        from app.models.partner import Campus as CampusModel, Partner
        campus_list = CampusModel.query.filter_by(
            responsable_id=str(user_id)
        ).all()
        if not campus_list:
            partner_ids = db.session.query(db.text("partner_id")).from_statement(
                db.text("SELECT partner_id FROM user_partners WHERE user_id = :uid")
            ).params(uid=str(user_id)).all()
            p_ids = [p[0] for p in partner_ids]
            if p_ids:
                campus_list = CampusModel.query.filter(
                    CampusModel.partner_id.in_(p_ids)
                ).all()
        
        return jsonify({
            'has_access': True,
            'role': user.role,
            'scope': 'campuses',
            'campuses': [{'id': c.id, 'name': c.name} for c in campus_list],
            'read_only': True,
        })
    
    if user.role == 'candidato':
        campus_id, group_id, enabled, scheduling_mode = get_candidate_vm_context(user_id)
        return jsonify({
            'has_access': enabled,
            'role': user.role,
            'scope': 'self',
            'campus_id': campus_id,
            'group_id': group_id,
            'scheduling_mode': scheduling_mode,
            'can_self_schedule': scheduling_mode == 'candidate_self',
        })
    
    if user.role == 'responsable' and user.campus_id:
        campus = Campus.query.get(user.campus_id)
        vm_enabled = campus.enable_virtual_machines if campus else False
        session_calendar = campus.enable_session_calendar if campus else False
        return jsonify({
            'has_access': vm_enabled or session_calendar,
            'role': user.role,
            'scope': 'campus',
            'campus_id': user.campus_id,
        })
    
    return jsonify({'has_access': False}), 200


@bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_sessions():
    """
    Obtener sesiones de VM.
    
    Query params:
      - campus_id (required for admin/coordinator)
      - date_from (YYYY-MM-DD) — default: hoy
      - date_to (YYYY-MM-DD) — default: hoy + 30 días
      - status — default: scheduled
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    # Parsear filtros
    date_from_str = request.args.get('date_from')
    date_to_str = request.args.get('date_to')
    status_filter = request.args.get('status', 'all')
    campus_id_param = request.args.get('campus_id', type=int)
    
    today = date.today()
    try:
        date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date() if date_from_str else today
        date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date() if date_to_str else today + timedelta(days=30)
    except ValueError:
        date_from = today
        date_to = today + timedelta(days=30)
    
    # Construir query según rol
    query = VmSession.query.filter(
        VmSession.session_date >= date_from,
        VmSession.session_date <= date_to,
    )
    
    if status_filter != 'all':
        query = query.filter(VmSession.status == status_filter)
    
    if user.role in ['admin', 'developer']:
        if campus_id_param:
            query = query.filter(VmSession.campus_id == campus_id_param)
    elif user.role == 'coordinator':
        # Solo campuses asociados al coordinador
        from app.models.partner import Campus as CampusModel
        campus_ids = [c.id for c in CampusModel.query.filter_by(
            responsable_id=str(user_id)
        ).all()]
        # También incluir campuses de partners del coordinador
        if not campus_ids:
            from app.models.partner import Partner
            partner_ids = db.session.query(db.text("partner_id")).from_statement(
                db.text("SELECT partner_id FROM user_partners WHERE user_id = :uid")
            ).params(uid=str(user_id)).all()
            p_ids = [p[0] for p in partner_ids]
            if p_ids:
                campus_ids = [c.id for c in CampusModel.query.filter(
                    CampusModel.partner_id.in_(p_ids)
                ).all()]
        if campus_id_param and campus_id_param in campus_ids:
            query = query.filter(VmSession.campus_id == campus_id_param)
        elif campus_ids:
            query = query.filter(VmSession.campus_id.in_(campus_ids))
        else:
            return jsonify({'sessions': [], 'total': 0})
    elif user.role == 'candidato':
        campus_id, group_id, enabled, scheduling_mode = get_candidate_vm_context(user_id)
        if not enabled:
            return jsonify({'error': 'Sesiones no habilitadas para tu grupo'}), 403
        query = query.filter(VmSession.user_id == str(user_id))
    elif user.role == 'responsable' and user.campus_id:
        campus = Campus.query.get(user.campus_id)
        if not campus:
            return jsonify({'error': 'Plantel no encontrado'}), 404
        # Responsable ve sesiones de su plantel
        group_id_filter = request.args.get('group_id', type=int)
        if group_id_filter:
            query = query.filter(VmSession.group_id == group_id_filter)
        else:
            query = query.filter(VmSession.campus_id == user.campus_id)
    else:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    sessions = query.order_by(
        VmSession.session_date.asc(),
        VmSession.start_hour.asc()
    ).all()
    
    return jsonify({
        'sessions': [s.to_dict(include_user=user.role in ['admin', 'coordinator', 'responsable']) for s in sessions],
        'total': len(sessions),
        'date_from': date_from.isoformat(),
        'date_to': date_to.isoformat(),
    })


@bp.route('/sessions', methods=['POST'])
@jwt_required()
def create_session():
    """
    Agendar una sesión de VM.
    
    Body:
      - session_date (YYYY-MM-DD) — required
      - start_hour (0-23) — required
      - user_id (solo admin/coordinator, para agendar a un candidato)
      - campus_id (solo admin/coordinator)
      - notes (opcional)
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Datos requeridos'}), 400
    
    session_date_str = data.get('session_date')
    start_hour = data.get('start_hour')
    
    if not session_date_str or start_hour is None:
        return jsonify({'error': 'session_date y start_hour son requeridos'}), 400
    
    try:
        session_date = datetime.strptime(session_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (YYYY-MM-DD)'}), 400
    
    if not isinstance(start_hour, int) or start_hour < 0 or start_hour > 23:
        return jsonify({'error': 'start_hour debe ser un entero entre 0 y 23'}), 400
    
    # No agendar en el pasado
    now = datetime.utcnow()
    if session_date < now.date() or (session_date == now.date() and start_hour <= now.hour):
        return jsonify({'error': 'No se puede agendar una sesión en el pasado'}), 400
    
    # Determinar target_user y campus según rol
    if user.role == 'candidato':
        campus_id, group_id, enabled, scheduling_mode = get_candidate_vm_context(user_id)
        if not enabled:
            return jsonify({'error': 'Sesiones no habilitadas para tu grupo'}), 403
        if scheduling_mode == 'leader_only':
            return jsonify({'error': 'En tu grupo, solo el responsable del plantel puede agendar sesiones.'}), 403
        target_user_id = user_id
        target_campus_id = campus_id
        target_group_id = group_id
    
    elif user.role == 'responsable' and user.campus_id:
        # Responsable puede agendar para candidatos de su plantel
        candidate_user_id = data.get('user_id')
        target_group_id = data.get('group_id')
        
        if candidate_user_id:
            # Agendar para un candidato específico
            candidate = User.query.get(candidate_user_id)
            if not candidate or candidate.role != 'candidato':
                return jsonify({'error': 'Usuario candidato no encontrado'}), 404
            # Verificar que el candidato pertenece a un grupo del plantel del responsable
            membership = GroupMember.query.filter_by(
                user_id=str(candidate_user_id), status='active'
            ).first()
            if not membership:
                return jsonify({'error': 'El candidato no pertenece a ningún grupo activo'}), 400
            group = CandidateGroup.query.get(membership.group_id)
            if not group or group.campus_id != user.campus_id:
                return jsonify({'error': 'El candidato no pertenece a tu plantel'}), 403
            target_user_id = candidate_user_id
            target_campus_id = user.campus_id
            target_group_id = target_group_id or membership.group_id
        else:
            return jsonify({'error': 'user_id del candidato es requerido'}), 400
        
    elif user.role in ['admin', 'developer']:
        target_user_id = data.get('user_id', user_id)
        target_campus_id = data.get('campus_id')
        
        if not target_campus_id:
            return jsonify({'error': 'campus_id es requerido para admin'}), 400
        
        # Obtener group_id del target user si es candidato
        target_group_id = None
        if target_user_id != user_id:
            membership = GroupMember.query.filter_by(
                user_id=str(target_user_id),
                status='active'
            ).first()
            if membership:
                target_group_id = membership.group_id
    else:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    # --- Validación: capacidad basada en VDIs activas ---
    max_sessions = _get_max_concurrent_sessions()
    global_count = _get_global_slot_count(session_date, start_hour)
    if global_count >= max_sessions:
        return jsonify({
            'error': f'Se alcanzó el límite de {max_sessions} sesiones simultáneas en este horario. Selecciona otro horario.',
        }), 409
    
    # Verificar que el usuario no tenga otra sesión en la misma fecha y hora
    user_existing = VmSession.query.filter_by(
        user_id=str(target_user_id),
        session_date=session_date,
        start_hour=start_hour,
        status='scheduled'
    ).first()
    
    if user_existing:
        return jsonify({
            'error': 'Ya tienes una sesión agendada en este horario.'
        }), 409
    
    # Tipo de sesión
    session_type = data.get('session_type', 'simulador')
    if session_type not in ('simulador', 'examen', 'parcial'):
        session_type = 'simulador'
    
    # Validar horario según configuración de EvaluaasiConfig
    try:
        from app.services.evaluaasi_config_service import validate_schedule_slot, get_cert_type_for_estandar
        campus_obj = Campus.query.get(target_campus_id) if target_campus_id else None
        resolved_cert_type = 'OFFICE-2019'
        if campus_obj and campus_obj.config_certificacion_id:
            resolved_cert_type = get_cert_type_for_estandar(campus_obj.config_certificacion_id)
        schedule_check = validate_schedule_slot(start_hour, session_type, resolved_cert_type)
        if not schedule_check['valid']:
            return jsonify({'error': schedule_check['reason']}), 400
    except Exception as e:
        logger.warning(f"Validación de horario no disponible: {e}")
    
    # Asignar VDI disponible (llenado secuencial, cert_type dinámico)
    workstation = _assign_workstation_for_session(session_date, start_hour, campus_id=target_campus_id)
    
    # Crear sesión
    session = VmSession(
        user_id=str(target_user_id),
        campus_id=target_campus_id,
        group_id=target_group_id,
        session_date=session_date,
        start_hour=start_hour,
        session_type=session_type,
        workstation_id=workstation['equipo_id'] if workstation else None,
        workstation_name=workstation['nombre'] if workstation else None,
        workstation_color=workstation['color'] if workstation else None,
        status='scheduled',
        notes=data.get('notes'),
        created_by_id=str(user_id),
    )
    
    try:
        db.session.add(session)
        db.session.commit()
        
        # Sincronizar a EvaluaasiConfig (async-style, no bloquea si falla)
        target_user = User.query.get(target_user_id)
        _sync_session_to_config(session, target_user)
        
        # Notificar al equipo de operaciones
        try:
            from app.services.email_service import send_vdi_session_notification
            campus_obj_notify = Campus.query.get(target_campus_id) if target_campus_id else None
            candidate_name = f"{target_user.name or ''} {target_user.first_surname or ''}".strip() if target_user else ''
            send_vdi_session_notification(
                action='created',
                candidate_name=candidate_name,
                candidate_username=target_user.username if target_user else '',
                session_date=session_date.strftime('%d/%m/%Y'),
                start_hour=start_hour,
                workstation_name=session.workstation_name or '',
                campus_name=campus_obj_notify.name if campus_obj_notify else '',
                session_type=session_type,
            )
        except Exception as e:
            logger.warning(f"No se pudo enviar notificación VDI: {e}")
        
        return jsonify({
            'message': 'Sesión agendada exitosamente',
            'session': session.to_dict()
        }), 201
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        if 'unique' in str(e).lower():
            return jsonify({
                'error': 'Este horario ya fue reservado.'
            }), 409
        return jsonify({'error': str(e)}), 500


@bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def cancel_session(session_id):
    """Cancelar una sesión de VM."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    session = VmSession.query.get(session_id)
    if not session:
        return jsonify({'error': 'Sesión no encontrada'}), 404
    
    if session.status != 'scheduled':
        return jsonify({'error': 'Solo se pueden cancelar sesiones programadas'}), 400
    
    # Verificar permisos
    if user.role == 'coordinator':
        return jsonify({'error': 'Coordinadores solo tienen acceso de lectura a sesiones VDI'}), 403
    if user.role == 'candidato' and session.user_id != str(user_id):
        return jsonify({'error': 'Solo puedes cancelar tus propias sesiones'}), 403
    elif user.role == 'responsable' and session.campus_id != user.campus_id:
        return jsonify({'error': 'Solo puedes cancelar sesiones de tu plantel'}), 403
    
    data = request.get_json() or {}
    
    session.status = 'cancelled'
    session.cancelled_by_id = str(user_id)
    session.cancellation_reason = data.get('reason', '')
    session.cancelled_at = datetime.utcnow()
    
    try:
        db.session.commit()
        
        # Limpiar usuario AD si fue provisionado
        try:
            session_user = User.query.get(session.user_id)
            if session_user:
                from app.services.ad_management_service import delete_ad_user
                delete_ad_user(session_user.username)
                logger.info(f"AD user {session_user.username} eliminado por cancelación de sesión {session_id}")
        except Exception as e:
            logger.warning(f"No se pudo eliminar usuario AD en cancelación: {e}")
        
        # Sincronizar cancelación a EvaluaasiConfig
        if session.config_session_id:
            try:
                from app.services.evaluaasi_config_service import cancel_config_session
                cancel_config_session(session.config_session_id)
                logger.info(f"Sesión {session.config_session_id} cancelada en EvaluaasiConfig")
            except Exception as e:
                logger.error(f"Error cancelando sesión en EvaluaasiConfig: {e}")
        
        # Notificar al equipo de operaciones
        try:
            from app.services.email_service import send_vdi_session_notification
            session_user = User.query.get(session.user_id)
            campus_obj_notify = Campus.query.get(session.campus_id) if session.campus_id else None
            candidate_name = f"{session_user.name or ''} {session_user.first_surname or ''}".strip() if session_user else ''
            send_vdi_session_notification(
                action='cancelled',
                candidate_name=candidate_name,
                candidate_username=session_user.username if session_user else '',
                session_date=session.session_date.strftime('%d/%m/%Y'),
                start_hour=session.start_hour,
                workstation_name=session.workstation_name or '',
                campus_name=campus_obj_notify.name if campus_obj_notify else '',
                session_type=session.session_type or 'simulador',
                cancelled_by=f"{user.name or ''} {user.first_surname or ''}".strip() or user.username,
                cancellation_reason=data.get('reason', ''),
            )
        except Exception as e:
            logger.warning(f"No se pudo enviar notificación VDI de cancelación: {e}")
        
        return jsonify({
            'message': 'Sesión cancelada',
            'session': session.to_dict()
        })
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/sessions/<int:session_id>/status', methods=['PATCH'])
@jwt_required()
def update_session_status(session_id):
    """
    Actualizar estado de una sesión (solo admin).
    Body: { "status": "completed" | "no_show" }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    session = VmSession.query.get(session_id)
    if not session:
        return jsonify({'error': 'Sesión no encontrada'}), 404
    
    data = request.get_json()
    new_status = data.get('status')
    
    valid_transitions = {
        'scheduled': ['completed', 'no_show', 'cancelled'],
    }
    
    if session.status not in valid_transitions:
        return jsonify({'error': f'No se puede cambiar el estado de una sesión {session.status}'}), 400
    
    if new_status not in valid_transitions.get(session.status, []):
        return jsonify({'error': f'Transición inválida: {session.status} → {new_status}'}), 400
    
    session.status = new_status
    if new_status == 'cancelled':
        session.cancelled_by_id = str(user_id)
        session.cancelled_at = datetime.utcnow()
    
    try:
        db.session.commit()
        
        # Limpiar usuario AD si la sesión terminó
        if new_status in ('completed', 'no_show', 'cancelled'):
            try:
                target_user = User.query.get(session.user_id)
                if target_user:
                    from app.services.ad_management_service import delete_ad_user
                    delete_ad_user(target_user.username)
                    logger.info(f"AD user {target_user.username} eliminado por cambio de estado a {new_status}")
            except Exception as e:
                logger.warning(f"No se pudo eliminar usuario AD al cambiar estado: {e}")
        
        # Sincronizar estado a EvaluaasiConfig
        if session.config_session_id:
            try:
                if new_status == 'completed':
                    from app.services.evaluaasi_config_service import complete_config_session
                    complete_config_session(session.config_session_id)
                    logger.info(f"Sesión {session.config_session_id} completada en EvaluaasiConfig")
                    # Marcar completado en AD vía SOAP
                    try:
                        from app.services.ad_soap_service import mark_completed
                        target_user = User.query.get(session.user_id)
                        campus = Campus.query.get(session.campus_id) if session.campus_id else None
                        if target_user and campus:
                            sub_id = campus.config_subsistema_id or 14
                            plan_id = campus.config_plantel_id or 2
                            mark_completed(sub_id, plan_id, target_user.username)
                            logger.info(f"SOAP MarkCompleted para {target_user.username}")
                    except Exception as soap_err:
                        logger.warning(f"SOAP MarkCompleted falló (no bloqueante): {soap_err}")
                elif new_status in ('cancelled', 'no_show'):
                    from app.services.evaluaasi_config_service import cancel_config_session
                    cancel_config_session(session.config_session_id)
                    logger.info(f"Sesión {session.config_session_id} cancelada en EvaluaasiConfig")
            except Exception as e:
                logger.error(f"Error sincronizando estado a EvaluaasiConfig: {e}")
        
        return jsonify({
            'message': f'Estado actualizado a {new_status}',
            'session': session.to_dict()
        })
    except HTTPException:
        raise
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/available-slots', methods=['GET'])
@jwt_required()
def get_available_slots():
    """
    Obtener disponibilidad global de horarios para una fecha.
    Límite basado en VDIs activas en EvaluaasiConfig.

    Query params:
      - date (YYYY-MM-DD, required)
      - operating_hours_start (default: 8)
      - operating_hours_end (default: 20)
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    date_str = request.args.get('date')
    hours_start = request.args.get('operating_hours_start', 8, type=int)
    hours_end = request.args.get('operating_hours_end', 20, type=int)

    if not date_str:
        return jsonify({'error': 'date es requerido'}), 400

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido'}), 400

    if user.role == 'candidato':
        c_campus_id, _, enabled, _ = get_candidate_vm_context(user_id)
        if not enabled:
            return jsonify({'error': 'Sesiones no habilitadas'}), 403

    # Todas las sesiones scheduled en esa fecha (global)
    all_sessions = VmSession.query.filter(
        VmSession.session_date == target_date,
        VmSession.status == 'scheduled',
    ).all()

    hour_counts = {}
    hour_details = {}
    for s in all_sessions:
        hour_counts[s.start_hour] = hour_counts.get(s.start_hour, 0) + 1
        if user.role in ['admin', 'developer', 'coordinator', 'responsable']:
            hour_details.setdefault(s.start_hour, []).append({
                'session_id': s.id,
                'user_id': s.user_id,
                'user_name': s.user.full_name if s.user else 'Desconocido',
                'group_id': s.group_id,
                'group_name': s.group.name if s.group else None,
                'campus_id': s.campus_id,
                'campus_name': s.campus.name if s.campus else None,
            })

    max_sessions = _get_max_concurrent_sessions()
    now = datetime.utcnow()
    slots = []
    for hour in range(hours_start, hours_end):
        is_past = (target_date < now.date()) or (target_date == now.date() and hour <= now.hour)
        count = hour_counts.get(hour, 0)

        slot_data = {
            'hour': hour,
            'label': f'{hour:02d}:00 - {hour + 1:02d}:00',
            'available': count < max_sessions and not is_past,
            'is_past': is_past,
            'global_count': count,
            'max_sessions': max_sessions,
            'remaining': max(0, max_sessions - count),
        }

        if hour in hour_details:
            slot_data['sessions'] = hour_details[hour]

        slots.append(slot_data)

    return jsonify({
        'date': target_date.isoformat(),
        'slots': slots,
        'total_available': sum(1 for s in slots if s['available']),
    })


# ─── Endpoints exclusivos para responsable ──────────────────────────

@bp.route('/responsable-groups', methods=['GET'])
@jwt_required()
def get_responsable_groups():
    """Grupos con calendario de sesiones habilitado en el plantel del responsable."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'responsable' or not user.campus_id:
        return jsonify({'error': 'Acceso denegado'}), 403

    campus = Campus.query.get(user.campus_id)
    if not campus:
        return jsonify({'error': 'Plantel no encontrado'}), 404

    groups = CandidateGroup.query.filter_by(campus_id=user.campus_id).all()
    result = []
    for g in groups:
        session_enabled = (
            g.enable_session_calendar_override
            if g.enable_session_calendar_override is not None
            else (campus.enable_session_calendar or False)
        )
        scheduling_mode = (
            g.session_scheduling_mode_override
            if g.session_scheduling_mode_override
            else (campus.session_scheduling_mode or 'leader_only')
        )
        if not session_enabled:
            continue

        member_count = GroupMember.query.filter_by(
            group_id=g.id, status='active'
        ).count()

        result.append({
            'id': g.id,
            'name': g.name,
            'scheduling_mode': scheduling_mode,
            'member_count': member_count,
        })

    return jsonify({
        'campus_id': user.campus_id,
        'campus_name': campus.name,
        'groups': result,
    })


@bp.route('/group-candidates', methods=['GET'])
@jwt_required()
def get_group_candidates():
    """Candidatos activos de un grupo (para asignar sesiones)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'responsable' or not user.campus_id:
        return jsonify({'error': 'Acceso denegado'}), 403

    group_id = request.args.get('group_id', type=int)
    if not group_id:
        return jsonify({'error': 'group_id es requerido'}), 400

    group = CandidateGroup.query.get(group_id)
    if not group or group.campus_id != user.campus_id:
        return jsonify({'error': 'Grupo no encontrado en tu plantel'}), 404

    members = GroupMember.query.filter_by(group_id=group_id, status='active').all()
    candidates = []
    for m in members:
        u = User.query.get(m.user_id)
        if u and u.role == 'candidato':
            scheduled = VmSession.query.filter_by(
                user_id=str(m.user_id), group_id=group_id, status='scheduled'
            ).first()
            candidates.append({
                'user_id': m.user_id,
                'name': u.full_name or u.email,
                'email': u.email,
                'has_scheduled_session': scheduled is not None,
            })

    return jsonify({'candidates': candidates})


@bp.route('/auto-distribute', methods=['POST'])
@jwt_required()
def auto_distribute():
    """
    Auto-distribuir sesiones para candidatos de un grupo (solo propuesta).
    Solo disponible para responsable en modo leader_only.

    Body:
      - group_id (required)
      - date_from (YYYY-MM-DD, default: mañana)
      - date_to (YYYY-MM-DD, default: date_from + 6 days)
      - hours_start (default: 8)
      - hours_end (default: 20)
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'responsable' or not user.campus_id:
        return jsonify({'error': 'Acceso denegado'}), 403

    data = request.get_json()
    group_id = data.get('group_id')
    if not group_id:
        return jsonify({'error': 'group_id es requerido'}), 400

    group = CandidateGroup.query.get(group_id)
    if not group or group.campus_id != user.campus_id:
        return jsonify({'error': 'Grupo no encontrado en tu plantel'}), 404

    campus = Campus.query.get(user.campus_id)
    scheduling_mode = (
        group.session_scheduling_mode_override
        if group.session_scheduling_mode_override
        else (campus.session_scheduling_mode or 'leader_only')
    )
    if scheduling_mode != 'leader_only':
        return jsonify({'error': 'Auto-distribución solo disponible en modo líder'}), 400

    tomorrow = date.today() + timedelta(days=1)
    date_from_str = data.get('date_from')
    date_to_str = data.get('date_to')
    hours_start = data.get('hours_start', 8)
    hours_end = data.get('hours_end', 20)

    try:
        date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date() if date_from_str else tomorrow
        date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date() if date_to_str else date_from + timedelta(days=6)
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido'}), 400

    if date_from < date.today():
        return jsonify({'error': 'La fecha de inicio no puede ser en el pasado'}), 400

    # Candidatos sin sesión agendada en este grupo
    members = GroupMember.query.filter_by(group_id=group_id, status='active').all()
    candidates = []
    for m in members:
        existing = VmSession.query.filter_by(
            user_id=str(m.user_id), group_id=group_id, status='scheduled'
        ).first()
        if not existing:
            u = User.query.get(m.user_id)
            if u:
                candidates.append({'user_id': m.user_id, 'name': u.full_name or u.email})

    if not candidates:
        return jsonify({'message': 'Todos los candidatos ya tienen sesión agendada', 'proposal': []})

    # Slots disponibles en el rango (lunes-viernes)
    max_sessions = _get_max_concurrent_sessions()
    available_slots = []
    cur = date_from
    now = datetime.utcnow()
    while cur <= date_to:
        if cur.weekday() < 5:
            for h in range(hours_start, hours_end):
                if cur > now.date() or (cur == now.date() and h > now.hour):
                    remaining = max_sessions - _get_global_slot_count(cur, h)
                    if remaining > 0:
                        available_slots.append({'date': cur, 'hour': h, 'remaining': remaining})
        cur += timedelta(days=1)

    proposal = []
    slot_idx = 0
    slot_usage = {}

    for cand in candidates:
        placed = False
        while slot_idx < len(available_slots) and not placed:
            s = available_slots[slot_idx]
            key = (s['date'], s['hour'])
            used = slot_usage.get(key, 0)
            if used < s['remaining']:
                proposal.append({
                    'user_id': cand['user_id'],
                    'user_name': cand['name'],
                    'session_date': s['date'].isoformat(),
                    'start_hour': s['hour'],
                    'hour_label': f"{s['hour']:02d}:00 - {s['hour']+1:02d}:00",
                })
                slot_usage[key] = used + 1
                placed = True
            else:
                slot_idx += 1
        if not placed:
            proposal.append({
                'user_id': cand['user_id'],
                'user_name': cand['name'],
                'session_date': None,
                'start_hour': None,
                'hour_label': 'Sin horario disponible',
                'error': True,
            })

    return jsonify({
        'group_id': group_id,
        'group_name': group.name,
        'proposal': proposal,
        'total_candidates': len(candidates),
        'total_assigned': sum(1 for p in proposal if p.get('session_date')),
        'total_unassigned': sum(1 for p in proposal if not p.get('session_date')),
    })


@bp.route('/bulk-create', methods=['POST'])
@jwt_required()
def bulk_create_sessions():
    """
    Crear múltiples sesiones de una propuesta aceptada.
    Solo para responsable.

    Body:
      - group_id
      - sessions: [{user_id, session_date, start_hour}, ...]
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role != 'responsable' or not user.campus_id:
        return jsonify({'error': 'Acceso denegado'}), 403

    data = request.get_json()
    group_id = data.get('group_id')
    sessions_data = data.get('sessions', [])

    if not group_id or not sessions_data:
        return jsonify({'error': 'group_id y sessions son requeridos'}), 400

    group = CandidateGroup.query.get(group_id)
    if not group or group.campus_id != user.campus_id:
        return jsonify({'error': 'Grupo no encontrado en tu plantel'}), 403

    created = []
    errors = []

    max_sessions = _get_max_concurrent_sessions()
    session_type = data.get('session_type', 'simulador')
    if session_type not in ('simulador', 'examen', 'parcial'):
        session_type = 'simulador'

    for s in sessions_data:
        try:
            s_date = datetime.strptime(s['session_date'], '%Y-%m-%d').date()
            s_hour = int(s['start_hour'])
            s_user_id = s['user_id']

            if _get_global_slot_count(s_date, s_hour) >= max_sessions:
                errors.append({'user_id': s_user_id, 'error': f'Slot {s_date} {s_hour}:00 lleno'})
                continue

            existing = VmSession.query.filter_by(
                user_id=str(s_user_id), session_date=s_date,
                start_hour=s_hour, status='scheduled'
            ).first()
            if existing:
                errors.append({'user_id': s_user_id, 'error': f'Ya tiene sesión en {s_date} {s_hour}:00'})
                continue

            # Asignar VDI (cert_type dinámico según campus)
            workstation = _assign_workstation_for_session(s_date, s_hour, campus_id=user.campus_id)

            session = VmSession(
                user_id=str(s_user_id),
                campus_id=user.campus_id,
                group_id=group_id,
                session_date=s_date,
                start_hour=s_hour,
                session_type=session_type,
                workstation_id=workstation['equipo_id'] if workstation else None,
                workstation_name=workstation['nombre'] if workstation else None,
                workstation_color=workstation['color'] if workstation else None,
                status='scheduled',
                notes=s.get('notes', 'Auto-distribuido'),
                created_by_id=str(user_id),
            )
            db.session.add(session)
            created.append(session)
        except (KeyError, ValueError, TypeError) as e:
            errors.append({'user_id': s.get('user_id'), 'error': str(e)})

    try:
        db.session.commit()

        # Sincronizar cada sesión creada a EvaluaasiConfig
        for ses in created:
            target_user = User.query.get(ses.user_id)
            _sync_session_to_config(ses, target_user)

        return jsonify({
            'message': f'{len(created)} sesiones creadas',
            'created': [ses.to_dict() for ses in created],
            'errors': errors,
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── Endpoints de administración de VDIs ─────────────────────────────

@bp.route('/workstations', methods=['GET'])
@jwt_required()
def get_workstations():
    """
    Listar VDIs de EvaluaasiConfig (solo admin).
    Query params:
      - all (boolean) — incluir VDIs inactivas (default: false)
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    show_all = request.args.get('all', 'false').lower() == 'true'

    try:
        if show_all:
            from app.services.evaluaasi_config_service import get_all_workstations
            vdis = get_all_workstations()
        else:
            from app.services.evaluaasi_config_service import get_active_workstations
            vdis = get_active_workstations()
        return jsonify({'workstations': vdis, 'total': len(vdis)})
    except Exception as e:
        logger.error(f"Error obteniendo VDIs: {e}")
        return jsonify({'error': 'No se pudo conectar a EvaluaasiConfig', 'detail': str(e)}), 503


@bp.route('/workstations/<int:equipo_id>/toggle', methods=['PATCH'])
@jwt_required()
def toggle_workstation(equipo_id):
    """Activar/desactivar una VDI (solo admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    data = request.get_json() or {}
    active = data.get('active')
    if active is None:
        return jsonify({'error': 'Campo active (bool) es requerido'}), 400

    try:
        from app.services.evaluaasi_config_service import update_workstation_status
        success = update_workstation_status(equipo_id, active=bool(active))
        if success:
            return jsonify({'message': f'VDI {equipo_id} {"activada" if active else "desactivada"}'})
        return jsonify({'error': 'VDI no encontrada o sin cambios'}), 404
    except Exception as e:
        logger.error(f"Error actualizando VDI {equipo_id}: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/workstations/status', methods=['GET'])
@jwt_required()
def workstation_status():
    """
    Estado actual de VDIs: cuántas activas, ocupadas ahora, disponibles.
    Solo admin.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.evaluaasi_config_service import get_available_slot_count, get_active_workstations
        now = datetime.utcnow()
        today = now.date()
        current_hour = now.hour

        slot_info = get_available_slot_count(today, current_hour)
        active_vdis = get_active_workstations()

        return jsonify({
            'current_slot': f'{current_hour:02d}:00 - {current_hour + 1:02d}:00',
            'total_active_vdis': slot_info.get('total_vdis', len(active_vdis)),
            'occupied_now': slot_info.get('occupied', 0),
            'available_now': slot_info.get('available', len(active_vdis)),
            'vdis': active_vdis,
        })
    except Exception as e:
        logger.error(f"Error obteniendo estado de VDIs: {e}")
        return jsonify({'error': 'No se pudo conectar a EvaluaasiConfig', 'detail': str(e)}), 503


@bp.route('/config-health', methods=['GET'])
@jwt_required()
def config_health():
    """Verificar conexión a EvaluaasiConfig (solo admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.evaluaasi_config_service import test_connection
        result = test_connection()
        return jsonify(result)
    except Exception as e:
        return jsonify({'connected': False, 'error': str(e)}), 503


@bp.route('/config-subsistemas', methods=['GET'])
@jwt_required()
def list_config_subsistemas():
    """
    Listar subsistemas de EvaluaasiConfig (para mapeo de campus).
    Solo admin/coordinator.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer', 'coordinator']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.evaluaasi_config_service import get_subsistemas
        subsistemas = get_subsistemas()
        return jsonify({'subsistemas': subsistemas})
    except Exception as e:
        logger.error(f"Error obteniendo subsistemas: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/config-estandares', methods=['GET'])
@jwt_required()
def list_config_estandares():
    """
    Listar estándares/certificaciones de EvaluaasiConfig.
    Solo admin/coordinator.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer', 'coordinator']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.evaluaasi_config_service import get_estandares
        estandares = get_estandares()
        return jsonify({'estandares': estandares})
    except Exception as e:
        logger.error(f"Error obteniendo estándares: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/verify-flow', methods=['GET'])
@jwt_required()
def verify_flow():
    """
    Verificar el flujo completo end-to-end:
    1. Conexión a EvaluaasiConfig DB
    2. VDIs activas disponibles
    3. Conexión a SOAP ADWebService
    4. Usuarios AD actuales (creados por el EXE)
    5. Horarios configurados
    Solo admin.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    results = {
        'timestamp': datetime.utcnow().isoformat(),
        'steps': [],
        'all_ok': True,
    }

    # Step 1: EvaluaasiConfig DB
    try:
        from app.services.evaluaasi_config_service import test_connection
        db_ok = test_connection()
        results['steps'].append({
            'step': 1, 'name': 'EvaluaasiConfig DB', 'ok': bool(db_ok),
            'detail': 'Conexión exitosa' if db_ok else 'Error de conexión',
        })
        if not db_ok:
            results['all_ok'] = False
    except Exception as e:
        results['steps'].append({'step': 1, 'name': 'EvaluaasiConfig DB', 'ok': False, 'detail': str(e)})
        results['all_ok'] = False

    # Step 2: VDIs activas
    try:
        from app.services.evaluaasi_config_service import get_active_workstations
        vdis = get_active_workstations()
        results['steps'].append({
            'step': 2, 'name': 'VDIs activas',
            'ok': len(vdis) > 0,
            'detail': f'{len(vdis)} VDIs activas',
            'data': {'count': len(vdis), 'names': [v['nombre'] for v in vdis[:5]]},
        })
        if len(vdis) == 0:
            results['all_ok'] = False
    except Exception as e:
        results['steps'].append({'step': 2, 'name': 'VDIs activas', 'ok': False, 'detail': str(e)})
        results['all_ok'] = False

    # Step 3: SOAP connection
    try:
        from app.services.ad_soap_service import test_soap_connection
        soap = test_soap_connection()
        results['steps'].append({
            'step': 3, 'name': 'SOAP ADWebService',
            'ok': soap.get('connected', False),
            'detail': soap.get('message', soap.get('error', 'Desconocido')),
        })
        if not soap.get('connected'):
            results['all_ok'] = False
    except Exception as e:
        results['steps'].append({'step': 3, 'name': 'SOAP ADWebService', 'ok': False, 'detail': str(e)})
        results['all_ok'] = False

    # Step 4: Usuarios AD (creados por EXE)
    try:
        from app.services.ad_soap_service import get_users
        ad_users = get_users()
        results['steps'].append({
            'step': 4, 'name': 'Usuarios AD activos',
            'ok': True,
            'detail': f'{len(ad_users)} usuarios en Active Directory',
            'data': {'count': len(ad_users)},
        })
    except Exception as e:
        results['steps'].append({'step': 4, 'name': 'Usuarios AD activos', 'ok': False, 'detail': str(e)})
        results['all_ok'] = False

    # Step 5: Horarios configurados
    try:
        from app.services.evaluaasi_config_service import get_configured_schedules
        horarios = get_configured_schedules('office')
        horarios_az = get_configured_schedules('az900')
        results['steps'].append({
            'step': 5, 'name': 'Horarios configurados',
            'ok': True,
            'detail': f'{len(horarios)} slots Office, {len(horarios_az)} slots AZ900',
        })
    except Exception as e:
        results['steps'].append({'step': 5, 'name': 'Horarios configurados', 'ok': False, 'detail': str(e)})

    # Step 6: Sesiones pendientes en V2
    pending_count = VmSession.query.filter_by(status='scheduled').count()
    synced_count = VmSession.query.filter(
        VmSession.status == 'scheduled',
        VmSession.config_session_id.isnot(None),
    ).count()
    unsynced = pending_count - synced_count
    results['steps'].append({
        'step': 6, 'name': 'Sesiones V2 pendientes',
        'ok': unsynced == 0,
        'detail': f'{pending_count} programadas, {synced_count} sincronizadas, {unsynced} sin sincronizar',
        'data': {'pending': pending_count, 'synced': synced_count, 'unsynced': unsynced},
    })
    if unsynced > 0:
        results['all_ok'] = False

    # Step 7: Conexión directa a Active Directory (LDAP)
    try:
        from app.services.ad_management_service import test_ad_connection
        ad_ldap = test_ad_connection()
        results['steps'].append({
            'step': 7, 'name': 'AD LDAP directo',
            'ok': ad_ldap.get('ok', False),
            'detail': f"Conectado a {ad_ldap.get('server', '?')}" if ad_ldap.get('ok') else ad_ldap.get('error', 'Error'),
        })
        if not ad_ldap.get('ok'):
            results['all_ok'] = False
    except Exception as e:
        results['steps'].append({'step': 7, 'name': 'AD LDAP directo', 'ok': False, 'detail': str(e)})
        results['all_ok'] = False

    return jsonify(results)


@bp.route('/retry-sync', methods=['POST'])
@jwt_required()
def retry_sync():
    """
    Reintentar sincronización de sesiones pendientes a EvaluaasiConfig.
    Busca sesiones 'scheduled' sin config_session_id y las sincroniza.
    Solo admin/developer.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    unsynced = VmSession.query.filter(
        VmSession.status == 'scheduled',
        VmSession.config_session_id.is_(None),
    ).all()

    if not unsynced:
        return jsonify({'message': 'No hay sesiones pendientes de sincronizar', 'synced': 0, 'failed': 0})

    synced = 0
    failed = 0
    details = []

    for session in unsynced:
        target_user = User.query.get(session.user_id)
        config_id = _sync_session_to_config(session, target_user)
        if config_id:
            synced += 1
            details.append({'session_id': session.id, 'config_id': config_id, 'status': 'synced'})
        else:
            failed += 1
            details.append({'session_id': session.id, 'status': 'failed'})

    return jsonify({
        'message': f'{synced} sincronizadas, {failed} fallidas de {len(unsynced)} pendientes',
        'synced': synced,
        'failed': failed,
        'total': len(unsynced),
        'details': details,
    })


# ─── Endpoints SOAP ADWebService ─────────────────────────────────────

@bp.route('/soap-health', methods=['GET'])
@jwt_required()
def soap_health():
    """Verificar conexión al SOAP ADWebService (solo admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.ad_soap_service import test_soap_connection
        return jsonify(test_soap_connection())
    except Exception as e:
        return jsonify({'connected': False, 'error': str(e)}), 503


@bp.route('/soap-users', methods=['GET'])
@jwt_required()
def soap_users():
    """
    Obtener usuarios AD creados por el EXE legacy (solo admin).
    Estos son los usuarios que pueden conectar a VDIs vía Guacamole.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.ad_soap_service import get_users
        users = get_users()
        return jsonify({'users': users, 'total': len(users)})
    except Exception as e:
        logger.error(f"Error SOAP GetUsers: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/soap-applications/<username>', methods=['GET'])
@jwt_required()
def soap_applications(username):
    """
    Obtener aplicaciones disponibles para un usuario AD (solo admin).
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.ad_soap_service import get_applications
        apps = get_applications(username)
        return jsonify({'username': username, 'applications': apps})
    except Exception as e:
        logger.error(f"Error SOAP GetApplications para {username}: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/soap-horarios', methods=['GET'])
@jwt_required()
def soap_horarios():
    """Obtener horarios por equipo desde SOAP (solo admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.ad_soap_service import get_horarios
        horarios = get_horarios()
        return jsonify({'horarios': horarios, 'total': len(horarios)})
    except Exception as e:
        logger.error(f"Error SOAP ObtenerHorarios: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/soap-mark-completed', methods=['POST'])
@jwt_required()
def soap_mark_completed():
    """
    Marcar un usuario como completado en AD (solo admin).
    Body: { "subsistema_id": int, "plantel_id": int, "username": str }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Datos requeridos'}), 400

    sub_id = data.get('subsistema_id')
    plan_id = data.get('plantel_id')
    username = data.get('username')

    if not all([sub_id, plan_id, username]):
        return jsonify({'error': 'subsistema_id, plantel_id y username son requeridos'}), 400

    try:
        from app.services.ad_soap_service import mark_completed
        result = mark_completed(int(sub_id), int(plan_id), username)
        return jsonify({'success': result, 'username': username})
    except Exception as e:
        logger.error(f"Error SOAP MarkCompleted para {username}: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/soap-completed-users', methods=['GET'])
@jwt_required()
def soap_completed_users():
    """Obtener usuarios AD marcados como completados (solo admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.ad_soap_service import get_completed_users
        users = get_completed_users()
        return jsonify({'users': users, 'total': len(users)})
    except Exception as e:
        logger.error(f"Error SOAP GetCompletedUsers: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/soap-expired-users', methods=['GET'])
@jwt_required()
def soap_expired_users():
    """Obtener usuarios AD expirados (solo admin)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    try:
        from app.services.ad_soap_service import get_expired_users
        users = get_expired_users()
        return jsonify({'users': users, 'total': len(users)})
    except Exception as e:
        logger.error(f"Error SOAP GetExpiredUsers: {e}")
        return jsonify({'error': str(e)}), 503


@bp.route('/capacity-report', methods=['GET'])
@jwt_required()
def capacity_report():
    """
    Reporte de capacidad y utilización de VDIs (solo admin).
    
    Query params:
      - date_from (YYYY-MM-DD, default: hoy)
      - date_to (YYYY-MM-DD, default: hoy + 7 días)
    
    Returns:
      - Resumen por día: sesiones totales, pico, utilización.
      - Resumen por VDI: cuántas sesiones tuvo cada VDI.
      - Resumen por hora: distribución por hora del día.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Acceso denegado'}), 403

    date_from_str = request.args.get('date_from')
    date_to_str = request.args.get('date_to')
    today = date.today()

    try:
        date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date() if date_from_str else today
        date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date() if date_to_str else today + timedelta(days=7)
    except ValueError:
        date_from = today
        date_to = today + timedelta(days=7)

    # Sesiones del rango (de nuestra DB)
    sessions = VmSession.query.filter(
        VmSession.session_date >= date_from,
        VmSession.session_date <= date_to,
    ).all()

    max_concurrent = _get_max_concurrent_sessions()

    # Resumen por día
    daily = {}
    for s in sessions:
        day_key = s.session_date.isoformat()
        if day_key not in daily:
            daily[day_key] = {'scheduled': 0, 'completed': 0, 'cancelled': 0, 'no_show': 0, 'total': 0}
        daily[day_key][s.status] = daily[day_key].get(s.status, 0) + 1
        daily[day_key]['total'] += 1

    # Resumen por hora
    hourly = {}
    for s in sessions:
        if s.status == 'scheduled':
            h = s.start_hour
            hourly[h] = hourly.get(h, 0) + 1

    # Pico: hora con más sesiones simultáneas por día
    peak_by_day = {}
    for s in sessions:
        if s.status in ('scheduled', 'completed'):
            day_key = s.session_date.isoformat()
            if day_key not in peak_by_day:
                peak_by_day[day_key] = {}
            h = s.start_hour
            peak_by_day[day_key][h] = peak_by_day[day_key].get(h, 0) + 1

    peak_utilization = 0
    for day_hours in peak_by_day.values():
        if day_hours:
            day_peak = max(day_hours.values())
            utilization = (day_peak / max_concurrent * 100) if max_concurrent > 0 else 0
            peak_utilization = max(peak_utilization, utilization)

    # Resumen por VDI
    vdi_usage = {}
    for s in sessions:
        if s.workstation_name:
            vdi_usage[s.workstation_name] = vdi_usage.get(s.workstation_name, 0) + 1

    return jsonify({
        'date_from': date_from.isoformat(),
        'date_to': date_to.isoformat(),
        'total_sessions': len(sessions),
        'max_concurrent_vdis': max_concurrent,
        'peak_utilization_pct': round(peak_utilization, 1),
        'daily_summary': [
            {'date': k, **v} for k, v in sorted(daily.items())
        ],
        'hourly_distribution': [
            {'hour': h, 'label': f'{h:02d}:00', 'count': c}
            for h, c in sorted(hourly.items())
        ],
        'vdi_usage': [
            {'workstation': k, 'sessions': v}
            for k, v in sorted(vdi_usage.items(), key=lambda x: -x[1])
        ],
    })


# ─── Conexión a VDI (Guacamole SSO) ─────────────────────────────────

@bp.route('/sessions/<int:session_id>/connect', methods=['POST'])
@jwt_required()
def connect_to_vdi(session_id):
    """
    Obtener URL de acceso directo a Guacamole para una sesión VDI.
    Autentica contra Guacamole REST API usando las credenciales AD del candidato
    y devuelve una URL con token SSO.

    Solo el candidato dueño de la sesión, responsable del plantel, o admin pueden usar este endpoint.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    session = VmSession.query.get(session_id)
    if not session:
        return jsonify({'error': 'Sesión no encontrada'}), 404

    if session.status != 'scheduled':
        return jsonify({'error': 'Solo se puede conectar a sesiones programadas'}), 400

    # Verificar permisos: candidato dueño, responsable del plantel, o admin
    if user.role == 'candidato' and session.user_id != str(user_id):
        return jsonify({'error': 'Solo puedes conectarte a tus propias sesiones'}), 403
    elif user.role == 'responsable':
        if not user.campus_id or session.campus_id != user.campus_id:
            return jsonify({'error': 'Solo puedes conectar sesiones de tu plantel'}), 403
    elif user.role == 'coordinator':
        return jsonify({'error': 'Coordinadores no pueden iniciar conexiones VDI'}), 403
    elif user.role not in ['admin', 'developer', 'candidato', 'responsable']:
        return jsonify({'error': 'Acceso denegado'}), 403

    # Verificar que la sesión tiene workstation asignada
    if not session.workstation_name:
        return jsonify({
            'error': 'La sesión no tiene una VDI asignada. Contacta a soporte.',
        }), 400

    # Obtener usuario de la sesión
    target_user = User.query.get(session.user_id)
    if not target_user:
        return jsonify({'error': 'Usuario de la sesión no encontrado'}), 404

    # Obtener URL de Guacamole
    import requests as http_requests
    GUACAMOLE_URL = os.environ.get('GUACAMOLE_URL', 'https://evapub2024.evaluaasi.info')

    # --- Paso 1: Provisionar usuario AD via LDAP (si está disponible) ---
    password = session.ad_password  # Reusar contraseña guardada
    ad_provisioned = False
    try:
        from app.services.ad_management_service import provision_ad_for_session, AD_CONFIG
        if AD_CONFIG.get('password'):
            ad_result = provision_ad_for_session(session, target_user, ad_password=password)
            if ad_result:
                password = ad_result['password']
                if not session.ad_password or session.ad_password != password:
                    session.ad_password = password
                    db.session.commit()
                ad_provisioned = True
                logger.info(f"AD provisioned for session {session_id}: action={ad_result.get('action')}")
    except Exception as e:
        logger.warning(f"AD provisioning no disponible para sesión {session_id}: {e}")

    # Fallback: decrypt_password legacy
    if not password:
        try:
            from app.models.user import decrypt_password as decrypt_pw
            password = decrypt_pw(target_user.encrypted_password)
        except Exception:
            pass

    # Sincronizar a EvaluaasiConfig si no se ha hecho
    if not session.config_session_id:
        try:
            _sync_session_to_config(session, target_user)
        except Exception as e:
            logger.warning(f"Sync to EvaluaasiConfig failed during connect: {e}")

    # --- Paso 2: Intentar SSO con Guacamole (timeout corto: 5s) ---
    if password:
        try:
            resp = http_requests.post(
                f'{GUACAMOLE_URL}/api/tokens',
                data={'username': target_user.username, 'password': password},
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=5,
                verify=True,
            )

            if resp.status_code == 200:
                token_data = resp.json()
                auth_token = token_data.get('authToken')
                if auth_token:
                    connect_url = f'{GUACAMOLE_URL}/#/?token={auth_token}'
                    logger.info(
                        f"Conexión VDI exitosa: session={session_id}, user={target_user.username}, "
                        f"workstation={session.workstation_name}"
                    )
                    return jsonify({
                        'connect_url': connect_url,
                        'guacamole_url': GUACAMOLE_URL,
                        'workstation_name': session.workstation_name,
                        'message': 'Conexión lista. Se abrirá en una nueva pestaña.',
                    })
        except (http_requests.Timeout, http_requests.ConnectionError):
            logger.info(f"Guacamole SSO no alcanzable para sesión {session_id}, usando acceso directo")
        except Exception as e:
            logger.warning(f"Error Guacamole SSO: {e}")

    # --- Paso 3: Respuesta inmediata con acceso directo ---
    # Si SSO no funcionó, devolver la URL de Guacamole para acceso manual
    logger.info(
        f"Acceso directo VDI: session={session_id}, user={target_user.username}, "
        f"workstation={session.workstation_name}, ad_provisioned={ad_provisioned}"
    )
    return jsonify({
        'connect_url': GUACAMOLE_URL,
        'guacamole_url': GUACAMOLE_URL,
        'workstation_name': session.workstation_name,
        'fallback_url': GUACAMOLE_URL,
        'fallback_username': target_user.username,
        'message': f'Accede a Guacamole con tu usuario: {target_user.username}',
        'ad_provisioned': ad_provisioned,
    })


@bp.route('/guacamole-check', methods=['GET'])
@jwt_required()
def guacamole_connectivity_check():
    """Check connectivity from Container App to Guacamole server"""
    user = User.query.get(get_jwt_identity())
    if not user or user.role not in ['admin', 'developer']:
        return jsonify({'error': 'Solo admin/developer'}), 403

    import requests as http_requests
    import socket
    import time

    GUACAMOLE_URL = os.environ.get('GUACAMOLE_URL', 'https://evapub2024.evaluaasi.info')
    host = GUACAMOLE_URL.replace('https://', '').replace('http://', '').split('/')[0]
    results = {}

    # 1. DNS resolution
    try:
        ip = socket.gethostbyname(host)
        results['dns'] = {'ok': True, 'ip': ip}
    except Exception as e:
        results['dns'] = {'ok': False, 'error': str(e)}
        return jsonify({'guacamole_url': GUACAMOLE_URL, 'results': results}), 200

    # 2. TCP port 443
    try:
        start = time.time()
        sock = socket.create_connection((ip, 443), timeout=10)
        elapsed = round((time.time() - start) * 1000)
        sock.close()
        results['tcp_443'] = {'ok': True, 'latency_ms': elapsed}
    except Exception as e:
        results['tcp_443'] = {'ok': False, 'error': str(e)}
        return jsonify({'guacamole_url': GUACAMOLE_URL, 'results': results}), 200

    # 3. HTTPS GET (just check if web server responds)
    try:
        start = time.time()
        resp = http_requests.get(GUACAMOLE_URL, timeout=15, verify=True, allow_redirects=True)
        elapsed = round((time.time() - start) * 1000)
        results['https'] = {'ok': True, 'status_code': resp.status_code, 'latency_ms': elapsed}
    except Exception as e:
        results['https'] = {'ok': False, 'error': str(e)}

    # 4. Guacamole API test (invalid creds = 403 means API is reachable)
    try:
        start = time.time()
        resp = http_requests.post(
            f'{GUACAMOLE_URL}/api/tokens',
            data={'username': 'connectivity_test', 'password': 'test'},
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15, verify=True,
        )
        elapsed = round((time.time() - start) * 1000)
        results['guacamole_api'] = {
            'ok': resp.status_code in [200, 403],
            'status_code': resp.status_code,
            'latency_ms': elapsed,
            'reachable': True,
        }
    except Exception as e:
        results['guacamole_api'] = {'ok': False, 'error': str(e)}

    return jsonify({'guacamole_url': GUACAMOLE_URL, 'results': results}), 200
