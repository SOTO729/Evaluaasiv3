import api from './api'
import type { AuthResponse, LoginCredentials, RegisterData, User } from '../types'

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials)
    return response.data
  },

  register: async (data: RegisterData): Promise<{ message: string; user: User }> => {
    const response = await api.post<{ message: string; user: User }>('/auth/register', data)
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return response.data
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email })
    return response.data
  },

  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/reset-password', {
      token,
      new_password: newPassword,
    })
    return response.data
  },

  sendContactForm: async (data: { name: string; email: string; subject: string; message: string }): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/contact', data)
    return response.data
  },
}
