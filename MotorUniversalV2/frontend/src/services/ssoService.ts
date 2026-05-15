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
  enable_sso_api: boolean
  token_ttl_minutes: number
}

export interface SsoApiKeyWithSecret extends SsoApiKeyInfo {
  api_key?: string // visible solo en /api-key (POST), /api-key/reveal (POST) y al activar el módulo si se auto-generó
  warning?: string
}

export const ssoService = {
  getApiKeyInfo: async (campusId: number): Promise<SsoApiKeyInfo> => {
    const { data } = await api.get<SsoApiKeyInfo>(`/sso/campuses/${campusId}/api-key`)
    return data
  },

  generateApiKey: async (
    campusId: number,
    currentPassword: string
  ): Promise<SsoApiKeyWithSecret> => {
    const { data } = await api.post<SsoApiKeyWithSecret>(
      `/sso/campuses/${campusId}/api-key`,
      { current_password: currentPassword }
    )
    return data
  },

  revealApiKey: async (campusId: number): Promise<SsoApiKeyWithSecret> => {
    const { data } = await api.post<SsoApiKeyWithSecret>(`/sso/campuses/${campusId}/api-key/reveal`)
    return data
  },

  revokeApiKey: async (
    campusId: number,
    currentPassword: string
  ): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(
      `/sso/campuses/${campusId}/api-key`,
      { data: { current_password: currentPassword } }
    )
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

  /**
   * Activa o desactiva el módulo SSO API a nivel plantel. Si al activarlo
   * el plantel aún no tenía llave, el backend la auto-genera y la incluye
   * UNA sola vez en `api_key`.
   */
  setEnableSsoApi: async (
    campusId: number,
    enabled: boolean
  ): Promise<SsoApiKeyWithSecret> => {
    const { data } = await api.patch<SsoApiKeyWithSecret>(
      `/sso/campuses/${campusId}/enable-sso-api`,
      { enabled }
    )
    return data
  },
}
