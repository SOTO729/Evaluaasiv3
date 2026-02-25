-- =====================================================
-- MIGRACIÓN: Auditoría de producción — Coordinador
-- Fecha: 2026-02-25
-- Descripción: Índices, FK, cascade, NOT NULL fixes
-- =====================================================
-- EJECUTAR EN ORDEN. Cada bloque es idempotente (IF NOT EXISTS).

-- =====================================================
-- A2: ÍNDICES FALTANTES — Prioridad ALTA
-- =====================================================

-- campuses
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_campuses_partner_id' AND object_id=OBJECT_ID('campuses'))
    CREATE INDEX ix_campuses_partner_id ON campuses(partner_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_campuses_state_name' AND object_id=OBJECT_ID('campuses'))
    CREATE INDEX ix_campuses_state_name ON campuses(state_name);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_campuses_activation_status' AND object_id=OBJECT_ID('campuses'))
    CREATE INDEX ix_campuses_activation_status ON campuses(activation_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_campuses_is_active' AND object_id=OBJECT_ID('campuses'))
    CREATE INDEX ix_campuses_is_active ON campuses(is_active);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_campuses_responsable_id' AND object_id=OBJECT_ID('campuses'))
    CREATE INDEX ix_campuses_responsable_id ON campuses(responsable_id);

-- candidate_groups
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_candidate_groups_campus_id' AND object_id=OBJECT_ID('candidate_groups'))
    CREATE INDEX ix_candidate_groups_campus_id ON candidate_groups(campus_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_candidate_groups_school_cycle_id' AND object_id=OBJECT_ID('candidate_groups'))
    CREATE INDEX ix_candidate_groups_school_cycle_id ON candidate_groups(school_cycle_id);

-- group_members
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_members_group_id' AND object_id=OBJECT_ID('group_members'))
    CREATE INDEX ix_group_members_group_id ON group_members(group_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_members_user_id' AND object_id=OBJECT_ID('group_members'))
    CREATE INDEX ix_group_members_user_id ON group_members(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_members_status' AND object_id=OBJECT_ID('group_members'))
    CREATE INDEX ix_group_members_status ON group_members(status);

-- group_exams
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_exams_group_id' AND object_id=OBJECT_ID('group_exams'))
    CREATE INDEX ix_group_exams_group_id ON group_exams(group_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_group_exams_exam_id' AND object_id=OBJECT_ID('group_exams'))
    CREATE INDEX ix_group_exams_exam_id ON group_exams(exam_id);

-- badge_templates
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_badge_templates_competency_standard_id' AND object_id=OBJECT_ID('badge_templates'))
    CREATE INDEX ix_badge_templates_competency_standard_id ON badge_templates(competency_standard_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_badge_templates_exam_id' AND object_id=OBJECT_ID('badge_templates'))
    CREATE INDEX ix_badge_templates_exam_id ON badge_templates(exam_id);

-- issued_badges
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_issued_badges_template_id' AND object_id=OBJECT_ID('issued_badges'))
    CREATE INDEX ix_issued_badges_template_id ON issued_badges(badge_template_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_issued_badges_status' AND object_id=OBJECT_ID('issued_badges'))
    CREATE INDEX ix_issued_badges_status ON issued_badges(status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_issued_badges_result_id' AND object_id=OBJECT_ID('issued_badges'))
    CREATE INDEX ix_issued_badges_result_id ON issued_badges(result_id);

-- conocer_certificates
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_conocer_certificates_status' AND object_id=OBJECT_ID('conocer_certificates'))
    CREATE INDEX ix_conocer_certificates_status ON conocer_certificates(status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_conocer_certificates_standard_code' AND object_id=OBJECT_ID('conocer_certificates'))
    CREATE INDEX ix_conocer_certificates_standard_code ON conocer_certificates(standard_code);

-- balance_requests
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_balance_requests_coordinator_id' AND object_id=OBJECT_ID('balance_requests'))
    CREATE INDEX ix_balance_requests_coordinator_id ON balance_requests(coordinator_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_balance_requests_group_id' AND object_id=OBJECT_ID('balance_requests'))
    CREATE INDEX ix_balance_requests_group_id ON balance_requests(group_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_balance_requests_status' AND object_id=OBJECT_ID('balance_requests'))
    CREATE INDEX ix_balance_requests_status ON balance_requests(status);

-- coordinator_balances
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_coordinator_balances_coordinator_id' AND object_id=OBJECT_ID('coordinator_balances'))
    CREATE INDEX ix_coordinator_balances_coordinator_id ON coordinator_balances(coordinator_id);

-- ecm_candidate_assignments
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_ecm_assignments_tramite_status' AND object_id=OBJECT_ID('ecm_candidate_assignments'))
    CREATE INDEX ix_ecm_assignments_tramite_status ON ecm_candidate_assignments(tramite_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_ecm_assignments_campus_id' AND object_id=OBJECT_ID('ecm_candidate_assignments'))
    CREATE INDEX ix_ecm_assignments_campus_id ON ecm_candidate_assignments(campus_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_ecm_assignments_exam_id' AND object_id=OBJECT_ID('ecm_candidate_assignments'))
    CREATE INDEX ix_ecm_assignments_exam_id ON ecm_candidate_assignments(exam_id);

-- activity_logs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_activity_logs_user_id' AND object_id=OBJECT_ID('activity_logs'))
    CREATE INDEX ix_activity_logs_user_id ON activity_logs(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_activity_logs_action_type' AND object_id=OBJECT_ID('activity_logs'))
    CREATE INDEX ix_activity_logs_action_type ON activity_logs(action_type);

-- school_cycles
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_school_cycles_campus_id' AND object_id=OBJECT_ID('school_cycles'))
    CREATE INDEX ix_school_cycles_campus_id ON school_cycles(campus_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_school_cycles_is_current' AND object_id=OBJECT_ID('school_cycles'))
    CREATE INDEX ix_school_cycles_is_current ON school_cycles(is_current);

-- balance_transactions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_balance_transactions_coordinator_id' AND object_id=OBJECT_ID('balance_transactions'))
    CREATE INDEX ix_balance_transactions_coordinator_id ON balance_transactions(coordinator_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_balance_transactions_group_id' AND object_id=OBJECT_ID('balance_transactions'))
    CREATE INDEX ix_balance_transactions_group_id ON balance_transactions(group_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_balance_transactions_created_at' AND object_id=OBJECT_ID('balance_transactions'))
    CREATE INDEX ix_balance_transactions_created_at ON balance_transactions(created_at);

-- partner_state_presences
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_partner_state_presences_state_name' AND object_id=OBJECT_ID('partner_state_presences'))
    CREATE INDEX ix_partner_state_presences_state_name ON partner_state_presences(state_name);

-- =====================================================
-- B3: ÍNDICES COMPUESTOS — Prioridad BAJA (rendimiento dashboards)
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_candidate_groups_campus_active' AND object_id=OBJECT_ID('candidate_groups'))
    CREATE INDEX ix_candidate_groups_campus_active ON candidate_groups(campus_id, is_active);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_issued_badges_user_status' AND object_id=OBJECT_ID('issued_badges'))
    CREATE INDEX ix_issued_badges_user_status ON issued_badges(user_id, status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_ecm_assignments_user_ecm_status' AND object_id=OBJECT_ID('ecm_candidate_assignments'))
    CREATE INDEX ix_ecm_assignments_user_ecm_status ON ecm_candidate_assignments(user_id, competency_standard_id, tramite_status);

-- =====================================================
-- A3: FIX CoordinatorBalance cascade (CASCADE → SET NULL)
-- Preservar historial de saldos cuando se borra un grupo
-- =====================================================

-- Primero encontrar y eliminar el FK actual de group_id
DECLARE @fk_cb_group NVARCHAR(256);
SELECT @fk_cb_group = fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
WHERE fk.parent_object_id = OBJECT_ID('coordinator_balances')
  AND c.name = 'group_id';

IF @fk_cb_group IS NOT NULL
BEGIN
    -- Hacer la columna nullable primero
    ALTER TABLE coordinator_balances ALTER COLUMN group_id INT NULL;
    EXEC('ALTER TABLE coordinator_balances DROP CONSTRAINT [' + @fk_cb_group + ']');
    ALTER TABLE coordinator_balances ADD CONSTRAINT FK_coordinator_balances_group_id
        FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE SET NULL;
    PRINT 'CoordinatorBalance.group_id changed to ON DELETE SET NULL';
END

-- =====================================================
-- B5: FIX BalanceRequest FK (agregar ON DELETE SET NULL)
-- =====================================================

-- BalanceRequest.group_id → ON DELETE SET NULL
DECLARE @fk_br_group NVARCHAR(256);
SELECT @fk_br_group = fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
WHERE fk.parent_object_id = OBJECT_ID('balance_requests')
  AND c.name = 'group_id';

IF @fk_br_group IS NOT NULL
BEGIN
    EXEC('ALTER TABLE balance_requests DROP CONSTRAINT [' + @fk_br_group + ']');
    ALTER TABLE balance_requests ADD CONSTRAINT FK_balance_requests_group_id
        FOREIGN KEY (group_id) REFERENCES candidate_groups(id) ON DELETE SET NULL;
    PRINT 'BalanceRequest.group_id changed to ON DELETE SET NULL';
END

-- BalanceRequest.campus_id → ON DELETE SET NULL
DECLARE @fk_br_campus NVARCHAR(256);
SELECT @fk_br_campus = fk.name
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.columns c ON fkc.parent_column_id = c.column_id AND fkc.parent_object_id = c.object_id
WHERE fk.parent_object_id = OBJECT_ID('balance_requests')
  AND c.name = 'campus_id';

IF @fk_br_campus IS NOT NULL
BEGIN
    EXEC('ALTER TABLE balance_requests DROP CONSTRAINT [' + @fk_br_campus + ']');
    ALTER TABLE balance_requests ADD CONSTRAINT FK_balance_requests_campus_id
        FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE SET NULL;
    PRINT 'BalanceRequest.campus_id changed to ON DELETE SET NULL';
END

-- =====================================================
-- M5: GroupMember.status NOT NULL con default 'active'
-- =====================================================

-- Primero actualizar NULLs existentes
UPDATE group_members SET status = 'active' WHERE status IS NULL;

-- Luego cambiar a NOT NULL con default
ALTER TABLE group_members ALTER COLUMN status NVARCHAR(20) NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE parent_object_id = OBJECT_ID('group_members') AND name = 'DF_group_members_status')
    ALTER TABLE group_members ADD CONSTRAINT DF_group_members_status DEFAULT 'active' FOR status;

PRINT 'Migración de auditoría completada exitosamente';
GO
