import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { examService } from '../services/examService';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, GripVertical, Image, Clock, ArrowLeft } from 'lucide-react';

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
  
  const { questionCount, exerciseCount } = location.state as { questionCount: number; exerciseCount: number };
  
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

  // Auto-submit cuando el tiempo se acaba
  useEffect(() => {
    if (timeRemaining === 0) {
      handleSubmit();
    }
  }, [timeRemaining]);

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
          // Agregar preguntas
          topic.questions?.forEach((question: any) => {
            allQuestions.push({
              type: 'question',
              id: question.id,
              category_name: category.name,
              topic_name: topic.name,
              item_mode: question.type || 'exam', // exam o simulator
              question_id: question.id,
              question_text: question.question_text,
              question_type: question.question_type?.name || question.question_type,
              options: question.answers || question.options
            });
          });
          
          // Recopilar referencias a ejercicios
          topic.exercises?.forEach((exercise: any) => {
            allExerciseRefs.push({
              topicId: topic.id,
              exerciseId: exercise.id,
              category_name: category.name,
              topic_name: topic.name,
              item_mode: exercise.type || 'exam' // exam o simulator
            });
          });
        });
      });

      // Seleccionar preguntas aleatorias
      const shuffledQuestions = [...allQuestions].sort(() => Math.random() - 0.5);
      const selectedQuestions = shuffledQuestions.slice(0, questionCount);
      
      // Seleccionar y cargar ejercicios aleatorios
      let selectedExercises: TestItem[] = [];
      if (exerciseCount > 0 && allExerciseRefs.length > 0) {
        setLoadingExercises(true);
        const shuffledExercises = [...allExerciseRefs].sort(() => Math.random() - 0.5);
        const exercisesToLoad = shuffledExercises.slice(0, exerciseCount);
        
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
      setSelectedItems(allItems);
      
      // Inicializar respuestas para preguntas de ordenamiento
      // El orden inicial se considera como la respuesta por defecto
      const initialOrderingAnswers: Record<string, any> = {};
      allItems.forEach(item => {
        if (item.type === 'question' && item.question_type === 'ordering' && item.options) {
          initialOrderingAnswers[String(item.question_id)] = item.options.map((o: any) => o.id);
        }
      });
      if (Object.keys(initialOrderingAnswers).length > 0) {
        setAnswers(prev => ({ ...prev, ...initialOrderingAnswers }));
      }
    };
    
    loadItems();
  }, [exam, questionCount, exerciseCount]);

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

  // Manejar clic en un botón de acción
  const handleButtonClick = (action: any, exerciseId: string, stepIndex: number) => {
    handleExerciseActionResponse(exerciseId, action.step_id, action.id, true);
    markStepCompleted(exerciseId, stepIndex);
    
    // Avanzar al siguiente paso si hay más
    const currentExercise = currentItem;
    if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
      setCurrentStepIndex(stepIndex + 1);
    }
  };

  // Manejar respuesta de textbox
  const handleTextboxSubmit = (action: any, exerciseId: string, stepIndex: number, value: string) => {
    handleExerciseActionResponse(exerciseId, action.step_id, action.id, value);
    markStepCompleted(exerciseId, stepIndex);
    
    // Avanzar al siguiente paso si hay más
    const currentExercise = currentItem;
    if (currentExercise?.steps && stepIndex < currentExercise.steps.length - 1) {
      setCurrentStepIndex(stepIndex + 1);
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
      setCurrentStepIndex(0);
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
      setCurrentItemIndex(prev => prev - 1);
      setCurrentStepIndex(0);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      
      console.log('✅ Navegando a resultados con:', { results, itemsCount: selectedItems.length, elapsedTime });
      
      navigate(`/test-exams/${examId}/results`, {
        state: {
          evaluationResults: results,
          items: selectedItems,
          elapsedTime,
          questionCount,
          exerciseCount,
          examName: exam?.name,
          passingScore: exam?.passing_score
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

  const renderQuestionInput = () => {
    if (!currentItem || currentItem.type !== 'question') return null;

    const currentAnswer = answers[String(currentItem.question_id)];

    switch (currentItem.question_type) {
      case 'true_false':
        return (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <label className={`group flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
              currentAnswer === true 
                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' 
                : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}>
              <input
                type="radio"
                name={`question-${currentItem.question_id}`}
                value="true"
                checked={currentAnswer === true}
                onChange={() => handleAnswerChange(currentItem.question_id!, true)}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                currentAnswer === true 
                  ? 'bg-emerald-500 text-white' 
                  : 'border-2 border-gray-300 group-hover:border-emerald-400'
              }`}>
                {currentAnswer === true && <CheckCircle className="w-3.5 h-3.5" />}
              </div>
              <span className={`font-medium ${currentAnswer === true ? 'text-emerald-700' : 'text-gray-700'}`}>
                Verdadero
              </span>
            </label>
            <label className={`group flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
              currentAnswer === false 
                ? 'border-red-500 bg-red-50 ring-1 ring-red-500' 
                : 'border-gray-200 hover:border-red-300 hover:bg-red-50/50'
            }`}>
              <input
                type="radio"
                name={`question-${currentItem.question_id}`}
                value="false"
                checked={currentAnswer === false}
                onChange={() => handleAnswerChange(currentItem.question_id!, false)}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                currentAnswer === false 
                  ? 'bg-red-500 text-white' 
                  : 'border-2 border-gray-300 group-hover:border-red-400'
              }`}>
                {currentAnswer === false && <AlertCircle className="w-3.5 h-3.5" />}
              </div>
              <span className={`font-medium ${currentAnswer === false ? 'text-red-700' : 'text-gray-700'}`}>
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
                <div className={`flex items-center justify-center w-7 h-7 rounded-md font-medium text-sm flex-shrink-0 transition-all ${
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
                  <div className={`flex items-center justify-center w-5 h-5 rounded flex-shrink-0 transition-all ${
                    isChecked 
                      ? 'bg-primary-500 text-white' 
                      : 'border-2 border-gray-300 group-hover:border-gray-400'
                  }`}>
                    {isChecked && <CheckCircle className="w-3.5 h-3.5" />}
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

        const handleDragStart = (index: number) => {
          setDraggedIndex(index);
        };

        const handleDragOver = (e: React.DragEvent, index: number) => {
          e.preventDefault();
          if (draggedIndex === null || draggedIndex === index) return;
          
          const newOrder = [...orderAnswer];
          const [removed] = newOrder.splice(draggedIndex, 1);
          newOrder.splice(index, 0, removed);
          handleAnswerChange(currentItem.question_id!, newOrder);
          setDraggedIndex(index);
          
          setOrderingInteracted(prev => ({ ...prev, [String(currentItem.question_id)]: true }));
        };

        const handleDragEnd = () => {
          setDraggedIndex(null);
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
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center p-3 border rounded-lg cursor-move transition-all ${
                  draggedIndex === index 
                    ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 scale-[1.01]' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-gray-600 font-medium text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mx-2 transition-colors" />
                <div
                  className="text-sm text-gray-700 prose prose-sm max-w-none flex-1"
                  dangerouslySetInnerHTML={{ __html: option.answer_text }}
                />
              </div>
            ))}
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
    const isLastStep = currentStepIndex === steps.length - 1;
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
              onTextSubmit={handleTextboxSubmit}
            />
          ))}
        </div>

        {/* Navegación de pasos */}
        {!isLastStep && (
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-1"
            >
              Siguiente Paso
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
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
    <div className="min-h-screen bg-slate-50">
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

      {/* Header minimalista - FIJO */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Izquierda: Volver y título */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExitConfirm(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Volver al editor"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-none">{exam.name}</h1>
                  {/* Badge Examen/Simulador en navbar */}
                  {currentItem && (
                    <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                      currentItem.item_mode === 'simulator' 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-teal-100 text-teal-700'
                    }`}>
                      {currentItem.item_mode === 'simulator' ? '🎮 Simulador' : '📝 Examen'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Ítem {currentItemIndex + 1} de {selectedItems.length}
                </p>
              </div>
            </div>
            
            {/* Derecha: Timer y progreso */}
            <div className="flex items-center gap-4">
              {/* Progreso respondidas */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-gray-400">Completadas:</span>
                <span className={`font-semibold ${getAnsweredCount() === selectedItems.length ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {getAnsweredCount()}/{selectedItems.length}
                </span>
              </div>
              
              {/* Timer */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm transition-all ${
                isTimeCritical 
                  ? 'bg-red-100 text-red-700 animate-pulse' 
                  : isTimeWarning 
                  ? 'bg-amber-100 text-amber-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-medium">
                  {String(displayMinutes).padStart(2, '0')}:{String(displaySeconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Barra de progreso sutil */}
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full bg-primary-500 transition-all duration-500 ease-out"
            style={{ width: `${((currentItemIndex + 1) / selectedItems.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Navegación de ítems - FIJO debajo del header */}
      <div className="fixed top-[73px] left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
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
                  }}
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    isCurrent
                      ? 'bg-primary-600 text-white ring-2 ring-primary-200'
                      : isAnswered
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {isAnswered && !isCurrent ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    idx + 1
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
                    currentItem?.item_mode === 'simulator' 
                      ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                      : 'bg-teal-100 text-teal-700 border border-teal-200'
                  }`}>
                    {currentItem?.item_mode === 'simulator' ? '🎮 Simulador' : '📝 Examen'}
                  </span>
                  {/* Tipo de pregunta/ejercicio */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                    currentItem?.type === 'question' 
                      ? 'bg-primary-100 text-primary-700' 
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
  onTextSubmit: (action: any, exerciseId: string, stepIndex: number, value: string) => void;
}

const ExerciseAction: React.FC<ExerciseActionProps> = ({
  action,
  exerciseId,
  stepIndex,
  isStepCompleted,
  currentValue,
  onButtonClick,
  onTextSubmit
}) => {
  const [textValue, setTextValue] = useState(currentValue || '');
  const [showFeedback, setShowFeedback] = useState(false);


  // Hacer invisibles los campos de acción durante la resolución
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${action.position_x}%`,
    top: `${action.position_y}%`,
    width: `${action.width}%`,
    height: `${action.height}%`,
    pointerEvents: isStepCompleted ? 'none' : 'auto',
    opacity: 0, // Siempre invisible durante la resolución
  };

  if (action.action_type === 'button') {
    return (
      <button
        style={style}
        onClick={() => {
          setShowFeedback(true);
          setTimeout(() => {
            setShowFeedback(false);
            onButtonClick(action, exerciseId, stepIndex);
          }, 300);
        }}
        disabled={isStepCompleted}
        className={`flex items-center justify-center text-xs font-medium rounded border-2 transition-all ${
          currentValue 
            ? 'bg-green-100 border-green-500 text-green-700' 
            : showFeedback
            ? 'bg-primary-200 border-primary-600 scale-95'
            : 'bg-primary-100 border-primary-400 text-primary-700 hover:bg-primary-200 hover:border-primary-500'
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

  if (action.action_type === 'textbox') {
    return (
      <div style={style} className="flex items-center">
        <input
          type="text"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && textValue.trim()) {
              onTextSubmit(action, exerciseId, stepIndex, textValue);
            }
          }}
          onBlur={() => {
            if (textValue.trim() && !currentValue) {
              onTextSubmit(action, exerciseId, stepIndex, textValue);
            }
          }}
          placeholder={action.placeholder || 'Escribe aquí...'}
          disabled={isStepCompleted}
          className={`w-full h-full px-2 text-sm border-2 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            currentValue 
              ? 'bg-green-50 border-green-500' 
              : 'border-gray-400 bg-white'
          }`}
          style={{
            color: action.text_color || '#000000',
            fontFamily: action.font_family || 'Arial'
          }}
        />
      </div>
    );
  }

  return null;
};

export default ExamTestRunPage;
