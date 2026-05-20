/**
 * Servicio frontend para API Keys SSO multi-key por plantel (mayo 2026).
 *
 * Reemplaza el flujo legacy 1:1 (ssoService.ts) — convive con él hasta
 * que se eliminen las columnas viejas en `campuses`. Las api keys creadas
 * aquí soportan N "plantillas de asignación" que se materializan al
 * recibir un candidato por /api/sso/generar_token.
 */
import { api } from './api'

export type SsoAssignmentType = 'all' | 'selected'
export type SsoExamContentType = 'mixed' | 'questions_only' | 'exercises_only'
export type SsoCertificateType = 'conocer' | 'eduit' | 'badge' | 'none'

export interface ApiKeyAssignmentPayload {
  exam_id: number
  assignment_type: SsoAssignmentType
  available_from?: string | null
  available_until?: string | null
  time_limit_minutes?: number | null
  passing_score?: number | null
  max_attempts?: number
  max_disconnections?: number
  exam_content_type?: SsoExamContentType
  exam_questions_count?: number | null
  exam_exercises_count?: number | null
  simulator_questions_count?: number | null
  simulator_exercises_count?: number | null
  security_pin?: string | null
  require_security_pin?: boolean
  validity_months?: number | null
  certificate_type?: SsoCertificateType
  member_ids?: string[]
  material_ids?: number[]
}

export interface ApiKeyAssignment extends Omit<ApiKeyAssignmentPayload, 'member_ids' | 'material_ids'> {
  id: number
  api_key_id: number
  members: string[]
  materials: number[]
  created_at: string | null
  updated_at: string | null
  exam?: {
    id: number
    name: string
    version?: string | null
    standard?: string | null
    competency_standard_id?: number | null
  }
}

export interface CampusApiKeyRow {
  id: number
  campus_id: number
  description: string | null
  name: string | null
  api_key_prefix: string | null
  is_active: boolean
  is_legacy: boolean
  created_at: string | null
  created_by_id: string | null
  created_by?: { id: string; username: string; full_name: string }
  updated_at: string | null
  last_used_at: string | null
  last_used_ip: string | null
  usage_count: number
  assignment_count: number
  assignments?: ApiKeyAssignment[]
}

export interface CampusApiKeyWithSecret extends CampusApiKeyRow {
  api_key?: string
  warning?: string
}

export interface CampusApiKeysListResponse {
  campus_id: number
  enable_sso_api: boolean
  token_ttl_minutes: number
  api_keys: CampusApiKeyRow[]
}

export const ssoApiKeysService = {
  // ── Listado / detalle ───────────────────────────────────────────────
  list: async (campusId: number): Promise<CampusApiKeysListResponse> => {
    const { data } = await api.get(`/sso/campuses/${campusId}/api-keys`)
    return data
  },

  detail: async (keyId: number): Promise<CampusApiKeyRow> => {
    const { data } = await api.get(`/sso/api-keys/${keyId}`)
    return data
  },

  // ── Crear / actualizar / borrar key ─────────────────────────────────
  create: async (
    campusId: number,
    payload: {
      description: string
      name?: string | null
      assignment?: ApiKeyAssignmentPayload | null
      current_password: string
    },
  ): Promise<CampusApiKeyWithSecret> => {
    const { data } = await api.post(`/sso/campuses/${campusId}/api-keys`, payload)
    return data
  },

  update: async (
    keyId: number,
    payload: { description?: string; name?: string | null; is_active?: boolean },
  ): Promise<CampusApiKeyRow> => {
    const { data } = await api.patch(`/sso/api-keys/${keyId}`, payload)
    return data
  },

  revoke: async (keyId: number, currentPassword: string): Promise<{ message: string; api_key_id: number }> => {
    const { data } = await api.delete(`/sso/api-keys/${keyId}`, {
      data: { current_password: currentPassword },
    })
    return data
  },

  // ── Reveal / Rotate ─────────────────────────────────────────────────
  reveal: async (keyId: number): Promise<CampusApiKeyWithSecret> => {
    const { data } = await api.post(`/sso/api-keys/${keyId}/reveal`)
    return data
  },

  rotate: async (keyId: number, currentPassword: string): Promise<CampusApiKeyWithSecret> => {
    const { data } = await api.post(`/sso/api-keys/${keyId}/rotate`, {
      current_password: currentPassword,
    })
    return data
  },

  // ── Plantillas de asignación ────────────────────────────────────────
  addAssignment: async (keyId: number, payload: ApiKeyAssignmentPayload): Promise<ApiKeyAssignment> => {
    const { data } = await api.post(`/sso/api-keys/${keyId}/assignments`, payload)
    return data
  },

  updateAssignment: async (
    keyId: number,
    assignmentId: number,
    payload: ApiKeyAssignmentPayload,
  ): Promise<ApiKeyAssignment> => {
    const { data } = await api.put(`/sso/api-keys/${keyId}/assignments/${assignmentId}`, payload)
    return data
  },

  deleteAssignment: async (keyId: number, assignmentId: number): Promise<{ message: string }> => {
    const { data } = await api.delete(`/sso/api-keys/${keyId}/assignments/${assignmentId}`)
    return data
  },
}
