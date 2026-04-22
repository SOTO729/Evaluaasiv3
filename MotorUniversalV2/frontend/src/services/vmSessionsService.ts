/**
 * Servicio para gestión de sesiones de Máquinas Virtuales.
 */
import api from './api';

export interface VmSlot {
  hour: number;
  label: string;
  available: boolean;
  is_past: boolean;
  global_count: number;
  max_sessions: number;
  remaining: number;
  is_occupied?: boolean;
  sessions?: {
    session_id: number;
    user_id: string;
    user_name: string;
    group_id: number | null;
    group_name: string | null;
    campus_id: number | null;
    campus_name: string | null;
  }[];
  occupied_by?: Record<string, unknown>;
}

export interface VmSession {
  id: number;
  user_id: string;
  campus_id: number;
  group_id: number | null;
  session_date: string;
  start_hour: number;
  end_hour: number;
  session_type: 'simulador' | 'examen' | 'parcial';
  is_local: boolean;
  office_app: string | null;
  office_version: string | null;
  level: string | null;
  parcial_units: string | null;
  workstation_id: number | null;
  workstation_name: string | null;
  workstation_color: string | null;
  config_session_id: string | null;
  status: string;
  notes: string | null;
  created_by_id: string | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  user?: { id: string; name: string; email: string; role: string };
  group_name?: string;
  campus_name?: string;
}

export interface VmAccessInfo {
  has_access: boolean;
  role: string;
  scope: string;
  campus_id?: number;
  group_id?: number;
  campuses?: { id: number; name: string }[];
  read_only?: boolean;
  scheduling_mode?: string;
  can_self_schedule?: boolean;
}

/** Verificar si el usuario tiene acceso a VMs */
export async function checkVmAccess(): Promise<VmAccessInfo> {
  const response = await api.get('/vm-sessions/check-access');
  return response.data;
}

/** Obtener sesiones de VM */
export async function getVmSessions(params?: {
  campus_id?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
}): Promise<{ sessions: VmSession[]; total: number; date_from: string; date_to: string }> {
  const response = await api.get('/vm-sessions/sessions', { params });
  return response.data;
}

/** Obtener horarios disponibles (disponibilidad global) */
export async function getAvailableSlots(params: {
  date: string;
  operating_hours_start?: number;
  operating_hours_end?: number;
}): Promise<{ date: string; slots: VmSlot[]; total_available: number }> {
  const response = await api.get('/vm-sessions/available-slots', { params });
  return response.data;
}

/** Agendar una sesión de VM */
export async function createVmSession(data: {
  session_date: string;
  start_hour: number;
  end_hour?: number;
  session_type?: 'simulador' | 'examen' | 'parcial';
  is_local?: boolean;
  office_app?: string;
  office_version?: string;
  level?: string;
  parcial_units?: string;
  user_id?: string;
  campus_id?: number;
  notes?: string;
}): Promise<{ message: string; session: VmSession }> {
  const response = await api.post('/vm-sessions/sessions', data);
  return response.data;
}

/** Cancelar una sesión de VM */
export async function cancelVmSession(sessionId: number, reason?: string): Promise<{ message: string; session: VmSession }> {
  const response = await api.delete(`/vm-sessions/sessions/${sessionId}`, {
    data: { reason },
  });
  return response.data;
}

/** Actualizar estado de una sesión (solo admin/coordinator) */
export async function updateVmSessionStatus(
  sessionId: number,
  status: 'completed' | 'no_show' | 'cancelled'
): Promise<{ message: string; session: VmSession }> {
  const response = await api.patch(`/vm-sessions/sessions/${sessionId}/status`, { status });
  return response.data;
}

// ─── Responsable endpoints ──────────────────────────────────────

export interface ResponsableGroup {
  id: number;
  name: string;
  scheduling_mode: 'leader_only' | 'candidate_self';
  member_count: number;
}

export interface GroupCandidate {
  user_id: string;
  name: string;
  email: string;
  has_scheduled_session: boolean;
}

export interface ProposalItem {
  user_id: string;
  user_name: string;
  session_date: string | null;
  start_hour: number | null;
  hour_label: string;
  error?: boolean;
}

/** Obtener grupos con calendario de sesiones del plantel del responsable */
export async function getResponsableGroups(): Promise<{
  campus_id: number;
  campus_name: string;
  groups: ResponsableGroup[];
}> {
  const response = await api.get('/vm-sessions/responsable-groups');
  return response.data;
}

/** Obtener candidatos de un grupo */
export async function getGroupCandidates(groupId: number): Promise<{
  candidates: GroupCandidate[];
}> {
  const response = await api.get('/vm-sessions/group-candidates', { params: { group_id: groupId } });
  return response.data;
}

/** Auto-distribuir sesiones para candidatos de un grupo */
export async function autoDistribute(data: {
  group_id: number;
  date_from?: string;
  date_to?: string;
  hours_start?: number;
  hours_end?: number;
}): Promise<{
  group_id: number;
  group_name: string;
  proposal: ProposalItem[];
  total_candidates: number;
  total_assigned: number;
  total_unassigned: number;
}> {
  const response = await api.post('/vm-sessions/auto-distribute', data);
  return response.data;
}

/** Crear múltiples sesiones de una propuesta aceptada */
export async function bulkCreateSessions(data: {
  group_id: number;
  session_type?: 'simulador' | 'examen' | 'parcial';
  is_local?: boolean;
  end_hour?: number;
  office_app?: string;
  office_version?: string;
  level?: string;
  parcial_units?: string;
  sessions: { user_id: string; session_date: string; start_hour: number; notes?: string }[];
}): Promise<{
  message: string;
  created: VmSession[];
  errors: { user_id: string; error: string }[];
}> {
  const response = await api.post('/vm-sessions/bulk-create', data);
  return response.data;
}

// ─── Admin: Workstations / VDIs ────────────────────────────────

export interface Workstation {
  equipo_id: number;
  nombre: string;
  activo: boolean;
  soporte: boolean;
  color: string | null;
  server_location: string | null;
  cert_type: string | null;
}

/** Listar VDIs (solo admin) */
export async function getWorkstations(showAll = false): Promise<{
  workstations: Workstation[];
  total: number;
}> {
  const response = await api.get('/vm-sessions/workstations', {
    params: { all: showAll ? 'true' : 'false' },
  });
  return response.data;
}

/** Activar/desactivar una VDI (solo admin) */
export async function toggleWorkstation(
  equipoId: number,
  active: boolean
): Promise<{ message: string }> {
  const response = await api.patch(`/vm-sessions/workstations/${equipoId}/toggle`, { active });
  return response.data;
}

/** Estado actual de VDIs (solo admin) */
export async function getWorkstationStatus(): Promise<{
  current_slot: string;
  total_active_vdis: number;
  occupied_now: number;
  available_now: number;
  vdis: Workstation[];
}> {
  const response = await api.get('/vm-sessions/workstations/status');
  return response.data;
}

/** Health check de conexión a EvaluaasiConfig (solo admin) */
export async function getConfigHealth(): Promise<{
  connected: boolean;
  error?: string;
}> {
  const response = await api.get('/vm-sessions/config-health');
  return response.data;
}

// ─── Admin: SOAP ADWebService ──────────────────────────────────

export interface AdUser {
  subsystem: string | null;
  name: string | null;
  given_name: string | null;
  surname: string | null;
  sam_account_name: string | null;
  display_name: string | null;
  user_principal_name: string | null;
  path: string | null;
  logon_workstations: string | null;
  profile_path: string | null;
  day: string | null;
  begin: number | null;
  end: number | null;
  expired: string | null;
}

/** Health check SOAP ADWebService (solo admin) */
export async function getSoapHealth(): Promise<{
  connected: boolean;
  url: string;
  message?: string;
  error?: string;
}> {
  const response = await api.get('/vm-sessions/soap-health');
  return response.data;
}

/** Obtener usuarios AD creados por el EXE legacy (solo admin) */
export async function getSoapUsers(): Promise<{
  users: AdUser[];
  total: number;
}> {
  const response = await api.get('/vm-sessions/soap-users');
  return response.data;
}

/** Obtener aplicaciones de un usuario AD (solo admin) */
export async function getSoapApplications(username: string): Promise<{
  username: string;
  applications: string[];
}> {
  const response = await api.get(`/vm-sessions/soap-applications/${username}`);
  return response.data;
}

/** Obtener horarios por equipo desde SOAP (solo admin) */
export async function getSoapHorarios(): Promise<{
  horarios: { equipo: string; horarios: string }[];
  total: number;
}> {
  const response = await api.get('/vm-sessions/soap-horarios');
  return response.data;
}

/** Marcar usuario como completado en AD (solo admin) */
export async function soapMarkCompleted(data: {
  subsistema_id: number;
  plantel_id: number;
  username: string;
}): Promise<{ success: boolean; username: string }> {
  const response = await api.post('/vm-sessions/soap-mark-completed', data);
  return response.data;
}

// ─── Config DB: Subsistemas y Estándares ─────────────────────────────

export interface ConfigSubsistema {
  subsistema_id: number;
  nombre: string;
  abreviatura: string;
  activo: boolean;
}

export interface ConfigEstandar {
  estandar_id: number;
  identificador: string;
  nombre: string;
  etapa_id: number;
  usa_motor: boolean;
}

/** Obtener subsistemas de EvaluaasiConfig (admin/coordinator) */
export async function getConfigSubsistemas(): Promise<ConfigSubsistema[]> {
  const response = await api.get('/vm-sessions/config-subsistemas');
  return response.data.subsistemas;
}

/** Obtener estándares/certificaciones de EvaluaasiConfig (admin/coordinator) */
export async function getConfigEstandares(): Promise<ConfigEstandar[]> {
  const response = await api.get('/vm-sessions/config-estandares');
  return response.data.estandares;
}

// ─── SOAP: Completed / Expired Users ─────────────────────────────────

/** Obtener usuarios AD completados (solo admin) */
export async function getSoapCompletedUsers(): Promise<{
  users: AdUser[];
  total: number;
}> {
  const response = await api.get('/vm-sessions/soap-completed-users');
  return response.data;
}

/** Obtener usuarios AD expirados (solo admin) */
export async function getSoapExpiredUsers(): Promise<{
  users: AdUser[];
  total: number;
}> {
  const response = await api.get('/vm-sessions/soap-expired-users');
  return response.data;
}

// ─── Conexión a VDI (Guacamole SSO) ─────────────────────────────────

export interface VdiConnectResult {
  connect_url?: string;
  guacamole_url?: string;
  workstation_name?: string;
  message?: string;
  error?: string;
  fallback_url?: string;
  fallback_username?: string;
}

/** Conectar a VDI vía Guacamole SSO (candidato/responsable/admin) */
export async function connectToVdi(sessionId: number): Promise<VdiConnectResult> {
  const response = await api.post(`/vm-sessions/sessions/${sessionId}/connect`);
  return response.data;
}
