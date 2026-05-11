"""
Worker que procesa la cola `curp_verification_queue`.

Diseño:
- Corre como background thread arrancado al inicializar la app.
- Cada N segundos consulta la cola por filas con status='pending'
  y next_retry_at <= now(), las "claima" con UPDATE atómico
  (locked_at, locked_by) para evitar que dos workers tomen la misma fila.
- Por cada fila intenta validar contra RENAPO (con cache).
- Política frente al circuit breaker:
    * Si está abierto (RENAPO caído): incrementa circuit_open_retries,
      reagenda next_retry_at = now + 12h, NO escala a curp_required.
- Política frente a respuesta real de RENAPO:
    * Válida → marca user.curp_verified, GroupMembers a 'active',
      status='done', BulkUploadMember.status='curp_verified'.
    * Rechazada → suma attempts. Si attempts >= MAX_ATTEMPTS_BEFORE_DELEGATE
      (default 3 reintentos reales + el inicial = 3 rondas RENAPO ≈ ~9 consultas)
      delega al usuario: GroupMembers='curp_required', status='rejected',
      BulkUploadMember.status='curp_required'.
    * Si attempts < MAX → reagenda con backoff (15min, 30min, 1h).
- Cuando termina la última fila de un batch: dispara email al admin/coord/responsable.
"""
import logging
import os
import socket
import threading
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Singleton — solo arrancar un thread por proceso
_worker_started = False
_worker_lock = threading.Lock()


def start_curp_worker(app):
    """Arranca el thread del worker. Idempotente por proceso."""
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        _worker_started = True

    worker_id = f"{socket.gethostname()}-{os.getpid()}"
    t = threading.Thread(
        target=_run_loop,
        args=(app, worker_id),
        daemon=True,
        name=f'curp-queue-worker-{worker_id}',
    )
    t.start()
    logger.info(f"[CURP-WORKER] Arrancado worker {worker_id}")


def _run_loop(app, worker_id: str):
    """Loop principal del worker."""
    POLL_INTERVAL_SECONDS = 30
    BATCH_SIZE = 5  # filas por iteración
    INTER_QUERY_SLEEP = 1.5  # respiración entre consultas RENAPO
    STALE_LOCK_SWEEP_SECONDS = 300  # liberar locks zombi cada 5 min

    # Esperar 15s al arrancar para no competir con migraciones/startup
    time.sleep(15)

    # Liberar locks "stale" de réplicas anteriores que murieron mid-procesamiento
    last_stale_sweep = 0.0
    try:
        with app.app_context():
            _release_stale_locks()
        last_stale_sweep = time.time()
    except Exception as e:
        logger.error(f"[CURP-WORKER] error liberando stale locks: {e}")

    while True:
        try:
            # Sweep periódico de stale locks: recupera filas atascadas en
            # 'processing' cuando un proceso muere o se cuelga mid-procesamiento.
            # Sin esto, las filas quedan zombi hasta el próximo reinicio del
            # container (puede ser días). Throttled a cada 5 min para no
            # martillar la DB.
            if time.time() - last_stale_sweep >= STALE_LOCK_SWEEP_SECONDS:
                try:
                    with app.app_context():
                        _release_stale_locks()
                except Exception as sweep_err:
                    logger.error(f"[CURP-WORKER] error en stale sweep periódico: {sweep_err}")
                last_stale_sweep = time.time()

            with app.app_context():
                claimed = _claim_pending_rows(worker_id, BATCH_SIZE)
                if claimed:
                    logger.info(f"[CURP-WORKER] {worker_id} procesando {len(claimed)} filas")
                    for q_id in claimed:
                        try:
                            _process_queue_row(q_id, worker_id)
                        except Exception as row_err:
                            logger.error(f"[CURP-WORKER] error procesando fila {q_id}: {row_err}")
                            _release_row_with_error(q_id, str(row_err))
                        time.sleep(INTER_QUERY_SLEEP)
                    # Verificar si terminaron batches y mandar emails
                    try:
                        _notify_completed_batches(worker_id)
                    except Exception as notif_err:
                        logger.error(f"[CURP-WORKER] error notificando batches: {notif_err}")
        except Exception as e:
            logger.error(f"[CURP-WORKER] loop error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


def _claim_pending_rows(worker_id: str, limit: int):
    """Reclama (UPDATE atómico) hasta `limit` filas listas para procesar.
    Retorna la lista de IDs reclamadas."""
    from app import db
    from sqlalchemy import text
    try:
        # MSSQL: usar OUTPUT inserted.id; PostgreSQL/SQLite: subquery.
        # Para máxima compatibilidad usamos approach de dos pasos protegido por
        # WHERE locked_at IS NULL AND status='pending' AND next_retry_at <= now.
        now = datetime.utcnow()
        # Paso 1: identificar candidatas
        candidate_ids = db.session.execute(
            text("""
                SELECT TOP (:lim) id FROM curp_verification_queue
                WHERE status = 'pending'
                  AND (locked_at IS NULL OR locked_at < :stale)
                  AND next_retry_at <= :now
                ORDER BY next_retry_at ASC
            """) if _is_mssql() else text("""
                SELECT id FROM curp_verification_queue
                WHERE status = 'pending'
                  AND (locked_at IS NULL OR locked_at < :stale)
                  AND next_retry_at <= :now
                ORDER BY next_retry_at ASC
                LIMIT :lim
            """),
            {'lim': limit, 'now': now, 'stale': now - timedelta(minutes=10)}
        ).fetchall()
        ids = [row[0] for row in candidate_ids]
        if not ids:
            return []

        # Paso 2: claim atómico (solo las que sigan libres)
        claimed = []
        for q_id in ids:
            res = db.session.execute(
                text("""
                    UPDATE curp_verification_queue
                       SET locked_at = :now,
                           locked_by = :wid,
                           status = 'processing'
                     WHERE id = :id
                       AND status = 'pending'
                       AND (locked_at IS NULL OR locked_at < :stale)
                """),
                {'now': now, 'wid': worker_id[:80], 'id': q_id, 'stale': now - timedelta(minutes=10)}
            )
            if res.rowcount == 1:
                claimed.append(q_id)
        db.session.commit()
        return claimed
    except Exception as e:
        logger.error(f"[CURP-WORKER] claim error: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
        return []


def _release_stale_locks():
    """Libera filas en status='processing' cuyo lock tenga >5 min.
    Esto rescata trabajo de réplicas anteriores que murieron a mitad de
    procesamiento. Se ejecuta una vez al arrancar el worker.
    """
    from app import db
    from sqlalchemy import text
    try:
        now = datetime.utcnow()
        res = db.session.execute(
            text("""
                UPDATE curp_verification_queue
                   SET status = 'pending',
                       locked_at = NULL,
                       locked_by = NULL
                 WHERE status = 'processing'
                   AND (locked_at IS NULL OR locked_at < :stale)
            """),
            {'stale': now - timedelta(minutes=5)}
        )
        if res.rowcount:
            logger.info(f"[CURP-WORKER] {res.rowcount} locks stale liberados al arrancar")
        db.session.commit()
    except Exception as e:
        logger.error(f"[CURP-WORKER] _release_stale_locks error: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass


def _is_mssql():
    from app import db
    try:
        return 'mssql' in str(db.engine.url).lower() or 'pymssql' in str(db.engine.url).lower()
    except Exception:
        return False


def _release_row_with_error(q_id, err_msg):
    from app import db
    from app.models.curp_verification import CurpVerificationQueue, QUEUE_PENDING
    try:
        row = CurpVerificationQueue.query.get(q_id)
        if row:
            row.status = QUEUE_PENDING
            row.locked_at = None
            row.locked_by = None
            row.last_error = (err_msg or '')[:500]
            row.next_retry_at = datetime.utcnow() + timedelta(minutes=15)
            db.session.commit()
    except Exception:
        try:
            db.session.rollback()
        except Exception:
            pass


def _process_queue_row(q_id, worker_id: str):
    """Procesa una fila reclamada de la cola."""
    from app import db
    from app.models.curp_verification import (
        CurpVerificationQueue, QUEUE_DONE, QUEUE_REJECTED, QUEUE_FAILED, QUEUE_PENDING
    )
    from app.models.user import User
    from app.models.partner import GroupMember, BulkUploadMember
    from app.services.renapo_service import (
        validate_curp_renapo, apply_renapo_to_user, validate_curp_format,
        is_renapo_circuit_open, is_generic_foreign_curp,
    )

    row = CurpVerificationQueue.query.get(q_id)
    if not row:
        return

    user = User.query.get(row.user_id)
    if not user:
        row.status = QUEUE_FAILED
        row.finished_at = datetime.utcnow()
        row.last_error = 'Usuario ya no existe'
        db.session.commit()
        return

    # Si la CURP del usuario ya cambió, abortamos esta entrada (la nueva habrá creado otra)
    if (user.curp or '').upper().strip() != (row.curp or '').upper().strip():
        row.status = QUEUE_FAILED
        row.finished_at = datetime.utcnow()
        row.last_error = 'CURP del usuario cambió antes de que se procesara la cola'
        db.session.commit()
        return

    # CURP genérica de extranjero — aceptar inmediato sin RENAPO
    if is_generic_foreign_curp(row.curp):
        for gm in GroupMember.query.filter_by(user_id=user.id).all():
            if gm.status in ('curp_pending', 'curp_verifying', 'curp_required'):
                gm.status = 'active'
        if row.batch_id:
            mr = BulkUploadMember.query.filter_by(batch_id=row.batch_id, user_id=user.id).first()
            if mr:
                mr.status = 'curp_verified'
        row.status = QUEUE_DONE
        row.finished_at = datetime.utcnow()
        db.session.commit()
        return

    # Validar formato (defensivo — debería estar OK ya)
    fmt_ok, fmt_err = validate_curp_format(row.curp)
    if not fmt_ok:
        # Formato inválido — delegar al usuario (no es culpa de RENAPO)
        for gm in GroupMember.query.filter_by(user_id=user.id).all():
            if gm.status in ('curp_pending', 'curp_verifying', 'active'):
                gm.status = 'curp_required'
        if row.batch_id:
            mr = BulkUploadMember.query.filter_by(batch_id=row.batch_id, user_id=user.id).first()
            if mr:
                mr.status = 'curp_required'
                mr.error_message = f'Formato inválido: {fmt_err}'[:500]
        row.status = QUEUE_REJECTED
        row.finished_at = datetime.utcnow()
        row.last_error = f'Formato inválido: {fmt_err}'[:500]
        db.session.commit()
        return

    # Si circuit breaker abierto: NO consultar, reagendar 12h
    if is_renapo_circuit_open():
        row.circuit_open_retries = (row.circuit_open_retries or 0) + 1
        row.last_error = 'RENAPO no disponible (circuit breaker)'
        row.next_retry_at = datetime.utcnow() + timedelta(
            hours=CurpVerificationQueue.CIRCUIT_OPEN_BACKOFF_HOURS
        )
        row.status = QUEUE_PENDING
        row.locked_at = None
        row.locked_by = None
        db.session.commit()
        logger.info(f"[CURP-WORKER] RENAPO caído, reagendando q={row.id} para "
                    f"{row.next_retry_at.isoformat()} (intento circuit #{row.circuit_open_retries})")
        return

    # Consultar RENAPO (con cache). El servicio cachea positivos 30d, negativos 1h.
    result = validate_curp_renapo(row.curp, use_cache=True)

    # Distinguir "circuit-open" devuelto por el servicio (NO consume reintento)
    if (result.error or '').lower().startswith('servicio renapo temporalmente no disponible'):
        row.circuit_open_retries = (row.circuit_open_retries or 0) + 1
        row.last_error = result.error[:500]
        row.next_retry_at = datetime.utcnow() + timedelta(
            hours=CurpVerificationQueue.CIRCUIT_OPEN_BACKOFF_HOURS
        )
        row.status = QUEUE_PENDING
        row.locked_at = None
        row.locked_by = None
        db.session.commit()
        return

    row.attempts = (row.attempts or 0) + 1

    if result.valid:
        try:
            apply_renapo_to_user(user, result)
            user.is_active = True
            for gm in GroupMember.query.filter_by(user_id=user.id).all():
                if gm.status in ('curp_pending', 'curp_verifying', 'curp_required'):
                    gm.status = 'active'
            if row.batch_id:
                mr = BulkUploadMember.query.filter_by(batch_id=row.batch_id, user_id=user.id).first()
                if mr:
                    mr.status = 'curp_verified'
            row.status = QUEUE_DONE
            row.finished_at = datetime.utcnow()
            db.session.commit()
            logger.info(f"[CURP-WORKER] q={row.id} CURP {row.curp} VÁLIDA — usuario {user.id}")
            # Notificar al usuario si fue una corrección self-fix
            if row.source == 'self_fix':
                try:
                    _send_self_fix_email(user, row.curp, success=True, result=result)
                except Exception as mail_err:
                    logger.error(f"[CURP-WORKER] q={row.id} no se pudo enviar email éxito a {user.id}: {mail_err}")
        except Exception as apply_err:
            logger.error(f"[CURP-WORKER] q={row.id} error aplicando RENAPO: {apply_err}")
            try:
                db.session.rollback()
            except Exception:
                pass
            row.last_error = str(apply_err)[:500]
            row.next_retry_at = datetime.utcnow() + timedelta(minutes=15)
            row.status = QUEUE_PENDING
            row.locked_at = None
            row.locked_by = None
            db.session.commit()
        return

    # No válida: decidir si delegar al usuario o reintentar
    row.last_error = (result.error or 'no encontrada')[:500]
    if row.attempts >= CurpVerificationQueue.MAX_RENAPO_ATTEMPTS_BEFORE_DELEGATE:
        # Delegar — RENAPO respondió y rechazó la CURP
        for gm in GroupMember.query.filter_by(user_id=user.id).all():
            if gm.status in ('curp_pending', 'curp_verifying', 'active'):
                gm.status = 'curp_required'
        if row.batch_id:
            mr = BulkUploadMember.query.filter_by(batch_id=row.batch_id, user_id=user.id).first()
            if mr:
                mr.status = 'curp_required'
                mr.error_message = f'CURP rechazada por RENAPO tras {row.attempts} intentos: {row.last_error}'[:500]
        row.status = QUEUE_REJECTED
        row.finished_at = datetime.utcnow()
        db.session.commit()
        logger.info(f"[CURP-WORKER] q={row.id} CURP {row.curp} delegada a usuario tras {row.attempts} intentos")
        # Notificar al usuario si fue una corrección self-fix
        if row.source == 'self_fix':
            try:
                _send_self_fix_email(user, row.curp, success=False, error_msg=row.last_error)
            except Exception as mail_err:
                logger.error(f"[CURP-WORKER] q={row.id} no se pudo enviar email rechazo a {user.id}: {mail_err}")
    else:
        # Reintentar con backoff: 15min, 30min, 1h, 2h, 4h
        backoff_minutes = 15 * (2 ** (row.attempts - 1))
        row.next_retry_at = datetime.utcnow() + timedelta(minutes=backoff_minutes)
        row.status = QUEUE_PENDING
        row.locked_at = None
        row.locked_by = None
        db.session.commit()
        logger.info(f"[CURP-WORKER] q={row.id} reintento #{row.attempts}, próximo en {backoff_minutes}min")


# ---------------------------------------------------------------------------
# Email de notificación al terminar batches
# ---------------------------------------------------------------------------

def _notify_completed_batches(worker_id: str):
    """Detecta batches cuyas filas en la cola ya terminaron todas (done o
    rejected) y envía un email único de notificación al admin/coord/responsable.
    Marca el batch como notificado usando un flag implícito: la columna
    `emails_sent` del BulkUploadBatch — si llamamos `validation_email_sent_at`
    a un campo nuevo, hay que migrarlo. Para evitar nueva columna, usamos
    `bulk_upload_batches.original_filename` con un sufijo... NO. Mejor agregar
    un memo en logs y usar tabla `curp_verification_queue` con consulta:
    ya no hay filas pending/processing del batch Y no se ha registrado
    ya el envío. Para idempotencia usamos un set en memoria + verificación
    en cada loop (suficiente para 2 workers gunicorn).
    """
    from app import db
    from app.models.curp_verification import (
        CurpVerificationQueue, QUEUE_PENDING, QUEUE_PROCESSING
    )
    from app.models.partner import BulkUploadBatch
    from sqlalchemy import func, case

    open_expr = case(
        (CurpVerificationQueue.status.in_([QUEUE_PENDING, QUEUE_PROCESSING]), 1),
        else_=0,
    )
    candidate_batches = db.session.query(
        CurpVerificationQueue.batch_id,
        func.sum(open_expr).label('open_count'),
        func.count(CurpVerificationQueue.id).label('total'),
    ).filter(
        CurpVerificationQueue.batch_id.isnot(None)
    ).group_by(CurpVerificationQueue.batch_id).having(
        func.sum(open_expr) == 0
    ).all()

    for batch_id, _open, _total in candidate_batches:
        batch = BulkUploadBatch.query.get(batch_id)
        if not batch:
            continue
        # idempotencia: usamos campo `emails_failed` < 0 como flag... mejor
        # un campo nuevo `validation_email_sent_at`. Se agrega via auto_migrate.
        if getattr(batch, 'validation_email_sent_at', None):
            continue
        try:
            _send_batch_completion_email(batch)
            batch.validation_email_sent_at = datetime.utcnow()
            db.session.commit()
        except Exception as e:
            logger.error(f"[CURP-WORKER] error enviando email batch {batch_id}: {e}")
            try:
                db.session.rollback()
            except Exception:
                pass


def _send_batch_completion_email(batch):
    """Envía email al admin/coord/responsable (si tiene bulk-perm) con el
    resumen de validación CURP del batch."""
    from app.models.user import User
    from app.models.curp_verification import CurpVerificationQueue, QUEUE_DONE, QUEUE_REJECTED
    from app.services.email_service import send_email

    # Stats
    total = CurpVerificationQueue.query.filter_by(batch_id=batch.id).count()
    verified = CurpVerificationQueue.query.filter_by(batch_id=batch.id, status=QUEUE_DONE).count()
    rejected = CurpVerificationQueue.query.filter_by(batch_id=batch.id, status=QUEUE_REJECTED).count()

    # Destinatarios
    recipients = set()
    # 1. Admin/coord que subió
    uploader = User.query.get(batch.uploaded_by_id) if batch.uploaded_by_id else None
    if uploader and uploader.email:
        recipients.add(uploader.email)
        # Si fue subido por responsable, agregar al coordinador
        if uploader.role == 'responsable' and uploader.coordinator_id:
            coord = User.query.get(uploader.coordinator_id)
            if coord and coord.email:
                recipients.add(coord.email)
        # Si fue subido por coordinador/auxiliar, no hay otro a quien notificar.
        # Si fue subido por admin: no se envía a nadie más.
    # 2. Responsables del campus (solo si tienen bulk-perm)
    if batch.campus_id:
        responsables = User.query.filter(
            User.role == 'responsable',
            User.campus_id == batch.campus_id,
            User.can_bulk_create_candidates == True,
            User.email.isnot(None),
        ).all()
        for r in responsables:
            recipients.add(r.email)

    if not recipients:
        logger.info(f"[CURP-WORKER] batch {batch.id} sin destinatarios para email")
        return

    subject = f"Validación de CURPs completada — {batch.original_filename or 'carga masiva'}"
    body = f"""
<p>La validación contra RENAPO de la carga masiva ha terminado.</p>
<ul>
  <li><strong>Plantel:</strong> {batch.campus_name or '—'}</li>
  <li><strong>Grupo:</strong> {batch.group_name or '—'}</li>
  <li><strong>Total CURPs procesadas:</strong> {total}</li>
  <li><strong>Validadas exitosamente:</strong> {verified}</li>
  <li><strong>Pendientes de corrección por el candidato:</strong> {rejected}</li>
</ul>
<p>Las CURPs no validadas tras varios reintentos quedaron marcadas como
<code>curp_required</code>. Los candidatos podrán corregirlas al iniciar sesión.</p>
"""
    try:
        for to_email in recipients:
            send_email(to=to_email, subject=subject, html=body)
        logger.info(f"[CURP-WORKER] email enviado a {len(recipients)} destinatarios para batch {batch.id}")
    except Exception as e:
        logger.error(f"[CURP-WORKER] error enviando email batch {batch.id}: {e}")
        raise


# ---------------------------------------------------------------------------
# Helpers para enqueue desde otros módulos
# ---------------------------------------------------------------------------

def enqueue_curp_verification(user_id: str, curp: str, source: str = 'bulk', batch_id: int = None):
    """Encola una verificación CURP. Idempotente — no duplica si ya hay
    una entrada pending/processing para el mismo (user_id, curp).
    """
    from app import db
    from app.models.curp_verification import CurpVerificationQueue, QUEUE_PENDING, QUEUE_PROCESSING

    curp = (curp or '').upper().strip()
    if not curp or not user_id:
        return None
    try:
        existing = CurpVerificationQueue.query.filter_by(
            user_id=user_id,
            curp=curp,
        ).filter(
            CurpVerificationQueue.status.in_([QUEUE_PENDING, QUEUE_PROCESSING])
        ).first()
        if existing:
            return existing.id

        row = CurpVerificationQueue(
            user_id=user_id,
            curp=curp,
            source=source,
            batch_id=batch_id,
            status=QUEUE_PENDING,
            next_retry_at=datetime.utcnow(),
        )
        db.session.add(row)
        db.session.commit()
        return row.id
    except Exception as e:
        logger.error(f"[CURP-WORKER] enqueue error: {e}")
        try:
            db.session.rollback()
        except Exception:
            pass
        return None


# ---------------------------------------------------------------------------
# Email al USUARIO (self-fix) cuando termina la validación de su propia CURP
# ---------------------------------------------------------------------------

def _send_self_fix_email(user, curp: str, success: bool, result=None, error_msg: str = None):
    """Envía un correo al propio usuario notificándole el resultado de su
    intento de corregir la CURP. Best-effort: si no tiene email, simplemente
    se omite (el desbloqueo del usuario ya ocurrió en la transacción previa).
    """
    if not user or not getattr(user, 'email', None):
        logger.info(f"[CURP-WORKER] self_fix sin email para user={getattr(user,'id',None)} — solo desbloqueo silencioso")
        return

    from app.services.email_service import send_email
    from flask import current_app

    # Construir URL de regreso al dashboard si está disponible
    try:
        frontend_url = current_app.config.get('FRONTEND_URL') or current_app.config.get('PUBLIC_URL') or ''
    except Exception:
        frontend_url = ''
    dashboard_link = f"{frontend_url.rstrip('/')}/dashboard" if frontend_url else None

    nombre_display = (getattr(user, 'name', '') or '').strip() or user.email

    if success:
        subject = 'Tu CURP fue validada correctamente'
        renapo_block = ''
        if result is not None:
            try:
                renapo_block = (
                    '<p style="margin:16px 0 8px 0;color:#444"><b>Datos verificados con RENAPO:</b></p>'
                    f'<ul style="margin:0;padding-left:20px;color:#444">'
                    f'<li>Nombre: {(result.name or "—")}</li>'
                    f'<li>Primer apellido: {(result.first_surname or "—")}</li>'
                    f'<li>Segundo apellido: {(result.second_surname or "—")}</li>'
                    f'</ul>'
                )
            except Exception:
                renapo_block = ''
        link_html = (
            f'<p><a href="{dashboard_link}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Ir a mi dashboard</a></p>'
            if dashboard_link else ''
        )
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
          <h2 style="color:#16a34a;margin:0 0 8px 0">✓ Tu CURP fue validada</h2>
          <p>Hola {nombre_display},</p>
          <p>Tu CURP <b>{curp}</b> fue validada exitosamente contra RENAPO. Ya puedes
             continuar usando la plataforma con normalidad.</p>
          {renapo_block}
          {link_html}
          <p style="color:#777;font-size:12px;margin-top:24px">
             Si no realizaste esta solicitud, por favor avisa a tu coordinador.
          </p>
        </div>
        """
        plain = (
            f"Hola {nombre_display},\n\n"
            f"Tu CURP {curp} fue validada exitosamente contra RENAPO. "
            f"Ya puedes continuar usando la plataforma.\n"
        )
    else:
        subject = 'No pudimos validar tu CURP'
        link_html = (
            f'<p><a href="{dashboard_link}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Corregir mi CURP</a></p>'
            if dashboard_link else ''
        )
        err_detail = f'<p style="color:#666;font-size:13px"><b>Detalle:</b> {error_msg or "CURP no encontrada en RENAPO"}</p>' if error_msg else ''
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
          <h2 style="color:#dc2626;margin:0 0 8px 0">✗ No pudimos validar tu CURP</h2>
          <p>Hola {nombre_display},</p>
          <p>La CURP <b>{curp}</b> no pudo ser validada contra RENAPO después de
             varios intentos. Por favor revisa que esté escrita exactamente como
             aparece en tu documento oficial (acta de nacimiento o constancia
             CURP) y vuelve a intentarlo desde tu perfil.</p>
          {err_detail}
          {link_html}
          <p style="color:#777;font-size:12px;margin-top:24px">
             Si crees que se trata de un error, contacta a tu coordinador.
          </p>
        </div>
        """
        plain = (
            f"Hola {nombre_display},\n\n"
            f"No pudimos validar tu CURP {curp} contra RENAPO. Por favor verifica "
            f"que esté escrita correctamente y vuelve a intentarlo desde tu perfil.\n"
        )

    try:
        ok = send_email(to=user.email, subject=subject, html=html, plain_text=plain)
        if ok:
            logger.info(f"[CURP-WORKER] self_fix email OK to={user.email} success={success}")
        else:
            logger.warning(f"[CURP-WORKER] self_fix email FAIL to={user.email}")
    except Exception as e:
        logger.error(f"[CURP-WORKER] self_fix email exception to={user.email}: {e}")
