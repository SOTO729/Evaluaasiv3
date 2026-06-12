import api from './api'
import type { AuthResponse, LoginCredentials, RegisterData, User } from '../types'

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials)
    return response.data
  },

  /**
   * Inicia sesión con Google. Recibe el `code` (authorization code) del flujo
   * popup auth-code de Google Identity Services y lo intercambia en el backend
   * por un par access/refresh JWT.
   */
  googleLogin: async (code: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/google', { code })
    return response.data
  },

  /**
   * Inicia sesión con Microsoft. Recibe el `id_token` (JWT OpenID Connect) del
   * flujo popup MSAL (Entra ID) y lo valida en el backend, que emite un par
   * access/refresh JWT.
   */
  microsoftLogin: async (idToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/microsoft', { id_token: idToken })
    return response.data
  },

  register: async (data: RegisterData): Promise<{ message: string; user: User }> => {
    const response = await api.post<{ message: string; user: User }>('/auth/register', data)
    return response.data
  },

  checkEmail: async (email: string): Promise<{ available: boolean; email: string }> => {
    const response = await api.post<{ available: boolean; email: string }>('/auth/check-email', { email })
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me')
    return response.data
  },

  /**
   * Marca el recorrido de bienvenida (onboarding) del candidato como completado.
   * Se persiste en backend porque el logout limpia localStorage.
   */
  completeOnboarding: async (): Promise<{ onboarding_completed: boolean }> => {
    const response = await api.post<{ onboarding_completed: boolean }>('/auth/complete-onboarding')
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

  verifyEmail: async (token: string): Promise<{ message: string; already_verified?: boolean }> => {
    const response = await api.get<{ message: string; already_verified?: boolean }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
    return response.data
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/auth/resend-verification', { email })
    return response.data
  },

  /**
   * Intercambia un token SSO opaco (emitido por /api/sso/generar_token a la
   * institución) por un par access/refresh JWT. Single-use: el token se marca
   * como consumido en backend tras el primer intercambio exitoso.
   */
  ssoExchange: async (token: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/sso/exchange', { token })
    return response.data
  },
}
