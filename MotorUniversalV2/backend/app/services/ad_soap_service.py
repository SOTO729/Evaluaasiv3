"""
Servicio de integración con ADWebService (SOAP).
El EXE legacy lee sesiones de dbo.Sesion y crea usuarios AD + conexiones Guacamole.
Este servicio permite consultar/verificar ese estado desde V2.

Operaciones SOAP disponibles:
  - GetUsers()              → Usuarios AD actuales
  - GetApplications(user)   → Apps disponibles para un usuario
  - GetCertifications()     → Lista de certificaciones
  - GetSubsystems()         → Lista de subsistemas
  - GetWorkStations()       → Lista de workstations
  - MarkCompleted(sub,plan,user) → Marcar usuario como completado
  - ObtenerHorarios()       → Horarios por equipo
  - GetCompletedUsers()     → Usuarios completados
  - GetExpiredUsers()       → Usuarios expirados
  - HelloWorld()            → Test de conexión
"""
import os
import logging
import xml.etree.ElementTree as ET

import requests

logger = logging.getLogger(__name__)

SOAP_URL = os.environ.get(
    'AD_SOAP_URL',
    'https://srvcsvls7-1.azurewebsites.net/ADWebService.asmx'
)
SOAP_NAMESPACE = 'https://srvcsvls7-1.azurewebsites.net'
SOAP_TIMEOUT = 30  # seconds


def _soap_call(action, body_xml):
    """
    Ejecutar una llamada SOAP 1.1 al ADWebService.

    Args:
        action: Nombre de la operación (e.g. 'GetUsers')
        body_xml: Contenido XML del <soap:Body>

    Returns:
        ElementTree Element del cuerpo de la respuesta
    """
    envelope = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    {body_xml}
  </soap:Body>
</soap:Envelope>"""

    headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': f'"{SOAP_NAMESPACE}/{action}"',
    }

    response = requests.post(
        SOAP_URL,
        data=envelope.encode('utf-8'),
        headers=headers,
        timeout=SOAP_TIMEOUT,
    )
    response.raise_for_status()

    root = ET.fromstring(response.content)
    # Namespace-agnostic search for Body content
    body = root.find('.//{http://schemas.xmlsoap.org/soap/envelope/}Body')
    return body


def _find_all_text(element, local_name):
    """Buscar todos los elementos con un nombre local y extraer su texto."""
    results = []
    for el in element.iter():
        if el.tag.endswith('}' + local_name) or el.tag == local_name:
            if el.text:
                results.append(el.text.strip())
    return results


def _parse_user_data(user_element):
    """Parsear un elemento UserData a dict."""
    ns = SOAP_NAMESPACE
    data = {}
    fields = [
        'Subsystem', 'Name', 'GivenName', 'Surname', 'SamAccountName',
        'DisplayName', 'AccountPassword', 'UserPrincipalName', 'Path',
        'LogonWorkstations', 'ProfilePath', 'Day', 'Begin', 'End',
        'Expired', 'Password',
    ]
    for field in fields:
        el = user_element.find(f'{{{ns}}}{field}')
        if el is None:
            el = user_element.find(field)
        if el is not None and el.text:
            data[field] = el.text.strip()
        else:
            data[field] = None

    # Convert numeric fields
    for int_field in ('Begin', 'End'):
        if data.get(int_field):
            try:
                data[int_field] = int(data[int_field])
            except (ValueError, TypeError):
                pass

    return {
        'subsystem': data.get('Subsystem'),
        'name': data.get('Name'),
        'given_name': data.get('GivenName'),
        'surname': data.get('Surname'),
        'sam_account_name': data.get('SamAccountName'),
        'display_name': data.get('DisplayName'),
        'user_principal_name': data.get('UserPrincipalName'),
        'path': data.get('Path'),
        'logon_workstations': data.get('LogonWorkstations'),
        'profile_path': data.get('ProfilePath'),
        'day': data.get('Day'),
        'begin': data.get('Begin'),
        'end': data.get('End'),
        'expired': data.get('Expired'),
    }


def hello_world():
    """Test de conexión al SOAP service."""
    try:
        body = f'<HelloWorld xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('HelloWorld', body)
        text_el = result.find(f'.//{{{SOAP_NAMESPACE}}}HelloWorldResult')
        if text_el is None:
            text_el = result.find('.//HelloWorldResult')
        return text_el.text if text_el is not None else 'OK'
    except Exception as e:
        logger.error(f"SOAP HelloWorld falló: {e}")
        raise


def get_users():
    """
    Obtener todos los usuarios AD activos.
    Estos son creados por el EXE legacy al leer dbo.Sesion.

    Returns:
        Lista de dicts con info del usuario AD.
    """
    try:
        body = f'<GetUsers xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('GetUsers', body)

        users = []
        for ud in result.iter():
            if ud.tag.endswith('}UserData') or ud.tag == 'UserData':
                users.append(_parse_user_data(ud))
        return users
    except Exception as e:
        logger.error(f"SOAP GetUsers falló: {e}")
        raise


def get_applications(username):
    """
    Obtener aplicaciones disponibles para un usuario AD.

    Args:
        username: SamAccountName del usuario

    Returns:
        Lista de strings con nombres de aplicaciones.
    """
    try:
        body = f"""<GetApplications xmlns="{SOAP_NAMESPACE}">
      <username>{username}</username>
    </GetApplications>"""
        result = _soap_call('GetApplications', body)
        return _find_all_text(result, 'string')
    except Exception as e:
        logger.error(f"SOAP GetApplications falló para {username}: {e}")
        raise


def get_certifications():
    """Obtener lista de certificaciones desde SOAP."""
    try:
        body = f'<GetCertifications xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('GetCertifications', body)
        return _find_all_text(result, 'string')
    except Exception as e:
        logger.error(f"SOAP GetCertifications falló: {e}")
        raise


def get_subsystems():
    """Obtener subsistemas desde SOAP (alternativa a DB directa)."""
    try:
        body = f'<GetSubsystems xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('GetSubsystems', body)

        subsystems = []
        ns = SOAP_NAMESPACE
        for sub in result.iter():
            if sub.tag.endswith('}Subsystems') or sub.tag == 'Subsystems':
                sid_el = sub.find(f'{{{ns}}}SubsystemId') or sub.find('SubsystemId')
                name_el = sub.find(f'{{{ns}}}Name') or sub.find('Name')
                abbr_el = sub.find(f'{{{ns}}}Abbreviation') or sub.find('Abbreviation')
                if sid_el is not None:
                    subsystems.append({
                        'subsystem_id': int(sid_el.text) if sid_el.text else None,
                        'name': name_el.text if name_el is not None else None,
                        'abbreviation': abbr_el.text if abbr_el is not None else None,
                    })
        return subsystems
    except Exception as e:
        logger.error(f"SOAP GetSubsystems falló: {e}")
        raise


def get_workstations():
    """Obtener lista de workstations desde SOAP."""
    try:
        body = f'<GetWorkStations xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('GetWorkStations', body)
        return _find_all_text(result, 'string')
    except Exception as e:
        logger.error(f"SOAP GetWorkStations falló: {e}")
        raise


def mark_completed(subsistema_id, plantel_id, usuario):
    """
    Marcar un usuario como completado en AD.

    Args:
        subsistema_id: int
        plantel_id: int
        usuario: str (username)

    Returns:
        bool
    """
    try:
        body = f"""<MarkCompleted xmlns="{SOAP_NAMESPACE}">
      <subsistemaId>{subsistema_id}</subsistemaId>
      <plantelId>{plantel_id}</plantelId>
      <usuario>{usuario}</usuario>
    </MarkCompleted>"""
        result = _soap_call('MarkCompleted', body)
        result_el = result.find(f'.//{{{SOAP_NAMESPACE}}}MarkCompletedResult')
        if result_el is None:
            result_el = result.find('.//MarkCompletedResult')
        return result_el is not None and result_el.text and result_el.text.lower() == 'true'
    except Exception as e:
        logger.error(f"SOAP MarkCompleted falló para {usuario}: {e}")
        raise


def get_horarios():
    """
    Obtener horarios por equipo desde SOAP.

    Returns:
        Lista de dicts con {equipo, horarios}.
    """
    try:
        body = f'<ObtenerHorarios xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('ObtenerHorarios', body)

        horarios = []
        ns = SOAP_NAMESPACE
        for he in result.iter():
            if he.tag.endswith('}HorariosEquipo') or he.tag == 'HorariosEquipo':
                equipo_el = he.find(f'{{{ns}}}Equipo') or he.find('Equipo')
                horarios_el = he.find(f'{{{ns}}}Horarios') or he.find('Horarios')
                horarios.append({
                    'equipo': equipo_el.text if equipo_el is not None else None,
                    'horarios': horarios_el.text if horarios_el is not None else None,
                })
        return horarios
    except Exception as e:
        logger.error(f"SOAP ObtenerHorarios falló: {e}")
        raise


def get_completed_users():
    """Obtener usuarios AD marcados como completados."""
    try:
        body = f'<GetCompletedUsers xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('GetCompletedUsers', body)

        users = []
        for ud in result.iter():
            if ud.tag.endswith('}UserData') or ud.tag == 'UserData':
                users.append(_parse_user_data(ud))
        return users
    except Exception as e:
        logger.error(f"SOAP GetCompletedUsers falló: {e}")
        raise


def get_expired_users():
    """Obtener usuarios AD expirados."""
    try:
        body = f'<GetExpiredUsers xmlns="{SOAP_NAMESPACE}" />'
        result = _soap_call('GetExpiredUsers', body)

        users = []
        for ud in result.iter():
            if ud.tag.endswith('}UserData') or ud.tag == 'UserData':
                users.append(_parse_user_data(ud))
        return users
    except Exception as e:
        logger.error(f"SOAP GetExpiredUsers falló: {e}")
        raise


def test_soap_connection():
    """Test de conexión al SOAP service. Retorna dict con status."""
    try:
        msg = hello_world()
        return {
            'connected': True,
            'url': SOAP_URL,
            'message': msg,
        }
    except Exception as e:
        return {
            'connected': False,
            'url': SOAP_URL,
            'error': str(e),
        }
