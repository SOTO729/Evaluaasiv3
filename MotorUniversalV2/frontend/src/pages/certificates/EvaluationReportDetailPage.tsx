import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Clock, CheckCircle, XCircle, FileText, Award, Target } from 'lucide-react'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'

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
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  const generatePDF = async (result: ExamResult) => {
    setGeneratingPdf(result.id)
    
    try {
      // Usar el endpoint del backend para generar el PDF
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.azurewebsites.net/api'
      
      console.log('📤 Descargando PDF:', { resultId: result.id, apiUrl, hasToken: !!accessToken })
      
      const response = await fetch(`${apiUrl}/exams/results/${result.id}/generate-pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      console.log('📥 Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Error response:', response.status, errorText)
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
      
      // Descargar el PDF
      const blob = await response.blob()
      console.log('📄 PDF blob size:', blob.size)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Reporte_Evaluacion_${result.id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (error) {
      console.error('Error generando PDF:', error)
      alert('Error al generar el PDF. Por favor intenta de nuevo.')
    } finally {
      setGeneratingPdf(null)
    }
  }

  if (isLoadingExam || isLoadingResults) {
    return <LoadingSpinner message="Cargando reportes..." fullScreen />
  }

  const results = resultsData?.results || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white">
        <button
          onClick={() => navigate('/certificates')}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver a certificados</span>
        </button>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <img 
              src="/images/evaluaasi-icon.png" 
              alt="Reporte de Evaluación" 
              className="w-10 h-10 object-contain brightness-0 invert"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Reportes de Evaluación</h1>
            <p className="text-primary-100 mt-1">
              {examData?.name || 'Cargando...'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{results.length}</div>
            <div className="text-primary-200 text-sm">Intentos totales</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">
              {results.length > 0 ? Math.max(...results.map(r => r.score)) : 0}%
            </div>
            <div className="text-primary-200 text-sm">Mejor puntaje</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">
              {results.filter(r => r.result === 1).length}
            </div>
            <div className="text-primary-200 text-sm">Aprobados</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{examData?.passing_score || 70}%</div>
            <div className="text-primary-200 text-sm">Puntaje mínimo</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Historial de Evaluaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            Lista de todas las evaluaciones realizadas para este examen
          </p>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sin evaluaciones</h3>
            <p className="text-gray-500">Aún no has realizado ninguna evaluación para este examen.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {results.map((result, index) => (
              <div
                key={result.id}
                id={`report-${result.id}`}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        result.result === 1 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {result.result === 1 ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Intento #{results.length - index}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(result.start_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-4 ml-15">
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Puntaje: <strong className={result.result === 1 ? 'text-green-600' : 'text-red-600'}>{result.score}%</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Duración: {formatDuration(result.duration_seconds)}</span>
                      </div>
                      {result.certificate_code && (
                        <div className="flex items-center gap-2 text-sm">
                          <Award className="w-4 h-4 text-yellow-500" />
                          <span className="text-gray-600">Certificado: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{result.certificate_code}</code></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      result.result === 1 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.result === 1 ? 'Aprobado' : 'No aprobado'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                      {getStatusText(result.status)}
                    </span>
                    <button 
                      onClick={() => {
                        // Si tiene report_url, descargar desde esa URL
                        if (result.report_url) {
                          window.open(result.report_url, '_blank');
                        } else {
                          // Si no, generar el PDF localmente (fallback)
                          generatePDF(result);
                        }
                      }}
                      disabled={generatingPdf === result.id}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Descargar PDF"
                    >
                      {generatingPdf === result.id ? (
                        <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
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
