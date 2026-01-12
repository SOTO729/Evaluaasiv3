import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  ArrowLeft, Download, CheckCircle, XCircle, FileText, 
  Target, Calendar, User, Mail, BookOpen, Hash, Timer,
  TrendingUp, BarChart2, AlertCircle
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
    setDownloadMessage('Preparando tu constancia de evaluación...')
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://evaluaasi-motorv2-api.azurewebsites.net/api'
      
      setDownloadMessage('Generando PDF...')
      
      const response = await fetch(`${apiUrl}/exams/results/${result.id}/generate-pdf`, {
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
      a.download = `Constancia_Evaluacion_${examData?.name?.replace(/\s+/g, '_') || 'Examen'}_${result.id.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
    } catch (error) {
      console.error('Error descargando PDF:', error)
      alert('Error al descargar la constancia. Por favor intenta de nuevo.')
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
      <div className={`bg-gradient-to-r ${isPassed ? 'from-green-600 to-emerald-700' : 'from-red-600 to-rose-700'} rounded-2xl p-8 text-white`}>
        <button
          onClick={() => navigate(`/certificates/evaluation-report/${examId}`)}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver al historial</span>
        </button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 ${isPassed ? 'bg-green-500/30' : 'bg-red-500/30'} rounded-2xl flex items-center justify-center`}>
              {isPassed ? (
                <CheckCircle className="w-12 h-12" />
              ) : (
                <XCircle className="w-12 h-12" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                {isPassed ? 'APROBADO' : 'NO APROBADO'}
              </h1>
              <p className="text-white/80 mt-1">
                {examData?.name || 'Examen'}
              </p>
              <p className="text-white/60 text-sm mt-1">
                {formatDate(result.start_date)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-5xl font-bold">{percentage}%</div>
            <div className="text-white/80">{score1000} / 1000 puntos</div>
            <div className="text-white/60 text-sm">Mínimo: {passingScore * 10} puntos</div>
          </div>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos del Estudiante */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary-600" />
            Datos del Estudiante
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Nombre:</span>
              <span className="font-medium">{user?.name || 'N/A'} {user?.first_surname || ''} {user?.second_surname || ''}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Correo:</span>
              <span className="font-medium">{user?.email || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Datos del Examen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-600" />
            Datos del Examen
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Examen:</span>
              <span className="font-medium">{examData?.name || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Código ECM:</span>
              <span className="font-medium font-mono">{examData?.version || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">Fecha:</span>
              <span className="font-medium">{formatDate(result.start_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado de la Evaluación */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary-600" />
          Resultado de la Evaluación
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-primary-600">{percentage}%</div>
            <div className="text-sm text-gray-500">Calificación</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-primary-600">{score1000}</div>
            <div className="text-sm text-gray-500">Puntaje / 1000</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
              {isPassed ? 'APROBADO' : 'REPROBADO'}
            </div>
            <div className="text-sm text-gray-500">Resultado</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-600">{passingScore * 10}</div>
            <div className="text-sm text-gray-500">Puntaje mínimo</div>
          </div>
        </div>

        {/* Métricas adicionales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <Timer className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-sm text-gray-500">Duración</div>
              <div className="font-semibold">{formatDuration(result.duration_seconds)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
            <FileText className="w-5 h-5 text-purple-600" />
            <div>
              <div className="text-sm text-gray-500">Preguntas</div>
              <div className="font-semibold">{summary.total_questions || 'N/A'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
            <Target className="w-5 h-5 text-orange-600" />
            <div>
              <div className="text-sm text-gray-500">Ejercicios</div>
              <div className="font-semibold">{summary.total_exercises || 'N/A'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div>
              <div className="text-sm text-gray-500">Puntos obtenidos</div>
              <div className="font-semibold">{summary.earned_points?.toFixed(2) || 'N/A'} / {summary.total_points || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desglose por Categoría/Tema */}
      {Object.keys(evaluationBreakdown).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary-600" />
            Desglose por Área / Tema
          </h2>
          
          <div className="space-y-4">
            {Object.entries(evaluationBreakdown).map(([catName, catData]: [string, any], catIndex) => (
              <div key={catName} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Categoría */}
                <div className="bg-gray-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {catIndex + 1}
                    </span>
                    <span className="font-semibold text-gray-900">{catName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {catData.earned?.toFixed(2) || catData.correct || 0} / {catData.max || catData.total || 0}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                      <div key={topicName} className="p-4 pl-12 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm">{catIndex + 1}.{topicIndex + 1}</span>
                          <span className="text-gray-700">{topicName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">
                            {topicData.earned?.toFixed(2) || topicData.correct || 0} / {topicData.max || topicData.total || 0}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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

      {/* Información adicional */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Hash className="w-5 h-5 text-primary-600" />
          Información del Registro
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">ID del Resultado:</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{result.id}</code>
          </div>
          {result.certificate_code && (
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Código de Certificado:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{result.certificate_code}</code>
            </div>
          )}
        </div>
      </div>

      {/* Botón de descarga */}
      <div className="flex justify-center">
        <button
          onClick={downloadPDF}
          disabled={downloading}
          className={`flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-lg transition-all ${
            isPassed 
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
              : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800'
          } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
        >
          <Download className="w-6 h-6" />
          Descargar Constancia de Evaluación
        </button>
      </div>
    </div>
  )
}

export default ResultDetailPage
