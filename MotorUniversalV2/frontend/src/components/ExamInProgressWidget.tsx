import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronRight, X } from 'lucide-react';

interface ExamSession {
  examId: string;
  examName: string;
  mode: 'exam' | 'simulator';
  timeRemaining: number;
  savedAt: number;
  pauseOnDisconnect: boolean;
  questionCount: number;
  exerciseCount: number;
}

const ExamInProgressWidget = () => {
  const navigate = useNavigate();
  const [activeSessions, setActiveSessions] = useState<ExamSession[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [displayTimes, setDisplayTimes] = useState<Record<string, number>>({});

  // Buscar sesiones de examen activas en localStorage
  useEffect(() => {
    const findActiveSessions = () => {
      const sessions: ExamSession[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('exam_session_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '');
            if (data && data.timeRemaining > 0) {
              // Extraer examId y mode del key (exam_session_{examId}_{mode})
              const parts = key.replace('exam_session_', '').split('_');
              const examId = parts[0];
              const mode = parts[1] as 'exam' | 'simulator';
              
              // Calcular tiempo restante real
              let currentTimeRemaining = data.timeRemaining;
              if (!data.pauseOnDisconnect && data.savedAt) {
                const elapsedSeconds = Math.floor((Date.now() - data.savedAt) / 1000);
                currentTimeRemaining = Math.max(0, data.timeRemaining - elapsedSeconds);
              }
              
              if (currentTimeRemaining > 0) {
                // Calcular cantidad de preguntas y ejercicios desde selectedItems
                const selectedItems = data.selectedItems || [];
                const questionCount = selectedItems.filter((item: any) => item.type === 'question').length;
                const exerciseCount = selectedItems.filter((item: any) => item.type === 'exercise').length;
                
                // Solo mostrar si hay un nombre válido
                const examName = data.examName && data.examName.trim() !== '' ? data.examName : `Examen ${examId}`;
                
                sessions.push({
                  examId,
                  examName,
                  mode,
                  timeRemaining: currentTimeRemaining,
                  savedAt: data.savedAt,
                  pauseOnDisconnect: data.pauseOnDisconnect ?? true,
                  questionCount,
                  exerciseCount
                });
              }
            }
          } catch (e) {
            // Ignorar errores de parsing
          }
        }
      }
      
      setActiveSessions(sessions);
      
      // Inicializar tiempos de display
      const times: Record<string, number> = {};
      sessions.forEach(s => {
        times[`${s.examId}_${s.mode}`] = s.timeRemaining;
      });
      setDisplayTimes(times);
    };

    findActiveSessions();
    
    // Verificar cada 10 segundos por nuevas sesiones
    const checkInterval = setInterval(findActiveSessions, 10000);
    
    return () => clearInterval(checkInterval);
  }, []);

  // Actualizar los tiempos mostrados cada segundo
  useEffect(() => {
    if (activeSessions.length === 0) return;

    const timer = setInterval(() => {
      setDisplayTimes(prev => {
        const newTimes: Record<string, number> = {};
        activeSessions.forEach(session => {
          const key = `${session.examId}_${session.mode}`;
          const currentTime = prev[key] ?? session.timeRemaining;
          
          // Solo decrementar si NO pausa al desconectarse
          if (!session.pauseOnDisconnect) {
            newTimes[key] = Math.max(0, currentTime - 1);
          } else {
            newTimes[key] = currentTime;
          }
        });
        return newTimes;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSessions]);

  // No mostrar si no hay sesiones activas
  if (activeSessions.length === 0) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleContinueExam = (session: ExamSession) => {
    // Navegar al examen con los valores correctos de la sesión
    navigate(`/test-exams/${session.examId}/run`, { 
      state: { 
        questionCount: session.questionCount,
        exerciseCount: session.exerciseCount,
        mode: session.mode 
      } 
    });
  };

  const handleDismiss = (examId: string, mode: 'exam' | 'simulator') => {
    const key = `exam_session_${examId}_${mode}`;
    localStorage.removeItem(key);
    setActiveSessions(prev => prev.filter(s => !(s.examId === examId && s.mode === mode)));
  };

  return (
    <div className="fixed top-20 right-4 z-50 max-w-xs">
      {activeSessions.map((session) => {
        const key = `${session.examId}_${session.mode}`;
        const currentTime = displayTimes[key] ?? session.timeRemaining;
        const isLowTime = currentTime < 300; // Menos de 5 minutos
        const isCritical = currentTime < 60; // Menos de 1 minuto
        
        return (
          <div 
            key={key}
            className={`mb-2 rounded-xl shadow-lg border overflow-hidden transition-all duration-300 ${
              session.mode === 'simulator' 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-blue-50 border-blue-200'
            } ${isMinimized ? 'w-14' : 'w-72'}`}
          >
            {isMinimized ? (
              // Vista minimizada
              <button
                onClick={() => setIsMinimized(false)}
                className={`w-full p-3 flex flex-col items-center justify-center ${
                  isCritical ? 'animate-pulse' : ''
                }`}
              >
                <Clock className={`w-5 h-5 ${
                  isCritical 
                    ? 'text-red-500' 
                    : isLowTime 
                    ? 'text-amber-500' 
                    : session.mode === 'simulator' ? 'text-amber-600' : 'text-blue-600'
                }`} />
                <span className={`text-xs font-mono font-bold mt-1 ${
                  isCritical 
                    ? 'text-red-600' 
                    : isLowTime 
                    ? 'text-amber-600' 
                    : session.mode === 'simulator' ? 'text-amber-700' : 'text-blue-700'
                }`}>
                  {formatTime(currentTime)}
                </span>
              </button>
            ) : (
              // Vista expandida
              <>
                {/* Header */}
                <div className={`px-3 py-2 flex items-center justify-between ${
                  session.mode === 'simulator' ? 'bg-amber-100' : 'bg-blue-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      session.mode === 'simulator' 
                        ? 'bg-yellow-400 text-yellow-900' 
                        : 'bg-blue-500 text-white'
                    }`}>
                      {session.mode === 'simulator' ? 'Simulador' : 'Examen'}
                    </span>
                    <span className="text-xs font-medium text-gray-600">En curso</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsMinimized(true)}
                      className="p-1 hover:bg-white/50 rounded transition-colors"
                      title="Minimizar"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDismiss(session.examId, session.mode)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Abandonar examen"
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 truncate mb-2">
                    {session.examName}
                  </p>
                  
                  {/* Timer */}
                  <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg mb-3 ${
                    isCritical 
                      ? 'bg-red-100 animate-pulse' 
                      : isLowTime 
                      ? 'bg-amber-100' 
                      : session.mode === 'simulator' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    <Clock className={`w-4 h-4 ${
                      isCritical 
                        ? 'text-red-500' 
                        : isLowTime 
                        ? 'text-amber-500' 
                        : session.mode === 'simulator' ? 'text-amber-600' : 'text-blue-600'
                    }`} />
                    <span className={`font-mono text-lg font-bold ${
                      isCritical 
                        ? 'text-red-600' 
                        : isLowTime 
                        ? 'text-amber-600' 
                        : session.mode === 'simulator' ? 'text-amber-700' : 'text-blue-700'
                    }`}>
                      {formatTime(currentTime)}
                    </span>
                    {session.pauseOnDisconnect && (
                      <span className="text-[10px] text-gray-500 bg-white/50 px-1.5 py-0.5 rounded">
                        Pausado
                      </span>
                    )}
                  </div>
                  
                  {/* Botón continuar */}
                  <button
                    onClick={() => handleContinueExam(session)}
                    className={`w-full py-2 px-3 rounded-lg text-sm font-medium text-white transition-colors ${
                      session.mode === 'simulator' 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Continuar examen →
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ExamInProgressWidget;
