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
  phone?: string;
  created_at: string;
  last_login?: string;
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

export interface BulkUploadResult {
  message: string;
  summary: {
    total_processed: number;
    created: number;
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
    errors: Array<{ username: string; error: string }>;
  };
}

export async function bulkUploadCandidates(file: File, groupId?: number): Promise<BulkUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (groupId) {
    formData.append('group_id', String(groupId));
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
