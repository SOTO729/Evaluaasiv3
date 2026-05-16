/**
 * Servicio SCORM 1.2.
 *
 * Flujo de subida (paquetes hasta 2 GB):
 *   1. POST /api/scorm/packages/init    → backend devuelve SAS URL escritura.
 *   2. PUT directo al blob.core.windows.net (sin pasar por API).
 *   3. POST /api/scorm/packages/finalize → backend procesa el ZIP y crea registros.
 */
import axios, { AxiosProgressEvent } from 'axios';
import api from './api';

export interface ScormPackage {
  id: number;
  topic_id: number | null;
  version: string;
  title: string;
  description: string | null;
  blob_prefix: string;
  blob_base_url: string;
  manifest_path: string;
  entry_point: string;
  launch_url: string;
  size_bytes: number;
  file_count: number;
  uploaded_by: number | null;
  uploaded_at: string;
  updated_at: string | null;
  attempt?: ScormAttempt | null;
}

export interface ScormAttempt {
  id: number;
  user_id: number;
  package_id: number;
  completion_status: string | null;
  success_status: string | null;
  lesson_status: string | null;
  score_raw: number | null;
  score_min: number | null;
  score_max: number | null;
  score_scaled: number | null;
  session_time: string | null;
  total_time: string | null;
  location: string | null;
  suspend_data: string | null;
  cmi_data: string | null;
  exit_status: string | null;
  is_completed: boolean;
  started_at: string | null;
  last_commit_at: string | null;
  finished_at: string | null;
}

export interface ScormUploadInit {
  upload_id: string;
  blob_name: string;
  container: string;
  upload_url: string;
  expires_at: string;
}

export interface ScormCommitPayload {
  cmi?: Record<string, unknown>;
  lesson_status?: string;
  completion_status?: string;
  success_status?: string;
  score?: { raw?: number; min?: number; max?: number; scaled?: number };
  session_time?: string;
  total_time?: string;
  location?: string;
  suspend_data?: string;
  exit?: string;
  finished?: boolean;
}

// 1) Inicializar upload → SAS URL
export async function initScormUpload(filename: string, sizeBytes?: number): Promise<ScormUploadInit> {
  const { data } = await api.post('/scorm/packages/init', { filename, size_bytes: sizeBytes });
  return data;
}

// 2) Subida directa al blob (PUT con header x-ms-blob-type)
export async function uploadScormToBlob(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': 'application/zip',
    },
    onUploadProgress: (evt: AxiosProgressEvent) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
    // Sin interceptors de la API (no requiere auth, el SAS lo lleva en URL)
    transformRequest: [(data) => data],
  });
}

// 3) Finalizar (extracción + registro en DB)
export async function finalizeScormUpload(params: {
  upload_id: string;
  blob_name: string;
  title?: string;
  description?: string;
}): Promise<ScormPackage> {
  const { data } = await api.post('/scorm/packages/finalize', params);
  return data;
}

// ---------------------------------------------------------------------------
// Importación jerárquica (Material → Sesión → Tema desde un SCORM)
// ---------------------------------------------------------------------------

export interface ScormManifestNode {
  title: string;
  type: 'container' | 'sco' | 'asset';
  entry_point: string | null;
  children?: ScormManifestNode[];
}

export interface ScormImportPreview {
  prefix: string;
  base_url: string;
  manifest_path: string;
  default_entry_point: string | null;
  version: string;
  title: string | null;
  size_bytes: number;
  file_count: number;
  tree: ScormManifestNode[];
}

/**
 * Extrae un ZIP SCORM ya subido al blob y devuelve la jerarquía completa
 * del manifest. NO crea registros en DB; el siguiente paso es llamar a
 * `createMaterialFromScorm` (en studyContentService) con el árbol editado.
 */
export async function extractScormForImport(params: {
  upload_id: string;
  blob_name: string;
}): Promise<ScormImportPreview> {
  const { data } = await api.post('/scorm/import/extract', params);
  return data;
}

export async function getScormPackage(id: number): Promise<ScormPackage> {
  const { data } = await api.get(`/scorm/packages/${id}`);
  return data;
}

export async function deleteScormPackage(id: number): Promise<void> {
  await api.delete(`/scorm/packages/${id}`);
}

export async function attachScormToTopic(topicId: number, packageId: number): Promise<ScormPackage> {
  const { data } = await api.post(`/scorm/topics/${topicId}/attach/${packageId}`);
  return data;
}

export async function detachScormFromTopic(topicId: number): Promise<{ detached: boolean; package_id?: number }> {
  const { data } = await api.post(`/scorm/topics/${topicId}/detach`);
  return data;
}

export async function launchScorm(packageId: number): Promise<{
  package: ScormPackage;
  launch_url: string;
  attempt: ScormAttempt | null;
}> {
  const { data } = await api.get(`/scorm/packages/${packageId}/launch`);
  return data;
}

export async function getScormAttempt(packageId: number): Promise<ScormAttempt | null> {
  const { data } = await api.get(`/scorm/packages/${packageId}/attempt`);
  return data?.attempt ?? null;
}

export async function commitScorm(packageId: number, payload: ScormCommitPayload): Promise<ScormAttempt> {
  const { data } = await api.post(`/scorm/packages/${packageId}/commit`, payload);
  return data.attempt as ScormAttempt;
}

// Helper de conveniencia: flujo completo upload+finalize
export async function uploadScormPackage(
  file: File,
  meta: { title?: string; description?: string } = {},
  onProgress?: (pct: number) => void,
): Promise<ScormPackage> {
  const init = await initScormUpload(file.name, file.size);
  await uploadScormToBlob(init.upload_url, file, onProgress);
  return await finalizeScormUpload({
    upload_id: init.upload_id,
    blob_name: init.blob_name,
    title: meta.title,
    description: meta.description,
  });
}
