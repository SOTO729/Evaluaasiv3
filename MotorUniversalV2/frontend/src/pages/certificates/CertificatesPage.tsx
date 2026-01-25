import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, BadgeCheck, Download, Eye, Search, Calendar, CheckCircle, Clock, ExternalLink, Award, ChevronRight } from 'lucide-react'
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
  const [tabKey, setTabKey] = useState(0) // Para forzar re-render y animaciones al cambiar tab
  const [isLoadingContent, setIsLoadingContent] = useState(false) // Para simular carga al cambiar tab

  // Obtener datos del dashboard
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getDashboard()
  })

  // Handler para cambiar tab con animación y loading
  const handleTabChange = (tabId: TabType) => {
    if (tabId !== activeTab) {
      setIsLoadingContent(true)
      setActiveTab(tabId)
      setTabKey(prev => prev + 1) // Fuerza re-render para animaciones
      // Simular pequeña carga para transición suave
      setTimeout(() => setIsLoadingContent(false), 300)
    }
  }

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
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in max-w-[1920px] 3xl:max-w-[2400px] 4xl:max-w-[2800px] mx-auto">
      {/* Header - Estilo simple como otras páginas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 lg:gap-6 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8 text-primary-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl font-bold text-gray-900">Mis Certificados</h1>
            <p className="text-gray-500 text-sm lg:text-base xl:text-lg 2xl:text-xl mt-0.5 lg:mt-1">
              Consulta y descarga tus documentos
            </p>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative w-full sm:w-72 lg:w-80 xl:w-96">
          <Search className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar certificado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 lg:pl-12 pr-4 py-2.5 lg:py-3 xl:py-4 border border-gray-200 rounded-xl lg:rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm lg:text-base xl:text-lg bg-white shadow-sm transition-shadow hover:shadow-md"
          />
        </div>
      </div>

      {/* Tabs como tarjetas seleccionables */}
      <div className={`grid gap-3 lg:gap-4 xl:gap-5 ${tabs.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : tabs.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id
          const count = tab.id === 'evaluation-report' 
            ? dashboardData?.exams?.filter(e => e.user_stats.attempts > 0).length || 0
            : dashboardData?.stats.approved_exams || 0
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex items-center gap-3 lg:gap-4 p-3 sm:p-4 lg:p-5 xl:p-6 rounded-xl lg:rounded-2xl border-2 transition-all duration-300 text-left animate-stagger-in group ${
                isActive
                  ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-white shadow-md scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
              }`}
              style={{ animationDelay: `${index * 75}ms` }}
            >
              {/* Decoración sutil en esquina */}
              {isActive && (
                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-primary-100/50 to-transparent rounded-tr-xl rounded-bl-3xl" />
              )}
              
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                isActive ? 'bg-primary-100 shadow-sm' : 'bg-gray-100 group-hover:bg-gray-200'
              }`}>
                <img 
                  src={tab.iconImage} 
                  alt={tab.name} 
                  className={`w-6 h-6 sm:w-7 sm:h-7 object-contain transition-all duration-300 ${!isActive ? 'grayscale opacity-60 group-hover:opacity-80' : ''}`}
                />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm truncate transition-colors ${isActive ? 'text-primary-700' : 'text-gray-700 group-hover:text-gray-900'}`}>
                    {tab.name}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold transition-all ${
                    isActive ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-200 text-gray-600 group-hover:bg-gray-300'
                  }`}>
                    {count}
                  </span>
                </div>
                <p className={`text-xs mt-0.5 truncate transition-colors hidden sm:block ${isActive ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-600'}`}>
                  {tab.description}
                </p>
              </div>
              <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                isActive ? 'text-primary-500 translate-x-0 opacity-100' : 'text-gray-300 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-50'
              }`} />
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div 
        key={tabKey}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 animate-fade-in-up relative overflow-hidden"
        style={{ animationDelay: '150ms' }}
      >
        {/* Decoración de fondo sutil */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary-50/30 to-transparent rounded-bl-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-gray-50/50 to-transparent rounded-tr-full pointer-events-none" />
        
        {/* Content based on active tab */}
        <div className="relative z-10">
          {isLoadingContent ? (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <LoadingSpinner message="Cargando..." />
            </div>
          ) : (
            <>
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
            </>
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
      <div className="text-center py-12 animate-fade-in">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin evaluaciones</h3>
        <p className="text-gray-500">Aún no has realizado ninguna evaluación.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {exams.map((exam, index) => (
        <div
          key={exam.id}
          onClick={() => navigate(`/certificates/evaluation-report/${exam.id}`)}
          className="border border-gray-200 rounded-xl p-4 sm:p-6 hover:border-primary-400 hover:shadow-lg hover:bg-primary-50/30 transition-all duration-300 cursor-pointer animate-stagger-in group bg-gradient-to-r from-white to-gray-50/50"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 sm:block">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{exam.name}</h3>
                {/* Badge de estado - visible en móvil aquí, en desktop a la derecha */}
                <span className={`sm:hidden px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                  exam.user_stats.is_approved 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {exam.user_stats.is_approved ? 'Aprobado' : 'En proceso'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{exam.description}</p>
              
              <div className="flex flex-wrap gap-3 sm:gap-4 mt-4">
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

            {/* Sección derecha: Badge + Ver reporte (solo desktop) */}
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                exam.user_stats.is_approved 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {exam.user_stats.is_approved ? 'Aprobado' : 'En proceso'}
              </span>
              
              {/* Separador y Ver reporte */}
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
                <span className="text-xs text-primary-600 font-medium whitespace-nowrap">Ver reporte</span>
                <ChevronRight className="w-4 h-4 text-primary-500" />
              </div>
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
    
    // Log inicio de descarga de certificado
    console.log('🎓 [CERTIFICADO] Iniciando descarga de certificado')
    console.log('🎓 [CERTIFICADO] Result ID:', resultId)
    console.log('🎓 [CERTIFICADO] Examen:', exam.name)
    console.log('🎓 [CERTIFICADO] Timestamp:', new Date().toISOString())
    
    setDownloadingId(exam.id)
    
    try {
      // Usar la URL correcta del API (ya incluye /api)
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
      
      console.log('🎓 [CERTIFICADO] Llamando a:', `${apiUrl}/exams/results/${resultId}/generate-certificate`)
      
      const startTime = performance.now()
      const response = await fetch(`${apiUrl}/exams/results/${resultId}/generate-certificate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })   
      const endTime = performance.now()
      
      console.log('🎓 [CERTIFICADO] Respuesta en:', Math.round(endTime - startTime), 'ms')
      console.log('🎓 [CERTIFICADO] Status:', response.status)
      
      if (!response.ok) {
        const error = await response.json()
        console.error('❌ [CERTIFICADO] Error:', error)
        throw new Error(error.message || 'Error al generar el certificado')
      }
      
      // Descargar el PDF
      const blob = await response.blob()
      console.log('🎓 [CERTIFICADO] Tamaño del archivo:', (blob.size / 1024).toFixed(2), 'KB')
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = `Certificado_${exam.name.replace(/\s+/g, '_')}.pdf`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('✅ [CERTIFICADO] Descarga completada:', filename)
    } catch (error: any) {
      console.error('❌ [CERTIFICADO] Error descargando certificado:', error)
      alert(error.message || 'Error al descargar el certificado')
    } finally {
      setDownloadingId(null)
    }
  }
  
  if (exams.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin certificados disponibles</h3>
        <p className="text-gray-500 mb-2">Para obtener tu certificado de evaluación, primero debes aprobar un examen.</p>
        <p className="text-sm text-gray-400">Completa alguna de las evaluaciones asignadas con el puntaje mínimo requerido.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {exams.map((exam, index) => (
        <div
          key={exam.id}
          className="border border-green-200 bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 rounded-xl p-4 sm:p-6 hover:border-green-400 hover:shadow-lg transition-all duration-300 animate-stagger-in group relative overflow-hidden"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Decoración sutil */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-green-100/50 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 relative z-10">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">{exam.name}</h3>
                  <p className="text-sm text-green-600 font-medium">Examen Aprobado</p>
                </div>
              </div> 
              <p className="text-sm text-gray-500 mt-1 ml-0 sm:ml-13 line-clamp-2">{exam.description}</p>
              
              <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 ml-0 sm:ml-13">
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

            <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-4 flex-shrink-0">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 group-hover:bg-green-200 transition-colors">
                Certificado disponible
              </span>
              <button 
                onClick={(e) => handleDownloadCertificate(e, exam)}
                disabled={downloadingId === exam.id}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:scale-105 active:scale-95"
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
      <div className="text-center py-12 animate-fade-in">
        <BadgeCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin insignias digitales</h3>
        <p className="text-gray-500">Aprueba un examen para obtener tu insignia digital.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {exams.map((exam, index) => (
        <div
          key={exam.id}
          className="bg-white border-2 border-gray-200 rounded-2xl p-4 sm:p-6 text-center hover:border-primary-300 hover:shadow-xl transition-all duration-300 group animate-stagger-in relative overflow-hidden"
          style={{ animationDelay: `${index * 75}ms` }}
        >
          {/* Decoración de fondo */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 via-transparent to-primary-100/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          {/* Badge Visual */}
          <div className="relative mx-auto w-28 h-28 sm:w-32 sm:h-32 mb-4 z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full animate-pulse group-hover:animate-none group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center shadow-inner">
              <div className="w-full h-full bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center group-hover:from-primary-600 group-hover:to-primary-800 transition-all duration-300">
                <BadgeCheck className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
            </div>
            {/* Stars decoration */}
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
              <span className="text-white text-xs">★</span>
            </div>
          </div>

          <h3 className="font-bold text-gray-900 mb-1 relative z-10 group-hover:text-primary-700 transition-colors">{exam.name}</h3>
          <p className="text-sm text-gray-500 mb-2 relative z-10">Insignia de Competencia</p>
          
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4 relative z-10 group-hover:bg-green-200 transition-colors">
            <CheckCircle className="w-4 h-4" />
            Verificada
          </div>

          {exam.user_stats.last_attempt && (
            <p className="text-xs text-gray-400 mb-4 relative z-10">
              Obtenida: {formatDate(exam.user_stats.last_attempt.end_date || exam.user_stats.last_attempt.start_date)}
            </p>
          )}
          <div className="flex gap-2 relative z-10">   
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95">
              <Download className="w-4 h-4" /> 
              Descargar
            </button>        
            <button className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 hover:scale-105 active:scale-95">
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 animate-fade-in">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 text-center">
        Proceso de Certificación CONOCER
      </h3>
      
      {/* Timeline */}
      <div className="relative">
        {/* Línea conectora - visible solo en desktop */}
        <div className="absolute left-6 sm:left-8 top-8 bottom-8 w-0.5 bg-gray-200 hidden md:block" />
        
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          {steps.map((step) => {
            const isCompleted = step.id < currentStep
            const isCurrent = step.id === currentStep
            const isPending = step.id > currentStep
            const StepIcon = step.icon
            
            return (
              <div key={step.id} className="relative flex flex-row gap-3 sm:gap-4">
                {/* Círculo del paso */}
                <div className={`
                  relative z-10 flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${isCompleted 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-200' 
                    : isCurrent 
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 ring-2 sm:ring-4 ring-blue-100 animate-pulse' 
                      : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                  ) : (
                    <StepIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                  )}
                </div>
                
                {/* Contenido del paso */}
                <div className={`flex-1 pb-3 sm:pb-4 md:pb-0 ${isPending ? 'opacity-50' : ''}`}>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                    <span className={`text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
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
                  
                  <h4 className={`text-sm sm:text-base font-semibold mb-1 ${
                    isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </h4>
                  
                  <p className="text-xs sm:text-sm text-gray-500 mb-2">
                    {step.description}
                  </p>
                  
                  {isCurrent && (
                    <div className={`mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg ${
                      currentStep === 1 
                        ? 'bg-yellow-50 border border-yellow-200' 
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <p className={`text-xs sm:text-sm font-medium ${
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
      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
        <div className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
          <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="mb-2">
              El proceso de certificación CONOCER es gestionado por el Consejo Nacional de Normalización 
              y Certificación de Competencias Laborales del Gobierno de México.
            </p>
            <a 
              href="https://conocer.gob.mx" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center gap-1"
            >
              Más información en conocer.gob.mx
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
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
        const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
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
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
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
      <div className="flex flex-col items-center justify-center py-12 sm:py-16">
        <LoadingSpinner message="Cargando certificados CONOCER..." />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white shadow-sm">
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
              className="border-2 border-gray-200 rounded-xl p-4 sm:p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-300 animate-stagger-in"
              style={{ animationDelay: `${exams.indexOf(exams[0]) * 50}ms` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-100 flex-shrink-0">
                    <img 
                      src="/images/conocer-logo.png" 
                      alt="CONOCER Logo" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        CONOCER
                      </span>
                      <span className="text-xs text-gray-500 hidden sm:inline">•</span>
                      <span className="text-xs text-gray-500 hidden sm:inline">Competencia Laboral</span>
                      {cert.competency_level && (
                        <>
                          <span className="text-xs text-gray-500 hidden sm:inline">•</span>
                          <span className="text-xs text-gray-500">Nivel {cert.competency_level}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 line-clamp-2">{cert.standard_name}</h3>
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

                <div className="flex flex-col gap-2 mt-4 sm:mt-0">
                  <button 
                    onClick={() => handleDownloadCertificate(cert)}
                    disabled={downloadingId === cert.id}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm disabled:opacity-50 hover:shadow-md active:scale-95"
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
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6 animate-fade-in">
        <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4 text-center">¿Cómo obtener un certificado CONOCER?</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm sm:text-base">
              1
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Selecciona el estándar</p>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Elige el estándar de competencia que deseas certificar</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm sm:text-base">
              2
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Estudia</p>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Prepárate con los materiales de estudio disponibles</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm sm:text-base">
              3
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Certifícate</p>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Realiza tu evaluación en Evaluaasi y aprueba</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-sm sm:text-base">
              4
            </div>
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">Recibe tu certificado</p>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">Espera el trámite y recibe tu certificado oficial</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CertificatesPage
