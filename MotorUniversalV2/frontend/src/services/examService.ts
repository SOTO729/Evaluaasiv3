import api from './api'
import type { Exam, Category, Topic, Question, PaginatedResponse } from '../types'

export const examService = {
  // Exams
  getExams: async (page = 1, perPage = 20): Promise<PaginatedResponse<Exam>> => {
    const response = await api.get<PaginatedResponse<Exam>>('/exams', {
      params: { page, per_page: perPage },
    })
    return response.data
  },

  getExam: async (id: number, includeDetails = false): Promise<Exam> => {
    const response = await api.get<Exam>(`/exams/${id}`, {
      params: { include_details: includeDetails },
    })
    return response.data
  },

  createExam: async (data: Partial<Exam>): Promise<{ message: string; exam: Exam }> => {
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

  // Categories
  getCategories: async (examId: number): Promise<{ categories: Category[] }> => {
    const response = await api.get<{ categories: Category[] }>(`/exams/${examId}/categories`)
    return response.data
  },

  createCategory: async (examId: number, data: Partial<Category>): Promise<{ message: string; category: Category }> => {
    const response = await api.post<{ message: string; category: Category }>(`/exams/${examId}/categories`, data)
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

  // Questions
  getQuestions: async (topicId: number): Promise<{ questions: Question[] }> => {
    const response = await api.get<{ questions: Question[] }>(`/exams/topics/${topicId}/questions`)
    return response.data
  },

  createQuestion: async (topicId: number, data: Partial<Question>): Promise<{ message: string; question: Question }> => {
    const response = await api.post<{ message: string; question: Question }>(`/exams/topics/${topicId}/questions`, data)
    return response.data
  },
}
