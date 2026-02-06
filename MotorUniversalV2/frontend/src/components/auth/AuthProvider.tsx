import { useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import LoadingSpinner from '../LoadingSpinner'

interface AuthProviderProps {
  children: ReactNode
}

/**
 * AuthProvider - Componente de seguridad que verifica la validez del token al iniciar
 * 
 * Este componente resuelve la vulnerabilidad donde un atacante podría manipular
 * el localStorage para establecer isAuthenticated=true sin un token válido.
 * 
 * Funcionalidad:
 * 1. Al cargar la app, verifica el token con el backend
 * 2. Si el token es inválido/expirado, fuerza logout
 * 3. Verifica periódicamente que el token sigue siendo válido
 */
export default function AuthProvider({ children }: AuthProviderProps) {
  const { isAuthenticated, accessToken, logout, updateUser } = useAuthStore()
  const [isVerifying, setIsVerifying] = useState(true)
  const [verificationAttempted, setVerificationAttempted] = useState(false)

  const verifyToken = useCallback(async () => {
    // Si no hay token o no está autenticado, no hay nada que verificar
    if (!isAuthenticated || !accessToken) {
      setIsVerifying(false)
      setVerificationAttempted(true)
      return
    }

    try {
      console.log('🔐 Verificando validez del token...')
      
      // Llamar al endpoint /me para verificar que el token es válido
      const response = await api.get('/auth/me')
      
      if (response.status === 200 && response.data) {
        console.log('✅ Token válido, usuario:', response.data.email)
        // Actualizar datos del usuario por si han cambiado
        updateUser(response.data)
      }
    } catch (error: any) {
      console.error('❌ Token inválido o expirado:', error.response?.status)
      
      // Si el error es 401 (no autorizado) o 422 (token inválido), forzar logout
      if (error.response?.status === 401 || error.response?.status === 422) {
        console.log('🚪 Forzando logout por token inválido')
        logout()
      }
    } finally {
      setIsVerifying(false)
      setVerificationAttempted(true)
    }
  }, [isAuthenticated, accessToken, logout, updateUser])

  // Verificar token al montar el componente
  useEffect(() => {
    verifyToken()
  }, []) // Solo al montar, no incluir verifyToken en deps para evitar bucles

  // Verificación periódica del token (cada 5 minutos)
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return

    const intervalId = setInterval(() => {
      console.log('🔄 Verificación periódica del token...')
      verifyToken()
    }, 5 * 60 * 1000) // 5 minutos

    return () => clearInterval(intervalId)
  }, [isAuthenticated, accessToken, verifyToken])

  // Verificar al volver a enfocar la ventana (por si el usuario vuelve después de tiempo)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && verificationAttempted) {
        console.log('👁️ Ventana visible, reverificando token...')
        verifyToken()
      }
    }

    const handleFocus = () => {
      if (isAuthenticated && verificationAttempted) {
        console.log('🎯 Ventana enfocada, reverificando token...')
        verifyToken()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated, verificationAttempted, verifyToken])

  // Mostrar loading solo la primera vez mientras se verifica
  if (isVerifying && !verificationAttempted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner message="Verificando sesión..." />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
