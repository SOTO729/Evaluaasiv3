"""
Servicio para gestionar usuarios en Active Directory via LDAP.

Reemplaza la dependencia del EXE legacy (ActiveDirectoryUsers.exe) para
sesiones creadas desde Evaluaasi V2. Crea, actualiza y elimina usuarios AD
just-in-time cuando el candidato agenda o se conecta a una VDI.

Estructura OU (replica la del EXE):
  OU={Tipo},OU=OU-{Estandar},OU=usurios,OU=VDI,DC=evaluaasi,DC=info

Grupo VDI:
  G_G_{workstation_name}

Credenciales AD leídas de env vars:
  AD_DOMAIN, AD_SERVER, AD_USER, AD_PASSWORD
"""
import os
import logging
import secrets
import string
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# AD Configuration
AD_CONFIG = {
    'domain': os.environ.get('AD_DOMAIN', 'evaluaasi.info'),
    'server': os.environ.get('AD_SERVER', 'evaluaasi.info'),
    'user': os.environ.get('AD_USER', 'AdministraAD'),
    'password': os.environ.get('AD_PASSWORD', ''),
}

# OU base para VDI users
OU_BASE = 'OU=usurios,OU=VDI,DC=evaluaasi,DC=info'

# Mapeo Tipo int → nombre OU (igual que SP_Sesiones @accion=4 CASE statement)
TIPO_MAP = {
    1: 'Simulador',
    2: 'Examen',
    3: 'Parcial',
}


def _get_connection():
    """Crear conexión LDAP al AD."""
    from ldap3 import Server, Connection, NTLM, AUTO_BIND_NO_TLS
    server = Server(AD_CONFIG['server'], port=389, use_ssl=False, get_info='ALL',
                    connect_timeout=10)
    user_dn = f"{AD_CONFIG['domain']}\\{AD_CONFIG['user']}"
    conn = Connection(
        server,
        user=user_dn,
        password=AD_CONFIG['password'],
        authentication=NTLM,
        auto_bind=AUTO_BIND_NO_TLS,
        raise_exceptions=True,
        receive_timeout=10,
    )
    return conn


def generate_ad_password(length=12):
    """
    Genera una contraseña segura para AD que cumple con los requisitos
    de complejidad de Windows (mayúscula, minúscula, dígito, especial).
    """
    upper = secrets.choice(string.ascii_uppercase)
    lower = secrets.choice(string.ascii_lowercase)
    digit = secrets.choice(string.digits)
    special = secrets.choice('!@#$%&*')
    rest = ''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%&*')
                   for _ in range(length - 4))
    password_chars = list(upper + lower + digit + special + rest)
    secrets.SystemRandom().shuffle(password_chars)
    return ''.join(password_chars)


def _build_ou_path(estandar_code, tipo_int):
    """
    Construir el path OU donde se creará el usuario.
    Replica: OU={Tipo},OU=OU-{Estandar},OU=usurios,OU=VDI,DC=evaluaasi,DC=info
    """
    tipo_name = TIPO_MAP.get(tipo_int, 'Simulador')
    return f"OU={tipo_name},OU=OU-{estandar_code},{OU_BASE}"


def _ensure_ou_exists(conn, estandar_code, tipo_int):
    """
    Verificar que las OUs necesarias existen, creándolas si hace falta.
    Crea en orden: OU-{Estandar} → {Tipo}
    """
    from ldap3 import MODIFY_ADD
    
    estandar_ou = f"OU=OU-{estandar_code},{OU_BASE}"
    tipo_name = TIPO_MAP.get(tipo_int, 'Simulador')
    tipo_ou = f"OU={tipo_name},{estandar_ou}"

    # Verificar/crear OU del estándar
    if not conn.search(estandar_ou, '(objectClass=organizationalUnit)', search_scope='BASE'):
        conn.add(estandar_ou, 'organizationalUnit')
        logger.info(f"OU creada: {estandar_ou}")

    # Verificar/crear OU del tipo
    if not conn.search(tipo_ou, '(objectClass=organizationalUnit)', search_scope='BASE'):
        conn.add(tipo_ou, 'organizationalUnit')
        logger.info(f"OU creada: {tipo_ou}")


def user_exists(username):
    """Verificar si un usuario existe en AD."""
    try:
        conn = _get_connection()
        result = conn.search(
            'DC=evaluaasi,DC=info',
            f'(sAMAccountName={username})',
            attributes=['sAMAccountName'],
        )
        conn.unbind()
        return result and len(conn.entries) > 0
    except Exception as e:
        logger.error(f"Error verificando usuario AD {username}: {e}")
        return False


def create_ad_user(
    username,
    full_name,
    given_name,
    surname,
    password,
    workstation_name,
    estandar_code,
    tipo_int,
    session_start,
    session_end,
):
    """
    Crear un usuario en Active Directory para acceso VDI.

    Replica la lógica del EXE legacy:
    - Crea el user en la OU correcta
    - Establece contraseña
    - Establece expiración (session_end + 2 días)
    - Establece ProfilePath
    - Lo agrega al grupo G_G_{workstation_name}
    - Habilita la cuenta

    Args:
        username: sAMAccountName del candidato
        full_name: Nombre completo (display)
        given_name: Nombre(s)
        surname: Apellidos
        password: Contraseña para AD
        workstation_name: Nombre del VDI (ej: VDI-OF2016-1)
        estandar_code: Código ej: ECM0054
        tipo_int: 1=simulador, 2=examen, 3=parcial
        session_start: datetime inicio
        session_end: datetime fin

    Returns:
        dict con resultado o None si falló
    """
    from ldap3 import MODIFY_REPLACE

    conn = None
    try:
        conn = _get_connection()

        # Verificar si ya existe
        conn.search(
            'DC=evaluaasi,DC=info',
            f'(sAMAccountName={username})',
            attributes=['distinguishedName', 'sAMAccountName'],
        )

        if conn.entries:
            # Usuario ya existe → actualizar
            return update_ad_user(
                username=username,
                password=password,
                workstation_name=workstation_name,
                estandar_code=estandar_code,
                tipo_int=tipo_int,
                session_start=session_start,
                session_end=session_end,
            )

        # Asegurar que las OUs existan
        _ensure_ou_exists(conn, estandar_code, tipo_int)

        ou_path = _build_ou_path(estandar_code, tipo_int)
        user_dn = f"CN={username},{ou_path}"
        upn = f"{username}@{AD_CONFIG['domain']}"
        profile_path = f"\\\\evaluaasi.info\\varios$\\perfiles\\{username}"
        expiration = session_end + timedelta(days=2)

        # Crear usuario
        user_attrs = {
            'objectClass': ['top', 'person', 'organizationalPerson', 'user'],
            'sAMAccountName': username,
            'userPrincipalName': upn,
            'givenName': given_name or username,
            'sn': surname or '',
            'displayName': full_name or username,
            'profilePath': profile_path,
            'userAccountControl': '512',  # NORMAL_ACCOUNT, enabled
        }

        conn.add(user_dn, attributes=user_attrs)

        if not conn.result['result'] == 0:
            logger.error(f"Error creando usuario AD {username}: {conn.result}")
            return None

        # Establecer contraseña (AD requiere encode especial)
        encoded_password = f'"{password}"'.encode('utf-16-le')
        conn.modify(user_dn, {
            'unicodePwd': [(MODIFY_REPLACE, [encoded_password])]
        })

        # Establecer expiración de cuenta
        # AD usa FILETIME: 100-nanosecond intervals since 1601-01-01
        filetime = int((expiration - datetime(1601, 1, 1)).total_seconds() * 10_000_000)
        conn.modify(user_dn, {
            'accountExpires': [(MODIFY_REPLACE, [str(filetime)])]
        })

        # Agregar al grupo de la workstation
        _add_to_workstation_group(conn, username, workstation_name)

        logger.info(
            f"Usuario AD creado: {username} en {ou_path}, "
            f"workstation={workstation_name}, expira={expiration.isoformat()}"
        )

        conn.unbind()
        return {
            'username': username,
            'dn': user_dn,
            'workstation_group': f'G_G_{workstation_name}',
            'expires': expiration.isoformat(),
            'action': 'created',
        }

    except Exception as e:
        logger.error(f"Error creando usuario AD {username}: {e}")
        if conn:
            try:
                conn.unbind()
            except Exception:
                pass
        return None


def update_ad_user(
    username,
    password=None,
    workstation_name=None,
    estandar_code=None,
    tipo_int=None,
    session_start=None,
    session_end=None,
):
    """
    Actualizar un usuario AD existente.
    Replica lógica del EXE: actualiza password, expiración, mueve OU, reasigna grupo.
    """
    from ldap3 import MODIFY_REPLACE

    conn = None
    try:
        conn = _get_connection()

        # Buscar usuario actual
        conn.search(
            'DC=evaluaasi,DC=info',
            f'(sAMAccountName={username})',
            attributes=['distinguishedName', 'memberOf'],
        )

        if not conn.entries:
            logger.warning(f"Usuario AD {username} no encontrado para actualizar")
            if conn:
                conn.unbind()
            return None

        current_dn = str(conn.entries[0].distinguishedName)

        # Actualizar contraseña
        if password:
            encoded_password = f'"{password}"'.encode('utf-16-le')
            conn.modify(current_dn, {
                'unicodePwd': [(MODIFY_REPLACE, [encoded_password])]
            })

        # Actualizar expiración
        if session_end:
            expiration = session_end + timedelta(days=2)
            filetime = int((expiration - datetime(1601, 1, 1)).total_seconds() * 10_000_000)
            conn.modify(current_dn, {
                'accountExpires': [(MODIFY_REPLACE, [str(filetime)])]
            })

        # Mover a OU correcta si cambió
        if estandar_code and tipo_int:
            _ensure_ou_exists(conn, estandar_code, tipo_int)
            new_ou = _build_ou_path(estandar_code, tipo_int)
            new_rdn = f"CN={username}"
            # Solo mover si la OU es diferente
            if new_ou not in current_dn:
                conn.modify_dn(current_dn, new_rdn, new_superior=new_ou)

        # Reasignar grupo de workstation
        if workstation_name:
            # Remover de grupos G_G_* actuales
            _remove_from_workstation_groups(conn, username)
            # Agregar al nuevo grupo
            _add_to_workstation_group(conn, username, workstation_name)

        logger.info(f"Usuario AD actualizado: {username}")
        conn.unbind()
        return {
            'username': username,
            'action': 'updated',
            'workstation_group': f'G_G_{workstation_name}' if workstation_name else None,
        }

    except Exception as e:
        logger.error(f"Error actualizando usuario AD {username}: {e}")
        if conn:
            try:
                conn.unbind()
            except Exception:
                pass
        return None


def delete_ad_user(username):
    """Eliminar un usuario del Active Directory."""
    conn = None
    try:
        conn = _get_connection()
        conn.search(
            'DC=evaluaasi,DC=info',
            f'(sAMAccountName={username})',
            attributes=['distinguishedName'],
        )

        if not conn.entries:
            logger.info(f"Usuario AD {username} no existe, nada que eliminar")
            conn.unbind()
            return True

        user_dn = str(conn.entries[0].distinguishedName)
        conn.delete(user_dn)
        logger.info(f"Usuario AD eliminado: {username} ({user_dn})")
        conn.unbind()
        return True

    except Exception as e:
        logger.error(f"Error eliminando usuario AD {username}: {e}")
        if conn:
            try:
                conn.unbind()
            except Exception:
                pass
        return False


def _add_to_workstation_group(conn, username, workstation_name):
    """Agregar usuario al grupo G_G_{workstation_name}."""
    group_name = f'G_G_{workstation_name}'
    try:
        conn.search(
            'DC=evaluaasi,DC=info',
            f'(sAMAccountName={group_name})',
            attributes=['distinguishedName'],
        )
        if conn.entries:
            group_dn = str(conn.entries[0].distinguishedName)
            # Buscar DN del usuario
            conn.search(
                'DC=evaluaasi,DC=info',
                f'(sAMAccountName={username})',
                attributes=['distinguishedName'],
            )
            if conn.entries:
                user_dn = str(conn.entries[0].distinguishedName)
                from ldap3 import MODIFY_ADD
                conn.modify(group_dn, {
                    'member': [(MODIFY_ADD, [user_dn])]
                })
                logger.info(f"Usuario {username} agregado al grupo {group_name}")
        else:
            logger.warning(f"Grupo AD {group_name} no encontrado")
    except Exception as e:
        # Entry already exists es OK
        if 'entryAlreadyExists' in str(e) or '00000562' in str(e):
            logger.info(f"Usuario {username} ya estaba en grupo {group_name}")
        else:
            logger.error(f"Error agregando {username} a grupo {group_name}: {e}")


def _remove_from_workstation_groups(conn, username):
    """Remover usuario de todos los grupos G_G_* (workstation groups)."""
    try:
        conn.search(
            'DC=evaluaasi,DC=info',
            f'(sAMAccountName={username})',
            attributes=['distinguishedName', 'memberOf'],
        )
        if not conn.entries:
            return

        user_dn = str(conn.entries[0].distinguishedName)
        member_of = conn.entries[0].memberOf.values if hasattr(conn.entries[0], 'memberOf') else []

        from ldap3 import MODIFY_DELETE
        for group_dn in member_of:
            group_dn_str = str(group_dn)
            if 'G_G_' in group_dn_str:
                try:
                    conn.modify(group_dn_str, {
                        'member': [(MODIFY_DELETE, [user_dn])]
                    })
                    logger.info(f"Usuario {username} removido del grupo {group_dn_str}")
                except Exception:
                    pass
    except Exception as e:
        logger.error(f"Error removiendo {username} de grupos workstation: {e}")


def provision_ad_for_session(vm_session, user, ad_password=None):
    """
    Provisionar usuario AD para una sesión VDI.
    Esta es la función principal que integra todo.

    Args:
        vm_session: VmSession object
        user: User object (candidato)
        ad_password: Contraseña específica, o se genera una

    Returns:
        dict con {username, password, action, ...} o None si falló
    """
    if not AD_CONFIG['password']:
        logger.error("AD_PASSWORD no configurado — no se puede crear usuario AD")
        return None

    if not vm_session.workstation_name:
        logger.error(f"Sesión {vm_session.id} sin workstation asignada")
        return None

    # Resolver estándar (ECM code) para la OU
    estandar_code = 'ECM0054'  # Default
    try:
        from app.services.evaluaasi_config_service import get_estandares
        from app.models.partner import Campus
        campus = Campus.query.get(vm_session.campus_id) if vm_session.campus_id else None
        if campus and campus.config_etapa_id:
            estandares = get_estandares()
            for est in estandares:
                if est.get('etapa_id') == campus.config_etapa_id:
                    estandar_code = est.get('identificador', estandar_code)
                    break
    except Exception as e:
        logger.warning(f"No se pudo resolver estándar, usando default: {e}")

    # Tipo de sesión
    tipo_map = {'simulador': 1, 'examen': 2, 'parcial': 3}
    tipo_int = tipo_map.get(vm_session.session_type, 1)

    # Construir nombre
    given_name = user.name or ''
    surname = f"{user.first_surname or ''} {user.second_surname or ''}".strip()
    full_name = f"{given_name} {surname}".strip() or user.username

    # Generar o usar contraseña
    password = ad_password or generate_ad_password()

    # Calcular inicio/fin
    session_start = datetime.combine(
        vm_session.session_date,
        datetime.min.time().replace(hour=vm_session.start_hour)
    )
    session_end = session_start + timedelta(hours=1)

    result = create_ad_user(
        username=user.username,
        full_name=full_name,
        given_name=given_name,
        surname=surname,
        password=password,
        workstation_name=vm_session.workstation_name,
        estandar_code=estandar_code,
        tipo_int=tipo_int,
        session_start=session_start,
        session_end=session_end,
    )

    if result:
        result['password'] = password
        return result

    return None


def test_ad_connection():
    """Test de conexión al Active Directory."""
    try:
        if not AD_CONFIG['password']:
            return {'ok': False, 'error': 'AD_PASSWORD no configurado'}
        conn = _get_connection()
        conn.search('DC=evaluaasi,DC=info', '(objectClass=domain)', attributes=['dc'])
        ok = len(conn.entries) > 0
        conn.unbind()
        return {'ok': ok, 'server': AD_CONFIG['server'], 'domain': AD_CONFIG['domain']}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
