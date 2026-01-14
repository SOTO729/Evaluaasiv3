import api from './api'

// Interfaces para el dashboard
export interface ExamUserStats {
  attempts: number
  best_score: number | null
  is_completed: boolean
  is_approved: boolean
  last_attempt: ExamResult | null
}

export interface ExamResult {
  id: string
  exam_id: number
  score: number
  status: number
  result: number
  start_date: string
  end_date: string | null
  duration_seconds: number | null
  certificate_code: string | null
  certificate_url: string | null
}

export interface DashboardExam {
  id: number
  name: string
  description: string
  version: string
  time_limit_minutes: number
  passing_score: number
  is_published: boolean
  categories_count: number
  user_stats: ExamUserStats
}

export interface MaterialProgress {
  total_contents: number
  completed_contents: number
  percentage: number
}

export interface DashboardMaterial {
  id: number
  title: string
  description: string
  image_url: string | null
  sessions_count: number
  progress: MaterialProgress
}

export interface DashboardStats {
  total_exams: number
  completed_exams: number
  approved_exams: number
  average_score: number
}

export interface DashboardUser {
  id: string
  name: string
  first_surname: string
  second_surname: string
  full_name: string
  email: string
  role: string
  document_options: {
    evaluation_report: boolean
    certificate: boolean
    conocer_certificate: boolean
    digital_badge: boolean
  }
}

export interface DashboardData {
  user: DashboardUser
  stats: DashboardStats
  exams: DashboardExam[]
  materials: DashboardMaterial[]
}

export const dashboardService = {
  getDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>('/users/me/dashboard')
    return response.data
  },
}

export default dashboardService
