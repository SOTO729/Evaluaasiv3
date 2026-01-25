import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  ArrowLeft, Download, CheckCircle, XCircle, FileText, 
  Calendar, User, Mail, BookOpen, Hash, Timer,
  BarChart2, AlertCircle, HelpCircle, Puzzle
} from 'lucide-react'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'

// Modal de carga para descarga de PDF
const DownloadModal = ({ isOpen, message }: { isOpen: boolean; message: string }) => {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
        <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Generando documento</h3>
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  )
}

const ResultDetailPage = () => {
  const { examId, resultId } = useParams<{ examId: string; resultId: string }>()
  const navigate = useNavigate()
  const { accessToken, user } = useAuthStore()
  const [downloading, setDownloading] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState('')

  // Obtener datos del examen
  const { data: examData, isLoading: isLoadingExam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      const response = await examService.getExam(Number(examId), true)
      return response
    },
    enabled: !!examId
  })

  // Obtener resultados del usuario para este examen
  const { data: resultsData, isLoading: isLoadingResults } = useQuery({
    queryKey: ['exam-results', examId],
    queryFn: async () => {
      const response = await examService.getMyExamResults(Number(examId))
      return response
    },
    enabled: !!examId
  })

  // Encontrar el resultado específico
  const result = resultsData?.results?.find((r: any) => r.id === resultId)

  const formatDate = (dateString: string) => {
    // Usar toLocaleString para incluir hora y mostrar en zona horaria local del usuario
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Usar zona horaria del equipo
    })
  }

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    return `${minutes}m ${secs}s`
  }

  const downloadPDF = async () => {
    if (!result) return
    
    setDownloading(true)
    setDownloadMessage('Preparando tu certificado de evaluación...')
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
      
      // Obtener zona horaria del equipo del usuario
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      setDownloadMessage('Generando PDF...')
      
      const response = await fetch(`${apiUrl}/exams/results/${result.id}/generate-pdf?timezone=${encodeURIComponent(clientTimezone)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      
      setDownloadMessage('Descargando archivo...')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Certificado_Evaluacion_${examData?.name?.replace(/\s+/g, '_') || 'Examen'}_${result.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (error) {
      console.error('Error descargando PDF:', error)
      alert('Error al descargar el certificado. Por favor intenta de nuevo.')
    } finally {
      setDownloading(false)
      setDownloadMessage('')
    }
  }

  if (isLoadingExam || isLoadingResults) {
    return <LoadingSpinner message="Cargando detalle del resultado..." fullScreen />
  }

  if (!result) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Resultado no encontrado</h3>
        <p className="text-gray-500 mb-4">No se encontró el resultado solicitado.</p>
        <button
          onClick={() => navigate(`/certificates/evaluation-report/${examId}`)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Volver al historial
        </button>
      </div>
    )
  }

  // Extraer información del resultado
  const answersData = result.answers_data || {}
  const summary = answersData.summary || {}
  const evaluationBreakdown = summary.evaluation_breakdown || answersData.evaluation_breakdown || {}
  
  const isPassed = result.result === 1
  const passingScore = examData?.passing_score || 70
  const percentage = summary.percentage || result.score || 0
  const score1000 = Math.round(percentage * 10)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modal de descarga */}
      <DownloadModal isOpen={downloading} message={downloadMessage} />

      {/* Header */}
      <div className={`bg-gradient-to-r ${isPassed ? 'from-green-600 to-emerald-700' : 'from-red-600 to-rose-700'} rounded-fluid-xl fluid-p-6 text-white`}>
        <button
          onClick={() => navigate(`/certificates/evaluation-report/${examId}`)}
          className="flex items-center fluid-gap-2 text-white/80 hover:text-white fluid-mb-4 transition-colors fluid-text-sm"
        >
          <ArrowLeft className="fluid-icon-sm" />
          <span>Volver al historial</span>
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between fluid-gap-6">
          <div className="flex items-center fluid-gap-4">
            <div className={`fluid-w-16 fluid-h-16 ${isPassed ? 'bg-green-500/30' : 'bg-red-500/30'} rounded-fluid-xl flex items-center justify-center flex-shrink-0`}>
              {isPassed ? (
                <CheckCircle className="fluid-icon-xl" />
              ) : (
                <XCircle className="fluid-icon-xl" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="fluid-text-2xl font-bold">
                {isPassed ? 'APROBADO' : 'NO APROBADO'}
              </h1>
              <p className="text-white/80 fluid-mt-1 fluid-text-sm truncate">
                {examData?.name || 'Examen'}
              </p>
              <p className="text-white/60 fluid-text-xs fluid-mt-1">
                {formatDate(result.start_date)}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-white/10 sm:bg-transparent rounded-xl fluid-p-3 sm:p-0">
            <div className="fluid-text-3xl font-bold">{percentage}%</div>
            <div className="text-white/80 fluid-text-sm">{score1000} / 1000 puntos</div>
            <div className="text-white/60 fluid-text-xs">Mínimo: {passingScore * 10} puntos</div>
          </div>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-6">
        {/* Datos del Evaluado */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="fluid-text-base font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <User className="fluid-icon-sm text-primary-600" />
            Datos del Evaluado
          </h2>
          <div className="flex flex-col fluid-gap-3">
            <div className="flex items-start sm:items-center fluid-gap-3 flex-wrap sm:flex-nowrap">
              <User className="fluid-icon-xs text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-gray-600 fluid-text-sm">Nombre:</span>
              <span className="font-medium fluid-text-sm break-all">{user?.name || 'N/A'} {user?.first_surname || ''} {user?.second_surname || ''}</span>
            </div>
            <div className="flex items-start sm:items-center fluid-gap-3 flex-wrap sm:flex-nowrap">
              <Mail className="fluid-icon-xs text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-gray-600 fluid-text-sm">Correo:</span>
              <span className="font-medium fluid-text-sm break-all">{user?.email || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Datos del Examen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="fluid-text-base font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <BookOpen className="fluid-icon-sm text-primary-600" />
            Datos del Examen
          </h2>
          <div className="flex flex-col fluid-gap-3">
            <div className="flex items-start sm:items-center fluid-gap-3 flex-wrap sm:flex-nowrap">
              <FileText className="fluid-icon-xs text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-gray-600 fluid-text-sm">Examen:</span>
              <span className="font-medium fluid-text-sm">{examData?.name || 'N/A'}</span>
            </div>
            <div className="flex items-start sm:items-center fluid-gap-3 flex-wrap sm:flex-nowrap">
              <Hash className="fluid-icon-xs text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-gray-600 fluid-text-sm">Código ECM:</span>
              <span className="font-bold font-mono text-primary-700 fluid-text-sm">{examData?.version || 'N/A'}</span>
            </div>
            <div className="flex items-start sm:items-center fluid-gap-3 flex-wrap sm:flex-nowrap">
              <Calendar className="fluid-icon-xs text-gray-400 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span className="text-gray-600 fluid-text-sm">Fecha:</span>
              <span className="font-medium fluid-text-sm">{formatDate(result.start_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado de la Evaluación */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <h2 className="fluid-text-base font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
          <BarChart2 className="fluid-icon-sm text-primary-600" />
          Resultado de la Evaluación
        </h2>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4">
          <div className="bg-gray-50 rounded-fluid-lg fluid-p-4 text-center">
            <div className="fluid-text-2xl font-bold text-primary-600">{percentage}%</div>
            <div className="fluid-text-xs text-gray-500">Calificación</div>
          </div>
          <div className="bg-gray-50 rounded-fluid-lg fluid-p-4 text-center">
            <div className={`fluid-text-2xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>{score1000}</div>
            <div className="fluid-text-xs text-gray-500">Puntaje / 1000</div>
          </div>
          <div className="bg-gray-50 rounded-fluid-lg fluid-p-4 text-center">
            <div className="fluid-text-2xl font-bold text-gray-600">{passingScore * 10}</div>
            <div className="fluid-text-xs text-gray-500">Puntaje mínimo</div>
          </div>
          <div className="bg-gray-50 rounded-fluid-lg fluid-p-4 text-center">
            <div className={`fluid-text-lg font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
              {isPassed ? 'APROBADO' : 'NO APROBADO'}
            </div>
            <div className="fluid-text-xs text-gray-500">Resultado</div>
          </div>
        </div>

        {/* Métricas adicionales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 fluid-gap-4 fluid-mt-4">
          <div className="flex items-center fluid-gap-3 fluid-p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-fluid-lg border border-emerald-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="fluid-w-10 fluid-h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <Timer className="fluid-icon-sm text-white" />
            </div>
            <div className="min-w-0">
              <div className="fluid-text-xs text-emerald-600 font-medium uppercase tracking-wide">Duración</div>
              <div className="font-bold fluid-text-lg text-emerald-800 truncate">{formatDuration(result.duration_seconds)}</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-3 fluid-p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-fluid-lg border border-blue-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="fluid-w-10 fluid-h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <HelpCircle className="fluid-icon-sm text-white" />
            </div>
            <div className="min-w-0">
              <div className="fluid-text-xs text-blue-600 font-medium uppercase tracking-wide">Preguntas</div>
              <div className="font-bold fluid-text-lg text-blue-800">{summary.total_questions || 'N/A'}</div>
            </div>
          </div>
          <div className="flex items-center fluid-gap-3 fluid-p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-fluid-lg border border-purple-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="fluid-w-10 fluid-h-10 bg-purple-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <Puzzle className="fluid-icon-sm text-white" />
            </div>
            <div className="min-w-0">
              <div className="fluid-text-xs text-purple-600 font-medium uppercase tracking-wide">Ejercicios</div>
              <div className="font-bold fluid-text-lg text-purple-800">{summary.total_exercises || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón de descarga destacado */}
      <button
        onClick={downloadPDF}
        disabled={downloading}
        className="w-full flex items-center justify-center fluid-gap-3 fluid-px-6 fluid-py-4 rounded-fluid-lg text-white font-semibold fluid-text-lg transition-all transform hover:scale-[1.02] bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
      >
        {downloading ? (
          <div className="fluid-icon-md border-3 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Download className="fluid-icon-md" />
        )}
        <span className="truncate">Descargar Reporte de Evaluación</span>
        {!downloading && <span className="fluid-ml-2 fluid-px-2 py-0.5 bg-white/20 rounded fluid-text-xs hidden xs:inline">PDF</span>}
      </button>

      {/* Desglose por Categoría/Tema */}
      {Object.keys(evaluationBreakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="fluid-text-base font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <BarChart2 className="fluid-icon-sm text-primary-600" />
            Desglose por Área / Tema
          </h2>
          
          <div className="flex flex-col fluid-gap-4">
            {Object.entries(evaluationBreakdown).map(([catName, catData]: [string, any], catIndex) => (
              <div key={catName} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Categoría */}
                <div className="bg-gray-50 fluid-p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
                  <div className="flex items-center fluid-gap-3">
                    <span className="fluid-w-8 fluid-h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold fluid-text-xs flex-shrink-0">
                      {catIndex + 1}
                    </span>
                    <span className="font-semibold text-gray-900 fluid-text-sm">{catName}</span>
                  </div>
                  <div className="flex items-center fluid-gap-4 ml-8 sm:ml-0">
                    <span className="fluid-text-xs text-gray-500">
                      {catData.earned?.toFixed(2) || catData.correct || 0} / {catData.max || catData.total || 0}
                    </span>
                    <span className={`fluid-px-3 py-0.5 rounded-full fluid-text-xs font-medium ${
                      (catData.percentage || 0) >= passingScore 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {catData.percentage?.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
                
                {/* Temas */}
                {catData.topics && Object.keys(catData.topics).length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {Object.entries(catData.topics).map(([topicName, topicData]: [string, any], topicIndex) => (
                      <div key={topicName} className="fluid-p-4 pl-8 sm:pl-12 flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4 hover:bg-gray-50">
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-gray-400 fluid-text-xs">{catIndex + 1}.{topicIndex + 1}</span>
                          <span className="text-gray-700 fluid-text-sm">{topicName}</span>
                        </div>
                        <div className="flex items-center fluid-gap-4 ml-6 sm:ml-0">
                          <span className="fluid-text-xs text-gray-500">
                            {topicData.earned?.toFixed(2) || topicData.correct || 0} / {topicData.max || topicData.total || 0}
                          </span>
                          <span className={`fluid-px-2 py-0.5 rounded fluid-text-xs font-medium ${
                            (topicData.percentage || 0) >= passingScore 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {topicData.percentage?.toFixed(1) || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Código de Certificado */}
      {result.certificate_code && (
        <div className="flex flex-col sm:flex-row items-center justify-center fluid-gap-3 fluid-py-4 fluid-px-4 bg-gray-50 rounded-fluid-lg border border-gray-200 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-center fluid-gap-2">
            <Hash className="fluid-icon-sm text-primary-600" />
            <span className="text-gray-600 fluid-text-sm">Código de Certificado:</span>
          </div>
          <code className="bg-white fluid-px-3 fluid-py-1 rounded-lg fluid-text-lg font-bold font-mono text-primary-700 border border-primary-200">{result.certificate_code}</code>
        </div>
      )}
    </div>
  )
}

export default ResultDetailPage
