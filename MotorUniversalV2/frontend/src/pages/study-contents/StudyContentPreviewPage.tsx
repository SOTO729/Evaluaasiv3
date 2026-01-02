/**
 * Página de vista previa del Material de Estudio
 * Diseño estilo Coursera para una experiencia de aprendizaje cómoda
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  getMaterial,
  StudyMaterial,
  StudyInteractiveExerciseStep,
  StudyInteractiveExerciseAction,
} from '../../services/studyContentService';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Video,
  Download,
  Gamepad2,
  PlayCircle,
  Menu,
  X,
  CheckCircle2,
  RotateCcw,
  Image,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import CustomVideoPlayer from '../../components/CustomVideoPlayer';

const StudyContentPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const materialId = Number(id);

  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'reading' | 'video' | 'downloadable' | 'interactive'>('reading');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set([0]));

  // Estados para ejercicio interactivo
  const [exerciseStarted, setExerciseStarted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepCompleted, setStepCompleted] = useState<Record<string, boolean>>({});
  const [actionResponses, setActionResponses] = useState<Record<string, any>>({});
  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [exerciseScore, setExerciseScore] = useState<{ score: number; maxScore: number; percentage: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const exerciseContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const instructionsRef = useRef<HTMLDivElement>(null);
  const startExerciseRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // Cargar material
  useEffect(() => {
    const loadMaterial = async () => {
      try {
        const data = await getMaterial(materialId);
        setMaterial(data);
        
        // Establecer la primera tab disponible
        if (data.sessions && data.sessions.length > 0) {
          const firstTopic = data.sessions[0].topics?.[0];
          if (firstTopic) {
            setFirstAvailableTab(firstTopic);
          }
        }
      } catch (error) {
        console.error('Error loading material:', error);
      } finally {
        setLoading(false);
      }
    };
    loadMaterial();
  }, [materialId]);

  // Scroll al video cuando se cambia al tab de video
  useEffect(() => {
    if (activeTab === 'video' && videoContainerRef.current) {
      setTimeout(() => {
        // Scroll con offset para que se vea el título
        const element = videoContainerRef.current;
        if (element) {
          const offset = 80; // Offset para que se vea el título
          const elementPosition = element.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [activeTab]);

  const setFirstAvailableTab = (topic: any) => {
    // Prioridad: Lectura > Video > Ejercicio > Recursos
    if (topic.allow_reading !== false && topic.reading) {
      setActiveTab('reading');
    } else if (topic.allow_video !== false && topic.video) {
      setActiveTab('video');
    } else if (topic.allow_interactive !== false && topic.interactive_exercise) {
      setActiveTab('interactive');
    } else if (topic.allow_downloadable !== false && topic.downloadable_exercise) {
      setActiveTab('downloadable');
    } else {
      // Si no hay ninguno con contenido, abrir lectura por defecto
      setActiveTab('reading');
    }
  };

  const currentSession = material?.sessions?.[currentSessionIndex];
  const currentTopic = currentSession?.topics?.[currentTopicIndex];

  // Detectar si las instrucciones del ejercicio son largas y la sección de inicio no es visible
  useEffect(() => {
    const checkInstructionsHeight = () => {
      if (activeTab === 'interactive' && !exerciseStarted && instructionsRef.current && startExerciseRef.current) {
        const startRect = startExerciseRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Mostrar el hint si la sección de inicio no está visible en el viewport
        setShowScrollHint(startRect.top > viewportHeight - 100);
      } else {
        setShowScrollHint(false);
      }
    };

    checkInstructionsHeight();
    window.addEventListener('scroll', checkInstructionsHeight);
    window.addEventListener('resize', checkInstructionsHeight);

    return () => {
      window.removeEventListener('scroll', checkInstructionsHeight);
      window.removeEventListener('resize', checkInstructionsHeight);
    };
  }, [activeTab, exerciseStarted, currentTopic]);

  // Calcular progreso
  const getTotalTopics = () => {
    return material?.sessions?.reduce((acc, session) => acc + (session.topics?.length || 0), 0) || 0;
  };

  const getCurrentTopicGlobalIndex = () => {
    let index = 0;
    for (let i = 0; i < currentSessionIndex; i++) {
      index += material?.sessions?.[i]?.topics?.length || 0;
    }
    return index + currentTopicIndex + 1;
  };

  const getProgressPercentage = () => {
    return Math.round((getCurrentTopicGlobalIndex() / getTotalTopics()) * 100);
  };

  // Navegación
  const selectTopic = (sessionIdx: number, topicIdx: number) => {
    setCurrentSessionIndex(sessionIdx);
    setCurrentTopicIndex(topicIdx);
    const topic = material?.sessions?.[sessionIdx]?.topics?.[topicIdx];
    if (topic) {
      setFirstAvailableTab(topic);
    }
    // Reset estado del ejercicio interactivo al cambiar de tema
    resetExerciseState();
    // En móvil, cerrar sidebar
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Funciones para ejercicio interactivo
  const resetExerciseState = () => {
    setExerciseStarted(false);
    setCurrentStepIndex(0);
    setStepCompleted({});
    setActionResponses({});
    setExerciseCompleted(false);
    setExerciseScore(null);
  };

  const startExercise = () => {
    resetExerciseState();
    setExerciseStarted(true);
    // Hacer scroll al contenedor del ejercicio después de un pequeño delay
    setTimeout(() => {
      exerciseContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Función para evaluar el ejercicio
  const evaluateExercise = () => {
    const exercise = currentTopic?.interactive_exercise;
    if (!exercise?.steps) return { score: 0, maxScore: 0, percentage: 0 };

    let score = 0;
    let maxScore = 0;

    exercise.steps.forEach(step => {
      step.actions?.forEach(action => {
        maxScore += 1;
        const responseKey = `${step.id}_${action.id}`;
        const userResponse = actionResponses[responseKey];

        if (action.action_type === 'button') {
          // Para botones, verificar si fue clickeado
          if (userResponse) score += 1;
        } else if (action.action_type === 'text_input') {
          // Para inputs de texto, comparar con respuesta correcta
          const correctAnswer = action.correct_answer || '';
          const isCaseSensitive = action.is_case_sensitive;
          const scoringMode = action.scoring_mode || 'exact';

          if (userResponse && correctAnswer) {
            if (scoringMode === 'exact') {
              const userText = String(userResponse).trim();
              const correctText = String(correctAnswer).trim();
              if (isCaseSensitive) {
                if (userText === correctText) score += 1;
              } else {
                if (userText.toLowerCase() === correctText.toLowerCase()) score += 1;
              }
            } else if (scoringMode === 'contains') {
              const userText = isCaseSensitive ? String(userResponse) : String(userResponse).toLowerCase();
              const correctText = isCaseSensitive ? String(correctAnswer) : String(correctAnswer).toLowerCase();
              if (userText.includes(correctText)) score += 1;
            }
          }
        }
      });
    });

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return { score, maxScore, percentage };
  };

  // Función para completar el ejercicio y calcular puntuación
  const completeExercise = () => {
    const result = evaluateExercise();
    setExerciseScore(result);
    setExerciseCompleted(true);
  };

  const handleActionClick = (action: StudyInteractiveExerciseAction, stepIndex: number) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId) return;

    // Guardar respuesta
    setActionResponses(prev => ({
      ...prev,
      [`${action.step_id}_${action.id}`]: true
    }));

    // Marcar paso como completado
    setStepCompleted(prev => ({
      ...prev,
      [`${exerciseId}_${stepIndex}`]: true
    }));

    // Avanzar al siguiente paso
    const steps = currentTopic?.interactive_exercise?.steps || [];
    if (stepIndex < steps.length - 1) {
      setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
    }
  };

  const handleTextSubmit = (action: StudyInteractiveExerciseAction, stepIndex: number, value: string) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId || !value.trim()) return;

    // Guardar respuesta
    setActionResponses(prev => ({
      ...prev,
      [`${action.step_id}_${action.id}`]: value
    }));

    // Marcar paso como completado
    setStepCompleted(prev => ({
      ...prev,
      [`${exerciseId}_${stepIndex}`]: true
    }));

    // Avanzar al siguiente paso
    const steps = currentTopic?.interactive_exercise?.steps || [];
    if (stepIndex < steps.length - 1) {
      setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
    }
  };

  const goToNextTopic = () => {
    const topicsInCurrentSession = currentSession?.topics?.length || 0;
    if (currentTopicIndex < topicsInCurrentSession - 1) {
      selectTopic(currentSessionIndex, currentTopicIndex + 1);
    } else if (currentSessionIndex < (material?.sessions?.length || 0) - 1) {
      setExpandedSessions(prev => new Set([...prev, currentSessionIndex + 1]));
      selectTopic(currentSessionIndex + 1, 0);
    }
  };

  const hasNextTopic = () => {
    const topicsInCurrentSession = currentSession?.topics?.length || 0;
    return currentTopicIndex < topicsInCurrentSession - 1 || currentSessionIndex < (material?.sessions?.length || 0) - 1;
  };

  const hasPreviousTopic = () => {
    return currentTopicIndex > 0 || currentSessionIndex > 0;
  };

  // Obtener los tabs disponibles para el tema actual en orden: Lectura > Video > Interactivo > Descargable
  const getAvailableTabs = (topic: any): Array<'reading' | 'video' | 'downloadable' | 'interactive'> => {
    if (!topic) return [];
    const tabs: Array<'reading' | 'video' | 'downloadable' | 'interactive'> = [];
    if (topic.allow_reading !== false && topic.reading) tabs.push('reading');
    if (topic.allow_video !== false && topic.video) tabs.push('video');
    if (topic.allow_interactive !== false && topic.interactive_exercise) tabs.push('interactive');
    if (topic.allow_downloadable !== false && topic.downloadable_exercise) tabs.push('downloadable');
    return tabs;
  };

  // Navegar al siguiente contenido o tema
  const goToNextContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    
    if (currentTabIndex < availableTabs.length - 1) {
      // Hay más contenido en este tema, ir al siguiente tab
      setActiveTab(availableTabs[currentTabIndex + 1]);
      // Reset ejercicio si cambiamos de tab
      if (activeTab === 'interactive') {
        resetExerciseState();
      }
    } else {
      // Estamos en el último contenido, ir al siguiente tema
      goToNextTopic();
    }
  };

  // Navegar al contenido o tema anterior
  const goToPreviousContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    
    if (currentTabIndex > 0) {
      // Hay contenido anterior en este tema
      setActiveTab(availableTabs[currentTabIndex - 1]);
      // Reset ejercicio si cambiamos de tab
      if (activeTab === 'interactive') {
        resetExerciseState();
      }
    } else if (hasPreviousTopic()) {
      // Ir al tema anterior y seleccionar el último tab
      // Calculamos el tema anterior
      let prevSessionIdx = currentSessionIndex;
      let prevTopicIdx = currentTopicIndex - 1;
      
      if (currentTopicIndex === 0 && currentSessionIndex > 0) {
        prevSessionIdx = currentSessionIndex - 1;
        const prevSession = material?.sessions?.[prevSessionIdx];
        prevTopicIdx = (prevSession?.topics?.length || 1) - 1;
      }
      
      const prevTopic = material?.sessions?.[prevSessionIdx]?.topics?.[prevTopicIdx];
      const prevTabs = getAvailableTabs(prevTopic);
      
      setCurrentSessionIndex(prevSessionIdx);
      setCurrentTopicIndex(prevTopicIdx);
      resetExerciseState();
      
      if (prevTabs.length > 0) {
        setActiveTab(prevTabs[prevTabs.length - 1]);
      } else {
        setFirstAvailableTab(prevTopic);
      }
    }
  };

  // Verificar si hay siguiente contenido (dentro del tema o en otro tema)
  const hasNextContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    return currentTabIndex < availableTabs.length - 1 || hasNextTopic();
  };

  // Verificar si hay contenido anterior
  const hasPreviousContent = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    return currentTabIndex > 0 || hasPreviousTopic();
  };

  // Obtener el texto del botón siguiente
  const getNextButtonText = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    if (currentTabIndex < availableTabs.length - 1) {
      const nextTab = availableTabs[currentTabIndex + 1];
      switch (nextTab) {
        case 'reading': return 'Ir a Lectura';
        case 'video': return 'Ir a Video';
        case 'downloadable': return 'Ir a Descargable';
        case 'interactive': return 'Ir a Ejercicio';
        default: return 'Siguiente';
      }
    }
    return 'Siguiente tema';
  };

  // Obtener el texto del botón anterior
  const getPreviousButtonText = () => {
    const availableTabs = getAvailableTabs(currentTopic);
    const currentTabIndex = availableTabs.indexOf(activeTab);
    if (currentTabIndex > 0) {
      const prevTab = availableTabs[currentTabIndex - 1];
      switch (prevTab) {
        case 'reading': return 'Ir a Lectura';
        case 'video': return 'Ir a Video';
        case 'downloadable': return 'Ir a Descargable';
        case 'interactive': return 'Ir a Ejercicio';
        default: return 'Anterior';
      }
    }
    return 'Tema anterior';
  };

  const toggleSession = (idx: number) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  // Obtener URL de video embed
  const getVideoEmbedUrl = (url: string) => {
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?\s]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner message="Cargando contenido..." />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600">Material no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header minimalista */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <button
              onClick={() => navigate(`/study-contents/${materialId}`)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Volver</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <h1 className="font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-md">
              {material.title}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Progreso */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-sm text-gray-500">
                {getCurrentTopicGlobalIndex()} de {getTotalTopics()} temas
              </div>
              <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <span className="text-sm font-medium text-blue-600">{getProgressPercentage()}%</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Navegación del curso */}
        <aside 
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:min-w-0'}
            fixed lg:relative inset-y-0 left-0 z-40 w-72 lg:w-64 lg:min-w-[256px]
            bg-gray-50 border-r border-gray-200 
            transform transition-all duration-300 ease-in-out
            top-14 lg:top-0
          `}
        >
          <div className="h-full overflow-y-auto">
            {/* Header del sidebar */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="text-blue-600 mb-1">
                <span className="text-xs font-medium uppercase tracking-wide">Contenido del curso</span>
              </div>
              <p className="text-sm text-gray-500">
                {material.sessions?.length || 0} sesiones · {getTotalTopics()} temas
              </p>
            </div>

            {/* Lista de sesiones y temas */}
            <nav className="p-2">
              {material.sessions?.map((session, sIdx) => (
                <div key={session.id} className="mb-1">
                  {/* Session header */}
                  <button
                    onClick={() => toggleSession(sIdx)}
                    className="w-full flex items-start gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className={`transform transition-transform mt-0.5 flex-shrink-0 ${expandedSessions.has(sIdx) ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 break-words">
                        <span className="text-gray-400 mr-1">{session.session_number}.</span>
                        {session.title}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                      {session.topics?.length || 0}
                    </span>
                  </button>

                  {/* Topics list */}
                  {expandedSessions.has(sIdx) && (
                    <div className="ml-4 border-l-2 border-gray-200">
                      {session.topics?.map((topic, tIdx) => {
                        const isActive = sIdx === currentSessionIndex && tIdx === currentTopicIndex;
                        
                        return (
                          <button
                            key={topic.id}
                            onClick={() => selectTopic(sIdx, tIdx)}
                            className={`
                              w-full p-3 pl-4 text-left transition-colors
                              ${isActive 
                                ? 'bg-blue-50 border-l-2 border-blue-600 -ml-0.5' 
                                : 'hover:bg-gray-100 border-l-2 border-transparent -ml-0.5'
                              }
                            `}
                          >
                            <p className={`text-sm ${isActive ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                              <span className="text-gray-400 mr-1">{session.session_number}.{tIdx + 1}</span> {topic.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Overlay para móvil */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/30 z-30 lg:hidden top-14"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Contenido principal */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <span>Sesión {currentSession?.session_number} - {currentSession?.title}</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 font-medium">{currentTopic?.title}</span>
            </div>

            {/* Título del tema */}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentTopic?.title}</h1>
            {currentTopic?.description && (
              <p className="text-gray-600 text-lg mb-8">{currentTopic.description}</p>
            )}

            {/* Tabs de contenido */}
            <div className="border-b border-gray-200 mb-8">
              <nav className="flex gap-8">
                {currentTopic?.allow_reading !== false && (
                  <button
                    onClick={() => setActiveTab('reading')}
                    className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'reading'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Lectura
                    </div>
                  </button>
                )}
                {currentTopic?.allow_video !== false && (
                  <button
                    onClick={() => setActiveTab('video')}
                    className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'video'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Video
                    </div>
                  </button>
                )}
                {currentTopic?.allow_interactive !== false && (
                  <button
                    onClick={() => setActiveTab('interactive')}
                    className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'interactive'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4" />
                      Ejercicio
                    </div>
                  </button>
                )}
                {currentTopic?.allow_downloadable !== false && (
                  <button
                    onClick={() => setActiveTab('downloadable')}
                    className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'downloadable'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Recursos
                    </div>
                  </button>
                )}
              </nav>
            </div>

            {/* Contenido según tab activa */}
            <div className="min-h-[400px]">
              {/* Video */}
              {activeTab === 'video' && (
                <div ref={videoContainerRef}>
                  {currentTopic?.video ? (
                    <div className="space-y-4">
                      {/* Título del video - arriba */}
                      <h2 className="text-xl font-semibold text-gray-900">{currentTopic.video.title}</h2>
                      
                      {/* Video container - usa video nativo para archivos blob */}
                      {currentTopic.video.video_url?.includes('blob.core.windows.net') ? (
                        // Reproductor personalizado para archivos de Azure Blob
                        <CustomVideoPlayer
                          src={currentTopic.video.video_url}
                          className="w-full shadow-lg"
                        />
                      ) : (
                        // iframe para YouTube/Vimeo
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            src={getVideoEmbedUrl(currentTopic.video.video_url)}
                            className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                            style={{ border: 'none' }}
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          />
                        </div>
                      )}
                      
                      {/* Descripción del video - abajo */}
                      {currentTopic.video.description && (
                        <div 
                          className="pt-4 text-gray-600 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.video.description) }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Video className="w-16 h-16 mb-4 text-gray-300" />
                      <p className="text-lg">No hay video disponible para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Lectura */}
              {activeTab === 'reading' && (
                <div>
                  {currentTopic?.reading ? (
                    <article className="w-full">
                      <h2 className="text-2xl font-semibold text-gray-900 mb-6">{currentTopic.reading.title}</h2>
                      <div 
                        className="reading-content prose prose-lg prose-gray max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400 prose-img:max-w-full prose-pre:max-w-full prose-pre:overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.reading.content || '') }}
                      />
                    </article>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <FileText className="w-16 h-16 mb-4 text-gray-300" />
                      <p className="text-lg">No hay contenido de lectura para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Descargable */}
              {activeTab === 'downloadable' && (
                <div>
                  {currentTopic?.downloadable_exercise ? (
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Ejercicio descargable</h2>
                      
                      {/* Instrucciones del ejercicio */}
                      {currentTopic.downloadable_exercise.description && (
                        <div 
                          className="text-gray-600 mb-5 text-sm leading-relaxed prose prose-sm max-w-none break-words"
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.downloadable_exercise.description) }}
                        />
                      )}
                      
                      <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 mx-1 mb-1">
                        <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
                          <Download className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{currentTopic.downloadable_exercise.title}</p>
                          <p className="text-sm text-gray-500 truncate">{currentTopic.downloadable_exercise.file_name}</p>
                        </div>
                        <a
                          href={currentTopic.downloadable_exercise.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 flex-shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          Descargar
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Download className="w-16 h-16 mb-4 text-gray-300" />
                      <p className="text-lg">No hay ejercicio descargable para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Interactivo */}
              {activeTab === 'interactive' && (
                <div ref={exerciseContainerRef}>
                  {currentTopic?.interactive_exercise ? (
                    !exerciseStarted ? (
                      // Vista inicial - Comenzar ejercicio (estilo profesional)
                      <div className="space-y-6">
                        {/* Header del ejercicio */}
                        <div className="border-b border-gray-200 pb-4">
                          <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                              <Gamepad2 className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <h2 className="text-2xl font-bold text-gray-900">{currentTopic.interactive_exercise.title}</h2>
                              <p className="text-gray-500 mt-1">
                                Ejercicio interactivo · {currentTopic.interactive_exercise.steps?.length || 0} pasos
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Descripción/Instrucciones */}
                        {currentTopic.interactive_exercise.description && (
                          <div ref={instructionsRef} className="bg-gray-50 rounded-xl p-6 border border-gray-200 relative">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Instrucciones
                            </h3>
                            <div 
                              className="prose prose-sm max-w-none text-gray-600 reading-content"
                              style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.interactive_exercise.description.replace(/\u00a0/g, ' ')) }}
                            />
                            
                            {/* Botón circular para scroll hacia abajo */}
                            {showScrollHint && (
                              <button
                                onClick={() => {
                                  startExerciseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 animate-bounce z-10"
                                title="Ver sección para iniciar ejercicio"
                              >
                                <ChevronDown className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Información del ejercicio */}
                        <div ref={startExerciseRef} className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-blue-700">
                                <PlayCircle className="w-5 h-5" />
                                <span className="font-medium">Listo para comenzar</span>
                              </div>
                            </div>
                            <button
                              onClick={startExercise}
                              disabled={!currentTopic.interactive_exercise.steps?.length}
                              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <PlayCircle className="w-5 h-5" />
                              Comenzar ejercicio
                            </button>
                          </div>
                          {!currentTopic.interactive_exercise.steps?.length && (
                            <p className="text-amber-600 text-sm mt-3 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              Este ejercicio aún no tiene pasos configurados
                            </p>
                          )}
                        </div>
                      </div>
                    ) : exerciseCompleted ? (
                      // Vista de ejercicio completado con calificación
                      <div className={`rounded-xl p-8 text-center ${
                        exerciseScore && exerciseScore.percentage >= 70 
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50' 
                          : 'bg-gradient-to-br from-amber-50 to-orange-50'
                      }`}>
                        {/* Círculo con calificación */}
                        <div className="relative inline-flex items-center justify-center mb-6">
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              className="text-gray-200"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={`${(exerciseScore?.percentage || 0) * 3.52} 352`}
                              className={exerciseScore && exerciseScore.percentage >= 70 ? 'text-green-500' : 'text-amber-500'}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-3xl font-bold ${
                              exerciseScore && exerciseScore.percentage >= 70 ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              {exerciseScore?.percentage || 0}%
                            </span>
                            <span className="text-xs text-gray-500">
                              {exerciseScore?.score || 0}/{exerciseScore?.maxScore || 0}
                            </span>
                          </div>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          {exerciseScore && exerciseScore.percentage >= 70 
                            ? '¡Excelente trabajo!' 
                            : 'Sigue practicando'}
                        </h2>
                        <p className="text-gray-600 mb-2">
                          Has completado el ejercicio "{currentTopic.interactive_exercise.title}"
                        </p>
                        <p className={`text-sm mb-6 ${
                          exerciseScore && exerciseScore.percentage >= 70 ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {exerciseScore && exerciseScore.percentage >= 100 
                            ? '¡Perfecto! Todas las respuestas correctas'
                            : exerciseScore && exerciseScore.percentage >= 70 
                            ? '¡Buen trabajo! Excelente desempeño'
                            : 'Puedes mejorar practicando más'}
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-3">
                          <button
                            onClick={resetExerciseState}
                            className="px-6 py-3 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2 border border-gray-300"
                          >
                            <RotateCcw className="w-5 h-5" />
                            Practicar de nuevo
                          </button>
                          {hasNextTopic() && (
                            <button
                              onClick={goToNextTopic}
                              className={`px-6 py-3 text-white rounded-lg font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                                exerciseScore && exerciseScore.percentage >= 70 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                            >
                              Continuar con el material
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Vista de ejecución del ejercicio - Pasos (diseño profesional)
                      <div className="space-y-5">
                        {(() => {
                          const steps = currentTopic.interactive_exercise.steps || [];
                          const currentStep = steps[currentStepIndex];
                          const exerciseId = currentTopic.interactive_exercise.id;
                          const isStepDone = stepCompleted[`${exerciseId}_${currentStepIndex}`];

                          if (!currentStep) {
                            return (
                              <div className="text-center py-6">
                                <Image className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm">Este ejercicio no tiene pasos configurados</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              {/* Header del ejercicio con progreso */}
                              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                      <Gamepad2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                      <h3 className="font-semibold text-gray-900">{currentTopic.interactive_exercise.title}</h3>
                                      <p className="text-sm text-gray-500">
                                        Paso {currentStepIndex + 1} de {steps.length}
                                        {currentStep.title && <span className="text-blue-600 font-medium"> · {currentStep.title}</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={resetExerciseState}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Salir del ejercicio"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                                
                                {/* Indicador de pasos dentro del header */}
                                {steps.length > 1 && (
                                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                                    <div className="flex items-center justify-center gap-2">
                                      {steps.map((_: StudyInteractiveExerciseStep, idx: number) => (
                                        <div
                                          key={idx}
                                          className={`h-2 rounded-full transition-all ${
                                            idx === currentStepIndex 
                                              ? 'w-10 bg-blue-500 shadow-sm' 
                                              : idx < currentStepIndex || stepCompleted[`${exerciseId}_${idx}`]
                                              ? 'w-5 bg-green-400' 
                                              : 'w-5 bg-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Descripción del paso - Instrucciones */}
                              {currentStep.description && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                                      <FileText className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="text-sm font-semibold text-amber-800 mb-2">Instrucciones del paso</h4>
                                      <div 
                                        className="prose prose-sm max-w-none text-amber-900 reading-content"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentStep.description.replace(/\u00a0/g, ' ')) }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Área de la imagen con acciones superpuestas */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div 
                                  ref={imageContainerRef}
                                  className="relative mx-auto bg-gray-50"
                                  style={{ 
                                    maxWidth: '100%',
                                    maxHeight: 'calc(100vh - 400px)',
                                    aspectRatio: currentStep.image_width && currentStep.image_height 
                                      ? `${currentStep.image_width} / ${currentStep.image_height}` 
                                      : 'auto'
                                  }}
                                >
                                  {currentStep.image_url ? (
                                    <img
                                      src={currentStep.image_url}
                                      alt={currentStep.title || `Paso ${currentStepIndex + 1}`}
                                      className="w-full h-full object-contain"
                                      style={{ maxHeight: 'calc(100vh - 400px)' }}
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center h-48 bg-gray-100">
                                      <Image className="w-12 h-12 text-gray-300" />
                                    </div>
                                  )}

                                  {/* Acciones superpuestas sobre la imagen */}
                                  {currentStep.actions?.map((action: StudyInteractiveExerciseAction) => (
                                    <ExerciseActionOverlay
                                      key={action.id}
                                      action={action}
                                      stepIndex={currentStepIndex}
                                      isStepCompleted={isStepDone}
                                      currentValue={actionResponses[`${action.step_id}_${action.id}`]}
                                      onButtonClick={handleActionClick}
                                      onTextSubmit={handleTextSubmit}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Navegación de pasos - estilo profesional */}
                              <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex justify-between items-center shadow-sm">
                                <button
                                  onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                                  disabled={currentStepIndex === 0}
                                  className={`px-4 py-2.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
                                    currentStepIndex === 0 
                                      ? 'text-gray-300 cursor-not-allowed' 
                                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                  }`}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                  Paso anterior
                                </button>
                                
                                {currentStepIndex < steps.length - 1 ? (
                                  <button
                                    onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm"
                                  >
                                    Siguiente paso
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={completeExercise}
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors shadow-sm"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Finalizar ejercicio
                                  </button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Gamepad2 className="w-16 h-16 mb-4 text-gray-300" />
                      <p className="text-lg">No hay ejercicio interactivo para este tema</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Espaciado para la barra fija inferior */}
            <div className="h-20" />
          </div>
        </main>
      </div>

      {/* Barra de navegación fija inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousContent}
              disabled={!hasPreviousContent()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                hasPreviousContent()
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">{getPreviousButtonText()}</span>
            </button>

            {/* Indicador de progreso central */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">
                {getCurrentTopicGlobalIndex()} / {getTotalTopics()}
              </span>
              <div className="w-20 sm:w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <span className="text-sm font-medium text-blue-600">{getProgressPercentage()}%</span>
            </div>

            <button
              onClick={goToNextContent}
              disabled={!hasNextContent()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                hasNextContent()
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <span className="hidden sm:inline">{getNextButtonText()}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para acciones superpuestas en el ejercicio interactivo
interface ExerciseActionOverlayProps {
  action: StudyInteractiveExerciseAction;
  stepIndex: number;
  isStepCompleted: boolean;
  currentValue: any;
  onButtonClick: (action: StudyInteractiveExerciseAction, stepIndex: number) => void;
  onTextSubmit: (action: StudyInteractiveExerciseAction, stepIndex: number, value: string) => void;
}

const ExerciseActionOverlay: React.FC<ExerciseActionOverlayProps> = ({
  action,
  stepIndex,
  isStepCompleted,
  currentValue,
  onButtonClick,
  onTextSubmit
}) => {
  const [textValue, setTextValue] = useState(currentValue || '');
  const [showFeedback, setShowFeedback] = useState(false);

  // Estilo para posicionar la acción sobre la imagen
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${action.position_x}%`,
    top: `${action.position_y}%`,
    width: `${action.width}%`,
    height: `${action.height}%`,
    pointerEvents: isStepCompleted ? 'none' : 'auto',
    opacity: 0, // Invisible para que el usuario descubra dónde hacer clic
  };

  if (action.action_type === 'button') {
    return (
      <button
        style={style}
        onClick={() => {
          setShowFeedback(true);
          setTimeout(() => {
            setShowFeedback(false);
            onButtonClick(action, stepIndex);
          }, 300);
        }}
        disabled={isStepCompleted}
        className={`flex items-center justify-center text-xs font-medium rounded border-2 transition-all ${
          currentValue 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : showFeedback
            ? 'bg-blue-200 border-blue-600 scale-95'
            : 'bg-blue-100 border-blue-400 text-blue-700 hover:bg-blue-200 hover:border-blue-500'
        }`}
        title={action.label || 'Clic aquí'}
      >
        {action.label && (
          <span className="truncate px-1">{action.label}</span>
        )}
        {currentValue && <span className="ml-1">✓</span>}
      </button>
    );
  }

  if (action.action_type === 'text_input') {
    return (
      <div style={style} className="flex items-center">
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textValue.trim()) {
              onTextSubmit(action, stepIndex, textValue);
            }
          }}
          onBlur={() => {
            if (textValue.trim() && !currentValue) {
              onTextSubmit(action, stepIndex, textValue);
            }
          }}
          placeholder={action.placeholder || 'Escribe aquí...'}
          disabled={isStepCompleted}
          className={`w-full h-full px-2 text-sm border-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            currentValue 
              ? 'bg-green-50 border-green-500' 
              : 'border-gray-400 bg-white'
          }`}
          style={{
            color: action.text_color || '#000000',
            fontFamily: action.font_family || 'Arial',
            opacity: 1, // El input sí debe ser visible
          }}
        />
      </div>
    );
  }

  return null;
};

export default StudyContentPreviewPage;
