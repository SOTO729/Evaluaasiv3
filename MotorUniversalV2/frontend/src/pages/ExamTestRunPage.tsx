import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, GripVertical, Image, Clock, ArrowLeft, X } from 'lucide-react';
import DOMPurify from 'dompurify';

// Tipo para representar un ítem del test (pregunta o ejercicio)
interface TestItem {
  type: 'question' | 'exercise';
  id: string | number;
  category_name: string;
  topic_name: string;
  item_mode: 'exam' | 'simulator'; // Modo: examen o simulador
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
  
  const { questionCount, exerciseCount, mode } = location.state as { questionCount: number; exerciseCount: number; mode?: 'exam' | 'simulator' };
  
  // Modo actual (por defecto 'exam' si no viene especificado)
  const currentMode = mode || 'exam';
  
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [startTime] = useState(Date.now());
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  
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
  
  // Estado para modal de ejercicio completado
  const [showExerciseCompleted, setShowExerciseCompleted] = useState(false);
  
  // Estado para errores en acciones de ejercicios (campos incorrectos)
  const [actionErrors, setActionErrors] = useState<Record<string, { message: string; attempts: number }>>({});
  const [showErrorModal, setShowErrorModal] = useState<{ message: string; actionKey: string; exerciseId: string; stepIndex: number } | null>(null);

  // Estado para advertencias de tiempo
  const [timeWarningsShown, setTimeWarningsShown] = useState<Set<number>>(new Set());
  const [showTimeWarning, setShowTimeWarning] = useState<{ minutes: number } | null>(null);

  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examService.getExam(Number(examId!), true),
    enabled: !!examId
  });

  // Inicializar tiempo restante cuando se carga el examen
  useEffect(() => {
    if (exam?.duration_minutes) {
      setTimeRemaining(exam.duration_minutes * 60);
    }
  }, [exam]);

  // Actualizar tiempo restante cada segundo
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;
    
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
  }, [timeRemaining]);

  // Estado para envío de examen (declarado aquí para usarlo en auto-submit)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  // Auto-submit cuando el tiempo se acaba
  useEffect(() => {
    if (timeRemaining === 0 && !isSubmitting && !timeExpired) {
      setTimeExpired(true);
      // Cerrar cualquier modal abierto
      setShowConfirmSubmit(false);
      setShowExitConfirm(false);
      setShowNavPanel(false);
      setShowExerciseCompleted(false);
      setShowErrorModal(null);
      setShowTimeWarning(null);
    }
  }, [timeRemaining, isSubmitting, timeExpired]);

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

  // Seleccionar preguntas y ejercicios aleatorios
  const [selectedItems, setSelectedItems] = useState<TestItem[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      if (!exam) return;
      
      const allQuestions: TestItem[] = [];
      const allExerciseRefs: { topicId: number; exerciseId: string; category_name: string; topic_name: string; item_mode: 'exam' | 'simulator' }[] = [];
      
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
                options: question.answers || question.options
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
                item_mode: exerciseMode
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
              steps: exercise.steps || []
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
  }, [exam, questionCount, exerciseCount, currentMode]);

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
      // Cerrar modal y terminar ejercicio inmediatamente
      setShowErrorModal(null);
      handleExerciseActionResponse(exerciseId, action.step_id, action.id, false);
      markStepCompleted(exerciseId, stepIndex);
      // Mostrar modal de completado
      setShowExerciseCompleted(true);
      setTimeout(() => setShowExerciseCompleted(false), 5000);
      return;
    }

    // Si la acción es pasar al siguiente paso (sin reintentos)
    if (onErrorAction === 'next_step') {
      // Marcar como completado (aunque incorrecto) y avanzar
      handleExerciseActionResponse(exerciseId, action.step_id, action.id, false);
      markStepCompleted(exerciseId, stepIndex);
      
      const currentExercise = currentItem;
      if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
        setCurrentStepIndex(stepIndex + 1);
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
          <div className="space-y-3 w-full">
            <label className={`group flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all w-full ${
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
            <label className={`group flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all w-full ${
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
          <div className="space-y-2">
            {currentItem.options?.map((option: any, index: number) => (
              <label
                key={option.id}
                className={`group flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
                  currentAnswer === option.id 
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-full font-medium text-sm flex-shrink-0 transition-all ${
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
                  className="ml-3 text-sm text-gray-700 prose prose-sm max-w-none flex-1"
                  dangerouslySetInnerHTML={{ __html: option.answer_text }}
                />
              </label>
            ))}
          </div>
        );

      case 'multiple_select':
        return (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-primary-100 text-primary-600 flex items-center justify-center text-[10px]">✓</span>
              Selecciona todas las opciones correctas
            </p>
            {currentItem.options?.map((option: any) => {
              const selectedOptions = currentAnswer || [];
              const isChecked = selectedOptions.includes(option.id);
              
              return (
                <label
                  key={option.id}
                  className={`group flex items-center p-3 border rounded-lg cursor-pointer transition-all ${
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
                    className="ml-3 text-sm text-gray-700 prose prose-sm max-w-none flex-1"
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
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
              <GripVertical className="w-4 h-4 text-gray-400" />
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
                className={`group flex items-center p-3 border-2 rounded-xl cursor-grab active:cursor-grabbing select-none ${
                  draggedIndex === index 
                    ? 'border-primary-500 bg-primary-100 border-dashed opacity-50' 
                    : draggedIndex !== null
                    ? 'border-gray-200 bg-gray-50/70'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-lg font-bold text-sm flex-shrink-0 transition-all ${
                  draggedIndex === index 
                    ? 'bg-primary-300 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <GripVertical className={`w-5 h-5 flex-shrink-0 mx-2 transition-colors ${
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
                className="flex items-center p-4 border-2 border-primary-500 bg-white rounded-xl shadow-2xl ring-4 ring-primary-200"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-base flex-shrink-0 bg-primary-500 text-white shadow-md">
                  {draggedContent.index}
                </div>
                <GripVertical className="w-6 h-6 flex-shrink-0 mx-3 text-primary-500" />
                <div
                  className="text-base prose prose-base max-w-none flex-1 text-gray-900 font-medium"
                  dangerouslySetInnerHTML={{ __html: draggedContent.text }}
                />
              </div>
            )}
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
        <div className="text-center py-6">
          <Image className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Este ejercicio no tiene pasos configurados</p>
        </div>
      );
    }

    const currentStep = steps[currentStepIndex];
    const isStepDone = stepCompleted[`${currentItem.exercise_id}_${currentStepIndex}`];

    return (
      <div className="space-y-4">
        {/* Indicador de pasos */}
        {steps.length > 1 && (
          <div className="flex items-center justify-center gap-1 mb-2">
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
          className="relative mx-auto border border-gray-300 rounded-lg overflow-hidden bg-gray-100"
          style={{ 
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 340px)',
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
              style={{ maxHeight: 'calc(100vh - 340px)' }}
            />
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
      </div>
    );
  };

  if (isLoading || loadingExercises) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex flex-col justify-center items-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <LoadingSpinner message={loadingExercises ? 'Cargando ejercicios...' : 'Cargando examen...'} />
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex justify-center items-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <p className="text-gray-600 font-medium">Examen no encontrado</p>
        </div>
      </div>
    );
  }

  if (selectedItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex justify-center items-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <LoadingSpinner />
          <p className="text-gray-600 text-center mt-4">Preparando preguntas...</p>
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
    <div className="min-h-screen bg-slate-50 overflow-x-hidden overscroll-contain">
      {/* Modal de confirmación de salida */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Salir de la prueba?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Perderás todo el progreso de esta prueba.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={() => navigate(`/exams/${examId}/edit`)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
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
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${
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
              <Clock className={`w-4 h-4 ${
                showTimeWarning.minutes === 1 
                  ? 'text-red-600' 
                  : showTimeWarning.minutes === 5
                    ? 'text-orange-600'
                    : 'text-amber-600'
              }`} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">
                {showTimeWarning.minutes === 1 
                  ? '¡Último minuto!' 
                  : `Quedan ${showTimeWarning.minutes} minutos`}
              </span>
              <span className={`text-xs ${
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
              className={`ml-2 p-1.5 rounded-md transition-colors ${
                showTimeWarning.minutes === 1 
                  ? 'hover:bg-red-100 text-red-400 hover:text-red-600' 
                  : showTimeWarning.minutes === 5
                    ? 'hover:bg-orange-100 text-orange-400 hover:text-orange-600'
                    : 'hover:bg-amber-100 text-amber-400 hover:text-amber-600'
              }`}
              onClick={() => setShowTimeWarning(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de ejercicio completado - notificación tipo toast */}
      {showExerciseCompleted && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowExerciseCompleted(false)}
        >
          <div 
            className="bg-emerald-600 text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 animate-bounce-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold">¡Ejercicio completado!</h3>
              <p className="text-sm text-emerald-100">Has terminado todos los pasos</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de error para campo incorrecto */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowErrorModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header fijo */}
            <div className="flex items-center gap-4 p-6 pb-4 border-b border-gray-100">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Respuesta incorrecta</h3>
            </div>
            
            {/* Contenido con scroll */}
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div 
                className="text-gray-600 prose prose-sm max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>h1]:text-lg [&>h2]:text-base [&>h3]:text-sm"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(showErrorModal.message) }}
              />
            </div>
            
            {/* Footer fijo */}
            <div className="p-6 pt-4 border-t border-gray-100">
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
                  <p className="text-xs text-amber-600 mb-3 text-center">
                    {remaining > 0 
                      ? `Te ${remaining === 1 ? 'queda' : 'quedan'} ${remaining} ${remaining === 1 ? 'oportunidad' : 'oportunidades'}`
                      : 'No te quedan más oportunidades'
                    }
                  </p>
                );
              })()}
              <button
                onClick={() => setShowErrorModal(null)}
                className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header minimalista - FIJO */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-teal-600 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Izquierda: Volver y título */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Volver al editor"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-white truncate max-w-[150px] sm:max-w-none">{exam.name}</h1>
                  {/* Badge Examen/Simulador en navbar */}
                  <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                    currentMode === 'simulator' 
                      ? 'bg-purple-400 text-purple-900' 
                      : 'bg-teal-400 text-teal-900'
                  }`}>
                    {currentMode === 'simulator' ? 'Simulador' : 'Examen'}
                  </span>
                </div>
                <p className="text-xs text-white/60">
                  Reactivo {currentItemIndex + 1} de {selectedItems.length}
                </p>
              </div>
            </div>
            
            {/* Derecha: Timer y progreso */}
            <div className="flex items-center gap-4">
              {/* Progreso respondidas */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-white/60">Completadas:</span>
                <span className={`font-semibold ${getAnsweredCount() === selectedItems.length ? 'text-emerald-300' : 'text-white'}`}>
                  {getAnsweredCount()}/{selectedItems.length}
                </span>
              </div>
              
              {/* Timer */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm transition-all ${
                isTimeCritical 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : isTimeWarning 
                  ? 'bg-amber-400 text-amber-900' 
                  : 'bg-white/20 text-white'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-medium">
                  {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Barra de progreso sutil - basada en preguntas respondidas */}
        <div className="h-1 bg-teal-700">
          <div
            className="h-full bg-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${(getAnsweredCount() / selectedItems.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Navegación de ítems - FIJO debajo del header */}
      <div className="fixed top-[73px] left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Botón para abrir panel de navegación */}
            <button
              onClick={() => setShowNavPanel(!showNavPanel)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
            >
              <span className="flex items-center justify-center w-7 h-7 bg-teal-600 text-white rounded-full text-sm font-bold">
                {currentItemIndex + 1}
              </span>
              <span className="text-sm text-gray-600">
                de <span className="font-semibold text-gray-900">{selectedItems.length}</span>
              </span>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showNavPanel ? 'rotate-90' : ''}`} />
            </button>
            
            {/* Indicador de progreso */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                {selectedItems.filter((item) => {
                  if (item.type === 'question') {
                    return item.question_type === 'ordering' 
                      ? orderingInteracted[String(item.question_id)] === true
                      : answers[String(item.question_id)] !== undefined;
                  }
                  return isExerciseCompleted(item);
                }).length} respondidas
              </span>
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
          <div className="fixed top-[120px] left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Navegación del examen</h3>
                <button 
                  onClick={() => setShowNavPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Selecciona una pregunta para ir directamente</p>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {selectedItems.map((item, idx) => {
                  const isAnswered = item.type === 'question' 
                    ? (item.question_type === 'ordering' 
                        ? orderingInteracted[String(item.question_id)] === true
                        : answers[String(item.question_id)] !== undefined)
                    : isExerciseCompleted(item);
                  const isCurrent = idx === currentItemIndex;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        const currentItem = selectedItems[currentItemIndex];
                        if (currentItem?.type === 'question' && currentItem.question_type === 'ordering') {
                          setOrderingInteracted(prev => ({ ...prev, [String(currentItem.question_id)]: true }));
                        }
                        setCurrentItemIndex(idx);
                        setCurrentStepIndex(0);
                        setShowNavPanel(false);
                      }}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                        isCurrent
                          ? 'bg-teal-600 text-white ring-2 ring-teal-300 scale-105'
                          : isAnswered
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Leyenda */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-teal-600"></div>
                <span className="text-gray-600">Actual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-emerald-500"></div>
                <span className="text-gray-600">Respondida</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-gray-200"></div>
                <span className="text-gray-600">Pendiente</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contenido principal */}
      <div className="pt-[125px] pb-[80px] min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header del ítem - más simple */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Badge Examen/Simulador */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                    currentMode === 'simulator' 
                      ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                      : 'bg-teal-100 text-teal-700 border border-teal-200'
                  }`}>
                    {currentMode === 'simulator' ? 'Simulador' : 'Examen'}
                  </span>
                  {/* Tipo de pregunta/ejercicio */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                    currentItem?.type === 'question' 
                      ? 'bg-teal-100 text-teal-700' 
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
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${
                    isExerciseCompleted(currentItem)
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-amber-700 bg-amber-100'
                  }`}>
                    {isExerciseCompleted(currentItem) ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Completado</>
                    ) : (
                      'Pendiente'
                    )}
                  </span>
                )}
              </div>
            </div>
          
            {/* Contenido */}
            <div className="p-5 sm:p-6">
              {currentItem?.type === 'question' ? (
                <>
                  <div
                    className="prose prose-gray max-w-none mb-6 text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: currentItem.question_text || '' }}
                  />
                  <div className="mt-4">
                    {renderQuestionInput()}
                  </div>
                </>
              ) : (
                <>
                  {currentItem?.title && (
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">{currentItem.title}</h2>
                  )}
                  {currentItem?.description && (
                    <div
                      className="prose prose-sm max-w-none mb-4 text-gray-600"
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

      {/* Barra de navegación inferior - FIJA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentItemIndex === 0}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Anterior
            </button>

            {/* Indicador central de progreso (móvil) */}
            <span className="sm:hidden text-xs text-gray-500">
              {currentItemIndex + 1} / {selectedItems.length}
            </span>

            <div className="flex items-center gap-2">
              {currentItemIndex === selectedItems.length - 1 ? (
                <button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="flex items-center px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Finalizar
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación - Simplificado */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¿Finalizar examen?
              </h3>
              <p className="text-sm text-gray-500 mb-2">
                Has completado <span className="font-semibold text-gray-900">{getAnsweredCount()}</span> de <span className="font-semibold text-gray-900">{selectedItems.length}</span> ítems.
              </p>
              {getAnsweredCount() < selectedItems.length && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md inline-block mb-4">
                  {selectedItems.length - getAnsweredCount()} sin completar
                </p>
              )}
            </div>

            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 border-r border-gray-100"
              >
                Continuar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin mr-2 h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        className={`flex items-center justify-center text-xs font-medium rounded border-2 transition-all ${
          currentValue 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : showFeedback
            ? 'bg-primary-200 border-primary-600 scale-95'
            : 'bg-primary-100 border-primary-400 text-primary-700 hover:bg-primary-200 hover:border-primary-500'
        }`}
      >
        {action.label && (
          <span className="truncate px-1">{action.label}</span>
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
