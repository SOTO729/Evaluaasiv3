/**
 * Servicio para gestionar la API Key SSO de un PLANTEL (Campus).
 * Cubre /api/sso/campuses/<id>/api-key y /api/sso/campuses/<id>/share-api-key.
 */
import api from './api'

export interface SsoApiKeyInfo {
  campus_id: number
  has_key: boolean
  api_key_prefix: string | null
  api_key_active: boolean
  api_key_created_at: string | null
  api_key_created_by: string | null
  share_api_key_with_responsable: boolean
  token_ttl_minutes: number
}

export interface SsoApiKeyWithSecret extends SsoApiKeyInfo {
  api_key: string // visible solo en /api-key (POST) y /api-key/reveal (POST)
  warning?: string
}

export const ssoService = {
  getApiKeyInfo: async (campusId: number): Promise<SsoApiKeyInfo> => {
    const { data } = await api.get<SsoApiKeyInfo>(`/sso/campuses/${campusId}/api-key`)
    return data
  },

  generateApiKey: async (campusId: number): Promise<SsoApiKeyWithSecret> => {
    const { data } = await api.post<SsoApiKeyWithSecret>(`/sso/campuses/${campusId}/api-key`)
    return data
  },

  revealApiKey: async (campusId: number): Promise<SsoApiKeyWithSecret> => {
    const { data } = await api.post<SsoApiKeyWithSecret>(`/sso/campuses/${campusId}/api-key/reveal`)
    return data
  },

  revokeApiKey: async (campusId: number): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/sso/campuses/${campusId}/api-key`)
    return data
  },

  setShareWithResponsable: async (
    campusId: number,
    share: boolean
  ): Promise<SsoApiKeyInfo> => {
    const { data } = await api.patch<SsoApiKeyInfo>(
      `/sso/campuses/${campusId}/share-api-key`,
      { share }
    )
    return data
  },
}
