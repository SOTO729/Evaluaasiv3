/**
 * Servicio para gestión de sesiones de Máquinas Virtuales.
 */
import api from './api';

export interface VmSlot {
  hour: number;
  label: string;
  available: boolean;
  is_past: boolean;
  is_occupied: boolean;
  occupied_by?: {
    session_id: number;
    user_name: string;
    user_email: string;
    user_role: string;
    group_name: string | null;
    campus_name: string | null;
    notes: string | null;
    created_at: string | null;
  };
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

/** Obtener horarios disponibles para una fecha y campus */
export async function getAvailableSlots(params: {
  campus_id: number;
  date: string;
  operating_hours_start?: number;
  operating_hours_end?: number;
}): Promise<{ campus_id: number; date: string; slots: VmSlot[]; total_available: number; total_occupied: number }> {
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
