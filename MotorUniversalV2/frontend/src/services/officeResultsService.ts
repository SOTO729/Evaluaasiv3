import { api } from './api'

export interface OfficeExamResultDto {
  id: number
  user_id: string
  vm_session_id: number | null
  group_exam_id: number | null
  office_app: string | null
  level: string | null
  session_type: string | null
  passing_score: number
  score: number | null
  passed: boolean
  total_questions: number | null
  correct_answers: number | null
  voucher_code: string | null
  parcial_session_number: number | null
  assigned_sessions: string | null
  calendario_id: number | null
  app_version: string | null
  status: string
  duration_seconds: number | null
  certificate_code: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
  user?: {
    id: string
    name: string
    email: string
    username: string
  }
}

export interface OfficeResultsListResponse {
  results: OfficeExamResultDto[]
  total: number
  passed: number
  in_progress: number
}

export interface OfficeCertificateVerifyResponse {
  valid: boolean
  certificate_code?: string
  office_app?: string
  level?: string
  session_type?: string
  score?: number
  passing_score?: number
  finished_at?: string
  holder_name?: string
  error?: string
}

export interface OfficeAuditResponse {
  results: OfficeExamResultDto[]
  page: number
  per_page: number
  pages: number
  total: number
  summary: {
    total: number
    passed: number
    in_progress: number
  }
}

export interface OfficeAuditFilters {
  status?: string
  session_type?: string
  office_app?: string
  passed?: 'true' | 'false'
  campus_id?: number
  group_id?: number
  user_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  per_page?: number
}

export const officeResultsService = {
  async listMine(params?: {
    status?: string
    session_type?: string
    office_app?: string
    limit?: number
  }): Promise<OfficeResultsListResponse> {
    const { data } = await api.get('/office-results/me', { params })
    return data
  },

  async getDetail(id: number): Promise<{ result: OfficeExamResultDto }> {
    const { data } = await api.get(`/office-results/${id}`)
    return data
  },

  async verifyCertificate(code: string): Promise<OfficeCertificateVerifyResponse> {
    const { data } = await api.get(`/office-results/verify/${encodeURIComponent(code)}`)
    return data
  },

  async listAudit(filters: OfficeAuditFilters = {}): Promise<OfficeAuditResponse> {
    const params: Record<string, any> = {}
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) params[k] = v
    })
    const { data } = await api.get('/office-results/audit', { params })
    return data
  },

  async exportAuditCsv(filters: OfficeAuditFilters = {}): Promise<Blob> {
    const params: Record<string, any> = {}
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) params[k] = v
    })
    const response = await api.get('/office-results/audit/export.csv', {
      params,
      responseType: 'blob',
    })
    return response.data as Blob
  },
}
