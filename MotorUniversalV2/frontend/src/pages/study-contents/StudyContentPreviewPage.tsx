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
  StudyInteractiveExerciseAction,
  registerContentProgress,
  getTopicProgress,
  TopicProgressResponse,
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

// Función para calcular similitud entre dos strings (algoritmo de Levenshtein)
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Crear matriz de distancias
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Llenar la matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // eliminación
        matrix[i][j - 1] + 1,      // inserción
        matrix[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  
  // Calcular porcentaje de similitud
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = Math.round(((maxLen - distance) / maxLen) * 100);
  
  return similarity;
};

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
  const [actionErrors, setActionErrors] = useState<Record<string, { message: string; attempts: number }>>({});
  const [showErrorModal, setShowErrorModal] = useState<{ message: string; actionKey: string } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const exerciseContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const instructionsRef = useRef<HTMLDivElement>(null);
  const startExerciseRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLDivElement>(null);
  const readingContentRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showDownloadScrollHint, setShowDownloadScrollHint] = useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);

  // Estados de progreso del estudiante
  const [topicProgress, setTopicProgress] = useState<TopicProgressResponse | null>(null);
  const [completedContents, setCompletedContents] = useState<{
    reading: Set<number>;
    video: Set<number>;
    downloadable: Set<number>;
    interactive: Set<number>;
  }>({
    reading: new Set(),
    video: new Set(),
    downloadable: new Set(),
    interactive: new Set(),
  });

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

  // Definir currentSession y currentTopic antes de usarlos en useEffect
  const currentSession = material?.sessions?.[currentSessionIndex];
  const currentTopic = currentSession?.topics?.[currentTopicIndex];

  // Cargar progreso del tema actual
  useEffect(() => {
    const loadTopicProgress = async () => {
      if (!currentTopic?.id) return;
      
      try {
        const progress = await getTopicProgress(currentTopic.id);
        setTopicProgress(progress);
        
        // Actualizar sets de contenidos completados
        const newCompleted = {
          reading: new Set<number>(),
          video: new Set<number>(),
          downloadable: new Set<number>(),
          interactive: new Set<number>(),
        };
        
        Object.entries(progress.content_progress.reading).forEach(([id, p]) => {
          if (p.is_completed) newCompleted.reading.add(Number(id));
        });
        Object.entries(progress.content_progress.video).forEach(([id, p]) => {
          if (p.is_completed) newCompleted.video.add(Number(id));
        });
        Object.entries(progress.content_progress.downloadable).forEach(([id, p]) => {
          if (p.is_completed) newCompleted.downloadable.add(Number(id));
        });
        Object.entries(progress.content_progress.interactive).forEach(([id, p]) => {
          if (p.is_completed) newCompleted.interactive.add(Number(id));
        });
        
        setCompletedContents(newCompleted);
      } catch (error) {
        console.error('Error loading topic progress:', error);
      }
    };
    
    loadTopicProgress();
  }, [currentTopic?.id]);

  // Función para registrar progreso de contenido
  const markContentCompleted = async (
    contentType: 'reading' | 'video' | 'downloadable' | 'interactive',
    contentId: number,
    score?: number
  ) => {
    try {
      await registerContentProgress(contentType, contentId, { 
        is_completed: true,
        score 
      });
      
      // Actualizar estado local
      setCompletedContents(prev => ({
        ...prev,
        [contentType]: new Set([...prev[contentType], contentId])
      }));
      
      // Recargar progreso del tema
      if (currentTopic?.id) {
        const progress = await getTopicProgress(currentTopic.id);
        setTopicProgress(progress);
      }
    } catch (error) {
      console.error('Error registering progress:', error);
    }
  };

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

  // Detectar si el botón de iniciar ejercicio no está visible en pantalla
  useEffect(() => {
    const checkStartButtonVisibility = () => {
      if (activeTab === 'interactive' && !exerciseStarted && startExerciseRef.current) {
        const startRect = startExerciseRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Mostrar el hint si el botón de inicio NO está visible en el viewport
        // El botón está visible si su parte superior está dentro del viewport
        const isButtonVisible = startRect.top < viewportHeight && startRect.bottom > 0;
        setShowScrollHint(!isButtonVisible);
      } else {
        setShowScrollHint(false);
      }
    };

    // Ejecutar después de un delay para asegurar que el DOM está renderizado
    const timeoutId = setTimeout(checkStartButtonVisibility, 300);
    
    // También ejecutar inmediatamente
    checkStartButtonVisibility();
    
    window.addEventListener('scroll', checkStartButtonVisibility);
    window.addEventListener('resize', checkStartButtonVisibility);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', checkStartButtonVisibility);
      window.removeEventListener('resize', checkStartButtonVisibility);
    };
  }, [activeTab, exerciseStarted, currentTopic]);

  // Detectar si el botón de descarga no está visible en pantalla
  useEffect(() => {
    const checkDownloadButtonVisibility = () => {
      if (activeTab === 'downloadable' && downloadButtonRef.current) {
        const downloadRect = downloadButtonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const isButtonVisible = downloadRect.top < viewportHeight && downloadRect.bottom > 0;
        setShowDownloadScrollHint(!isButtonVisible);
      } else {
        setShowDownloadScrollHint(false);
      }
    };

    const timeoutId = setTimeout(checkDownloadButtonVisibility, 300);
    checkDownloadButtonVisibility();
    
    window.addEventListener('scroll', checkDownloadButtonVisibility);
    window.addEventListener('resize', checkDownloadButtonVisibility);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', checkDownloadButtonVisibility);
      window.removeEventListener('resize', checkDownloadButtonVisibility);
    };
  }, [activeTab, currentTopic]);

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
    // Usar el porcentaje de progreso del tema actual si está disponible
    if (topicProgress) {
      return Math.round(topicProgress.topic_progress.progress_percentage);
    }
    // Fallback al cálculo original si no hay datos de progreso
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
    setActionErrors({});
    setShowErrorModal(null);
    setImageDimensions(null);
  };

  // Función para calcular las dimensiones reales de la imagen renderizada
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Obtener las dimensiones renderizadas de la imagen (no las naturales)
    setImageDimensions({
      width: img.clientWidth,
      height: img.clientHeight
    });
  };

  // Recalcular dimensiones cuando cambia el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      if (imageRef.current) {
        setImageDimensions({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resetear dimensiones cuando cambia el paso
  useEffect(() => {
    setImageDimensions(null);
  }, [currentStepIndex]);

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
        const responseKey = `${step.id}_${action.id}`;
        const userResponse = actionResponses[responseKey];

        if (action.action_type === 'button') {
          // Para botones, solo suma puntos si el botón es correcto (correct_answer = "true", "1", "correct")
          const isCorrectButton = action.correct_answer && 
            ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());
          
          if (isCorrectButton) {
            // Este botón es correcto, suma al maxScore
            maxScore += 1;
            // Si el usuario lo clickeó, suma puntos
            if (userResponse) score += 1;
          }
          // Los botones incorrectos no suman al maxScore ni al score
        } else if (action.action_type === 'text_input') {
          // Para inputs de texto, comparar con respuesta correcta
          maxScore += 1;
          const correctAnswer = action.correct_answer || '';
          const isCaseSensitive = action.is_case_sensitive;
          const scoringMode = action.scoring_mode || 'exact';

          if (userResponse && correctAnswer) {
            // Verificar si la respuesta tiene formato de similitud (objeto con value y similarity)
            if (scoringMode === 'similarity' && typeof userResponse === 'object' && userResponse.similarity !== undefined) {
              // Usar el porcentaje de similitud guardado directamente
              score += userResponse.similarity / 100;
            } else {
              // Para otros modos, calcular normalmente
              const userText = typeof userResponse === 'object' ? String(userResponse.value).trim() : String(userResponse).trim();
              const correctText = String(correctAnswer).trim();
              const compareUser = isCaseSensitive ? userText : userText.toLowerCase();
              const compareCorrect = isCaseSensitive ? correctText : correctText.toLowerCase();

              if (scoringMode === 'exact') {
                // 0% o 100% - debe coincidir exactamente
                if (compareUser === compareCorrect) score += 1;
              } else if (scoringMode === 'similarity') {
                // Fallback: calcular similitud si no se guardó
                const similarity = calculateSimilarity(compareUser, compareCorrect);
                score += similarity / 100;
              } else if (scoringMode === 'contains') {
                if (compareUser.includes(compareCorrect)) score += 1;
              }
            }
          }
        }
      });
    });

    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return { score, maxScore, percentage };
  };

  // Función para completar el ejercicio y calcular puntuación
  const completeExercise = async () => {
    const result = evaluateExercise();
    setExerciseScore(result);
    setExerciseCompleted(true);
    
    // Si la calificación es >= 80%, registrar como completado
    if (result.percentage >= 80 && currentTopic?.interactive_exercise?.id) {
      const exerciseId = Number(currentTopic.interactive_exercise.id);
      if (!completedContents.interactive.has(exerciseId)) {
        await markContentCompleted('interactive', exerciseId, result.percentage);
      }
    }
  };

  const handleActionClick = (action: StudyInteractiveExerciseAction, stepIndex: number) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId) return;

    const actionKey = `${action.step_id}_${action.id}`;
    
    // Verificar si el botón es correcto
    const isCorrectButton = action.correct_answer && 
      ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());

    if (isCorrectButton) {
      // Botón correcto - guardar respuesta y avanzar
      setActionResponses(prev => ({
        ...prev,
        [actionKey]: true
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
    } else {
      // Botón incorrecto - manejar según configuración
      const currentError = actionErrors[actionKey] || { message: '', attempts: 0 };
      const newAttempts = currentError.attempts + 1;
      // max_attempts son intentos ADICIONALES después del primer error
      const additionalAttempts = action.max_attempts ?? 1;
      const errorMessage = action.error_message || 'Respuesta incorrecta. Inténtalo de nuevo.';
      const onErrorAction = (action.on_error_action || 'next_step') as string;

      // Verificar si la acción es terminar ejercicio inmediatamente
      // Soportar ambos valores: 'end_exercise' (legacy) y 'next_exercise' (actual)
      if (onErrorAction === 'end_exercise' || onErrorAction === 'next_exercise') {
        // Cerrar modal y terminar ejercicio inmediatamente
        setShowErrorModal(null);
        setActionResponses(prev => ({ ...prev, [actionKey]: false }));
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        setTimeout(() => completeExercise(), 300);
        return;
      }

      // Si la acción es pasar al siguiente paso (sin reintentos)
      if (onErrorAction === 'next_step') {
        // Marcar como completado (aunque incorrecto) y avanzar
        setActionResponses(prev => ({ ...prev, [actionKey]: false }));
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          setTimeout(() => completeExercise(), 300);
        }
        return;
      }

      // Si es 'show_message' o cualquier otro valor - mostrar error con reintentos

      // Actualizar contador de intentos
      setActionErrors(prev => ({
        ...prev,
        [actionKey]: { message: errorMessage, attempts: newAttempts }
      }));

      // Mostrar modal de error
      setShowErrorModal({ message: errorMessage, actionKey });

      // Manejar acción si se agotaron los intentos adicionales
      // Agotar intentos cuando newAttempts supera los adicionales permitidos
      if (newAttempts > additionalAttempts) {
        // Cerrar modal inmediatamente
        setShowErrorModal(null);
        
        // Marcar como completado (aunque incorrecto)
        setActionResponses(prev => ({ ...prev, [actionKey]: false }));
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          // Hay más pasos, avanzar al siguiente
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          // Es el último paso, concluir ejercicio inmediatamente
          setTimeout(() => completeExercise(), 300);
        }
      }
    }
  };

  const handleTextSubmit = (action: StudyInteractiveExerciseAction, stepIndex: number, value: string) => {
    const exerciseId = currentTopic?.interactive_exercise?.id;
    if (!exerciseId || !value.trim()) return;

    const actionKey = `${action.step_id}_${action.id}`;
    const correctAnswer = action.correct_answer || '';
    const isCaseSensitive = action.is_case_sensitive;
    const scoringMode = action.scoring_mode || 'exact';

    const userText = value.trim();
    const correctText = correctAnswer.trim();
    const compareUser = isCaseSensitive ? userText : userText.toLowerCase();
    const compareCorrect = isCaseSensitive ? correctText : correctText.toLowerCase();

    // Modo similitud: siempre acepta la respuesta y guarda el porcentaje de similitud
    if (scoringMode === 'similarity' && correctText) {
      const similarityScore = calculateSimilarity(compareUser, compareCorrect);
      
      // Guardar respuesta con el porcentaje de similitud
      setActionResponses(prev => ({
        ...prev,
        [actionKey]: { value, similarity: similarityScore }
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
      return;
    }

    // Para otros modos: verificar si la respuesta es correcta
    let isCorrect = false;

    if (correctText) {
      if (scoringMode === 'exact') {
        // 0% o 100% - debe coincidir exactamente
        isCorrect = compareUser === compareCorrect;
      } else if (scoringMode === 'contains') {
        isCorrect = compareUser.includes(compareCorrect);
      } else if (scoringMode === 'regex') {
        try {
          const regex = new RegExp(correctText, isCaseSensitive ? '' : 'i');
          isCorrect = regex.test(userText);
        } catch {
          isCorrect = false;
        }
      }
    } else {
      // Si no hay respuesta correcta definida, cualquier respuesta es válida
      isCorrect = true;
    }

    if (isCorrect) {
      // Respuesta correcta - guardar y avanzar
      setActionResponses(prev => ({
        ...prev,
        [actionKey]: value
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
    } else {
      // Respuesta incorrecta - manejar según configuración
      const currentError = actionErrors[actionKey] || { message: '', attempts: 0 };
      const newAttempts = currentError.attempts + 1;
      // max_attempts son intentos ADICIONALES después del primer error
      const additionalAttempts = action.max_attempts ?? 1;
      const errorMessage = action.error_message || 'Respuesta incorrecta. Inténtalo de nuevo.';
      const onErrorAction = (action.on_error_action || 'next_step') as string;

      // Verificar si la acción es terminar ejercicio inmediatamente
      if (onErrorAction === 'end_exercise' || onErrorAction === 'next_exercise') {
        setShowErrorModal(null);
        setActionResponses(prev => ({ ...prev, [actionKey]: value }));
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        setTimeout(() => completeExercise(), 300);
        return;
      }

      // Si la acción es pasar al siguiente paso (sin reintentos)
      if (onErrorAction === 'next_step') {
        setActionResponses(prev => ({ ...prev, [actionKey]: value }));
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          setTimeout(() => completeExercise(), 300);
        }
        return;
      }

      // Si es 'show_message' o cualquier otro valor - mostrar error con reintentos
      setActionErrors(prev => ({
        ...prev,
        [actionKey]: { message: errorMessage, attempts: newAttempts }
      }));

      // Mostrar modal de error
      setShowErrorModal({ message: errorMessage, actionKey });

      // Manejar acción si se agotaron los intentos adicionales
      if (newAttempts > additionalAttempts) {
        setShowErrorModal(null);
        
        setActionResponses(prev => ({ ...prev, [actionKey]: value }));
        setStepCompleted(prev => ({ ...prev, [`${exerciseId}_${stepIndex}`]: true }));
        
        const steps = currentTopic?.interactive_exercise?.steps || [];
        if (stepIndex < steps.length - 1) {
          setTimeout(() => setCurrentStepIndex(stepIndex + 1), 300);
        } else {
          setTimeout(() => completeExercise(), 300);
        }
      }
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
            {/* Progreso del tema actual */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-sm text-gray-500">
                Tema {getCurrentTopicGlobalIndex()}/{getTotalTopics()}
                {topicProgress && (
                  <span className="ml-1">
                    ({topicProgress.topic_progress.completed_contents}/{topicProgress.topic_progress.total_contents} contenidos)
                  </span>
                )}
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
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
              <span>{currentSession?.title}</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 font-medium">{currentTopic?.title}</span>
            </div>

            {/* Título del tema */}
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{currentTopic?.title}</h1>
            {currentTopic?.description && (
              <p className="text-gray-600 text-base mb-6">{currentTopic.description}</p>
            )}

            {/* Tabs de contenido */}
            <div className="border-b border-gray-200 mb-5 mt-4">
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
                      {currentTopic?.reading && completedContents.reading.has(currentTopic.reading.id) && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
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
                      {currentTopic?.video && completedContents.video.has(currentTopic.video.id) && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
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
                      {currentTopic?.interactive_exercise && completedContents.interactive.has(Number(currentTopic.interactive_exercise.id)) && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
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
                      {currentTopic?.downloadable_exercise && completedContents.downloadable.has(currentTopic.downloadable_exercise.id) && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
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
                    <div className="space-y-3">
                      {/* Título del video - arriba */}
                      <h2 className="text-xl font-semibold text-gray-900 pb-3 border-b border-gray-300">{currentTopic.video.title}</h2>
                      
                      {/* Video container - usa video nativo para archivos blob */}
                      {currentTopic.video.video_url?.includes('blob.core.windows.net') ? (
                        // Reproductor personalizado para archivos de Azure Blob
                        <CustomVideoPlayer
                          src={currentTopic.video.video_url}
                          className="w-full shadow-md"
                          onEnded={() => {
                            if (currentTopic.video && !completedContents.video.has(currentTopic.video.id)) {
                              markContentCompleted('video', currentTopic.video.id);
                            }
                          }}
                        />
                      ) : (
                        // iframe para YouTube/Vimeo
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            src={getVideoEmbedUrl(currentTopic.video.video_url)}
                            className="absolute top-0 left-0 w-full h-full rounded-lg shadow-md"
                            style={{ border: 'none' }}
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          />
                        </div>
                      )}
                      
                      {/* Descripción del video - abajo */}
                      {currentTopic.video.description && (
                        <div 
                          className="pt-3 text-gray-600 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.video.description) }}
                        />
                      )}
                      
                      {/* Estado de completado del video */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {completedContents.video.has(currentTopic.video.id) ? (
                          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Video completado</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 text-gray-500 rounded-lg">
                            <PlayCircle className="w-5 h-5" />
                            <span className="text-sm">Mira el video completo para marcarlo como completado</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Video className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-base">No hay video disponible para este tema</p>
                    </div>
                  )}
                </div>
              )}

              {/* Lectura */}
              {activeTab === 'reading' && (
                <div ref={readingContentRef}>
                  {currentTopic?.reading ? (
                    <article className="w-full">
                      <h2 className="text-xl font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-300">{currentTopic.reading.title}</h2>
                      <div 
                        className="reading-content prose prose-sm prose-gray max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400 prose-img:max-w-full prose-pre:max-w-full prose-pre:overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.reading.content || '') }}
                      />
                      
                      {/* Botón para marcar lectura como completada */}
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        {completedContents.reading.has(currentTopic.reading.id) ? (
                          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Lectura completada</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => markContentCompleted('reading', currentTopic.reading!.id)}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Marcar lectura como completada</span>
                          </button>
                        )}
                      </div>
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
                    <article className="w-full">
                      <h2 className="text-xl font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-300">{currentTopic.downloadable_exercise.title}</h2>
                      
                      {/* Instrucciones */}
                      {currentTopic.downloadable_exercise.description && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-5">
                          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            Instrucciones
                          </h3>
                          <div 
                            className="reading-content prose prose-sm prose-gray max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400"
                            style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.downloadable_exercise.description.replace(/\u00a0/g, ' ')) }}
                          />
                        </div>
                      )}
                      
                      {/* Botón circular para scroll hacia abajo */}
                      {showDownloadScrollHint && (
                        <div className="fixed bottom-32 right-8 z-50">
                          <button
                            onClick={() => {
                              downloadButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 border-2 border-white"
                            style={{ animation: 'bounce 2s ease-in-out infinite' }}
                            title="Ver sección de descarga"
                          >
                            <ChevronDown className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      
                      {/* Botón de descarga */}
                      <div ref={downloadButtonRef} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Download className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-blue-900 text-sm">Archivo listo para descargar</p>
                              <p className="text-xs text-blue-600">{currentTopic.downloadable_exercise.file_name}</p>
                            </div>
                          </div>
                          <a
                            href={currentTopic.downloadable_exercise.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              // Registrar progreso cuando se descarga
                              if (currentTopic.downloadable_exercise && !completedContents.downloadable.has(currentTopic.downloadable_exercise.id)) {
                                markContentCompleted('downloadable', currentTopic.downloadable_exercise.id);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                          >
                            <Download className="w-4 h-4" />
                            Descargar
                          </a>
                        </div>
                      </div>
                      
                      {/* Estado de completado del descargable */}
                      {completedContents.downloadable.has(currentTopic.downloadable_exercise.id) && (
                        <div className="mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 rounded-lg">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-medium">Archivo descargado</span>
                        </div>
                      )}
                    </article>
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
                      // Vista inicial - Comenzar ejercicio (estilo minimalista)
                      <article className="w-full">
                        <h2 className="text-xl font-semibold text-gray-900 pb-3 mb-4 border-b border-gray-300">{currentTopic.interactive_exercise.title}</h2>
                        
                        {/* Instrucciones */}
                        {currentTopic.interactive_exercise.description && (
                          <div ref={instructionsRef} className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-5 relative">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <FileText className="w-3 h-3" />
                              Instrucciones
                            </h3>
                            <div 
                              className="reading-content prose prose-sm prose-gray max-w-full prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:marker:text-gray-400"
                              style={{ wordBreak: 'normal', overflowWrap: 'anywhere' }}
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.interactive_exercise.description.replace(/\u00a0/g, ' ')) }}
                            />
                          </div>
                        )}
                        
                        {/* Botón circular para scroll hacia abajo - posición fija a la derecha */}
                        {showScrollHint && (
                          <div className="fixed bottom-32 right-8 z-50">
                            <button
                              onClick={() => {
                                startExerciseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 border-2 border-white"
                              style={{ animation: 'bounce 2s ease-in-out infinite' }}
                              title="Ver sección para iniciar ejercicio"
                            >
                              <ChevronDown className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                        
                        {/* Botón para comenzar - Diseño llamativo */}
                        <div ref={startExerciseRef} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <Gamepad2 className="w-5 h-5 text-blue-600" />
                              </div>
                              <p className="font-medium text-blue-900 text-sm">Listo para comenzar</p>
                            </div>
                            <button
                              onClick={startExercise}
                              disabled={!currentTopic.interactive_exercise.steps?.length}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Comenzar
                            </button>
                          </div>
                        </div>
                        
                        {!currentTopic.interactive_exercise.steps?.length && (
                          <p className="text-amber-600 text-sm mt-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            Este ejercicio aún no tiene pasos configurados
                          </p>
                        )}
                      </article>
                    ) : exerciseCompleted ? (
                      // Vista de ejercicio completado con calificación
                      <div className={`rounded-lg p-6 text-center ${
                        exerciseScore && exerciseScore.percentage >= 70 
                          ? 'bg-gradient-to-br from-green-50 to-emerald-50' 
                          : 'bg-gradient-to-br from-amber-50 to-orange-50'
                      }`}>
                        {/* Círculo con calificación */}
                        <div className="relative inline-flex items-center justify-center mb-4">
                          <svg className="w-24 h-24 transform -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="42"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              className="text-gray-200"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="42"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="none"
                              strokeDasharray={`${(exerciseScore?.percentage || 0) * 2.64} 264`}
                              className={exerciseScore && exerciseScore.percentage >= 70 ? 'text-green-500' : 'text-amber-500'}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-2xl font-bold ${
                              exerciseScore && exerciseScore.percentage >= 70 ? 'text-green-600' : 'text-amber-600'
                            }`}>
                              {exerciseScore?.percentage || 0}%
                            </span>
                            <span className="text-xs text-gray-500">
                              {exerciseScore?.score || 0}/{exerciseScore?.maxScore || 0}
                            </span>
                          </div>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                          {exerciseScore && exerciseScore.percentage >= 70 
                            ? '¡Excelente trabajo!' 
                            : 'Sigue practicando'}
                        </h2>
                        <p className="text-gray-600 text-sm mb-1">
                          Has completado el ejercicio "{currentTopic.interactive_exercise.title}"
                        </p>
                        <p className={`text-xs mb-4 ${
                          exerciseScore && exerciseScore.percentage >= 70 ? 'text-green-600' : 'text-amber-600'
                        }`}>
                          {exerciseScore && exerciseScore.percentage >= 100 
                            ? '¡Perfecto! Todas las respuestas correctas'
                            : exerciseScore && exerciseScore.percentage >= 70 
                            ? '¡Buen trabajo! Excelente desempeño'
                            : 'Puedes mejorar practicando más'}
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-2">
                          <button
                            onClick={resetExerciseState}
                            className="px-4 py-2 bg-white text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2 border border-gray-300"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Practicar de nuevo
                          </button>
                          {hasNextTopic() && (
                            <button
                              onClick={goToNextTopic}
                              className={`px-4 py-2 text-white text-sm rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2 ${
                                exerciseScore && exerciseScore.percentage >= 70 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                            >
                              Continuar
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Vista de ejecución del ejercicio - Pasos (diseño profesional)
                      <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 200px)' }}>
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
                              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
                                <div className="flex items-center justify-between px-5 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                      <Gamepad2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900">{currentTopic.interactive_exercise.title}</h3>
                                  </div>
                                  <button
                                    onClick={resetExerciseState}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Salir del ejercicio"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>

                              {/* Instrucciones del ejercicio - colapsables */}
                              {currentTopic.interactive_exercise.description && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden flex-shrink-0">
                                  <button
                                    onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-blue-600" />
                                      <span className="text-sm font-medium text-blue-800">Instrucciones</span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${instructionsExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                  {instructionsExpanded && (
                                    <div className="px-4 pb-4 border-t border-blue-200">
                                      <div 
                                        className="prose prose-sm max-w-none text-blue-900 reading-content pt-3"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentTopic.interactive_exercise.description.replace(/\u00a0/g, ' ')) }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Área de la imagen con acciones superpuestas */}
                              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 min-h-0">
                                <div 
                                  ref={imageContainerRef}
                                  className="relative mx-auto bg-gray-50 h-full flex items-center justify-center"
                                >
                                  {currentStep.image_url ? (
                                    <>
                                      <img
                                        ref={imageRef}
                                        src={currentStep.image_url}
                                        alt={currentStep.title || `Paso ${currentStepIndex + 1}`}
                                        className="max-w-full max-h-full object-contain"
                                        onLoad={handleImageLoad}
                                      />
                                      {/* Contenedor de acciones que coincide exactamente con la imagen */}
                                      {imageDimensions && (
                                        <div
                                          style={{
                                            position: 'absolute',
                                            width: imageDimensions.width,
                                            height: imageDimensions.height,
                                            pointerEvents: 'none',
                                          }}
                                        >
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
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-center h-48 bg-gray-100">
                                      <Image className="w-12 h-12 text-gray-300" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Navegación de pasos - estilo profesional */}
                              <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex justify-between items-center shadow-sm flex-shrink-0">
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
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <Gamepad2 className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-base">No hay ejercicio interactivo para este tema</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Espaciado para la barra fija inferior */}
            <div className="h-14" />
          </div>
        </main>
      </div>

      {/* Barra de navegación fija inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={goToPreviousContent}
              disabled={!hasPreviousContent()}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg font-medium transition-colors ${
                hasPreviousContent()
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>

            <button
              onClick={goToNextContent}
              disabled={!hasNextContent()}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg font-medium transition-colors ${
                hasNextContent()
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de error para ejercicio interactivo */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md mx-4 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Respuesta incorrecta</h3>
                <p className="text-gray-600 mb-3">{showErrorModal.message}</p>
                {(() => {
                  // max_attempts son oportunidades ADICIONALES después del primer error
                  const action = currentTopic?.interactive_exercise?.steps
                    ?.flatMap(s => s.actions || [])
                    ?.find(a => `${a.step_id}_${a.id}` === showErrorModal.actionKey);
                  const additionalAttempts = action?.max_attempts ?? 1;
                  const usedAttempts = actionErrors[showErrorModal.actionKey]?.attempts || 0;
                  // El error actual (oportunidad 0) no cuenta, las oportunidades adicionales empiezan después
                  const remaining = additionalAttempts - usedAttempts + 1;
                  
                  return (
                    <p className="text-xs text-amber-600 mb-4">
                      {remaining > 0 
                        ? `Te ${remaining === 1 ? 'queda' : 'quedan'} ${remaining} ${remaining === 1 ? 'oportunidad' : 'oportunidades'}`
                        : 'No te quedan más oportunidades'
                      }
                    </p>
                  );
                })()}
                <button
                  onClick={() => setShowErrorModal(null)}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Intentar de nuevo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

  // Estilo base para posicionar la acción sobre la imagen
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${action.position_x}%`,
    top: `${action.position_y}%`,
    width: `${action.width}%`,
    height: `${action.height}%`,
    pointerEvents: isStepCompleted ? 'none' : 'auto',
  };

  if (action.action_type === 'button') {
    // Si hay placeholder, el botón debe ser visible con el texto
    const hasPlaceholder = action.placeholder && action.placeholder.trim() !== '';
    
    return (
      <button
        style={{
          ...baseStyle,
          opacity: hasPlaceholder ? 1 : 0, // Visible si hay placeholder, invisible si no
          backgroundColor: hasPlaceholder ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        }}
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
            : hasPlaceholder
            ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400'
            : 'border-transparent hover:bg-blue-100 hover:border-blue-400'
        }`}
        title={action.placeholder || action.label || 'Clic aquí'}
      >
        {hasPlaceholder && (
          <span className="truncate px-2 text-sm">{action.placeholder}</span>
        )}
        {currentValue && <span className="ml-1">✓</span>}
      </button>
    );
  }

  if (action.action_type === 'text_input') {
    // Si hay placeholder, mostrarlo como guía
    const placeholderText = action.placeholder && action.placeholder.trim() !== '' ? action.placeholder : '';
    
    return (
      <div 
        style={{
          ...baseStyle,
          overflow: 'hidden', // Evitar que el texto se desborde del área
        }} 
        className="flex items-center"
      >
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
          placeholder={placeholderText}
          disabled={isStepCompleted}
          className="w-full h-full focus:outline-none"
          style={{
            color: action.text_color || '#000000',
            fontFamily: action.font_family || 'Arial',
            fontSize: 'inherit',
            background: 'transparent',
            border: 'none',
            padding: '0 4px',
            caretColor: action.text_color || '#000000',
            overflow: 'hidden', // El texto no desborda
            textOverflow: 'clip', // Cortar texto que exceda
          }}
        />
      </div>
    );
  }

  return null;
};

export default StudyContentPreviewPage;
