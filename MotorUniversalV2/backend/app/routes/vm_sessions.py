"""
Endpoints para gestión de sesiones de máquinas virtuales.

Roles permitidos:
  - candidato: solo ve/crea/cancela sesiones propias (si su grupo tiene VMs habilitadas)
  - admin: ve/crea/cancela sesiones de cualquier campus
  - coordinator: ve/crea/cancela sesiones de sus campuses
"""
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.vm_session import VmSession
from app.models.partner import CandidateGroup, GroupMember, Campus

bp = Blueprint('vm_sessions', __name__)


def get_candidate_vm_context(user_id):
    """Obtener campus_id y group_id del candidato, y verificar que VMs estén habilitadas."""
    membership = GroupMember.query.filter_by(
        user_id=str(user_id),
        status='active'
    ).first()
    
    if not membership:
        return None, None, False
    
    group = CandidateGroup.query.get(membership.group_id)
    if not group or not group.campus:
        return None, None, False
    
    campus = group.campus
    
    # Verificar config efectiva: grupo override → campus
    vm_enabled = False
    if group.enable_virtual_machines_override is not None:
        vm_enabled = group.enable_virtual_machines_override
    elif campus.enable_virtual_machines is not None:
        vm_enabled = campus.enable_virtual_machines
    
    return campus.id, group.id, vm_enabled


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
        campus_id, group_id, vm_enabled = get_candidate_vm_context(user_id)
        return jsonify({
            'has_access': vm_enabled,
            'role': user.role,
            'scope': 'self',
            'campus_id': campus_id,
            'group_id': group_id,
        })
    
    if user.role == 'responsable' and user.campus_id:
        campus = Campus.query.get(user.campus_id)
        vm_enabled = campus.enable_virtual_machines if campus else False
        return jsonify({
            'has_access': vm_enabled,
            'role': user.role,
            'scope': 'self',
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
        campus_id, group_id, vm_enabled = get_candidate_vm_context(user_id)
        if not vm_enabled:
            return jsonify({'error': 'Máquinas virtuales no habilitadas para tu grupo'}), 403
        query = query.filter(VmSession.campus_id == campus_id)
    elif user.role == 'responsable' and user.campus_id:
        campus = Campus.query.get(user.campus_id)
        if not campus or not campus.enable_virtual_machines:
            return jsonify({'error': 'Máquinas virtuales no habilitadas para tu plantel'}), 403
        query = query.filter(VmSession.campus_id == user.campus_id)
    else:
        return jsonify({'error': 'Acceso denegado'}), 403
    
    sessions = query.order_by(
        VmSession.session_date.asc(),
        VmSession.start_hour.asc()
    ).all()
    
    return jsonify({
        'sessions': [s.to_dict(include_user=user.role in ['admin', 'coordinator']) for s in sessions],
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
        campus_id, group_id, vm_enabled = get_candidate_vm_context(user_id)
        if not vm_enabled:
            return jsonify({'error': 'Máquinas virtuales no habilitadas para tu grupo'}), 403
        target_user_id = user_id
        target_campus_id = campus_id
        target_group_id = group_id
    
    elif user.role == 'responsable' and user.campus_id:
        campus = Campus.query.get(user.campus_id)
        if not campus or not campus.enable_virtual_machines:
            return jsonify({'error': 'Máquinas virtuales no habilitadas para tu plantel'}), 403
        target_user_id = user_id
        target_campus_id = user.campus_id
        membership = GroupMember.query.filter_by(user_id=str(user_id), status='active').first()
        target_group_id = membership.group_id if membership else None
        
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
    
    # --- Validación anti-empalme ---
    existing = VmSession.query.filter_by(
        campus_id=target_campus_id,
        session_date=session_date,
        start_hour=start_hour,
        status='scheduled'
    ).first()
    
    if existing:
        return jsonify({
            'error': 'Este horario ya está reservado. Selecciona otro horario disponible.',
            'conflict': existing.to_dict()
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
    except Exception as e:
        db.session.rollback()
        if 'uq_vm_session_slot' in str(e).lower() or 'unique' in str(e).lower():
            return jsonify({
                'error': 'Este horario ya fue reservado por otro usuario.'
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
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/available-slots', methods=['GET'])
@jwt_required()
def get_available_slots():
    """
    Obtener horarios disponibles para un campus y fecha.
    
    Query params:
      - campus_id (required)
      - date (YYYY-MM-DD, required)
      - operating_hours_start (default: 8)
      - operating_hours_end (default: 20)
    
    Retorna las horas del día que NO están ocupadas.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    campus_id = request.args.get('campus_id', type=int)
    date_str = request.args.get('date')
    hours_start = request.args.get('operating_hours_start', 8, type=int)
    hours_end = request.args.get('operating_hours_end', 20, type=int)
    
    if not campus_id or not date_str:
        return jsonify({'error': 'campus_id y date son requeridos'}), 400
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido'}), 400
    
    # Para candidatos, verificar acceso
    if user.role == 'candidato':
        c_campus_id, _, vm_enabled = get_candidate_vm_context(user_id)
        if not vm_enabled or c_campus_id != campus_id:
            return jsonify({'error': 'Sin acceso a este campus'}), 403
    
    # Obtener horas ocupadas (con detalles para admin/coordinator)
    show_details = user.role in ['admin', 'developer', 'coordinator']
    
    if show_details:
        occupied_sessions = VmSession.query.filter(
            VmSession.campus_id == campus_id,
            VmSession.session_date == target_date,
            VmSession.status == 'scheduled',
        ).all()
        occupied_hours = {s.start_hour for s in occupied_sessions}
        occupied_details = {}
        for s in occupied_sessions:
            occupied_details[s.start_hour] = {
                'session_id': s.id,
                'user_name': s.user.full_name if s.user else 'Desconocido',
                'user_email': s.user.email if s.user else '',
                'user_role': s.user.role if s.user else '',
                'group_name': s.group.name if s.group else None,
                'campus_name': s.campus.name if s.campus else None,
                'notes': s.notes,
                'created_at': s.created_at.isoformat() if s.created_at else None,
            }
    else:
        occupied = db.session.query(VmSession.start_hour).filter(
            VmSession.campus_id == campus_id,
            VmSession.session_date == target_date,
            VmSession.status == 'scheduled',
        ).all()
        occupied_hours = {row.start_hour for row in occupied}
        occupied_details = {}
    
    # Generar slots disponibles
    now = datetime.utcnow()
    slots = []
    for hour in range(hours_start, hours_end):
        is_past = (target_date < now.date()) or (target_date == now.date() and hour <= now.hour)
        is_occupied = hour in occupied_hours
        
        slot_data = {
            'hour': hour,
            'label': f'{hour:02d}:00 - {hour + 1:02d}:00',
            'available': not is_occupied and not is_past,
            'is_past': is_past,
            'is_occupied': is_occupied,
        }
        
        # Incluir detalles de quién ocupa el slot para admin/coordinator
        if is_occupied and hour in occupied_details:
            slot_data['occupied_by'] = occupied_details[hour]
        
        slots.append(slot_data)
    
    return jsonify({
        'campus_id': campus_id,
        'date': target_date.isoformat(),
        'slots': slots,
        'total_available': sum(1 for s in slots if s['available']),
        'total_occupied': len(occupied_hours),
    })
