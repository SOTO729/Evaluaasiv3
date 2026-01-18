import api from './api'
import type { Exam, Category, Topic, Question, PaginatedResponse, QuestionType } from '../types'

export const examService = {
  // Exams
  getExams: async (page = 1, perPage = 20, search = '', publishedOnly = false): Promise<PaginatedResponse<Exam>> => {
    const response = await api.get<PaginatedResponse<Exam>>('/exams', {
      params: { 
        page, 
        per_page: perPage, 
        search: search || undefined,
        published_only: publishedOnly || undefined
      },
    })
    return response.data
  },

  getExam: async (id: number, includeDetails = false): Promise<Exam> => {
    const response = await api.get<Exam>(`/exams/${id}`, {
      params: { include_details: includeDetails },
    })
    return response.data
  },

  createExam: async (data: Partial<Exam> | any): Promise<{ message: string; exam: Exam }> => {
    const response = await api.post<{ message: string; exam: Exam }>('/exams', data)
    return response.data
  },

  updateExam: async (id: number, data: Partial<Exam>): Promise<{ message: string; exam: Exam }> => {
    const response = await api.put<{ message: string; exam: Exam }>(`/exams/${id}`, data)
    return response.data
  },

  deleteExam: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/${id}`)
    return response.data
  },

  cloneExam: async (id: number, data?: { name?: string; version?: string; competency_standard_id?: number }): Promise<{ message: string; exam: Exam }> => {
    const response = await api.post<{ message: string; exam: Exam }>(`/exams/${id}/clone`, data || {})
    return response.data
  },

  // Categories
  getCategories: async (examId: number): Promise<{ categories: Category[] }> => {
    const response = await api.get<{ categories: Category[] }>(`/exams/${examId}/categories`)
    return response.data
  },

  createCategory: async (examId: number, data: Partial<Category>): Promise<{ message: string; category: Category }> => {
    const response = await api.post<{ message: string; category: Category }>(`/exams/${examId}/categories`, data)
    return response.data
  },

  deleteCategory: async (examId: number, categoryId: number): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/${examId}/categories/${categoryId}`)
    return response.data
  },

  updateCategory: async (examId: number, categoryId: number, data: Partial<Category>): Promise<{ message: string; category: Category }> => {
    const response = await api.put<{ message: string; category: Category }>(`/exams/${examId}/categories/${categoryId}`, data)
    return response.data
  },

  // Topics
  getTopics: async (categoryId: number): Promise<{ topics: Topic[] }> => {
    const response = await api.get<{ topics: Topic[] }>(`/exams/categories/${categoryId}/topics`)
    return response.data
  },

  createTopic: async (categoryId: number, data: Partial<Topic>): Promise<{ message: string; topic: Topic }> => {
    const response = await api.post<{ message: string; topic: Topic }>(`/exams/categories/${categoryId}/topics`, data)
    return response.data
  },

  updateTopic: async (topicId: number, data: Partial<Topic>): Promise<{ message: string; topic: Topic }> => {
    const response = await api.put<{ message: string; topic: Topic }>(`/exams/topics/${topicId}`, data)
    return response.data
  },

  deleteTopic: async (topicId: number): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/topics/${topicId}`)
    return response.data
  },

  // Questions
  getQuestionTypes: async (): Promise<{ question_types: QuestionType[] }> => {
    const response = await api.get<{ question_types: QuestionType[] }>('/exams/question-types')
    return response.data
  },

  getQuestions: async (topicId: number): Promise<{ questions: Question[] }> => {
    const response = await api.get<{ questions: Question[] }>(`/exams/topics/${topicId}/questions`)
    return response.data
  },

  createQuestion: async (topicId: number, data: Partial<Question>): Promise<{ message: string; question: Question }> => {
    const response = await api.post<{ message: string; question: Question }>(`/exams/topics/${topicId}/questions`, data)
    return response.data
  },

  updateQuestion: async (id: string, data: Partial<Question>): Promise<{ message: string; question: Question }> => {
    const response = await api.put<{ message: string; question: Question }>(`/exams/questions/${id}`, data)
    return response.data
  },

  deleteQuestion: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/questions/${id}`)
    return response.data
  },

  // Answers
  getAnswers: async (questionId: string): Promise<{ answers: any[] }> => {
    const response = await api.get<{ answers: any[] }>(`/exams/questions/${questionId}/answers`)
    return response.data
  },

  createAnswer: async (questionId: string, data: { answer_text: string; is_correct: boolean }): Promise<{ message: string; answer: any }> => {
    const response = await api.post<{ message: string; answer: any }>(`/exams/questions/${questionId}/answers`, data)
    return response.data
  },

  updateAnswer: async (answerId: string, data: { answer_text?: string; is_correct?: boolean }): Promise<{ message: string; answer: any }> => {
    const response = await api.put<{ message: string; answer: any }>(`/exams/answers/${answerId}`, data)
    return response.data
  },

  deleteAnswer: async (answerId: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/answers/${answerId}`)
    return response.data
  },

  // Exercises
  getExercises: async (topicId: number): Promise<{ exercises: any[] }> => {
    const response = await api.get<{ exercises: any[] }>(`/exams/topics/${topicId}/exercises`)
    return response.data
  },

  getExerciseDetails: async (exerciseId: string): Promise<{ exercise: any }> => {
    const response = await api.get<{ exercise: any }>(`/exams/exercises/${exerciseId}/details`)
    return response.data
  },

  createExercise: async (topicId: number, data: { exercise_text: string; is_complete?: boolean }): Promise<{ message: string; exercise: any }> => {
    const response = await api.post<{ message: string; exercise: any }>(`/exams/topics/${topicId}/exercises`, data)
    return response.data
  },

  updateExercise: async (id: string, data: { exercise_text?: string; is_complete?: boolean; type?: 'exam' | 'simulator' }): Promise<{ message: string; exercise: any }> => {
    const response = await api.put<{ message: string; exercise: any }>(`/exams/exercises/${id}`, data)
    return response.data
  },

  deleteExercise: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/exercises/${id}`)
    return response.data
  },

  // Exercise Steps
  getExerciseSteps: async (exerciseId: string): Promise<{ steps: any[] }> => {
    const response = await api.get<{ steps: any[] }>(`/exams/exercises/${exerciseId}/steps`)
    return response.data
  },

  createExerciseStep: async (exerciseId: string, data: { title?: string; description?: string; image_url?: string; image_width?: number; image_height?: number }): Promise<{ message: string; step: any }> => {
    const response = await api.post<{ message: string; step: any }>(`/exams/exercises/${exerciseId}/steps`, data)
    return response.data
  },

  updateExerciseStep: async (stepId: string, data: { title?: string; description?: string; image_url?: string; image_width?: number; image_height?: number; step_number?: number }): Promise<{ message: string; step: any }> => {
    const response = await api.put<{ message: string; step: any }>(`/exams/steps/${stepId}`, data)
    return response.data
  },

  deleteExerciseStep: async (stepId: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/steps/${stepId}`)
    return response.data
  },

  uploadStepImage: async (stepId: string, imageData: string, width?: number, height?: number): Promise<{ message: string; step: any }> => {
    const response = await api.post<{ message: string; step: any }>(`/exams/steps/${stepId}/upload-image`, {
      image_data: imageData,
      image_width: width,
      image_height: height
    })
    return response.data
  },

  // Exercise Actions
  getStepActions: async (stepId: string): Promise<{ actions: any[] }> => {
    const response = await api.get<{ actions: any[] }>(`/exams/steps/${stepId}/actions`)
    return response.data
  },

  createStepAction: async (stepId: string, data: {
    action_type: 'button' | 'textbox'
    position_x: number
    position_y: number
    width: number
    height: number
    label?: string
    placeholder?: string
    correct_answer?: string
    is_case_sensitive?: boolean
  }): Promise<{ message: string; action: any }> => {
    const response = await api.post<{ message: string; action: any }>(`/exams/steps/${stepId}/actions`, data)
    return response.data
  },

  updateStepAction: async (actionId: string, data: {
    action_type?: 'button' | 'textbox'
    position_x?: number
    position_y?: number
    width?: number
    height?: number
    label?: string
    placeholder?: string
    correct_answer?: string
    is_case_sensitive?: boolean
    action_number?: number
  }): Promise<{ message: string; action: any }> => {
    const response = await api.put<{ message: string; action: any }>(`/exams/actions/${actionId}`, data)
    return response.data
  },

  deleteStepAction: async (actionId: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/exams/actions/${actionId}`)
    return response.data
  },

  // Validación y Publicación
  validateExam: async (examId: number): Promise<{
    is_valid: boolean
    errors: Array<{ type: string; message: string; details: string }>
    warnings: Array<{ type: string; message: string; details: string }>
    summary: {
      total_categories: number
      total_topics: number
      total_questions: number
      total_exercises: number
    }
  }> => {
    const response = await api.get(`/exams/${examId}/validate`)
    return response.data
  },

  checkEcmConflict: async (examId: number): Promise<{
    has_conflict: boolean;
    message: string;
    current_exam?: {
      id: number;
      name: string;
      version: string;
      ecm_code: string | null;
    };
    conflicting_exam?: {
      id: number;
      name: string;
      version: string;
      is_published: boolean;
    };
  }> => {
    const response = await api.get(`/exams/${examId}/check-ecm-conflict`)
    return response.data
  },

  publishExam: async (examId: number): Promise<{ message: string; exam: Exam }> => {
    const response = await api.post<{ message: string; exam: Exam }>(`/exams/${examId}/publish`)
    return response.data
  },

  unpublishExam: async (examId: number): Promise<{ message: string; exam: Exam }> => {
    const response = await api.post<{ message: string; exam: Exam }>(`/exams/${examId}/unpublish`)
    return response.data
  },

  // Evaluación de examen
  evaluateExam: async (examId: number, data: {
    answers: Record<string, any>;
    exerciseResponses: Record<string, Record<string, any>>;
    items: any[];
  }): Promise<{
    results: {
      questions: Array<{
        question_id: string;
        question_type: string;
        question_text: string;
        user_answer: any;
        is_correct: boolean;
        score: number;
        correct_answer: any;
        correct_answer_text?: string;
        correct_answers_text?: string[];
        explanation?: string;
        answers: any[];
      }>;
      exercises: Array<{
        exercise_id: string;
        title: string;
        is_correct: boolean;
        total_score: number;
        max_score: number;
        steps: Array<{
          step_id: string;
          step_number: number;
          title: string;
          is_correct: boolean;
          actions: Array<{
            action_id: string;
            action_number: number;
            action_type: string;
            user_response: any;
            is_correct: boolean;
            score: number;
            correct_answer: string;
            similarity?: number;
            explanation?: string;
          }>;
        }>;
      }>;
      summary: {
        total_items: number;
        total_questions: number;
        total_exercises: number;
        correct_questions: number;
        correct_exercises: number;
        question_score: number;
        exercise_score: number;
        max_exercise_score: number;
        total_points: number;
        earned_points: number;
        percentage: number;
      };
    };
  }> => {
    const response = await api.post(`/exams/${examId}/evaluate`, data)
    return response.data
  },

  // Guardar resultado del examen
  saveExamResult: async (examId: number, data: {
    score: number;
    percentage: number;
    status?: number;
    duration_seconds?: number;
    answers_data?: any;
    questions_order?: string[];
  }): Promise<{
    message: string;
    result: {
      id: string;
      exam_id: number;
      score: number;
      status: number;
      result: number;
      start_date: string;
      end_date: string;
      duration_seconds?: number;
      certificate_code?: string;
      certificate_url?: string;
    };
    is_approved: boolean;
  }> => {
    const response = await api.post(`/exams/${examId}/save-result`, data)
    return response.data
  },

  // Obtener resultados del usuario para un examen
  getMyExamResults: async (examId: number): Promise<{
    results: Array<{
      id: string;
      exam_id: number;
      score: number;
      status: number;
      result: number;
      start_date: string;
      end_date: string;
      duration_seconds?: number;
      certificate_code?: string;
      certificate_url?: string;
      report_url?: string;
      answers_data?: any;
      questions_order?: any;
    }>;
    count: number;
  }> => {
    const response = await api.get(`/exams/${examId}/my-results`)
    return response.data
  },

  // Subir reporte PDF de un resultado
  uploadResultReport: async (resultId: string, pdfBlob: Blob): Promise<{
    message: string;
    report_url: string;
  }> => {
    const formData = new FormData()
    formData.append('file', pdfBlob, 'reporte.pdf')
    const response = await api.post(`/exams/results/${resultId}/upload-report`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },
}
