import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { dashboardService, DashboardData } from '../services/dashboardService'
import EditorDashboard from './EditorDashboard'
import { 
  BookOpen, 
  FileText, 
  Award, 
  ChevronRight, 
  Target, 
  CheckCircle2,
  Play,
  ArrowRight,
  Sparkles,
  Trophy,
  Zap,
  Star
} from 'lucide-react'

const HomePage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const isEditor = user?.role === 'editor'

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

  useEffect(() => {
    // Solo cargar el dashboard del candidato si no es editor
    if (!isEditor) {
      loadDashboard()
    }
  }, [isEditor])

  // Si es editor, mostrar el dashboard del editor
  if (isEditor) {
    return <EditorDashboard />
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando panel...</p>
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
  const stats = dashboardData?.stats

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

  // Calcular progreso general (materiales 40%, exámenes 60%)
  const examApprovalRate = exams.length > 0 ? (approvedExams.length / exams.length) * 100 : 0
  const overallProgress = Math.round((avgMaterialProgress * 0.4) + (examApprovalRate * 0.6))

  // Determinar el paso actual
  const getCurrentStep = () => {
    if (allExamsApproved) return 3 // Certificado
    if (materialCompleted) return 2 // Listo para examen
    return 1 // Estudiando
  }
  const currentStep = getCurrentStep()

  // Mensaje motivacional según el progreso
  const getMotivationalMessage = () => {
    if (allExamsApproved) {
      return { title: '¡Felicidades! 🎉', subtitle: 'Has completado tu certificación exitosamente' }
    }
    if (materialCompleted && pendingExams > 0) {
      return { title: '¡Estás listo!', subtitle: 'Es momento de demostrar lo aprendido en el examen' }
    }
    if (avgMaterialProgress >= 50) {
      return { title: '¡Vas muy bien!', subtitle: 'Continúa con tu preparación para el examen' }
    }
    if (avgMaterialProgress > 0) {
      return { title: '¡Buen comienzo!', subtitle: 'Sigue estudiando para alcanzar tu certificación' }
    }
    return { title: '¡Bienvenido!', subtitle: 'Comienza tu camino hacia la certificación' }
  }
  const motivationalMessage = getMotivationalMessage()

  // Determinar la siguiente acción recomendada
  const getNextAction = () => {
    if (allExamsApproved) {
      return { 
        text: 'Ver mis certificados', 
        route: '/certificates',
        icon: Award,
        color: 'bg-green-600 hover:bg-green-700'
      }
    }
    if (materialCompleted || materials.length === 0) {
      return { 
        text: 'Presentar examen', 
        route: '/exams',
        icon: FileText,
        color: 'bg-blue-600 hover:bg-blue-700'
      }
    }
    // Encontrar el material con menos progreso que no esté completo
    const nextMaterial = materials.find(m => m.progress.percentage < 100)
    if (nextMaterial) {
      return { 
        text: 'Continuar estudiando', 
        route: '/study-contents',
        icon: BookOpen,
        color: 'bg-blue-600 hover:bg-blue-700'
      }
    }
    return { 
      text: 'Ir a materiales', 
      route: '/study-contents',
      icon: BookOpen,
      color: 'bg-blue-600 hover:bg-blue-700'
    }
  }
  const nextAction = getNextAction()

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-fluid-xl fluid-p-8 text-white relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex-1">
              <h1 className="fluid-text-4xl font-bold fluid-mb-2">
                {motivationalMessage.title}
              </h1>
              <p className="text-blue-100 fluid-text-base">
                {motivationalMessage.subtitle}
              </p>
              <p className="text-blue-200 fluid-text-sm fluid-mt-1">
                Hola, <span className="font-medium text-white">{user?.name}</span>
              </p>
            </div>
            
            {/* Progreso circular */}
            <div className="flex items-center fluid-gap-4">
              <div className="relative w-[clamp(4rem,3rem+2vw,6rem)] h-[clamp(4rem,3rem+2vw,6rem)]">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${overallProgress * 2.83} 283`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="fluid-text-xl font-bold">{overallProgress}%</span>
                </div>
              </div>
              <div className="fluid-text-sm">
                <p className="text-blue-100">Progreso</p>
                <p className="font-semibold">General</p>
              </div>
            </div>
          </div>

          {/* Botón de acción principal */}
          <button
            onClick={() => navigate(nextAction.route)}
            className={`fluid-mt-5 w-full sm:w-auto inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 ${nextAction.color} rounded-fluid-lg font-semibold fluid-text-base text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}
          >
            <nextAction.icon className="fluid-icon" />
            {nextAction.text}
            <ArrowRight className="fluid-icon-sm" />
          </button>
        </div>
      </div>

      {/* Timeline de Progreso Mejorado */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-8">
        <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-5 flex items-center fluid-gap-2">
          <Target className="fluid-icon text-blue-600" />
          Tu ruta de certificación
        </h2>
        
        <div className="relative">
          {/* Línea de conexión */}
          <div className="absolute top-7 left-7 right-7 h-[clamp(0.125rem,0.1rem+0.1vw,0.25rem)] bg-gray-200 rounded-full">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000"
              style={{ width: `${(currentStep - 1) * 50}%` }}
            />
          </div>

          <div className="grid grid-cols-3 fluid-gap-3 relative">
            {/* Paso 1: Estudiar */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] rounded-full flex items-center justify-center fluid-mb-2 transition-all duration-300 ${
                currentStep >= 1 
                  ? materialCompleted 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 ring-[clamp(2px,0.15rem+0.1vw,4px)] ring-blue-100'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {materialCompleted ? (
                  <CheckCircle2 className="fluid-icon-xl" />
                ) : (
                  <BookOpen className="fluid-icon-lg" />
                )}
              </div>
              <h3 className={`font-semibold fluid-text-sm ${currentStep >= 1 ? 'text-gray-800' : 'text-gray-400'}`}>
                Estudiar
              </h3>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                {completedMaterials.length}/{materials.length} materiales
              </p>
              {currentStep === 1 && !materialCompleted && (
                <span className="fluid-mt-1 fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 py-0.5 rounded-full font-medium">
                  En progreso
                </span>
              )}
            </div>

            {/* Paso 2: Examinar */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] rounded-full flex items-center justify-center fluid-mb-2 transition-all duration-300 ${
                currentStep >= 2
                  ? allExamsApproved
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 ring-[clamp(2px,0.15rem+0.1vw,4px)] ring-blue-100'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {allExamsApproved ? (
                  <CheckCircle2 className="fluid-icon-xl" />
                ) : (
                  <FileText className="fluid-icon-lg" />
                )}
              </div>
              <h3 className={`font-semibold fluid-text-sm ${currentStep >= 2 ? 'text-gray-800' : 'text-gray-400'}`}>
                Examinar
              </h3>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                {approvedExams.length}/{exams.length} aprobados
              </p>
              {currentStep === 2 && !allExamsApproved && (
                <span className="fluid-mt-1 fluid-text-xs bg-blue-100 text-blue-700 fluid-px-2 py-0.5 rounded-full font-medium">
                  En progreso
                </span>
              )}
            </div>

            {/* Paso 3: Certificar */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] rounded-full flex items-center justify-center fluid-mb-2 transition-all duration-300 ${
                currentStep >= 3
                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {allExamsApproved ? (
                  <Trophy className="fluid-icon-xl" />
                ) : (
                  <Award className="fluid-icon-lg" />
                )}
              </div>
              <h3 className={`font-semibold fluid-text-sm ${currentStep >= 3 ? 'text-gray-800' : 'text-gray-400'}`}>
                Certificar
              </h3>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                {allExamsApproved ? '¡Completado!' : 'Pendiente'}
              </p>
              {allExamsApproved && (
                <span className="fluid-mt-1 fluid-text-xs bg-green-100 text-green-700 fluid-px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="fluid-icon-xs" />
                  Logrado
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Acceso Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 fluid-gap-5">
        {/* Materiales de Estudio */}
        <div 
          onClick={() => navigate('/study-contents')}
          className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:border-blue-300 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between fluid-mb-4">
            <div className={`w-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] h-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] rounded-fluid-lg flex items-center justify-center ${
              materialCompleted ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              <BookOpen className={`fluid-icon-lg ${materialCompleted ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
            <ChevronRight className="fluid-icon text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
          
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Materiales</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Material de estudio para tu preparación</p>
          
          {/* Barra de progreso */}
          <div className="fluid-mb-3">
            <div className="flex justify-between fluid-text-xs text-gray-500 mb-1">
              <span>Progreso</span>
              <span className="font-medium text-gray-700">{avgMaterialProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-[clamp(0.375rem,0.3rem+0.1vw,0.5rem)]">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  materialCompleted ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${avgMaterialProgress}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="fluid-text-sm text-gray-600">
              {completedMaterials.length} de {materials.length} completos
            </span>
            {materialCompleted && (
              <span className="flex items-center gap-1 text-green-600 fluid-text-xs font-medium">
                <CheckCircle2 className="fluid-icon-sm" />
                Completado
              </span>
            )}
          </div>
        </div>

        {/* Exámenes */}
        <div 
          onClick={() => navigate('/exams')}
          className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:border-amber-300 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
        >
          <div className="flex items-start justify-between fluid-mb-4">
            <div className={`w-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] h-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] rounded-fluid-lg flex items-center justify-center ${
              allExamsApproved ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              <FileText className={`fluid-icon-lg ${allExamsApproved ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <ChevronRight className="fluid-icon text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </div>
          
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Exámenes</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Demuestra tu conocimiento y certifícate</p>
          
          {/* Barra de progreso */}
          <div className="fluid-mb-3">
            <div className="flex justify-between fluid-text-xs text-gray-500 mb-1">
              <span>Aprobación</span>
              <span className="font-medium text-gray-700">{Math.round(examApprovalRate)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-[clamp(0.375rem,0.3rem+0.1vw,0.5rem)]">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  allExamsApproved ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${examApprovalRate}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="fluid-text-sm text-gray-600">
              {approvedExams.length} de {exams.length} aprobados
            </span>
            {allExamsApproved && (
              <span className="flex items-center gap-1 text-green-600 fluid-text-xs font-medium">
                <CheckCircle2 className="fluid-icon-sm" />
                Completado
              </span>
            )}
          </div>
        </div>

        {/* Certificados */}
        <div 
          onClick={() => navigate('/certificates')}
          className="bg-white rounded-fluid-xl border border-green-200 fluid-p-5 cursor-pointer group hover:border-green-400 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-green-50 active:scale-[0.98] sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-start justify-between fluid-mb-4">
            <div className="w-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] h-[clamp(2.75rem,2.5rem+0.5vw,3.5rem)] rounded-fluid-lg flex items-center justify-center bg-gradient-to-br from-yellow-100 to-amber-100">
              <Award className="fluid-icon-lg text-amber-600" />
            </div>
            <ChevronRight className="fluid-icon text-green-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" />
          </div>
          
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Certificados</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            {approvedExams.length > 0 ? 'Descarga tus certificaciones' : 'Consulta tus certificaciones'}
          </p>
          
          {approvedExams.length > 0 ? (
            <div className="flex items-center fluid-gap-2 fluid-p-3 bg-green-100 rounded-fluid-lg">
              <Trophy className="fluid-icon text-green-600" />
              <div>
                <p className="fluid-text-sm font-medium text-green-800">{approvedExams.length} certificación{approvedExams.length !== 1 ? 'es' : ''}</p>
                <p className="fluid-text-xs text-green-600">Disponibles para descargar</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center fluid-gap-2 fluid-p-3 bg-amber-50 rounded-fluid-lg">
              <Target className="fluid-icon text-amber-500" />
              <div>
                <p className="fluid-text-sm font-medium text-amber-700">En progreso</p>
                <p className="fluid-text-xs text-amber-500">Aprueba exámenes para obtener certificados</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-4">
        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-blue-100 rounded-full flex items-center justify-center">
            <BookOpen className="fluid-icon text-blue-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{materials.length}</p>
          <p className="fluid-text-xs text-gray-500">Materiales</p>
        </div>
        
        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-amber-100 rounded-full flex items-center justify-center">
            <FileText className="fluid-icon text-amber-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{exams.length}</p>
          <p className="fluid-text-xs text-gray-500">Exámenes</p>
        </div>
        
        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="fluid-icon text-green-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{approvedExams.length}</p>
          <p className="fluid-text-xs text-gray-500">Certificaciones</p>
        </div>
        
        <div className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4 text-center">
          <div className="w-[clamp(2rem,1.75rem+0.5vw,2.5rem)] h-[clamp(2rem,1.75rem+0.5vw,2.5rem)] mx-auto fluid-mb-2 bg-purple-100 rounded-full flex items-center justify-center">
            <Star className="fluid-icon text-purple-600" />
          </div>
          <p className="fluid-text-2xl font-bold text-gray-800">{stats?.average_score ? Math.round(stats.average_score) : '--'}%</p>
          <p className="fluid-text-xs text-gray-500">Promedio</p>
        </div>
      </div>

      {/* Próximos Pasos - Recomendaciones */}
      {!allExamsApproved && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-100 fluid-p-5">
          <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <Zap className="fluid-icon text-blue-600" />
            Próximos pasos recomendados
          </h2>
          
          <div className="flex flex-col fluid-gap-3">
            {!materialCompleted && materials.length > 0 && (
              <div 
                onClick={() => navigate('/study-contents')}
                className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-fluid-lg border border-blue-100 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group active:scale-[0.98]"
              >
                <div className="w-[clamp(2.25rem,2rem+0.5vw,2.5rem)] h-[clamp(2.25rem,2rem+0.5vw,2.5rem)] bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Play className="fluid-icon text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium fluid-text-base text-gray-800">Continúa estudiando</p>
                  <p className="fluid-text-sm text-gray-500">Te falta completar {pendingMaterials} material{pendingMaterials !== 1 ? 'es' : ''}</p>
                </div>
                <ArrowRight className="fluid-icon text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>
            )}
            
            {(materialCompleted || materials.length === 0) && pendingExams > 0 && (
              <div 
                onClick={() => navigate('/exams')}
                className="flex items-center fluid-gap-4 fluid-p-4 bg-white rounded-fluid-lg border border-amber-100 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group active:scale-[0.98]"
              >
                <div className="w-[clamp(2.25rem,2rem+0.5vw,2.5rem)] h-[clamp(2.25rem,2rem+0.5vw,2.5rem)] bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Target className="fluid-icon text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium fluid-text-base text-gray-800">Presenta tu examen</p>
                  <p className="fluid-text-sm text-gray-500">Tienes {pendingExams} examen{pendingExams !== 1 ? 'es' : ''} por aprobar</p>
                </div>
                <ArrowRight className="fluid-icon text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de felicitación cuando todo está completo */}
      {allExamsApproved && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-fluid-xl border border-green-200 fluid-p-5 text-center">
          <div className="w-[clamp(3rem,2.5rem+1vw,4rem)] h-[clamp(3rem,2.5rem+1vw,4rem)] mx-auto fluid-mb-4 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Trophy className="fluid-icon-xl text-white" />
          </div>
          <h2 className="fluid-text-xl font-bold text-gray-800 fluid-mb-2">¡Proceso de certificación completado!</h2>
          <p className="fluid-text-base text-gray-600 fluid-mb-4">Has aprobado todos tus exámenes exitosamente.</p>
          <button
            onClick={() => navigate('/certificates')}
            className="w-full sm:w-auto inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-green-600 hover:bg-green-700 text-white rounded-fluid-lg font-semibold fluid-text-base transition-all transform hover:scale-105 active:scale-[0.98]"
          >
            <Award className="fluid-icon" />
            Ver mis certificados
            <ArrowRight className="fluid-icon-sm" />
          </button>
        </div>
      )}
    </div>
  )
}

export default HomePage
