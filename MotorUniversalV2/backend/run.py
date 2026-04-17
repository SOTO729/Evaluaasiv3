"""
Entry point de la aplicación
"""
from app import create_app
import os

app = create_app(os.getenv('FLASK_ENV', 'development'))

# Auto-migración: Agregar columnas faltantes si no existen
with app.app_context():
    try:
        from app.auto_migrate import (
            check_and_add_columns,
            check_and_add_study_interactive_columns,
            check_and_add_answers_columns,
            check_and_add_question_types,
            check_and_add_percentage_columns,
            check_and_add_group_exam_columns,
            check_and_add_campus_activation_columns,
            check_and_add_eduit_certificate_code,
            check_and_create_campus_competency_standards_table,
            check_and_create_brands_table,
            check_and_add_competency_standard_logo_column,
            check_and_make_email_nullable,
            check_and_add_balance_attachments_column,
            check_and_add_exam_default_config_columns,
            check_and_create_certificate_code_history_table,
            check_and_create_bulk_upload_tables,
            check_and_create_support_chat_tables,
            check_and_add_assigned_state_column,
            check_and_add_result_mode_column,
            check_and_add_partner_config_subsistema,
            check_and_recover_orphaned_curp_users,
            check_and_add_vm_session_ad_password,
        )
        check_and_add_columns()
        check_and_add_study_interactive_columns()
        check_and_add_answers_columns()
        check_and_add_question_types()
        check_and_add_percentage_columns()
        check_and_add_group_exam_columns()
        check_and_add_campus_activation_columns()
        check_and_add_eduit_certificate_code()
        check_and_create_campus_competency_standards_table()
        check_and_create_brands_table()
        check_and_add_competency_standard_logo_column()
        check_and_make_email_nullable()
        check_and_add_balance_attachments_column()
        check_and_add_exam_default_config_columns()
        check_and_create_certificate_code_history_table()
        check_and_create_bulk_upload_tables()
        check_and_create_support_chat_tables()
        check_and_add_assigned_state_column()
        check_and_add_result_mode_column()
        check_and_add_partner_config_subsistema()
        check_and_add_vm_session_ad_password()
        check_and_recover_orphaned_curp_users()
    except Exception as e:
        print(f"⚠️  Auto-migración falló (continuando de todas formas): {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
