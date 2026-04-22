"""
Blueprint para integración VB6 → MotorV2.

Endpoints REST que reemplazan los SOAP del legacy server.
Las apps VB6 (en VDI o local) llaman estos endpoints para:
  - Autenticarse (login → token)
  - Verificar versión de la app
  - Verificar si tienen agenda activa (schedule-check)
  - Iniciar sesión de evaluación
  - Subir respuestas detalladas
  - Finalizar evaluación con score

Autenticación: Token simple (X-VB6-Token) — VB6 no maneja JWT.
"""
import json
import logging
from datetime import datetime, date, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User
from app.models.vm_session import VmSession
from app.models.partner import CandidateGroup, GroupMember, Campus
from app.models.office_exam import OfficeExamResult, Vb6SessionToken, OfficeAppVersion

logger = logging.getLogger(__name__)

bp = Blueprint('vb6', __name__)


# ─── Auth decorator ─────────────────────────────────────────────────

def vb6_token_required(f):
    """Decorator que valida X-VB6-Token header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token_id = request.headers.get('X-VB6-Token')
        if not token_id:
            return jsonify({'success': False, 'error': 'Token requerido', 'code': 'NO_TOKEN'}), 401
        
        token = Vb6SessionToken.query.get(token_id)
        if not token or not token.is_valid():
            return jsonify({'success': False, 'error': 'Token inválido o expirado', 'code': 'INVALID_TOKEN'}), 401
        
        user = User.query.get(token.user_id)
        if not user or not user.is_active:
            return jsonify({'success': False, 'error': 'Usuario inactivo', 'code': 'USER_INACTIVE'}), 401
        
        # Inject user and token into kwargs
        kwargs['vb6_user'] = user
        kwargs['vb6_token'] = token
        return f(*args, **kwargs)
    return decorated


# ─── Helper: resolve candidate context ──────────────────────────────

def _get_candidate_context(user_id):
    """Obtener campus, grupo y config del candidato."""
    membership = GroupMember.query.filter_by(
        user_id=str(user_id), status='active'
    ).first()
    
    if not membership:
        return None, None, None, None
    
    group = CandidateGroup.query.get(membership.group_id)
    if not group or not group.campus:
        return None, None, None, None
    
    campus = group.campus
    
    # Resolve effective config
    def _eff(group_override, campus_val, default=False):
        if group_override is not None:
            return group_override
        if campus_val is not None:
            return campus_val
        return default
    
    config = {
        'enable_partial_evaluations': _eff(group.enable_partial_evaluations_override, campus.enable_partial_evaluations),
        'enable_unscheduled_partials': _eff(group.enable_unscheduled_partials_override, campus.enable_unscheduled_partials),
        'enable_office_exams': _eff(group.enable_office_exams_override, campus.enable_office_exams),
        'enable_office_simulators': _eff(group.enable_office_simulators_override, campus.enable_office_simulators),
        'enable_session_calendar': _eff(group.enable_session_calendar_override, campus.enable_session_calendar),
        'session_scheduling_mode': group.session_scheduling_mode_override or campus.session_scheduling_mode or 'leader_only',
        'office_version': group.office_version_override or campus.office_version or 'office_365',
    }
    
    return campus, group, membership, config


def _find_active_vm_session(user_id, session_type=None):
    """Buscar VmSession activa (scheduled/in_progress) para hoy."""
    today = date.today()
    now_hour = datetime.utcnow().hour
    
    query = VmSession.query.filter(
        VmSession.user_id == str(user_id),
        VmSession.session_date == today,
        VmSession.status.in_(['scheduled', 'in_progress']),
    )
    
    if session_type:
        query = query.filter(VmSession.session_type == session_type)
    
    # Buscar sesiones cuya ventana incluya la hora actual
    sessions = query.order_by(VmSession.start_hour.asc()).all()
    
    for s in sessions:
        end_h = s.end_hour if s.end_hour is not None else s.start_hour + 1
        if s.start_hour <= now_hour < end_h:
            return s
    
    # Si no hay una que cubra "ahora", retornar la más próxima de hoy
    for s in sessions:
        if s.start_hour >= now_hour:
            return s
    
    return sessions[0] if sessions else None


# ═══════════════════════════════════════════════════════════════════
# 1. LOGIN
# ═══════════════════════════════════════════════════════════════════

@bp.route('/login', methods=['POST'])
def vb6_login():
    """
    Login desde VB6.
    Reemplaza: Usuario.asmx/Login, SimuladorWebService.asmx/Login
    
    Body:
      - username, password (required)
      - mode: examen|simulador|competencia (default: examen)
      - office_app: excel|word|powerpoint
      - office_version, app_version, ip, mac, pc_name (optional telemetry)
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Datos requeridos', 'code': 'NO_DATA'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Usuario y contraseña requeridos', 'code': 'MISSING_CREDENTIALS'}), 400
    
    # Autenticar
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User.query.filter_by(email=username).first()
    
    if not user or not user.check_password(password):
        return jsonify({'success': False, 'error': 'Credenciales inválidas', 'code': 'INVALID_CREDENTIALS'}), 401
    
    if not user.is_active:
        return jsonify({'success': False, 'error': 'Usuario inactivo', 'code': 'USER_INACTIVE'}), 401
    
    # Contexto del candidato
    campus, group, membership, config = _get_candidate_context(user.id)
    
    mode = data.get('mode', 'examen')
    
    # Buscar VmSession activa
    vm_session = _find_active_vm_session(user.id, session_type=mode if mode != 'competencia' else 'examen')
    
    # Crear token VB6
    token = Vb6SessionToken(
        user_id=str(user.id),
        vm_session_id=vm_session.id if vm_session else None,
        session_type=mode,
        ip_address=data.get('ip') or request.remote_addr,
    )
    db.session.add(token)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'token': token.id,
        'user_id': user.id,
        'username': user.username,
        'full_name': user.full_name,
        'campus_id': campus.id if campus else None,
        'group_id': group.id if group else None,
        'vm_session_id': vm_session.id if vm_session else None,
        'config': {
            'passing_score': 400 if mode != 'parcial' else 700,
            'max_questions': 30,
            'duration_minutes': 50,
            'office_version': config.get('office_version') if config else None,
        }
    })


@bp.route('/parcial/login', methods=['POST'])
def vb6_parcial_login():
    """
    Login para parciales.
    Reemplaza: ParcialesWebService.asmx/IniciarSesion
    
    Body:
      - username, password (required)
      - office_version, app_version (optional)
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Datos requeridos', 'code': 'NO_DATA'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({'success': False, 'error': 'Credenciales requeridas', 'code': 'MISSING_CREDENTIALS'}), 400
    
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User.query.filter_by(email=username).first()
    
    if not user or not user.check_password(password):
        return jsonify({'success': False, 'error': 'Credenciales inválidas', 'code': 'INVALID_CREDENTIALS'}), 401
    
    if not user.is_active:
        return jsonify({'success': False, 'error': 'Usuario inactivo', 'code': 'USER_INACTIVE'}), 401
    
    campus, group, membership, config = _get_candidate_context(user.id)
    
    # Buscar VmSession activa de tipo parcial
    vm_session = _find_active_vm_session(user.id, session_type='parcial')
    
    # Buscar resultados previos de parcial para saber progreso
    completed_sessions = []
    prev_results = OfficeExamResult.query.filter_by(
        user_id=str(user.id),
        session_type='parcial',
        status='completed',
    ).all()
    for r in prev_results:
        if r.parcial_session_number:
            completed_sessions.append(str(r.parcial_session_number))
    
    # Sesiones asignadas desde la agenda VmSession (parcial_units)
    assigned = ''
    if vm_session and vm_session.parcial_units:
        assigned = vm_session.parcial_units
    
    # Crear token VB6
    token = Vb6SessionToken(
        user_id=str(user.id),
        vm_session_id=vm_session.id if vm_session else None,
        session_type='parcial',
        ip_address=data.get('ip') or request.remote_addr,
    )
    db.session.add(token)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'token': token.id,
        'user_id': user.id,
        'calendario_id': vm_session.id if vm_session else None,
        'assigned_sessions': assigned,
        'sesiones_completadas': ','.join(completed_sessions),
        'total_sesiones': 17,
        'config': {
            'passing_score': 700,
            'office_version': config.get('office_version') if config else None,
        }
    })


# ═══════════════════════════════════════════════════════════════════
# 2. VERSION CHECK
# ═══════════════════════════════════════════════════════════════════

@bp.route('/verify', methods=['POST'])
def vb6_verify():
    """
    Verificar versión de la app VB6.
    Reemplaza: AdminTools.asmx/VerificarExamen, VerificarSimulador, VerificarParcial
    """
    data = request.get_json()
    if not data:
        return jsonify({'update_required': False})
    
    app_name = data.get('app_name', '')
    current_version = data.get('current_version', '')
    
    app_record = OfficeAppVersion.query.filter_by(
        app_name=app_name, is_active=True
    ).first()
    
    if not app_record or not app_record.min_version:
        return jsonify({
            'update_required': False,
            'latest_version': current_version,
            'download_url': None,
            'message': None,
        })
    
    update_required = current_version < app_record.min_version if current_version else True
    
    return jsonify({
        'update_required': update_required,
        'latest_version': app_record.latest_version or app_record.min_version,
        'download_url': app_record.download_url if update_required else None,
        'message': f'Actualización requerida: {app_record.latest_version}' if update_required else None,
    })


# ═══════════════════════════════════════════════════════════════════
# 3. SCHEDULE CHECK (para VB6: ¿qué tiene habilitado el candidato?)
# ═══════════════════════════════════════════════════════════════════

@bp.route('/schedule-check', methods=['GET'])
@vb6_token_required
def vb6_schedule_check(vb6_user, vb6_token):
    """
    Verificar qué evaluaciones tiene habilitadas el candidato en este momento.
    El VB6 llama esto al iniciar para saber qué botones habilitar.
    
    Retorna las agendas activas AHORA para este usuario.
    """
    campus, group, membership, config = _get_candidate_context(vb6_user.id)
    
    if not config:
        return jsonify({
            'success': True,
            'active_schedules': [],
            'config': {},
        })
    
    today = date.today()
    now_hour = datetime.utcnow().hour
    
    # Buscar sesiones locales agendadas para hoy que cubran la hora actual
    active_sessions = VmSession.query.filter(
        VmSession.user_id == str(vb6_user.id),
        VmSession.session_date == today,
        VmSession.is_local == True,
        VmSession.status.in_(['scheduled', 'in_progress']),
    ).all()
    
    schedules = []
    for s in active_sessions:
        end_h = s.end_hour if s.end_hour is not None else s.start_hour + 1
        if s.start_hour <= now_hour < end_h:
            schedules.append({
                'session_id': s.id,
                'session_type': s.session_type,
                'office_app': s.office_app,
                'level': s.level,
                'parcial_units': s.parcial_units,
                'start_hour': s.start_hour,
                'end_hour': end_h,
            })
    
    # Parciales sin agendar: siempre habilitados si config lo permite
    parciales_libre = config.get('enable_partial_evaluations') and config.get('enable_unscheduled_partials')
    
    return jsonify({
        'success': True,
        'active_schedules': schedules,
        'parciales_libre': parciales_libre,
        'config': {
            'enable_partial_evaluations': config.get('enable_partial_evaluations', False),
            'enable_unscheduled_partials': config.get('enable_unscheduled_partials', False),
            'enable_office_exams': config.get('enable_office_exams', False),
            'enable_office_simulators': config.get('enable_office_simulators', False),
            'office_version': config.get('office_version'),
        }
    })


# ═══════════════════════════════════════════════════════════════════
# 4. START SESSION
# ═══════════════════════════════════════════════════════════════════

@bp.route('/start', methods=['POST'])
@vb6_token_required
def vb6_start(vb6_user, vb6_token):
    """
    Iniciar sesión de evaluación.
    Reemplaza: Usuario.asmx/Inicio, SimuladorWebService.asmx/Inicio
    
    Body:
      - session_type: examen|simulador|competencia
      - office_app: excel|word|powerpoint
      - office_version, level, voucher_code (optional)
    """
    data = request.get_json() or {}
    
    session_type = data.get('session_type', vb6_token.session_type or 'examen')
    office_app = data.get('office_app', 'excel')
    
    if office_app not in ('excel', 'word', 'powerpoint'):
        return jsonify({'success': False, 'error': 'office_app inválido'}), 400
    
    # Verificar que no hay otra evaluación in_progress
    existing = OfficeExamResult.query.filter_by(
        user_id=str(vb6_user.id),
        status='in_progress',
    ).first()
    
    if existing:
        # Retornar la existente en vez de crear nueva
        return jsonify({
            'success': True,
            'result_id': existing.id,
            'resumed': True,
            'started_at': existing.started_at.isoformat() if existing.started_at else None,
            'config': {
                'total_questions': existing.total_questions or 30,
                'passing_score': existing.passing_score or 400,
                'duration_minutes': 50,
            }
        })
    
    campus, group, membership, config = _get_candidate_context(vb6_user.id)
    
    # Crear OfficeExamResult
    result = OfficeExamResult(
        user_id=str(vb6_user.id),
        vm_session_id=vb6_token.vm_session_id,
        campus_id=campus.id if campus else None,
        group_id=group.id if group else None,
        session_type=session_type,
        office_app=office_app,
        office_version=data.get('office_version') or (config.get('office_version') if config else None),
        level=data.get('level'),
        voucher_code=data.get('voucher_code'),
        passing_score=data.get('passing_score', 400),
        ip_address=data.get('ip') or request.remote_addr,
        mac_address=data.get('mac'),
        pc_name=data.get('pc_name'),
        app_version=data.get('app_version'),
        status='in_progress',
    )
    
    db.session.add(result)
    
    # Actualizar VmSession si existe
    if vb6_token.vm_session_id:
        vm_session = VmSession.query.get(vb6_token.vm_session_id)
        if vm_session and vm_session.status == 'scheduled':
            vm_session.status = 'in_progress'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'result_id': result.id,
        'started_at': result.started_at.isoformat(),
        'config': {
            'total_questions': 30,
            'passing_score': result.passing_score,
            'duration_minutes': 50,
        }
    }), 201


@bp.route('/parcial/start', methods=['POST'])
@vb6_token_required
def vb6_parcial_start(vb6_user, vb6_token):
    """
    Iniciar sesión de parcial individual.
    Reemplaza: ParcialesWebService.asmx/IniciarParcial
    
    Body:
      - session_number: 1-17
      - office_app: excel|word|powerpoint
      - calendario_id (optional)
    """
    data = request.get_json() or {}
    
    session_number = data.get('session_number')
    if not session_number or not isinstance(session_number, int) or session_number < 1 or session_number > 17:
        return jsonify({'success': False, 'error': 'session_number debe ser 1-17'}), 400
    
    office_app = data.get('office_app', 'excel')
    
    campus, group, membership, config = _get_candidate_context(vb6_user.id)
    
    result = OfficeExamResult(
        user_id=str(vb6_user.id),
        vm_session_id=vb6_token.vm_session_id,
        campus_id=campus.id if campus else None,
        group_id=group.id if group else None,
        session_type='parcial',
        office_app=office_app,
        office_version=data.get('office_version') or (config.get('office_version') if config else None),
        parcial_session_number=session_number,
        calendario_id=data.get('calendario_id'),
        passing_score=700,
        ip_address=request.remote_addr,
        app_version=data.get('app_version'),
        status='in_progress',
    )
    
    db.session.add(result)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'result_id': result.id,
        'session_number': session_number,
        'started_at': result.started_at.isoformat(),
    }), 201


# ═══════════════════════════════════════════════════════════════════
# 5. STORAGE (detailed answers)
# ═══════════════════════════════════════════════════════════════════

@bp.route('/storage', methods=['POST'])
@vb6_token_required
def vb6_storage(vb6_user, vb6_token):
    """
    Subir respuestas detalladas.
    Reemplaza: Storage.asmx/WebServiceStorage30
    
    Body:
      - result_id (required)
      - answers: [{scenario, question, result, description, category, time_spent}, ...]
      - partial_score (optional, calculated by VB6)
    """
    data = request.get_json() or {}
    
    result_id = data.get('result_id')
    if not result_id:
        return jsonify({'success': False, 'error': 'result_id requerido'}), 400
    
    result = OfficeExamResult.query.get(result_id)
    if not result or result.user_id != str(vb6_user.id):
        return jsonify({'success': False, 'error': 'Resultado no encontrado'}), 404
    
    if result.status != 'in_progress':
        return jsonify({'success': False, 'error': 'Evaluación no está en progreso'}), 400
    
    answers = data.get('answers', [])
    
    # Guardar respuestas como JSON
    result.answers_data = json.dumps(answers, ensure_ascii=False)
    
    # Calcular estadísticas server-side
    correct = sum(1 for a in answers if a.get('result') == 1)
    total = len(answers)
    result.total_questions = total
    result.correct_answers = correct
    
    # Score server-side: (correct / total) * 1000
    server_score = round((correct / total) * 1000) if total > 0 else 0
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'answers_received': total,
        'partial_score_server': server_score,
    })


# ═══════════════════════════════════════════════════════════════════
# 6. FINISH
# ═══════════════════════════════════════════════════════════════════

@bp.route('/finish', methods=['POST'])
@vb6_token_required
def vb6_finish(vb6_user, vb6_token):
    """
    Finalizar evaluación.
    Reemplaza: Usuario.asmx/Fin, SimuladorWebService.asmx/Final
    
    Body:
      - result_id (required)
      - score (0-1000)
      - correct_answers, total_questions
      - duration_seconds
      - voucher_code, expire_voucher (optional)
    """
    data = request.get_json() or {}
    
    result_id = data.get('result_id')
    if not result_id:
        return jsonify({'success': False, 'error': 'result_id requerido'}), 400
    
    result = OfficeExamResult.query.get(result_id)
    if not result or result.user_id != str(vb6_user.id):
        return jsonify({'success': False, 'error': 'Resultado no encontrado'}), 404
    
    if result.status != 'in_progress':
        return jsonify({'success': False, 'error': 'Evaluación no está en progreso'}), 400
    
    # Actualizar resultado
    score = data.get('score', 0)
    result.score = score
    result.correct_answers = data.get('correct_answers', result.correct_answers or 0)
    result.total_questions = data.get('total_questions', result.total_questions or 0)
    result.duration_seconds = data.get('duration_seconds')
    result.passed = score >= result.passing_score
    result.status = 'completed'
    result.finished_at = datetime.utcnow()
    
    # Voucher expiration
    if data.get('expire_voucher') and result.voucher_code:
        result.voucher_expired = True
    
    # Generar código de certificado si aprobó
    certificate_code = None
    if result.passed:
        date_str = datetime.utcnow().strftime('%Y%m%d')
        seq = OfficeExamResult.query.filter(
            OfficeExamResult.certificate_code.isnot(None),
            OfficeExamResult.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
        ).count() + 1
        certificate_code = f"OFC-{date_str}-{seq:03d}"
        result.certificate_code = certificate_code
    
    db.session.commit()
    
    # Marcar VmSession como completed si aplica
    if vb6_token.vm_session_id:
        vm_session = VmSession.query.get(vb6_token.vm_session_id)
        if vm_session and vm_session.status == 'in_progress':
            vm_session.status = 'completed'
            db.session.commit()
    
    # Invalidar token
    vb6_token.is_active = False
    db.session.commit()
    
    return jsonify({
        'success': True,
        'result_id': result.id,
        'score': result.score,
        'passed': result.passed,
        'passing_score': result.passing_score,
        'finished_at': result.finished_at.isoformat(),
        'certificate_code': certificate_code,
        'message': 'Examen aprobado' if result.passed else 'Examen no aprobado',
    })


@bp.route('/parcial/finish', methods=['POST'])
@vb6_token_required
def vb6_parcial_finish(vb6_user, vb6_token):
    """
    Finalizar sesión de parcial.
    Reemplaza: ParcialesWebService.asmx/FinalizarParcial
    
    Body:
      - result_id (required)
      - session_number: 1-17
      - session_results: {"sesion10": "100,100,50,0,100,100"}
      - session_score: 750
      - overall_progress: {sessions_completed, sessions_total, cumulative_score}
    """
    data = request.get_json() or {}
    
    result_id = data.get('result_id')
    if not result_id:
        return jsonify({'success': False, 'error': 'result_id requerido'}), 400
    
    result = OfficeExamResult.query.get(result_id)
    if not result or result.user_id != str(vb6_user.id):
        return jsonify({'success': False, 'error': 'Resultado no encontrado'}), 404
    
    session_number = data.get('session_number', result.parcial_session_number)
    session_score = data.get('session_score', 0)
    
    # Guardar datos de la sesión
    session_results = data.get('session_results', {})
    result.parcial_sessions_data = json.dumps(session_results, ensure_ascii=False)
    result.score = session_score
    result.passed = session_score >= result.passing_score
    result.status = 'completed'
    result.finished_at = datetime.utcnow()
    result.duration_seconds = data.get('duration_seconds')
    
    db.session.commit()
    
    # Calcular progreso global
    all_completed = OfficeExamResult.query.filter_by(
        user_id=str(vb6_user.id),
        session_type='parcial',
        status='completed',
    ).all()
    
    completed_numbers = [str(r.parcial_session_number) for r in all_completed if r.parcial_session_number]
    total_score = sum(r.score for r in all_completed if r.score)
    cumulative = round(total_score / len(all_completed)) if all_completed else 0
    
    # Sesiones restantes
    assigned = result.assigned_sessions or ''
    assigned_list = [s.strip() for s in assigned.split(',') if s.strip()]
    remaining = [s for s in assigned_list if s not in completed_numbers]
    
    overall_passed = cumulative >= 700 and len(remaining) == 0
    
    return jsonify({
        'success': True,
        'session_number': session_number,
        'session_score': session_score,
        'session_passed': session_score >= result.passing_score,
        'cumulative_score': cumulative,
        'overall_passed': overall_passed,
        'sessions_remaining': remaining,
        'sessions_completed': completed_numbers,
        'message': f'Sesión {session_number} completada',
    })


# ═══════════════════════════════════════════════════════════════════
# 7. RESULTS QUERY (for dashboards)
# ═══════════════════════════════════════════════════════════════════

@bp.route('/results', methods=['GET'])
@vb6_token_required
def vb6_results(vb6_user, vb6_token):
    """
    Consultar resultados del candidato.
    """
    results = OfficeExamResult.query.filter_by(
        user_id=str(vb6_user.id)
    ).order_by(OfficeExamResult.created_at.desc()).limit(50).all()
    
    return jsonify({
        'success': True,
        'results': [r.to_dict() for r in results],
        'total': len(results),
    })
