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
  total_categories: number
  created_at: string
  updated_at?: string
  categories?: Category[]
  image_url?: string
}

export interface Category {
  id: number
  exam_id: number
  name: string
  description?: string
  percentage: number
  order: number
  total_topics: number
  total_questions?: number
  total_exercises?: number
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
  type?: 'exam' | 'simulator'
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

export interface Exercise {
    type?: 'exam' | 'simulator'
  id: string
  topic_id: number
  exercise_number: number
  title?: string
  exercise_text: string
  image_url?: string
  is_complete: boolean
  total_steps: number
  steps?: ExerciseStep[]
  created_at: string
}

export interface ExerciseStep {
  id: string
  exercise_id: string
  step_number: number
  title?: string
  description?: string
  image_url?: string
  image_width?: number
  image_height?: number
  total_actions: number
  actions?: ExerciseAction[]
  created_at: string
  updated_at?: string
}

export interface ExerciseAction {
  id: string
  step_id: string
  action_number: number
  action_type: 'button' | 'textbox'
  position_x: number  // Porcentaje desde la izquierda (0-100)
  position_y: number  // Porcentaje desde arriba (0-100)
  width: number       // Ancho en porcentaje
  height: number      // Alto en porcentaje
  label?: string
  placeholder?: string
  correct_answer?: string
  is_case_sensitive: boolean
  scoring_mode?: 'exact' | 'similarity'
  on_error_action?: 'show_message' | 'next_step' | 'next_exercise'
  error_message?: string
  max_attempts?: number
  text_color?: string
  font_family?: string
  label_style?: 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only'
  created_at: string
  updated_at?: string
}

export interface AuthResponse {
  message: string
  access_token: string
  refresh_token: string
  user: User
}

export interface CreateExamData {
  name: string
  version: string  // Código ECM - exactamente 7 caracteres
  standard?: string  // Nombre del estándar (opcional, por defecto 'ECM')
  stage_id: number
  description?: string
  instructions?: string
  duration_minutes?: number
  passing_score?: number
  image_url?: string  // URL o base64 de la imagen del examen
  categories: CreateCategoryData[]
}

export interface CreateCategoryData {
  name: string
  description?: string
  percentage: number
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
  page?: number
  per_page?: number
  current_page: number
  has_next?: boolean
  has_prev?: boolean
}

export interface ApiError {
  error: string
  message: string
}
