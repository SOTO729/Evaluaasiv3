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

      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-fluid-xl fluid-p-6 text-white animate-slide-up">
        <button
          onClick={() => navigate('/certificates')}
          className="flex items-center fluid-gap-2 text-white/80 hover:text-white fluid-mb-4 transition-colors fluid-text-sm"
        >
          <ArrowLeft className="fluid-icon-sm" />
          <span>Volver a certificados</span>
        </button>
        
        <div className="flex items-center fluid-gap-4">
          <div className="fluid-w-16 fluid-h-16 bg-white/20 rounded-fluid-xl flex items-center justify-center animate-pulse-subtle flex-shrink-0">
            <img 
              src="/images/evaluaasi-icon.webp" 
              alt="Reporte de Evaluación" 
              className="fluid-icon-lg object-contain brightness-0 invert"
            />
          </div>
          <div className="min-w-0">
            <h1 className="fluid-text-2xl font-bold truncate">Reportes de Evaluación</h1>
            <p className="text-primary-100 fluid-mt-1 fluid-text-sm truncate">
              {examData?.name || 'Cargando...'}
            </p>
            {examData?.version && (
              <p className="text-white/70 fluid-text-xs fluid-mt-1 flex items-center fluid-gap-2 flex-wrap">
                <span className="text-white/50">Código ECM:</span>
                <span className="fluid-px-2 py-0.5 bg-white/20 rounded font-mono font-bold fluid-text-xs">{examData.version}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-3 fluid-mt-6">
          <div className="bg-white/10 rounded-fluid-lg fluid-p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="fluid-text-xl font-bold">{results.length}</div>
            <div className="text-primary-200 fluid-text-xs">Intentos totales</div>
          </div>
          <div className="bg-white/10 rounded-fluid-lg fluid-p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="fluid-text-xl font-bold">
              {results.length > 0 ? Math.max(...results.map(r => r.score)) : 0}%
            </div>
            <div className="text-primary-200 fluid-text-xs">Mejor puntaje</div>
          </div>
          <div className="bg-white/10 rounded-fluid-lg fluid-p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="fluid-text-xl font-bold">
              {results.filter(r => r.result === 1).length}
            </div>
            <div className="text-primary-200 fluid-text-xs">Aprobados</div>
          </div>
          <div className="bg-white/10 rounded-fluid-lg fluid-p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="fluid-text-xl font-bold">{examData?.passing_score || 70}%</div>
            <div className="text-primary-200 fluid-text-xs">Puntaje mínimo</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="fluid-p-6 border-b border-gray-200">
          <h2 className="fluid-text-lg font-semibold text-gray-900">Historial de Evaluaciones</h2>
          <p className="fluid-text-xs text-gray-500 fluid-mt-1">
            Lista de todas las evaluaciones realizadas para este examen
          </p>
        </div>

        {results.length === 0 ? (
          <div className="text-center fluid-py-10 fluid-px-4">
            <FileText className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
            <h3 className="fluid-text-lg font-medium text-gray-900 fluid-mb-2">Sin evaluaciones</h3>
            <p className="text-gray-500 fluid-text-sm">Aún no has realizado ninguna evaluación para este examen.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <div
                key={result.id}
                id={`report-${result.id}`}
                onClick={() => navigate(`/certificates/evaluation-report/${examId}/result/${result.id}`)}
                className="fluid-p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between fluid-gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center fluid-gap-3">
                      <div className={`fluid-w-12 fluid-h-12 rounded-fluid-lg flex items-center justify-center flex-shrink-0 ${
                        result.result === 1 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {result.result === 1 ? (
                          <CheckCircle className="fluid-icon-md text-green-600" />
                        ) : (
                          <XCircle className="fluid-icon-md text-red-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="fluid-text-base font-semibold text-primary-600 hover:text-primary-800 truncate">
                          Intento #{results.length - index}
                        </h3>
                        <p className="fluid-text-xs text-gray-500">
                          {formatDate(result.start_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap fluid-gap-3 fluid-mt-4 ml-0 sm:ml-15">
                      <div className="flex items-center fluid-gap-2 fluid-text-xs">
                        <Target className="fluid-icon-xs text-gray-400" />
                        <span className="text-gray-600">Puntaje: <strong className={result.result === 1 ? 'text-green-600' : 'text-red-600'}>{result.score}%</strong></span>
                      </div>
                      <div className="flex items-center fluid-gap-2 fluid-text-xs">
                        <Clock className="fluid-icon-xs text-gray-400" />
                        <span className="text-gray-600">Duración: {formatDuration(result.duration_seconds)}</span>
                      </div>
                      {result.certificate_code && (
                        <div className="flex items-center fluid-gap-2 fluid-text-xs">
                          <Award className="fluid-icon-xs text-yellow-500" />
                          <span className="text-gray-600">Certificado: <code className="bg-gray-100 fluid-px-2 py-0.5 rounded fluid-text-xs">{result.certificate_code}</code></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center fluid-gap-2 ml-0 sm:ml-4 self-start sm:self-center flex-wrap sm:flex-nowrap">
                    <span className={`fluid-px-3 py-0.5 rounded-full fluid-text-xs font-medium ${
                      result.result === 1 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.result === 1 ? 'Aprobado' : 'No aprobado'}
                    </span>
                    <span className={`fluid-px-3 py-0.5 rounded-full fluid-text-xs font-medium hidden sm:inline-flex ${getStatusColor(result.status)}`}>
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
                      className="fluid-p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Descargar PDF"
                    >
                      {generatingPdf === result.id ? (
                        <div className="fluid-icon-sm border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="fluid-icon-sm" />
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
