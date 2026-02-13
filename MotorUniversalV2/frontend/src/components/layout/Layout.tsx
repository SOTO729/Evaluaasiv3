import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import { getMiPlantel } from '../../services/partnersService'
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
  
  // Refs y estado para scroll horizontal del navbar
  const navScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkNavScroll = useCallback(() => {
    const el = navScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    checkNavScroll()
    const el = navScrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkNavScroll, { passive: true })
    const ro = new ResizeObserver(checkNavScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkNavScroll)
      ro.disconnect()
    }
  }, [checkNavScroll, location.pathname])

  const scrollNav = (direction: 'left' | 'right') => {
    const el = navScrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  // Obtener información del plantel para usuarios responsables
  const { data: plantelData } = useQuery({
    queryKey: ['mi-plantel'],
    queryFn: getMiPlantel,
    enabled: user?.role === 'responsable',
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  const campusName = plantelData?.campus?.name

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
  const isFullContentPage = location.pathname.includes('/preview') || location.pathname.includes('/assign-candidates')

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
      case 'developer':
        return 'bg-orange-100 text-orange-800'
      case 'editor':
        return 'bg-blue-100 text-blue-800'
      case 'editor_invitado':
        return 'bg-teal-100 text-teal-800'
      case 'candidato':
        return 'bg-green-100 text-green-800'
      case 'coordinator':
        return 'bg-amber-100 text-amber-800'
      case 'responsable':
        return 'bg-purple-100 text-purple-800'
      case 'responsable_partner':
        return 'bg-violet-100 text-violet-800'
      case 'financiero':
        return 'bg-teal-100 text-teal-800'
      case 'gerente':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Función para obtener el nombre del rol en español
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'developer':
        return 'Desarrollador'
      case 'editor':
        return 'Editor'
      case 'editor_invitado':
        return 'Editor Invitado'
      case 'candidato':
        return 'Candidato'
      case 'coordinator':
        return 'Coordinador'
      case 'responsable':
        return 'Responsable'
      case 'responsable_partner':
        return 'Resp. Partner'
      case 'financiero':
        return 'Financiero'
      case 'gerente':
        return 'Gerente'
      default:
        return role
    }
  }

  return (
    <div className={isFullContentPage ? 'h-screen flex flex-col overflow-hidden' : 'min-h-screen bg-gray-50'}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40 flex-shrink-0">
        <div className="w-full fluid-px-4">
          <div className="flex justify-between items-center fluid-header-height">
            <div className="flex items-center">
              {/* Botón hamburguesa para móvil */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fluid-p-2 fluid-rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 fluid-mr-2"
                aria-label="Abrir menú"
              >
                {isMobileMenuOpen ? (
                  <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              
              <Link to="/dashboard" className="flex items-center fluid-gap-2">
                <img src="/logo.png" alt="Evaluaasi" className="h-[clamp(2.25rem,2rem+1.5vw,4.5rem)] w-auto" />
                <span className="hidden sm:block fluid-text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Evaluaasi</span>
              </Link>
              
              {/* Nombre del plantel para responsables */}
              {user?.role === 'responsable' && campusName && (
                <div className="hidden md:flex items-center fluid-ml-4 fluid-pl-4 border-l border-gray-200">
                  <span className="fluid-text-sm font-semibold text-primary-600">{campusName}</span>
                </div>
              )}
              {/* Navegación desktop con scroll horizontal y flechas */}
              <div className="hidden lg:flex items-center flex-1 min-w-0 fluid-ml-6 relative">
                {/* Flecha izquierda */}
                {canScrollLeft && (
                  <button
                    onClick={() => scrollNav('left')}
                    className="absolute left-0 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-all hover:shadow-lg flex-shrink-0"
                    aria-label="Scroll izquierda"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                
                {/* Gradiente izquierdo */}
                {canScrollLeft && (
                  <div className="absolute left-8 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-[5] pointer-events-none" />
                )}

                <nav
                  ref={navScrollRef}
                  className="flex items-center fluid-gap-1 overflow-x-auto scrollbar-hide scroll-smooth flex-nowrap px-10"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                <Link 
                  to="/dashboard" 
                  className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                    location.pathname === '/dashboard' 
                      ? 'text-primary-600 font-semibold bg-primary-50' 
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  Inicio
                </Link>
                {user?.role !== 'editor' && user?.role !== 'editor_invitado' && user?.role !== 'coordinator' && (
                  <Link 
                    to="/certificates" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
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
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
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
                  className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                    location.pathname.startsWith('/study-contents') 
                      ? 'text-primary-600 font-semibold bg-primary-50' 
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                  >
                    Materiales
                  </Link>
                )}
                {['candidato', 'admin', 'developer', 'coordinator', 'responsable', 'responsable_partner'].includes(user?.role ?? '') && (
                  <Link 
                    to="/vm-sessions" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/vm-sessions') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Sesiones
                  </Link>
                )}
                {user?.role !== 'candidato' && user?.role !== 'coordinator' && user?.role !== 'responsable' && user?.role !== 'responsable_partner' && (
                  <Link 
                    to="/standards" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/standards') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    ECM
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                  <Link 
                    to="/partners/dashboard" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/partners') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Partners
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                  <Link 
                    to="/asignaciones-ecm" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/asignaciones-ecm') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Asignaciones
                  </Link>
                )}
                {user?.role === 'responsable' && (
                  <Link 
                    to="/mi-plantel" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname === '/mi-plantel' 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Mi Plantel
                  </Link>
                )}
                {user?.role === 'responsable' && (
                  <Link 
                    to="/mi-plantel/certificados" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/mi-plantel/certificados') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Certificados
                  </Link>
                )}
                {user?.role === 'responsable_partner' && (
                  <Link 
                    to="/mi-partner" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname === '/mi-partner' 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Mi Partner
                  </Link>
                )}
                {user?.role === 'responsable_partner' && (
                  <Link 
                    to="/mi-partner/certificados" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/mi-partner/certificados') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Certificados
                  </Link>
                )}
                {['financiero', 'admin', 'developer'].includes(user?.role ?? '') && (
                  <Link 
                    to="/financiero" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/financiero') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Financiero
                  </Link>
                )}
                {['gerente', 'admin', 'developer'].includes(user?.role ?? '') && (
                  <Link 
                    to="/gerente" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/gerente') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Gerencia
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                  <Link 
                    to="/grupos" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/grupos') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Grupos
                  </Link>
                )}
                {['coordinator', 'admin', 'developer'].includes(user?.role ?? '') && (
                  <Link 
                    to="/mi-saldo" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/mi-saldo') || location.pathname.startsWith('/solicitar-') || location.pathname.startsWith('/historial-')
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Mi Saldo
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                  <Link 
                    to="/user-management" 
                    className={`whitespace-nowrap flex-shrink-0 fluid-px-3 fluid-py-1.5 fluid-rounded-lg fluid-text-sm transition-all ${
                      location.pathname.startsWith('/user-management') 
                        ? 'text-primary-600 font-semibold bg-primary-50' 
                        : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                    }`}
                  >
                    Usuarios
                  </Link>
                )}
              </nav>

                {/* Gradiente derecho */}
                {canScrollRight && (
                  <div className="absolute right-8 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-[5] pointer-events-none" />
                )}

                {/* Flecha derecha */}
                {canScrollRight && (
                  <button
                    onClick={() => scrollNav('right')}
                    className="absolute right-0 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-all hover:shadow-lg flex-shrink-0"
                    aria-label="Scroll derecha"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center fluid-gap-3 fluid-px-4 fluid-py-2 fluid-rounded-xl hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {/* Avatar con iniciales */}
                <div className="w-[clamp(2.25rem,2rem+0.75vw,3.5rem)] h-[clamp(2.25rem,2rem+0.75vw,3.5rem)] rounded-full bg-primary-600 text-white flex items-center justify-center fluid-text-base font-medium">
                  {user?.full_name ? getInitials(user.full_name) : 'U'}
                </div>
                <span className="fluid-text-base font-medium text-gray-700 hidden sm:block max-w-[clamp(6rem,5rem+6vw,16rem)] truncate">
                  {user?.full_name}
                </span>
                {/* Flecha */}
                <svg 
                  className={`fluid-icon-sm text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 fluid-mt-2 w-[clamp(18rem,16rem+10vw,32rem)] bg-white fluid-rounded-2xl shadow-xl border border-gray-200 fluid-py-3 z-50">
                  {/* Header con info del usuario */}
                  <div className="fluid-px-5 fluid-py-4 border-b border-gray-100">
                    <div className="flex items-center fluid-gap-4">
                      <div className="w-[clamp(3rem,2.5rem+1.25vw,6rem)] h-[clamp(3rem,2.5rem+1.25vw,6rem)] rounded-full bg-primary-600 text-white flex items-center justify-center fluid-text-xl font-medium">
                        {user?.full_name ? getInitials(user.full_name) : 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="fluid-text-base font-semibold text-gray-900 truncate">
                          {user?.full_name}
                        </p>
                        <p className="fluid-text-sm text-gray-500 truncate">
                          {user?.email}
                        </p>
                        <span className={`inline-block fluid-mt-2 fluid-px-3 fluid-py-1 fluid-text-sm font-medium rounded-full ${getRoleBadgeColor(user?.role || '')}`}>
                          {getRoleDisplayName(user?.role || '')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Opciones del menú */}
                  <div className="fluid-py-2">
                    <Link
                      to="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="w-full flex items-center fluid-px-5 fluid-py-4 fluid-text-base text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="fluid-icon-lg fluid-mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Mi Perfil
                    </Link>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center fluid-px-5 fluid-py-4 fluid-text-base text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="fluid-icon-lg fluid-mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <nav className="fluid-px-4 fluid-py-3 space-y-1">
              <Link 
                to="/dashboard" 
                className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                  location.pathname === '/dashboard' 
                    ? 'bg-primary-50 text-primary-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Inicio
                </div>
              </Link>
              {user?.role !== 'editor' && user?.role !== 'editor_invitado' && user?.role !== 'coordinator' && (
                <Link 
                  to="/certificates" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/certificates') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Certificados
                  </div>
                </Link>
              )}
              {user?.role !== 'coordinator' && (
                <Link 
                  to="/exams" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/exams') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Exámenes
                  </div>
                </Link>
              )}
              {user?.role !== 'coordinator' && (
                <Link 
                  to="/study-contents" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/study-contents') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Materiales de Estudio
                  </div>
                </Link>
              )}
              {['candidato', 'admin', 'developer', 'coordinator', 'responsable', 'responsable_partner'].includes(user?.role ?? '') && (
                <Link 
                  to="/vm-sessions" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/vm-sessions') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Calendario de Sesiones
                  </div>
                </Link>
              )}
              {user?.role !== 'candidato' && user?.role !== 'coordinator' && user?.role !== 'responsable' && user?.role !== 'responsable_partner' && (
                <Link 
                  to="/standards" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/standards') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Estándares (ECM)
                  </div>
                </Link>
              )}
              {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                <Link 
                  to="/partners/dashboard" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/partners') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Partners
                  </div>
                </Link>
              )}
              {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                <Link 
                  to="/asignaciones-ecm" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/asignaciones-ecm') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Asignaciones
                  </div>
                </Link>
              )}
              {user?.role === 'responsable' && (
                <Link 
                  to="/mi-plantel" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname === '/mi-plantel' 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Mi Plantel
                  </div>
                </Link>
              )}
              {user?.role === 'responsable' && (
                <Link 
                  to="/mi-plantel/certificados" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/mi-plantel/certificados') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Certificados
                  </div>
                </Link>
              )}
              {user?.role === 'responsable_partner' && (
                <Link 
                  to="/mi-partner" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname === '/mi-partner' 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Mi Partner
                  </div>
                </Link>
              )}
              {user?.role === 'responsable_partner' && (
                <Link 
                  to="/mi-partner/certificados" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/mi-partner/certificados') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Certificados
                  </div>
                </Link>
              )}
              {['financiero', 'admin', 'developer'].includes(user?.role ?? '') && (
                <Link 
                  to="/financiero"
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/financiero') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Financiero
                  </div>
                </Link>
              )}
              {['gerente', 'admin', 'developer'].includes(user?.role ?? '') && (
                <Link 
                  to="/gerente"
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/gerente') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Gerencia
                  </div>
                </Link>
              )}
              {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                <Link 
                  to="/grupos" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/grupos') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Grupos
                  </div>
                </Link>
              )}
              {['coordinator', 'admin', 'developer'].includes(user?.role ?? '') && (
                <Link 
                  to="/mi-saldo"
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/mi-saldo') || location.pathname.startsWith('/solicitar-') || location.pathname.startsWith('/historial-')
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Mi Saldo
                  </div>
                </Link>
              )}
              {(user?.role === 'admin' || user?.role === 'developer' || user?.role === 'coordinator') && (
                <Link 
                  to="/user-management" 
                  className={`block fluid-px-3 fluid-py-3 fluid-rounded-lg transition-all fluid-text-sm ${
                    location.pathname.startsWith('/user-management') 
                      ? 'bg-primary-50 text-primary-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Usuarios
                  </div>
                </Link>
              )}
              
              {/* Separador */}
              <div className="border-t border-gray-200 fluid-my-2"></div>
              
              {/* Cerrar sesión en menú móvil */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center fluid-px-3 fluid-py-3 fluid-rounded-lg fluid-text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="fluid-icon fluid-mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <main className={isFullContentPage ? 'flex-1 overflow-hidden' : 'max-w-fluid-full mx-auto fluid-px-4 fluid-py-4'}>
        {children || <Outlet />}
      </main>
    </div>
  )
}

export default Layout
