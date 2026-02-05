/**
 * Servicio API para Estándares de Competencia (ECM)
 */
import api from './api';

export interface CompetencyStandard {
  id: number;
  code: string;
  name: string;
  description?: string;
  sector?: string;
  level?: number;
  validity_years: number;
  certifying_body: string;
  brand_id?: number;
  brand?: Brand | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
  exam_count?: number;
  results_count?: number;
  active_exam?: {
    id: number;
    name: string;
    version: string;
  } | null;
}

export interface Brand {
  id: number;
  name: string;
  logo_url?: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  standards_count?: number;
}

export interface DeletionRequest {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_response?: string;
  requested_by: string;
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface CreateStandardDTO {
  code: string;
  name: string;
  description?: string;
  sector?: string;
  level?: number;
  validity_years?: number;
  certifying_body?: string;
  brand_id?: number;
}

export interface UpdateStandardDTO {
  name?: string;
  description?: string;
  sector?: string;
  level?: number;
  validity_years?: number;
  certifying_body?: string;
  brand_id?: number;
  is_active?: boolean;
}

/**
 * Obtener lista de estándares de competencia
 */
export const getStandards = async (params?: {
  active_only?: boolean;
  include_stats?: boolean;
}): Promise<{ standards: CompetencyStandard[]; total: number }> => {
  const searchParams = new URLSearchParams();
  
  if (params?.active_only !== undefined) {
    searchParams.append('active_only', String(params.active_only));
  }
  if (params?.include_stats !== undefined) {
    searchParams.append('include_stats', String(params.include_stats));
  }
  
  const query = searchParams.toString();
  const response = await api.get(`/competency-standards/${query ? `?${query}` : ''}`);
  return response.data;
};

/**
 * Obtener un estándar por ID
 */
export const getStandard = async (id: number): Promise<CompetencyStandard> => {
  const response = await api.get(`/competency-standards/${id}`);
  return response.data;
};

/**
 * Crear un nuevo estándar
 */
export const createStandard = async (data: CreateStandardDTO): Promise<{
  message: string;
  standard: CompetencyStandard;
}> => {
  const response = await api.post('/competency-standards/', data);
  return response.data;
};

/**
 * Actualizar un estándar
 */
export const updateStandard = async (id: number, data: UpdateStandardDTO): Promise<{
  message: string;
  standard: CompetencyStandard;
}> => {
  const response = await api.put(`/competency-standards/${id}`, data);
  return response.data;
};

/**
 * Eliminar un estándar (solo admin)
 */
export const deleteStandard = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/competency-standards/${id}`);
  return response.data;
};

/**
 * Solicitar eliminación de un estándar (para editores)
 */
export const requestDeletion = async (id: number, reason: string): Promise<{
  message: string;
  request: DeletionRequest;
}> => {
  const response = await api.post(`/competency-standards/${id}/request-deletion`, { reason });
  return response.data;
};

/**
 * Obtener exámenes de un estándar
 */
export const getStandardExams = async (id: number): Promise<{
  standard: { id: number; code: string; name: string };
  exams: any[];
  total: number;
}> => {
  const response = await api.get(`/competency-standards/${id}/exams`);
  return response.data;
};

// ===== ADMIN ENDPOINTS =====

/**
 * Obtener solicitudes de eliminación (admin)
 */
export const getDeletionRequests = async (status?: string): Promise<{
  requests: DeletionRequest[];
  total: number;
}> => {
  const query = status ? `?status=${status}` : '';
  const response = await api.get(`/competency-standards/deletion-requests${query}`);
  return response.data;
};

/**
 * Revisar solicitud de eliminación (admin)
 */
export const reviewDeletionRequest = async (
  requestId: number,
  action: 'approve' | 'reject',
  response?: string
): Promise<{
  message: string;
  request: DeletionRequest;
}> => {
  const res = await api.post(`/competency-standards/deletion-requests/${requestId}/review`, {
    action,
    response,
  });
  return res.data;
// ===== BRANDS ENDPOINTS =====

/**
 * Obtener lista de marcas
 */
export const getBrands = async (params?: {
  active_only?: boolean;
  include_stats?: boolean;
}): Promise<{ brands: Brand[]; total: number }> => {
  const searchParams = new URLSearchParams();
  
  if (params?.active_only !== undefined) {
    searchParams.append('active_only', String(params.active_only));
  }
  if (params?.include_stats !== undefined) {
    searchParams.append('include_stats', String(params.include_stats));
  }
  
  const query = searchParams.toString();
  const response = await api.get(`/competency-standards/brands${query ? `?${query}` : ''}`);
  return response.data;
};

/**
 * Obtener una marca por ID
 */
export const getBrand = async (id: number): Promise<{ brand: Brand }> => {
  const response = await api.get(`/competency-standards/brands/${id}`);
  return response.data;
};

/**
 * Crear una nueva marca
 */
export const createBrand = async (data: {
  name: string;
  logo_url?: string;
  description?: string;
  display_order?: number;
}): Promise<{ message: string; brand: Brand }> => {
  const response = await api.post('/competency-standards/brands', data);
  return response.data;
};

/**
 * Actualizar una marca
 */
export const updateBrand = async (id: number, data: {
  name?: string;
  logo_url?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}): Promise<{ message: string; brand: Brand }> => {
  const response = await api.put(`/competency-standards/brands/${id}`, data);
  return response.data;
};

/**
 * Eliminar una marca (soft delete)
 */
export const deleteBrand = async (id: number): Promise<{ message: string }> => {
  const response = await api.delete(`/competency-standards/brands/${id}`);
  return response.data;
};

export default {
  getStandards,
  getStandard,
  createStandard,
  updateStandard,
  deleteStandard,
  requestDeletion,
  getStandardExams,
  getDeletionRequests,
  reviewDeletionRequest,
  // Brands
  getBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand
  getDeletionRequests,
  reviewDeletionRequest,
};
