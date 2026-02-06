import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface ProtectedRouteProps {
  allowedRoles?: string[];
  excludedRoles?: string[];
}

const ProtectedRoute = ({ allowedRoles, excludedRoles }: ProtectedRouteProps = {}) => {
  const { isAuthenticated, user, accessToken } = useAuthStore()

  // Verificación de seguridad: debe tener isAuthenticated Y un token válido
  // Esto previene la manipulación de localStorage donde un atacante
  // podría establecer isAuthenticated=true sin un token real
  if (!isAuthenticated || !accessToken) {
    console.log('🚫 Acceso denegado: No autenticado o sin token')
    return <Navigate to="/login" replace />
  }

  // Verificar que el token tenga un formato válido (JWT básico)
  // Un JWT tiene 3 partes separadas por puntos: header.payload.signature
  const tokenParts = accessToken.split('.')
  if (tokenParts.length !== 3) {
    console.log('🚫 Acceso denegado: Formato de token inválido')
    return <Navigate to="/login" replace />
  }

  // Si hay roles excluidos y el usuario tiene uno de esos roles, redirigir
  if (excludedRoles && user?.role && excludedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  // Si hay roles permitidos y el usuario no tiene uno de esos roles, redirigir
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
