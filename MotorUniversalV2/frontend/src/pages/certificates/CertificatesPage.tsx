import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, BadgeCheck, Download, Eye, Search, Calendar, CheckCircle, Clock, ExternalLink, Award } from 'lucide-react'
import { dashboardService } from '../../services/dashboardService'
import LoadingSpinner from '../../components/LoadingSpinner'
  
interface DashboardData {
  user: any
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

const CertificatesPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('evaluation-report')
  const [searchTerm, setSearchTerm] = useState('')

  // Obtener datos del dashboard
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getDashboard()
  })

  const tabs = [
    {
      id: 'evaluation-report' as TabType,
      name: 'Reporte de Evaluación',
      icon: null,
      iconImage: '/images/evaluaasi-icon.png',
      description: 'Constancia con el detalle de tus evaluaciones realizadas'
    },
    {
      id: 'approval-certificate' as TabType,
      name: 'Constancia de Evaluación',
      icon: null,
      iconImage: '/images/eduit-logo.png',
      description: 'Certificado de evaluación de exámenes'
    },
    {
      id: 'digital-badge' as TabType,
      name: 'Insignia Digital',
      icon: null,
      iconImage: '/images/evaluaasi-old.png',
      description: 'Insignias digitales verificables'
    },
    {
      id: 'conocer-certificate' as TabType,
      name: 'Certificado CONOCER',
      icon: null,
      iconImage: '/images/conocer-icon.png',
      description: 'Certificados emitidos por CONOCER México'
    }
  ]

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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Certificados y Constancias</h1>
            <p className="text-primary-100 mt-1">
              Consulta y descarga tus documentos de acreditación
            </p>
          </div>
        </div>

        {/* Stats - 4 tipos de certificados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <button 
            onClick={() => setActiveTab('evaluation-report')}
            className={`bg-white/10 rounded-xl p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'evaluation-report' ? 'ring-2 ring-white/50' : ''}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <img 
                src="/images/evaluaasi-icon.png" 
                alt="Reporte de Evaluación" 
                className="w-8 h-8 object-contain brightness-0 invert"
              />
              <div className="text-2xl font-bold">{dashboardData?.exams?.filter(e => e.user_stats.attempts > 0).length || 0}</div>
            </div>
            <div className="text-primary-200 text-sm">Reportes de Evaluación</div>
          </button>
          <button 
            onClick={() => setActiveTab('approval-certificate')}
            className={`bg-white/10 rounded-xl p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'approval-certificate' ? 'ring-2 ring-white/50' : ''}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <img 
                src="/images/eduit-logo.png" 
                alt="Constancia de Evaluación" 
                className="w-8 h-8 object-contain brightness-0 invert"
              />
              <div className="text-2xl font-bold">{dashboardData?.stats.approved_exams || 0}</div>
            </div>
            <div className="text-primary-200 text-sm">Constancias de Evaluación</div>
          </button>
          <button 
            onClick={() => setActiveTab('digital-badge')}
            className={`bg-white/10 rounded-xl p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'digital-badge' ? 'ring-2 ring-white/50' : ''}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <img 
                src="/images/evaluaasi-old.png" 
                alt="Insignia Digital" 
                className="w-8 h-8 object-contain brightness-0 invert"
              />
              <div className="text-2xl font-bold">{dashboardData?.stats.approved_exams || 0}</div>
            </div>
            <div className="text-primary-200 text-sm">Insignias Digitales</div>
          </button>
          <button 
            onClick={() => setActiveTab('conocer-certificate')}
            className={`bg-white/10 rounded-xl p-4 text-left transition-all hover:bg-white/20 ${activeTab === 'conocer-certificate' ? 'ring-2 ring-white/50' : ''}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <img 
                src="/images/conocer-icon.png" 
                alt="Certificado CONOCER" 
                className="w-8 h-8 object-contain brightness-0 invert"
              />
              <div className="text-2xl font-bold">{dashboardData?.stats.approved_exams || 0}</div>
            </div>
            <div className="text-primary-200 text-sm">Certificados CONOCER</div>
          </button>
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
                  className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600 bg-primary-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.iconImage && (
                    <div className="w-6 h-6 rounded flex items-center justify-center">
                      <img 
                        src={tab.iconImage} 
                        alt={tab.name} 
                        className={`w-5 h-5 object-contain ${
                          activeTab !== tab.id ? 'grayscale opacity-60' : ''
                        }`}
                        style={activeTab === tab.id && (tab.id === 'evaluation-report' || tab.id === 'approval-certificate' || tab.id === 'digital-badge') ? { 
                          filter: 'saturate(1.5) brightness(0.85)' 
                        } : undefined}
                      />
                    </div>
                  )}
                  <span className="whitespace-nowrap">{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar documento de acreditación..."
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

// Sección de Constancia de Evaluación
const ApprovalCertificateSection = ({ exams, formatDate }: { exams: any[], formatDate: (date: string) => string }) => {
  const navigate = useNavigate()
  
  if (exams.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Sin constancias de evaluación</h3>
        <p className="text-gray-500">Aprueba un examen para obtener tu constancia.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {exams.map((exam) => (
        <div
          key={exam.id}
          className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 relative overflow-hidden cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate(`/certificates/evaluation-report/${exam.id}`)}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-200/30 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                <img 
                  src="/images/eduit-logo.png" 
                  alt="Constancia" 
                  className="w-8 h-8 object-contain brightness-0 invert"
                />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Constancia de Evaluación</h3>
                <p className="text-sm text-green-600">Verificable digitalmente</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <h4 className="text-lg font-semibold text-gray-900">{exam.name}</h4>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-medium">
                  Calificación: {exam.user_stats.best_score}%
                </span>
              </div>
              {exam.user_stats.last_attempt && (
                <p className="text-sm text-gray-600">
                  Fecha de aprobación: {formatDate(exam.user_stats.last_attempt.end_date || exam.user_stats.last_attempt.start_date)}
                </p>
              )}
              {exam.user_stats.last_attempt?.certificate_code && (
                <p className="text-xs text-gray-500 font-mono">
                  Código: {exam.user_stats.last_attempt.certificate_code}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(`/certificates/evaluation-report/${exam.id}`) }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Ver Constancias
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

// Sección de Certificados CONOCER
const ConocerCertificateSection = ({ exams, formatDate }: { exams: any[], formatDate: (date: string) => string }) => {
  const [searchCode, setSearchCode] = useState('')
  
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

      {/* Search Certificate */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Consultar Certificado</h4>
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Ingresa tu código de certificado o CURP"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium">
            Buscar
          </button>
        </div>
      </div>

      {/* Certificates List */}
      {exams.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-gray-100 p-2">
            <img 
              src="/images/conocer-logo.png" 
              alt="CONOCER Logo" 
              className="w-full h-full object-contain opacity-50"
            />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin certificados CONOCER</h3>
          <p className="text-gray-500 mb-4">
            Los certificados CONOCER se emiten después de completar el proceso de evaluación oficial.
          </p>
          <a 
            href="https://conocer.gob.mx" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-800 font-medium"
          >
            Conocer más sobre la certificación
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
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
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{exam.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Estándar de Competencia: EC0XXX
                    </p>
                    
                    {exam.user_stats.last_attempt && (
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Emisión: {formatDate(exam.user_stats.last_attempt.end_date || exam.user_stats.last_attempt.start_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Vigente
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    <Download className="w-4 h-4" />
                    Descargar
                  </button>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                    <Eye className="w-4 h-4" />
                    Verificar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Process Info */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h4 className="font-semibold text-gray-900 mb-4">¿Cómo obtener un certificado CONOCER?</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              1
            </div>
            <p className="text-sm text-gray-600">Selecciona el estándar de competencia</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              2
            </div>
            <p className="text-sm text-gray-600">Contacta un centro evaluador autorizado</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              3
            </div>
            <p className="text-sm text-gray-600">Realiza la evaluación presencial</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
              4
            </div>
            <p className="text-sm text-gray-600">Recibe tu certificado oficial</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CertificatesPage
