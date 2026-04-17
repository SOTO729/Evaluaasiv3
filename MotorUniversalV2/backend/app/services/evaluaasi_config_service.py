"""
Servicio de integración con la base de datos EvaluaasiConfig.
Gestiona la comunicación con la DB legacy para:
  - Leer equipos/VDIs disponibles (dbo.Equipo)
  - Leer/escribir sesiones (dbo.Sesion)
  - Leer horarios configurados (dbo.Horarios)
  - Leer subsistemas (dbo.Subsistemas)
  - Leer estándares/certificaciones (dbo.Estandar)

Todas las operaciones usan pymssql para conectar a Azure SQL.
"""
import os
import time
import logging
from datetime import datetime, date, timedelta
from contextlib import contextmanager
from functools import wraps

logger = logging.getLogger(__name__)

# Configuración de conexión a EvaluaasiConfig
EVALUAASI_CONFIG_DB = {
    'server': os.environ.get('EVALUAASI_CONFIG_SERVER', 'evaluaasi-general.database.windows.net'),
    'user': os.environ.get('EVALUAASI_CONFIG_USER', 'AdminGeneral'),
    'password': os.environ.get('EVALUAASI_CONFIG_PASSWORD', ''),
    'database': os.environ.get('EVALUAASI_CONFIG_DATABASE', 'EvaluaasiConfig'),
}

# Tipos de sesión (mapean a dbo.Sesion.Tipo)
SESSION_TYPES = {
    'simulador': 1,
    'examen': 2,
    'parcial': 3,
}
SESSION_TYPE_LABELS = {v: k for k, v in SESSION_TYPES.items()}

# Tipos de certificación de VDI
VDI_CERT_TYPES = {
    'OFFICE-2019': 'office',
    'OFFICE-2016': 'office',
    'AZ900': 'az900',
}


def retry_on_failure(max_retries=3, base_delay=1.0, operation_name='operation'):
    """
    Decorador para reintentar operaciones que pueden fallar por timeout o conexión.
    Usa backoff exponencial: 1s, 2s, 4s.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        logger.warning(
                            f"{operation_name} intento {attempt + 1}/{max_retries} falló: {e}. "
                            f"Reintentando en {delay:.1f}s..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"{operation_name} falló después de {max_retries} intentos: {e}"
                        )
            raise last_exception
        return wrapper
    return decorator


@contextmanager
def get_config_connection():
    """Context manager para conexión a EvaluaasiConfig DB."""
    import pymssql
    conn = None
    try:
        conn = pymssql.connect(
            server=EVALUAASI_CONFIG_DB['server'],
            user=EVALUAASI_CONFIG_DB['user'],
            password=EVALUAASI_CONFIG_DB['password'],
            database=EVALUAASI_CONFIG_DB['database'],
            login_timeout=10,
            timeout=30,
        )
        yield conn
    except Exception as e:
        logger.error(f"Error conectando a EvaluaasiConfig: {e}")
        raise
    finally:
        if conn:
            conn.close()


def get_active_workstations(cert_type=None):
    """
    Obtener VDIs activas de dbo.Equipo.
    
    Args:
        cert_type: filtrar por tipo (OFFICE-2019, AZ900, etc.). None = todas.
    
    Returns:
        Lista de dicts con EquipoId, Nombre, Color, Certificacion, Soporte.
        Ordenados por EquipoId (garantiza llenado secuencial).
    """
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            query = """
                SELECT EquipoId, Nombre, Color, Activo, Soporte, Certificacion
                FROM dbo.Equipo
                WHERE Activo = 1 AND Soporte = 0
            """
            params = ()
            if cert_type:
                query += " AND Certificacion = %s"
                params = (cert_type,)
            query += " ORDER BY EquipoId ASC"
            
            cursor.execute(query, params if params else None)
            rows = cursor.fetchall()
            return [_normalize_workstation(r) for r in rows]
    except Exception as e:
        logger.error(f"Error obteniendo workstations: {e}")
        return []


def _normalize_workstation(row):
    """Normalizar keys de dbo.Equipo a snake_case."""
    return {
        'equipo_id': row.get('EquipoId'),
        'nombre': row.get('Nombre'),
        'color': row.get('Color'),
        'activo': row.get('Activo'),
        'soporte': row.get('Soporte'),
        'cert_type': row.get('Certificacion'),
    }


def get_all_workstations():
    """Obtener TODAS las VDIs (activas e inactivas) para administración."""
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute("""
                SELECT EquipoId, Nombre, Color, Activo, Soporte, Certificacion
                FROM dbo.Equipo
                ORDER BY EquipoId ASC
            """)
            rows = cursor.fetchall()
            return [_normalize_workstation(r) for r in rows]
    except Exception as e:
        logger.error(f"Error obteniendo todas las workstations: {e}")
        return []


def get_configured_schedules(schedule_type='office'):
    """
    Obtener horarios configurados de dbo.Horarios o dbo.Horarios_AZ900.
    
    Returns:
        Lista de dicts con Id, Hora, Simulador, Examen, Disponible.
    """
    table = 'dbo.Horarios_AZ900' if schedule_type == 'az900' else 'dbo.Horarios'
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute(f"SELECT * FROM {table} ORDER BY Id")
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error obteniendo horarios: {e}")
        return []


def get_sessions_for_date(target_date, cert_type=None):
    """
    Obtener sesiones activas de EvaluaasiConfig para una fecha dada.
    
    Args:
        target_date: date object
        cert_type: 'OFFICE-2019' o 'AZ900' para filtrar por tipo de VDI
    
    Returns:
        Lista de sesiones con datos del equipo asignado.
    """
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            query = """
                SELECT s.SesionId, s.SubsistemaId, s.PlantelId, s.EquipoId,
                       s.CertificacionId, s.EtapaId, s.NombreUsuario,
                       s.Tipo, s.Activa, s.Inicio, s.Final, s.Completado,
                       e.Nombre AS EquipoNombre, e.Color AS EquipoColor,
                       e.Certificacion AS EquipoCertificacion
                FROM dbo.Sesion s
                LEFT JOIN dbo.Equipo e ON s.EquipoId = e.EquipoId
                WHERE CAST(s.Inicio AS DATE) = %s AND s.Activa = 1
            """
            params = [target_date.isoformat()]
            
            if cert_type:
                query += " AND e.Certificacion = %s"
                params.append(cert_type)
            
            query += " ORDER BY s.Inicio ASC, s.EquipoId ASC"
            cursor.execute(query, params)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error obteniendo sesiones para {target_date}: {e}")
        return []


def get_occupied_workstations(target_date, start_hour, end_hour=None):
    """
    Obtener IDs de equipos ocupados en un slot de fecha+hora.
    
    Args:
        target_date: date
        start_hour: int (0-23)
        end_hour: int (default: start_hour + 1)
    
    Returns:
        Set de EquipoId ocupados.
    """
    if end_hour is None:
        end_hour = start_hour + 1
    
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor()
            # Una sesión ocupa el slot si su rango [Inicio, Final) intersecta [start, end)
            slot_start = datetime.combine(target_date, datetime.min.time().replace(hour=start_hour))
            slot_end = datetime.combine(target_date, datetime.min.time().replace(hour=end_hour))
            
            cursor.execute("""
                SELECT DISTINCT s.EquipoId
                FROM dbo.Sesion s
                WHERE s.Activa = 1
                  AND s.Inicio < %s
                  AND s.Final > %s
            """, (slot_end, slot_start))
            
            return {row[0] for row in cursor.fetchall()}
    except Exception as e:
        logger.error(f"Error obteniendo equipos ocupados: {e}")
        return set()


def assign_workstation(target_date, start_hour, end_hour=None, cert_type='OFFICE-2019'):
    """
    Asignar un VDI disponible usando la lógica de llenado secuencial (6-by-6).
    
    Prioridad:
      1. VDIs con menor EquipoId primero (secuencial)
      2. Solo VDIs activas y no de soporte
      3. Excluir VDIs ya ocupadas en ese slot
    
    Args:
        target_date: date
        start_hour: int
        end_hour: int (default: start_hour + 1)
        cert_type: 'OFFICE-2019' o 'AZ900'
    
    Returns:
        Dict con VDI asignada o None si no hay disponibles.
    """
    if end_hour is None:
        end_hour = start_hour + 1
    
    occupied = get_occupied_workstations(target_date, start_hour, end_hour)
    active_vdis = get_active_workstations(cert_type)
    
    for vdi in active_vdis:
        if vdi['equipo_id'] not in occupied:
            return {
                'equipo_id': vdi['equipo_id'],
                'nombre': vdi['nombre'],
                'color': vdi['color'],
                'certificacion': vdi['cert_type'],
            }
    
    return None  # No hay VDIs disponibles


@retry_on_failure(max_retries=3, base_delay=1.0, operation_name='create_config_session')
def create_config_session(
    subsistema_id, plantel_id, equipo_id, certificacion_id, etapa_id,
    nombre_usuario, tipo, inicio, final, nombre=None
):
    """
    Crear una sesión en dbo.Sesion de EvaluaasiConfig.
    
    Args:
        subsistema_id: int — ID del subsistema (maps to partner/org)
        plantel_id: int — ID del plantel
        equipo_id: int — ID del VDI asignado
        certificacion_id: int — ID de la certificación
        etapa_id: int — ID de la etapa
        nombre_usuario: str — Username del candidato (same as AD login)
        tipo: int — 1=simulador, 2=examen, 3=parcial
        inicio: datetime — inicio de la sesión
        final: datetime — fin de la sesión
        nombre: str — (ignored, dbo.Sesion has no Nombre column)
    
    Returns:
        UUID de la sesión creada o None si falló
    """
    with get_config_connection() as conn:
        cursor = conn.cursor()
        now = datetime.utcnow()
        cursor.execute("""
            INSERT INTO dbo.Sesion 
            (SubsistemaId, PlantelId, EquipoId, CertificacionId, EtapaId,
             NombreUsuario, Tipo, Activa, Inicio, Final, FechaCreacion, 
             FechaModificacion, Completado)
            OUTPUT INSERTED.SesionId
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s, %s, %s, %s, 0)
        """, (
            subsistema_id, plantel_id, equipo_id, certificacion_id, etapa_id,
            nombre_usuario, tipo, inicio, final, now, now
        ))
        result = cursor.fetchone()
        conn.commit()
        session_id = str(result[0]) if result else None
        logger.info(f"Sesión creada en EvaluaasiConfig: {session_id} para {nombre_usuario}")
        return session_id


@retry_on_failure(max_retries=2, base_delay=1.0, operation_name='cancel_config_session')
def cancel_config_session(session_id):
    """Desactivar una sesión en EvaluaasiConfig (Activa = 0)."""
    with get_config_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE dbo.Sesion 
            SET Activa = 0, FechaModificacion = %s
            WHERE SesionId = %s
        """, (datetime.utcnow(), session_id))
        conn.commit()
        logger.info(f"Sesión {session_id} cancelada en EvaluaasiConfig")
        return True


@retry_on_failure(max_retries=2, base_delay=1.0, operation_name='complete_config_session')
def complete_config_session(session_id):
    """Marcar una sesión como completada en EvaluaasiConfig."""
    with get_config_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE dbo.Sesion 
            SET Completado = 1, Activa = 0, FechaModificacion = %s
            WHERE SesionId = %s
        """, (datetime.utcnow(), session_id))
        conn.commit()
        logger.info(f"Sesión {session_id} completada en EvaluaasiConfig")
        return True


def get_available_slot_count(target_date, start_hour, cert_type=None):
    """
    Contar cuántas VDIs están disponibles en un slot dado.
    
    Returns:
        Dict con total_vdis, occupied, available.
    """
    active_vdis = get_active_workstations(cert_type)
    total = len(active_vdis)
    occupied = get_occupied_workstations(target_date, start_hour)
    
    # Solo contar ocupados que son de tipo correcto
    active_ids = {v['equipo_id'] for v in active_vdis}
    occupied_relevant = occupied & active_ids
    
    return {
        'total_vdis': total,
        'occupied': len(occupied_relevant),
        'available': total - len(occupied_relevant),
    }


def get_subsistemas():
    """Obtener lista de subsistemas (para mapear partners)."""
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute("""
                SELECT SubsistemaId, Nombre, Abreviatura, Activo
                FROM dbo.Subsistemas
                WHERE Activo = 1
                ORDER BY SubsistemaId
            """)
            rows = cursor.fetchall()
            return [{
                'subsistema_id': r['SubsistemaId'],
                'nombre': r['Nombre'],
                'abreviatura': r['Abreviatura'],
                'activo': r['Activo'],
            } for r in rows]
    except Exception as e:
        logger.error(f"Error obteniendo subsistemas: {e}")
        return []


def get_estandares():
    """Obtener lista de estándares/certificaciones."""
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute("""
                SELECT EstadarId, Identificador, Nombre, EtapaId, UsaMotor
                FROM dbo.Estandar
                ORDER BY EstadarId
            """)
            rows = cursor.fetchall()
            return [{
                'estandar_id': r['EstadarId'],
                'identificador': r['Identificador'],
                'nombre': r['Nombre'],
                'etapa_id': r['EtapaId'],
                'usa_motor': r['UsaMotor'],
            } for r in rows]
    except Exception as e:
        logger.error(f"Error obteniendo estándares: {e}")
        return []


def get_cert_type_for_estandar(estandar_id):
    """
    Resolver el tipo de certificación de VDI (OFFICE-2019 o AZ900) desde un EstandarId.
    Lee dbo.Estandar y determina según el nombre/identificador.
    
    Args:
        estandar_id: int — ID en dbo.Estandar
    
    Returns:
        str: 'AZ900' o 'OFFICE-2019' (default)
    """
    if not estandar_id:
        return 'OFFICE-2019'
    
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute("""
                SELECT Identificador, Nombre
                FROM dbo.Estandar
                WHERE EstadarId = %s
            """, (estandar_id,))
            row = cursor.fetchone()
            if row:
                identificador = (row.get('Identificador') or '').upper()
                nombre = (row.get('Nombre') or '').upper()
                if 'AZ900' in identificador or 'AZ900' in nombre or 'AZ-900' in nombre:
                    return 'AZ900'
        return 'OFFICE-2019'
    except Exception as e:
        logger.warning(f"Error resolviendo cert_type para estandar {estandar_id}: {e}")
        return 'OFFICE-2019'


def validate_schedule_slot(start_hour, session_type='simulador', cert_type='OFFICE-2019'):
    """
    Validar que un horario está permitido según dbo.Horarios.
    
    Args:
        start_hour: int (0-23)
        session_type: 'simulador', 'examen', 'parcial'
        cert_type: 'OFFICE-2019' o 'AZ900'
    
    Returns:
        dict: {valid: bool, reason: str}
    """
    schedule_type = 'az900' if cert_type == 'AZ900' else 'office'
    schedules = get_configured_schedules(schedule_type)
    
    if not schedules:
        # Si no hay horarios configurados, permitir cualquier hora
        return {'valid': True, 'reason': 'Sin restricciones de horario configuradas'}
    
    # Buscar el slot en la tabla de horarios
    hour_str = f'{start_hour:02d}:00'
    matching_slot = None
    for slot in schedules:
        slot_hora = slot.get('Hora')
        if slot_hora:
            # Comparar hora (puede ser string "08:00" o time object)
            slot_hora_str = str(slot_hora).split('.')[0]  # Remove microseconds if any
            if slot_hora_str.startswith(hour_str) or slot_hora_str == f'{start_hour}:00:00':
                matching_slot = slot
                break
    
    if not matching_slot:
        return {'valid': False, 'reason': f'Horario {hour_str} no está configurado'}
    
    # Verificar si el tipo de sesión está habilitado en ese horario
    if session_type == 'examen' and not matching_slot.get('Examen', False):
        return {'valid': False, 'reason': f'Horario {hour_str} no permite exámenes'}
    
    if session_type in ('simulador', 'parcial') and not matching_slot.get('Simulador', False):
        return {'valid': False, 'reason': f'Horario {hour_str} no permite simuladores'}
    
    return {'valid': True, 'reason': 'Horario válido'}


def update_workstation_status(equipo_id, activo):
    """
    Activar o desactivar una VDI (para administración).
    
    Args:
        equipo_id: int
        activo: bool
    """
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE dbo.Equipo 
                SET Activo = %s 
                WHERE EquipoId = %s
            """, (1 if activo else 0, equipo_id))
            conn.commit()
            logger.info(f"VDI {equipo_id} {'activada' if activo else 'desactivada'}")
            return True
    except Exception as e:
        logger.error(f"Error actualizando VDI {equipo_id}: {e}")
        return False


def test_connection():
    """Probar conexión a EvaluaasiConfig."""
    try:
        with get_config_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            return True
    except Exception as e:
        logger.error(f"Error de conexión a EvaluaasiConfig: {e}")
        return False
