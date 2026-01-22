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
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  first_surname: string;
  second_surname?: string;
  gender?: string;
  curp?: string;
  phone?: string;
  role: string;
  username?: string;
  is_active?: boolean;
  is_verified?: boolean;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  first_surname?: string;
  second_surname?: string;
  gender?: string;
  curp?: string;
  phone?: string;
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

export async function getUsers(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  role?: string;
  is_active?: string;
}): Promise<{
  users: ManagedUser[];
  total: number;
  pages: number;
  current_page: number;
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

export async function toggleUserActive(userId: string): Promise<{
  message: string;
  user: ManagedUser;
}> {
  const response = await api.post(`/user-management/users/${userId}/toggle-active`);
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

// ============== HELPERS ==============

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  soporte: 'Soporte',
  coordinator: 'Coordinador',
  candidato: 'Candidato',
  auxiliar: 'Auxiliar'
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800',
  editor: 'bg-purple-100 text-purple-800',
  soporte: 'bg-blue-100 text-blue-800',
  coordinator: 'bg-amber-100 text-amber-800',
  candidato: 'bg-green-100 text-green-800',
  auxiliar: 'bg-gray-100 text-gray-800'
};
