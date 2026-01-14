import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, BadgeCheck, Download, Eye, Search, Calendar, CheckCircle, Clock, ExternalLink, Award } from 'lucide-react'
import { dashboardService } from '../../services/dashboardService'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'
 
interface DashboardData {
  user: {
    document_options?: {
      evaluation_report: boolean
      certificate: boolean
      conocer_certificate: boolean
      digital_badge: boolean
    }
  }
  stats: {
    total_exams: number
    completed_exams: number
    approved_exams: number
    average_score: number
  }
  exams: Array<{
    id: number
    name: string
    description: string
    passing_score: number
    user_stats: {
      attempts: number
      best_score: number | null
      is_completed: boolean
      is_approved: boolean
      last_attempt: any
    }
  }>
}

type TabType = 'evaluation-report' | 'approval-certificate' | 'digital-badge' | 'conocer-certificate'

interface TabConfig {
  id: TabType
  name: string
  icon: null
  iconImage: string
  description: string
  enableKey: keyof NonNullable<DashboardData['user']['document_options']>
}

const CertificatesPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('evaluation-report')
  const [searchTerm, setSearchTerm] = useState('')

  // Obtener datos del dashboard
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getDashboard()
  })

  // Opciones de documentos del usuario (con defaults)
  const documentOptions = dashboardData?.user?.document_options || {
    evaluation_report: true,
    certificate: false,
    conocer_certificate: false,
    digital_badge: false
  }

  const allTabs: TabConfig[] = [
    {
      id: 'evaluation-report' as TabType,
      name: 'Reporte de Evaluación',
      icon: null,
      iconImage: '/images/evaluaasi-icon.png',
      description: 'Certificado con el detalle de tus evaluaciones realizadas',
      enableKey: 'evaluation_report'
    },
    {
      id: 'approval-certificate' as TabType,
      name: 'Certificado de Evaluación',
      icon: null,
      iconImage: '/images/eduit-logo.png',
      description: 'Certificado de evaluación de exámenes',
      enableKey: 'certificate'
    },
    {
      id: 'digital-badge' as TabType,
      name: 'Insignia Digital',
      icon: null,
      iconImage: '/images/evaluaasi-old.png',
      description: 'Insignias digitales verificables',
      enableKey: 'digital_badge'
    },
    {
      id: 'conocer-certificate' as TabType,
      name: 'Certificado CONOCER',
      icon: null,
      iconImage: '/images/conocer-icon.png',
      description: 'Certificados emitidos por CONOCER México',
      enableKey: 'conocer_certificate'
    }
  ]

  // Filtrar tabs según las opciones habilitadas del usuario
  const tabs = allTabs.filter(tab => documentOptions[tab.enableKey])

  // Asegurarse de que el tab activo sea válido
  useEffect(() => {
    const validTabIds = tabs.map(t => t.id)
    if (!validTabIds.includes(activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  // Filtrar exámenes según el tab activo
  const getFilteredExams = () => {
    if (!dashboardData?.exams) return []
    
    let filtered = dashboardData.exams

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(exam => 
        exam.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtrar según el tab
    switch (activeTab) {
      case 'evaluation-report':
        // Mostrar todos los exámenes con intentos
        return filtered.filter(exam => exam.user_stats.attempts > 0)
      case 'approval-certificate':
        // Solo exámenes aprobados
        return filtered.filter(exam => exam.user_stats.is_approved)
      case 'digital-badge':
        // Exámenes aprobados (que tendrían insignia)
        return filtered.filter(exam => exam.user_stats.is_approved)
      case 'conocer-certificate':
        // Por ahora mostrar los aprobados, en el futuro filtrar solo los que tengan certificado CONOCER
        return filtered.filter(exam => exam.user_stats.is_approved)
      default:
        return filtered
    }
  }

  const filteredExams = getFilteredExams()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return <LoadingSpinner message="Cargando certificados..." fullScreen />
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-8 text-white">
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold">Certificados</h1>
            <p className="text-primary-100 mt-1 text-sm sm:text-base">
              Consulta y descarga tus documentos
            </p>
          </div>
        </div>

        {/* Stats - Solo mostrar tipos de documentos habilitados */}
        <div className={`grid gap-2 sm:gap-4 mt-4 sm:mt-6 ${tabs.length <= 2 ? 'grid-cols-2' : tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          {documentOptions.evaluation_report && (
            <button 
              onClick={() => setActiveTab('evaluation-report')}
              className={`bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'evaluation-report' ? 'ring-2 ring-white/50' : ''}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <img 
                  src="/images/evaluaasi-icon.png" 
                  alt="Reporte" 
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain brightness-0 invert"
                />
                <div className="text-xl sm:text-2xl font-bold">{dashboardData?.exams?.filter(e => e.user_stats.attempts > 0).length || 0}</div>
              </div>
              <div className="text-primary-200 text-xs sm:text-sm truncate">Reportes</div>
            </button>
          )}
          {documentOptions.certificate && (
            <button 
              onClick={() => setActiveTab('approval-certificate')}
              className={`bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'approval-certificate' ? 'ring-2 ring-white/50' : ''}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <img 
                  src="/images/eduit-logo.png" 
                  alt="Certificado" 
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain brightness-0 invert"
                />
                <div className="text-xl sm:text-2xl font-bold">{dashboardData?.stats.approved_exams || 0}</div>
              </div>
              <div className="text-primary-200 text-xs sm:text-sm truncate">Certificados</div>
            </button>
          )}
          {documentOptions.digital_badge && (
            <button 
              onClick={() => setActiveTab('digital-badge')}
              className={`bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'digital-badge' ? 'ring-2 ring-white/50' : ''}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <img 
                  src="/images/evaluaasi-old.png" 
                  alt="Insignia" 
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain brightness-0 invert"
                />
                <div className="text-xl sm:text-2xl font-bold">{dashboardData?.stats.approved_exams || 0}</div>
              </div>
              <div className="text-primary-200 text-xs sm:text-sm truncate">Insignias</div>
            </button>
          )}
          {documentOptions.conocer_certificate && (
            <button 
              onClick={() => setActiveTab('conocer-certificate')}
              className={`bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'conocer-certificate' ? 'ring-2 ring-white/50' : ''}`}
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                <img 
                  src="/images/conocer-icon.png" 
                  alt="CONOCER" 
                  className="w-6 h-6 sm:w-8 sm:h-8 object-contain brightness-0 invert"
                />
                <div className="text-xl sm:text-2xl font-bold">{dashboardData?.stats.approved_exams || 0}</div>
              </div>
              <div className="text-primary-200 text-xs sm:text-sm truncate">CONOCER</div>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-[120px] sm:min-w-[160px] flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600 bg-primary-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.iconImage && (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center flex-shrink-0">
                      <img 
                        src={tab.iconImage} 
                        alt={tab.name} 
                        className={`w-4 h-4 sm:w-5 sm:h-5 object-contain ${
                          activeTab !== tab.id ? 'grayscale opacity-60' : ''
                        }`}
                        style={activeTab === tab.id && (tab.id === 'evaluation-report' || tab.id === 'approval-certificate' || tab.id === 'digital-badge') ? { 
                          filter: 'saturate(1.5) brightness(0.85)' 
                        } : undefined}
                      />
                    </div>
                  )}
                  <span className="whitespace-nowrap truncate">{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {/* Search */}
          <div className="mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Tab Description */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-gray-600">
              {tabs.find(t => t.id === activeTab)?.description}
            </p>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'evaluation-report' && (
            <EvaluationReportSection exams={filteredExams} formatDate={formatDate} />
          )}
          
          {activeTab === 'approval-certificate' && (
            <ApprovalCertificateSection exams={filteredExams} formatDate={formatDate} />
          )}
          
          {activeTab === 'digital-badge' && (
            <DigitalBadgeSection exams={filteredExams} formatDate={formatDate} />
          )}
          
          {activeTab === 'conocer-certificate' && (
            <ConocerCertificateSection exams={filteredExams} formatDate={formatDate} />
          )}
        </div>
      </div>
    </div>
  )
}

// Sección de Reporte de Evaluación
import { useNavigate } from 'react-router-dom'

const EvaluationReportSection = ({ exams, formatDate }: { exams: any[], formatDate: (date: string) => string }) => {
  const navigate = useNavigate()
  
  if (exams.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin evaluaciones</h3>
        <p className="text-gray-500">Aún no has realizado ninguna evaluación.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {exams.map((exam) => (
        <div
          key={exam.id}
          onClick={() => navigate(`/certificates/evaluation-report/${exam.id}`)}
          className="border border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{exam.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{exam.description}</p>
              
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{exam.user_stats.attempts} intentos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    Mejor puntaje: {exam.user_stats.best_score !== null ? `${exam.user_stats.best_score}%` : 'N/A'}
                  </span>
                </div>
                {exam.user_stats.last_attempt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Último: {formatDate(exam.user_stats.last_attempt.start_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                exam.user_stats.is_approved 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {exam.user_stats.is_approved ? 'Aprobado' : 'En proceso'}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(`/certificates/evaluation-report/${exam.id}`) }}
                className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                title="Ver reportes"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sección de Certificado de Evaluación
const ApprovalCertificateSection = ({ exams, formatDate }: { exams: any[], formatDate: (date: string) => string }) => {
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const { accessToken } = useAuthStore()
  
  const handleDownloadCertificate = async (e: React.MouseEvent, exam: any) => {
    e.stopPropagation()
    
    // Obtener el ID del resultado aprobado
    const resultId = exam.user_stats.approved_result?.id || exam.user_stats.last_attempt?.id
    if (!resultId) {
      alert('No se encontró el resultado para generar el certificado')
      return
    }
    
    setDownloadingId(exam.id)
    
    try {
      // Usar la URL correcta del API (ya incluye /api)
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.azurewebsites.net/api'
      
      const response = await fetch(`${apiUrl}/exams/results/${resultId}/generate-certificate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })   
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al generar el certificado')
      }
      
      // Descargar el PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Certificado_${exam.name.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Error descargando certificado:', error)
      alert(error.message || 'Error al descargar el certificado')
    } finally {
      setDownloadingId(null)
    }
  }
  
  if (exams.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin certificados disponibles</h3>
        <p className="text-gray-500 mb-2">Para obtener tu certificado de evaluación, primero debes aprobar un examen.</p>
        <p className="text-sm text-gray-400">Completa alguna de las evaluaciones asignadas con el puntaje mínimo requerido.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {exams.map((exam) => (
        <div
          key={exam.id}
          className="border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 hover:border-green-400 hover:shadow-md transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{exam.name}</h3>
                  <p className="text-sm text-green-600 font-medium">Examen Aprobado</p>
                </div>
              </div> 
              <p className="text-sm text-gray-500 mt-1 ml-13">{exam.description}</p>
              
              <div className="flex flex-wrap gap-4 mt-4 ml-13">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-600">
                    Calificación: <strong className="text-green-600">{exam.user_stats.best_score}%</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{exam.user_stats.attempts} intentos</span>
                </div>
                {(exam.user_stats.approved_result || exam.user_stats.last_attempt) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Aprobado: {formatDate((exam.user_stats.approved_result || exam.user_stats.last_attempt).end_date || (exam.user_stats.approved_result || exam.user_stats.last_attempt).start_date)}
                    </span>
                  </div>
                )}
                {(exam.user_stats.approved_result?.certificate_code || exam.user_stats.last_attempt?.certificate_code) && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Código: <code className="bg-white px-2 py-0.5 rounded text-xs font-mono">{exam.user_stats.approved_result?.certificate_code || exam.user_stats.last_attempt?.certificate_code}</code>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 ml-4">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Certificado disponible
              </span>
              <button 
                onClick={(e) => handleDownloadCertificate(e, exam)}
                disabled={downloadingId === exam.id}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Descargar certificado"
              >
                {downloadingId === exam.id ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Descargar Certificado
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sección de Insignias Digitales
const DigitalBadgeSection = ({ exams, formatDate }: { exams: any[], formatDate: (date: string) => string }) => {
  if (exams.length === 0) {
    return (
      <div className="text-center py-12">
        <BadgeCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin insignias digitales</h3>
        <p className="text-gray-500">Aprueba un examen para obtener tu insignia digital.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {exams.map((exam) => (
        <div
          key={exam.id}
          className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center hover:border-primary-300 hover:shadow-lg transition-all group"
        >
          {/* Badge Visual */}
          <div className="relative mx-auto w-32 h-32 mb-4">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full animate-pulse group-hover:animate-none" />
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                <BadgeCheck className="w-12 h-12 text-white" />
              </div>
            </div>
            {/* Stars decoration */}
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">★</span>
            </div>
          </div>

          <h3 className="font-bold text-gray-900 mb-1">{exam.name}</h3>
          <p className="text-sm text-gray-500 mb-2">Insignia de Competencia</p>
          
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
            <CheckCircle className="w-4 h-4" />
            Verificada
          </div>

          {exam.user_stats.last_attempt && (
            <p className="text-xs text-gray-400 mb-4">
              Obtenida: {formatDate(exam.user_stats.last_attempt.end_date || exam.user_stats.last_attempt.start_date)}
            </p>
          )}
          <div className="flex gap-2">   
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors">
              <Download className="w-4 h-4" /> 
              Descargar
            </button>        
            <button className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
} 

// Componente de Línea del Tiempo para Certificado CONOCER
const ConocerTimeline = ({ currentStep, approvedExamsCount }: { currentStep: 1 | 2 | 3, approvedExamsCount: number }) => {
  const steps = [
    {
      id: 1,
      title: 'Aprobar Evaluación',
      description: 'Debes aprobar al menos una evaluación en la plataforma para iniciar el proceso de certificación CONOCER.',
      icon: CheckCircle,
      activeMessage: 'Completa y aprueba una evaluación para continuar con el proceso.'
    },
    {
      id: 2,
      title: 'Trámite en Proceso',
      description: 'Una vez aprobada la evaluación, se inicia el trámite oficial ante CONOCER. Este proceso puede tomar varias semanas.',
      icon: Clock,
      activeMessage: `¡Felicidades! Has aprobado ${approvedExamsCount} evaluación(es). Tu trámite de certificación está siendo procesado.`
    },
    {
      id: 3,
      title: 'Certificado Disponible',
      description: 'Cuando el trámite concluya, podrás consultar y descargar tu certificado CONOCER oficial.',
      icon: Award,
      activeMessage: 'Tu certificado CONOCER está listo para consultar y descargar.'
    }
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
        Proceso de Certificación CONOCER
      </h3>
      
      {/* Timeline */}
      <div className="relative">
        {/* Línea conectora */}
        <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gray-200 hidden md:block" />
        
        <div className="space-y-6 md:space-y-8">
          {steps.map((step) => {
            const isCompleted = step.id < currentStep
            const isCurrent = step.id === currentStep
            const isPending = step.id > currentStep
            const StepIcon = step.icon
            
            return (
              <div key={step.id} className="relative flex flex-col md:flex-row gap-4">
                {/* Círculo del paso */}
                <div className={`
                  relative z-10 flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${isCompleted 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                    : isCurrent 
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 ring-4 ring-blue-100 animate-pulse' 
                      : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-8 h-8" />
                  ) : (
                    <StepIcon className="w-8 h-8" />
                  )}
                </div>
                
                {/* Contenido del paso */}
                <div className={`flex-1 pb-4 md:pb-0 ${isPending ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isCompleted 
                        ? 'bg-green-100 text-green-700' 
                        : isCurrent 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      Paso {step.id}
                    </span>
                    {isCompleted && (
                      <span className="text-xs text-green-600 font-medium">✓ Completado</span>
                    )}
                    {isCurrent && (
                      <span className="text-xs text-blue-600 font-medium">● En progreso</span>
                    )}
                  </div>
                  
                  <h4 className={`font-semibold mb-1 ${
                    isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </h4>
                  
                  <p className="text-sm text-gray-500 mb-2">
                    {step.description}
                  </p>
                  
                  {isCurrent && (
                    <div className={`mt-3 p-3 rounded-lg ${
                      currentStep === 1 
                        ? 'bg-yellow-50 border border-yellow-200' 
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <p className={`text-sm font-medium ${
                        currentStep === 1 ? 'text-yellow-800' : 'text-blue-800'
                      }`}>
                        {step.activeMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Información adicional */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-start gap-3 text-sm text-gray-500">
          <ExternalLink className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="mb-2">
              El proceso de certificación CONOCER es gestionado por el Consejo Nacional de Normalización 
              y Certificación de Competencias Laborales del Gobierno de México.
            </p>
            <a 
              href="https://conocer.gob.mx" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-800 font-medium"
            >
              Más información en conocer.gob.mx →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
 
// Sección de Certificados CONOCER
const ConocerCertificateSection = ({ exams, formatDate }: { exams: any[], formatDate: (date: string) => string }) => {
  const [certificates, setCertificates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [rehydratingId, setRehydratingId] = useState<number | null>(null)
  const { accessToken } = useAuthStore()
  
  // Verificar si el usuario tiene al menos un examen aprobado
  const hasApprovedExams = exams.some(exam => exam.user_stats.is_approved)
  
  // Cargar certificados CONOCER del usuario
  useEffect(() => {
    const fetchCertificates = async () => {
      // Solo cargar certificados si hay exámenes aprobados
      if (!hasApprovedExams) {
        setIsLoading(false)
        return
      }
      
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.azurewebsites.net/api'
        const response = await fetch(`${apiUrl}/conocer/certificates`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })  
        
        if (response.ok) {
          const data = await response.json()
          setCertificates(data.certificates || [])
        }
      } catch (error) {
        console.error('Error cargando certificados CONOCER:', error)
      } finally {
        setIsLoading(false)
      }
    } 
    
    if (accessToken) {
      fetchCertificates()
    }
  }, [accessToken, hasApprovedExams])
  
  const handleDownloadCertificate = async (certificate: any) => {
    setDownloadingId(certificate.id)
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.azurewebsites.net/api'
      const response = await fetch(`${apiUrl}/conocer/certificates/${certificate.id}/download`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (response.status === 202) {
        // Certificado en Archive, necesita rehidratación
        const data = await response.json()
        setRehydratingId(certificate.id)
        alert(data.message || 'El certificado está siendo recuperado. Estará disponible en aproximadamente 15 horas.')
        return
      }
      
      if (!response.ok) {
        throw new Error('Error al descargar el certificado')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CONOCER_${certificate.standard_code}_${certificate.certificate_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Error descargando certificado:', error)
      alert(error.message || 'Error al descargar el certificado')
    } finally {
      setDownloadingId(null)
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600">Cargando certificados...</span>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
            <img 
              src="/images/conocer-logo.png" 
              alt="CONOCER Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-2">Certificados CONOCER México</h3>
            <p className="text-blue-700 text-sm mb-4">
              El Consejo Nacional de Normalización y Certificación de Competencias Laborales (CONOCER) 
              es una entidad del Gobierno Federal que certifica las habilidades y conocimientos de las personas.
            </p>
            <a 
              href="https://conocer.gob.mx" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Visitar sitio oficial de CONOCER
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Certificates List */}
      {!hasApprovedExams ? (
        <ConocerTimeline currentStep={1} approvedExamsCount={0} />
      ) : certificates.length === 0 ? (
        <ConocerTimeline currentStep={2} approvedExamsCount={exams.filter(e => e.user_stats.is_approved).length} />
      ) : (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="border-2 border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-100">
                    <img 
                      src="/images/conocer-logo.png" 
                      alt="CONOCER Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        CONOCER
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">Competencia Laboral</span>
                      {cert.competency_level && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">Nivel {cert.competency_level}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{cert.standard_name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Estándar de Competencia: {cert.standard_code}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Folio: {cert.certificate_number}
                    </p>   
                    
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Emisión: {formatDate(cert.issue_date)}
                      </span>
                      <span className={`flex items-center gap-1 ${cert.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        <CheckCircle className="w-4 h-4" />
                        {cert.status === 'active' ? 'Vigente' : 'Inactivo'}
                      </span>
                      {cert.evaluation_center_name && (
                        <span className="text-xs text-gray-400">
                          Centro: {cert.evaluation_center_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => handleDownloadCertificate(cert)}
                    disabled={downloadingId === cert.id}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {downloadingId === cert.id ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Descargando...
                      </>
                    ) : rehydratingId === cert.id ? (
                      <>
                        <Clock className="w-4 h-4" />
                        Recuperando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Descargar
                      </>
                    )}
                  </button>
                  {cert.verification_url && (
                    <a
                      href={cert.verification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Verificar
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}          

      {/* Process Info */}
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
        <h4 className="font-semibold text-gray-900 mb-4 text-center">¿Cómo obtener un certificado CONOCER?</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              1
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Selecciona el estándar</p>
            <p className="text-xs text-gray-500">Elige el estándar de competencia que deseas certificar</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              2
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Estudia</p>
            <p className="text-xs text-gray-500">Prepárate con los materiales de estudio disponibles</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              3
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Haz el examen y certifícate</p>
            <p className="text-xs text-gray-500">Realiza tu evaluación en Evaluaasi y aprueba</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              4
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Recibe tu certificado</p>
            <p className="text-xs text-gray-500">Espera el trámite y recibe tu certificado oficial</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CertificatesPage
