import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface ProtectedRouteProps {
  allowedRoles?: string[];
  excludedRoles?: string[];
}

const ProtectedRoute = ({ allowedRoles, excludedRoles }: ProtectedRouteProps = {}) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
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
