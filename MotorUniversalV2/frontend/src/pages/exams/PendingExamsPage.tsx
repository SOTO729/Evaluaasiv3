import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertTriangle, 
  ArrowLeft, 
  Play, 
  Trash2, 
  Gamepad2,
  FileText,
  Timer,
  BookOpen,
  Pause
} from 'lucide-react'

interface PendingSession {
  examId: string
  examName: string
  mode: 'exam' | 'simulator'
  timeRemaining: number
  savedAt: number
  pauseOnDisconnect: boolean
  questionCount: number
  exerciseCount: number
  answeredCount: number
  disconnectionCount: number
}

function getPendingSessions(): PendingSession[] {
  const sessions: PendingSession[] = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('exam_session_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '')
        if (data && data.timeRemaining > 0) {
          const parts = key.replace('exam_session_', '').split('_')
          const examId = parts[0]
          const mode = parts[1] as 'exam' | 'simulator'
          
          let currentTimeRemaining = data.timeRemaining
          if (!data.pauseOnDisconnect && data.savedAt) {
            const elapsedSeconds = Math.floor((Date.now() - data.savedAt) / 1000)
            currentTimeRemaining = Math.max(0, data.timeRemaining - elapsedSeconds)
          }
          
          if (currentTimeRemaining > 0) {
            const selectedItems = data.selectedItems || []
            const questionCount = selectedItems.filter((item: any) => item.type === 'question').length
            const exerciseCount = selectedItems.filter((item: any) => item.type === 'exercise').length
            
            // Contar respuestas dadas
            const answers = data.answers || {}
            const exerciseResponses = data.exerciseResponses || {}
            const answeredCount = Object.keys(answers).length + Object.keys(exerciseResponses).length
            
            const examName = data.examName && data.examName.trim() !== '' ? data.examName : `Examen ${examId}`
            
            sessions.push({
              examId,
              examName,
              mode,
              timeRemaining: currentTimeRemaining,
              savedAt: data.savedAt,
              pauseOnDisconnect: data.pauseOnDisconnect ?? true,
              questionCount,
              exerciseCount,
              answeredCount,
              disconnectionCount: data.disconnectionCount || 0
            })
          }
        }
      } catch {
        // Ignorar errores de parsing
      }
    }
  }
  
  return sessions
}

const PendingExamsPage = () => {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<PendingSession[]>([])
  const [displayTimes, setDisplayTimes] = useState<Record<string, number>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadSessions = useCallback(() => {
    const found = getPendingSessions()
    setSessions(found)
    const times: Record<string, number> = {}
    found.forEach(s => {
      times[`${s.examId}_${s.mode}`] = s.timeRemaining
    })
    setDisplayTimes(times)
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Actualizar tiempos cada segundo
  useEffect(() => {
    if (sessions.length === 0) return
    const timer = setInterval(() => {
      setDisplayTimes(prev => {
        const newTimes: Record<string, number> = {}
        sessions.forEach(session => {
          const key = `${session.examId}_${session.mode}`
          const currentTime = prev[key] ?? session.timeRemaining
          if (!session.pauseOnDisconnect) {
            newTimes[key] = Math.max(0, currentTime - 1)
          } else {
            newTimes[key] = currentTime
          }
        })
        return newTimes
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [sessions])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleContinue = (session: PendingSession) => {
    navigate(`/test-exams/${session.examId}/run`, {
      state: {
        questionCount: session.questionCount,
        exerciseCount: session.exerciseCount,
        mode: session.mode
      }
    })
  }

  const handleDelete = (examId: string, mode: string) => {
    const key = `exam_session_${examId}_${mode}`
    localStorage.removeItem(key)
    setConfirmDelete(null)
    loadSessions()
  }

  return (
    <div className="fluid-p-8 animate-fade-in-up">
      {/* Header */}
      <div className="fluid-mb-6">
        <button 
          onClick={() => navigate('/exams')}
          className="flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 transition-colors fluid-mb-4"
        >
          <ArrowLeft className="fluid-icon" />
          <span className="fluid-text-sm">Volver a exámenes</span>
        </button>
        <div className="flex items-center fluid-gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-800">Exámenes Pendientes</h1>
            <p className="fluid-text-sm text-gray-500">
              {sessions.length === 0
                ? 'No tienes exámenes pendientes'
                : `Tienes ${sessions.length} ${sessions.length === 1 ? 'examen pendiente' : 'exámenes pendientes'} por completar`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      {sessions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="fluid-text-sm text-amber-800 font-medium">Recupera tus exámenes en curso</p>
            <p className="fluid-text-xs text-amber-700 mt-1">
              Estos exámenes fueron interrumpidos por desconexión o porque saliste de la página. 
              Puedes retomarlos donde los dejaste. Si eliminas una sesión, perderás todo tu progreso.
            </p>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow fluid-p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-medium text-gray-700 fluid-mb-2">Sin exámenes pendientes</h3>
          <p className="text-gray-500 fluid-mb-4">No tienes ningún examen interrumpido o en pausa.</p>
          <button
            onClick={() => navigate('/exams')}
            className="bg-primary-600 hover:bg-primary-700 text-white fluid-px-6 fluid-py-2 rounded-lg inline-flex items-center fluid-gap-2 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Ver exámenes disponibles
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const key = `${session.examId}_${session.mode}`
            const currentTime = displayTimes[key] ?? session.timeRemaining
            const isLowTime = currentTime < 300
            const isCritical = currentTime < 60
            const totalItems = session.questionCount + session.exerciseCount
            const progress = totalItems > 0 ? Math.round((session.answeredCount / totalItems) * 100) : 0

            return (
              <div 
                key={key}
                className={`bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition-all hover:shadow-md ${
                  session.mode === 'simulator' ? 'border-l-amber-500' : 'border-l-primary-500'
                }`}
              >
                <div className="fluid-p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center fluid-gap-2 fluid-mb-2">
                        <span className={`fluid-px-2 py-0.5 rounded fluid-text-xs font-bold uppercase ${
                          session.mode === 'simulator' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-primary-100 text-primary-800'
                        }`}>
                          {session.mode === 'simulator' ? (
                            <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" /> Simulador</span>
                          ) : (
                            <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Examen</span>
                          )}
                        </span>
                        {session.pauseOnDisconnect && (
                          <span className="inline-flex items-center gap-1 fluid-text-xs text-gray-500">
                            <Pause className="w-3 h-3" /> Pausado
                          </span>
                        )}
                        {session.disconnectionCount > 0 && (
                          <span className="inline-flex items-center gap-1 fluid-text-xs text-orange-600">
                            <AlertTriangle className="w-3 h-3" /> {session.disconnectionCount} {session.disconnectionCount > 1 ? 'desconexiones' : 'desconexión'}
                          </span>
                        )}
                      </div>
                      <h3 className="fluid-text-lg font-semibold text-gray-900 truncate">{session.examName}</h3>
                      
                      {/* Stats */}
                      <div className="flex flex-wrap items-center fluid-gap-4 fluid-mt-2 fluid-text-sm text-gray-500">
                        <div className="flex items-center fluid-gap-1">
                          <Timer className="w-4 h-4" />
                          <span className={`font-mono font-bold ${
                            isCritical ? 'text-red-600' : isLowTime ? 'text-amber-600' : 'text-gray-700'
                          }`}>
                            {formatTime(currentTime)}
                          </span>
                          {!session.pauseOnDisconnect && (
                            <span className="text-red-500 fluid-text-xs">(corriendo)</span>
                          )}
                        </div>
                        <div className="flex items-center fluid-gap-1">
                          <BookOpen className="w-4 h-4" />
                          <span>{session.answeredCount}/{totalItems} respondidos</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="fluid-mt-3 w-full max-w-xs">
                        <div className="flex items-center justify-between fluid-text-xs text-gray-500 fluid-mb-1">
                          <span>Progreso</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              session.mode === 'simulator' ? 'bg-amber-500' : 'bg-primary-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center fluid-gap-2 sm:flex-col">
                      <button
                        onClick={() => handleContinue(session)}
                        className="flex-1 sm:flex-none sm:w-40 flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        Continuar
                      </button>
                      {confirmDelete === key ? (
                        <div className="flex items-center fluid-gap-1">
                          <button
                            onClick={() => handleDelete(session.examId, session.mode)}
                            className="fluid-px-3 fluid-py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg fluid-text-xs font-medium transition-colors"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="fluid-px-3 fluid-py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg fluid-text-xs font-medium transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(key)}
                          className="flex items-center justify-center fluid-gap-1 fluid-px-3 fluid-py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg fluid-text-sm transition-colors"
                          title="Eliminar sesión"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PendingExamsPage
