/**
 * Tipos de datos de la aplicación
 */

export interface User {
  id: string
  email: string
  username: string
  name: string
  first_surname: string
  second_surname?: string
  full_name: string
  gender?: string
  role: 'admin' | 'editor' | 'soporte' | 'alumno' | 'auxiliar'
  is_active: boolean
  is_verified: boolean
  created_at: string
  last_login?: string
  curp?: string
  phone?: string
  campus_id?: number
  subsystem_id?: number
}

export interface Exam {
  id: number
  name: string
  version: string
  standard?: string
  stage_id: number
  description?: string
  instructions?: string
  duration_minutes?: number
  passing_score: number
  is_active: boolean
  is_published: boolean
  total_questions: number
  total_exercises: number
  created_at: string
  updated_at?: string
  categories?: Category[]
}

export interface Category {
  id: number
  exam_id: number
  name: string
  description?: string
  percentage: number
  order: number
  total_topics: number
  created_at: string
  topics?: Topic[]
}

export interface Topic {
  id: number
  category_id: number
  name: string
  description?: string
  order: number
  total_questions: number
  total_exercises: number
  created_at: string
  questions?: Question[]
}

export interface QuestionType {
  id: number
  name: string
  description: string
}

export interface Question {
  id: string
  topic_id: number
  question_type: QuestionType
  question_number: number
  question_text: string
  image_url?: string
  points: number
  difficulty: 'easy' | 'medium' | 'hard'
  created_at: string
  answers?: Answer[]
}

export interface Answer {
  id: string
  question_id: string
  answer_number: number
  answer_text: string
  is_correct?: boolean
  explanation?: string
}

export interface AuthResponse {
  message: string
  access_token: string
  refresh_token: string
  user: User
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  email: string
  username: string
  password: string
  name: string
  first_surname: string
  second_surname?: string
  gender?: string
  phone?: string
}

export interface PaginatedResponse<T> {
  items?: T[]
  exams?: T[]
  categories?: T[]
  topics?: T[]
  questions?: T[]
  users?: T[]
  total: number
  pages: number
  current_page: number
  has_next?: boolean
  has_prev?: boolean
}

export interface ApiError {
  error: string
  message: string
}
