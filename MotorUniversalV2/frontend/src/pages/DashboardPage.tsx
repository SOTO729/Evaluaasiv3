import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { dashboardService, DashboardData, DashboardExam, DashboardMaterial } from '../services/dashboardService'

const DashboardPage = () => {
  const { user } = useAuthStore()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (!loading && dashboardData) {
      // Activar animación después de cargar
      setTimeout(() => setIsVisible(true), 100)
    }
  }, [loading, dashboardData])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardService.getDashboard()
      setDashboardData(data)
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      setError(err.response?.data?.error || 'Error al cargar la página de inicio')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg animate-fade-in">
        <p>{error}</p>
        <button 
          onClick={loadDashboard}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const stats = dashboardData?.stats || { total_exams: 0, completed_exams: 0, approved_exams: 0, average_score: 0 }
  const exams = dashboardData?.exams || []
  const materials = dashboardData?.materials || []

  return (
    <div className={`space-y-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Header con animación */}
      <div className={`transition-all duration-500 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenido, {user?.name}
        </h1>
        <p className="text-gray-500 mt-1">Tu centro de aprendizaje</p>
      </div>

      {/* Stats Cards con animación escalonada */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`card bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 transform transition-all duration-500 delay-150 hover:scale-105 hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h3 className="text-sm font-medium text-blue-800 mb-1">
            Exámenes Disponibles
          </h3>
          <p className="text-3xl font-bold text-blue-600">{stats.total_exams}</p>
        </div>

        <div className={`card bg-gradient-to-br from-green-50 to-green-100 border border-green-200 transform transition-all duration-500 delay-200 hover:scale-105 hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h3 className="text-sm font-medium text-green-800 mb-1">
            Exámenes Completados
          </h3>
          <p className="text-3xl font-bold text-green-600">{stats.completed_exams}</p>
        </div>

        <div className={`card bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 transform transition-all duration-500 delay-250 hover:scale-105 hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h3 className="text-sm font-medium text-emerald-800 mb-1">
            Exámenes Aprobados
          </h3>
          <p className="text-3xl font-bold text-emerald-600">{stats.approved_exams}</p>
        </div>

        <div className={`card bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 transform transition-all duration-500 delay-300 hover:scale-105 hover:shadow-lg ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h3 className="text-sm font-medium text-purple-800 mb-1">
            Promedio General
          </h3>
          <p className="text-3xl font-bold text-purple-600">{stats.average_score}%</p>
        </div>
      </div>

      {/* Exámenes Section con animación */}
      <div className={`transition-all duration-500 delay-350 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Mis Exámenes</h2>
          <span className="text-sm text-gray-500">{exams.length} disponibles</span>
        </div>
        
        {exams.length === 0 ? (
          <div className="card text-center py-8 animate-pulse">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">No hay exámenes disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam, index) => (
              <ExamCard key={exam.id} exam={exam} index={index} isVisible={isVisible} />
            ))}
          </div>
        )}
      </div>

      {/* Materiales de Estudio Section con animación */}
      <div className={`transition-all duration-500 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Contenidos de Estudio</h2>
          <span className="text-sm text-gray-500">{materials.length} disponibles</span>
        </div>
        
        {materials.length === 0 ? (
          <div className="card text-center py-8 animate-pulse">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-gray-500">No hay contenidos de estudio disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map((material, index) => (
              <MaterialCard key={material.id} material={material} index={index} isVisible={isVisible} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Componente para tarjeta de examen con animación
const ExamCard = ({ exam, index, isVisible }: { exam: DashboardExam; index: number; isVisible: boolean }) => {
  const { user_stats } = exam
  const hasAttempts = user_stats.attempts > 0
  
  const getStatusBadge = () => {
    if (user_stats.is_approved) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
          Aprobado
        </span>
      )
    }
    if (user_stats.is_completed) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
          No Aprobado
        </span>
      )
    }
    if (hasAttempts) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
          En Progreso
        </span>
      )
    }
    return (
      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
        Sin Iniciar
      </span>
    )
  }

  return (
    <div 
      className={`card hover:shadow-lg transition-all duration-300 border border-gray-200 transform hover:scale-[1.02] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${400 + index * 100}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-lg leading-tight">{exam.name}</h3>
        {getStatusBadge()}
      </div>
      
      {exam.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{exam.description}</p>
      )}
      
      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{exam.time_limit_minutes} minutos</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Puntaje mínimo: {exam.passing_score}%</span>
        </div>
        {hasAttempts && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span className="font-semibold">Mejor calificación: {user_stats.best_score}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {hasAttempts ? `${user_stats.attempts} intento${user_stats.attempts > 1 ? 's' : ''}` : 'Sin intentos'}
        </span>
        <Link 
          to={`/exams/${exam.id}/test`}
          className="btn-primary text-sm py-1.5 px-4"
        >
          {hasAttempts && !user_stats.is_approved ? 'Reintentar' : 'Iniciar'}
        </Link>
      </div>
    </div>
  )
}

// Componente para tarjeta de material con animación
const MaterialCard = ({ material, index, isVisible }: { material: DashboardMaterial; index: number; isVisible: boolean }) => {
  const { progress } = material
  const isCompleted = progress.percentage === 100
  
  return (
    <div 
      className={`card hover:shadow-lg transition-all duration-300 border border-gray-200 transform hover:scale-[1.02] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${500 + index * 100}ms` }}
    >
      {material.image_url && (
        <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
          <img 
            src={material.image_url} 
            alt={material.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 text-lg leading-tight">{material.title}</h3>
        {isCompleted && (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex-shrink-0 ml-2">
            Completado
          </span>
        )}
      </div>
      
      {material.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{material.description}</p>
      )}
      
      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>{material.sessions_count} sesiones</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>{progress.completed_contents} de {progress.total_contents} contenidos</span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">Progreso</span>
          <span className="font-medium text-gray-700">{progress.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              isCompleted ? 'bg-green-500' : progress.percentage > 0 ? 'bg-primary-500' : 'bg-gray-300'
            }`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <Link 
          to={`/materiales/${material.id}`}
          className="btn-primary w-full text-sm py-2 text-center block"
        >
          {progress.percentage > 0 && !isCompleted ? 'Continuar' : isCompleted ? 'Revisar' : 'Comenzar'}
        </Link>
      </div>
    </div>
  )
}

export default DashboardPage
