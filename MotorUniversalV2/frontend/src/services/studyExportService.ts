/**
 * Servicio para solicitudes de exportación SCORM de materiales de estudio.
 *
 * Flujo:
 *  - Editor crea solicitud (`createExportRequest`) → backend la marca pending.
 *  - Admin/gerente listan (`listExportRequests`) y aprueban/rechazan.
 *  - Una vez aprobada, editor consulta `getExportStatus` y descarga
 *    (`downloadExport`), consumiendo la autorización.
 */
import api from './api';

export type StudyExportStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'consumed';

export interface StudyExportRequest {
  id: number;
  material_id: number;
  status: StudyExportStatus;
  reason: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_by_email: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  consumed_at: string | null;
  consumed_filename: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  material?: {
    id: number;
    title: string;
    description: string | null;
    image_url: string | null;
    is_published: boolean;
  } | null;
}

export interface StudyExportStatusResponse {
  material_id: number;
  has_active_request: boolean;
  request: StudyExportRequest | null;
}

export interface StudyExportListResponse {
  requests: StudyExportRequest[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface StudyExportStats {
  pending: number;
  approved: number;
  rejected: number;
  consumed: number;
  total: number;
}

export async function getExportStatus(
  materialId: number,
): Promise<StudyExportStatusResponse> {
  const { data } = await api.get(
    `/study-contents/${materialId}/export/status`,
  );
  return data;
}

export async function createExportRequest(
  materialId: number,
  reason?: string,
): Promise<{ message: string; request: StudyExportRequest }> {
  const { data } = await api.post(
    `/study-contents/${materialId}/export/request`,
    { reason },
  );
  return data;
}

export async function listExportRequests(params?: {
  status?: 'pending' | 'approved' | 'rejected' | 'consumed' | 'active' | 'all';
  page?: number;
  per_page?: number;
}): Promise<StudyExportListResponse> {
  const { data } = await api.get('/study-export-requests', { params });
  return data;
}

export async function getExportRequest(
  requestId: number,
): Promise<StudyExportRequest> {
  const { data } = await api.get(`/study-export-requests/${requestId}`);
  return data;
}

export async function approveExportRequest(
  requestId: number,
  notes?: string,
): Promise<{ message: string; request: StudyExportRequest }> {
  const { data } = await api.post(
    `/study-export-requests/${requestId}/approve`,
    { notes },
  );
  return data;
}

export async function rejectExportRequest(
  requestId: number,
  notes?: string,
): Promise<{ message: string; request: StudyExportRequest }> {
  const { data } = await api.post(
    `/study-export-requests/${requestId}/reject`,
    { notes },
  );
  return data;
}

export async function getExportStats(): Promise<StudyExportStats> {
  const { data } = await api.get('/study-export-requests/stats');
  return data;
}

/**
 * Descarga el ZIP SCORM. Consume la autorización vigente.
 * Devuelve el blob para que el llamador dispare el download del navegador.
 */
export async function downloadExport(
  materialId: number,
): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get(
    `/study-contents/${materialId}/export/download`,
    { responseType: 'blob' },
  );
  // Intentar extraer filename del header Content-Disposition.
  const disposition: string = response.headers['content-disposition'] || '';
  let filename = `scorm-material-${materialId}.zip`;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
  if (match && match[1]) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }
  return { blob: response.data, filename };
}
