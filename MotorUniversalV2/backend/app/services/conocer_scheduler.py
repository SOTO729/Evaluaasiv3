"""
Scheduler para envío automático de solicitudes CONOCER.
Envía correo de solicitud de línea de captura los lunes a las 9:00 AM hora México.
"""
import json
import base64
from datetime import datetime

_scheduler = None


def init_scheduler(app):
    """Initialize the APScheduler for weekly CONOCER solicitud emails."""
    global _scheduler
    
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        import pytz
    except ImportError:
        print("[SCHEDULER] APScheduler not installed, skipping scheduler init")
        return
    
    _scheduler = BackgroundScheduler(daemon=True)
    
    # Monday at 9:00 AM Mexico City time
    mexico_tz = pytz.timezone('America/Mexico_City')
    trigger = CronTrigger(
        day_of_week='mon',
        hour=9,
        minute=0,
        timezone=mexico_tz,
    )
    
    _scheduler.add_job(
        func=_send_weekly_solicitud,
        trigger=trigger,
        args=[app],
        id='conocer_weekly_solicitud',
        name='Envío semanal de solicitud CONOCER',
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace period
    )
    
    _scheduler.start()
    print(f"[SCHEDULER] ✅ CONOCER weekly solicitud scheduled for Mondays at 9:00 AM Mexico City time")


def _send_weekly_solicitud(app):
    """Execute the weekly solicitud email job."""
    with app.app_context():
        try:
            from app import db
            from sqlalchemy import text
            from app.models.partner import ConocerEmailContact, ConocerSolicitudLog
            from app.services.email_service import send_email, LOGO_URL
            
            print(f"[SCHEDULER] Starting weekly CONOCER solicitud at {datetime.utcnow().isoformat()}")
            
            # 1. Check for active contacts
            contacts = ConocerEmailContact.query.filter_by(is_active=True).all()
            if not contacts:
                print("[SCHEDULER] No active contacts, skipping")
                return
            
            # 2. Get pending assignments
            pending_sql = text("""
                SELECT 
                    eca.id AS eca_id,
                    eca.assignment_number,
                    eca.user_id,
                    u.curp,
                    u.name AS user_name,
                    COALESCE(u.first_surname, '') AS first_surname,
                    COALESCE(u.second_surname, '') AS second_surname,
                    u.gender,
                    COALESCE(uc.country, '') AS country,
                    cs.id AS ecm_id,
                    cs.code AS ecm_code,
                    cs.name AS ecm_name,
                    cs.level AS competency_level
                FROM ecm_candidate_assignments eca
                JOIN users u ON u.id = eca.user_id
                LEFT JOIN campuses uc ON uc.id = u.campus_id
                JOIN competency_standards cs ON cs.id = eca.competency_standard_id
                LEFT JOIN candidate_groups cg ON cg.id = eca.group_id
                LEFT JOIN campuses c ON c.id = eca.campus_id
                WHERE eca.tramite_status = 'pendiente'
                  AND eca.assignment_number IS NOT NULL
                  AND u.enable_conocer_certificate = 1
                  AND (
                      (cg.enable_tier_advanced_override = 1)
                      OR (cg.enable_tier_advanced_override IS NULL AND c.enable_tier_advanced = 1)
                  )
                ORDER BY cs.code, u.name
            """)
            pending_rows = db.session.execute(pending_sql).fetchall()
            
            if not pending_rows:
                print("[SCHEDULER] No pending tramites, skipping")
                return
            
            # 3. Build ECM summary
            ecm_counts = {}
            eca_ids = []
            for row in pending_rows:
                eca_ids.append(row.eca_id)
                code = row.ecm_code
                if code not in ecm_counts:
                    ecm_counts[code] = 0
                ecm_counts[code] += 1
            
            total_certs = sum(ecm_counts.values())
            ecm_summary = [{'code': code, 'count': count} for code, count in sorted(ecm_counts.items())]
            
            # 4. Import helper functions from partners routes
            from app.routes.partners import _generate_renapo_excel_for_pending, _download_cosu_pdf_from_blob
            
            excel_base64, excel_filename = _generate_renapo_excel_for_pending(pending_rows)
            cosu_base64 = _download_cosu_pdf_from_blob()
            
            # 5. Build email HTML
            table_rows_html = ''
            for item in ecm_summary:
                table_rows_html += f'''
                <tr>
                    <td style="padding:10px 16px;border:1px solid #d1d5db;font-size:14px;color:#374151;">{item['code']}</td>
                    <td style="padding:10px 16px;border:1px solid #d1d5db;font-size:14px;color:#374151;text-align:center;">{item['count']}</td>
                </tr>'''
            table_rows_html += f'''
                <tr style="background-color:#f3f4f6;font-weight:bold;">
                    <td style="padding:10px 16px;border:1px solid #d1d5db;font-size:14px;color:#111827;">Total</td>
                    <td style="padding:10px 16px;border:1px solid #d1d5db;font-size:14px;color:#111827;text-align:center;">{total_certs}</td>
                </tr>'''
            
            email_body = f'''
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
        <img src="{LOGO_URL}" alt="Evaluaasi" style="height:40px;margin-bottom:8px;" />
        <h1 style="color:#ffffff;font-size:20px;margin:0;">Solicitud de Línea de Captura</h1>
    </div>
    <div style="padding:32px;">
        <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 20px;">Buen día estimados,</p>
        <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 24px;">
            Por favor solicito la línea de captura para <strong>{total_certs}</strong> certificados sin fotografía con descuento.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px;border-radius:8px;overflow:hidden;">
            <thead>
                <tr style="background-color:#2563eb;">
                    <th style="padding:12px 16px;color:#ffffff;font-size:14px;font-weight:600;text-align:left;border:1px solid #2563eb;">Estándar</th>
                    <th style="padding:12px 16px;color:#ffffff;font-size:14px;font-weight:600;text-align:center;border:1px solid #2563eb;">Cantidad</th>
                </tr>
            </thead>
            <tbody>
                {table_rows_html}
            </tbody>
        </table>
        <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 8px;">Agradezco sus comentarios.</p>
        <p style="font-size:15px;color:#374151;line-height:1.7;margin:0;">Saludos.</p>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="font-size:12px;color:#94a3b8;margin:0;">Enviado automáticamente desde Evaluaasi &bull; {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
    </div>
</div>'''
            
            # 6. Prepare attachments
            attachments = []
            if excel_base64:
                attachments.append({
                    'name': excel_filename,
                    'content_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'content_base64': excel_base64,
                })
            if cosu_base64:
                attachments.append({
                    'name': 'COSU_229_2026_GRUPO_EDUIT.pdf',
                    'content_type': 'application/pdf',
                    'content_base64': cosu_base64,
                })
            
            # 7. Send email
            recipient_emails = [c.email for c in contacts]
            primary_to = recipient_emails[0]
            cc_list = recipient_emails[1:] if len(recipient_emails) > 1 else None
            
            success = send_email(
                to=primary_to,
                subject='[Evaluaasi] Solicitud de línea de captura',
                html=email_body,
                attachments=attachments,
                cc=cc_list,
            )
            
            if not success:
                log = ConocerSolicitudLog(
                    sent_by_id=None,  # Automated
                    recipients=json.dumps(recipient_emails),
                    total_certificates=total_certs,
                    ecm_summary=json.dumps(ecm_summary),
                    attachment_names=', '.join([a['name'] for a in attachments]),
                    status='failed',
                    error_message='Error al enviar el correo automático',
                    assignment_ids=json.dumps(eca_ids),
                )
                db.session.add(log)
                db.session.commit()
                print(f"[SCHEDULER] ❌ Failed to send weekly solicitud email")
                return
            
            # 8. Update tramite_status
            if eca_ids:
                ids_str = ','.join(str(i) for i in eca_ids)
                db.session.execute(text(f"""
                    UPDATE ecm_candidate_assignments 
                    SET tramite_status = 'en_tramite'
                    WHERE id IN ({ids_str}) AND tramite_status = 'pendiente'
                """))
            
            # 9. Log
            log = ConocerSolicitudLog(
                sent_by_id=None,  # Automated
                recipients=json.dumps(recipient_emails),
                total_certificates=total_certs,
                ecm_summary=json.dumps(ecm_summary),
                attachment_names=', '.join([a['name'] for a in attachments]),
                status='sent',
                assignment_ids=json.dumps(eca_ids),
            )
            db.session.add(log)
            db.session.commit()
            
            print(f"[SCHEDULER] ✅ Weekly solicitud sent to {len(recipient_emails)} contacts with {total_certs} certificates")
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[SCHEDULER] ❌ Error in weekly solicitud: {e}")
