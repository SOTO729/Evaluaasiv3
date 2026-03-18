/**
 * Servicio para gestión de usuarios (admin/coordinador)
 */
import api from './api';

// ============== TIPOS ==============

export interface ManagedUser {
  id: string;
  email: string;
  username: string;
  name: string;
  first_surname: string;
  second_surname?: string;
  full_name: string;
  gender?: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  curp?: string;
  curp_verified?: boolean;
  curp_verified_at?: string;
  curp_renapo_name?: string;
  curp_renapo_first_surname?: string;
  curp_renapo_second_surname?: string;
  phone?: string;
  created_at: string;
  last_login?: string;
  // Campos de responsable
  date_of_birth?: string;
  campus_id?: number;
  can_bulk_create_candidates?: boolean;
  can_manage_groups?: boolean;
  can_view_reports?: boolean;
  document_options?: {
    evaluation_report: boolean;
    certificate: boolean;
    conocer_certificate: boolean;
    digital_badge: boolean;
  };
  partners?: Array<{ id: number; name: string; logo_url?: string }>;
  groups?: Array<{ id: number; name: string; campus_name?: string }>;
}

export interface CreateUserData {
  email?: string;  // Opcional para candidatos (requerido para otros roles)
  name: string;
  first_surname: string;
  second_surname?: string;
  gender?: string;
  curp?: string;
  role: string;
  username?: string;
  is_active?: boolean;
  is_verified?: boolean;
  // Campos adicionales para responsables
  date_of_birth?: string;
  campus_id?: number;
  can_bulk_create_candidates?: boolean;
  can_manage_groups?: boolean;
  can_view_reports?: boolean;
  // Campos adicionales para responsable_partner
  partner_id?: number;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  first_surname?: string;
  second_surname?: string;
  gender?: string;
  curp?: string;
  role?: string;
  is_active?: boolean;
  is_verified?: boolean;
  // Campos adicionales para responsables
  date_of_birth?: string;
  campus_id?: number;
  can_bulk_create_candidates?: boolean;
  can_manage_groups?: boolean;
  can_view_reports?: boolean;
  // Campos adicionales para responsable_partner
  partner_id?: number;
}

export interface RoleOption {
  value: string;
  label: string;
  description: string;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  verified_users: number;
  users_by_role: Array<{ role: string; count: number }>;
}

// ============== VALIDACIÓN CURP RENAPO ==============

export interface CurpValidationResult {
  valid: boolean;
  curp: string;
  error?: string;
  skip_reason?: string;
  data?: {
    name: string;
    first_surname: string;
    second_surname?: string;
    gender?: string;
  } | null;
}

export interface CurpBatchValidationResult {
  results: Array<{
    curp: string;
    valid: boolean;
    name?: string;
    first_surname?: string;
    second_surname?: string;
    gender?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

/**
 * Valida una CURP contra RENAPO (~10s).
 * Retorna datos del ciudadano si la CURP es válida.
 */
export async function validateCurpRenapo(curp: string): Promise<CurpValidationResult> {
  const response = await api.post('/user-management/validate-curp', { curp });
  return response.data;
}

/**
 * Valida un lote de CURPs contra RENAPO.
 * Máximo 50 CURPs por solicitud.
 */
export async function validateCurpBatch(curps: string[]): Promise<CurpBatchValidationResult> {
  const response = await api.post('/user-management/validate-curp/batch', { curps });
  return response.data;
}

// ============== LISTAR USUARIOS ==============

/**
 * Obtener lista de usuarios con paginación.
 * Soporta tanto paginación tradicional (offset) como cursor-based.
 * 
 * Cursor pagination es más eficiente para páginas > 100 con datasets grandes.
 * Para usarla, pasa cursor y cursor_date del último usuario de la página anterior.
 */
export async function getUsers(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  role?: string;
  is_active?: string;
  created_from?: string;
  created_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  // Cursor pagination (opcional, más eficiente para grandes datasets)
  cursor?: string;  // ID del último usuario
  cursor_date?: string;  // created_at del último usuario
}): Promise<{
  users: ManagedUser[];
  total: number;
  pages: number;
  current_page: number;
  // Nuevos campos para cursor pagination
  has_more?: boolean;
  next_cursor?: string;
  next_cursor_date?: string;
}> {
  const response = await api.get('/user-management/users', { params });
  return response.data;
}

export async function getUser(userId: string): Promise<ManagedUser> {
  const response = await api.get(`/user-management/users/${userId}`);
  return response.data.user;
}

// ============== VERIFICACIÓN DE SIMILITUD DE NOMBRE ==============

export interface SimilarUser {
  id: string;
  full_name: string;
  email: string | null;
  curp: string | null;
  username: string;
  role: string;
  is_active: boolean;
  match_level: 'exact' | 'partial' | 'surname';
  match_description: string;
}

export interface NameSimilarityResult {
  similar_users: SimilarUser[];
  has_exact_match: boolean;
  total_found: number;
}

export async function checkNameSimilarity(data: {
  name: string;
  first_surname: string;
  second_surname?: string;
}): Promise<NameSimilarityResult> {
  const response = await api.post('/user-management/users/check-name-similarity', data);
  return response.data;
}

// ============== CREAR USUARIOS ==============

export async function createUser(data: CreateUserData): Promise<{
  message: string;
  user: ManagedUser;
}> {
  const response = await api.post('/user-management/users', data);
  return response.data;
}

// ============== ACTUALIZAR USUARIOS ==============

export async function updateUser(userId: string, data: UpdateUserData): Promise<{
  message: string;
  user: ManagedUser;
}> {
  const response = await api.put(`/user-management/users/${userId}`, data);
  return response.data;
}

export async function changeUserPassword(userId: string, newPassword: string): Promise<{
  message: string;
}> {
  const response = await api.put(`/user-management/users/${userId}/password`, {
    new_password: newPassword
  });
  return response.data;
}

export async function generateTempPassword(userId: string): Promise<{
  message: string;
  password: string;
  user: ManagedUser;
}> {
  const response = await api.post(`/user-management/users/${userId}/generate-password`);
  return response.data;
}

export async function getUserPassword(userId: string): Promise<{
  password: string;
  has_password: boolean;
  user: { id: string; email: string; full_name: string };
}> {
  const response = await api.get(`/user-management/users/${userId}/password`);
  return response.data;
}

export async function toggleUserActive(userId: string): Promise<{
  message: string;
  user: ManagedUser;
}> {
  const response = await api.post(`/user-management/users/${userId}/toggle-active`);
  return response.data;
}

export async function deleteUser(userId: string): Promise<{
  message: string;
}> {
  const response = await api.delete(`/user-management/users/${userId}`);
  return response.data;
}

// ============== OPCIONES DE DOCUMENTOS ==============

export async function updateDocumentOptions(userId: string, options: {
  evaluation_report?: boolean;
  certificate?: boolean;
  conocer_certificate?: boolean;
  digital_badge?: boolean;
}): Promise<{
  message: string;
  user: ManagedUser;
}> {
  const response = await api.put(`/user-management/users/${userId}/document-options`, options);
  return response.data;
}

// ============== ESTADÍSTICAS ==============

export async function getUserStats(): Promise<UserStats> {
  const response = await api.get('/user-management/stats');
  return response.data;
}

// ============== ROLES ==============

export async function getAvailableRoles(): Promise<{
  roles: RoleOption[];
  all_roles: RoleOption[] | null;
}> {
  const response = await api.get('/user-management/roles');
  return response.data;
}

// ============== PLANTELES DISPONIBLES (para responsables) ==============

export interface AvailableCampus {
  id: number;
  name: string;
  code: string;
  partner_id: number;
  partner_name: string;
  state_name?: string;
  city?: string;
  has_responsable: boolean;
  activation_status: string;
  certification_cost: number;
}

export async function getAvailableCampuses(): Promise<{
  campuses: AvailableCampus[];
  total: number;
}> {
  const response = await api.get('/user-management/available-campuses');
  return response.data;
}

// ============== PARTNERS DISPONIBLES (para responsable_partner) ==============

export interface AvailablePartner {
  id: number;
  name: string;
  rfc: string;
  contact_email: string;
  country: string;
  total_campuses: number;
}

export async function getAvailablePartners(): Promise<{
  partners: AvailablePartner[];
  total: number;
}> {
  const response = await api.get('/user-management/available-partners');
  return response.data;
}

// ============== HELPERS ==============

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  developer: 'Desarrollador',
  gerente: 'Gerente',
  financiero: 'Financiero',
  editor: 'Editor',
  editor_invitado: 'Editor Invitado',
  soporte: 'Soporte',
  coordinator: 'Coordinador',
  responsable: 'Responsable',
  responsable_partner: 'Resp. Partner',
  candidato: 'Candidato',
  auxiliar: 'Auxiliar'
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  developer: 'bg-orange-100 text-orange-800',
  gerente: 'bg-emerald-100 text-emerald-800',
  financiero: 'bg-cyan-100 text-cyan-800',
  editor: 'bg-purple-100 text-purple-800',
  editor_invitado: 'bg-teal-100 text-teal-800',
  soporte: 'bg-blue-100 text-blue-800',
  coordinator: 'bg-amber-100 text-amber-800',
  responsable: 'bg-indigo-100 text-indigo-800',
  responsable_partner: 'bg-violet-100 text-violet-800',
  candidato: 'bg-green-100 text-green-800',
  auxiliar: 'bg-gray-100 text-gray-800'
};

// ============== CARGA MASIVA ==============

// Preview de carga masiva
export interface BulkUploadPreviewRow {
  row: number;
  status: 'ready' | 'duplicate' | 'error' | 'skipped' | 'name_match';
  email?: string | null;
  nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  genero?: string;
  curp?: string | null;
  username_preview?: string;
  eligibility?: {
    reporte: boolean;
    eduit: boolean;
    conocer: boolean;
    insignia: boolean;
  };
  existing_user?: {
    id: string;
    name: string;
    username: string;
  };
  name_matches?: Array<{
    id: string;
    full_name: string;
    username: string;
    email: string;
    curp: string;
    groups?: Array<{ group_name: string; campus_name: string }>;
  }>;
  error?: string | null;
}

export interface BulkUploadPreviewResult {
  preview: BulkUploadPreviewRow[];
  summary: {
    total_rows: number;
    ready: number;
    name_matches: number;
    duplicates: number;
    errors: number;
    skipped: number;
  };
  can_proceed: boolean;
  group_info?: { id: number; name: string } | null;
}

export async function previewBulkUpload(file: File, groupId?: number): Promise<BulkUploadPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (groupId) {
    formData.append('group_id', String(groupId));
  }
  const response = await api.post('/user-management/candidates/bulk-upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

export interface BulkUploadResult {
  message: string;
  summary: {
    total_processed: number;
    created: number;
    existing_assigned: number;
    errors: number;
    skipped: number;
  };
  details: {
    created: Array<{
      row: number;
      email: string;
      name: string;
      username: string;
      password: string | null;
    }>;
    existing_assigned: Array<{
      row: number;
      email: string;
      name: string;
      username: string;
      user_id: string;
    }>;
    errors: Array<{
      row: number;
      email: string;
      error: string;
    }>;
    skipped: Array<{
      row: number;
      email: string;
      reason: string;
    }>;
    total_processed: number;
  };
  group_assignment?: {
    group_id: number;
    group_name: string;
    assigned: number;
    assigned_new: number;
    assigned_existing: number;
    errors: Array<{ username: string; error: string }>;
  };
  batch_id?: number;
}

export async function bulkUploadCandidates(file: File, groupId?: number, includeExistingIds?: string[], skipRowNumbers?: number[]): Promise<BulkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (groupId) {
    formData.append('group_id', String(groupId));
  }
  if (includeExistingIds && includeExistingIds.length > 0) {
    formData.append('include_existing_ids', JSON.stringify(includeExistingIds));
  }
  if (skipRowNumbers && skipRowNumbers.length > 0) {
    formData.append('skip_row_numbers', JSON.stringify(skipRowNumbers));
  }
  
  const response = await api.post('/user-management/candidates/bulk-upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function downloadBulkUploadTemplate(): Promise<void> {
  try {
    const response = await api.get('/user-management/candidates/bulk-upload/template', {
      responseType: 'blob'
    });
    
    // Verificar que la respuesta no sea un error JSON
    if (response.data.type === 'application/json') {
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.error || 'Error al descargar la plantilla');
    }
    
    // Usar directamente el blob de la respuesta
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_candidatos.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Error downloading template:', error);
    throw error;
  }
}

// ============== EXPORTAR USUARIOS CON CREDENCIALES ==============

/**
 * Exportar usuarios seleccionados con sus credenciales (contraseñas)
 * Solo disponible para administradores
 */
export async function exportSelectedUsersCredentials(userIds: string[]): Promise<void> {
  try {
    const response = await api.post('/user-management/export-credentials', 
      { user_ids: userIds },
      { responseType: 'blob' }
    );
    
    // Verificar si la respuesta es un error JSON
    if (response.data.type === 'application/json') {
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.error || 'Error al exportar usuarios');
    }
    
    // Descargar archivo
    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credenciales_usuarios_${userIds.length}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Error exporting users:', error);
    throw error;
  }
}

// ============== HISTÓRICO DE ALTAS MASIVAS ==============

export interface BulkUploadBatchSummary {
  id: number;
  uploaded_by_id: string;
  uploaded_by_name: string | null;
  partner_id: number | null;
  partner_name: string | null;
  campus_id: number | null;
  campus_name: string | null;
  group_id: number | null;
  group_name: string | null;
  country: string | null;
  state_name: string | null;
  total_processed: number;
  total_created: number;
  total_existing_assigned: number;
  total_errors: number;
  total_skipped: number;
  emails_sent: number;
  emails_failed: number;
  original_filename: string | null;
  created_at: string;
}

export interface BulkUploadMember {
  id: number;
  batch_id: number;
  user_id: string | null;
  row_number: number | null;
  email: string | null;
  full_name: string | null;
  username: string | null;
  curp: string | null;
  gender: string | null;
  status: 'created' | 'existing_assigned' | 'error' | 'skipped' | 'curp_invalid';
  error_message: string | null;
  created_at: string;
}

export interface BulkUploadBatchDetail extends BulkUploadBatchSummary {
  members: BulkUploadMember[];
}

export interface BulkUploadHistoryResponse {
  batches: BulkUploadBatchSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export async function getBulkUploadHistory(params?: {
  page?: number;
  per_page?: number;
  partner_id?: number;
  campus_id?: number;
}): Promise<BulkUploadHistoryResponse> {
  const response = await api.get('/user-management/bulk-history', { params });
  return response.data;
}

export async function getBulkUploadDetail(batchId: number): Promise<BulkUploadBatchDetail> {
  const response = await api.get(`/user-management/bulk-history/${batchId}`);
  return response.data;
}

export async function exportBulkUploadBatch(batchId: number, groupName?: string): Promise<void> {
  try {
    const response = await api.get(`/user-management/bulk-history/${batchId}/export`, {
      responseType: 'blob',
    });

    if (response.data.type === 'application/json') {
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.error || 'Error al exportar');
    }

    const url = window.URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (groupName || 'carga').replace(/\s+/g, '_').substring(0, 30);
    a.download = `altas_masivas_${safeName}_${batchId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Error exporting bulk upload batch:', error);
    throw error;
  }
}


// ============== HISTORIAL DE GRUPOS ==============

export interface GroupHistoryResult {
  id: string;
  score: number;
  status: number;       // 0=en proceso, 1=completado, 2=abandonado
  result: number;       // 0=reprobado, 1=aprobado
  start_date: string | null;
  end_date: string | null;
  duration_seconds: number | null;
  certificate_code: string | null;
  eduit_certificate_code: string | null;
}

export interface GroupHistoryEcmAssignment {
  id: number;
  assignment_number: string;
  tramite_status: string;
  assigned_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
}

export interface GroupHistoryExam {
  group_exam_id: number;
  exam_id: number;
  exam_name: string | null;
  exam_version: string | null;
  competency_standard: { id: number; code: string; name: string } | null;
  assignment_type: string;
  assigned_at: string | null;
  max_attempts: number;
  passing_score: number | null;
  is_active: boolean;
  expires_at: string | null;
  is_expired: boolean;
  ecm_assignment: GroupHistoryEcmAssignment | null;
  results: GroupHistoryResult[];
  attempts_used: number;
}

export interface GroupHistoryEntry {
  group_id: number;
  group_name: string;
  group_code: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  campus: { id: number; name: string; city: string | null } | null;
  cycle: { id: number; name: string } | null;
  membership_status: string;
  joined_at: string | null;
  exams: GroupHistoryExam[];
}

export interface GroupHistoryResponse {
  user_id: string;
  user_name: string;
  groups: GroupHistoryEntry[];
  total_groups: number;
}

export async function getUserGroupHistory(userId: string): Promise<GroupHistoryResponse> {
  const response = await api.get(`/user-management/users/${userId}/group-history`);
  return response.data;
}
