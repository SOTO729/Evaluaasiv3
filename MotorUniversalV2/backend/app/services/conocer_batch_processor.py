"""
Servicio de procesamiento en segundo plano para carga masiva de certificados CONOCER.
Procesa un ZIP de PDFs: parsea cada uno, hace matching, sube blobs y crea registros.

Optimizado para batches grandes (cientos/miles de PDFs):
- Pasada 1 solo guarda metadata ligera (no retiene pdf_bytes en RAM)
- Pasada 2 re-lee cada PDF del ZIP bajo demanda
- Lookups de BD en batch (no N+1 queries)
- Commits en lotes para evitar transacciones gigantes
- Progreso actualizado cada N archivos para visibilidad en frontend

Flujo:
1. Recibe batch_id de un ConocerUploadBatch con status='queued'
2. Descarga el ZIP del blob temporal
3. Pasada 1: Escanea todos los PDFs, extrae CURP+ECM, deduplica (queda el último)
4. Pasada 2: Por cada PDF ganador, re-lee del ZIP, hace matching y sube blob
5. Actualiza contadores y marca batch como completed/failed
"""
import io
import os
import time
import zipfile
import threading
from datetime import datetime
from typing import Dict, Tuple, Optional, Set

from app.services.conocer_pdf_parser import parse_conocer_pdf, parse_issue_date

# Cuántos logs de failure insertar antes de hacer commit (evita transacciones enormes)
FAILURE_COMMIT_BATCH_SIZE = 50


def process_batch_background(app, batch_id: int):
    """
    Lanza el procesamiento del batch en un thread separado.
    """
    thread = threading.Thread(
        target=_process_batch_worker,
        args=(app, batch_id),
        name=f'conocer-batch-{batch_id}',
        daemon=True
    )
    thread.start()
    return thread


def _process_batch_worker(app, batch_id: int):
    """Worker que ejecuta dentro del thread con contexto Flask."""
    with app.app_context():
        try:
            _process_batch(batch_id)
        except Exception as e:
            import traceback
            traceback.print_exc()
            try:
                from app import db
                from app.models.conocer_upload import ConocerUploadBatch
                batch = ConocerUploadBatch.query.get(batch_id)
                if batch:
                    batch.status = 'failed'
                    batch.error_message = f'Error inesperado: {str(e)[:500]}'
                    batch.completed_at = datetime.utcnow()
                    db.session.commit()
            except Exception:
                pass


def _process_batch(batch_id: int):
    """Lógica principal de procesamiento de un batch."""
    from app import db
    from app.models import User
    from app.models.conocer_certificate import ConocerCertificate
    from app.models.conocer_upload import ConocerUploadBatch, ConocerUploadLog
    from app.models.competency_standard import CompetencyStandard
    from app.models.partner import EcmCandidateAssignment
    from app.services.conocer_blob_service import get_conocer_blob_service

    batch = ConocerUploadBatch.query.get(batch_id)
    if not batch or batch.status != 'queued':
        print(f"[CONOCER-BATCH] Batch {batch_id} no encontrado o no está en estado 'queued'")
        return

    batch.status = 'processing'
    batch.started_at = datetime.utcnow()
    db.session.commit()

    print(f"[CONOCER-BATCH] Iniciando procesamiento del batch {batch_id}: {batch.filename}")

    # === Descargar ZIP del blob temporal ===
    try:
        from azure.storage.blob import BlobServiceClient as _BSC
        conn_str = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        container_name = os.getenv('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')

        bsc = _BSC.from_connection_string(conn_str)
        blob_client = bsc.get_blob_client(container=container_name, blob=batch.blob_name)
        zip_bytes = blob_client.download_blob().readall()

        if not zip_bytes:
            batch.status = 'failed'
            batch.error_message = 'No se pudo descargar el archivo ZIP del almacenamiento'
            batch.completed_at = datetime.utcnow()
            db.session.commit()
            return
    except Exception as e:
        batch.status = 'failed'
        batch.error_message = f'Error al descargar ZIP: {str(e)[:500]}'
        batch.completed_at = datetime.utcnow()
        db.session.commit()
        return

    # === Abrir ZIP en memoria ===
    try:
        zip_buffer = io.BytesIO(zip_bytes)
        zf = zipfile.ZipFile(zip_buffer, 'r')
    except zipfile.BadZipFile:
        batch.status = 'failed'
        batch.error_message = 'El archivo no es un ZIP válido'
        batch.completed_at = datetime.utcnow()
        db.session.commit()
        return

    # Liberar referencia al zip_bytes crudo (el ZipFile trabaja sobre zip_buffer)
    del zip_bytes

    # Filtrar PDFs (incluye subdirectorios, excluye __MACOSX y ocultos)
    pdf_entries = sorted(set(
        entry for entry in zf.namelist()
        if entry.lower().endswith('.pdf')
        and not entry.startswith('__MACOSX')
        and not entry.split('/')[-1].startswith('.')
    ))

    all_files = [
        entry for entry in zf.namelist()
        if not entry.endswith('/')
        and not entry.startswith('__MACOSX')
        and not entry.split('/')[-1].startswith('.')
    ]
    non_pdf_files = [f for f in all_files if f not in set(pdf_entries)]

    batch.total_files = len(all_files)
    db.session.commit()

    # Log archivos no-PDF en lotes
    for i, npf in enumerate(non_pdf_files):
        log = ConocerUploadLog(
            batch_id=batch_id,
            filename=npf.split('/')[-1],
            status='discarded',
            discard_reason='not_pdf',
            discard_detail=f'El archivo no es un PDF: {npf.split("/")[-1]}'
        )
        db.session.add(log)
        batch.discarded_files = (batch.discarded_files or 0) + 1
        batch.processed_files = (batch.processed_files or 0) + 1
        if (i + 1) % FAILURE_COMMIT_BATCH_SIZE == 0:
            db.session.commit()
    if non_pdf_files:
        db.session.commit()

    if not pdf_entries:
        batch.status = 'completed'
        batch.completed_at = datetime.utcnow()
        batch.error_message = 'El ZIP está vacío' if not all_files else 'El ZIP no contiene archivos PDF'
        db.session.commit()
        zf.close()
        return

    # =============================================================
    # PASADA 1: Escaneo rápido — extraer CURP+ECM, deduplicar
    # Solo guarda metadata ligera (entry_name, parsed), NO pdf_bytes
    # =============================================================
    print(f"[CONOCER-BATCH] Pasada 1: Escaneando {len(pdf_entries)} PDFs...")

    # Dict: (curp, ecm_code) → {entry_name, filename, parsed}  (sin pdf_bytes)
    seen: Dict[Tuple[str, str], dict] = {}
    pending_failures = []

    for idx, entry_name in enumerate(pdf_entries):
        short_name = entry_name.split('/')[-1]
        try:
            pdf_bytes_single = zf.read(entry_name)
        except Exception as e:
            pending_failures.append({
                'filename': short_name, 'status': 'error',
                'discard_reason': 'parse_error',
                'discard_detail': f'Error al leer del ZIP: {str(e)[:200]}',
                'parsed': {}
            })
            continue

        parsed = parse_conocer_pdf(pdf_bytes_single)
        # Liberar PDF bytes inmediatamente (se re-leerá en pasada 2)
        del pdf_bytes_single

        if parsed.get('parse_error'):
            pending_failures.append({
                'filename': short_name, 'status': 'discarded',
                'discard_reason': 'parse_error',
                'discard_detail': parsed['parse_error'], 'parsed': parsed
            })
            continue

        curp = parsed.get('curp')
        ecm_code = parsed.get('ecm_code')

        if not curp:
            pending_failures.append({
                'filename': short_name, 'status': 'discarded',
                'discard_reason': 'no_curp',
                'discard_detail': 'No se encontró CURP en el texto del certificado',
                'parsed': parsed
            })
            continue

        if not ecm_code:
            pending_failures.append({
                'filename': short_name, 'status': 'discarded',
                'discard_reason': 'no_ecm_code',
                'discard_detail': 'No se encontró código ECM en el texto del certificado',
                'parsed': parsed
            })
            continue

        key = (curp.upper(), ecm_code.upper())

        if key in seen:
            previous = seen[key]
            pending_failures.append({
                'filename': previous['filename'], 'status': 'skipped',
                'discard_reason': 'duplicate_in_batch',
                'discard_detail': f'Reemplazado por {short_name} (mismo CURP+ECM)',
                'parsed': previous['parsed']
            })

        seen[key] = {
            'filename': short_name,
            'entry_name': entry_name,
            'parsed': parsed,
        }

        # Commit failures en lotes para no acumular demasiado
        if len(pending_failures) >= FAILURE_COMMIT_BATCH_SIZE:
            _flush_failures(db, batch, batch_id, pending_failures)
            pending_failures = []

    # Flush remaining failures
    if pending_failures:
        _flush_failures(db, batch, batch_id, pending_failures)
        pending_failures = []

    print(f"[CONOCER-BATCH] Pasada 1 completa: {len(seen)} únicos")

    if not seen:
        batch.status = 'completed'
        batch.completed_at = datetime.utcnow()
        db.session.commit()
        zf.close()
        return

    # =============================================================
    # PASADA 2: Matching y creación de certificados
    # Batch-load de usuarios, estándares, asignaciones y certs existentes
    # =============================================================
    print(f"[CONOCER-BATCH] Pasada 2: Procesando {len(seen)} PDFs únicos...")

    relevant_curps = list(set(k[0] for k in seen.keys()))
    relevant_ecm_codes = list(set(k[1] for k in seen.keys()))

    # --- Batch lookup de usuarios por CURP (en chunks de 500 para evitar IN clause gigante) ---
    users_by_curp: Dict[str, User] = {}
    for chunk_start in range(0, len(relevant_curps), 500):
        chunk = relevant_curps[chunk_start:chunk_start + 500]
        users = User.query.filter(db.func.upper(User.curp).in_(chunk)).all()
        for u in users:
            if u.curp:
                users_by_curp[u.curp.upper()] = u

    # --- Batch lookup de estándares ---
    standards_by_code: Dict[str, CompetencyStandard] = {}
    for chunk_start in range(0, len(relevant_ecm_codes), 500):
        chunk = relevant_ecm_codes[chunk_start:chunk_start + 500]
        stds = CompetencyStandard.query.filter(db.func.upper(CompetencyStandard.code).in_(chunk)).all()
        for s in stds:
            if s.code:
                standards_by_code[s.code.upper()] = s

    # --- Batch lookup de asignaciones ECM ---
    # Construir set de (user_id, standard_id) que tienen asignación
    assignment_set: Set[Tuple[str, int]] = set()
    matched_user_ids = [u.id for u in users_by_curp.values()]
    matched_std_ids = [s.id for s in standards_by_code.values()]
    if matched_user_ids and matched_std_ids:
        for chunk_start in range(0, len(matched_user_ids), 500):
            uid_chunk = matched_user_ids[chunk_start:chunk_start + 500]
            assignments = EcmCandidateAssignment.query.filter(
                EcmCandidateAssignment.user_id.in_(uid_chunk),
                EcmCandidateAssignment.competency_standard_id.in_(matched_std_ids)
            ).all()
            for a in assignments:
                assignment_set.add((a.user_id, a.competency_standard_id))

    # --- Batch lookup de certificados existentes ---
    existing_certs_map: Dict[Tuple[str, str], ConocerCertificate] = {}
    if matched_user_ids:
        for chunk_start in range(0, len(matched_user_ids), 500):
            uid_chunk = matched_user_ids[chunk_start:chunk_start + 500]
            certs = ConocerCertificate.query.filter(
                ConocerCertificate.user_id.in_(uid_chunk),
                ConocerCertificate.status == 'active'
            ).all()
            for c in certs:
                existing_certs_map[(c.user_id, c.standard_code.upper())] = c

    # Obtener blob service
    try:
        blob_svc = get_conocer_blob_service()
    except Exception as e:
        batch.status = 'failed'
        batch.error_message = f'Error al conectar con blob storage: {str(e)[:500]}'
        batch.completed_at = datetime.utcnow()
        db.session.commit()
        zf.close()
        return

    # Procesar cada PDF único — re-leyendo del ZIP bajo demanda
    processed_in_pass2 = 0
    for (curp, ecm_code), entry_data in seen.items():
        start_time = time.time()
        filename = entry_data['filename']
        parsed = entry_data['parsed']

        log_data = {
            'batch_id': batch_id,
            'filename': filename,
            'extracted_curp': parsed.get('curp'),
            'extracted_ecm_code': parsed.get('ecm_code'),
            'extracted_name': parsed.get('name'),
            'extracted_folio': parsed.get('folio'),
            'extracted_ecm_name': parsed.get('ecm_name'),
            'extracted_issue_date': parsed.get('issue_date'),
            'extracted_certifying_entity': parsed.get('certifying_entity'),
        }

        uploaded_blob_name = None

        try:
            # Buscar usuario por CURP (from pre-loaded map)
            user = users_by_curp.get(curp.upper())
            if not user:
                _add_discard_log(db, batch, log_data, 'curp_not_found',
                                 f'La CURP {curp} no existe en el sistema',
                                 start_time)
                continue

            # Buscar estándar (from pre-loaded map)
            standard = standards_by_code.get(ecm_code.upper())
            if not standard:
                _add_discard_log(db, batch, log_data, 'ecm_not_found',
                                 f'El estándar {ecm_code} no existe en el sistema',
                                 start_time, matched_user_id=user.id)
                continue

            # Verificar asignación ECM (from pre-loaded set)
            has_assignment = (user.id, standard.id) in assignment_set

            # Verificar certificado existente (from pre-loaded map)
            existing_cert = existing_certs_map.get((user.id, ecm_code.upper()))

            if not has_assignment and not existing_cert:
                _add_discard_log(db, batch, log_data, 'no_assignment',
                                 f'El usuario con CURP {curp} no tiene asignación activa para {ecm_code}',
                                 start_time, matched_user_id=user.id)
                continue

            # Re-leer PDF del ZIP (no guardamos bytes en pasada 1)
            try:
                pdf_content = zf.read(entry_data['entry_name'])
            except Exception as e:
                _add_discard_log(db, batch, log_data, 'parse_error',
                                 f'Error al re-leer PDF del ZIP: {str(e)[:200]}',
                                 start_time, matched_user_id=user.id)
                continue

            issue_date = parse_issue_date(parsed.get('issue_date'))
            if not issue_date:
                issue_date = datetime.utcnow().date()

            folio = parsed.get('folio', f'BATCH{batch_id}_{int(time.time())}')

            # === SUBIR PDF A BLOB STORAGE ===
            uploaded_blob_name, file_hash, file_size = blob_svc.upload_certificate(
                file_content=pdf_content,
                user_id=user.id,
                certificate_number=folio,
                standard_code=ecm_code.upper(),
                metadata={
                    'curp': curp,
                    'standard_name': standard.name,
                    'batch_id': str(batch_id),
                    'original_filename': filename
                }
            )
            del pdf_content  # Liberar memoria

            if existing_cert:
                # === REEMPLAZAR certificado existente ===
                previous_hash = existing_cert.file_hash
                existing_cert.blob_name = uploaded_blob_name
                existing_cert.file_hash = file_hash
                existing_cert.file_size = file_size
                existing_cert.blob_tier = 'Cool'
                existing_cert.updated_at = datetime.utcnow()
                existing_cert.archived_at = None

                if parsed.get('folio') and parsed['folio'] != existing_cert.certificate_number:
                    folio_exists = ConocerCertificate.query.filter(
                        ConocerCertificate.certificate_number == parsed['folio'],
                        ConocerCertificate.id != existing_cert.id
                    ).first()
                    if not folio_exists:
                        existing_cert.certificate_number = parsed['folio']

                if issue_date:
                    existing_cert.issue_date = issue_date
                if parsed.get('ecm_name'):
                    existing_cert.standard_name = parsed['ecm_name']
                elif standard.name:
                    existing_cert.standard_name = standard.name
                if parsed.get('certifying_entity'):
                    existing_cert.evaluation_center_name = parsed['certifying_entity']

                db.session.flush()

                log = ConocerUploadLog(
                    **log_data, status='replaced', matched_user_id=user.id,
                    certificate_id=existing_cert.id,
                    replaced_previous_hash=previous_hash,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.replaced_files = (batch.replaced_files or 0) + 1

                _update_eca_tramite_status(user.id, standard.id, 'entregado')

            else:
                # === CREAR nuevo certificado ===
                certificate = ConocerCertificate(
                    user_id=user.id,
                    certificate_number=folio,
                    curp=curp.upper(),
                    standard_code=ecm_code.upper(),
                    standard_name=parsed.get('ecm_name') or standard.name,
                    evaluation_center_name=parsed.get('certifying_entity'),
                    issue_date=issue_date,
                    blob_name=uploaded_blob_name,
                    blob_container='conocer-certificates',
                    blob_tier='Cool',
                    file_size=file_size,
                    file_hash=file_hash,
                    status='active',
                    metadata_json={
                        'batch_id': batch_id,
                        'original_filename': filename,
                        'extracted_name': parsed.get('name'),
                    }
                )
                db.session.add(certificate)
                db.session.flush()

                # Actualizar cache para posibles duplicados futuros en el mismo batch
                existing_certs_map[(user.id, ecm_code.upper())] = certificate

                log = ConocerUploadLog(
                    **log_data, status='matched', matched_user_id=user.id,
                    certificate_id=certificate.id,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.matched_files = (batch.matched_files or 0) + 1

                _update_eca_tramite_status(user.id, standard.id, 'entregado')

            batch.processed_files = (batch.processed_files or 0) + 1
            db.session.commit()
            processed_in_pass2 += 1

            if processed_in_pass2 % 25 == 0:
                print(f"[CONOCER-BATCH] Progreso: {processed_in_pass2}/{len(seen)}")

        except Exception as e:
            db.session.rollback()
            import traceback
            traceback.print_exc()

            # Limpiar blob huérfano si se subió antes del error
            if uploaded_blob_name:
                try:
                    blob_svc.delete_certificate(uploaded_blob_name)
                except Exception:
                    pass

            try:
                log = ConocerUploadLog(
                    **log_data, status='error', discard_reason='processing_error',
                    discard_detail=f'Error al procesar: {str(e)[:300]}',
                    matched_user_id=user.id if 'user' in dir() and user else None,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.error_files = (batch.error_files or 0) + 1
                batch.processed_files = (batch.processed_files or 0) + 1
                db.session.commit()
            except Exception:
                # Si ni siquiera podemos loguear el error, seguir con el siguiente
                try:
                    db.session.rollback()
                except Exception:
                    pass

    # === Finalizar batch ===
    zf.close()

    batch.status = 'completed'
    batch.completed_at = datetime.utcnow()
    db.session.commit()

    # Intentar eliminar ZIP temporal del blob
    try:
        from azure.storage.blob import BlobServiceClient as _BSC
        conn_str = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        container_name = os.getenv('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')
        bsc = _BSC.from_connection_string(conn_str)
        blob_client = bsc.get_blob_client(container=container_name, blob=batch.blob_name)
        blob_client.delete_blob()
        print(f"[CONOCER-BATCH] ZIP temporal eliminado: {batch.blob_name}")
    except Exception:
        pass

    total_time = (batch.completed_at - batch.started_at).total_seconds()
    print(
        f"[CONOCER-BATCH] Batch {batch_id} completado en {total_time:.1f}s: "
        f"{batch.matched_files} nuevos, {batch.replaced_files} reemplazados, "
        f"{batch.skipped_files} omitidos, {batch.discarded_files} descartados, "
        f"{batch.error_files} errores"
    )


def _flush_failures(db, batch, batch_id, failures):
    """Insertar un lote de failures y hacer commit."""
    from app.models.conocer_upload import ConocerUploadLog

    for fail in failures:
        log = ConocerUploadLog(
            batch_id=batch_id,
            filename=fail['filename'],
            extracted_curp=fail.get('parsed', {}).get('curp'),
            extracted_ecm_code=fail.get('parsed', {}).get('ecm_code'),
            extracted_name=fail.get('parsed', {}).get('name'),
            extracted_folio=fail.get('parsed', {}).get('folio'),
            extracted_ecm_name=fail.get('parsed', {}).get('ecm_name'),
            extracted_issue_date=fail.get('parsed', {}).get('issue_date'),
            extracted_certifying_entity=fail.get('parsed', {}).get('certifying_entity'),
            status=fail['status'],
            discard_reason=fail.get('discard_reason'),
            discard_detail=fail.get('discard_detail'),
        )
        db.session.add(log)

        if fail['status'] == 'skipped':
            batch.skipped_files = (batch.skipped_files or 0) + 1
        elif fail['status'] == 'discarded':
            batch.discarded_files = (batch.discarded_files or 0) + 1
        else:
            batch.error_files = (batch.error_files or 0) + 1
        batch.processed_files = (batch.processed_files or 0) + 1

    db.session.commit()


def _add_discard_log(db, batch, log_data, reason, detail, start_time, matched_user_id=None):
    """Helper para agregar un log de descarte y hacer commit."""
    from app.models.conocer_upload import ConocerUploadLog

    log = ConocerUploadLog(
        **log_data,
        status='discarded',
        discard_reason=reason,
        discard_detail=detail,
        matched_user_id=matched_user_id,
        processing_time_ms=int((time.time() - start_time) * 1000)
    )
    db.session.add(log)
    batch.discarded_files = (batch.discarded_files or 0) + 1
    batch.processed_files = (batch.processed_files or 0) + 1
    db.session.commit()


def _update_eca_tramite_status(user_id: str, competency_standard_id: int, new_status: str):
    """Update the tramite_status of an EcmCandidateAssignment when a certificate is matched."""
    from app import db
    from app.models.partner import EcmCandidateAssignment

    try:
        eca = EcmCandidateAssignment.query.filter_by(
            user_id=user_id,
            competency_standard_id=competency_standard_id
        ).first()
        if eca:
            eca.tramite_status = new_status
            db.session.flush()
    except Exception as e:
        print(f"[CONOCER-BATCH] Error updating ECA tramite_status: {e}")
