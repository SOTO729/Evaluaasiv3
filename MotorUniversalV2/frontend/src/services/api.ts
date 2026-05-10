import axios, { AxiosError } from 'axios'
import { useAuthStore } from '../store/authStore'

// Usar la URL del backend de Azure Container Apps en producción
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api' 
    : '/api')

// Debug: Log de la URL del API
console.log('🔧 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_URL: API_URL,
  MODE: import.meta.env.MODE
})

// Crear instancia de axios
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30s — protege contra red colgada/cold-start congelado
  headers: {
    'Content-Type': 'application/json',
  },
})

// Configuración de retry para errores transitorios (cold-start de Container Apps,
// 502/503/504 ocasionales). No reintentamos 4xx ni 401 (este último ya tiene su flujo).
const RETRYABLE_STATUS = new Set([502, 503, 504, 408])
const RETRYABLE_METHODS = new Set(['get', 'head', 'options'])
const MAX_TRANSIENT_RETRIES = 3
const RETRY_DELAYS_MS = [200, 600, 1200]

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState()
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    
    // Si es FormData, eliminar Content-Type para que axios lo configure automáticamente
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores y refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    // Retry para errores transitorios (502/503/504/408) en métodos idempotentes.
    // Esto cubre cold-starts de Azure Container Apps sin afectar mutaciones.
    const status = error.response?.status
    const method = (originalRequest?.method || 'get').toLowerCase()
    if (
      status &&
      RETRYABLE_STATUS.has(status) &&
      RETRYABLE_METHODS.has(method) &&
      originalRequest
    ) {
      originalRequest._transientRetryCount = (originalRequest._transientRetryCount || 0) + 1
      if (originalRequest._transientRetryCount <= MAX_TRANSIENT_RETRIES) {
        const delay = RETRY_DELAYS_MS[originalRequest._transientRetryCount - 1] || 1500
        await new Promise((resolve) => setTimeout(resolve, delay))
        return api(originalRequest)
      }
    }

    // Si el error es 401 y no hemos intentado refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const { refreshToken, logout } = useAuthStore.getState()
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
          })
          
          const { access_token } = response.data
          
          // Actualizar token en el store
          useAuthStore.setState({ accessToken: access_token })
          
          // Refrescar datos del usuario (permisos pueden haber cambiado)
          try {
            const meResponse = await axios.get(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${access_token}` },
            })
            if (meResponse.data) {
              useAuthStore.setState({ user: meResponse.data })
            }
          } catch {
            // Si falla el /me, continuar con los datos actuales
          }
          
          // Reintentar la petición original
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          // Si falla el refresh, logout
          logout()
          window.location.href = '/login'
        }
      } else {
        logout()
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
