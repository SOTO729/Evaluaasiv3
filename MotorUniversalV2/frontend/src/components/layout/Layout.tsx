import { useState, useRef, useEffect, ReactNode } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import ExamInProgressWidget from '../ExamInProgressWidget'

interface LayoutProps {
  children?: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown y menú móvil al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Determinar si es una página de contenido completo (sin padding)
  const isFullContentPage = location.pathname.includes('/preview')

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

  // Función para obtener las iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Función para obtener el color del rol
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'editor':
        return 'bg-blue-100 text-blue-800'
      case 'candidato':
        return 'bg-green-100 text-green-800'
      case 'coordinator':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Función para obtener el nombre del rol en español
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'editor':
        return 'Editor'
      case 'candidato':
        return 'Candidato'
      case 'coordinator':
        return 'Coordinador'
      default:
        return role
    }
  }

  return (
    <div className={isFullContentPage ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen bg-gray-50'}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40 flex-shrink-0">
        <div className="max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[3200px] 5xl:max-w-[3600px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 3xl:px-20 4xl:px-24">
          <div className="flex justify-between items-center h-12 xs:h-14 sm:h-16 lg:h-18 xl:h-20 3xl:h-22 4xl:h-24">
            <div className="flex items-center">
              {/* Botón hamburguesa para móvil */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-1.5 xs:p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 mr-1.5 xs:mr-2"
                aria-label="Abrir menú"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-5 h-5 xs:w-6 xs:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 xs:w-6 xs:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              
              <Link to="/dashboard" className="flex items-center">
                <img src="/logo.png" alt="Evaluaasi" className="h-7 xs:h-8 sm:h-10 lg:h-12 xl:h-14 2xl:h-16 3xl:h-18 4xl:h-20 w-auto" />
              </Link>
              
              {/* Navegación desktop */}
              <nav className="hidden lg:flex ml-6 xl:ml-8 2xl:ml-12 3xl:ml-16 4xl:ml-20 space-x-3 xl:space-x-4 2xl:space-x-6 3xl:space-x-8 4xl:space-x-10">
                <Link 
                  to="/dashboard" 
                  className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                    location.pathname === '/dashboard' 
                      ? 'text-primary-600 font-semibold bg-primary-50' 
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  Inicio
                </Link>
                {user?.role !== 'editor' && user?.role !== 'coordinator' && (
                  <Link 
                    to="/certificates" 
                    className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                      location.pathname.startsWith('/certificates') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Certificados
                  </Link>
                )}
                {user?.role !== 'coordinator' && (
                  <Link 
                    to="/exams" 
                    className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                      location.pathname.startsWith('/exams') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Exámenes
                  </Link>
                )}
                {user?.role !== 'coordinator' && (
                  <Link 
                    to="/study-contents" 
                  className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                    location.pathname.startsWith('/study-contents') 
                      ? 'text-primary-600 font-semibold bg-primary-50' 
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                  >
                    Materiales
                  </Link>
                )}
                {user?.role !== 'candidato' && user?.role !== 'coordinator' && (
                  <Link 
                    to="/standards" 
                    className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                      location.pathname.startsWith('/standards') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    ECM
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'coordinator') && (
                  <Link 
                    to="/partners/dashboard" 
                    className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                      location.pathname.startsWith('/partners') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Partners
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'coordinator') && (
                  <Link 
                    to="/user-management" 
                    className={`px-2.5 py-1.5 xl:px-3 xl:py-2 2xl:px-4 2xl:py-2.5 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5 rounded-lg text-sm xl:text-base 2xl:text-lg 3xl:text-xl 4xl:text-2xl transition-all ${
                      location.pathname.startsWith('/user-management') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Usuarios
                  </Link>
                )}
              </nav>
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-1.5 xs:space-x-2 xl:space-x-3 3xl:space-x-4 px-1.5 xs:px-2 sm:px-3 xl:px-4 3xl:px-5 py-1 xs:py-1.5 sm:py-2 xl:py-2.5 3xl:py-3 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {/* Avatar con iniciales */}
                <div className="w-7 h-7 xs:w-8 xs:h-8 xl:w-10 xl:h-10 3xl:w-12 3xl:h-12 4xl:w-14 4xl:h-14 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs xs:text-sm xl:text-base 3xl:text-lg 4xl:text-xl font-medium">
                  {user?.full_name ? getInitials(user.full_name) : 'U'}
                </div>
                <span className="text-xs xs:text-sm xl:text-base 3xl:text-lg 4xl:text-xl font-medium text-gray-700 hidden sm:block max-w-[100px] xs:max-w-[120px] xl:max-w-[180px] 3xl:max-w-[220px] truncate">
                  {user?.full_name}
                </span>
                {/* Flecha */}
                <svg 
                  className={`w-3.5 h-3.5 xs:w-4 xs:h-4 xl:w-5 xl:h-5 3xl:w-6 3xl:h-6 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 xs:w-72 xl:w-80 3xl:w-96 4xl:w-[28rem] bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                  {/* Header con info del usuario */}
                  <div className="px-3 py-2.5 xs:px-4 xs:py-3 xl:px-5 xl:py-4 3xl:px-6 3xl:py-5 border-b border-gray-100">
                    <div className="flex items-center space-x-2.5 xs:space-x-3 xl:space-x-4 3xl:space-x-5">
                      <div className="w-10 h-10 xs:w-12 xs:h-12 xl:w-14 xl:h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full bg-primary-600 text-white flex items-center justify-center text-base xs:text-lg xl:text-xl 3xl:text-2xl 4xl:text-3xl font-medium">
                        {user?.full_name ? getInitials(user.full_name) : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs xs:text-sm xl:text-base 3xl:text-lg 4xl:text-xl font-semibold text-gray-900 truncate">
                          {user?.full_name}
                        </p>
                        <p className="text-2xs xs:text-xs xl:text-sm 3xl:text-base 4xl:text-lg text-gray-500 truncate">
                          {user?.email}
                        </p>
                        <span className={`inline-block mt-1 px-1.5 xs:px-2 xl:px-2.5 3xl:px-3 py-0.5 xl:py-1 3xl:py-1.5 text-2xs xs:text-xs xl:text-sm 3xl:text-base font-medium rounded-full ${getRoleBadgeColor(user?.role || '')}`}>
                          {getRoleDisplayName(user?.role || '')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Opciones del menú */}
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="w-full flex items-center px-3 xs:px-4 xl:px-5 3xl:px-6 py-2 xs:py-2.5 xl:py-3 3xl:py-4 text-xs xs:text-sm xl:text-base 3xl:text-lg 4xl:text-xl text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4 xs:w-5 xs:h-5 xl:w-6 xl:h-6 3xl:w-7 3xl:h-7 mr-2.5 xs:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Mi Perfil
                    </Link>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center px-3 xs:px-4 xl:px-5 3xl:px-6 py-2 xs:py-2.5 xl:py-3 3xl:py-4 text-xs xs:text-sm xl:text-base 3xl:text-lg 4xl:text-xl text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4 xs:w-5 xs:h-5 xl:w-6 xl:h-6 3xl:w-7 3xl:h-7 mr-2.5 xs:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Menú móvil desplegable */}
        {isMobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="lg:hidden border-t border-gray-200 bg-white shadow-lg"
          >
            <nav className="px-4 py-3 space-y-1">
              <Link 
                to="/dashboard" 
                className={`block px-3 py-3 rounded-lg transition-all ${
                  location.pathname === '/dashboard' 
                    ? 'bg-primary-50 text-primary-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Inicio
                </div>
              </Link>
              {user?.role !== 'editor' && user?.role !== 'coordinator' && (
                <Link 
                  to="/certificates" 
                  className={`block px-3 py-3 rounded-lg transition-all ${
                    location.pathname.startsWith('/certificates') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Certificados
                  </div>
                </Link>
              )}
              {user?.role !== 'coordinator' && (
                <Link 
                  to="/exams" 
                  className={`block px-3 py-3 rounded-lg transition-all ${
                    location.pathname.startsWith('/exams') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Exámenes
                  </div>
                </Link>
              )}
              {user?.role !== 'coordinator' && (
                <Link 
                  to="/study-contents" 
                  className={`block px-3 py-3 rounded-lg transition-all ${
                    location.pathname.startsWith('/study-contents') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Materiales de Estudio
                  </div>
                </Link>
              )}
              {user?.role !== 'candidato' && user?.role !== 'coordinator' && (
                <Link 
                  to="/standards" 
                  className={`block px-3 py-3 rounded-lg transition-all ${
                    location.pathname.startsWith('/standards') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Estándares (ECM)
                  </div>
                </Link>
              )}
              {(user?.role === 'admin' || user?.role === 'coordinator') && (
                <Link 
                  to="/partners/dashboard" 
                  className={`block px-3 py-3 rounded-lg transition-all ${
                    location.pathname.startsWith('/partners') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Partners
                  </div>
                </Link>
              )}
              {(user?.role === 'admin' || user?.role === 'coordinator') && (
                <Link 
                  to="/user-management" 
                  className={`block px-3 py-3 rounded-lg transition-all ${
                    location.pathname.startsWith('/user-management') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Usuarios
                  </div>
                </Link>
              )}
              
              {/* Separador */}
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* Cerrar sesión en menú móvil */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar Sesión
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Widget de examen en curso - solo mostrar si no estamos en una página de examen */}
      {!location.pathname.includes('/run') && !location.pathname.includes('/results') && (
        <ExamInProgressWidget />
      )}

      {/* Main Content */}
      <main className={isFullContentPage ? 'flex-1 overflow-hidden' : 'max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] 3xl:max-w-[1920px] 4xl:max-w-[2400px] 5xl:max-w-[3200px] mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 3xl:px-20 4xl:px-24 py-3 xs:py-4 sm:py-6 lg:py-8 3xl:py-10 4xl:py-12'}>
        {children || <Outlet />}
      </main>
    </div>
  )
}

export default Layout
