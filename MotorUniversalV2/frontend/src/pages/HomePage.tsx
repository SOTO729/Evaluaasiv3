import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { dashboardService, DashboardData } from '../services/dashboardService'

const HomePage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
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

  const exams = dashboardData?.exams || []
  const materials = dashboardData?.materials || []

  const completedMaterials = materials.filter(m => m.progress.percentage === 100)
  const approvedExams = exams.filter(e => e.user_stats.is_approved)
  const pendingMaterials = materials.length - completedMaterials.length
  const pendingExams = exams.length - approvedExams.length

  const materialCompleted = materials.length > 0 && completedMaterials.length === materials.length
  const allExamsApproved = exams.length > 0 && approvedExams.length === exams.length

  // Calcular promedio de progreso en materiales
  const avgMaterialProgress = materials.length > 0 
    ? Math.round(materials.reduce((acc, m) => acc + m.progress.percentage, 0) / materials.length)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-4 sm:mb-6 animate-fade-in-up">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Bienvenido, {user?.name}
        </h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Tu ruta de certificación</p>
      </div>

      {/* Tarjetas Informativas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <div 
          onClick={() => navigate('/study-contents')}
          className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-blue-300 animate-fade-in-up"
          style={{ animationDelay: '0ms' }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Material Pendiente</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900">{pendingMaterials}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => navigate('/exams')}
          className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-amber-300 animate-fade-in-up"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Exámenes Pendientes</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900">{pendingExams}</p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 transform transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-green-300 animate-fade-in-up"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Certificaciones</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900">{approvedExams.length}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => navigate('/study-contents')}
          className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-lg hover:border-purple-300 animate-fade-in-up"
          style={{ animationDelay: '300ms' }}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">Progreso Estudio</p>
              <p className="text-lg sm:text-xl font-semibold text-gray-900">{avgMaterialProgress}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Horizontal */}
      <div className="mb-6 sm:mb-8 max-w-2xl mx-auto px-2 sm:px-0">
        <div className="relative flex items-start justify-between">
          {/* Línea de conexión de fondo */}
          <div className="absolute top-4 sm:top-6 left-0 right-0 flex items-center px-8 sm:px-16">
            <div className="flex-1 h-0.5 sm:h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${materialCompleted ? 'bg-green-400' : 'bg-gray-200'}`} style={{ width: materialCompleted ? '100%' : '0%' }} />
            </div>
            <div className="flex-1 h-0.5 sm:h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${allExamsApproved ? 'bg-green-400' : 'bg-gray-200'}`} style={{ width: allExamsApproved ? '100%' : '0%' }} />
            </div>
          </div>

          {/* Paso 1 */}
          <div className="flex flex-col items-center flex-1 z-10">
            <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shadow-sm transition-all ${
              materialCompleted 
                ? 'bg-green-500 text-white ring-2 sm:ring-4 ring-green-100' 
                : 'bg-primary-500 text-white ring-2 sm:ring-4 ring-primary-100'
            }`}>
              {materialCompleted ? (
                <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : '1'}
            </div>
            <span className={`text-xs sm:text-sm font-medium mt-1 sm:mt-2 ${materialCompleted ? 'text-green-600' : 'text-primary-600'}`}>Estudio</span>
            <span className="text-[10px] sm:text-xs text-gray-400">{completedMaterials.length}/{materials.length}</span>
          </div>

          {/* Paso 2 */}
          <div className="flex flex-col items-center flex-1 z-10">
            <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shadow-sm transition-all ${
              allExamsApproved 
                ? 'bg-green-500 text-white ring-2 sm:ring-4 ring-green-100' 
                : materialCompleted
                  ? 'bg-primary-500 text-white ring-2 sm:ring-4 ring-primary-100'
                  : 'bg-gray-100 text-gray-400 ring-2 sm:ring-4 ring-gray-50'
            }`}>
              {allExamsApproved ? (
                <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : '2'}
            </div>
            <span className={`text-xs sm:text-sm font-medium mt-1 sm:mt-2 ${allExamsApproved ? 'text-green-600' : materialCompleted ? 'text-primary-600' : 'text-gray-400'}`}>Examen</span>
            <span className="text-[10px] sm:text-xs text-gray-400">{approvedExams.length}/{exams.length}</span>
          </div>

          {/* Paso 3 */}
          <div className="flex flex-col items-center flex-1 z-10">
            <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shadow-sm transition-all ${
              allExamsApproved 
                ? 'bg-green-500 text-white ring-2 sm:ring-4 ring-green-100' 
                : 'bg-gray-100 text-gray-400 ring-2 sm:ring-4 ring-gray-50'
            }`}>
              {allExamsApproved ? (
                <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              )}
            </div>
            <span className={`text-xs sm:text-sm font-medium mt-1 sm:mt-2 ${allExamsApproved ? 'text-green-600' : 'text-gray-400'}`}>Certificación</span>
            <span className="text-[10px] sm:text-xs text-gray-400">{allExamsApproved ? 'Obtenida' : 'Pendiente'}</span>
          </div>
        </div>
      </div>

      {/* Contenido en columnas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Columna 1: Material de Estudio */}
        <div className={`bg-white border rounded-lg p-4 ${materialCompleted ? 'border-green-300' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-900 text-sm">Material de Estudio</h2>
            {materialCompleted && (
              <span className="text-xs text-green-600 font-medium">✓</span>
            )}
          </div>
          
          {/* Estadísticas del material */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{materials.length}</p>
              <p className="text-xs text-blue-600">Asignados</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600">{completedMaterials.length}</p>
              <p className="text-xs text-green-600">Completados</p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Avance General</span>
              <span className="font-medium">{avgMaterialProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${avgMaterialProgress}%` }}
              />
            </div>
          </div>

          {/* Info adicional */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
            <span>{pendingMaterials} pendiente{pendingMaterials !== 1 ? 's' : ''}</span>
            <span>{materials.reduce((acc, m) => acc + (m.sessions_count || 0), 0)} sesiones totales</span>
          </div>
          
          {materials.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-2">No hay material disponible</p>
          ) : (
            <button
              onClick={() => navigate('/study-contents')}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Ir a Materiales
            </button>
          )}
        </div>

        {/* Columna 2: Exámenes */}
        <div className={`bg-white border rounded-lg p-4 ${
          allExamsApproved ? 'border-green-300' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-900 text-sm">Exámenes</h2>
            {allExamsApproved ? (
              <span className="text-xs text-green-600 font-medium">✓</span>
            ) : !materialCompleted && materials.length > 0 ? (
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : null}
          </div>
          
          {/* Estadísticas de exámenes */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{exams.length}</p>
              <p className="text-xs text-amber-600">Asignados</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600">{approvedExams.length}</p>
              <p className="text-xs text-green-600">Aprobados</p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tasa de Aprobación</span>
              <span className="font-medium">{exams.length > 0 ? Math.round((approvedExams.length / exams.length) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${exams.length > 0 ? (approvedExams.length / exams.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Info adicional */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
            <span>{pendingExams} pendiente{pendingExams !== 1 ? 's' : ''}</span>
            <span>{exams.reduce((acc, e) => acc + (e.user_stats?.attempts || 0), 0)} intentos totales</span>
          </div>
          
          {exams.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-2">No hay exámenes disponibles</p>
          ) : (
            <button
              onClick={() => navigate('/exams')}
              disabled={!materialCompleted && materials.length > 0}
              className={`w-full text-sm font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                !materialCompleted && materials.length > 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!materialCompleted && materials.length > 0 ? 'Completa el estudio' : 'Ir a Exámenes'}
            </button>
          )}
        </div>

        {/* Columna 3: Certificación */}
        <div className={`bg-white border rounded-lg p-4 ${allExamsApproved ? 'border-green-300' : 'border-gray-200 opacity-60'}`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-gray-900 text-sm">Certificación</h2>
            {allExamsApproved && (
              <span className="text-xs text-green-600 font-medium">✓</span>
            )}
          </div>
          
          {allExamsApproved ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <p className="text-sm text-green-600 font-medium">¡Obtenida!</p>
              <p className="text-xs text-gray-500 mt-1">Proceso completado</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">Pendiente</p>
              <p className="text-xs text-gray-400 mt-1">Completa los pasos anteriores</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HomePage
