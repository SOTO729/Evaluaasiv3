import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, GripVertical, Image, Clock, LogOut, X, User, Flag, List, ArrowDown, Maximize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import DOMPurify from 'dompurify';
import { clearExamSessionCache, useAuthStore } from '../store/authStore';

// Tipo para representar un ítem del test (pregunta o ejercicio) 
interface TestItem {
  type: 'question' | 'exercise';
  id: string | number;
  category_name: string;
  topic_name: string;
  item_mode: 'exam' | 'simulator'; // Modo: examen o simulador
  percentage?: number; // Porcentaje de peso para la calificación ponderada
  // Para preguntas
  question_id?: number;
  question_text?: string;
  question_type?: string;
  options?: any[];
  // Para ejercicios
  exercise_id?: string;
  title?: string;
  description?: string;
  steps?: any[];
}

const ExamTestRunPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Obtener valores del state o valores por defecto (se restaurarán desde localStorage)
  const stateData = location.state as { questionCount?: number; exerciseCount?: number; mode?: 'exam' | 'simulator' } | null;
  const questionCount = stateData?.questionCount ?? 0;
  const exerciseCount = stateData?.exerciseCount ?? 0;
  const mode = stateData?.mode;
  
  // Modo actual (por defecto 'exam' si no viene especificado)
  const currentMode = mode || 'exam';
  
  // Clave única para almacenar el estado del examen en localStorage
  const examSessionKey = `exam_session_${examId}_${currentMode}`;
  
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [startTime] = useState(Date.now());
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
  // Estado para detección de conexión
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPaused, setIsPaused] = useState(false);
  const lastOnlineTimeRef = useRef<number>(Date.now());
  
  // Estado para ejercicios
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [exerciseResponses, setExerciseResponses] = useState<Record<string, Record<string, any>>>({});
  const [stepCompleted, setStepCompleted] = useState<Record<string, boolean>>({});
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // Estado para trackear preguntas de ordenamiento que han sido interactuadas
  const [orderingInteracted, setOrderingInteracted] = useState<Record<string, boolean>>({});
  
  // Estado para modal de confirmación de salida
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Estado para panel de navegación desplegable
  const [showNavPanel, setShowNavPanel] = useState(false);
  
  // Estado para marcar preguntas como pendientes (para volver después)
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  
  // Estado para modal de ejercicio completado
  const [showExerciseCompleted, setShowExerciseCompleted] = useState(false);
  
  // Estado para errores en acciones de ejercicios (campos incorrectos)
  const [actionErrors, setActionErrors] = useState<Record<string, { message: string; attempts: number }>>({});
  const [showErrorModal, setShowErrorModal] = useState<{ message: string; actionKey: string; exerciseId: string; stepIndex: number } | null>(null);
  
  // Estado para modal de avance por error (cuando la acción es next_step o next_exercise)
  const [showSkippedModal, setShowSkippedModal] = useState<{ message: string; type: 'next_step' | 'next_exercise'; autoClose?: boolean } | null>(null);

  // Estado para advertencias de tiempo
  const [timeWarningsShown, setTimeWarningsShown] = useState<Set<number>>(new Set());
  const [showTimeWarning, setShowTimeWarning] = useState<{ minutes: number } | null>(null);

  // Estado para modal de imagen en pantalla completa
  const [showImageFullscreen, setShowImageFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examService.getExam(Number(examId!), true),
    enabled: !!examId
  });

  // Configuración del examen: pausar tiempo al desconectarse
  const pauseOnDisconnect = exam?.pause_on_disconnect ?? true;

  // Detectar cambios de conexión (online/offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pauseOnDisconnect) {
        setIsPaused(false);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      if (pauseOnDisconnect) {
        setIsPaused(true);
        // Guardar el tiempo exacto cuando se desconectó
        lastOnlineTimeRef.current = Date.now();
      }
    };
    
    // Detectar cuando la página pierde/recupera visibilidad
    const handleVisibilityChange = () => {
      if (document.hidden && pauseOnDisconnect) {
        // La página está oculta, pausar
        setIsPaused(true);
        lastOnlineTimeRef.current = Date.now();
      } else if (!document.hidden) {
        // La página es visible de nuevo
        if (pauseOnDisconnect) {
          setIsPaused(false);
        }
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseOnDisconnect]);

  // Estado para controlar si ya se restauró la sesión
  const [sessionRestored, setSessionRestored] = useState(false);

  // Inicializar tiempo restante y restaurar estado cuando se carga el examen
  useEffect(() => {
    if (!exam?.duration_minutes) return;
    
    // Intentar restaurar sesión existente
    const savedSession = localStorage.getItem(examSessionKey);
    
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const { 
          timeRemaining: savedTime, 
          savedAt, 
          pauseOnDisconnect: savedPauseOnDisconnect,
          answers: savedAnswers,
          exerciseResponses: savedExerciseResponses,
          currentItemIndex: savedItemIndex,
          selectedItems: savedSelectedItems,
          orderingInteracted: savedOrderingInteracted,
          actionErrors: savedActionErrors,
          stepCompleted: savedStepCompleted,
          currentStepIndex: savedCurrentStepIndex,
          flaggedQuestions: savedFlaggedQuestions
        } = sessionData;
        
        if (savedTime > 0) {
          // Restaurar tiempo
          if (savedPauseOnDisconnect === false) {
            // Si NO pausaba al desconectarse, calcular tiempo transcurrido
            const elapsedSeconds = Math.floor((Date.now() - savedAt) / 1000);
            const newTimeRemaining = Math.max(0, savedTime - elapsedSeconds);
            setTimeRemaining(newTimeRemaining);
          } else {
            // Si pausaba al desconectarse, restaurar el tiempo tal cual
            setTimeRemaining(savedTime);
          }
          
          // Restaurar respuestas y estado
          if (savedAnswers && Object.keys(savedAnswers).length > 0) {
            setAnswers(savedAnswers);
          }
          if (savedExerciseResponses && Object.keys(savedExerciseResponses).length > 0) {
            setExerciseResponses(savedExerciseResponses);
          }
          if (typeof savedItemIndex === 'number') {
            setCurrentItemIndex(savedItemIndex);
          }
          if (savedSelectedItems && savedSelectedItems.length > 0) {
            setSelectedItems(savedSelectedItems);
            setSessionRestored(true); // Marcar que ya se restauró para evitar cargar nuevos items
          }
          if (savedOrderingInteracted) {
            setOrderingInteracted(savedOrderingInteracted);
          }
          if (savedActionErrors) {
            setActionErrors(savedActionErrors);
          }
          if (savedStepCompleted) {
            setStepCompleted(savedStepCompleted);
          }
          if (typeof savedCurrentStepIndex === 'number') {
            setCurrentStepIndex(savedCurrentStepIndex);
          }
          // Restaurar preguntas marcadas para revisar
          if (savedFlaggedQuestions && Array.isArray(savedFlaggedQuestions)) {
            setFlaggedQuestions(new Set(savedFlaggedQuestions));
          }
          
          return;
        }
      } catch (e) {
        console.error('Error al restaurar sesión de examen:', e);
      }
    }
    
    // Si no hay sesión guardada o es inválida, usar tiempo completo
    setTimeRemaining(exam.duration_minutes * 60);
  }, [exam, examSessionKey]);

  // Actualizar tiempo restante cada segundo (solo si no está pausado)
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || isPaused) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeRemaining, isPaused]);

  // Estado para envío de examen (declarado aquí para usarlo en auto-submit)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  // Auto-submit cuando el tiempo se acaba
  useEffect(() => {
    if (timeRemaining === 0 && !isSubmitting && !timeExpired) {
      setTimeExpired(true);
      // Limpiar sesión guardada
      localStorage.removeItem(examSessionKey);
      // Cerrar cualquier modal abierto
      setShowConfirmSubmit(false);
      setShowExitConfirm(false);
      setShowNavPanel(false);
      setShowExerciseCompleted(false);
      setShowErrorModal(null);
      setShowTimeWarning(null);
    }
  }, [timeRemaining, isSubmitting, timeExpired, examSessionKey]);

  // Advertencias de tiempo (30, 15, 5 y 1 minuto)
  useEffect(() => {
    if (timeRemaining === null) return;
    
    const warningMinutes = [30, 15, 5, 1];
    
    for (const minutes of warningMinutes) {
      // Mostrar advertencia cuando quedan exactamente esos minutos (o menos de un segundo después)
      if (timeRemaining <= minutes * 60 && timeRemaining > (minutes * 60) - 2 && !timeWarningsShown.has(minutes)) {
        setTimeWarningsShown(prev => new Set([...prev, minutes]));
        setShowTimeWarning({ minutes });
        // Auto-cerrar después de 4 segundos
        setTimeout(() => setShowTimeWarning(null), 4000);
        break;
      }
    }
  }, [timeRemaining, timeWarningsShown]);

  // Cerrar modal de imagen fullscreen con tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showImageFullscreen) {
        setShowImageFullscreen(false);
      }
    };
    
    if (showImageFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevenir scroll del body cuando el modal está abierto
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showImageFullscreen]);

  // Seleccionar preguntas y ejercicios aleatorios
  const [selectedItems, setSelectedItems] = useState<TestItem[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      // Si ya se restauró la sesión con items guardados, no cargar nuevos
      if (sessionRestored) return;
      if (!exam) return;
      
      // Verificar también directamente en localStorage para evitar race conditions
      const savedSession = localStorage.getItem(examSessionKey);
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          if (sessionData.selectedItems && sessionData.selectedItems.length > 0 && sessionData.timeRemaining > 0) {
            // Ya hay una sesión guardada con items, no cargar nuevos
            return;
          }
        } catch (e) {
          // Continuar cargando nuevos items si hay error
        }
      }
      
      const allQuestions: TestItem[] = [];
      const allExerciseRefs: { topicId: number; exerciseId: string; category_name: string; topic_name: string; item_mode: 'exam' | 'simulator'; percentage: number }[] = [];
      
      exam.categories?.forEach((category: any) => {
        category.topics?.forEach((topic: any) => {
          // Agregar preguntas - filtrar por modo
          topic.questions?.forEach((question: any) => {
            const questionMode = question.type || 'exam';
            // Solo incluir si el modo coincide
            if (questionMode === currentMode) {
              allQuestions.push({
                type: 'question',
                id: question.id,
                category_name: category.name,
                topic_name: topic.name,
                item_mode: questionMode,
                question_id: question.id,
                question_text: question.question_text,
                question_type: question.question_type?.name || question.question_type,
                options: question.answers || question.options,
                percentage: question.percentage || 0  // Incluir porcentaje configurado
              });
            }
          });
          
          // Recopilar referencias a ejercicios - filtrar por modo
          topic.exercises?.forEach((exercise: any) => {
            const exerciseMode = exercise.type || 'exam';
            // Solo incluir si el modo coincide
            if (exerciseMode === currentMode) {
              allExerciseRefs.push({
                topicId: topic.id,
                exerciseId: exercise.id,
                category_name: category.name,
                topic_name: topic.name,
                item_mode: exerciseMode,
                percentage: exercise.percentage || 0  // Incluir porcentaje configurado
              });
            }
          });
        });
      });

      // Seleccionar preguntas aleatorias (del modo seleccionado)
      const shuffledQuestions = [...allQuestions].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffledQuestions.slice(0, Math.min(questionCount, allQuestions.length));
      
      // Seleccionar y cargar ejercicios aleatorios (del modo seleccionado)
      let selectedExercises: TestItem[] = [];
      if (exerciseCount > 0 && allExerciseRefs.length > 0) {
        setLoadingExercises(true);
        const shuffledExercises = [...allExerciseRefs].sort(() => Math.random() - 0.5);
        const exercisesToLoad = shuffledExercises.slice(0, Math.min(exerciseCount, allExerciseRefs.length));
        
        // Cargar detalles de cada ejercicio
        const exercisePromises = exercisesToLoad.map(async (ref) => {
          try {
            const { exercise } = await examService.getExerciseDetails(ref.exerciseId);
            return {
              type: 'exercise' as const,
              id: exercise.id,
              category_name: ref.category_name,
              topic_name: ref.topic_name,
              item_mode: ref.item_mode, // Incluir modo exam/simulator
              exercise_id: exercise.id,
              title: exercise.title,
              description: exercise.exercise_text,
              steps: exercise.steps || [],
              percentage: ref.percentage  // Incluir porcentaje configurado
            } as TestItem;
          } catch (error) {
            console.error('Error loading exercise:', error);
            return null;
          }
        });
        
        const loadedExercises = await Promise.all(exercisePromises);
        selectedExercises = loadedExercises.filter((e): e is TestItem => e !== null);
        setLoadingExercises(false);
      }
      
      // Combinar y mezclar todo
      const allItems = [...selectedQuestions, ...selectedExercises].sort(() => Math.random() - 0.5);
      // Función para mezclar array de forma aleatoria (Fisher-Yates shuffle)
      const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };

      // Desordenar las opciones de preguntas de ordenamiento
      const itemsWithShuffledOptions = allItems.map(item => {
        if (item.type === 'question' && item.question_type === 'ordering' && item.options) {
          return {
            ...item,
            options: shuffleArray(item.options)
          };
        }
        return item;
      });

      setSelectedItems(itemsWithShuffledOptions);
      
      // Inicializar respuestas para preguntas de ordenamiento
      // El orden inicial es el desordenado (que el usuario debe reordenar)
      const initialOrderingAnswers: Record<string, any> = {};
      itemsWithShuffledOptions.forEach(item => {
        if (item.type === 'question' && item.question_type === 'ordering' && item.options) {
          initialOrderingAnswers[String(item.question_id)] = item.options.map((o: any) => o.id);
        }
      });
      if (Object.keys(initialOrderingAnswers).length > 0) {
        setAnswers(prev => ({ ...prev, ...initialOrderingAnswers }));
      }
    };
    
    loadItems();
  }, [exam, questionCount, exerciseCount, currentMode, sessionRestored]);

  // Guardar estado del examen en localStorage periódicamente
  useEffect(() => {
    if (timeRemaining === null || !examId || selectedItems.length === 0) return;
    
    const saveSession = () => {
      const sessionData = {
        timeRemaining,
        savedAt: Date.now(),
        examDuration: exam?.duration_minutes ? exam.duration_minutes * 60 : null,
        pauseOnDisconnect,
        examName: exam?.name || '',
        // Guardar respuestas y estado completo
        answers,
        exerciseResponses,
        currentItemIndex,
        selectedItems,
        orderingInteracted,
        actionErrors,
        stepCompleted,
        currentStepIndex,
        // Guardar preguntas marcadas para revisar
        flaggedQuestions: Array.from(flaggedQuestions)
      };
      localStorage.setItem(examSessionKey, JSON.stringify(sessionData));
    };
    
    // Guardar cada 5 segundos
    const saveInterval = setInterval(saveSession, 5000);
    
    // También guardar cuando la página se cierra
    window.addEventListener('beforeunload', saveSession);
    
    return () => {
      clearInterval(saveInterval);
      window.removeEventListener('beforeunload', saveSession);
    };
  }, [timeRemaining, examId, examSessionKey, exam?.duration_minutes, exam?.name, pauseOnDisconnect, answers, exerciseResponses, currentItemIndex, selectedItems, orderingInteracted, actionErrors, stepCompleted, currentStepIndex, flaggedQuestions]);

  const currentItem = selectedItems[currentItemIndex];

  const handleAnswerChange = (itemId: string | number, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [String(itemId)]: answer
    }));
  };

  // Manejar respuestas de ejercicios
  const handleExerciseActionResponse = (exerciseId: string, stepId: string, actionId: string, response: any) => {
    setExerciseResponses(prev => ({
      ...prev,
      [exerciseId]: {
        ...(prev[exerciseId] || {}),
        [`${stepId}_${actionId}`]: response
      }
    }));
  };

  // Marcar paso de ejercicio como completado
  const markStepCompleted = (exerciseId: string, stepIndex: number) => {
    setStepCompleted(prev => ({
      ...prev,
      [`${exerciseId}_${stepIndex}`]: true
    }));
  };

  // Verificar si todos los pasos del ejercicio actual están completados
  const isExerciseCompleted = (item: TestItem): boolean => {
    if (item.type !== 'exercise' || !item.steps) return true;
    return item.steps.every((_step: any, index: number) => 
      stepCompleted[`${item.exercise_id}_${index}`]
    );
  };

  // Manejar clic en un botón de acción (solo para acciones correctas)
  const handleButtonClick = (action: any, exerciseId: string, stepIndex: number) => {
    // Verificar si es una acción correcta
    const isCorrectButton = action.action_type === 'button' && 
      action.correct_answer && 
      ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());
    
    // Solo procesar si es un botón correcto
    if (!isCorrectButton) {
      return; // No hacer nada para botones incorrectos
    }
    
    handleExerciseActionResponse(exerciseId, action.step_id, action.id, true);
    markStepCompleted(exerciseId, stepIndex);
    
    // Avanzar al siguiente paso si hay más, o mostrar modal de completado
    const currentExercise = currentItem;
    if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
      setCurrentStepIndex(stepIndex + 1);
    } else if (currentExercise?.steps && stepIndex === currentExercise.steps.length - 1) {
      // Es el último paso, mostrar modal de completado
      setShowExerciseCompleted(true);
      // Auto-cerrar después de 5 segundos
      setTimeout(() => setShowExerciseCompleted(false), 5000);
    }
  };

  // Manejar clic en un campo incorrecto (con lógica de reintentos y modal de error)
  const handleWrongActionClick = (action: any, exerciseId: string, stepIndex: number) => {
    const actionKey = `${action.step_id}_${action.id}`;
    const currentError = actionErrors[actionKey] || { message: '', attempts: 0 };
    const newAttempts = currentError.attempts + 1;
    // max_attempts son intentos ADICIONALES después del primer error
    const additionalAttempts = action.max_attempts ?? 1;
    const errorMessage = action.error_message || 'Respuesta incorrecta. Inténtalo de nuevo.';
    const onErrorAction = (action.on_error_action || 'show_message') as string;

    // Si la acción es terminar ejercicio inmediatamente
    if (onErrorAction === 'end_exercise' || onErrorAction === 'next_exercise') {
      // Cerrar modal de error si estaba abierto
      setShowErrorModal(null);
      handleExerciseActionResponse(exerciseId, action.step_id, action.id, false);
      markStepCompleted(exerciseId, stepIndex);
      
      // Mostrar modal informando que se pasa al siguiente por error
      const errorMsg = action.error_message || 'Has cometido un error en este ejercicio.';
      setShowSkippedModal({ 
        message: errorMsg, 
        type: 'next_exercise',
        autoClose: true 
      });
      return;
    }

    // Si la acción es pasar al siguiente paso (sin reintentos)
    if (onErrorAction === 'next_step') {
      // Cerrar modal de error si estaba abierto
      setShowErrorModal(null);
      handleExerciseActionResponse(exerciseId, action.step_id, action.id, false);
      markStepCompleted(exerciseId, stepIndex);
      
      const currentExercise = currentItem;
      const errorMsg = action.error_message || 'Has cometido un error en este paso.';
      
      if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
        // Mostrar modal informando que se pasa al siguiente paso por error
        setShowSkippedModal({ 
          message: errorMsg, 
          type: 'next_step',
          autoClose: true 
        });
        // Avanzar después de cerrar el modal
        setTimeout(() => {
          setCurrentStepIndex(stepIndex + 1);
        }, 100);
      } else {
        // Es el último paso, mostrar modal de completado
        setShowExerciseCompleted(true);
        setTimeout(() => setShowExerciseCompleted(false), 5000);
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
    setShowErrorModal({ message: errorMessage, actionKey, exerciseId, stepIndex });

    // Manejar acción si se agotaron los intentos adicionales
    if (newAttempts > additionalAttempts) {
      // Cerrar modal inmediatamente
      setShowErrorModal(null);
      
      // Marcar como completado (aunque incorrecto)
      handleExerciseActionResponse(exerciseId, action.step_id, action.id, false);
      markStepCompleted(exerciseId, stepIndex);
      
      const currentExercise = currentItem;
      if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
        // Hay más pasos, avanzar al siguiente
        setCurrentStepIndex(stepIndex + 1);
      } else {
        // Es el último paso, mostrar modal de completado
        setShowExerciseCompleted(true);
        setTimeout(() => setShowExerciseCompleted(false), 5000);
      }
    }
  };

  // Manejar respuesta de textbox
  const handleTextboxSubmit = (action: any, exerciseId: string, stepIndex: number, value: string) => {
    handleExerciseActionResponse(exerciseId, action.step_id, action.id, value);
    markStepCompleted(exerciseId, stepIndex);
    
    // Avanzar al siguiente paso si hay más, o mostrar modal de completado
    const currentExercise = currentItem;
    if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
      setCurrentStepIndex(stepIndex + 1);
    } else if (currentExercise?.steps && stepIndex === currentExercise.steps.length - 1) {
      // Es el último paso, mostrar modal de completado
      setShowExerciseCompleted(true);
      // Auto-cerrar después de 5 segundos
      setTimeout(() => setShowExerciseCompleted(false), 5000);
    }
  };

  const handleNext = () => {
    console.log('handleNext called - currentIndex:', currentItemIndex, 'total:', selectedItems.length);
    
    // Marcar pregunta de ordenamiento actual como interactuada al navegar
    const currentItem = selectedItems[currentItemIndex];
    if (currentItem?.type === 'question' && currentItem.question_type === 'ordering') {
      setOrderingInteracted(prev => ({ ...prev, [String(currentItem.question_id)]: true }));
    }
    
    // Simplemente avanzar al siguiente ítem en la lista (ya mezclada aleatoriamente)
    if (currentItemIndex < selectedItems.length - 1) {
      const newIndex = currentItemIndex + 1;
      console.log('Moving to index:', newIndex);
      setCurrentItemIndex(newIndex);
      
      // Si el siguiente ítem es un ejercicio completado, ir al último paso
      const nextItem = selectedItems[newIndex];
      if (nextItem?.type === 'exercise' && nextItem.steps) {
        const lastStepIndex = nextItem.steps.length - 1;
        const isExerciseComplete = stepCompleted[`${nextItem.exercise_id}_${lastStepIndex}`];
        if (isExerciseComplete) {
          setCurrentStepIndex(lastStepIndex);
        } else {
          setCurrentStepIndex(0);
        }
      } else {
        setCurrentStepIndex(0);
      }
    } else {
      console.log('Already at last item');
    }
  };

  const handlePrevious = () => {
    // Marcar pregunta de ordenamiento actual como interactuada al navegar
    const currentItem = selectedItems[currentItemIndex];
    if (currentItem?.type === 'question' && currentItem.question_type === 'ordering') {
      setOrderingInteracted(prev => ({ ...prev, [String(currentItem.question_id)]: true }));
    }
    
    if (currentItemIndex > 0) {
      const newIndex = currentItemIndex - 1;
      setCurrentItemIndex(newIndex);
      
      // Si el ítem anterior es un ejercicio completado, ir al último paso
      const prevItem = selectedItems[newIndex];
      if (prevItem?.type === 'exercise' && prevItem.steps) {
        const lastStepIndex = prevItem.steps.length - 1;
        const isExerciseComplete = stepCompleted[`${prevItem.exercise_id}_${lastStepIndex}`];
        if (isExerciseComplete) {
          setCurrentStepIndex(lastStepIndex);
        } else {
          setCurrentStepIndex(0);
        }
      } else {
        setCurrentStepIndex(0);
      }
    }
  };

  // Efecto para enviar el examen cuando el tiempo expira
  useEffect(() => {
    if (timeExpired && !isSubmitting) {
      handleSubmitTimeExpired();
    }
  }, [timeExpired]);

  // Función especial para envío cuando el tiempo expira
  const handleSubmitTimeExpired = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Limpiar sesión guardada al terminar el examen
    localStorage.removeItem(examSessionKey);
    
    const elapsedTime = exam?.duration_minutes ? exam.duration_minutes * 60 : Math.floor((Date.now() - startTime) / 1000);
    
    try {
      console.log('⏰ Tiempo expirado - Enviando respuestas automáticamente:', {
        examId,
        answers,
        exerciseResponses,
        itemsCount: selectedItems.length
      });
      
      // Llamar al backend para evaluar las respuestas
      const evaluationResult = await examService.evaluateExam(Number(examId), {
        answers,
        exerciseResponses,
        items: selectedItems
      });
      
      const results = evaluationResult.results || evaluationResult;
      
      // DEBUG: Ver exactamente qué envía el backend
      console.log('🔍 EVALUACIÓN - Respuesta del backend:', JSON.stringify(evaluationResult, null, 2));
      console.log('🔍 EVALUACIÓN - results.summary:', results.summary);
      console.log('🔍 EVALUACIÓN - evaluation_breakdown del backend:', (results.summary as any)?.evaluation_breakdown);
      
      // Usar el desglose calculado por el backend si está disponible
      // De lo contrario, calcularlo localmente
      let evaluationBreakdown = (results.summary as any)?.evaluation_breakdown;
      
      if (!evaluationBreakdown) {
        console.log('⚠️ Backend NO envió evaluation_breakdown, calculando localmente...');
        // Fallback: Calcular desglose localmente usando PUNTAJES
        evaluationBreakdown = {} as Record<string, {
          topics: Record<string, { earned: number; max: number; percentage: number }>;
          earned: number;
          max: number;
          percentage: number;
        }>;

        selectedItems.forEach((item: any) => {
          const categoryName = item.category_name || 'Sin categoría';
          const topicName = item.topic_name || 'Sin tema';
          
          if (!evaluationBreakdown[categoryName]) {
            evaluationBreakdown[categoryName] = { topics: {}, earned: 0, max: 0, percentage: 0 };
          }
          if (!evaluationBreakdown[categoryName].topics[topicName]) {
            evaluationBreakdown[categoryName].topics[topicName] = { earned: 0, max: 0, percentage: 0 };
          }

          let earnedScore = 0;
          let maxScore = 1;
          
          if (item.type === 'question') {
            const questionResult = results.questions?.find((q: any) => String(q.question_id) === String(item.question_id || item.id)) as any;
            if (questionResult) {
              earnedScore = questionResult.score || 0;
              maxScore = questionResult.max_score || 1;
            }
          } else if (item.type === 'exercise') {
            const exerciseResult = results.exercises?.find((e: any) => String(e.exercise_id) === String(item.exercise_id || item.id)) as any;
            if (exerciseResult) {
              earnedScore = exerciseResult.total_score || 0;
              maxScore = exerciseResult.max_score || 1;
            }
          }

          evaluationBreakdown[categoryName].earned += earnedScore;
          evaluationBreakdown[categoryName].max += maxScore;
          evaluationBreakdown[categoryName].topics[topicName].earned += earnedScore;
          evaluationBreakdown[categoryName].topics[topicName].max += maxScore;
        });

        // Calcular porcentajes
        Object.keys(evaluationBreakdown).forEach(category => {
          const cat = evaluationBreakdown[category];
          cat.percentage = cat.max > 0 ? Math.round((cat.earned / cat.max) * 1000) / 10 : 0;
          Object.keys(cat.topics).forEach(topic => {
            const t = cat.topics[topic];
            t.percentage = t.max > 0 ? Math.round((t.earned / t.max) * 1000) / 10 : 0;
          });
        });
      }
      
      console.log('📊 Desglose por categoría/tema:', evaluationBreakdown);
      
      // Asegurar que evaluation_breakdown esté en results.summary
      const resultsWithBreakdown = {
        ...results,
        summary: {
          ...(results.summary || {}),
          evaluation_breakdown: evaluationBreakdown
        }
      };
      
      // Guardar el resultado en la base de datos
      let savedResultId: string | undefined;
      try {
        const percentage = results.summary?.percentage || 0;
        const score = results.summary?.earned_points || 0;
        const saveResponse = await examService.saveExamResult(Number(examId), {
          score,
          percentage,
          status: 1, // Completado
          duration_seconds: elapsedTime,
          answers_data: { 
            answers, 
            exerciseResponses,
            questions: results.questions || [],
            exercises: results.exercises || [],
            summary: resultsWithBreakdown.summary || {},
            evaluation_breakdown: evaluationBreakdown
          },
          questions_order: selectedItems.map(item => item.id.toString())
        });
        savedResultId = saveResponse.result?.id;
        console.log('✅ Resultado guardado en la base de datos, ID:', savedResultId);
      } catch (saveError) {
        console.warn('⚠️ No se pudo guardar el resultado:', saveError);
      }
      
      navigate(`/test-exams/${examId}/results`, {
        state: {
          evaluationResults: resultsWithBreakdown,
          items: selectedItems,
          elapsedTime,
          questionCount,
          exerciseCount,
          examName: exam?.name,
          passingScore: exam?.passing_score,
          timeExpired: true,
          resultId: savedResultId
        }
      });
    } catch (error: any) {
      console.error('❌ Error evaluating exam:', error);
      navigate(`/test-exams/${examId}/results`, {
        state: {
          answers,
          exerciseResponses,
          items: selectedItems,
          examName: exam?.name,
          passingScore: exam?.passing_score,
          elapsedTime,
          questionCount,
          exerciseCount,
          timeExpired: true
        }
      });
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      console.log('📤 Enviando datos para evaluación:', {
        examId,
        answers,
        exerciseResponses,
        itemsCount: selectedItems.length
      });
      
      // Llamar al backend para evaluar las respuestas
      const evaluationResult = await examService.evaluateExam(Number(examId), {
        answers,
        exerciseResponses,
        items: selectedItems
      });
      
      console.log('📥 Respuesta de evaluación recibida:', evaluationResult);
      
      // La respuesta viene como { results: {...} }
      const results = evaluationResult.results || evaluationResult;
      
      // DEBUG: Ver exactamente qué envía el backend
      console.log('🔍 EVALUACIÓN MANUAL - Respuesta completa:', JSON.stringify(evaluationResult, null, 2));
      console.log('🔍 EVALUACIÓN MANUAL - results.summary:', results.summary);
      console.log('🔍 EVALUACIÓN MANUAL - evaluation_breakdown del backend:', (results.summary as any)?.evaluation_breakdown);
      
      // Usar el desglose calculado por el backend si está disponible
      let evaluationBreakdown = (results.summary as any)?.evaluation_breakdown;
      
      if (!evaluationBreakdown) {
        // Fallback: Calcular desglose localmente usando PUNTAJES
        evaluationBreakdown = {} as Record<string, {
          topics: Record<string, { earned: number; max: number; percentage: number }>;
          earned: number;
          max: number;
          percentage: number;
        }>;

        selectedItems.forEach((item: any) => {
          const categoryName = item.category_name || 'Sin categoría';
          const topicName = item.topic_name || 'Sin tema';
          
          if (!evaluationBreakdown[categoryName]) {
            evaluationBreakdown[categoryName] = { topics: {}, earned: 0, max: 0, percentage: 0 };
          }
          if (!evaluationBreakdown[categoryName].topics[topicName]) {
            evaluationBreakdown[categoryName].topics[topicName] = { earned: 0, max: 0, percentage: 0 };
          }

          let earnedScore = 0;
          let maxScore = 1;
          
          if (item.type === 'question') {
            const questionResult = results.questions?.find((q: any) => String(q.question_id) === String(item.question_id || item.id)) as any;
            if (questionResult) {
              earnedScore = questionResult.score || 0;
              maxScore = questionResult.max_score || 1;
            }
          } else if (item.type === 'exercise') {
            const exerciseResult = results.exercises?.find((e: any) => String(e.exercise_id) === String(item.exercise_id || item.id)) as any;
            if (exerciseResult) {
              earnedScore = exerciseResult.total_score || 0;
              maxScore = exerciseResult.max_score || 1;
            }
          }

          evaluationBreakdown[categoryName].earned += earnedScore;
          evaluationBreakdown[categoryName].max += maxScore;
          evaluationBreakdown[categoryName].topics[topicName].earned += earnedScore;
          evaluationBreakdown[categoryName].topics[topicName].max += maxScore;
        });

        // Calcular porcentajes
        Object.keys(evaluationBreakdown).forEach(category => {
          const cat = evaluationBreakdown[category];
          cat.percentage = cat.max > 0 ? Math.round((cat.earned / cat.max) * 1000) / 10 : 0;
          Object.keys(cat.topics).forEach(topic => {
            const t = cat.topics[topic];
            t.percentage = t.max > 0 ? Math.round((t.earned / t.max) * 1000) / 10 : 0;
          });
        });
      }

      console.log('📊 Desglose por categoría/tema:', evaluationBreakdown);
      
      // Asegurar que evaluation_breakdown esté en results.summary
      const resultsWithBreakdown = {
        ...results,
        summary: {
          ...(results.summary || {}),
          evaluation_breakdown: evaluationBreakdown
        }
      };
      
      // Guardar el resultado en la base de datos
      let savedResultId: string | undefined;
      try {
        const percentage = results.summary?.percentage || 0;
        const score = results.summary?.earned_points || 0;
        const saveResponse = await examService.saveExamResult(Number(examId), {
          score,
          percentage,
          status: 1, // Completado
          duration_seconds: elapsedTime,
          answers_data: { 
            answers, 
            exerciseResponses,
            questions: results.questions || [],
            exercises: results.exercises || [],
            summary: resultsWithBreakdown.summary || {},
            evaluation_breakdown: evaluationBreakdown
          },
          questions_order: selectedItems.map(item => item.id.toString())
        });
        savedResultId = saveResponse.result?.id;
        console.log('✅ Resultado guardado en la base de datos, ID:', savedResultId);
      } catch (saveError) {
        console.warn('⚠️ No se pudo guardar el resultado:', saveError);
      }
      
      console.log('✅ Navegando a resultados con:', { resultsWithBreakdown, itemsCount: selectedItems.length, elapsedTime });
      
      navigate(`/test-exams/${examId}/results`, {
        state: {
          evaluationResults: resultsWithBreakdown,
          items: selectedItems,
          elapsedTime,
          questionCount,
          exerciseCount,
          examName: exam?.name,
          passingScore: exam?.passing_score,
          resultId: savedResultId
        }
      });
    } catch (error: any) {
      console.error('❌ Error evaluating exam:', error);
      console.error('Error details:', error?.response?.data || error?.message);
      // Si falla la evaluación, navegar con los datos crudos
      navigate(`/test-exams/${examId}/results`, {
        state: {
          answers,
          exerciseResponses,
          items: selectedItems,
          examName: exam?.name,
          passingScore: exam?.passing_score,
          elapsedTime,
          questionCount,
          exerciseCount
        }
      });
    } finally {
      // Limpiar sesión guardada al terminar el examen
      localStorage.removeItem(examSessionKey);
      // Limpiar toda la cache de sesiones de examen
      clearExamSessionCache();
      setIsSubmitting(false);
    }
  };

  const getAnsweredCount = () => {
    let count = 0;
    selectedItems.forEach(item => {
      if (item.type === 'question') {
        if (answers[String(item.question_id)] !== undefined) count++;
      } else if (item.type === 'exercise') {
        if (isExerciseCompleted(item)) count++;
      }
    });
    return count;
  };

  // Estado para ordenamiento drag-and-drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [draggedContent, setDraggedContent] = useState<{ text: string; index: number } | null>(null);

  const renderQuestionInput = () => {
    if (!currentItem || currentItem.type !== 'question') return null;

    const currentAnswer = answers[String(currentItem.question_id)];

    switch (currentItem.question_type) {
      case 'true_false':
        return (
          <div className="flex flex-col fluid-gap-3 w-full">
            <label className={`group flex items-center fluid-gap-4 fluid-p-4 border rounded-fluid-md cursor-pointer transition-all w-full ${
              currentAnswer === true 
                ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name={`question-${currentItem.question_id}`}
                value="true"
                checked={currentAnswer === true}
                onChange={() => handleAnswerChange(currentItem.question_id!, true)}
                className="hidden"
              />
              <div className={`w-6 h-6 rounded-full flex-shrink-0 transition-all border-2 ${
                currentAnswer === true 
                  ? 'border-primary-500 bg-primary-500' 
                  : 'border-gray-300 bg-white group-hover:border-gray-400'
              }`}>
              </div>
              <span className="font-medium text-gray-700">
                Verdadero
              </span>
            </label>
            <label className={`group flex items-center fluid-gap-4 fluid-p-4 border rounded-fluid-md cursor-pointer transition-all w-full ${
              currentAnswer === false 
                ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}>
              <input
                type="radio"
                name={`question-${currentItem.question_id}`}
                value="false"
                checked={currentAnswer === false}
                onChange={() => handleAnswerChange(currentItem.question_id!, false)}
                className="hidden"
              />
              <div className={`w-6 h-6 rounded-full flex-shrink-0 transition-all border-2 ${
                currentAnswer === false 
                  ? 'border-primary-500 bg-primary-500' 
                  : 'border-gray-300 bg-white group-hover:border-gray-400'
              }`}>
              </div>
              <span className="font-medium text-gray-700">
                Falso
              </span>
            </label>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="flex flex-col fluid-gap-2">
            {currentItem.options?.map((option: any, index: number) => (
              <label
                key={option.id}
                className={`group flex items-center fluid-p-3 border rounded-fluid-md cursor-pointer transition-all ${
                  currentAnswer === option.id 
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-full font-medium fluid-text-sm flex-shrink-0 transition-all ${
                  currentAnswer === option.id 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                }`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <input
                  type="radio"
                  name={`question-${currentItem.question_id}`}
                  value={option.id}
                  checked={currentAnswer === option.id}
                  onChange={() => handleAnswerChange(currentItem.question_id!, option.id)}
                  className="hidden"
                />
                <div
                  className="fluid-ml-3 fluid-text-sm text-gray-700 prose prose-sm max-w-none flex-1"
                  dangerouslySetInnerHTML={{ __html: option.answer_text }}
                />
              </label>
            ))}
          </div>
        );

      case 'multiple_select':
        return (
          <div className="flex flex-col fluid-gap-2">
            <p className="fluid-text-xs text-gray-500 fluid-mb-3 flex items-center fluid-gap-2">
              <span className="w-4 h-4 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-[10px]">✓</span>
              Selecciona todas las opciones correctas
            </p>
            {currentItem.options?.map((option: any) => {
              const selectedOptions = currentAnswer || [];
              const isChecked = selectedOptions.includes(option.id);
              
              return (
                <label
                  key={option.id}
                  className={`group flex items-center fluid-p-3 border rounded-fluid-md cursor-pointer transition-all ${
                    isChecked 
                      ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex items-center justify-center w-5 h-5 rounded flex-shrink-0 transition-all text-[11px] font-bold ${
                    isChecked 
                      ? 'bg-primary-500 text-white' 
                      : 'border-2 border-gray-300 group-hover:border-gray-400'
                  }`}>
                    {isChecked && '✓'}
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      const newSelected = e.target.checked
                        ? [...selectedOptions, option.id]
                        : selectedOptions.filter((id: string) => id !== option.id);
                      handleAnswerChange(currentItem.question_id!, newSelected);
                    }}
                    className="hidden"
                  />
                  <div
                    className="fluid-ml-3 fluid-text-sm text-gray-700 prose prose-sm max-w-none flex-1"
                    dangerouslySetInnerHTML={{ __html: option.answer_text }}
                  />
                </label>
              );
            })}
          </div>
        );

      case 'ordering':
        // Para preguntas de ordenamiento, el usuario debe arrastrar las opciones al orden correcto
        const orderingOptions = currentItem.options || [];
        const orderAnswer = currentAnswer || orderingOptions.map((o: any) => o.id) || [];
        const orderedOptions = orderAnswer.map((id: string) => 
          orderingOptions.find((o: any) => o.id === id)
        ).filter(Boolean);

        const handleMouseDown = (e: React.MouseEvent, index: number, option: any) => {
          e.preventDefault();
          setDraggedIndex(index);
          setDraggedContent({ text: option.answer_text, index: index + 1 });
          setDragPosition({ x: e.clientX, y: e.clientY });
          
          let currentOrder = [...orderAnswer]; // Mantener el orden actual
          let currentDraggedIndex = index;
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            setDragPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
            
            // Encontrar el elemento sobre el que estamos
            const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
            const targetElement = elements.find(el => el.hasAttribute('data-order-index'));
            if (targetElement) {
              const targetIndex = parseInt(targetElement.getAttribute('data-order-index') || '-1');
              if (targetIndex !== -1 && targetIndex !== currentDraggedIndex) {
                // Intercambiar directamente las posiciones
                const newOrder = [...currentOrder];
                const temp = newOrder[currentDraggedIndex];
                newOrder[currentDraggedIndex] = newOrder[targetIndex];
                newOrder[targetIndex] = temp;
                
                currentOrder = newOrder;
                currentDraggedIndex = targetIndex;
                
                handleAnswerChange(currentItem.question_id!, newOrder);
                setDraggedIndex(targetIndex);
                setOrderingInteracted(prev => ({ ...prev, [String(currentItem.question_id)]: true }));
              }
            }
          };
          
          const handleMouseUp = () => {
            setDraggedIndex(null);
            setDragPosition(null);
            setDraggedContent(null);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        };

        return (
          <div className="flex flex-col fluid-gap-2">
            <p className="fluid-text-xs text-gray-500 fluid-mb-3 flex items-center fluid-gap-2">
              <GripVertical className="fluid-icon-sm text-gray-400" />
              Arrastra para ordenar correctamente
            </p>
            {orderedOptions.map((option: any, index: number) => (
              <div
                key={option.id}
                data-order-index={index}
                onMouseDown={(e) => handleMouseDown(e, index, option)}
                style={{
                  transition: 'all 0.15s ease'
                }}
                className={`group flex items-center fluid-p-3 border-2 rounded-fluid-lg cursor-grab active:cursor-grabbing select-none ${
                  draggedIndex === index 
                    ? 'border-primary-500 bg-primary-100 border-dashed opacity-50' 
                    : draggedIndex !== null
                    ? 'border-gray-200 bg-gray-50/70'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-fluid-md font-bold fluid-text-sm flex-shrink-0 transition-all ${
                  draggedIndex === index 
                    ? 'bg-primary-300 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <GripVertical className={`fluid-icon-sm flex-shrink-0 fluid-mx-2 transition-colors ${
                  draggedIndex === index 
                    ? 'text-primary-300' 
                    : 'text-gray-300 group-hover:text-gray-500'
                }`} />
                <div
                  className={`text-sm prose prose-sm max-w-none flex-1 ${
                    draggedIndex === index ? 'text-gray-400' : 'text-gray-700'
                  }`}
                  dangerouslySetInnerHTML={{ __html: option.answer_text }}
                />
              </div>
            ))}
            
            {/* Elemento flotante que sigue al mouse */}
            {dragPosition && draggedContent && (
              <div
                style={{
                  position: 'fixed',
                  left: dragPosition.x,
                  top: dragPosition.y,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  minWidth: '320px',
                  maxWidth: '90vw',
                }}
                className="flex items-center fluid-p-4 border-2 border-primary-500 bg-white rounded-fluid-lg shadow-2xl ring-4 ring-primary-200"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-base flex-shrink-0 bg-primary-500 text-white shadow-md">
                  {draggedContent.index}
                </div>
                <GripVertical className="fluid-icon flex-shrink-0 fluid-mx-3 text-primary-500" />
                <div
                  className="text-base prose prose-base max-w-none flex-1 text-gray-900 font-medium"
                  dangerouslySetInnerHTML={{ __html: draggedContent.text }}
                />
              </div>
            )}
          </div>
        );

      case 'drag_drop':
        // Para preguntas de arrastrar y soltar (completar espacios en blanco)
        const fillBlankOptions = currentItem.options || [];
        const fillBlankAnswer = currentAnswer || {}; // { blank_1: 'answerId', blank_2: 'answerId' }
        
        // Parsear question_text para extraer instrucciones y template
        const fullQuestionText = currentItem.question_text || '';
        let questionTextWithBlanks = fullQuestionText;
        
        if (fullQuestionText.includes('___INSTRUCTIONS___') && fullQuestionText.includes('___TEMPLATE___')) {
          const parts = fullQuestionText.split('___TEMPLATE___');
          questionTextWithBlanks = parts[1]?.trim() || '';
        }
        
        // Extraer blanks del texto de la pregunta
        const blankRegex = /___BLANK_(\d+)___/g;
        const blanksFound: string[] = [];
        let blankMatch;
        while ((blankMatch = blankRegex.exec(questionTextWithBlanks)) !== null) {
          blanksFound.push(`blank_${blankMatch[1]}`);
        }
        // uniqueBlanks se usa implícitamente en el renderizado
        
        // Opciones asignadas a blanks
        const assignedOptionIds = new Set(Object.values(fillBlankAnswer));
        const availableOptions = fillBlankOptions.filter((o: any) => !assignedOptionIds.has(o.id));
        
        // Handlers para drag and drop
        const handleFillDragStart = (e: React.DragEvent, optionId: string) => {
          e.dataTransfer.setData('text/plain', optionId);
          e.dataTransfer.effectAllowed = 'move';
          (e.target as HTMLElement).classList.add('opacity-50', 'scale-95');
        };
        
        const handleFillDragEnd = (e: React.DragEvent) => {
          (e.target as HTMLElement).classList.remove('opacity-50', 'scale-95');
        };
        
        const handleFillDragOver = (e: React.DragEvent) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-100');
        };
        
        const handleFillDragLeave = (e: React.DragEvent) => {
          (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-100');
        };
        
        const handleDropOnBlank = (e: React.DragEvent, blankId: string) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-100');
          const optionId = e.dataTransfer.getData('text/plain');
          if (optionId) {
            // Remover la opción de cualquier otro blank
            const newAnswer = { ...fillBlankAnswer };
            Object.keys(newAnswer).forEach(key => {
              if (newAnswer[key] === optionId) delete newAnswer[key];
            });
            // Asignar al nuevo blank
            newAnswer[blankId] = optionId;
            handleAnswerChange(currentItem.question_id!, newAnswer);
          }
        };
        
        const handleRemoveFromBlank = (blankId: string) => {
          const newAnswer = { ...fillBlankAnswer };
          delete newAnswer[blankId];
          handleAnswerChange(currentItem.question_id!, newAnswer);
        };
        
        const handleDropOnAvailable = (e: React.DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-gray-400', 'bg-gray-100');
          const optionId = e.dataTransfer.getData('text/plain');
          if (optionId) {
            // Remover de cualquier blank
            const newAnswer = { ...fillBlankAnswer };
            Object.keys(newAnswer).forEach(key => {
              if (newAnswer[key] === optionId) delete newAnswer[key];
            });
            handleAnswerChange(currentItem.question_id!, newAnswer);
          }
        };
        
        // Renderizar el texto con los blanks interactivos
        const renderTextWithBlanks = () => {
          let textParts: React.ReactNode[] = [];
          let lastIndex = 0;
          const regex = /___BLANK_(\d+)___/g;
          let match;
          
          while ((match = regex.exec(questionTextWithBlanks)) !== null) {
            // Agregar texto antes del blank
            if (match.index > lastIndex) {
              textParts.push(
                <span key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(questionTextWithBlanks.slice(lastIndex, match.index)) 
                }} />
              );
            }
            
            const blankId = `blank_${match[1]}`;
            const assignedOptionId = fillBlankAnswer[blankId];
            const assignedOption = fillBlankOptions.find((o: any) => o.id === assignedOptionId);
            
            // Renderizar el blank
            textParts.push(
              <span
                key={blankId}
                className={`inline-block min-w-[120px] fluid-mx-1 fluid-px-3 fluid-py-2 rounded-fluid-md border-2 border-dashed transition-all ${
                  assignedOption 
                    ? 'bg-indigo-100 border-indigo-400 cursor-grab' 
                    : 'bg-gray-100 border-gray-300'
                }`}
                onDragOver={handleFillDragOver}
                onDragLeave={handleFillDragLeave}
                onDrop={(e) => handleDropOnBlank(e, blankId)}
              >
                {assignedOption ? (
                  <span 
                    draggable
                    onDragStart={(e) => handleFillDragStart(e, assignedOption.id)}
                    onDragEnd={handleFillDragEnd}
                    className="flex items-center fluid-gap-1 text-indigo-800 font-medium cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="fluid-icon-xs opacity-50" />
                    {assignedOption.answer_text}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFromBlank(blankId); }}
                      className="fluid-ml-1 fluid-p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-fluid-sm"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="text-gray-400 fluid-text-sm">Espacio {match[1]}</span>
                )}
              </span>
            );
            
            lastIndex = match.index + match[0].length;
          }
          
          // Agregar texto restante
          if (lastIndex < questionTextWithBlanks.length) {
            textParts.push(
              <span key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(questionTextWithBlanks.slice(lastIndex)) 
              }} />
            );
          }
          
          return textParts;
        };

        return (
          <div className="flex flex-col fluid-gap-4">
            <p className="fluid-text-sm text-gray-600 fluid-mb-3 flex items-center fluid-gap-2 bg-indigo-50 fluid-p-3 rounded-fluid-md">
              <GripVertical className="fluid-icon-sm text-indigo-500" />
              <span><strong>Arrastra</strong> cada opción al espacio en blanco correspondiente</span>
            </p>
            
            {/* Texto con blanks */}
            <div className="fluid-p-5 bg-white rounded-fluid-lg border border-gray-200 shadow-sm text-gray-800 leading-relaxed fluid-text-lg">
              {renderTextWithBlanks()}
            </div>
            
            {/* Opciones disponibles */}
            <div 
              className="fluid-p-4 bg-gray-50 rounded-fluid-lg border-2 border-dashed border-gray-300 min-h-[80px] transition-all"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-gray-400', 'bg-gray-100');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-gray-400', 'bg-gray-100');
              }}
              onDrop={handleDropOnAvailable}
            >
              <p className="fluid-text-sm font-semibold text-gray-700 fluid-mb-3 flex items-center fluid-gap-2">
                <List className="fluid-icon-sm text-gray-500" />
                Opciones disponibles
              </p>
              <div className="flex flex-wrap fluid-gap-2">
                {availableOptions.map((option: any) => (
                  <div
                    key={option.id}
                    draggable
                    onDragStart={(e) => handleFillDragStart(e, option.id)}
                    onDragEnd={handleFillDragEnd}
                    className="fluid-px-4 fluid-py-2 bg-white border-2 border-gray-300 text-gray-800 rounded-fluid-md cursor-grab active:cursor-grabbing hover:bg-gray-50 hover:border-gray-400 transition-all fluid-text-sm font-medium shadow-sm select-none"
                  >
                    <span className="flex items-center fluid-gap-2">
                      <GripVertical className="fluid-icon-sm text-gray-400" />
                      {option.answer_text}
                    </span>
                  </div>
                ))}
                {availableOptions.length === 0 && (
                  <p className="text-green-600 fluid-text-sm italic flex items-center fluid-gap-1">
                    ✓ Todas las opciones han sido asignadas
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'column_grouping':
        // Para preguntas de clasificar en columnas
        const columnOptions = currentItem.options || [];
        const columnAnswer = currentAnswer || {};
        
        // Extraer columnas únicas
        const columnsSet = new Set<string>();
        columnOptions.forEach((opt: any) => {
          if (opt.correct_answer) columnsSet.add(opt.correct_answer);
        });
        const columns = Array.from(columnsSet);
        
        // Elementos sin clasificar
        const classifiedItems = new Set(Object.values(columnAnswer).flat());
        const unclassifiedItems = columnOptions.filter((o: any) => !classifiedItems.has(o.id));
        
        const handleClassify = (itemId: string, columnId: string) => {
          const newAnswer = { ...columnAnswer };
          // Remover de cualquier columna anterior
          Object.keys(newAnswer).forEach(c => {
            newAnswer[c] = (newAnswer[c] || []).filter((id: string) => id !== itemId);
          });
          // Agregar a la nueva columna
          newAnswer[columnId] = [...(newAnswer[columnId] || []), itemId];
          handleAnswerChange(currentItem.question_id!, newAnswer);
        };
        
        const handleUnclassify = (itemId: string) => {
          const newAnswer = { ...columnAnswer };
          Object.keys(newAnswer).forEach(c => {
            newAnswer[c] = (newAnswer[c] || []).filter((id: string) => id !== itemId);
          });
          handleAnswerChange(currentItem.question_id!, newAnswer);
        };
        
        // Handlers para drag and drop HTML5 - Column Grouping
        const handleColDragStart = (e: React.DragEvent, itemId: string) => {
          e.dataTransfer.setData('text/plain', itemId);
          e.dataTransfer.effectAllowed = 'move';
          (e.target as HTMLElement).classList.add('opacity-50', 'scale-95');
        };
        
        const handleColDragEnd = (e: React.DragEvent) => {
          (e.target as HTMLElement).classList.remove('opacity-50', 'scale-95');
        };
        
        const handleColDragOver = (e: React.DragEvent, colorClass: string) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          (e.currentTarget as HTMLElement).classList.add('ring-2', colorClass, 'scale-[1.02]');
        };
        
        const handleColDragLeave = (e: React.DragEvent, colorClass: string) => {
          (e.currentTarget as HTMLElement).classList.remove('ring-2', colorClass, 'scale-[1.02]');
        };
        
        const handleDropOnColumn = (e: React.DragEvent, columnId: string, colorClass: string) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove('ring-2', colorClass, 'scale-[1.02]');
          const itemId = e.dataTransfer.getData('text/plain');
          if (itemId) {
            handleClassify(itemId, columnId);
          }
        };
        
        const handleDropOnUnclassified = (e: React.DragEvent) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-gray-400', 'bg-gray-100');
          const itemId = e.dataTransfer.getData('text/plain');
          if (itemId) {
            handleUnclassify(itemId);
          }
        };
        
        const COLUMN_COLORS = [
          { bg: 'bg-blue-50', border: 'border-blue-400', header: 'bg-blue-500', ring: 'ring-blue-500', item: 'bg-blue-100 text-blue-800 border-blue-300' },
          { bg: 'bg-green-50', border: 'border-green-400', header: 'bg-green-500', ring: 'ring-green-500', item: 'bg-green-100 text-green-800 border-green-300' },
          { bg: 'bg-purple-50', border: 'border-purple-400', header: 'bg-purple-500', ring: 'ring-purple-500', item: 'bg-purple-100 text-purple-800 border-purple-300' },
          { bg: 'bg-orange-50', border: 'border-orange-400', header: 'bg-orange-500', ring: 'ring-orange-500', item: 'bg-orange-100 text-orange-800 border-orange-300' },
          { bg: 'bg-pink-50', border: 'border-pink-400', header: 'bg-pink-500', ring: 'ring-pink-500', item: 'bg-pink-100 text-pink-800 border-pink-300' },
          { bg: 'bg-teal-50', border: 'border-teal-400', header: 'bg-teal-500', ring: 'ring-teal-500', item: 'bg-teal-100 text-teal-800 border-teal-300' },
        ];

        return (
          <div className="flex flex-col fluid-gap-4">
            <p className="fluid-text-sm text-gray-600 fluid-mb-3 flex items-center fluid-gap-2 bg-indigo-50 fluid-p-3 rounded-fluid-md">
              <GripVertical className="fluid-icon-sm text-indigo-500" />
              <span><strong>Arrastra</strong> cada elemento a la columna donde corresponde</span>
            </p>
            
            {/* Elementos sin clasificar - Área de origen */}
            <div 
              className="fluid-p-4 bg-gray-50 rounded-fluid-lg border-2 border-dashed border-gray-300 min-h-[80px] transition-all"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-gray-400', 'bg-gray-100');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-gray-400', 'bg-gray-100');
              }}
              onDrop={handleDropOnUnclassified}
            >
              <p className="fluid-text-sm font-semibold text-gray-700 fluid-mb-3 flex items-center fluid-gap-2">
                <List className="fluid-icon-sm text-gray-500" />
                Elementos por clasificar
              </p>
              <div className="flex flex-wrap fluid-gap-2">
                {unclassifiedItems.map((option: any) => (
                  <div
                    key={option.id}
                    draggable
                    onDragStart={(e) => handleColDragStart(e, option.id)}
                    onDragEnd={handleColDragEnd}
                    className="fluid-px-4 fluid-py-2 bg-white border-2 border-gray-300 text-gray-800 rounded-fluid-md cursor-grab active:cursor-grabbing hover:bg-gray-50 hover:border-gray-400 transition-all fluid-text-sm font-medium shadow-sm select-none"
                  >
                    <span className="flex items-center fluid-gap-2">
                      <GripVertical className="fluid-icon-sm text-gray-400" />
                      {option.answer_text}
                    </span>
                  </div>
                ))}
                {unclassifiedItems.length === 0 && (
                  <p className="text-green-600 fluid-text-sm italic flex items-center fluid-gap-1">
                    ✓ Todos los elementos han sido clasificados
                  </p>
                )}
              </div>
            </div>
            
            {/* Columnas de destino */}
            <div 
              className="grid fluid-gap-4" 
              style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, minmax(0, 1fr))` }}
            >
              {columns.map((columnId, idx) => {
                const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
                const colItems = (columnAnswer[columnId] || []).map((id: string) => 
                  columnOptions.find((o: any) => o.id === id)
                ).filter(Boolean);
                
                return (
                  <div
                    key={columnId}
                    className={`rounded-fluid-lg overflow-hidden border-2 ${color.border} shadow-md transition-all`}
                    onDragOver={(e) => handleColDragOver(e, color.ring)}
                    onDragLeave={(e) => handleColDragLeave(e, color.ring)}
                    onDrop={(e) => handleDropOnColumn(e, columnId, color.ring)}
                  >
                    {/* Header de la columna */}
                    <div className={`${color.header} text-white fluid-px-4 fluid-py-3 font-bold text-center`}>
                      {columnId.replace('columna_', 'Columna ').replace(/_/g, ' ')}
                    </div>
                    
                    {/* Área de soltar */}
                    <div className={`${color.bg} fluid-p-3 min-h-[160px]`}>
                      {colItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-gray-400">
                          <div className="w-12 h-12 border-2 border-dashed border-gray-300 rounded-fluid-md flex items-center justify-center fluid-mb-2">
                            <ArrowDown className="fluid-icon text-gray-400" />
                          </div>
                          <p className="fluid-text-xs text-center">Suelta elementos aquí</p>
                        </div>
                      ) : (
                        <div className="flex flex-col fluid-gap-2">
                          {colItems.map((item: any) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => handleColDragStart(e, item.id)}
                              onDragEnd={handleColDragEnd}
                              className={`${color.item} border fluid-px-3 fluid-py-2 rounded-fluid-md fluid-text-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex items-center justify-between group`}
                            >
                              <span className="flex items-center fluid-gap-2">
                                <GripVertical className="fluid-icon-sm opacity-50" />
                                <span>{item.answer_text}</span>
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnclassify(item.id); }}
                                className="opacity-0 group-hover:opacity-100 fluid-p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-fluid-sm transition-all"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return <p className="text-gray-500">Tipo de pregunta no soportado: {currentItem.question_type}</p>;
    }
  };

  // Renderizar ejercicio con pasos e imágenes
  const renderExercise = () => {
    if (!currentItem || currentItem.type !== 'exercise') return null;

    const steps = currentItem.steps || [];
    
    if (steps.length === 0) {
      return (
        <div className="text-center fluid-py-6">
          <Image className="fluid-icon-xl mx-auto text-gray-300 fluid-mb-3" />
          <p className="text-gray-500 fluid-text-sm">Este ejercicio no tiene pasos configurados</p>
        </div>
      );
    }

    const currentStep = steps[currentStepIndex];
    const isStepDone = stepCompleted[`${currentItem.exercise_id}_${currentStepIndex}`];

    return (
      <div className="flex flex-col fluid-gap-4">
        {/* Indicador de pasos */}
        {steps.length > 1 && (
          <div className="flex items-center justify-center fluid-gap-1 fluid-mb-2">
            {steps.map((_: any, idx: number) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStepIndex 
                    ? 'w-6 bg-primary-500' 
                    : idx < currentStepIndex 
                    ? 'w-3 bg-green-400' 
                    : 'w-3 bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}

        {/* Imagen con acciones superpuestas - adaptada a la pantalla */}
        <div 
          ref={imageContainerRef}
          className="relative mx-auto border border-gray-300 rounded-lg overflow-hidden bg-gray-100 group"
          style={{ 
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 180px)',
            minHeight: '250px',
            aspectRatio: currentStep.image_width && currentStep.image_height 
              ? `${currentStep.image_width} / ${currentStep.image_height}` 
              : 'auto'
          }}
        >
          {currentStep.image_url ? (
            <>
              <img
                src={currentStep.image_url}
                alt={currentStep.title || `Paso ${currentStepIndex + 1}`}
                className="w-full h-full object-contain"
                style={{ maxHeight: 'calc(100vh - 180px)', minHeight: '250px' }}
              />
              {/* Botón de pantalla completa */}
              <button
                onClick={() => {
                  setFullscreenZoom(1);
                  setFullscreenPan({ x: 0, y: 0 });
                  setShowImageFullscreen(true);
                }}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex items-center gap-1.5"
                title="Ver imagen en pantalla completa"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Ampliar</span>
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 bg-gray-200">
              <Image className="w-12 h-12 text-gray-400" />
            </div>
          )}

          {/* Acciones superpuestas sobre la imagen */}
          {currentStep.actions?.map((action: any) => (
            <ExerciseAction
              key={action.id}
              action={action}
              exerciseId={currentItem.exercise_id!}
              stepIndex={currentStepIndex}
              isStepCompleted={isStepDone}
              currentValue={exerciseResponses[currentItem.exercise_id!]?.[`${action.step_id}_${action.id}`]}
              onButtonClick={handleButtonClick}
              onWrongActionClick={handleWrongActionClick}
              onTextSubmit={handleTextboxSubmit}
            />
          ))}
        </div>

        {/* Modal de imagen en pantalla completa */}
        {showImageFullscreen && currentStep.image_url && (
          <div 
            className="fixed inset-0 bg-black/95 z-50 flex flex-col"
            onClick={() => setShowImageFullscreen(false)}
          >
            {/* Barra de herramientas superior */}
            <div 
              className="flex items-center justify-between p-4 bg-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span className="text-white/80 text-sm font-medium">
                  {currentStep.title || `Paso ${currentStepIndex + 1} de ${steps.length}`}
                </span>
                <span className="text-white/50 text-xs">
                  ({Math.round(fullscreenZoom * 100)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Controles de zoom */}
                <button
                  onClick={() => setFullscreenZoom(z => Math.max(0.5, z - 0.25))}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Reducir zoom"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setFullscreenZoom(1);
                    setFullscreenPan({ x: 0, y: 0 });
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Restablecer zoom"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setFullscreenZoom(z => Math.min(4, z + 0.25))}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-white/20 mx-2" />
                <button
                  onClick={() => setShowImageFullscreen(false)}
                  className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white transition-colors"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenedor de imagen con zoom y pan */}
            <div 
              className="flex-1 overflow-hidden flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                if (fullscreenZoom > 1) {
                  setIsDragging(true);
                  dragStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    panX: fullscreenPan.x,
                    panY: fullscreenPan.y
                  };
                }
              }}
              onMouseMove={(e) => {
                if (isDragging && fullscreenZoom > 1) {
                  const dx = e.clientX - dragStartRef.current.x;
                  const dy = e.clientY - dragStartRef.current.y;
                  setFullscreenPan({
                    x: dragStartRef.current.panX + dx,
                    y: dragStartRef.current.panY + dy
                  });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                setFullscreenZoom(z => Math.min(4, Math.max(0.5, z + delta)));
              }}
              onDoubleClick={() => {
                if (fullscreenZoom === 1) {
                  setFullscreenZoom(2);
                } else {
                  setFullscreenZoom(1);
                  setFullscreenPan({ x: 0, y: 0 });
                }
              }}
              style={{ cursor: fullscreenZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
            >
              <img
                src={currentStep.image_url}
                alt={currentStep.title || `Paso ${currentStepIndex + 1}`}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${fullscreenZoom}) translate(${fullscreenPan.x / fullscreenZoom}px, ${fullscreenPan.y / fullscreenZoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                draggable={false}
              />
            </div>

            {/* Instrucciones de uso */}
            <div className="p-3 bg-black/50 text-center">
              <p className="text-white/60 text-xs">
                🖱️ Rueda del ratón para zoom • Doble clic para alternar zoom • Arrastra para mover • ESC o clic fuera para cerrar
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading || loadingExercises) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex flex-col justify-center items-center">
        <div className="bg-white rounded-fluid-xl shadow-xl fluid-p-8 max-w-md w-full fluid-mx-4">
          <LoadingSpinner message={loadingExercises ? 'Cargando ejercicios...' : 'Cargando examen...'} />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex justify-center items-center">
        <div className="bg-white rounded-fluid-xl shadow-xl fluid-p-8 text-center">
          <AlertCircle className="fluid-icon-2xl mx-auto text-red-400 fluid-mb-4" />
          <p className="text-gray-600 font-medium">Examen no encontrado</p>
        </div>
      </div>
    );
  }

  if (selectedItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex justify-center items-center">
        <div className="bg-white rounded-fluid-xl shadow-xl fluid-p-8 max-w-md w-full fluid-mx-4">
          <LoadingSpinner />
          <p className="text-gray-600 text-center fluid-mt-4">Preparando preguntas...</p>
        </div>
      </div>
    );
  }

  // Calcular tiempo restante para mostrar 
  const displayMinutes = timeRemaining !== null ? Math.floor(timeRemaining / 60) : 0;
  const displaySeconds = timeRemaining !== null ? timeRemaining % 60 : 0;
  const isTimeWarning = timeRemaining !== null && timeRemaining <= 60; // Último minuto
  const isTimeCritical = timeRemaining !== null && timeRemaining <= 30; // Últimos 30 segundos

  return (
    <div className="min-h-screen bg-slate-50 overflow-y-auto overflow-x-hidden scroll-smooth">
      {/* Modal de confirmación de salida */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="fluid-p-6 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
                <AlertCircle className="fluid-icon text-amber-600" />
              </div>
              <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">¿Salir del examen?</h3>
              <p className="fluid-text-sm text-gray-500 fluid-mb-6">
                Tu progreso será guardado y podrás continuar después.
              </p>
              <div className="flex fluid-gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 fluid-px-4 fluid-py-3 fluid-text-sm font-medium text-gray-700 bg-gray-100 rounded-fluid-md hover:bg-gray-200 transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={() => {
                    // Guardar estado actual como si fuera pérdida de conexión
                    const sessionData = {
                      timeRemaining,
                      savedAt: Date.now(),
                      examDuration: exam?.duration_minutes ? exam.duration_minutes * 60 : null,
                      pauseOnDisconnect: true, // Forzar pausa para que se pueda retomar
                      examName: exam?.name || '',
                      answers,
                      exerciseResponses,
                      currentItemIndex,
                      selectedItems,
                      orderingInteracted,
                      actionErrors,
                      stepCompleted,
                      currentStepIndex,
                      flaggedQuestions: Array.from(flaggedQuestions),
                      exitedManually: true // Marcar que salió manualmente
                    };
                    localStorage.setItem(examSessionKey, JSON.stringify(sessionData));
                    navigate('/exams');
                  }}
                  className="flex-1 fluid-px-4 fluid-py-3 fluid-text-sm font-medium text-white bg-amber-500 rounded-fluid-md hover:bg-amber-600 transition-colors"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notificación de advertencia de tiempo - tipo toast lateral */}
      {showTimeWarning && (
        <div 
          className="fixed top-20 right-4 z-[100] animate-slide-in-right"
        >
          <div 
            className={`flex items-center fluid-gap-3 fluid-px-4 fluid-py-3 rounded-fluid-md shadow-lg border backdrop-blur-sm ${
              showTimeWarning.minutes === 1 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : showTimeWarning.minutes === 5
                  ? 'bg-orange-50 border-orange-200 text-orange-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              showTimeWarning.minutes === 1 
                ? 'bg-red-100' 
                : showTimeWarning.minutes === 5
                  ? 'bg-orange-100'
                  : 'bg-amber-100'
            }`}>
              <Clock className={`fluid-icon-sm ${
                showTimeWarning.minutes === 1 
                  ? 'text-red-600' 
                  : showTimeWarning.minutes === 5
                    ? 'text-orange-600'
                    : 'text-amber-600'
              }`} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold fluid-text-sm">
                {showTimeWarning.minutes === 1 
                  ? '¡Último minuto!' 
                  : `Quedan ${showTimeWarning.minutes} minutos`}
              </span>
              <span className={`fluid-text-xs ${
                showTimeWarning.minutes === 1 
                  ? 'text-red-600' 
                  : showTimeWarning.minutes === 5
                    ? 'text-orange-600'
                    : 'text-amber-600'
              }`}>
                {showTimeWarning.minutes === 1 
                  ? 'Envía tus respuestas' 
                  : 'Administra tu tiempo'}
              </span>
            </div>
            <button 
              className={`fluid-ml-2 fluid-p-2 rounded-fluid-sm transition-colors ${
                showTimeWarning.minutes === 1 
                  ? 'hover:bg-red-100 text-red-400 hover:text-red-600' 
                  : showTimeWarning.minutes === 5
                    ? 'hover:bg-orange-100 text-orange-400 hover:text-orange-600'
                    : 'hover:bg-amber-100 text-amber-400 hover:text-amber-600'
              }`}
              onClick={() => setShowTimeWarning(null)}
            >
              <X className="fluid-icon-sm" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de ejercicio completado - notificación tipo toast */}
      {showExerciseCompleted && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center fluid-p-4"
          onClick={() => setShowExerciseCompleted(false)}
        >
          <div 
            className="bg-emerald-600 text-white rounded-fluid-xl shadow-2xl fluid-px-6 fluid-py-4 flex items-center fluid-gap-3 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="fluid-icon" />
            </div>
            <div>
              <h3 className="font-semibold">¡Ejercicio completado!</h3>
              <p className="fluid-text-sm text-emerald-100">Has terminado todos los pasos</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de error para campo incorrecto */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] fluid-p-4" onClick={() => setShowErrorModal(null)}>
          <div className="bg-white rounded-fluid-xl shadow-2xl max-w-lg w-full fluid-mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header fijo */}
            <div className="flex items-center fluid-gap-4 fluid-p-6 pb-4 border-b border-gray-100">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <X className="fluid-icon text-red-600" />
              </div>
              <h3 className="fluid-text-lg font-semibold text-gray-900">Respuesta incorrecta</h3>
            </div>
            
            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto fluid-p-6 pt-4">
              <div 
                className="text-gray-600 prose prose-sm max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showErrorModal.message) }}
              />
            </div>
            
            {/* Footer fijo */}
            <div className="fluid-p-6 pt-4 border-t border-gray-100">
              {(() => {
                // max_attempts son oportunidades ADICIONALES después del primer error 
                const currentExercise = currentItem;
                const action = currentExercise?.steps
                  ?.flatMap((s: any) => s.actions || [])
                  ?.find((a: any) => `${a.step_id}_${a.id}` === showErrorModal.actionKey);
                const additionalAttempts = action?.max_attempts ?? 1;
                const usedAttempts = actionErrors[showErrorModal.actionKey]?.attempts || 0;
                // El error actual (oportunidad 0) no cuenta, las oportunidades adicionales empiezan después   
                const remaining = additionalAttempts - usedAttempts + 1;
                
                return (
                  <p className="fluid-text-xs text-amber-600 fluid-mb-3 text-center">
                    {remaining > 0 
                      ? `Te ${remaining === 1 ? 'queda' : 'quedan'} ${remaining} ${remaining === 1 ? 'oportunidad' : 'oportunidades'}`
                      : 'No te quedan más oportunidades'
                    }
                  </p>
                );
              })()}
              <button
                onClick={() => setShowErrorModal(null)}
                className={`w-full fluid-px-4 fluid-py-3 text-white rounded-fluid-md font-medium transition-colors ${currentMode === 'simulator' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de avance por error (next_step o next_exercise) */}
      {showSkippedModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" 
          onClick={() => {
            setShowSkippedModal(null);
            if (showSkippedModal.type === 'next_exercise') {
              setShowExerciseCompleted(true);
              setTimeout(() => setShowExerciseCompleted(false), 5000);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-4 p-6 pb-4 border-b border-gray-100">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {showSkippedModal.type === 'next_exercise' ? 'Ejercicio terminado' : 'Pasando al siguiente paso'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {showSkippedModal.type === 'next_exercise' 
                    ? 'Se ha terminado este ejercicio debido a un error'
                    : 'Se te ha pasado al siguiente paso debido a un error'
                  }
                </p>
              </div>
            </div>
            
            {/* Contenido */}
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div 
                    className="text-amber-800 prose prose-sm max-w-none [&>p]:my-1"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showSkippedModal.message) }}
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 pt-0">
              <button
                onClick={() => {
                  setShowSkippedModal(null);
                  if (showSkippedModal.type === 'next_exercise') {
                    setShowExerciseCompleted(true);
                    setTimeout(() => setShowExerciseCompleted(false), 5000);
                  }
                }}
                className={`w-full px-4 py-3 text-white rounded-lg font-medium transition-colors ${
                  currentMode === 'simulator' 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                }`}
              >
                {showSkippedModal.type === 'next_exercise' ? 'Continuar' : 'Ir al siguiente paso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header minimalista - FIJO */}
      <div className="fixed top-0 left-0 right-0 z-40 shadow-md bg-blue-600">
        <div className="w-full fluid-px-6 fluid-py-3">
          <div className="flex items-center justify-between">
            {/* Izquierda: Título */}
            <div className="flex items-center fluid-gap-3 min-w-0 flex-1">
              <div className="min-w-0 flex items-center fluid-gap-3">
                <h1 className="fluid-text-2xl font-bold text-white truncate max-w-[360px] lg:max-w-none drop-shadow-sm">{exam.name}</h1>
                {/* Badge Examen/Simulador en navbar */}
                <span className={`hidden sm:inline-flex items-center fluid-px-2 fluid-py-1 rounded-fluid-sm text-[10px] font-semibold uppercase tracking-wide ${
                  currentMode === 'simulator' 
                    ? 'bg-yellow-300 text-yellow-900' 
                    : 'bg-emerald-400 text-emerald-900'
                }`}>
                  {currentMode === 'simulator' ? 'Simulador' : 'Examen'}
                </span>
                {/* Indicador de pausa por desconexión */}
                {isPaused && (
                  <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded-fluid-sm text-[10px] font-semibold uppercase tracking-wide bg-amber-400 text-amber-900 animate-pulse">
                    ⏸ Pausado
                  </span>
                )}
                {/* Indicador de sin conexión */}
                {!isOnline && (
                  <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded-fluid-sm text-[10px] font-semibold uppercase tracking-wide bg-red-400 text-red-900">
                    📶 Sin conexión
                  </span>
                )}
              </div>
            </div>
            
            {/* Derecha: Timer, ID y Salir */}
            <div className="flex items-center fluid-gap-3 flex-shrink-0">
              {/* ID del usuario */}
              <div className="hidden lg:flex items-center fluid-gap-2 fluid-text-sm">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="fluid-icon-sm text-white" />
                </div>
                <span className="text-white/90 font-medium">
                  {user?.id || '---'}
                </span>
              </div>
              
              {/* Timer */}
              <div className={`flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 rounded-fluid-md font-mono fluid-text-sm transition-all ${
                isTimeCritical 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : isTimeWarning 
                  ? 'bg-amber-400 text-amber-900' 
                  : 'bg-white/20 text-white'
              }`}>
                <Clock className="fluid-icon-sm" />
                <span className="font-medium">
                  {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
                </span>
              </div>

              {/* Botón Salir */}
              <button
                onClick={() => setShowExitConfirm(true)}
                className="flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 text-white/90 hover:text-white bg-white/10 hover:bg-red-500/80 rounded-fluid-md transition-colors fluid-text-sm font-medium"
                title="Salir del examen"
              >
                <LogOut className="fluid-icon-sm" />
                <span className="hidden md:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Barra de progreso sutil - basada en preguntas respondidas */}
        <div className={`h-1 ${currentMode === 'simulator' ? 'bg-amber-600' : 'bg-blue-700'}`}>
          <div
            className={`h-full transition-all duration-500 ease-out ${currentMode === 'simulator' ? 'bg-yellow-300' : 'bg-sky-300'}`}
            style={{ width: `${(getAnsweredCount() / selectedItems.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Navegación de ítems - FIJO debajo del header */}
      <div className="fixed top-[65px] left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="w-full fluid-px-6 fluid-py-2">
          <div className="flex items-center justify-between fluid-gap-2">
            {/* Izquierda: Navegación de pregunta + botón marcar */}
            <div className="flex items-center fluid-gap-2">
              <button
                onClick={() => setShowNavPanel(!showNavPanel)}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-gray-100 hover:bg-gray-200 rounded-fluid-md transition-all min-w-[120px]"
              >
                <span className="flex items-center justify-center w-8 h-8 text-white rounded-full fluid-text-sm font-bold bg-blue-600">
                  {currentItemIndex + 1}
                </span>
                <span className="fluid-text-sm text-gray-600">
                  de <span className="font-semibold text-gray-900">{selectedItems.length}</span>
                </span>
                <ChevronRight className={`fluid-icon-sm text-gray-400 transition-transform ${showNavPanel ? 'rotate-90' : ''}`} />
              </button>

              {/* Botón de marcar pregunta (junto a navegación) */}
              <button
                onClick={() => {
                  setFlaggedQuestions(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(currentItemIndex)) {
                      newSet.delete(currentItemIndex);
                    } else {
                      newSet.add(currentItemIndex);
                    }
                    return newSet;
                  });
                }}
                className={`flex items-center justify-center fluid-px-3 fluid-py-2 h-[38px] rounded-fluid-md transition-colors ${
                  flaggedQuestions.has(currentItemIndex)
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600'
                }`}
                title={flaggedQuestions.has(currentItemIndex) ? 'Quitar marca de revisión' : 'Marcar para revisar esta pregunta después'}
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
            
            {/* Derecha: Botones de navegación */}
            <div className="flex items-center fluid-gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentItemIndex === 0}
                className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 fluid-text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-fluid-md"
              >
                <ChevronLeft className="fluid-icon-sm" />
                <span className="hidden md:inline">Anterior</span>
              </button>
              
              {currentItemIndex === selectedItems.length - 1 ? (
                <button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 fluid-text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors rounded-fluid-md"
                >
                  <span>Entregar Examen</span>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 fluid-text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors rounded-fluid-md"
                >
                  <span className="hidden md:inline">Siguiente</span>
                  <ChevronRight className="fluid-icon-sm" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Panel desplegable de navegación */}
      {showNavPanel && (
        <>
          {/* Overlay para cerrar */}
          <div 
            className="fixed inset-0 z-40 bg-black/20" 
            onClick={() => setShowNavPanel(false)}
          />
          
          {/* Panel */}
          <div className="fixed top-[105px] left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-md bg-white rounded-fluid-xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="fluid-px-4 fluid-py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Navegación del examen</h3>
                <button 
                  onClick={() => setShowNavPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">Selecciona una pregunta para ir directamente</p>
            </div>
            
            <div className="fluid-p-4 max-h-[50vh] overflow-y-auto">
              <div className="grid grid-cols-6 fluid-gap-2">
                {selectedItems.map((item, idx) => {
                  const isAnswered = item.type === 'question' 
                    ? (item.question_type === 'ordering' 
                        ? orderingInteracted[String(item.question_id)] === true
                        : answers[String(item.question_id)] !== undefined)
                    : isExerciseCompleted(item);
                  const isCurrent = idx === currentItemIndex;
                  const isFlagged = flaggedQuestions.has(idx);
                  
                  return (
                    <div key={idx} className="relative">
                      <button
                        onClick={() => {
                          const currentItem = selectedItems[currentItemIndex];
                          if (currentItem?.type === 'question' && currentItem.question_type === 'ordering') {
                            setOrderingInteracted(prev => ({ ...prev, [String(currentItem.question_id)]: true }));
                          }
                          setCurrentItemIndex(idx);
                          setCurrentStepIndex(0);
                          setShowNavPanel(false);
                        }}
                        className={`w-10 h-10 rounded-fluid-md flex items-center justify-center fluid-text-sm font-medium transition-all ${
                          isCurrent
                            ? (currentMode === 'simulator' ? 'bg-amber-500 text-white ring-2 ring-amber-300 scale-105' : 'bg-blue-600 text-white ring-2 ring-blue-300 scale-105')
                            : isFlagged
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : isAnswered
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                      {/* Botón pequeño para marcar/desmarcar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlaggedQuestions(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(idx)) {
                              newSet.delete(idx);
                            } else {
                              newSet.add(idx);
                            }
                            return newSet;
                          });
                        }}
                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                          isFlagged 
                            ? 'bg-orange-600 text-white' 
                            : 'bg-gray-300 text-gray-500 hover:bg-orange-400 hover:text-white'
                        }`}
                        title={isFlagged ? 'Quitar marca' : 'Marcar para revisar'}
                      >
                        <Flag className="fluid-icon-xs" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Leyenda */}
            <div className="fluid-px-4 fluid-py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-center fluid-gap-3 fluid-text-xs">
              <div className="flex items-center fluid-gap-2">
                <div className={`w-4 h-4 rounded-fluid-sm ${currentMode === 'simulator' ? 'bg-amber-500' : 'bg-blue-600'}`}></div>
                <span className="text-gray-600">Actual</span>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-4 h-4 rounded-fluid-sm bg-emerald-500"></div>
                <span className="text-gray-600">Respondida</span>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-4 h-4 rounded-fluid-sm bg-orange-500"></div>
                <span className="text-gray-600">Marcada</span>
              </div>
              <div className="flex items-center fluid-gap-2">
                <div className="w-4 h-4 rounded-fluid-sm bg-gray-200"></div>
                <span className="text-gray-600">Sin responder</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contenido principal */}
      <div className="pt-[125px] pb-[90px] min-h-screen">
        <div className="max-w-[1400px] mx-auto px-2 sm:px-4 lg:fluid-px-6 fluid-py-4 lg:fluid-py-8">
          <div className="bg-white rounded-fluid-lg sm:rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header del ítem - más simple */}
            <div className="fluid-px-6 fluid-py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center justify-between fluid-gap-2">
                <div className="flex items-center fluid-gap-2 flex-wrap">
                  {/* Badge Examen/Simulador */}
                  <span className={`inline-flex items-center fluid-px-2 fluid-py-1 rounded-fluid-sm text-[10px] font-semibold uppercase tracking-wide ${
                    currentMode === 'simulator' 
                      ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' 
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {currentMode === 'simulator' ? 'Simulador' : 'Examen'}
                  </span>
                  {/* Tipo de pregunta/ejercicio */}
                  <span className={`inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-sm fluid-text-xs font-medium ${
                    currentItem?.type === 'question' 
                      ? (currentMode === 'simulator' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700')
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {currentItem?.type === 'question' ? (
                      <>
                        {currentItem.question_type === 'true_false' && 'Verdadero / Falso'}
                        {currentItem.question_type === 'multiple_choice' && 'Selección Única'}
                        {currentItem.question_type === 'multiple_select' && 'Selección Múltiple'}
                        {currentItem.question_type === 'ordering' && 'Ordenamiento'}
                      </>
                    ) : (
                      'Ejercicio Práctico'
                    )}
                  </span>
                </div>
              
                {/* Indicador de estado - solo para ejercicios */}
                {currentItem?.type === 'exercise' && (
                  <span className={`inline-flex items-center fluid-px-2 fluid-py-1 fluid-text-xs font-medium rounded-fluid-sm ${
                    isExerciseCompleted(currentItem)
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-amber-700 bg-amber-100'
                  }`}>
                    {isExerciseCompleted(currentItem) ? (
                      <><CheckCircle className="fluid-icon-xs fluid-mr-1" />Completado</>
                    ) : (
                      'Pendiente'
                    )}
                  </span>
                )}
              </div>
            </div>
          
            {/* Contenido */}
            <div className="p-3 sm:fluid-p-4 lg:fluid-p-6">
              {currentItem?.type === 'question' ? (
                <>
                  <div
                    className="prose prose-gray max-w-none fluid-mb-6 text-gray-800 leading-relaxed overflow-hidden break-words [&_img]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-all"
                    dangerouslySetInnerHTML={{ __html: (() => {
                      // Para drag_drop, extraer solo las instrucciones del question_text
                      const text = currentItem.question_text || '';
                      if (currentItem.question_type === 'drag_drop' && text.includes('___INSTRUCTIONS___') && text.includes('___TEMPLATE___')) {
                        const parts = text.split('___TEMPLATE___');
                        const instructionsOnly = parts[0].replace('___INSTRUCTIONS___', '').trim();
                        return instructionsOnly || '';
                      }
                      return text;
                    })() }}
                  />
                  <div className="mt-4">
                    {renderQuestionInput()}
                  </div>
                </>
              ) : (
                <>
                  {currentItem?.title && (
                    <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">{currentItem.title}</h2>
                  )}
                  {currentItem?.description && (
                    <div
                      className="prose prose-sm max-w-none fluid-mb-4 text-gray-600 overflow-hidden break-words [&_img]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-all"
                    dangerouslySetInnerHTML={{ __html: currentItem.description }}
                  />
                )}
                {renderExercise()}
              </>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Modal de confirmación - Simplificado */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="fluid-p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
                <CheckCircle className="fluid-icon text-emerald-600" />
              </div>
              <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">
                ¿Finalizar examen?
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mb-2">
                Has completado <span className="font-semibold text-gray-900">{getAnsweredCount()}</span> de <span className="font-semibold text-gray-900">{selectedItems.length}</span> ítems.
              </p>
              {getAnsweredCount() < selectedItems.length && (
                <p className="fluid-text-xs text-amber-600 bg-amber-50 fluid-px-3 fluid-py-2 rounded-fluid-sm inline-block fluid-mb-4">
                  {selectedItems.length - getAnsweredCount()} sin completar
                </p>
              )}
            </div>

            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                disabled={isSubmitting}
                className="flex-1 fluid-px-4 fluid-py-3 fluid-text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 border-r border-gray-100"
              >
                Continuar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 fluid-px-4 fluid-py-3 fluid-text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin fluid-mr-2 h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Evaluando...
                  </>
                ) : (
                  'Finalizar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para acciones de ejercicio (botones y textboxes)
interface ExerciseActionProps {
  action: any;
  exerciseId: string;
  stepIndex: number;
  isStepCompleted: boolean;
  currentValue: any;
  onButtonClick: (action: any, exerciseId: string, stepIndex: number) => void;
  onWrongActionClick: (action: any, exerciseId: string, stepIndex: number) => void;
  onTextSubmit: (action: any, exerciseId: string, stepIndex: number, value: string) => void;
}

const ExerciseAction: React.FC<ExerciseActionProps> = ({
  action,
  exerciseId,
  stepIndex,
  isStepCompleted,
  currentValue,
  onButtonClick,
  onWrongActionClick,
  onTextSubmit
}) => {
  const [textValue, setTextValue] = useState(currentValue || '');
  const [showFeedback, setShowFeedback] = useState(false);

  // Determinar si es un campo de texto (text_input o textbox)
  const isTextInput = action.action_type === 'text_input' || action.action_type === 'textbox';
  
  // Un text_input es "correcto" si tiene correct_answer válido que no sea 'wrong'
  // Es "incorrecto" si correct_answer es 'wrong', vacío, null o undefined
  const hasValidCorrectAnswer = action.correct_answer && 
    action.correct_answer !== 'wrong' && 
    String(action.correct_answer).trim() !== '';
  
  const isWrongTextInput = isTextInput && !hasValidCorrectAnswer;
  const isCorrectTextInput = isTextInput && hasValidCorrectAnswer;

  // Estilo base para posicionar la acción
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${action.position_x}%`,
    top: `${action.position_y}%`,
    width: `${action.width}%`,
    height: `${action.height}%`,
    pointerEvents: isStepCompleted ? 'none' : 'auto',
    opacity: isCorrectTextInput ? 1 : 0, // Solo campos de texto correctos visibles
  };

  if (action.action_type === 'button') {
    // Verificar si es botón correcto o incorrecto
    const isCorrectButton = action.correct_answer && 
      ['true', '1', 'correct', 'yes', 'si', 'sí'].includes(String(action.correct_answer).toLowerCase().trim());
    const isWrongButton = action.correct_answer === 'wrong' || 
      (action.correct_answer && !isCorrectButton);
    
    // Determinar cursor según scoring_mode para botones incorrectos
    const useTextCursor = action.scoring_mode === 'text_cursor';
    const useDefaultCursor = action.scoring_mode === 'default_cursor';
    const cursorStyle = isWrongButton 
      ? (useTextCursor ? 'text' : useDefaultCursor ? 'default' : 'pointer')
      : undefined;
    
    // Botones incorrectos son invisibles
    const buttonStyle = {
      ...style,
      opacity: isWrongButton ? 0 : style.opacity,
      cursor: cursorStyle,
    };
    
    return (
      <button
        style={buttonStyle}
        onClick={() => {
          setShowFeedback(true);
          if (isCorrectButton) {
            // Solo avanzar si es botón correcto
            setTimeout(() => {
              setShowFeedback(false);
              onButtonClick(action, exerciseId, stepIndex);
            }, 300);
          } else {
            // Botón incorrecto: usar handler de campos incorrectos
            setTimeout(() => {
              setShowFeedback(false);
              onWrongActionClick(action, exerciseId, stepIndex);
            }, 300);
          }
        }}
        disabled={isStepCompleted}
        className={`flex items-center justify-center fluid-text-xs font-medium rounded-fluid-sm border-2 transition-all ${
          currentValue 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : showFeedback
            ? 'bg-primary-200 border-primary-600 scale-95'
            : 'bg-primary-100 border-primary-400 text-primary-700 hover:bg-primary-200 hover:border-primary-500'
        }`}
      >
        {action.label && (
          <span className="truncate fluid-px-1">{action.label}</span>
        )}
        {currentValue && <span className="ml-1">✓</span>}
      </button>
    );
  }

  // Campos de texto incorrectos (actúan como áreas invisibles)
  if (isWrongTextInput) {
    // Determinar cursor según scoring_mode
    const useTextCursor = action.scoring_mode === 'text_cursor';
    const useDefaultCursor = action.scoring_mode === 'default_cursor';
    const cursorStyle = useTextCursor ? 'text' : useDefaultCursor ? 'default' : 'pointer';
    
    return (
      <div
        style={{ ...style, opacity: 0, cursor: cursorStyle }}
        onClick={() => {
          if (!isStepCompleted) {
            // Usar handler de campos incorrectos
            setShowFeedback(true);
            setTimeout(() => {
              setShowFeedback(false);
              onWrongActionClick(action, exerciseId, stepIndex);
            }, 300);
          }
        }}
        className="flex items-center"
      />
    );
  }

  // Campos de texto correctos (text_input o textbox)
  if (isTextInput) {
    return (
      <div 
        style={{
          ...style,
          overflow: 'visible',
          pointerEvents: 'auto',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '4px',
        }} 
        className="flex items-center"
      >
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textValue.trim()) {
              onTextSubmit(action, exerciseId, stepIndex, textValue);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={() => {
            if (textValue.trim() && !currentValue) {
              onTextSubmit(action, exerciseId, stepIndex, textValue);
            }
          }}
          placeholder=""
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
            overflow: 'hidden',
            textOverflow: 'clip',
          }}
        />
      </div>
    );
  }

  return null;
};

export default ExamTestRunPage;
