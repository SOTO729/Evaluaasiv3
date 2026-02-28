"""
Crea la tabla ecm_swap_history para almacenar el historial de reasignaciones.
"""
import pymssql
import os

server = 'evaluaasi-motorv2-sql.database.windows.net'
user = 'evaluaasi_admin'
password = os.environ.get('DB_PASSWORD', 'EvalAasi2024_newpwd!')
database = 'evaluaasi'


def create_table():
    conn = pymssql.connect(server=server, user=user, password=password, database=database)
    cursor = conn.cursor()

    # Check if table exists
    cursor.execute("SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ecm_swap_history'")
    if cursor.fetchone():
        print("✅ Tabla 'ecm_swap_history' ya existe")
        conn.close()
        return

    print("Creando tabla 'ecm_swap_history'...")

    cursor.execute("""
        CREATE TABLE ecm_swap_history (
            id INT IDENTITY(1,1) PRIMARY KEY,
            assignment_number NVARCHAR(14) NOT NULL,
            ecm_assignment_id INT NULL,
            competency_standard_id INT NOT NULL,
            group_id INT NOT NULL,
            group_name NVARCHAR(200) NULL,
            exam_id INT NOT NULL,
            group_exam_id INT NULL,
            from_user_id NVARCHAR(36) NOT NULL,
            to_user_id NVARCHAR(36) NOT NULL,
            performed_by_id NVARCHAR(36) NULL,
            performed_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            swap_type NVARCHAR(10) NOT NULL DEFAULT 'single',
            notes NVARCHAR(500) NULL,

            CONSTRAINT fk_swap_hist_from_user FOREIGN KEY (from_user_id) REFERENCES users(id),
            CONSTRAINT fk_swap_hist_to_user FOREIGN KEY (to_user_id) REFERENCES users(id),
            CONSTRAINT fk_swap_hist_performed_by FOREIGN KEY (performed_by_id) REFERENCES users(id),
            CONSTRAINT fk_swap_hist_standard FOREIGN KEY (competency_standard_id) REFERENCES competency_standards(id)
        )
    """)

    cursor.execute("""
        CREATE INDEX ix_ecm_swap_history_assignment
        ON ecm_swap_history (assignment_number)
    """)

    cursor.execute("""
        CREATE INDEX ix_ecm_swap_history_group_exam
        ON ecm_swap_history (group_id, exam_id)
    """)

    cursor.execute("""
        CREATE INDEX ix_ecm_swap_history_from
        ON ecm_swap_history (from_user_id)
    """)

    cursor.execute("""
        CREATE INDEX ix_ecm_swap_history_to
        ON ecm_swap_history (to_user_id)
    """)

    cursor.execute("""
        CREATE INDEX ix_ecm_swap_history_performed_at
        ON ecm_swap_history (performed_at)
    """)

    conn.commit()
    conn.close()
    print("✅ Tabla 'ecm_swap_history' creada exitosamente")


if __name__ == '__main__':
    create_table()
