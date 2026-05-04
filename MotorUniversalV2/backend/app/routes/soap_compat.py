"""
Blueprint SOAP-compatible para integración VB6.

Expone los mismos endpoints .asmx que el legacy server (srvcsvls7-1.azurewebsites.net)
con respuestas XML idénticas, para que el VB6 solo necesite cambiar la URL base.

Servicios SOAP replicados:
  - Usuario.asmx: Login, Inicio, Fin, Fecha, CaducaVoucherPorPin
  - AdminTools.asmx: VerificarExamen, VerificarSimulador, VerificarParcial
  - Storage.asmx: UpXML2016
  - SimuladorWebService.asmx: Login, Inicio, Final, VerificarInformacion
  - ParcialesWebService.asmx: IniciarSesion, IniciarParcial, FinalizarParcial
  - Licencias.asmx: VerificarLicencia

El VB6 envía SOAP XML y espera SOAP XML de vuelta.
Internamente llama a los mismos modelos que vb6.py (REST).

Cambio clave vs legacy: Ya no hay concepto de "voucher".
El VoucherCode ahora es el ID de la asignación (GroupExam.id).
"""
import json
import logging
import re
from datetime import datetime, date
from xml.sax.saxutils import escape as xml_escape

from flask import Blueprint, request, Response
from app import db
from app.models.user import User
from app.models.vm_session import VmSession
from app.models.partner import CandidateGroup, GroupMember, GroupExam, GroupExamMember, Campus
from app.models.office_exam import OfficeExamResult, Vb6SessionToken, OfficeAppVersion

logger = logging.getLogger(__name__)

bp = Blueprint('soap_compat', __name__)


# ─── Health / Connectivity check ─────────────────────────────────────

@bp.route('/soap-health', methods=['GET'])
def soap_health():
    """GET handler for VB6 IsNetConnectOnline connectivity check."""
    return Response('OK', status=200, content_type='text/plain')


# ─── XML Helpers ─────────────────────────────────────────────────────

def _get_ns():
    """
    Resolve SOAP namespace dynamically from the request.
    VB6 EXEs use the domain as xmlns, so we mirror it back.
    Accepts: https://evaluasoap1.azurewebsites.net, http://evasoap-1.evaluaasi.com, etc.
    """
    host = request.host.split(':')[0]  # Remove port if present
    scheme = 'https' if request.is_secure else 'http'
    # Try to extract xmlns from the SOAP body (most reliable)
    raw = request.get_data(as_text=True)
    m = re.search(r'xmlns="(https?://[^"]+)"', raw)
    if m:
        ns = m.group(1)
        # Strip trailing path like /Login or /Fecha
        # Keep just the scheme+host
        parsed = ns.split('/')
        if len(parsed) >= 3:
            ns_host = '/'.join(parsed[:3])  # http(s)://domain
            return ns_host
    return f'{scheme}://{host}'


def _find_active_assignment(user_id, office_app=None, session_type='examen'):
    """
    Buscar la asignación activa (GroupExam) para el usuario.
    Reemplaza el concepto de voucher del legacy.
    Retorna (group_exam, group, campus) o (None, None, None).
    """
    membership = GroupMember.query.filter_by(
        user_id=str(user_id), status='active'
    ).first()
    if not membership:
        return None, None, None

    group = CandidateGroup.query.get(membership.group_id)
    if not group:
        return None, None, None

    # Buscar asignaciones activas del grupo
    query = GroupExam.query.filter_by(group_id=group.id, is_active=True)
    assignments = query.order_by(GroupExam.assigned_at.desc()).all()

    for ge in assignments:
        # Verificar que no esté expirada
        if ge.is_expired:
            continue
        # Si es tipo 'selected', verificar que el usuario esté incluido
        if ge.assignment_type == 'selected':
            member_assigned = GroupExamMember.query.filter_by(
                group_exam_id=ge.id, user_id=str(user_id)
            ).first()
            if not member_assigned:
                continue
        # Verificar disponibilidad temporal
        now = datetime.utcnow()
        if ge.available_from and now < ge.available_from:
            continue
        if ge.available_until and now > ge.available_until:
            continue
        # Encontramos una asignación válida
        campus = group.campus
        return ge, group, campus

    # Si no hay asignación específica, retornar grupo/campus sin asignación
    campus = group.campus
    return None, group, campus

def _soap_response(body_xml):
    """Wrap body in a SOAP envelope and return as Response."""
    envelope = (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
        '<soap:Body>'
        f'{body_xml}'
        '</soap:Body>'
        '</soap:Envelope>'
    )
    return Response(envelope, content_type='text/xml; charset=utf-8')


def _soap_fault(message):
    """Return a SOAP Fault response."""
    body = (
        '<soap:Fault>'
        '<faultcode>soap:Server</faultcode>'
        f'<faultstring>{xml_escape(message)}</faultstring>'
        '</soap:Fault>'
    )
    return _soap_response(body)


def _extract_soap_value(xml_str, element_name):
    """Extract the text content of an XML element (simple, no namespace)."""
    # Try with namespace prefix first, then without
    patterns = [
        f'<{element_name}>(.*?)</{element_name}>',
        f'<[^:]+:{element_name}>(.*?)</[^:]+:{element_name}>',
    ]
    for pattern in patterns:
        m = re.search(pattern, xml_str, re.DOTALL)
        if m:
            return m.group(1).strip()
    return ''


def _get_soap_action(headers):
    """Extract SOAP action method name from the SOAPAction header."""
    action = headers.get('SOAPAction', '')
    # Remove quotes and extract last segment
    action = action.strip('"').strip("'")
    if '/' in action:
        return action.rsplit('/', 1)[-1]
    return action


def _get_candidate_context(user_id):
    """Obtener campus, grupo y config del candidato (reutilizado de vb6.py)."""
    membership = GroupMember.query.filter_by(
        user_id=str(user_id), status='active'
    ).first()
    if not membership:
        return None, None, None, {}
    group = CandidateGroup.query.get(membership.group_id)
    if not group or not group.campus:
        return None, None, None, {}
    campus = group.campus

    def _eff(go, cv, default=False):
        if go is not None:
            return go
        if cv is not None:
            return cv
        return default

    config = {
        'enable_office_exams': _eff(group.enable_office_exams_override, campus.enable_office_exams),
        'enable_office_simulators': _eff(group.enable_office_simulators_override, campus.enable_office_simulators),
        'office_version': group.office_version_override or getattr(campus, 'office_version', None) or 'office_365',
        'enable_partial_evaluations': _eff(
            getattr(group, 'enable_partial_evaluations_override', None),
            getattr(campus, 'enable_partial_evaluations', None),
        ),
        'enable_unscheduled_partials': _eff(
            getattr(group, 'enable_unscheduled_partials_override', None),
            getattr(campus, 'enable_unscheduled_partials', None),
        ),
    }
    return campus, group, membership, config


def _find_active_vm_session(user_id, session_type=None):
    """Buscar VmSession activa para hoy."""
    today = date.today()
    now_hour = datetime.utcnow().hour
    query = VmSession.query.filter(
        VmSession.user_id == str(user_id),
        VmSession.session_date == today,
        VmSession.status.in_(['scheduled', 'in_progress']),
    )
    if session_type:
        query = query.filter(VmSession.session_type == session_type)
    sessions = query.order_by(VmSession.start_hour.asc()).all()
    for s in sessions:
        end_h = s.end_hour if s.end_hour is not None else s.start_hour + 1
        if s.start_hour <= now_hour < end_h:
            return s
    for s in sessions:
        if s.start_hour >= now_hour:
            return s
    return sessions[0] if sessions else None


def _esc(val):
    """Escape a value for XML. Return empty string for None."""
    if val is None:
        return ''
    return xml_escape(str(val))


# MSApp mapping: AppId -> office_app name
MSAPP_MAP = {'1': 'word', '2': 'excel', '3': 'powerpoint', '4': 'access',
             '001': 'word', '002': 'excel', '003': 'powerpoint', '004': 'access'}


# ═══════════════════════════════════════════════════════════════════
# USUARIO.ASMX
# ═══════════════════════════════════════════════════════════════════

@bp.route('/Usuario.asmx', methods=['POST'])
def usuario_asmx():
    """Handle all Usuario.asmx SOAP operations."""
    action = _get_soap_action(request.headers)
    raw = request.get_data(as_text=True)

    if action == 'Login':
        return _usuario_login(raw)
    elif action == 'Inicio':
        return _usuario_inicio(raw)
    elif action == 'Fin':
        return _usuario_fin(raw)
    elif action == 'Fecha':
        return _usuario_fecha()
    elif action == 'CaducaVoucherPorPin':
        return _usuario_caduca_voucher(raw)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


def _usuario_login(raw):
    """
    Login — reemplaza Usuario.asmx/Login
    VB6 parsea: <Regreso> con Login, UsuarioId, Nombre, Apellido, VoucherCode, VoucherId,
                Detalle, Prioritaria, URL, SubSistema, Plantel, Grupo, UsuarioEmail, CURP,
                SubsistemaId, MostrarAviso, IdAviso, Perfil, URLAviso, PinSeguridad, Pin,
                URLImagen, MostrarReporte
    
    Cambio MotorV2: VoucherCode = GroupExam.id (número de asignación)
    """
    NS = _get_ns()
    username = _extract_soap_value(raw, 'UsuarioNombre')
    password = _extract_soap_value(raw, 'Password')
    app_id = _extract_soap_value(raw, 'AppId')

    if not username or not password:
        return _soap_response(
            f'<LoginResponse xmlns="{NS}">'
            f'<Regreso><Login>false</Login><Detalle>Credenciales requeridas</Detalle></Regreso>'
            f'</LoginResponse>'
        )

    user = User.query.filter_by(username=username).first()
    if not user:
        user = User.query.filter_by(email=username).first()

    if not user or not user.check_password(password):
        return _soap_response(
            f'<LoginResponse xmlns="{NS}">'
            f'<Regreso><Login>false</Login><Detalle>Credenciales inválidas</Detalle></Regreso>'
            f'</LoginResponse>'
        )

    if not user.is_active:
        return _soap_response(
            f'<LoginResponse xmlns="{NS}">'
            f'<Regreso><Login>false</Login><Detalle>Usuario inactivo</Detalle></Regreso>'
            f'</LoginResponse>'
        )

    # Buscar asignación activa (reemplaza voucher)
    group_exam, group, campus = _find_active_assignment(user.id, session_type='examen')
    if not group_exam and not group:
        # Fallback: buscar contexto del candidato sin asignación
        campus, group, membership, config = _get_candidate_context(user.id)
    else:
        membership = GroupMember.query.filter_by(
            user_id=str(user.id), status='active'
        ).first()
        config = {}
        if group and campus:
            def _eff(go, cv, default=False):
                if go is not None:
                    return go
                if cv is not None:
                    return cv
                return default
            config = {
                'enable_office_exams': _eff(group.enable_office_exams_override, campus.enable_office_exams),
                'enable_office_simulators': _eff(group.enable_office_simulators_override, campus.enable_office_simulators),
                'office_version': group.office_version_override or getattr(campus, 'office_version', None) or 'office_365',
            }

    # Determine office_app from AppId
    office_app = MSAPP_MAP.get(app_id, 'excel')

    # Determine subsistema name from app_id
    subsistema_names = {
        '1': 'Microsoft Word', '2': 'Microsoft Excel',
        '3': 'Microsoft PowerPoint', '4': 'Microsoft Access',
        '001': 'Microsoft Word', '002': 'Microsoft Excel',
        '003': 'Microsoft PowerPoint', '004': 'Microsoft Access',
    }
    subsistema = subsistema_names.get(app_id, 'Microsoft Office')

    # Create a Vb6SessionToken linked to the assignment
    vm_session = _find_active_vm_session(user.id, session_type='examen')

    token = Vb6SessionToken(
        user_id=str(user.id),
        vm_session_id=vm_session.id if vm_session else None,
        group_exam_id=group_exam.id if group_exam else None,
        session_type='examen',
        ip_address=request.remote_addr,
    )
    db.session.add(token)
    db.session.commit()

    # Build names
    first_name = user.first_name or user.full_name or user.username
    last_name = user.last_name or ''
    plantel = campus.name if campus else ''
    grupo = group.name if group else ''

    # VoucherCode = ID de asignación (GroupExam.id) o token.id como fallback
    voucher_code = str(group_exam.id) if group_exam else str(token.id)

    body = (
        f'<LoginResponse xmlns="{NS}"><Regreso>'
        f'<Login>true</Login>'
        f'<UsuarioId>{_esc(user.id)}</UsuarioId>'
        f'<Nombre>{_esc(first_name)}</Nombre>'
        f'<Apellido>{_esc(last_name)}</Apellido>'
        f'<VoucherCode>{_esc(voucher_code)}</VoucherCode>'
        f'<VoucherId>{_esc(user.id)}</VoucherId>'
        f'<Detalle>Bienvenido</Detalle>'
        f'<Prioritaria>0</Prioritaria>'
        f'<URL></URL>'
        f'<SubSistema>{_esc(subsistema)}</SubSistema>'
        f'<Plantel>{_esc(plantel)}</Plantel>'
        f'<Grupo>{_esc(grupo)}</Grupo>'
        f'<UsuarioEmail>{_esc(user.email)}</UsuarioEmail>'
        f'<CURP>{_esc(getattr(user, "curp", ""))}</CURP>'
        f'<SubsistemaId>{_esc(app_id)}</SubsistemaId>'
        f'<MostrarAviso>0</MostrarAviso>'
        f'<IdAviso>0</IdAviso>'
        f'<Perfil>{_esc(user.role)}</Perfil>'
        f'<URLAviso></URLAviso>'
        f'<PinSeguridad>false</PinSeguridad>'
        f'<Pin></Pin>'
        f'<URLImagen></URLImagen>'
        f'<MostrarReporte>true</MostrarReporte>'
        f'</Regreso></LoginResponse>'
    )
    return _soap_response(body)


def _usuario_inicio(raw):
    """
    Inicio — reemplaza Usuario.asmx/Inicio
    VB6 parsea: <Regreso><VoucherStatus>...</VoucherStatus></Regreso>
    """
    NS = _get_ns()
    voucher_id = _extract_soap_value(raw, 'VoucherId')
    subsistema = _extract_soap_value(raw, 'Subsistema')
    user_pc = _extract_soap_value(raw, 'UserPC')
    pc_name = _extract_soap_value(raw, 'NombrePC')
    ip = _extract_soap_value(raw, 'IP')
    mac = _extract_soap_value(raw, 'MAC')
    version_examen = _extract_soap_value(raw, 'VersionExamen')
    version_app = _extract_soap_value(raw, 'VersionApp')

    if not voucher_id:
        return _soap_response(
            f'<InicioResponse xmlns="{NS}"><Regreso>'
            f'<VoucherStatus>0</VoucherStatus>'
            f'</Regreso></InicioResponse>'
        )

    # VoucherId in our model = user.id (set in Login)
    user = User.query.get(voucher_id)
    if not user:
        return _soap_response(
            f'<InicioResponse xmlns="{NS}"><Regreso>'
            f'<VoucherStatus>0</VoucherStatus>'
            f'</Regreso></InicioResponse>'
        )

    # Buscar asignación activa
    group_exam, group, campus = _find_active_assignment(user.id, session_type='examen')
    if not group and not campus:
        campus, group, membership, config = _get_candidate_context(user.id)
    else:
        config = {
            'office_version': (group.office_version_override if group else None) or
                              (getattr(campus, 'office_version', None) if campus else None) or 'office_365',
        }

    # Determine office_app from Subsistema
    office_app = 'excel'
    if subsistema:
        sub_lower = subsistema.lower()
        if 'word' in sub_lower:
            office_app = 'word'
        elif 'powerpoint' in sub_lower:
            office_app = 'powerpoint'
        elif 'access' in sub_lower:
            office_app = 'access'

    # Check if there's an in-progress result, if not create one
    existing = OfficeExamResult.query.filter_by(
        user_id=str(user.id), status='in_progress', session_type='examen'
    ).first()

    if not existing:
        vm_session = _find_active_vm_session(user.id, session_type='examen')
        result = OfficeExamResult(
            user_id=str(user.id),
            vm_session_id=vm_session.id if vm_session else None,
            campus_id=campus.id if campus else None,
            group_id=group.id if group else None,
            group_exam_id=group_exam.id if group_exam else None,
            session_type='examen',
            office_app=office_app,
            office_version=config.get('office_version') if isinstance(config, dict) else None,
            passing_score=group_exam.passing_score or 400 if group_exam else 400,
            ip_address=ip or request.remote_addr,
            mac_address=mac,
            pc_name=pc_name,
            app_version=version_examen,
            status='in_progress',
        )
        db.session.add(result)

        if vm_session and vm_session.status == 'scheduled':
            vm_session.status = 'in_progress'

        db.session.commit()

    body = (
        f'<InicioResponse xmlns="{NS}"><Regreso>'
        f'<VoucherStatus>1</VoucherStatus>'
        f'</Regreso></InicioResponse>'
    )
    return _soap_response(body)


def _usuario_fin(raw):
    """
    Fin — reemplaza Usuario.asmx/Fin
    VB6 parsea: <Regreso><IdTrans>...</IdTrans></Regreso>
    """
    NS = _get_ns()
    voucher_id = _extract_soap_value(raw, 'VoucherId')
    resultado = _extract_soap_value(raw, 'Resultado')
    subsistema = _extract_soap_value(raw, 'Subsistema')

    score = 0
    try:
        score = int(resultado)
    except (ValueError, TypeError):
        pass

    if not voucher_id:
        return _soap_response(
            f'<FinResponse xmlns="{NS}"><Regreso>'
            f'<IdTrans>TI000001</IdTrans>'
            f'</Regreso></FinResponse>'
        )

    user = User.query.get(voucher_id)
    if not user:
        return _soap_response(
            f'<FinResponse xmlns="{NS}"><Regreso>'
            f'<IdTrans>TI000001</IdTrans>'
            f'</Regreso></FinResponse>'
        )

    # Find the in-progress result for this user
    result = OfficeExamResult.query.filter_by(
        user_id=str(user.id), status='in_progress', session_type='examen'
    ).order_by(OfficeExamResult.created_at.desc()).first()

    trans_id = 'TI000001'

    if result:
        result.score = score
        result.passed = score >= result.passing_score
        result.status = 'completed'
        result.finished_at = datetime.utcnow()

        # Generate certificate code if passed
        if result.passed:
            date_str = datetime.utcnow().strftime('%Y%m%d')
            seq = OfficeExamResult.query.filter(
                OfficeExamResult.certificate_code.isnot(None),
                OfficeExamResult.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
            ).count() + 1
            result.certificate_code = f"OFC-{date_str}-{seq:03d}"

        db.session.commit()

        # Mark VmSession as completed
        if result.vm_session_id:
            vm = VmSession.query.get(result.vm_session_id)
            if vm and vm.status == 'in_progress':
                vm.status = 'completed'
                db.session.commit()

        trans_id = f'TR{result.id[:6].upper()}'

    body = (
        f'<FinResponse xmlns="{NS}"><Regreso>'
        f'<IdTrans>{trans_id}</IdTrans>'
        f'</Regreso></FinResponse>'
    )
    return _soap_response(body)


def _usuario_fecha():
    """
    Fecha — reemplaza Usuario.asmx/Fecha
    VB6 parsea: <FechaResult>double</FechaResult>
    """
    NS = _get_ns()
    # VB6 expects date as OLE Automation double (days since 1899-12-30)
    import datetime as dt
    ole_epoch = dt.datetime(1899, 12, 30)
    now = dt.datetime.utcnow()
    delta = now - ole_epoch
    ole_date = delta.total_seconds() / 86400.0

    body = (
        f'<FechaResponse xmlns="{NS}">'
        f'<FechaResult>{ole_date:.10f}</FechaResult>'
        f'</FechaResponse>'
    )
    return _soap_response(body)


def _usuario_caduca_voucher(raw):
    """CaducaVoucherPorPin — fire and forget, just acknowledge."""
    NS = _get_ns()
    body = (
        f'<CaducaVoucherPorPinResponse xmlns="{NS}">'
        f'<res>true</res>'
        f'</CaducaVoucherPorPinResponse>'
    )
    return _soap_response(body)


# ═══════════════════════════════════════════════════════════════════
# ADMINTOOLS.ASMX
# ═══════════════════════════════════════════════════════════════════

@bp.route('/AdminTools.asmx', methods=['POST'])
def admintools_asmx():
    """Handle AdminTools.asmx operations: VerificarExamen, VerificarSimulador, VerificarParcial."""
    action = _get_soap_action(request.headers)
    raw = request.get_data(as_text=True)

    # All three verification actions have the same response format
    if action in ('VerificarExamen', 'VerificarSimulador', 'VerificarParcial'):
        return _verificar_app(raw, action)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


def _verificar_app(raw, action):
    """
    Verificar versión de app.
    VB6 parsea: <Regreso><Hash>...</Hash><Actualizar>0|1</Actualizar><URL>...</URL></Regreso>
    """
    NS = _get_ns()
    # Extract version info
    version_app = (
        _extract_soap_value(raw, 'VersionApp') or
        _extract_soap_value(raw, 'VersionExamen') or
        _extract_soap_value(raw, 'VersionSim') or
        _extract_soap_value(raw, 'VersionParcial') or ''
    )
    app_id = _extract_soap_value(raw, 'AppId')

    # Check OfficeAppVersion table
    app_type_map = {
        'VerificarExamen': 'examen',
        'VerificarSimulador': 'simulador',
        'VerificarParcial': 'parcial',
    }
    app_type = app_type_map.get(action, 'examen')

    app_record = OfficeAppVersion.query.filter_by(
        app_name=f'{app_type}_{app_id}', is_active=True
    ).first()

    update_required = False
    update_url = ''
    hash_val = ''

    if app_record and app_record.min_version:
        update_required = version_app < app_record.min_version if version_app else True
        if update_required:
            update_url = app_record.download_url or ''
        hash_val = getattr(app_record, 'file_hash', '') or ''

    # Response tag depends on the action
    response_tag = f'{action}Response'
    body = (
        f'<{response_tag} xmlns="{NS}"><Regreso>'
        f'<Hash>{_esc(hash_val)}</Hash>'
        f'<Actualizar>{"1" if update_required else "0"}</Actualizar>'
        f'<URL>{_esc(update_url)}</URL>'
        f'</Regreso></{response_tag}>'
    )
    return _soap_response(body)


# ═══════════════════════════════════════════════════════════════════
# STORAGE.ASMX
# ═══════════════════════════════════════════════════════════════════

@bp.route('/Storage.asmx', methods=['POST'])
def storage_asmx():
    """Handle Storage.asmx operations: UpXML2016."""
    action = _get_soap_action(request.headers)
    raw = request.get_data(as_text=True)

    if action == 'UpXML2016':
        return _storage_upload(raw)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


def _storage_upload(raw):
    """
    UpXML2016 — subir respuestas detalladas (30 preguntas).
    VB6 parsea: <UpXML2016Response><UpXML2016Result>true|false</UpXML2016Result></UpXML2016Response>
    
    Cabecera format: VoucherId|VoucherCode|NombreCompleto|Subsistema|TipoExamen|Puntos|FechaInicio|FechaFin|0|Version|AppId|VersionOffice|UserPC|PCName|IP|MAC
    """
    NS = _get_ns()
    cabecera = _extract_soap_value(raw, 'cabecera')
    plantel = _extract_soap_value(raw, 'Plantel')
    grupo = _extract_soap_value(raw, 'Grupo')
    subsistema = _extract_soap_value(raw, 'Subsistema')

    # Extract 30 question/result pairs
    answers = []
    for i in range(1, 31):
        q_id = _extract_soap_value(raw, f'IDQ{i}')
        r_val = _extract_soap_value(raw, f'r{i}')
        if q_id:
            answers.append({
                'question_id': q_id,
                'result': r_val,
                'index': i,
            })

    # Parse cabecera to find user
    parts = cabecera.split('|') if cabecera else []
    voucher_id = parts[0].strip() if len(parts) > 0 else ''
    score_str = parts[5] if len(parts) > 5 else '0'

    success = False

    if voucher_id:
        user = User.query.get(voucher_id)
        if user:
            result = OfficeExamResult.query.filter_by(
                user_id=str(user.id), status='in_progress', session_type='examen'
            ).order_by(OfficeExamResult.created_at.desc()).first()

            if result:
                result.answers_data = json.dumps(answers, ensure_ascii=False)
                correct = sum(1 for a in answers if a.get('result') == '1')
                result.total_questions = len(answers)
                result.correct_answers = correct

                # Respaldo del XML crudo en Azure Blob (auditable). No bloquear si falla.
                try:
                    from app.utils.azure_storage import azure_storage
                    from datetime import datetime as _dt
                    ts = _dt.utcnow().strftime('%Y%m%dT%H%M%SZ')
                    blob_name = f"office-xml/{result.id}/{ts}.xml"
                    xml_bytes = (raw or '').encode('utf-8') if isinstance(raw, str) else (raw or b'')
                    blob_url = azure_storage.upload_bytes(xml_bytes, blob_name, content_type='application/xml')
                    if blob_url and hasattr(result, 'xml_blob_url'):
                        result.xml_blob_url = blob_url
                except Exception as _blob_err:
                    print(f"[UpXML2016] WARN no se pudo subir XML a blob: {_blob_err}")

                db.session.commit()
                success = True

    body = (
        f'<UpXML2016Response xmlns="{NS}">'
        f'<UpXML2016Result>{"true" if success else "false"}</UpXML2016Result>'
        f'</UpXML2016Response>'
    )
    return _soap_response(body)


# ═══════════════════════════════════════════════════════════════════
# SIMULADORWEBSERVICE.ASMX
# ═══════════════════════════════════════════════════════════════════

@bp.route('/SimuladorWebService.asmx', methods=['POST'])
def simulador_asmx():
    """Handle SimuladorWebService.asmx operations."""
    action = _get_soap_action(request.headers)
    raw = request.get_data(as_text=True)

    if action == 'Login':
        return _simulador_login(raw)
    elif action == 'Inicio':
        return _simulador_inicio(raw)
    elif action == 'Final':
        return _simulador_final(raw)
    elif action == 'VerificarInformacion':
        return _simulador_verificar_info(raw)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


def _simulador_login(raw):
    """
    SimuladorWebService Login.
    VB6 parsea: <LoginResult><Licencia>...<Estandar>...<CalendarioId>...<UsaAgendado>...<Nombre>...<Mensaje>...
    """
    NS = _get_ns()
    usuario = _extract_soap_value(raw, 'usuario')
    password = _extract_soap_value(raw, 'password')
    app_id = _extract_soap_value(raw, 'aplicacion')

    if not usuario or not password:
        return _soap_response(
            f'<LoginResponse xmlns="{NS}">'
            f'<LoginResult><Licencia></Licencia><Mensaje>Credenciales requeridas</Mensaje></LoginResult>'
            f'</LoginResponse>'
        )

    user = User.query.filter_by(username=usuario).first()
    if not user:
        user = User.query.filter_by(email=usuario).first()

    if not user or not user.check_password(password):
        return _soap_response(
            f'<LoginResponse xmlns="{NS}">'
            f'<LoginResult><Licencia></Licencia><Mensaje>Credenciales inválidas</Mensaje></LoginResult>'
            f'</LoginResponse>'
        )

    # Buscar asignación activa para simulador
    group_exam, group, campus = _find_active_assignment(user.id, session_type='simulador')
    if not group and not campus:
        campus, group, membership, config = _get_candidate_context(user.id)
    else:
        membership = GroupMember.query.filter_by(user_id=str(user.id), status='active').first()
        config = {
            'office_version': (group.office_version_override if group else None) or
                              (getattr(campus, 'office_version', None) if campus else None) or 'office_365',
        }

    vm_session = _find_active_vm_session(user.id, session_type='simulador')

    token = Vb6SessionToken(
        user_id=str(user.id),
        vm_session_id=vm_session.id if vm_session else None,
        group_exam_id=group_exam.id if group_exam else None,
        session_type='simulador',
        ip_address=request.remote_addr,
    )
    db.session.add(token)
    db.session.commit()

    # Build a synthetic license string that the VB6 expects
    # Format: subsistemaId|licenciaId|responsable|plantelId|plantelNombre|version|appFlags|vigencias|officeVersion|dateValidation|onlineMode
    plantel_name = campus.name if campus else 'Evaluaasi'
    grupo_name = group.name if group else ''
    now_double = int(datetime.utcnow().strftime('%Y%m%d'))
    vigencia_future = '2030-12-31'
    licencia_str = f'0|{token.id}|Evaluaasi|0|{plantel_name}|{app_id}|ZZZZ|{vigencia_future}|2016|{now_double}|1'

    cal_id = vm_session.id if vm_session else '0'

    body = (
        f'<LoginResponse xmlns="{NS}"><LoginResult>'
        f'<Licencia>{_esc(licencia_str)}</Licencia>'
        f'<Estandar>Evaluaasi</Estandar>'
        f'<CalendarioId>{_esc(cal_id)}</CalendarioId>'
        f'<UsaAgendado>1</UsaAgendado>'
        f'<Nombre>{_esc(user.full_name or user.username)}</Nombre>'
        f'<Mensaje>Bienvenido</Mensaje>'
        f'</LoginResult></LoginResponse>'
    )
    return _soap_response(body)


def _simulador_inicio(raw):
    """
    SimuladorWebService Inicio.
    VB6 parsea: <InicioResult><ResultadoId>...</ResultadoId></InicioResult>
    """
    NS = _get_ns()
    usuario = _extract_soap_value(raw, 'usuario')
    calendario_id = _extract_soap_value(raw, 'calendarioId')
    ip = _extract_soap_value(raw, 'ip')
    mac = _extract_soap_value(raw, 'mac')
    version = _extract_soap_value(raw, 'version')
    pc_name = _extract_soap_value(raw, 'nombrePC')
    user_pc = _extract_soap_value(raw, 'usuarioPC')
    tipo = _extract_soap_value(raw, 'tipo')  # 0=simulación, 1=entrenamiento

    # Find user by username (simulador uses Windows username)
    user = User.query.filter_by(username=usuario).first()
    if not user:
        return _soap_response(
            f'<InicioResponse xmlns="{NS}"><InicioResult>'
            f'<ResultadoId>0</ResultadoId>'
            f'</InicioResult></InicioResponse>'
        )

    group_exam, group, campus = _find_active_assignment(user.id, session_type='simulador')
    if not group and not campus:
        campus, group, membership, config = _get_candidate_context(user.id)
    else:
        config = {
            'office_version': (group.office_version_override if group else None) or
                              (getattr(campus, 'office_version', None) if campus else None) or 'office_365',
        }

    result = OfficeExamResult(
        user_id=str(user.id),
        vm_session_id=calendario_id if calendario_id and calendario_id != '0' else None,
        campus_id=campus.id if campus else None,
        group_id=group.id if group else None,
        group_exam_id=group_exam.id if group_exam else None,
        session_type='simulador',
        office_app='excel',  # Will be overridden when more context is available
        office_version=config.get('office_version') if isinstance(config, dict) else None,
        passing_score=group_exam.passing_score or 700 if group_exam else 700,
        ip_address=ip or request.remote_addr,
        mac_address=mac,
        pc_name=pc_name,
        app_version=version,
        status='in_progress',
    )
    db.session.add(result)
    db.session.commit()

    body = (
        f'<InicioResponse xmlns="{NS}"><InicioResult>'
        f'<ResultadoId>{result.id}</ResultadoId>'
        f'</InicioResult></InicioResponse>'
    )
    return _soap_response(body)


def _simulador_final(raw):
    """
    SimuladorWebService Final.
    VB6 parsea: <FinalResult><ResultadoId>...</ResultadoId></FinalResult>
    """
    NS = _get_ns()
    usuario = _extract_soap_value(raw, 'usuario')
    calendario_id = _extract_soap_value(raw, 'calendarioId')
    resultado_id = _extract_soap_value(raw, 'resultadoId')
    calificacion = _extract_soap_value(raw, 'calificacion')

    score = 0
    try:
        score = int(calificacion)
    except (ValueError, TypeError):
        pass

    result_id_final = '0'

    if resultado_id:
        result = OfficeExamResult.query.get(resultado_id)
        if result:
            result.score = score
            result.passed = score >= result.passing_score
            result.status = 'completed'
            result.finished_at = datetime.utcnow()
            db.session.commit()
            result_id_final = str(result.id)

            if result.vm_session_id:
                vm = VmSession.query.get(result.vm_session_id)
                if vm and vm.status == 'in_progress':
                    vm.status = 'completed'
                    db.session.commit()

    body = (
        f'<FinalResponse xmlns="{NS}"><FinalResult>'
        f'<ResultadoId>{result_id_final}</ResultadoId>'
        f'</FinalResult></FinalResponse>'
    )
    return _soap_response(body)


def _simulador_verificar_info(raw):
    """
    SimuladorWebService VerificarInformacion.
    VB6 parsea: <VerificarInformacionResult><ModeloEducare>0|1<CalendarioId>...<Nombre>...
    """
    NS = _get_ns()
    usuario = _extract_soap_value(raw, 'usuario')
    app_id = _extract_soap_value(raw, 'aplicacion')

    user = User.query.filter_by(username=usuario).first()
    if not user:
        body = (
            f'<VerificarInformacionResponse xmlns="{NS}"><VerificarInformacionResult>'
            f'<ModeloEducare>0</ModeloEducare>'
            f'<CalendarioId>0</CalendarioId>'
            f'<Nombre></Nombre>'
            f'</VerificarInformacionResult></VerificarInformacionResponse>'
        )
        return _soap_response(body)

    vm_session = _find_active_vm_session(user.id, session_type='simulador')

    body = (
        f'<VerificarInformacionResponse xmlns="{NS}"><VerificarInformacionResult>'
        f'<ModeloEducare>{"1" if vm_session else "0"}</ModeloEducare>'
        f'<CalendarioId>{vm_session.id if vm_session else "0"}</CalendarioId>'
        f'<Nombre>{_esc(user.full_name or user.username)}</Nombre>'
        f'</VerificarInformacionResult></VerificarInformacionResponse>'
    )
    return _soap_response(body)


# ═══════════════════════════════════════════════════════════════════
# PARCIALESWEBSERVICE.ASMX
# ═══════════════════════════════════════════════════════════════════

@bp.route('/ParcialesWebService.asmx', methods=['POST'])
def parciales_asmx():
    """Handle ParcialesWebService.asmx operations."""
    action = _get_soap_action(request.headers)
    raw = request.get_data(as_text=True)

    if action == 'IniciarSesion':
        return _parcial_iniciar_sesion(raw)
    elif action == 'IniciarParcial':
        return _parcial_iniciar(raw)
    elif action == 'FinalizarParcial':
        return _parcial_finalizar(raw)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


def _parcial_iniciar_sesion(raw):
    """
    IniciarSesion — Login para parciales.
    VB6 parsea: <IniciarSesionResult> con Correcto, Nombre, VoucherCode, Mensaje,
                CalendarioId, InicioDouble, FinalDouble, Sesiones, Token, UsaParcialesSinAgendar
    """
    NS = _get_ns()
    usuario = _extract_soap_value(raw, 'usuario')
    password = _extract_soap_value(raw, 'password')
    app_id = _extract_soap_value(raw, 'aplicacionId')

    if not usuario or not password:
        return _soap_response(
            f'<IniciarSesionResponse xmlns="{NS}"><IniciarSesionResult>'
            f'<Correcto>false</Correcto><Mensaje>Credenciales requeridas</Mensaje>'
            f'</IniciarSesionResult></IniciarSesionResponse>'
        )

    user = User.query.filter_by(username=usuario).first()
    if not user:
        user = User.query.filter_by(email=usuario).first()

    if not user or not user.check_password(password):
        return _soap_response(
            f'<IniciarSesionResponse xmlns="{NS}"><IniciarSesionResult>'
            f'<Correcto>false</Correcto><Mensaje>Credenciales inválidas</Mensaje>'
            f'</IniciarSesionResult></IniciarSesionResponse>'
        )

    campus, group, membership, config = _get_candidate_context(user.id)

    vm_session = _find_active_vm_session(user.id, session_type='parcial')

    # Buscar asignación activa para parciales
    group_exam, _, _ = _find_active_assignment(user.id, session_type='parcial')

    token = Vb6SessionToken(
        user_id=str(user.id),
        vm_session_id=vm_session.id if vm_session else None,
        group_exam_id=group_exam.id if group_exam else None,
        session_type='parcial',
        ip_address=request.remote_addr,
    )
    db.session.add(token)
    db.session.commit()

    # Calculate completed sessions
    prev_results = OfficeExamResult.query.filter_by(
        user_id=str(user.id), session_type='parcial', status='completed'
    ).all()
    completed_numbers = [str(r.parcial_session_number) for r in prev_results if r.parcial_session_number]

    # Assigned sessions from VmSession
    assigned = ''
    if vm_session and vm_session.parcial_units:
        assigned = vm_session.parcial_units

    # OLE date doubles for session window
    import datetime as dt
    ole_epoch = dt.datetime(1899, 12, 30)
    now = dt.datetime.utcnow()
    inicio_double = (now.replace(hour=0, minute=0, second=0) - ole_epoch).total_seconds() / 86400.0
    final_double = (now.replace(hour=23, minute=59, second=59) - ole_epoch).total_seconds() / 86400.0

    usa_sin_agendar = 'true' if config.get('enable_unscheduled_partials') else 'false'

    body = (
        f'<IniciarSesionResponse xmlns="{NS}"><IniciarSesionResult>'
        f'<Correcto>true</Correcto>'
        f'<Nombre>{_esc(user.full_name or user.username)}</Nombre>'
        f'<VoucherCode>{_esc(token.id)}</VoucherCode>'
        f'<Mensaje>Bienvenido</Mensaje>'
        f'<CalendarioId>{_esc(vm_session.id if vm_session else "0")}</CalendarioId>'
        f'<InicioDouble>{inicio_double:.10f}</InicioDouble>'
        f'<FinalDouble>{final_double:.10f}</FinalDouble>'
        f'<Sesiones>{_esc(assigned)}</Sesiones>'
        f'<Token>{_esc(token.id)}</Token>'
        f'<UsaParcialesSinAgendar>{usa_sin_agendar}</UsaParcialesSinAgendar>'
        f'</IniciarSesionResult></IniciarSesionResponse>'
    )
    return _soap_response(body)


def _parcial_iniciar(raw):
    NS = _get_ns()
    """
    IniciarParcial — start a partial exam session.
    VB6 parsea: <IniciarParcialResponse><IniciarParcialResult>0|1</IniciarParcialResult>
    """
    NS = _get_ns()
    usuario = _extract_soap_value(raw, 'usuario')
    calendario = _extract_soap_value(raw, 'calendario')
    ip = _extract_soap_value(raw, 'ip')
    mac = _extract_soap_value(raw, 'mac')
    version_examen = _extract_soap_value(raw, 'versionExamen')
    pc_name = _extract_soap_value(raw, 'nombrePC')
    user_pc = _extract_soap_value(raw, 'usuarioPC')

    user = User.query.filter_by(username=usuario).first()
    if not user:
        return _soap_response(
            f'<IniciarParcialResponse xmlns="{NS}">'
            f'<IniciarParcialResult>0</IniciarParcialResult>'
            f'</IniciarParcialResponse>'
        )

    campus, group, membership, config = _get_candidate_context(user.id)

    result = OfficeExamResult(
        user_id=str(user.id),
        vm_session_id=calendario if calendario and calendario != '0' else None,
        campus_id=campus.id if campus else None,
        group_id=group.id if group else None,
        session_type='parcial',
        office_app='excel',
        office_version=config.get('office_version'),
        passing_score=700,
        ip_address=ip or request.remote_addr,
        mac_address=mac,
        pc_name=pc_name,
        app_version=version_examen,
        status='in_progress',
    )
    db.session.add(result)
    db.session.commit()

    body = (
        f'<IniciarParcialResponse xmlns="{NS}">'
        f'<IniciarParcialResult>1</IniciarParcialResult>'
        f'</IniciarParcialResponse>'
    )
    return _soap_response(body)


def _parcial_finalizar(raw):
    """
    FinalizarParcial — submit all 17 session results.
    VB6 parsea: <FinalizarParcialResult>TransactionId</FinalizarParcialResult>
    """
    NS = _get_ns()
    nombre = _extract_soap_value(raw, 'nombre')
    id_calendario = _extract_soap_value(raw, 'idCalendario')

    # Extract session data (sesion1 through sesion17)
    sessions_data = {}
    for i in range(1, 18):
        val = _extract_soap_value(raw, f'sesion{i}')
        if val:
            sessions_data[f'sesion{i}'] = val

    # Find user by username
    user = User.query.filter_by(username=nombre).first()
    if not user:
        return _soap_response(
            f'<FinalizarParcialResponse xmlns="{NS}">'
            f'<FinalizarParcialResult>TI000001</FinalizarParcialResult>'
            f'</FinalizarParcialResponse>'
        )

    # Find the in-progress parcial result
    result = OfficeExamResult.query.filter_by(
        user_id=str(user.id), status='in_progress', session_type='parcial'
    ).order_by(OfficeExamResult.created_at.desc()).first()

    trans_id = 'TI000001'

    if result:
        result.parcial_sessions_data = json.dumps(sessions_data, ensure_ascii=False)
        result.status = 'completed'
        result.finished_at = datetime.utcnow()

        # Calculate score from session data
        total_questions = 0
        correct = 0
        for key, val in sessions_data.items():
            if val:
                entries = val.split('|')
                for entry in entries:
                    if entry:
                        total_questions += 1
                        # Format: "idPregunta,status¤resultado" — status 0 = correct
                        parts = entry.split(',')
                        if len(parts) >= 2:
                            status_result = parts[1]
                            status = status_result.split('\xa4')[0] if '\xa4' in status_result else status_result.split('¤')[0] if '¤' in status_result else status_result
                            if status == '0':
                                correct += 1

        result.total_questions = total_questions
        result.correct_answers = correct
        if total_questions > 0:
            result.score = round((correct / total_questions) * 1000)
        result.passed = result.score >= result.passing_score if result.score else False

        db.session.commit()
        trans_id = f'TR{result.id:06d}'

    body = (
        f'<FinalizarParcialResponse xmlns="{NS}">'
        f'<FinalizarParcialResult>{trans_id}</FinalizarParcialResult>'
        f'</FinalizarParcialResponse>'
    )
    return _soap_response(body)


# ═══════════════════════════════════════════════════════════════════
# WEBSERVICE.ASMX (utilities)
# ═══════════════════════════════════════════════════════════════════

@bp.route('/webservice.asmx', methods=['POST'])
def webservice_asmx():
    """Handle webservice.asmx operations."""
    action = _get_soap_action(request.headers)
    NS = _get_ns()

    if action == 'ObtenerPaisPorIP':
        # Return México as default country
        body = (
            f'<ObtenerPaisPorIPResponse xmlns="{NS}"><Regreso>'
            f'<Pais>MX</Pais>'
            f'</Regreso></ObtenerPaisPorIPResponse>'
        )
        return _soap_response(body)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


# ═══════════════════════════════════════════════════════════════════
# LICENCIAS.ASMX (License validation)
# ═══════════════════════════════════════════════════════════════════

@bp.route('/Licencias.asmx', methods=['POST'])
def licencias_asmx():
    """Handle Licencias.asmx operations: VerificarLicencia."""
    action = _get_soap_action(request.headers)
    raw = request.get_data(as_text=True)

    if action == 'VerificarLicencia':
        return _verificar_licencia(raw)
    else:
        return _soap_fault(f'Acción no soportada: {action}')


def _verificar_licencia(raw):
    """
    VerificarLicencia — valida licencia del EXE contra catálogo OfficeAppVersion.

    Reglas:
      - Si NO hay app activa en catálogo (catálogo vacío) → permitir (compat legacy).
      - Si el subsistema/AppId coincide con un OfficeAppVersion is_active=True → permitir.
      - Si coincide pero is_active=False → bloquear.
      - Si min_version definido y la versión enviada es menor → bloquear.
      - Si no hay coincidencia y catálogo no vacío → permitir igual (no bloqueamos EXEs legacy desconocidos para mantener coexistencia).
    """
    NS = _get_ns()
    subsistema = (_extract_soap_value(raw, 'SubSistema') or
                  _extract_soap_value(raw, 'subsistema') or
                  _extract_soap_value(raw, 'AppId') or
                  _extract_soap_value(raw, 'appId') or '').strip()
    version = (_extract_soap_value(raw, 'Version') or
               _extract_soap_value(raw, 'version') or '').strip()
    nombre_pc = _extract_soap_value(raw, 'NombrePC') or _extract_soap_value(raw, 'nombrePC')

    valid = True
    reason = None
    try:
        from app.models.office_exam import OfficeAppVersion
        catalog = OfficeAppVersion.query.all()
        if catalog:
            match = None
            sub_lower = subsistema.lower()
            for app in catalog:
                if app.app_name and app.app_name.lower() == sub_lower:
                    match = app
                    break
            if match:
                if not match.is_active:
                    valid = False
                    reason = 'app_inactive'
                elif match.min_version and version:
                    # Comparación lexicográfica simple por componentes numéricos
                    def _ver_tuple(v):
                        try:
                            return tuple(int(p) for p in v.split('.') if p.isdigit())
                        except Exception:
                            return ()
                    if _ver_tuple(version) < _ver_tuple(match.min_version):
                        valid = False
                        reason = 'version_too_old'
            # Si no match: dejamos valid=True por compatibilidad
    except Exception as e:
        # Ante error de BD, permitir para no bloquear operación crítica
        print(f"[VerificarLicencia] WARN: {e}")
        valid = True

    print(f"[VerificarLicencia] subsistema={subsistema!r} version={version!r} pc={nombre_pc!r} → {valid} ({reason})")

    body = (
        f'<VerificarLicenciaResponse xmlns="{NS}">'
        f'<VerificarLicenciaResult>{"true" if valid else "false"}</VerificarLicenciaResult>'
        '</VerificarLicenciaResponse>'
    )
    return _soap_response(body)
