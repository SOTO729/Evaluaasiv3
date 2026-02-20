/**
 * Servicio para gestión de Saldos y Solicitudes de Financiamiento
 * 
 * Endpoints para:
 * - Coordinadores: ver saldo, solicitar saldo/beca, historial
 * - Financieros: revisar solicitudes, recomendar aprobación/rechazo
 * - Gerentes/Admin: aprobar o rechazar solicitudes
 */
import api from './api';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface CoordinatorBalance {
  id: number;
  coordinator_id: string;
  group_id: number;
  current_balance: number;
  total_received: number;
  total_spent: number;
  total_scholarships: number;
  created_at: string;
  updated_at: string;
  coordinator?: {
    id: string;
    name: string;
    first_surname: string;
    second_surname?: string;
    full_name: string;
    email: string;
  };
  group?: {
    id: number;
    name: string;
    code: string;
    campus_id: number;
    campus_name?: string;
    certification_cost?: number;
  };
}

export interface MyBalanceResponse {
  balances: CoordinatorBalance[];
  totals: {
    current_balance: number;
    total_received: number;
    total_spent: number;
    total_scholarships: number;
  };
  coordinator: {
    id: string;
    name: string;
    first_surname: string;
    full_name: string;
    email: string;
  };
}

export type RequestStatus = 
  | 'pending' 
  | 'in_review' 
  | 'recommended_approve' 
  | 'recommended_reject' 
  | 'approved' 
  | 'rejected'
  | 'cancelled';

export type RequestType = 'saldo' | 'beca';

export interface BalanceRequest {
  id: number;
  coordinator_id: string;
  campus_id: number | null;
  group_id: number | null;
  request_type: RequestType;
  request_type_label: string;
  amount_requested: number;
  amount_approved: number | null;
  justification: string;
  status: RequestStatus;
  status_label: string;
  financiero_notes: string | null;
  financiero_recommended_amount: number | null;
  financiero_reviewed_at: string | null;
  documentation_requested: string | null;
  documentation_provided: boolean;
  attachments: Attachment[];
  approver_notes: string | null;
  approved_at: string | null;
  requested_at: string;
  updated_at: string;
  coordinator?: {
    id: string;
    name: string;
    first_surname: string;
    full_name: string;
    email: string;
  };
  campus?: {
    id: number;
    name: string;
    state_name: string;
    partner_id: number;
    partner_name?: string;
  };
  group?: {
    id: number;
    name: string;
    code: string;
  };
  financiero?: {
    id: string;
    full_name: string;
  };
  approved_by?: {
    id: string;
    full_name: string;
  };
}

export type TransactionType = 'credit' | 'debit' | 'adjustment';

export type TransactionConcept = 
  | 'saldo_aprobado' 
  | 'beca' 
  | 'asignacion_certificacion' 
  | 'asignacion_retoma' 
  | 'ajuste_manual' 
  | 'devolucion';

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface BalanceTransaction {
  id: number;
  coordinator_id: string;
  group_id: number | null;
  transaction_type: TransactionType;
  transaction_type_label: string;
  concept: TransactionConcept;
  concept_label: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: number | null;
  request_id: number | null;
  is_scholarship: boolean;
  notes: string | null;
  description: string | null;
  created_by_id: string | null;
  created_at: string;
  campus?: {
    id: number;
    name: string;
  };
  group?: {
    id: number;
    name: string;
  };
  coordinator?: {
    id: string;
    full_name: string;
  };
  created_by?: {
    id: string;
    full_name: string;
  };
}

export interface BalanceStats {
  totals: {
    current_balance: number;
    total_received: number;
    total_spent: number;
    total_scholarships: number;
  };
  coordinators_with_balance: number;
  requests: {
    pending: number;
    in_review: number;
    awaiting_approval: number;
  };
}

export interface PaginatedResponse<T> {
  total: number;
  pages: number;
  current_page: number;
  [key: string]: T[] | number;
}

// =====================================================
// ENDPOINTS PARA COORDINADORES
// =====================================================

/**
 * Obtener saldos por grupo del coordinador logueado
 */
export async function getMyBalance(): Promise<MyBalanceResponse> {
  const response = await api.get('/balance/my-balance');
  return response.data;
}

/**
 * Obtener historial de transacciones del coordinador
 */
export async function getMyTransactions(params?: {
  page?: number;
  per_page?: number;
  group_id?: number;
}): Promise<PaginatedResponse<BalanceTransaction> & { transactions: BalanceTransaction[] }> {
  const response = await api.get('/balance/my-transactions', { params });
  return response.data;
}

/**
 * Obtener mis solicitudes de saldo
 */
export async function getMyRequests(params?: {
  page?: number;
  per_page?: number;
  status?: RequestStatus;
  request_type?: RequestType;
}): Promise<PaginatedResponse<BalanceRequest> & { requests: BalanceRequest[] }> {
  const response = await api.get('/balance/my-requests', { params });
  return response.data;
}

/**
 * Crear una nueva solicitud de saldo o beca
 */
export async function createBalanceRequest(data: {
  amount_requested: number;
  justification: string;
  campus_id: number;
  group_id: number;
  request_type?: RequestType;
  attachments?: Attachment[];
}): Promise<{ message: string; request: BalanceRequest }> {
  const response = await api.post('/balance/request', data);
  return response.data;
}

/**
 * Crear múltiples solicitudes de saldo/beca en lote (un solo email consolidado)
 */
export async function createBatchBalanceRequest(data: {
  items: {
    campus_id: number;
    group_id: number;
    amount_requested: number;
    request_type?: RequestType;
  }[];
  justification: string;
  attachments?: Attachment[];
}): Promise<{ message: string; requests: BalanceRequest[] }> {
  const response = await api.post('/balance/request-batch', data);
  return response.data;
}

// =====================================================
// ENDPOINTS PARA FINANCIEROS
// =====================================================

/**
 * Obtener solicitudes pendientes de revisión
 */
export async function getPendingRequests(params?: {
  page?: number;
  per_page?: number;
  status?: 'pending' | 'in_review' | 'all_pending' | 'all';
  type?: RequestType;
}): Promise<PaginatedResponse<BalanceRequest> & { 
  requests: BalanceRequest[];
  stats: { pending: number; in_review: number; recommended: number };
}> {
  const response = await api.get('/balance/pending-requests', { params });
  return response.data;
}

/**
 * Revisar una solicitud (financiero)
 */
export async function reviewRequest(requestId: number, data: {
  action: 'request_docs' | 'recommend_approve' | 'recommend_reject';
  documentation_requested?: string;
  recommended_amount?: number;
  notes?: string;
}): Promise<{ message: string; request: BalanceRequest }> {
  const response = await api.put(`/balance/requests/${requestId}/review`, data);
  return response.data;
}

// =====================================================
// ENDPOINTS PARA GERENTES/ADMIN
// =====================================================

/**
 * Obtener una solicitud de saldo por ID
 */
export async function getBalanceRequest(requestId: number): Promise<BalanceRequest> {
  const response = await api.get(`/balance/requests/${requestId}`);
  return response.data;
}

/**
 * Obtener solicitudes listas para aprobación
 */
export async function getRequestsForApproval(params?: {
  page?: number;
  per_page?: number;
  show_all?: boolean;
  status?: string;
}): Promise<PaginatedResponse<BalanceRequest> & { 
  requests: BalanceRequest[];
  stats: { pending: number; in_review: number; recommended_approve: number; recommended_reject: number; approved: number; rejected: number };
}> {
  const response = await api.get('/balance/requests-for-approval', { params });
  return response.data;
}

/**
 * Aprobar una solicitud de saldo
 */
export async function approveRequest(requestId: number, data: {
  amount_approved?: number;
  notes?: string;
}): Promise<{ message: string; request: BalanceRequest; new_balance: number }> {
  const response = await api.put(`/balance/requests/${requestId}/approve`, data);
  return response.data;
}

/**
 * Rechazar una solicitud de saldo
 */
export async function rejectRequest(requestId: number, data: {
  notes: string;
}): Promise<{ message: string; request: BalanceRequest }> {
  const response = await api.put(`/balance/requests/${requestId}/reject`, data);
  return response.data;
}

/**
 * Cancelar una solicitud de saldo (coordinador o financiero)
 */
export async function cancelRequest(requestId: number, data?: {
  reason?: string;
}): Promise<{ message: string; request: BalanceRequest }> {
  const response = await api.put(`/balance/requests/${requestId}/cancel`, data || {});
  return response.data;
}

// =====================================================
// ENDPOINTS DE REPORTES
// =====================================================

/**
 * Obtener lista de coordinadores con sus saldos
 */
export async function getCoordinatorsBalances(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  low_balance?: boolean;
}): Promise<PaginatedResponse<any> & { 
  coordinators: Array<{
    coordinator: { id: string; full_name: string; email: string };
    balances: CoordinatorBalance[];
    totals: { current_balance: number; total_received: number; total_spent: number; total_scholarships: number };
  }>;
}> {
  const response = await api.get('/balance/coordinators', { params });
  return response.data;
}

/**
 * Crear un ajuste manual al saldo
 */
export async function createAdjustment(data: {
  coordinator_id: string;
  group_id: number;
  amount: number;
  notes: string;
}): Promise<{ message: string; transaction: BalanceTransaction; new_balance: number }> {
  const response = await api.post('/balance/adjustments', data);
  return response.data;
}

/**
 * Obtener estadísticas generales de saldos
 */
export async function getBalanceStats(): Promise<BalanceStats> {
  const response = await api.get('/balance/stats');
  return response.data;
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Obtener color del badge según el estado
 */
export function getStatusColor(status: RequestStatus): string {
  const colors: Record<RequestStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_review: 'bg-blue-100 text-blue-800',
    recommended_approve: 'bg-green-100 text-green-800',
    recommended_reject: 'bg-red-100 text-red-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-200 text-red-900',
    cancelled: 'bg-gray-200 text-gray-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Obtener etiqueta del estado
 */
export function getStatusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    pending: 'Pendiente',
    in_review: 'En revisión',
    recommended_approve: 'Recomendado aprobar',
    recommended_reject: 'Recomendado rechazar',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
}

/**
 * Obtener color del tipo de transacción
 */
export function getTransactionColor(type: TransactionType): string {
  const colors: Record<TransactionType, string> = {
    credit: 'text-green-600',
    debit: 'text-red-600',
    adjustment: 'text-blue-600',
  };
  return colors[type] || 'text-gray-600';
}

/**
 * Formatear monto como moneda
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Calcular certificaciones disponibles dado un saldo y costo
 */
export function calculateCertificationsAvailable(balance: number, certificationCost: number): number {
  if (certificationCost <= 0) return 0;
  return Math.floor(balance / certificationCost);
}

/**
 * Alias para obtener todos los saldos de coordinadores
 */
export const getAllBalances = getCoordinatorsBalances;

/**
 * Alias para obtener transacciones (admin)
 */
export async function getTransactions(params?: {
  page?: number;
  per_page?: number;
  coordinator_id?: string;
}): Promise<PaginatedResponse<BalanceTransaction> & { transactions: BalanceTransaction[] }> {
  const response = await api.get('/balance/transactions', { params });
  return response.data;
}

// =====================================================
// FUNCIONES DE ARCHIVOS ADJUNTOS
// =====================================================

/**
 * Subir archivo adjunto a Azure Blob Storage
 */
export async function uploadAttachment(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/balance/upload-attachment', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data.attachment;
}

/**
 * Actualizar adjuntos de una solicitud
 */
export async function updateRequestAttachments(
  requestId: number, 
  attachments: Attachment[]
): Promise<Attachment[]> {
  const response = await api.put(`/balance/request/${requestId}/attachments`, {
    attachments,
  });
  return response.data.attachments;
}

/**
 * Extensiones de archivo permitidas
 */
export const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx'];

/**
 * Tamaño máximo de archivo (10 MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validar archivo antes de subir
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Tipo no permitido. Permitidos: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`,
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Archivo demasiado grande. Máximo: 10 MB',
    };
  }
  
  return { valid: true };
}

/**
 * Formatear tamaño de archivo
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =====================================================
// HISTORIAL DE ASIGNACIONES
// =====================================================

export interface AssignmentDetails {
  group_exam_id: number;
  group: {
    id: number;
    name: string;
    code: string;
  } | null;
  exam: {
    id: number;
    name: string;
    ecm_code: string | null;
  } | null;
  assignment_type: 'all' | 'selected';
  candidates_count: number;
  unit_cost: number;
  assigned_at: string | null;
}

export interface AssignmentTransaction extends BalanceTransaction {
  assignment_details?: AssignmentDetails;
}

export interface AssignmentHistoryResponse {
  transactions: AssignmentTransaction[];
  total: number;
  pages: number;
  current_page: number;
  per_page: number;
  summary: {
    total_assignments: number;
    total_spent: number;
  };
}

/**
 * Obtener historial detallado de asignaciones con consumo de saldo
 */
export async function getAssignmentHistory(params?: {
  page?: number;
  per_page?: number;
  concept?: 'asignacion_certificacion' | 'asignacion_retoma';
  date_from?: string;
  date_to?: string;
  group_id?: number;
}): Promise<AssignmentHistoryResponse> {
  const response = await api.get('/balance/assignment-history', { params });
  return response.data;
}

// =====================================================
// COST PREVIEW (Pre-asignación)
// =====================================================

export interface CostPreviewData {
  unit_cost: number;
  units: number;
  total_cost: number;
  current_balance: number;
  remaining_balance: number;
  has_sufficient_balance: boolean;
  is_admin: boolean;
  campus_name: string;
  group_name: string;
  cost_source: string;
}

/**
 * Obtener desglose de costo antes de confirmar una asignación
 */
export async function getAssignmentCostPreview(
  groupId: number,
  data: { assignment_type: 'all' | 'selected'; member_ids?: string[] }
): Promise<CostPreviewData> {
  const response = await api.post(`/partners/groups/${groupId}/assignment-cost-preview`, data);
  return response.data;
}


// =====================================================
// DELEGACIÓN DE APROBACIÓN (Gerente → Financiero)
// =====================================================

export interface DelegatedFinanciero {
  id: string;
  name: string;
  first_surname: string;
  second_surname?: string;
  full_name: string;
  email: string;
  can_approve_balance: boolean;
  last_login?: string;
}

/**
 * Obtener lista de financieros con su estado de delegación
 */
export async function getFinancierosForDelegation(): Promise<DelegatedFinanciero[]> {
  const response = await api.get('/balance/delegation/financieros');
  return response.data.financieros;
}

/**
 * Activar/desactivar delegación de aprobación para un financiero
 */
export async function toggleFinancieroDelegation(
  financieroId: string,
  canApprove: boolean
): Promise<{ message: string; financiero: DelegatedFinanciero }> {
  const response = await api.put(`/balance/delegation/financieros/${financieroId}/toggle`, {
    can_approve_balance: canApprove,
  });
  return response.data;
}
