import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { editorDashboardService, EditorDashboardData } from '../services/editorDashboardService'
import { 
  ClipboardList, 
  FileText, 
  BookOpen, 
  ChevronRight, 
  Plus,
  CheckCircle2,
  Clock,
  HelpCircle,
  BarChart3,
  TrendingUp,
  Edit3,
  Layers,
  AlertCircle,
  Timer,
  Award,
  FolderOpen
} from 'lucide-react'

const EditorDashboard = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState<EditorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await editorDashboardService.getDashboard()
      setDashboardData(data)
    } catch (err: any) {
      console.error('Error loading editor dashboard:', err)
      setError(err.response?.data?.error || 'Error al cargar el dashboard del editor')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full fluid-w-12 fluid-h-12 border-b-4 border-blue-900"></div>
        <p className="fluid-mt-4 fluid-text-base font-medium text-gray-700">Cargando panel...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fluid-p-4 bg-red-50 text-red-600 fluid-rounded-lg">
        <p>{error}</p>
        <button 
          onClick={loadDashboard}
          className="fluid-mt-2 fluid-text-sm text-red-700 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const summary = dashboardData?.summary
  const recentStandards = dashboardData?.recent_standards || []
  const recentExams = dashboardData?.recent_exams || []
  const recentMaterials = dashboardData?.recent_materials || []

  return (
    <div className="flex flex-col fluid-gap-5">
      {/* Estilos para gradiente animado */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient-editor {
          background: linear-gradient(-45deg, #1e3a8a, #1e40af, #1d4ed8, #2563eb, #1e3a8a, #172554, #1e40af, #1d4ed8);
          background-size: 400% 400%;
          animation: gradientShift 20s ease infinite;
        }
      `}</style>

      {/* Hero Section */}
      <div className="animated-gradient-editor fluid-rounded-xl fluid-p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 fluid-w-48 fluid-h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 fluid-w-36 fluid-h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex-1">
              <div className="flex items-center fluid-gap-3 fluid-mb-3">
                <Edit3 className="fluid-icon-lg text-blue-200" />
                <span className="text-blue-200 fluid-text-sm font-medium uppercase tracking-wider">Panel de Editor</span>
              </div>
              <h1 className="fluid-text-3xl font-bold fluid-mb-2">
                ¡Bienvenido, {user?.name}!
              </h1>
              <p className="text-blue-100 fluid-text-base">
                Gestiona y crea contenido para la plataforma de certificación
              </p>
            </div>
            
            <div className="grid grid-cols-3 fluid-gap-3">
              <div className="text-center bg-white/10 fluid-rounded-md fluid-p-3">
                <p className="fluid-text-xl font-bold">{summary?.standards.total || 0}</p>
                <p className="fluid-text-xs text-blue-200">Estándares</p>
              </div>
              <div className="text-center bg-white/10 fluid-rounded-md fluid-p-3">
                <p className="fluid-text-xl font-bold">{summary?.exams.total || 0}</p>
                <p className="fluid-text-xs text-blue-200">Exámenes</p>
              </div>
              <div className="text-center bg-white/10 fluid-rounded-md fluid-p-3">
                <p className="fluid-text-xl font-bold">{summary?.materials.total || 0}</p>
                <p className="fluid-text-xs text-blue-200">Materiales</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Resumen con Acciones Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-6">
        {/* Estándares ECM */}
        <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="fluid-w-12 fluid-h-12 bg-purple-100 fluid-rounded-xl flex items-center justify-center">
              <ClipboardList className="fluid-icon text-purple-600" />
            </div>
            <button
              onClick={() => navigate('/standards/new')}
              className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-purple-100 text-purple-700 fluid-rounded-lg fluid-text-sm font-medium hover:bg-purple-200 transition-colors"
            >
              <Plus className="fluid-icon-sm" />
              Crear
            </button>
          </div>
          
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Estándares ECM</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Estándares de competencia CONOCER</p>
          
          <div className="flex items-center justify-between fluid-text-sm fluid-mb-3">
            <div className="flex items-center fluid-gap-2">
              <CheckCircle2 className="fluid-icon-sm text-green-500" />
              <span className="text-gray-600">{summary?.standards.active || 0} activos</span>
            </div>
            <div className="flex items-center fluid-gap-2 text-gray-400">
              <Layers className="fluid-icon-sm" />
              <span>{summary?.standards.total || 0} total</span>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/standards')}
            className="w-full flex items-center justify-center fluid-gap-2 fluid-py-2 text-purple-600 hover:bg-purple-50 fluid-rounded-lg transition-colors fluid-text-sm font-medium"
          >
            Ver todos
            <ChevronRight className="fluid-icon-sm" />
          </button>
        </div>

        {/* Exámenes */}
        <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="fluid-w-12 fluid-h-12 bg-blue-100 fluid-rounded-xl flex items-center justify-center">
              <FileText className="fluid-icon text-blue-600" />
            </div>
            <button
              onClick={() => navigate('/exams/new')}
              className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-blue-100 text-blue-700 fluid-rounded-lg fluid-text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              <Plus className="fluid-icon-sm" />
              Crear
            </button>
          </div>
          
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Exámenes</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Exámenes de certificación</p>
          
          <div className="flex items-center justify-between fluid-text-sm fluid-mb-3">
            <div className="flex items-center fluid-gap-2">
              <CheckCircle2 className="fluid-icon-sm text-green-500" />
              <span className="text-gray-600">{summary?.exams.published || 0} publicados</span>
            </div>
            <div className="flex items-center fluid-gap-2">
              <Clock className="fluid-icon-sm text-amber-500" />
              <span className="text-amber-600">{summary?.exams.draft || 0} borradores</span>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/exams')}
            className="w-full flex items-center justify-center fluid-gap-2 fluid-py-2 text-blue-600 hover:bg-blue-50 fluid-rounded-lg transition-colors fluid-text-sm font-medium"
          >
            Ver todos
            <ChevronRight className="fluid-icon-sm" />
          </button>
        </div>

        {/* Materiales de Estudio */}
        <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="fluid-w-12 fluid-h-12 bg-emerald-100 fluid-rounded-xl flex items-center justify-center">
              <BookOpen className="fluid-icon text-emerald-600" />
            </div>
            <button
              onClick={() => navigate('/study-contents/new')}
              className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-emerald-100 text-emerald-700 fluid-rounded-lg fluid-text-sm font-medium hover:bg-emerald-200 transition-colors"
            >
              <Plus className="fluid-icon-sm" />
              Crear
            </button>
          </div>
          
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-1">Materiales de Estudio</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">Contenido educativo</p>
          
          <div className="flex items-center justify-between fluid-text-sm fluid-mb-3">
            <div className="flex items-center fluid-gap-2">
              <CheckCircle2 className="fluid-icon-sm text-green-500" />
              <span className="text-gray-600">{summary?.materials.published || 0} publicados</span>
            </div>
            <div className="flex items-center fluid-gap-2">
              <Clock className="fluid-icon-sm text-amber-500" />
              <span className="text-amber-600">{summary?.materials.draft || 0} borradores</span>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/study-contents')}
            className="w-full flex items-center justify-center fluid-gap-2 fluid-py-2 text-emerald-600 hover:bg-emerald-50 fluid-rounded-lg transition-colors fluid-text-sm font-medium"
          >
            Ver todos
            <ChevronRight className="fluid-icon-sm" />
          </button>
        </div>
      </div>

      {/* Estadísticas de Preguntas */}
      <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5">
        <div className="flex items-center fluid-gap-2 fluid-mb-4">
          <HelpCircle className="fluid-icon text-gray-600" />
          <h2 className="fluid-text-lg font-semibold text-gray-800">Banco de Preguntas</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 fluid-rounded-lg fluid-p-4 text-center border border-blue-100">
            <BarChart3 className="fluid-icon text-blue-600 mx-auto fluid-mb-2" />
            <p className="fluid-text-2xl font-bold text-gray-800">{summary?.questions.total || 0}</p>
            <p className="fluid-text-xs text-gray-500">Total</p>
          </div>
          
          {Object.entries(summary?.questions.by_type || {}).map(([type, count]) => {
            const typeLabels: Record<string, string> = {
              'multiple_choice': 'Opción Múltiple',
              'multiple_selection': 'Selección Múltiple',
              'multiple_select': 'Selección Múltiple',
              'true_false': 'V/F',
              'ordering': 'Ordenamiento',
            }
            
            return (
              <div key={type} className="bg-gray-50 fluid-rounded-lg fluid-p-4 text-center">
                <p className="fluid-text-xl font-bold text-gray-800">{count}</p>
                <p className="fluid-text-xs text-gray-500">{typeLabels[type] || type}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actividad Reciente - Mejorada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6">
        {/* Estándares Recientes */}
        <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-2">
              <TrendingUp className="fluid-icon text-purple-600" />
              <h3 className="fluid-text-base font-semibold text-gray-800">Estándares Recientes</h3>
            </div>
            <span className="fluid-text-2xs text-gray-400 bg-gray-100 fluid-px-2 fluid-py-0-5 fluid-rounded">Últ. modificado</span>
          </div>
          
          {recentStandards.length === 0 ? (
            <div className="text-center fluid-py-6 text-gray-400">
              <ClipboardList className="fluid-icon-lg mx-auto fluid-mb-2 opacity-50" />
              <p className="fluid-text-sm">No hay estándares recientes</p>
            </div>
          ) : (
            <div className="flex flex-col fluid-gap-2">
              {recentStandards.map((standard) => (
                <div 
                  key={standard.id}
                  onClick={() => navigate(`/standards/${standard.id}`)}
                  className="fluid-p-3 bg-gray-50 fluid-rounded-lg hover:bg-purple-50 cursor-pointer transition-colors group border border-transparent hover:border-purple-200"
                >
                  <div className="flex items-start justify-between fluid-gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-1">
                        <p className="fluid-text-sm font-semibold text-gray-800 group-hover:text-purple-700">
                          {standard.code}
                        </p>
                        {standard.is_active ? (
                          <span className="fluid-px-1 fluid-py-0-5 bg-green-100 text-green-700 fluid-text-2xs fluid-rounded font-medium">
                            Activo
                          </span>
                        ) : (
                          <span className="fluid-px-1 fluid-py-0-5 bg-gray-200 text-gray-600 fluid-text-2xs fluid-rounded font-medium">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="fluid-text-xs text-gray-600 truncate fluid-mb-1">{standard.name}</p>
                      <div className="flex items-center fluid-gap-2 fluid-text-2xs text-gray-400">
                        {standard.sector && <span>📌 {standard.sector}</span>}
                        {standard.level && <span>Nivel {standard.level}</span>}
                      </div>
                    </div>
                    <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-purple-500 flex-shrink-0 fluid-mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exámenes Recientes */}
        <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-2">
              <TrendingUp className="fluid-icon text-blue-600" />
              <h3 className="fluid-text-base font-semibold text-gray-800">Exámenes Recientes</h3>
            </div>
            <span className="fluid-text-2xs text-gray-400 bg-gray-100 fluid-px-2 fluid-py-0-5 fluid-rounded">Últ. modificado</span>
          </div>
          
          {recentExams.length === 0 ? (
            <div className="text-center fluid-py-6 text-gray-400">
              <FileText className="fluid-icon-lg mx-auto fluid-mb-2 opacity-50" />
              <p className="fluid-text-sm">No hay exámenes recientes</p>
            </div>
          ) : (
            <div className="flex flex-col fluid-gap-2">
              {recentExams.map((exam) => (
                <div 
                  key={exam.id}
                  onClick={() => navigate(`/exams/${exam.id}`)}
                  className="fluid-p-3 bg-gray-50 fluid-rounded-lg hover:bg-blue-50 cursor-pointer transition-colors group border border-transparent hover:border-blue-200"
                >
                  <div className="flex items-start justify-between fluid-gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-1">
                        <p className="fluid-text-sm font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                          {exam.name}
                        </p>
                        {exam.is_published ? (
                          <span className="fluid-px-1 fluid-py-0-5 bg-green-100 text-green-700 fluid-text-2xs fluid-rounded font-medium flex-shrink-0">
                            Pub
                          </span>
                        ) : (
                          <span className="fluid-px-1 fluid-py-0-5 bg-amber-100 text-amber-700 fluid-text-2xs fluid-rounded font-medium flex-shrink-0">
                            Borr
                          </span>
                        )}
                      </div>
                      <p className="fluid-text-xs text-gray-600 fluid-mb-1">
                        {exam.competency_standard?.code || 'Sin ECM'} • v{exam.version}
                      </p>
                      <div className="flex items-center fluid-gap-3 fluid-text-2xs text-gray-400">
                        <span className="flex items-center fluid-gap-1">
                          <Timer className="fluid-icon-xs" />
                          {exam.duration_minutes || 0} min
                        </span>
                        <span className="flex items-center fluid-gap-1">
                          <Award className="fluid-icon-xs" />
                          {exam.passing_score || 0}%
                        </span>
                        <span className="flex items-center fluid-gap-1">
                          <Layers className="fluid-icon-xs" />
                          {exam.total_categories || 0} cat
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-blue-500 flex-shrink-0 fluid-mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Materiales Recientes */}
        <div className="bg-white fluid-rounded-xl border border-gray-200 fluid-p-5">
          <div className="flex items-center justify-between fluid-mb-4">
            <div className="flex items-center fluid-gap-2">
              <TrendingUp className="fluid-icon text-emerald-600" />
              <h3 className="fluid-text-base font-semibold text-gray-800">Materiales Recientes</h3>
            </div>
            <span className="fluid-text-2xs text-gray-400 bg-gray-100 fluid-px-2 fluid-py-0-5 fluid-rounded">Últ. modificado</span>
          </div>
          
          {recentMaterials.length === 0 ? (
            <div className="text-center fluid-py-6 text-gray-400">
              <BookOpen className="fluid-icon-lg mx-auto fluid-mb-2 opacity-50" />
              <p className="fluid-text-sm">No hay materiales recientes</p>
            </div>
          ) : (
            <div className="flex flex-col fluid-gap-2">
              {recentMaterials.map((material) => (
                <div 
                  key={material.id}
                  onClick={() => navigate(`/study-contents/${material.id}`)}
                  className="fluid-p-3 bg-gray-50 fluid-rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors group border border-transparent hover:border-emerald-200"
                >
                  <div className="flex items-start justify-between fluid-gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-1">
                        <p className="fluid-text-sm font-semibold text-gray-800 group-hover:text-emerald-700 truncate">
                          {material.title}
                        </p>
                        {material.is_published ? (
                          <span className="fluid-px-1 fluid-py-0-5 bg-green-100 text-green-700 fluid-text-2xs fluid-rounded font-medium flex-shrink-0">
                            Pub
                          </span>
                        ) : (
                          <span className="fluid-px-1 fluid-py-0-5 bg-amber-100 text-amber-700 fluid-text-2xs fluid-rounded font-medium flex-shrink-0">
                            Borr
                          </span>
                        )}
                      </div>
                      {material.description && (
                        <p className="fluid-text-xs text-gray-500 truncate fluid-mb-1">{material.description}</p>
                      )}
                      <div className="flex items-center fluid-gap-3 fluid-text-2xs text-gray-400">
                        <span className="flex items-center fluid-gap-1">
                          <FolderOpen className="fluid-icon-xs" />
                          {material.sessions_count || 0} sesiones
                        </span>
                        <span className="flex items-center fluid-gap-1">
                          <FileText className="fluid-icon-xs" />
                          {material.topics_count || 0} temas
                        </span>
                        {material.estimated_time_minutes && material.estimated_time_minutes > 0 && (
                          <span className="flex items-center fluid-gap-1">
                            <Timer className="fluid-icon-xs" />
                            {material.estimated_time_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="fluid-icon-sm text-gray-300 group-hover:text-emerald-500 flex-shrink-0 fluid-mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesos Rápidos para Borradores */}
      {((summary?.exams.draft || 0) > 0 || (summary?.materials.draft || 0) > 0) && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 fluid-rounded-xl border border-amber-200 fluid-p-5">
          <div className="flex items-center fluid-gap-2 fluid-mb-4">
            <AlertCircle className="fluid-icon text-amber-600" />
            <h3 className="fluid-text-base font-semibold text-gray-800">Contenido Pendiente de Publicar</h3>
          </div>
          
          <div className="flex flex-wrap fluid-gap-3">
            {(summary?.exams.draft || 0) > 0 && (
              <button
                onClick={() => navigate('/exams?scrollTo=drafts')}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white border border-amber-200 fluid-rounded-lg fluid-text-sm text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <FileText className="fluid-icon-sm" />
                {summary?.exams.draft} examen{(summary?.exams.draft || 0) !== 1 ? 'es' : ''} en borrador
                <ChevronRight className="fluid-icon-sm" />
              </button>
            )}
            
            {(summary?.materials.draft || 0) > 0 && (
              <button
                onClick={() => navigate('/study-contents')}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white border border-amber-200 fluid-rounded-lg fluid-text-sm text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <BookOpen className="fluid-icon-sm" />
                {summary?.materials.draft} material{(summary?.materials.draft || 0) !== 1 ? 'es' : ''} en borrador
                <ChevronRight className="fluid-icon-sm" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorDashboard
