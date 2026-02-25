/**
 * Badge Service — Insignias Digitales Open Badges 3.0
 */
import api from './api'

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface BadgeTemplate {
  id: number
  name: string
  description: string | null
  criteria_narrative: string | null
  exam_id: number | null
  competency_standard_id: number | null
  badge_image_url: string | null
  display_image_url: string | null
  badge_image_blob_name: string | null
  issuer_name: string | null
  issuer_url: string | null
  issuer_image_url: string | null
  tags: string | null
  expiry_months: number | null
  is_active: boolean
  created_by_id: string | null
  created_at: string
  updated_at: string
  issued_count: number
}

export interface IssuedBadge {
  id: number
  badge_uuid: string
  badge_template_id: number
  user_id: string
  result_id: string | null
  badge_code: string
  credential_json: string | null
  badge_image_url: string | null
  badge_image_blob_name: string | null
  issued_at: string
  valid_from: string | null
  expires_at: string | null
  status: 'active' | 'revoked' | 'expired'
  revocation_reason: string | null
  share_count: number
  verify_count: number
  claimed_at: string | null
  verify_url: string
  credential_url: string
  template_name?: string
  candidate_name?: string
  candidate_email?: string
}

export interface BadgeVerification {
  valid: boolean
  document_type: 'digital_badge'
  document_name: string
  verification_code: string
  status: string
  candidate: { full_name: string }
  badge: {
    name: string
    description: string | null
    issuer_name: string
    image_url: string | null
    issued_date: string | null
    expires_date?: string | null
    badge_uuid: string
    credential_url: string
    verify_count: number
    share_count: number
  }
}

// ═══════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════

export const badgeService = {
  // ── Templates CRUD ──

  getTemplates: async (page = 1, perPage = 20, search = '', activeOnly = false) => {
    const resp = await api.get<{
      templates: BadgeTemplate[]
      total: number
      page: number
      pages: number
    }>('/badges/templates', {
      params: { page, per_page: perPage, search: search || undefined, active_only: activeOnly || undefined },
    })
    return resp.data
  },

  getTemplate: async (id: number) => {
    const resp = await api.get<{ template: BadgeTemplate }>(`/badges/templates/${id}`)
    return resp.data.template
  },

  createTemplate: async (data: Partial<BadgeTemplate>) => {
    const resp = await api.post<{ message: string; template: BadgeTemplate }>('/badges/templates', data)
    return resp.data
  },

  updateTemplate: async (id: number, data: Partial<BadgeTemplate>) => {
    const resp = await api.put<{ message: string; template: BadgeTemplate }>(`/badges/templates/${id}`, data)
    return resp.data
  },

  deleteTemplate: async (id: number) => {
    const resp = await api.delete<{ message: string }>(`/badges/templates/${id}`)
    return resp.data
  },

  uploadTemplateImage: async (id: number, file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    const resp = await api.post<{ message: string; image_url: string }>(
      `/badges/templates/${id}/image`,
      formData,
    )
    return resp.data
  },

  // ── Issue ──

  issueBadge: async (resultId: string) => {
    const resp = await api.post<{ message: string; badge: IssuedBadge }>('/badges/issue', {
      result_id: resultId,
    })
    return resp.data
  },

  issueBadgeBatch: async (resultIds: string[]) => {
    const resp = await api.post<{ message: string; badges: IssuedBadge[]; total_issued: number }>(
      '/badges/issue-batch',
      { result_ids: resultIds },
    )
    return resp.data
  },

  // ── My badges ──

  getMyBadges: async () => {
    const resp = await api.get<{ badges: IssuedBadge[]; total: number }>('/badges/my-badges')
    return resp.data
  },

  getUserBadges: async (userId: string) => {
    const resp = await api.get<{ badges: IssuedBadge[]; total: number }>(`/badges/user/${userId}`)
    return resp.data
  },

  // ── Group badges ──

  getGroupBadges: async (groupId: number) => {
    const resp = await api.get<{ badges: IssuedBadge[]; total: number }>(`/badges/group/${groupId}`)
    return resp.data
  },

  // ── Public / verify ──

  verifyBadge: async (code: string) => {
    const resp = await api.get<BadgeVerification>(`/badges/verify/${code}`)
    return resp.data
  },

  // ── Actions ──

  trackShare: async (badgeId: number) => {
    const resp = await api.post<{ share_count: number }>(`/badges/${badgeId}/share`)
    return resp.data
  },

  claimBadge: async (badgeId: number) => {
    const resp = await api.post<{ message: string; claimed_at: string }>(`/badges/${badgeId}/claim`)
    return resp.data
  },

  revokeBadge: async (badgeId: number, reason?: string) => {
    const resp = await api.post<{ message: string; badge: IssuedBadge }>(`/badges/${badgeId}/revoke`, {
      reason,
    })
    return resp.data
  },

  getLinkedInUrl: async (badgeId: number) => {
    const resp = await api.get<{ linkedin_url: string }>(`/badges/${badgeId}/linkedin-url`)
    return resp.data.linkedin_url
  },
}

export default badgeService
