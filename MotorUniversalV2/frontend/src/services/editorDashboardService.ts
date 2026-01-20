import api from './api'

// Interfaces para el dashboard del editor
export interface EditorSummary {
  standards: {
    total: number
    active: number
  }
  exams: {
    total: number
    published: number
    draft: number
  }
  materials: {
    total: number
    published: number
    draft: number
  }
  questions: {
    total: number
    by_type: Record<string, number>
  }
}

export interface RecentStandard {
  id: number
  code: string
  name: string
  sector: string | null
  level: number | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface RecentExam {
  id: number
  name: string
  version: string
  is_published: boolean
  passing_score: number
  duration_minutes: number
  total_categories: number
  created_at: string | null
  updated_at: string | null
  competency_standard: {
    id: number
    code: string
    name: string
  } | null
}

export interface RecentMaterial {
  id: number
  title: string
  description: string | null
  image_url: string | null
  is_published: boolean
  sessions_count: number
  topics_count: number
  estimated_time_minutes: number | null
  created_at: string | null
  updated_at: string | null
}

export interface EditorDashboardData {
  user: {
    id: string
    name: string
    full_name: string
    email: string
    role: string
  }
  summary: EditorSummary
  recent_standards: RecentStandard[]
  recent_exams: RecentExam[]
  recent_materials: RecentMaterial[]
}

export const editorDashboardService = {
  getDashboard: async (): Promise<EditorDashboardData> => {
    const response = await api.get<EditorDashboardData>('/users/me/editor-dashboard')
    return response.data
  },
}

export default editorDashboardService
