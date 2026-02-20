"""
Servicio de procesamiento en segundo plano para carga masiva de certificados CONOCER.
Procesa un ZIP de PDFs: parsea cada uno, hace matching, sube blobs y crea registros.

Flujo:
1. Recibe batch_id de un ConocerUploadBatch con status='queued'
2. Descarga el ZIP del blob temporal
3. Pasada 1: Escanea todos los PDFs, extrae CURP+ECM, deduplica (queda el último)
4. Pasada 2: Por cada PDF ganador, hace matching contra BD y crea certificado si aplica
5. Actualiza contadores y marca batch como completed/failed
"""
import io
import time
import zipfile
import threading
from datetime import datetime
from typing import Dict, Tuple, Optional

from app.services.conocer_pdf_parser import parse_conocer_pdf, parse_issue_date


def process_batch_background(app, batch_id: int):
    """
    Lanza el procesamiento del batch en un thread separado.
    
    Args:
        app: Instancia de Flask app (necesaria para el contexto)
        batch_id: ID del batch a procesar
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
            # Intentar marcar el batch como failed
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
    from app.services.conocer_blob_service import get_conocer_blob_service
    from sqlalchemy import text
    
    batch = ConocerUploadBatch.query.get(batch_id)
    if not batch or batch.status != 'queued':
        print(f"[CONOCER-BATCH] Batch {batch_id} no encontrado o no está en estado 'queued'")
        return
    
    # Marcar como processing
    batch.status = 'processing'
    batch.started_at = datetime.utcnow()
    db.session.commit()
    
    print(f"[CONOCER-BATCH] Iniciando procesamiento del batch {batch_id}: {batch.filename}")
    
    # === Descargar ZIP del blob temporal ===
    try:
        import os
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
    
    # Filtrar solo archivos PDF (ignorar directorios y archivos ocultos)
    pdf_entries = [
        entry for entry in zf.namelist()
        if entry.lower().endswith('.pdf')
        and not entry.startswith('__MACOSX')
        and not entry.startswith('.')
        and '/' not in entry.rstrip('/')  # Solo archivos en la raíz del ZIP (o ajustar)
    ]
    
    # También incluir PDFs en subdirectorios
    pdf_entries_nested = [
        entry for entry in zf.namelist()
        if entry.lower().endswith('.pdf')
        and not entry.startswith('__MACOSX')
        and not entry.split('/')[-1].startswith('.')
    ]
    pdf_entries = list(set(pdf_entries + pdf_entries_nested))
    
    # Registrar archivos no-PDF como descartados
    all_files = [
        entry for entry in zf.namelist()
        if not entry.endswith('/')
        and not entry.startswith('__MACOSX')
        and not entry.split('/')[-1].startswith('.')
    ]
    non_pdf_files = [f for f in all_files if f not in pdf_entries]
    
    batch.total_files = len(all_files)
    db.session.commit()
    
    # Log archivos no-PDF
    for npf in non_pdf_files:
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
    if non_pdf_files:
        db.session.commit()
    
    if not pdf_entries:
        batch.status = 'completed'
        batch.completed_at = datetime.utcnow()
        if not all_files:
            batch.error_message = 'El ZIP está vacío'
        else:
            batch.error_message = 'El ZIP no contiene archivos PDF'
        db.session.commit()
        zf.close()
        return
    
    # =============================================================
    # PASADA 1: Escaneo rápido — extraer CURP+ECM, deduplicar
    # =============================================================
    print(f"[CONOCER-BATCH] Pasada 1: Escaneando {len(pdf_entries)} PDFs...")
    
    # Dict: (curp, ecm_code) → (filename, pdf_bytes, parsed_data, index)
    # Si hay duplicados, el último gana (por orden en la lista)
    seen: Dict[Tuple[str, str], dict] = {}
    # Archivos que no se pudieron parsear o no tienen CURP/ECM
    failures = []
    
    for idx, entry_name in enumerate(pdf_entries):
        short_name = entry_name.split('/')[-1]
        try:
            pdf_bytes_single = zf.read(entry_name)
        except Exception as e:
            failures.append({
                'filename': short_name,
                'status': 'error',
                'discard_reason': 'parse_error',
                'discard_detail': f'Error al leer del ZIP: {str(e)[:200]}',
                'parsed': {}
            })
            continue
        
        parsed = parse_conocer_pdf(pdf_bytes_single)
        
        # Verificar si el parsing fue exitoso con campos mínimos
        if parsed.get('parse_error'):
            failures.append({
                'filename': short_name,
                'status': 'discarded',
                'discard_reason': 'parse_error',
                'discard_detail': parsed['parse_error'],
                'parsed': parsed
            })
            continue
        
        curp = parsed.get('curp')
        ecm_code = parsed.get('ecm_code')
        
        if not curp:
            failures.append({
                'filename': short_name,
                'status': 'discarded',
                'discard_reason': 'no_curp',
                'discard_detail': 'No se encontró CURP en el texto del certificado',
                'parsed': parsed
            })
            continue
        
        if not ecm_code:
            failures.append({
                'filename': short_name,
                'status': 'discarded',
                'discard_reason': 'no_ecm_code',
                'discard_detail': 'No se encontró código ECM en el texto del certificado',
                'parsed': parsed
            })
            continue
        
        key = (curp.upper(), ecm_code.upper())
        
        # Si ya existe esta combinación, el anterior se marca como skipped
        if key in seen:
            previous = seen[key]
            failures.append({
                'filename': previous['filename'],
                'status': 'skipped',
                'discard_reason': 'duplicate_in_batch',
                'discard_detail': f'Reemplazado por {short_name} (mismo CURP+ECM)',
                'parsed': previous['parsed']
            })
        
        # El actual gana (es el más reciente por orden)
        seen[key] = {
            'filename': short_name,
            'entry_name': entry_name,
            'pdf_bytes': pdf_bytes_single,
            'parsed': parsed,
            'index': idx
        }
    
    # Log todos los failures de pasada 1
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
    
    print(f"[CONOCER-BATCH] Pasada 1 completa: {len(seen)} únicos, {len(failures)} descartados/omitidos")
    
    # =============================================================
    # PASADA 2: Matching y creación de certificados
    # =============================================================
    print(f"[CONOCER-BATCH] Pasada 2: Procesando {len(seen)} PDFs únicos...")
    
    # Pre-cargar datos de BD para eficiencia
    # Obtener todos los users por CURP relevante
    relevant_curps = list(set(k[0] for k in seen.keys()))
    relevant_ecm_codes = list(set(k[1] for k in seen.keys()))
    
    # Mapas de lookup
    users_by_curp = {}
    for curp in relevant_curps:
        user = User.query.filter(
            db.func.upper(User.curp) == curp.upper()
        ).first()
        if user:
            users_by_curp[curp.upper()] = user
    
    standards_by_code = {}
    for code in relevant_ecm_codes:
        std = CompetencyStandard.query.filter(
            db.func.upper(CompetencyStandard.code) == code.upper()
        ).first()
        if std:
            standards_by_code[code.upper()] = std
    
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
    
    # Procesar cada PDF único
    for (curp, ecm_code), entry_data in seen.items():
        start_time = time.time()
        filename = entry_data['filename']
        pdf_content = entry_data['pdf_bytes']
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
        
        try:
            # Buscar usuario por CURP
            user = users_by_curp.get(curp.upper())
            if not user:
                log = ConocerUploadLog(
                    **log_data,
                    status='discarded',
                    discard_reason='curp_not_found',
                    discard_detail=f'La CURP {curp} no existe en el sistema',
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.discarded_files = (batch.discarded_files or 0) + 1
                batch.processed_files = (batch.processed_files or 0) + 1
                db.session.commit()
                continue
            
            # Buscar estándar de competencia
            standard = standards_by_code.get(ecm_code.upper())
            if not standard:
                log = ConocerUploadLog(
                    **log_data,
                    status='discarded',
                    discard_reason='ecm_not_found',
                    discard_detail=f'El estándar {ecm_code} no existe en el sistema',
                    matched_user_id=user.id,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.discarded_files = (batch.discarded_files or 0) + 1
                batch.processed_files = (batch.processed_files or 0) + 1
                db.session.commit()
                continue
            
            # Verificar si tiene trámite pendiente (resultado aprobado en grupo CONOCER)
            has_pending = _check_pending_tramite(user.id, standard.id)
            
            # Verificar si ya tiene certificado CONOCER activo
            existing_cert = ConocerCertificate.query.filter_by(
                user_id=user.id,
                standard_code=ecm_code.upper(),
                status='active'
            ).first()
            
            if not has_pending and not existing_cert:
                # No tiene trámite y no tiene certificado → descartar
                log = ConocerUploadLog(
                    **log_data,
                    status='discarded',
                    discard_reason='no_pending_tramite',
                    discard_detail=f'El usuario no tiene examen aprobado en un grupo con CONOCER habilitado para {ecm_code}',
                    matched_user_id=user.id,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.discarded_files = (batch.discarded_files or 0) + 1
                batch.processed_files = (batch.processed_files or 0) + 1
                db.session.commit()
                continue
            
            # Parsear fecha de emisión
            issue_date = parse_issue_date(parsed.get('issue_date'))
            if not issue_date:
                issue_date = datetime.utcnow().date()
            
            # Generar folio para el blob
            folio = parsed.get('folio', f'BATCH{batch_id}_{int(time.time())}')
            
            # === SUBIR PDF A BLOB STORAGE ===
            blob_name, file_hash, file_size = blob_svc.upload_certificate(
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
            
            if existing_cert:
                # === REEMPLAZAR certificado existente ===
                previous_hash = existing_cert.file_hash
                existing_cert.blob_name = blob_name
                existing_cert.file_hash = file_hash
                existing_cert.file_size = file_size
                existing_cert.blob_tier = 'Cool'
                existing_cert.updated_at = datetime.utcnow()
                existing_cert.archived_at = None
                
                # Actualizar datos si el folio cambió
                if parsed.get('folio') and parsed['folio'] != existing_cert.certificate_number:
                    # Verificar que el nuevo folio no esté en uso
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
                    **log_data,
                    status='replaced',
                    matched_user_id=user.id,
                    certificate_id=existing_cert.id,
                    replaced_previous_hash=previous_hash,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.replaced_files = (batch.replaced_files or 0) + 1
                
                # Update ECA tramite_status to 'entregado'
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
                    blob_name=blob_name,
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
                
                log = ConocerUploadLog(
                    **log_data,
                    status='matched',
                    matched_user_id=user.id,
                    certificate_id=certificate.id,
                    processing_time_ms=int((time.time() - start_time) * 1000)
                )
                db.session.add(log)
                batch.matched_files = (batch.matched_files or 0) + 1
                
                # Update ECA tramite_status to 'entregado'
                _update_eca_tramite_status(user.id, standard.id, 'entregado')
            
            batch.processed_files = (batch.processed_files or 0) + 1
            db.session.commit()
            
            print(f"[CONOCER-BATCH] Procesado: {filename} → {log.status} (CURP={curp}, ECM={ecm_code})")
            
        except Exception as e:
            db.session.rollback()
            import traceback
            traceback.print_exc()
            
            log = ConocerUploadLog(
                **log_data,
                status='error',
                discard_reason='processing_error',
                discard_detail=f'Error al procesar: {str(e)[:300]}',
                matched_user_id=user.id if 'user' in dir() and user else None,
                processing_time_ms=int((time.time() - start_time) * 1000)
            )
            db.session.add(log)
            batch.error_files = (batch.error_files or 0) + 1
            batch.processed_files = (batch.processed_files or 0) + 1
            db.session.commit()
    
    # === Finalizar batch ===
    zf.close()
    
    batch.status = 'completed'
    batch.completed_at = datetime.utcnow()
    db.session.commit()
    
    # Intentar eliminar ZIP temporal del blob
    try:
        import os
        from azure.storage.blob import BlobServiceClient as _BSC
        conn_str = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        container_name = os.getenv('AZURE_STORAGE_CONTAINER', 'evaluaasi-files')
        bsc = _BSC.from_connection_string(conn_str)
        blob_client = bsc.get_blob_client(container=container_name, blob=batch.blob_name)
        blob_client.delete_blob()
        print(f"[CONOCER-BATCH] ZIP temporal eliminado: {batch.blob_name}")
    except Exception:
        pass  # No es crítico
    
    total_time = (batch.completed_at - batch.started_at).total_seconds()
    print(
        f"[CONOCER-BATCH] Batch {batch_id} completado en {total_time:.1f}s: "
        f"{batch.matched_files} nuevos, {batch.replaced_files} reemplazados, "
        f"{batch.skipped_files} omitidos, {batch.discarded_files} descartados, "
        f"{batch.error_files} errores"
    )


def _check_pending_tramite(user_id: str, competency_standard_id: int) -> bool:
    """
    Verificar si un usuario tiene trámite CONOCER pendiente para un estándar.
    
    Condiciones:
    1. Tiene resultado aprobado (result=1, status=1) en un examen del estándar
    2. Está en un grupo activo con enable_tier_advanced habilitado
    3. El examen está asignado al grupo
    
    Replica la lógica del CTE de get_conocer_tramites() de partners.py
    """
    from app import db
    from sqlalchemy import text
    
    sql = text("""
        SELECT TOP 1 1
        FROM results r
        JOIN users u ON u.id = r.user_id
        JOIN exams e ON e.id = r.exam_id
        JOIN competency_standards cs ON cs.id = e.competency_standard_id
        JOIN group_members gm ON gm.user_id = u.id AND gm.status = 'active'
        JOIN candidate_groups cg ON cg.id = gm.group_id AND cg.is_active = 1
        LEFT JOIN campuses c ON c.id = cg.campus_id
        WHERE r.status = 1
          AND r.result = 1
          AND u.id = :user_id
          AND cs.id = :standard_id
          AND u.curp IS NOT NULL
          AND LEN(u.curp) >= 10
          AND (
              (cg.enable_tier_advanced_override = 1)
              OR (cg.enable_tier_advanced_override IS NULL AND c.enable_tier_advanced = 1)
          )
          AND EXISTS (
              SELECT 1 FROM group_exams ge
              WHERE ge.group_id = cg.id AND ge.exam_id = e.id
          )
    """)
    
    result = db.session.execute(sql, {
        'user_id': user_id,
        'standard_id': competency_standard_id
    }).fetchone()
    
    return result is not None


def _update_eca_tramite_status(user_id: str, competency_standard_id: int, new_status: str):
    """
    Update the tramite_status of an EcmCandidateAssignment when a certificate is matched.
    """
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
            print(f"[CONOCER-BATCH] ECA {eca.assignment_number} → tramite_status={new_status}")
    except Exception as e:
        print(f"[CONOCER-BATCH] Error updating ECA tramite_status: {e}")
