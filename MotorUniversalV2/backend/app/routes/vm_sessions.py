"""
Endpoints para gestión de sesiones de máquinas virtuales.

Roles permitidos:
  - candidato: solo ve/crea/cancela sesiones propias (si su grupo lo permite)
  - responsable: ve/crea sesiones de candidatos en su plantel (según modo del grupo)
  - admin/coordinator: ve/crea/cancela sesiones de cualquier campus

LÍMITE GLOBAL: máximo 4 sesiones simultáneas en el mismo (date, hour) en toda la plataforma.
"""
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import HTTPException
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.vm_session import VmSession
from app.models.partner import CandidateGroup, GroupMember, Campus, GroupExam

bp = Blueprint('vm_sessions', __name__)

MAX_CONCURRENT_SESSIONS = 4

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
        
    elif user.role in ['admin', 'coordinator']:
        target_user_id = data.get('user_id', user_id)
        target_campus_id = data.get('campus_id')
        
        if not target_campus_id:
            return jsonify({'error': 'campus_id es requerido para admin/coordinator'}), 400
        
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
    
    # --- Validación: límite global de 4 sesiones simultáneas ---
    global_count = _get_global_slot_count(session_date, start_hour)
    if global_count >= MAX_CONCURRENT_SESSIONS:
        return jsonify({
            'error': f'Se alcanzó el límite de {MAX_CONCURRENT_SESSIONS} sesiones simultáneas en este horario. Selecciona otro horario.',
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
    
    # Crear sesión
    session = VmSession(
        user_id=str(target_user_id),
        campus_id=target_campus_id,
        group_id=target_group_id,
        session_date=session_date,
        start_hour=start_hour,
        status='scheduled',
        notes=data.get('notes'),
        created_by_id=str(user_id),
    )
    
    try:
        db.session.add(session)
        db.session.commit()
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
    Actualizar estado de una sesión (solo admin/coordinator).
    Body: { "status": "completed" | "no_show" }
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user or user.role not in ['admin', 'developer', 'coordinator']:
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
    Límite global: MAX_CONCURRENT_SESSIONS sesiones simultáneas.

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

    now = datetime.utcnow()
    slots = []
    for hour in range(hours_start, hours_end):
        is_past = (target_date < now.date()) or (target_date == now.date() and hour <= now.hour)
        count = hour_counts.get(hour, 0)

        slot_data = {
            'hour': hour,
            'label': f'{hour:02d}:00 - {hour + 1:02d}:00',
            'available': count < MAX_CONCURRENT_SESSIONS and not is_past,
            'is_past': is_past,
            'global_count': count,
            'max_sessions': MAX_CONCURRENT_SESSIONS,
            'remaining': max(0, MAX_CONCURRENT_SESSIONS - count),
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
    available_slots = []
    cur = date_from
    now = datetime.utcnow()
    while cur <= date_to:
        if cur.weekday() < 5:
            for h in range(hours_start, hours_end):
                if cur > now.date() or (cur == now.date() and h > now.hour):
                    remaining = MAX_CONCURRENT_SESSIONS - _get_global_slot_count(cur, h)
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

    for s in sessions_data:
        try:
            s_date = datetime.strptime(s['session_date'], '%Y-%m-%d').date()
            s_hour = int(s['start_hour'])
            s_user_id = s['user_id']

            if _get_global_slot_count(s_date, s_hour) >= MAX_CONCURRENT_SESSIONS:
                errors.append({'user_id': s_user_id, 'error': f'Slot {s_date} {s_hour}:00 lleno'})
                continue

            existing = VmSession.query.filter_by(
                user_id=str(s_user_id), session_date=s_date,
                start_hour=s_hour, status='scheduled'
            ).first()
            if existing:
                errors.append({'user_id': s_user_id, 'error': f'Ya tiene sesión en {s_date} {s_hour}:00'})
                continue

            session = VmSession(
                user_id=str(s_user_id),
                campus_id=user.campus_id,
                group_id=group_id,
                session_date=s_date,
                start_hour=s_hour,
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
        return jsonify({
            'message': f'{len(created)} sesiones creadas',
            'created': [ses.to_dict() for ses in created],
            'errors': errors,
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
