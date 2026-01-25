import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Clock, CheckCircle, XCircle, FileText, Award, Target } from 'lucide-react'
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

interface ExamResult {
  id: string
  exam_id: number
  score: number
  status: number
  result: number
  start_date: string
  end_date?: string | null
  duration_seconds?: number | null
  certificate_code?: string | null
  certificate_url?: string | null
  report_url?: string | null
  answers_data?: any
  questions_order?: any
}

const EvaluationReportDetailPage = () => {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const { accessToken } = useAuthStore()
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)
  const [downloadMessage, setDownloadMessage] = useState('')

  const { data: examData, isLoading: isLoadingExam } = useQuery({
    queryKey: ['exam', examId, 'withQuestions'],
    queryFn: async () => {
      const response = await examService.getExam(Number(examId), true)
      return response
    },
    enabled: !!examId
  })

  const { data: resultsData, isLoading: isLoadingResults } = useQuery({
    queryKey: ['exam-results', examId],
    queryFn: async () => {
      const response = await examService.getMyExamResults(Number(examId))
      return response
    },
    enabled: !!examId
  })

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
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const getStatusText = (status: number) => {
    switch (status) {
      case 0: return 'En proceso'
      case 1: return 'Completado'
      case 2: return 'Abandonado'
      default: return 'Desconocido'
    }
  }

  const getStatusColor = (status: number) => {
    switch (status) {
      case 0: return 'bg-yellow-100 text-yellow-800'
      case 1: return 'bg-green-100 text-green-800'
      case 2: return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const generatePDF = async (result: ExamResult, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setGeneratingPdf(result.id)
    setDownloadMessage('Preparando tu certificado de evaluación...')
    
    // Log inicio de descarga
    console.log('📥 [PDF] Iniciando descarga de reporte de evaluación')
    console.log('📥 [PDF] Result ID:', result.id)
    console.log('📥 [PDF] Examen:', examData?.name)
    console.log('📥 [PDF] Timestamp:', new Date().toISOString())
    
    try {
      // Usar el endpoint del backend para generar el PDF
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
      
      // Obtener zona horaria del equipo del usuario
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      setDownloadMessage('Generando PDF...')
      console.log('📥 [PDF] Llamando a:', `${apiUrl}/exams/results/${result.id}/generate-pdf?timezone=${clientTimezone}`)
      
      const startTime = performance.now()
      const response = await fetch(`${apiUrl}/exams/results/${result.id}/generate-pdf?timezone=${encodeURIComponent(clientTimezone)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      const endTime = performance.now()
      
      console.log('📥 [PDF] Respuesta recibida en:', Math.round(endTime - startTime), 'ms')
      console.log('📥 [PDF] Status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ [PDF] Error response:', response.status, errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
      
      setDownloadMessage('Descargando archivo...')
      
      // Descargar el PDF
      const blob = await response.blob()
      console.log('📥 [PDF] Tamaño del archivo:', (blob.size / 1024).toFixed(2), 'KB')
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = `Certificado_Evaluacion_${examData?.name?.replace(/\s+/g, '_') || 'Examen'}_${result.id.slice(0, 8)}.pdf`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('✅ [PDF] Descarga completada:', filename)
      
    } catch (error) {
      console.error('❌ [PDF] Error generando PDF:', error)
      alert('Error al generar el PDF. Por favor intenta de nuevo.')
    } finally {
      setGeneratingPdf(null)
      setDownloadMessage('')
    }
  }

  if (isLoadingExam || isLoadingResults) {
    return <LoadingSpinner message="Cargando reportes..." fullScreen />
  }

  const results = resultsData?.results || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modal de descarga */}
      <DownloadModal isOpen={!!generatingPdf} message={downloadMessage} />

      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 lg:p-8 xl:p-10 2xl:p-12 3xl:p-14 4xl:p-16 text-white animate-slide-up">
        <button
          onClick={() => navigate('/certificates')}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-3 sm:mb-4 transition-colors text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Volver a certificados</span>
        </button>
        
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-18 lg:h-18 xl:w-20 xl:h-20 2xl:w-24 2xl:h-24 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center animate-pulse-subtle flex-shrink-0">
            <img 
              src="/images/evaluaasi-icon.png" 
              alt="Reporte de Evaluación" 
              className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:h-8 lg:w-8 xl:h-10 xl:w-10 2xl:h-12 2xl:w-12 3xl:h-14 3xl:w-14 4xl:h-16 4xl:w-16 object-contain brightness-0 invert"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl 2xl:text-5xl 3xl:text-6xl 4xl:text-7xl font-bold truncate">Reportes de Evaluación</h1>
            <p className="text-primary-100 mt-0.5 sm:mt-1 text-sm sm:text-base truncate">
              {examData?.name || 'Cargando...'}
            </p>
            {examData?.version && (
              <p className="text-white/70 text-xs sm:text-sm mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-2 flex-wrap">
                <span className="text-white/50">Código ECM:</span>
                <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded font-mono font-bold text-xs sm:text-sm">{examData.version}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mt-4 sm:mt-6">
          <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{results.length}</div>
            <div className="text-primary-200 text-xs sm:text-sm">Intentos totales</div>
          </div>
          <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">
              {results.length > 0 ? Math.max(...results.map(r => r.score)) : 0}%
            </div>
            <div className="text-primary-200 text-xs sm:text-sm">Mejor puntaje</div>
          </div>
          <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">
              {results.filter(r => r.result === 1).length}
            </div>
            <div className="text-primary-200 text-xs sm:text-sm">Aprobados</div>
          </div>
          <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-lg sm:text-xl md:text-2xl font-bold">{examData?.passing_score || 70}%</div>
            <div className="text-primary-200 text-xs sm:text-sm">Puntaje mínimo</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Historial de Evaluaciones</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            Lista de todas las evaluaciones realizadas para este examen
          </p>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">Sin evaluaciones</h3>
            <p className="text-gray-500 text-sm sm:text-base">Aún no has realizado ninguna evaluación para este examen.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <div
                key={result.id}
                id={`report-${result.id}`}
                onClick={() => navigate(`/certificates/evaluation-report/${examId}/result/${result.id}`)}
                className="p-3 sm:p-4 md:p-6 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                        result.result === 1 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {result.result === 1 ? (
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-primary-600 hover:text-primary-800 truncate">
                          Intento #{results.length - index}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {formatDate(result.start_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-4 ml-0 sm:ml-15">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                        <span className="text-gray-600">Puntaje: <strong className={result.result === 1 ? 'text-green-600' : 'text-red-600'}>{result.score}%</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                        <span className="text-gray-600">Duración: {formatDuration(result.duration_seconds)}</span>
                      </div>
                      {result.certificate_code && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" />
                          <span className="text-gray-600">Certificado: <code className="bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded text-xs">{result.certificate_code}</code></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 ml-0 sm:ml-4 self-start sm:self-center flex-wrap sm:flex-nowrap">
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ${
                      result.result === 1 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.result === 1 ? 'Aprobado' : 'No aprobado'}
                    </span>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium hidden sm:inline-flex ${getStatusColor(result.status)}`}>
                      {getStatusText(result.status)}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        // Si tiene report_url, descargar desde esa URL
                        if (result.report_url) {
                          window.open(result.report_url, '_blank');
                        } else {
                          // Si no, generar el PDF
                          generatePDF(result);
                        }
                      }}
                      disabled={!!generatingPdf}
                      className="p-1.5 sm:p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Descargar PDF"
                    >
                      {generatingPdf === result.id ? (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EvaluationReportDetailPage
