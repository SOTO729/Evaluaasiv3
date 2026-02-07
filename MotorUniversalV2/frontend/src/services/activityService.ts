/**
 * Servicio para el Portal de Gerencia - Log de Actividad
 * 
 * Endpoints para:
 * - Ver actividad de usuarios tipo "personal"
 * - Filtrar por usuario, acción, entidad, fecha
 * - Dashboard de resumen
 */
import api from './api';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface ActivityLog {
  id: number;
  user_id: string | null;
  user_role: string | null;
  user_email: string | null;
  action_type: string;
  action_type_label: string;
  entity_type: string | null;
  entity_type_label: string | null;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export interface ActivitySummary {
  period_days: number;
  total_actions: number;
  today_actions: number;
  failed_logins: number;
  actions_by_type: Record<string, number>;
  top_users: Array<{
    user_id: string;
    email: string;
    action_count: number;
  }>;
  recent_important: ActivityLog[];
}

export interface SecurityReport {
  period_days: number;
  suspicious_ips: Array<{
    ip: string;
    failed_attempts: number;
  }>;
  users_with_failed_logins: Array<{
    email: string;
    failed_attempts: number;
  }>;
  off_hours_actions: number;
  recent_failed_logins: ActivityLog[];
}

export interface PersonalUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface PaginatedResponse<T> {
  total: number;
  pages: number;
  current_page: number;
  [key: string]: T[] | number | any;
}

// Tipos de acciones
export const ACTION_TYPES: Record<string, string> = {
  // Autenticación
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  login_failed: 'Intento de login fallido',
  
  // CRUD genérico
  create: 'Creación',
  read: 'Lectura',
  update: 'Actualización',
  delete: 'Eliminación',
  
  // Saldos y solicitudes
  balance_request: 'Solicitud de saldo',
  balance_review: 'Revisión de solicitud',
  balance_recommend: 'Recomendación de solicitud',
  balance_approve: 'Aprobación de saldo',
  balance_reject: 'Rechazo de saldo',
  balance_deduct: 'Descuento de saldo',
  
  // Asignaciones
  assign_certification: 'Asignación de certificación',
  assign_material: 'Asignación de material',
  unassign: 'Desasignación',
  
  // Usuarios
  user_create: 'Creación de usuario',
  user_update: 'Actualización de usuario',
  user_activate: 'Activación de usuario',
  user_deactivate: 'Desactivación de usuario',
  
  // Grupos
  group_create: 'Creación de grupo',
  group_update: 'Actualización de grupo',
  group_delete: 'Eliminación de grupo',
  member_add: 'Agregar miembro',
  member_remove: 'Remover miembro',
  
  // Planteles
  campus_create: 'Creación de plantel',
  campus_update: 'Actualización de plantel',
  campus_activate: 'Activación de plantel',
  campus_deactivate: 'Desactivación de plantel',
  
  // Exámenes
  exam_create: 'Creación de examen',
  exam_update: 'Actualización de examen',
  exam_publish: 'Publicación de examen',
  exam_unpublish: 'Despublicación de examen',
  
  // Sistema
  config_change: 'Cambio de configuración',
  export_data: 'Exportación de datos',
  import_data: 'Importación de datos',
};

// Tipos de entidades
export const ENTITY_TYPES: Record<string, string> = {
  user: 'Usuario',
  balance_request: 'Solicitud de saldo',
  balance_transaction: 'Transacción de saldo',
  group: 'Grupo',
  campus: 'Plantel',
  partner: 'Partner',
  exam: 'Examen',
  study_material: 'Material de estudio',
  group_exam: 'Examen de grupo',
  group_member: 'Miembro de grupo',
  system: 'Sistema',
};

// =====================================================
// ENDPOINTS DE LOGS
// =====================================================

/**
 * Obtener logs de actividad con filtros
 */
export async function getActivityLogs(params?: {
  page?: number;
  per_page?: number;
  user_id?: string;
  action_type?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  success?: boolean;
  search?: string;
}): Promise<PaginatedResponse<ActivityLog> & { 
  logs: ActivityLog[];
  filters_available: { action_types: Record<string, string>; entity_types: Record<string, string> };
}> {
  const response = await api.get('/activity/logs', { params });
  return response.data;
}

/**
 * Obtener actividad de un usuario específico
 */
export async function getUserActivity(userId: string, params?: {
  page?: number;
  per_page?: number;
}): Promise<PaginatedResponse<ActivityLog> & { 
  user: { id: string; full_name: string; email: string; role: string };
  logs: ActivityLog[];
}> {
  const response = await api.get(`/activity/logs/user/${userId}`, { params });
  return response.data;
}

/**
 * Obtener resumen de actividad para el dashboard
 */
export async function getActivitySummary(params?: {
  days?: number;
}): Promise<ActivitySummary> {
  const response = await api.get('/activity/summary', { params });
  return response.data;
}

/**
 * Obtener lista de usuarios tipo "personal"
 */
export async function getPersonalUsers(): Promise<{
  users: PersonalUser[];
  roles: string[];
}> {
  const response = await api.get('/activity/personal-users');
  return response.data;
}

/**
 * Obtener reporte de seguridad
 */
export async function getSecurityReport(params?: {
  days?: number;
}): Promise<SecurityReport> {
  const response = await api.get('/activity/security-report', { params });
  return response.data;
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Obtener color del badge según el tipo de acción
 */
export function getActionColor(actionType: string): string {
  // Acciones de error/peligro
  if (['login_failed', 'delete', 'user_deactivate', 'campus_deactivate', 'balance_reject'].includes(actionType)) {
    return 'bg-red-100 text-red-800';
  }
  // Acciones de éxito/aprobación
  if (['login', 'create', 'balance_approve', 'user_activate', 'exam_publish'].includes(actionType)) {
    return 'bg-green-100 text-green-800';
  }
  // Acciones de revisión/pendiente
  if (['balance_review', 'balance_recommend', 'update'].includes(actionType)) {
    return 'bg-blue-100 text-blue-800';
  }
  // Default
  return 'bg-gray-100 text-gray-800';
}

/**
 * Obtener icono según el tipo de acción
 */
export function getActionIcon(actionType: string): string {
  const icons: Record<string, string> = {
    login: '🔓',
    logout: '🔒',
    login_failed: '⚠️',
    create: '➕',
    update: '✏️',
    delete: '🗑️',
    balance_request: '💰',
    balance_approve: '✅',
    balance_reject: '❌',
    user_create: '👤',
    group_create: '👥',
    assign_certification: '📜',
  };
  return icons[actionType] || '📋';
}

/**
 * Formatear fecha relativa
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  
  return date.toLocaleDateString('es-MX', { 
    day: 'numeric', 
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Obtener descripción legible de la acción
 */
export function getActionDescription(log: ActivityLog): string {
  const actionLabel = ACTION_TYPES[log.action_type] || log.action_type;
  const entityLabel = log.entity_type ? (ENTITY_TYPES[log.entity_type] || log.entity_type) : '';
  const entityName = log.entity_name || '';

  if (entityName) {
    return `${actionLabel}: ${entityName}`;
  }
  if (entityLabel) {
    return `${actionLabel} (${entityLabel})`;
  }
  return actionLabel;
}
