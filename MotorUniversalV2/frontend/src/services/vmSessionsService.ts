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
  start_hour_label: string;
  status: string;
  notes: string | null;
  created_by_id: string | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
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
  sessions: { user_id: string; session_date: string; start_hour: number; notes?: string }[];
}): Promise<{
  message: string;
  created: VmSession[];
  errors: { user_id: string; error: string }[];
}> {
  const response = await api.post('/vm-sessions/bulk-create', data);
  return response.data;
}
