import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'

const Layout = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      logout()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="text-2xl font-bold text-primary-600">
                Evaluaasi
              </Link>
              <nav className="ml-10 flex space-x-8">
                <Link 
                  to="/dashboard" 
                  className={`px-3 py-2 rounded-md transition-all ${
                    location.pathname === '/dashboard' 
                      ? 'text-primary-600 font-medium' 
                      : 'text-gray-900 hover:text-primary-600'
                  } hover:shadow-sm hover:bg-gray-50`}
                >
                  Dashboard
                </Link>
                {user?.role !== 'alumno' && (
                  <Link 
                    to="/exams" 
                    className={`px-3 py-2 rounded-md transition-all ${
                      location.pathname.startsWith('/exams') 
                        ? 'text-primary-600 font-medium' 
                        : 'text-gray-900 hover:text-primary-600'
                    } hover:shadow-sm hover:bg-gray-50`}
                  >
                    Exámenes
                  </Link>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.full_name} ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-secondary text-sm"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
