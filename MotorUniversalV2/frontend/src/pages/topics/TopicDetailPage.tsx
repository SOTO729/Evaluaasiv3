import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { examService } from '../../services/examService'
import type { Question, Exercise } from '../../types'
import RichTextEditor from '../../components/RichTextEditor'
import ExerciseEditor from '../../components/ExerciseEditor'
import LoadingSpinner from '../../components/LoadingSpinner'
import Breadcrumb from '../../components/Breadcrumb'

// Componente Toast para notificaciones profesionales
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: {
      bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
      icon: (
        <svg className="fluid-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-rose-600',
      icon: (
        <svg className="fluid-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-500 to-yellow-600',
      icon: (
        <svg className="fluid-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      icon: (
        <svg className="fluid-icon" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-fadeSlideIn">
      <div className={`${config[type].bg} text-white fluid-px-5 fluid-py-4 rounded-fluid-xl shadow-2xl flex items-center fluid-gap-3 min-w-[320px] max-w-md`}>
        <div className="flex-shrink-0">
          {config[type].icon}
        </div>
        <span className="font-medium flex-1">{message}</span>
        <button onClick={onClose} className="flex-shrink-0 fluid-p-1 hover:bg-white/20 rounded-full transition-colors">
          <svg className="fluid-icon-sm" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const TopicDetailPage = () => {
  const { examId, categoryId, topicId } = useParams<{ examId: string; categoryId: string; topicId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'questions' | 'exercises'>('questions')
  
  // Estados para ejercicios
  const [isCreateExerciseModalOpen, setIsCreateExerciseModalOpen] = useState(false)
  const [isEditExerciseModalOpen, setIsEditExerciseModalOpen] = useState(false)
  const [isDeleteExerciseModalOpen, setIsDeleteExerciseModalOpen] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [isExerciseEditorOpen, setIsExerciseEditorOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    question_type_id: '',
    question_text: '',
  })
  
  const [exerciseFormData, setExerciseFormData] = useState({
    exercise_text: '',
    is_complete: false,
  })

  // Estados para gestión de porcentajes
  const [isPercentageModalOpen, setIsPercentageModalOpen] = useState(false)
  const [percentages, setPercentages] = useState<{ questions: Record<string, number>; exercises: Record<string, number> }>({ questions: {}, exercises: {} })
  const [percentageError, setPercentageError] = useState<string | null>(null)
  const [percentageMode, setPercentageMode] = useState<'exam' | 'simulator'>('exam')
  
  // Estado para notificaciones toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
  
  // Función helper para mostrar toast
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type })
  }, [])

  // Query para obtener el examen (para el breadcrumb)
  const { data: exam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examService.getExam(Number(examId)),
    enabled: !!examId,
  })

  // Query para obtener la categoría (para el breadcrumb)
  const { data: category } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const categories = await examService.getCategories(Number(examId))
      return categories.categories.find(c => c.id === Number(categoryId))
    },
    enabled: !!examId && !!categoryId,
  })

  const { data: topicsData, isLoading } = useQuery({
    queryKey: ['topics', categoryId],
    queryFn: () => examService.getTopics(Number(categoryId)),
    enabled: !!categoryId,
  })

  const { data: questionTypes } = useQuery({
    queryKey: ['question-types'],
    queryFn: () => examService.getQuestionTypes(),
  })

  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['questions', topicId],
    queryFn: () => examService.getQuestions(Number(topicId)),
    enabled: !!topicId,
  })

  const createQuestionMutation = useMutation({
    mutationFn: (data: Partial<Question>) => examService.createQuestion(Number(topicId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      setIsCreateModalOpen(false)
      setFormData({ question_type_id: '', question_text: '' })
    },
  })

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Question> }) => 
      examService.updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
      setIsEditModalOpen(false)
      setSelectedQuestion(null)
      setFormData({ question_type_id: '', question_text: '' })
    },
  })

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => examService.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      setIsDeleteModalOpen(false)
      setSelectedQuestion(null)
    },
  })

  // Queries y mutations para ejercicios
  const { data: exercisesData, isLoading: isLoadingExercises } = useQuery({
    queryKey: ['exercises', topicId],
    queryFn: () => examService.getExercises(Number(topicId)),
    enabled: !!topicId,
  })

  const createExerciseMutation = useMutation({
    mutationFn: (data: { exercise_text: string; is_complete: boolean }) => 
      examService.createExercise(Number(topicId), data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      setIsCreateExerciseModalOpen(false)
      setExerciseFormData({ exercise_text: '', is_complete: false })
      
      // Abrir automáticamente el editor del ejercicio recién creado
      const newExercise = response.exercise
      setSelectedExercise(newExercise)
      setIsExerciseEditorOpen(true)
    },
    onError: (error: any) => {
      console.error('Error al crear ejercicio:', error)
      showToast('Error al crear ejercicio: ' + (error.response?.data?.error || error.message), 'error')
    },
  })

  const updateExerciseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { exercise_text?: string; is_complete?: boolean; type?: 'exam' | 'simulator' } }) =>
      examService.updateExercise(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      setIsEditExerciseModalOpen(false)
      setSelectedExercise(null)
      setExerciseFormData({ exercise_text: '', is_complete: false })
    },
    onError: (error: any) => {
      console.error('Error al actualizar ejercicio:', error)
      showToast('Error al actualizar ejercicio: ' + (error.response?.data?.error || error.message), 'error')
    },
  })

  const deleteExerciseMutation = useMutation({
    mutationFn: (id: string) => examService.deleteExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      setIsDeleteExerciseModalOpen(false)
      setSelectedExercise(null)
    },
    onError: (error: any) => {
      console.error('Error al eliminar ejercicio:', error)
      showToast('Error al eliminar ejercicio: ' + (error.response?.data?.error || error.message), 'error')
    },
  })

  // Mutations para porcentajes
  const updatePercentagesMutation = useMutation({
    mutationFn: (data: { questions: Record<string, number>; exercises: Record<string, number> }) => 
      examService.updateTopicPercentages(Number(topicId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
      queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
      setIsPercentageModalOpen(false)
      setPercentageError(null)
      showToast('¡Porcentajes actualizados exitosamente!', 'success')
    },
    onError: (error: any) => {
      console.error('Error al actualizar porcentajes:', error)
      setPercentageError(error.response?.data?.error || 'Error al actualizar porcentajes')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.question_text && formData.question_type_id) {
      // Determinar si es tipo drag_drop para formatear correctamente
      const selectedType = questionTypes?.question_types.find(t => t.id === Number(formData.question_type_id))
      let questionText = formData.question_text
      
      if (selectedType?.name === 'drag_drop') {
        // Para drag_drop, el texto ingresado va como instrucciones
        questionText = `___INSTRUCTIONS___\n${formData.question_text}\n___TEMPLATE___\n`
      }
      
      createQuestionMutation.mutate({
        question_type_id: Number(formData.question_type_id),
        question_text: questionText,
      } as any)
    }
  }

  const handleEdit = (question: Question) => {
    setSelectedQuestion(question)
    setFormData({
      question_type_id: String(question.question_type?.id || ''),
      question_text: question.question_text,
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedQuestion && formData.question_text && formData.question_type_id) {
      updateQuestionMutation.mutate({
        id: selectedQuestion.id,
        data: {
          question_type_id: Number(formData.question_type_id),
          question_text: formData.question_text,
        } as any,
      })
    }
  }

  const handleDelete = (question: Question) => {
    setSelectedQuestion(question)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = () => {
    if (selectedQuestion) {
      deleteQuestionMutation.mutate(selectedQuestion.id)
    }
  }

  // Handlers para ejercicios
  const handleSubmitExercise = (e: React.FormEvent) => {
    e.preventDefault()
    if (exerciseFormData.exercise_text) {
      createExerciseMutation.mutate({
        exercise_text: exerciseFormData.exercise_text,
        is_complete: exerciseFormData.is_complete,
      })
    }
  }

  const handleEditExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setExerciseFormData({
      exercise_text: exercise.exercise_text,
      is_complete: exercise.is_complete,
    })
    setIsEditExerciseModalOpen(true)
  }

  // Abrir editor visual de ejercicios
  const handleOpenExerciseEditor = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setIsExerciseEditorOpen(true)
  }

  const handleUpdateExerciseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedExercise && exerciseFormData.exercise_text) {
      updateExerciseMutation.mutate({
        id: selectedExercise.id,
        data: {
          exercise_text: exerciseFormData.exercise_text,
          is_complete: exerciseFormData.is_complete,
        },
      })
    }
  }

  const handleDeleteExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise)
    setIsDeleteExerciseModalOpen(true)
  }

  const confirmDeleteExercise = () => {
    if (selectedExercise) {
      deleteExerciseMutation.mutate(selectedExercise.id)
    }
  }

  // Handlers para porcentajes
  const openPercentageModal = () => {
    // Inicializar con los porcentajes actuales
    const questionPercentages: Record<string, number> = {}
    const exercisePercentages: Record<string, number> = {}
    
    questions.forEach((q: any) => { questionPercentages[q.id] = q.percentage || 0 })
    exercises.forEach((e: any) => { exercisePercentages[e.id] = e.percentage || 0 })
    
    setPercentages({ questions: questionPercentages, exercises: exercisePercentages })
    setPercentageError(null)
    setPercentageMode('exam')
    setIsPercentageModalOpen(true)
  }

  const updatePercentage = (type: 'questions' | 'exercises', id: string, value: number) => {
    setPercentages(prev => ({
      ...prev,
      [type]: { ...prev[type], [id]: value }
    }))
    setPercentageError(null)
  }

  // Filtrar items por modo (exam o simulator)
  const getFilteredQuestions = (mode: 'exam' | 'simulator') => {
    return questions.filter((q: any) => (q.type || 'exam') === mode)
  }

  const getFilteredExercises = (mode: 'exam' | 'simulator') => {
    return exercises.filter((e: any) => (e.type || 'exam') === mode)
  }

  // Calcular porcentaje total para un modo específico
  const calculateTotalPercentageForMode = (mode: 'exam' | 'simulator') => {
    const modeQuestions = getFilteredQuestions(mode)
    const modeExercises = getFilteredExercises(mode)
    
    const questionTotal = modeQuestions.reduce((sum: number, q: any) => sum + (percentages.questions[q.id] || 0), 0)
    const exerciseTotal = modeExercises.reduce((sum: number, e: any) => sum + (percentages.exercises[e.id] || 0), 0)
    
    return Math.round((questionTotal + exerciseTotal) * 100) / 100
  }

  // Balancear porcentajes para el modo actual
  const handleBalanceCurrentMode = () => {
    const modeQuestions = getFilteredQuestions(percentageMode)
    const modeExercises = getFilteredExercises(percentageMode)
    const totalItems = modeQuestions.length + modeExercises.length
    
    if (totalItems === 0) return
    
    const percentagePerItem = Math.round((100 / totalItems) * 100) / 100
    const residue = Math.round((100 - percentagePerItem * totalItems) * 100) / 100
    
    const newQuestionPercentages = { ...percentages.questions }
    const newExercisePercentages = { ...percentages.exercises }
    
    let first = true
    modeQuestions.forEach((q: any) => {
      newQuestionPercentages[q.id] = first ? percentagePerItem + residue : percentagePerItem
      first = false
    })
    modeExercises.forEach((e: any) => {
      newExercisePercentages[e.id] = first ? percentagePerItem + residue : percentagePerItem
      first = false
    })
    
    setPercentages({ questions: newQuestionPercentages, exercises: newExercisePercentages })
    setPercentageError(null)
  }

  const handleSavePercentages = () => {
    // Validar ambos modos
    const examTotal = calculateTotalPercentageForMode('exam')
    const simulatorTotal = calculateTotalPercentageForMode('simulator')
    
    const examItems = getFilteredQuestions('exam').length + getFilteredExercises('exam').length
    const simulatorItems = getFilteredQuestions('simulator').length + getFilteredExercises('simulator').length
    
    // Solo validar si hay items en ese modo
    if (examItems > 0 && Math.abs(examTotal - 100) > 0.01) {
      setPercentageError(`Examen: Los porcentajes deben sumar 100%. Suma actual: ${examTotal}%`)
      setPercentageMode('exam')
      return
    }
    
    if (simulatorItems > 0 && Math.abs(simulatorTotal - 100) > 0.01) {
      setPercentageError(`Simulador: Los porcentajes deben sumar 100%. Suma actual: ${simulatorTotal}%`)
      setPercentageMode('simulator')
      return
    }
    
    updatePercentagesMutation.mutate(percentages)
  }

  const getQuestionTypeName = (name: string) => {
    const types: Record<string, string> = {
      'multiple_choice': 'Opción Múltiple',
      'true_false': 'Verdadero/Falso',
      'multiple_select': 'Selección Múltiple',
      'fill_blank': 'Llenar Espacio',
      'ordering': 'Ordenar',
      'drag_order': 'Arrastrar y Ordenar',
      'drag_drop': 'Arrastrar y Soltar',
      'column_grouping': 'Agrupamiento en Columnas',
      'fill_blank_drag': 'Completar Espacios Arrastrando'
    }
    return types[name] || name
  }

  const topic = topicsData?.topics.find(t => t.id === Number(topicId))
  const questions = questionsData?.questions || []
  const exercises = exercisesData?.exercises || []

  // Consultar respuestas para cada pregunta
  useEffect(() => {
    const fetchAnswersForQuestions = async () => {
      if (questions.length === 0) return
      
      const answersMap: Record<string, boolean> = {}
      
      for (const question of questions) {
        try {
          const response = await examService.getAnswers(question.id)
          answersMap[question.id] = response.answers.length > 0
        } catch (error) {
          answersMap[question.id] = false
        }
      }
      
      setQuestionAnswers(answersMap)
    }
    
    fetchAnswersForQuestions()
  }, [questions])

  if (isLoading) return <LoadingSpinner message="Cargando tema..." fullScreen />
  if (!topic) return <div className="text-center py-12 text-gray-600">Tema no encontrado</div>

  const breadcrumbItems = [
    { label: exam?.name || 'Examen', path: `/exams/${examId}/edit` },
    { label: category?.name || 'Categoría', path: `/exams/${examId}/categories/${categoryId}` },
    { label: topic.name, isActive: true },
  ]

  return (
    <div className="w-full fluid-px-6">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Botón volver a categoría */}
      <button
        onClick={() => navigate(`/exams/${examId}/categories/${categoryId}`)}
        className="fluid-mb-4 text-primary-600 hover:text-primary-700 flex items-center fluid-text-sm font-medium transition-colors"
      >
        <svg className="fluid-icon-sm fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a categoría
      </button>

      {/* Header con gradiente */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-gray-50 via-gray-50 to-transparent fluid-pt-4 fluid-pb-2 -mx-4 fluid-px-4 md:-mx-6 md:fluid-px-6">
        {/* Título con fondo destacado */}
        <div className="fluid-mb-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 rounded-fluid-xl fluid-p-5 shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between fluid-gap-3">
            <div className="flex items-center fluid-gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-fluid-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-blue-100 fluid-text-sm font-medium">Tema</p>
                <h1 className="fluid-text-xl md:fluid-text-2xl font-bold text-white tracking-tight">{topic.name}</h1>
              </div>
            </div>
            {/* Botón de Porcentajes */}
            {(questions.length > 0 || exercises.length > 0) && (
              <button
                onClick={openPercentageModal}
                className="inline-flex items-center fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-fluid-xl font-medium transition-all duration-200"
              >
                <svg className="fluid-icon fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Porcentajes
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas de resumen mejoradas */}
        <div className="grid grid-cols-2 fluid-gap-4 fluid-mb-5">
          <div 
            onClick={() => setActiveTab('questions')}
            className={`bg-white rounded-fluid-xl fluid-px-5 fluid-py-4 border shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 cursor-pointer group ${
              activeTab === 'questions' 
                ? 'border-blue-300 ring-2 ring-blue-200' 
                : 'border-gray-100 hover:border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Preguntas</div>
                <div className="fluid-text-2xl font-bold text-gray-900">{topic.total_questions || 0}</div>
              </div>
              <div className="flex items-center justify-center fluid-icon-xl rounded-fluid-xl bg-blue-600 text-white shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-300">
                <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div 
            onClick={() => setActiveTab('exercises')}
            className={`bg-white rounded-fluid-xl fluid-px-5 fluid-py-4 border shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 cursor-pointer group ${
              activeTab === 'exercises' 
                ? 'border-violet-300 ring-2 ring-violet-200' 
                : 'border-gray-100 hover:border-violet-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wide fluid-mb-1">Ejercicios</div>
                <div className="fluid-text-2xl font-bold text-gray-900">{topic.total_exercises || 0}</div>
              </div>
              <div className="flex items-center justify-center fluid-icon-xl rounded-fluid-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200 group-hover:scale-110 transition-transform duration-300">
                <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas modernas */}
        <div className="bg-white rounded-t-fluid-xl border border-b-0 border-gray-200 shadow-sm overflow-hidden relative z-30">
          <nav className="flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('questions')}
              className={`relative flex-1 fluid-py-4 fluid-px-6 fluid-text-sm font-medium transition-all duration-200 ${
                activeTab === 'questions'
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Preguntas</span>
                <span className={`fluid-ml-2 fluid-py-1 fluid-px-2 rounded-full fluid-text-xs font-semibold transition-colors duration-200 ${
                  activeTab === 'questions' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {topic.total_questions || 0}
                </span>
              </div>
              {activeTab === 'questions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('exercises')}
              className={`relative flex-1 fluid-py-4 fluid-px-6 fluid-text-sm font-medium transition-all duration-200 ${
                activeTab === 'exercises'
                  ? 'text-violet-700 bg-violet-50'
                  : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50/50'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>      
                <span>Ejercicios</span>  
                <span className={`fluid-ml-2 fluid-py-1 fluid-px-2 rounded-full fluid-text-xs font-semibold transition-colors duration-200 ${
                  activeTab === 'exercises' 
                    ? 'bg-violet-100 text-violet-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {topic.total_exercises || 0}
                </span>
              </div>
              {activeTab === 'exercises' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-purple-600" />
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Contenido de las pestañas  */}
      <div className="bg-white rounded-b-fluid-xl border border-t-0 border-gray-200 shadow-sm fluid-mb-6 relative z-10">
        {/* Contenido de la pestaña Preguntas */}
        {activeTab === 'questions' && (
          <div className="animate-fadeSlideIn">
            {/* Header FIJO - NO hace scroll */}
            <div className="fluid-p-6 fluid-pb-4 border-b border-gray-100 bg-white">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center fluid-gap-4">
                <div>  
                  <h2 className="fluid-text-xl font-bold text-gray-900">Preguntas</h2>
                  <p className="fluid-text-sm text-gray-500 fluid-mt-1">Gestiona las preguntas de este tema</p>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center fluid-px-4 fluid-py-2 bg-blue-600 text-white font-medium rounded-fluid-xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
                > 
                  <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nueva Pregunta
                </button>
              </div>
            </div>

            {/* Contenido - ESTE tiene scroll */}
            {isLoadingQuestions ? (
              <div className="fluid-p-6">
                <LoadingSpinner message="Cargando preguntas..." />
              </div>
            ) : questions.length === 0 ? (
              <div className="fluid-p-6">
                <div className="text-center fluid-py-16 fluid-px-4">
                  <div className="inline-flex items-center justify-center fluid-icon-2xl rounded-fluid-2xl bg-blue-100 fluid-mb-6">
                    <svg className="fluid-icon-xl text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">No hay preguntas creadas</h3>
                  <p className="text-gray-500 fluid-mb-6 max-w-sm mx-auto">Comienza agregando tu primera pregunta para este tema</p>
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center fluid-px-4 fluid-py-2 bg-blue-600 text-white font-medium rounded-fluid-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /> 
                    </svg>
                    Crear primera pregunta
                  </button>
                </div>
              </div>
            ) : (
              <div className="fluid-p-6 fluid-pt-4">
                <div className="rounded-fluid-xl border border-gray-200 overflow-hidden">
                  <div className="max-h-[350px] overflow-y-auto overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider w-16 bg-gray-100">
                            #
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider w-44 bg-gray-100">
                            Tipo
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider w-28 bg-gray-100">
                            Modo
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100">
                            Pregunta
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider w-24 bg-gray-100">
                            Valor
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider w-24 bg-gray-100">
                            Estado
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-right fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider w-28 bg-gray-100">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {questions.map((question, index) => (
                          <tr 
                            key={question.id} 
                            onClick={() => {
                              if (question.question_type?.name === 'true_false') {
                                navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}/questions/${question.id}/answer`)
                              } else if (question.question_type?.name === 'multiple_choice') {
                                navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}/questions/${question.id}/multiple-choice`)
                              } else if (question.question_type?.name === 'multiple_select') {
                                navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}/questions/${question.id}/multiple-select`)
                              } else if (question.question_type?.name === 'ordering') {
                                navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}/questions/${question.id}/ordering`)
                              } else if (question.question_type?.name === 'drag_drop') {
                                navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}/questions/${question.id}/drag-drop`)
                              } else if (question.question_type?.name === 'column_grouping') {
                                navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}/questions/${question.id}/column-grouping`)
                              }
                            }}
                            className={`group hover:bg-blue-100/60 transition-colors duration-150 ${
                              question.question_type?.name === 'true_false' || 
                              question.question_type?.name === 'multiple_choice' || 
                              question.question_type?.name === 'multiple_select' || 
                              question.question_type?.name === 'ordering' ||
                              question.question_type?.name === 'drag_drop' ||
                              question.question_type?.name === 'column_grouping' ? 'cursor-pointer' : ''
                            }`}
                          >
                            <td className="fluid-px-6 fluid-py-4 whitespace-nowrap">
                              <span className="inline-flex items-center justify-center fluid-icon-lg rounded-fluid-xl bg-blue-100 text-blue-700 font-bold fluid-text-sm shadow-sm">
                                {index + 1}
                              </span>
                            </td>
                            <td className="fluid-px-6 fluid-py-4 whitespace-nowrap">
                              <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                {getQuestionTypeName(question.question_type?.name || '')}
                              </span>
                            </td>
                            <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                              <select
                                value={question.type || 'exam'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  updateQuestionMutation.mutate({ 
                                    id: question.id, 
                                    data: { type: e.target.value as 'exam' | 'simulator' } 
                                  })
                                }}
                                className={`fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold border cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 ${
                                  question.type === 'simulator' 
                                    ? 'bg-amber-100 text-amber-700 border-amber-300' 
                                    : 'bg-teal-100 text-teal-700 border-teal-300'
                                }`}
                              >
                                <option value="exam">📝 Examen</option>
                                <option value="simulator">🎮 Simulador</option>
                              </select>
                            </td>
                            <td className="fluid-px-6 fluid-py-4">
                              <div 
                                className="text-gray-700 prose prose-sm max-w-none line-clamp-2"
                                dangerouslySetInnerHTML={{ __html: question.question_text }}
                              />
                            </td>
                            <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-bold ${
                                (question.percentage || 0) > 0 
                                  ? question.type === 'simulator' 
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                    : 'bg-teal-100 text-teal-700 border border-teal-200'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}>
                                {(question.percentage || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                              {questionAnswers[question.id] ? (
                                <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 border border-green-200/50">
                                  <svg className="fluid-icon-xs fluid-mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Listo
                                </span>
                              ) : (
                                <span className="inline-flex items-center fluid-px-2 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200/50">
                                  <svg className="fluid-icon-xs fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end fluid-gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEdit(question)
                                  }}
                                  className="fluid-p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-fluid-lg transition-all duration-200"
                                  title="Editar pregunta"
                                >
                                  <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(question)
                                  }}
                                  className="fluid-p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-fluid-lg transition-all duration-200"
                                  title="Eliminar pregunta"
                                >
                                  <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Footer con sumatoria de porcentajes */}
                  <div className="bg-gray-50 border-t border-gray-200 fluid-px-6 fluid-py-3">
                    <div className="flex items-center justify-between fluid-text-sm">
                      <span className="text-gray-600 font-medium">Sumatoria de valores:</span>
                      <div className="flex items-center fluid-gap-4">
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-teal-600">📝 Examen:</span>
                          <span className={`font-bold ${
                            Math.abs(questions.filter((q: any) => q.type !== 'simulator').reduce((sum: number, q: any) => sum + (q.percentage || 0), 0) - 100) <= 0.01
                              ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {questions.filter((q: any) => q.type !== 'simulator').reduce((sum: number, q: any) => sum + (q.percentage || 0), 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-amber-600">🎮 Simulador:</span>
                          <span className={`font-bold ${
                            Math.abs(questions.filter((q: any) => q.type === 'simulator').reduce((sum: number, q: any) => sum + (q.percentage || 0), 0) - 100) <= 0.01
                              ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {questions.filter((q: any) => q.type === 'simulator').reduce((sum: number, q: any) => sum + (q.percentage || 0), 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contenido de la pestaña Ejercicios */}
        {activeTab === 'exercises' && (
          <div className="animate-fadeSlideIn">
            {/* Header FIJO - NO hace scroll */}
            <div className="fluid-p-6 fluid-pb-4 border-b border-gray-100 bg-white">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center fluid-gap-4">
                <div>
                  <h2 className="fluid-text-xl font-bold text-gray-900">Ejercicios Interactivos</h2>
                  <p className="fluid-text-sm text-gray-500 fluid-mt-1">Gestiona los ejercicios paso a paso de este tema</p>
                </div>
                <button 
                  onClick={() => setIsCreateExerciseModalOpen(true)}
                  className="inline-flex items-center fluid-px-4 fluid-py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-600 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Ejercicio
                </button>
              </div>
            </div>

            {/* Contenido - ESTE tiene scroll */}
            {isLoadingExercises ? (
              <div className="fluid-p-6">
                <LoadingSpinner message="Cargando ejercicios..." />
              </div>
            ) : exercises.length === 0 ? (
              <div className="fluid-p-6">
                <div className="text-center fluid-py-16 fluid-px-4">
                  <div className="inline-flex items-center justify-center fluid-icon-2xl rounded-fluid-2xl bg-gradient-to-br from-violet-100 to-purple-200 fluid-mb-6">
                    <svg className="fluid-icon-xl text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-2">No hay ejercicios creados</h3>
                  <p className="text-gray-500 fluid-mb-6 max-w-sm mx-auto">Los ejercicios interactivos permiten a los estudiantes practicar con pasos guiados</p>
                  <button 
                    onClick={() => setIsCreateExerciseModalOpen(true)}
                    className="inline-flex items-center fluid-px-5 fluid-py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-600 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear Primer Ejercicio
                  </button>
                </div>
              </div>
            ) : (
              <div className="fluid-p-6 fluid-pt-4">
                <div className="rounded-fluid-xl border border-gray-200 overflow-hidden">
                  <div className="max-h-[350px] overflow-y-auto overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-16 bg-gray-100">
                            #
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-left fluid-text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-100">
                            Ejercicio
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-32 bg-gray-100">
                            Tipo
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-24 bg-gray-100">
                            Pasos
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-24 bg-gray-100">
                            Valor
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-center fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-32 bg-gray-100">
                            Estado
                          </th>
                          <th scope="col" className="fluid-px-6 fluid-py-4 text-right fluid-text-xs font-bold text-gray-600 uppercase tracking-wider w-36 bg-gray-100">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {exercises.map((exercise: any, index: number) => (
                        <tr 
                          key={exercise.id} 
                          className="hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-transparent cursor-pointer transition-all duration-200 group"
                          onClick={() => handleOpenExerciseEditor(exercise)}
                        >
                          <td className="fluid-px-6 fluid-py-4 whitespace-nowrap">
                            <span className="inline-flex items-center justify-center fluid-icon-lg rounded-fluid-lg bg-gradient-to-br from-violet-100 to-purple-200 text-violet-700 font-bold fluid-text-sm shadow-sm">
                              {index + 1}
                            </span>
                          </td>
                          <td className="fluid-px-6 fluid-py-4"> 
                            <div 
                              className="text-gray-900 prose prose-sm max-w-none line-clamp-2 group-hover:text-violet-900 transition-colors"
                              dangerouslySetInnerHTML={{ __html: exercise.exercise_text }}
                            />
                          </td>
                          <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                            <select
                              value={exercise.type || 'exam'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation()
                                updateExerciseMutation.mutate({ 
                                  id: exercise.id, 
                                  data: { type: e.target.value as 'exam' | 'simulator' } 
                                })
                              }}
                              className={`fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold border cursor-pointer focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 ${
                                exercise.type === 'simulator' 
                                  ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' 
                                  : 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200'
                              }`}
                          >
                            <option value="exam">📝 Examen</option>
                            <option value="simulator">🎮 Simulador</option>
                          </select>
                        </td>
                        <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800">
                            <svg className="fluid-icon-xs fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {exercise.total_steps || 0}
                          </span>
                        </td>
                        <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-bold ${
                            (exercise.percentage || 0) > 0 
                              ? exercise.type === 'simulator' 
                                ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}>
                            {(exercise.percentage || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-center">
                          {exercise.is_complete ? (
                            <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800">
                              <svg className="fluid-icon-xs fluid-mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Completo
                            </span>
                          ) : (
                            <span className="inline-flex items-center fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-semibold bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600">
                              <svg className="fluid-icon-xs fluid-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pendiente
                            </span>
                          )}
                        </td> 
                        <td className="fluid-px-6 fluid-py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end fluid-gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditExercise(exercise)
                              }}
                              className="fluid-p-2 rounded-fluid-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200"
                              title="Editar descripción"
                            >
                              <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteExercise(exercise)
                              }}
                              className="fluid-p-2 rounded-fluid-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                              title="Eliminar ejercicio"
                            >
                              <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Footer con sumatoria de porcentajes */}
                  <div className="bg-gray-50 border-t border-gray-200 fluid-px-6 fluid-py-3">
                    <div className="flex items-center justify-between fluid-text-sm">
                      <span className="text-gray-600 font-medium">Sumatoria de valores:</span>
                      <div className="flex items-center fluid-gap-4">
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-teal-600">📝 Examen:</span>
                          <span className={`font-bold ${
                            Math.abs(exercises.filter((e: any) => e.type !== 'simulator').reduce((sum: number, e: any) => sum + (e.percentage || 0), 0) - 100) <= 0.01
                              ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {exercises.filter((e: any) => e.type !== 'simulator').reduce((sum: number, e: any) => sum + (e.percentage || 0), 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <div className="flex items-center fluid-gap-2">
                          <span className="text-amber-600">🎮 Simulador:</span>
                          <span className={`font-bold ${
                            Math.abs(exercises.filter((e: any) => e.type === 'simulator').reduce((sum: number, e: any) => sum + (e.percentage || 0), 0) - 100) <= 0.01
                              ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            {exercises.filter((e: any) => e.type === 'simulator').reduce((sum: number, e: any) => sum + (e.percentage || 0), 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Crear Pregunta */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => {
            setIsCreateModalOpen(false)
            setFormData({ question_type_id: '', question_text: '' })
          }}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Crear Nueva Pregunta</h3>
              <p className="text-blue-100 fluid-text-sm fluid-mt-1">Añade una nueva pregunta a este tema</p>
            </div>
            <form onSubmit={handleSubmit} className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="fluid-mb-4">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Tipo de Pregunta *
                </label>
                <select
                  value={formData.question_type_id}
                  onChange={(e) => setFormData({ ...formData, question_type_id: e.target.value })}
                  className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Selecciona un tipo</option>
                  {questionTypes?.question_types
                    .filter((type) => !['fill_blank', 'drag_order', 'fill_blank_drag'].includes(type.name)) // Ocultar tipos no disponibles
                    .map((type) => (
                      <option key={type.id} value={type.id}>
                        {getQuestionTypeName(type.name)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="fluid-mb-6">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Pregunta *
                </label>
                <RichTextEditor
                  value={formData.question_text}
                  onChange={(value) => setFormData({ ...formData, question_text: value })}
                  placeholder="Escribe la pregunta aquí..."
                />
              </div>
              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false)
                    setFormData({ question_type_id: '', question_text: '' })
                  }}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createQuestionMutation.isPending}
                >
                  {createQuestionMutation.isPending ? 'Creando...' : 'Crear Pregunta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Pregunta */}
      {isEditModalOpen && selectedQuestion && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => {
            setIsEditModalOpen(false)
            setSelectedQuestion(null)
            setFormData({ question_type_id: '', question_text: '' })
          }}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Editar Pregunta</h3>
              <p className="text-blue-100 fluid-text-sm fluid-mt-1">Modifica la información de la pregunta</p>
            </div>
            <form onSubmit={handleUpdateSubmit} className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="fluid-mb-4">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Tipo de Pregunta *
                </label>
                <select
                  value={formData.question_type_id}
                  onChange={(e) => setFormData({ ...formData, question_type_id: e.target.value })}
                  className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Selecciona un tipo</option>
                  {questionTypes?.question_types
                    .filter((type) => !['fill_blank', 'drag_order', 'fill_blank_drag'].includes(type.name)) // Ocultar tipos no disponibles
                    .map((type) => (
                      <option key={type.id} value={type.id}>
                        {getQuestionTypeName(type.name)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="fluid-mb-6">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Pregunta *
                </label>
                <RichTextEditor
                  value={formData.question_text}
                  onChange={(value) => setFormData({ ...formData, question_text: value })}
                  placeholder="Escribe la pregunta aquí..."
                />
              </div>
              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setSelectedQuestion(null)
                    setFormData({ question_type_id: '', question_text: '' })
                  }}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={updateQuestionMutation.isPending}
                >
                  {updateQuestionMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {isDeleteModalOpen && selectedQuestion && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => {
            setIsDeleteModalOpen(false)
            setSelectedQuestion(null)
          }}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-icon-lg rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">Confirmar Eliminación</h3>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
                <div className="flex items-start">
                  <svg className="fluid-icon-sm text-red-500 mt-0.5 fluid-mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="fluid-text-sm font-semibold text-red-800">Esta acción no se puede deshacer</p>
                    <p className="fluid-text-sm text-red-600 fluid-mt-1 line-clamp-2">{selectedQuestion.question_text}</p>
                  </div>
                </div>
              </div>

              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false)
                    setSelectedQuestion(null)
                  }}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                  disabled={deleteQuestionMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleteQuestionMutation.isPending}
                >
                  {deleteQuestionMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear Ejercicio */}
      {isCreateExerciseModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => {
            setIsCreateExerciseModalOpen(false)
            setExerciseFormData({ exercise_text: '', is_complete: false })
          }}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Crear Nuevo Ejercicio</h3>
              <p className="text-violet-100 fluid-text-sm fluid-mt-1">Añade un nuevo ejercicio interactivo a este tema</p>
            </div>
            <form onSubmit={handleSubmitExercise} className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="fluid-mb-6">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Contenido del Ejercicio *
                </label>
                <RichTextEditor
                  value={exerciseFormData.exercise_text}
                  onChange={(value) => setExerciseFormData({ ...exerciseFormData, exercise_text: value })}
                  placeholder="Escribe el contenido del ejercicio aquí..."
                />
              </div>
              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateExerciseModalOpen(false)
                    setExerciseFormData({ exercise_text: '', is_complete: false })
                  }}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createExerciseMutation.isPending}
                >
                  {createExerciseMutation.isPending ? 'Creando...' : 'Crear Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Ejercicio */}
      {isEditExerciseModalOpen && selectedExercise && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => {
            setIsEditExerciseModalOpen(false)
            setSelectedExercise(null)
            setExerciseFormData({ exercise_text: '', is_complete: false })
          }}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Editar Ejercicio</h3>
              <p className="text-violet-100 fluid-text-sm fluid-mt-1">Modifica la descripción del ejercicio</p>
            </div>
            <form onSubmit={handleUpdateExerciseSubmit} className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="fluid-mb-6">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  Contenido del Ejercicio *
                </label>
                <RichTextEditor
                  value={exerciseFormData.exercise_text}
                  onChange={(value) => setExerciseFormData({ ...exerciseFormData, exercise_text: value })}
                  placeholder="Escribe el contenido del ejercicio aquí..."
                />
              </div>
              <div className="flex fluid-gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditExerciseModalOpen(false)
                    setSelectedExercise(null)
                    setExerciseFormData({ exercise_text: '', is_complete: false })
                  }}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={updateExerciseMutation.isPending}
                >
                  {updateExerciseMutation.isPending ? 'Actualizando...' : 'Actualizar Ejercicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Eliminar Ejercicio */}
      {isDeleteExerciseModalOpen && selectedExercise && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => {
            setIsDeleteExerciseModalOpen(false)
            setSelectedExercise(null)
          }}
        >
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-icon-xl rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">Eliminar Ejercicio</h3>
              </div>
            </div>
            <div className="fluid-p-6">
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
                <div className="flex items-start">
                  <svg className="fluid-icon-sm text-red-500 mt-0.5 fluid-mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="fluid-text-sm font-semibold text-red-800">Esta acción no se puede deshacer</p>
                    <p className="fluid-text-sm text-red-600 fluid-mt-1">¿Estás seguro de que deseas eliminar este ejercicio?</p>
                  </div>
                </div>
              </div>
              <div className="flex fluid-gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsDeleteExerciseModalOpen(false)
                    setSelectedExercise(null)
                  }}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteExercise}
                  className="fluid-px-5 fluid-py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleteExerciseMutation.isPending}
                >
                  {deleteExerciseMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor de Ejercicios */}
      {isExerciseEditorOpen && selectedExercise && (
        <ExerciseEditor
          exercise={selectedExercise}
          onClose={() => {
            setIsExerciseEditorOpen(false)
            setSelectedExercise(null)
            // Refrescar la lista de ejercicios
            queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
          }}
        />
      )}

      {/* Modal de Gestión de Porcentajes */}
      {isPercentageModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 fluid-p-4"
          onClick={() => setIsPercentageModalOpen(false)}
        >
          <div 
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-fadeSlideIn" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con pestañas Examen/Simulador */}
            <div className={`fluid-px-6 fluid-py-4 ${percentageMode === 'exam' ? 'bg-gradient-to-r from-teal-500 to-emerald-600' : 'bg-gradient-to-r from-amber-500 to-orange-600'}`}>
              <div className="flex items-center justify-between fluid-mb-4">
                <div>
                  <h3 className="fluid-text-xl font-bold text-white">Gestión de Porcentajes</h3>
                  <p className="text-white/80 fluid-text-sm fluid-mt-1">Configura el peso de cada pregunta y ejercicio por separado</p>
                </div>
                <button
                  onClick={handleBalanceCurrentMode}
                  className="inline-flex items-center fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-fluid-xl font-medium transition-all duration-200"
                >
                  <svg className="fluid-icon fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Balancear {percentageMode === 'exam' ? 'Examen' : 'Simulador'}
                </button>
              </div>
              
              {/* Pestañas Examen/Simulador */}
              <div className="flex fluid-gap-2">
                <button
                  onClick={() => setPercentageMode('exam')}
                  className={`flex-1 fluid-py-3 fluid-px-4 rounded-fluid-xl font-semibold transition-all duration-200 ${
                    percentageMode === 'exam'
                      ? 'bg-white text-teal-700 shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <div className="flex items-center justify-center fluid-gap-2">
                    <span className="fluid-text-lg">📝</span>
                    <span>Examen</span>
                    <span className={`fluid-ml-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs ${
                      percentageMode === 'exam' ? 'bg-teal-100 text-teal-700' : 'bg-white/20'
                    }`}>
                      {getFilteredQuestions('exam').length + getFilteredExercises('exam').length}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setPercentageMode('simulator')}
                  className={`flex-1 fluid-py-3 fluid-px-4 rounded-fluid-xl font-semibold transition-all duration-200 ${
                    percentageMode === 'simulator'
                      ? 'bg-white text-amber-700 shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <div className="flex items-center justify-center fluid-gap-2">
                    <span className="fluid-text-lg">🎮</span>
                    <span>Simulador</span>
                    <span className={`fluid-ml-1 fluid-px-2 fluid-py-1 rounded-full fluid-text-xs ${
                      percentageMode === 'simulator' ? 'bg-amber-100 text-amber-700' : 'bg-white/20'
                    }`}>
                      {getFilteredQuestions('simulator').length + getFilteredExercises('simulator').length}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
              {/* Indicador de suma total para el modo actual */}
              {(() => {
                const currentTotal = calculateTotalPercentageForMode(percentageMode)
                const currentItems = getFilteredQuestions(percentageMode).length + getFilteredExercises(percentageMode).length
                const isValid = currentItems === 0 || Math.abs(currentTotal - 100) <= 0.01
                
                return currentItems > 0 ? (
                  <div className={`fluid-mb-6 fluid-p-4 rounded-fluid-xl border-2 ${isValid ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {isValid ? (
                          <svg className="fluid-icon-lg text-green-500 fluid-mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="fluid-icon-lg text-red-500 fluid-mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={`fluid-text-lg font-bold ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                          {percentageMode === 'exam' ? '📝 Examen' : '🎮 Simulador'}: {currentTotal}%
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {isValid ? '✓ Correcto (100%)' : `Falta: ${(100 - currentTotal).toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Resumen del otro modo */}
              {(() => {
                const otherMode = percentageMode === 'exam' ? 'simulator' : 'exam'
                const otherTotal = calculateTotalPercentageForMode(otherMode)
                const otherItems = getFilteredQuestions(otherMode).length + getFilteredExercises(otherMode).length
                const isOtherValid = otherItems === 0 || Math.abs(otherTotal - 100) <= 0.01
                
                return otherItems > 0 ? (
                  <div className={`fluid-mb-4 fluid-p-3 rounded-fluid-lg border ${isOtherValid ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center justify-between fluid-text-sm">
                      <span className="text-gray-600">
                        {otherMode === 'exam' ? '📝 Examen' : '🎮 Simulador'}: {otherTotal}% ({otherItems} items)
                      </span>
                      {!isOtherValid && (
                        <span className="text-amber-600 font-medium">⚠️ Falta {(100 - otherTotal).toFixed(2)}%</span>
                      )}
                    </div>
                  </div>
                ) : null
              })()}

              {percentageError && (
                <div className="fluid-mb-4 fluid-p-4 rounded-fluid-xl bg-red-50 border border-red-200 text-red-700 fluid-text-sm">
                  {percentageError}
                </div>
              )}

              {/* Contenido del modo actual */}
              {(() => {
                const modeQuestions = getFilteredQuestions(percentageMode)
                const modeExercises = getFilteredExercises(percentageMode)
                
                if (modeQuestions.length === 0 && modeExercises.length === 0) {
                  return (
                    <div className="text-center fluid-py-12 text-gray-500">
                      <div className={`fluid-icon-2xl mx-auto rounded-fluid-2xl flex items-center justify-center fluid-mb-4 ${
                        percentageMode === 'exam' ? 'bg-teal-100' : 'bg-amber-100'
                      }`}>
                        <span className="text-4xl">{percentageMode === 'exam' ? '📝' : '🎮'}</span>
                      </div>
                      <p className="fluid-text-lg font-medium">No hay contenido para {percentageMode === 'exam' ? 'Examen' : 'Simulador'}</p>
                      <p className="fluid-text-sm fluid-mt-2">Cambia el tipo de las preguntas o ejercicios para asignarlos a este modo</p>
                    </div>
                  )
                }
                
                return (
                  <>
                    {/* Sección de Preguntas */}
                    {modeQuestions.length > 0 && (
                      <div className="fluid-mb-6">
                        <h4 className="fluid-text-lg font-bold text-gray-800 fluid-mb-4 flex items-center">
                          <svg className="fluid-icon fluid-mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Preguntas ({modeQuestions.length})
                        </h4>
                        <div className="flex flex-col fluid-gap-3">
                          {modeQuestions.map((question: any, index: number) => (
                            <div key={question.id} className={`flex items-center fluid-gap-4 fluid-p-4 rounded-fluid-xl border ${
                              percentageMode === 'exam' 
                                ? 'bg-teal-50 border-teal-100' 
                                : 'bg-amber-50 border-amber-100'
                            }`}>
                              <span className={`fluid-icon-lg flex items-center justify-center rounded-fluid-lg font-bold fluid-text-sm text-white ${
                                percentageMode === 'exam' ? 'bg-teal-500' : 'bg-amber-500'
                              }`}>
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="fluid-text-sm text-gray-700 line-clamp-1"
                                  dangerouslySetInnerHTML={{ __html: question.question_text }}
                                />
                                <span className={`fluid-text-xs font-medium ${
                                  percentageMode === 'exam' ? 'text-teal-600' : 'text-amber-600'
                                }`}>
                                  {getQuestionTypeName(question.question_type?.name || '')}
                                </span>
                              </div>
                              <div className="flex items-center fluid-gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={percentages.questions[question.id] ?? question.percentage ?? 0}
                                  onChange={(e) => updatePercentage('questions', question.id, parseFloat(e.target.value) || 0)}
                                  className={`w-20 fluid-px-3 fluid-py-2 border rounded-fluid-lg text-center font-semibold focus:ring-2 ${
                                    percentageMode === 'exam' 
                                      ? 'border-teal-200 focus:ring-teal-500 focus:border-teal-500'
                                      : 'border-amber-200 focus:ring-amber-500 focus:border-amber-500'
                                  }`}
                                />
                                <span className="text-gray-500 font-medium">%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sección de Ejercicios */}
                    {modeExercises.length > 0 && (
                      <div>
                        <h4 className="fluid-text-lg font-bold text-gray-800 fluid-mb-4 flex items-center">
                          <svg className="fluid-icon fluid-mr-2 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Ejercicios ({modeExercises.length})
                        </h4>
                        <div className="flex flex-col fluid-gap-3">
                          {modeExercises.map((exercise: any, index: number) => (
                            <div key={exercise.id} className={`flex items-center fluid-gap-4 fluid-p-4 rounded-fluid-xl border ${
                              percentageMode === 'exam' 
                                ? 'bg-emerald-50 border-emerald-100' 
                                : 'bg-orange-50 border-orange-100'
                            }`}>
                              <span className={`fluid-icon-lg flex items-center justify-center rounded-fluid-lg font-bold fluid-text-sm text-white ${
                                percentageMode === 'exam' ? 'bg-emerald-500' : 'bg-orange-500'
                              }`}>
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="fluid-text-sm text-gray-700 line-clamp-1"
                                  dangerouslySetInnerHTML={{ __html: exercise.exercise_text || exercise.title || 'Ejercicio sin título' }}
                                />
                                <span className={`fluid-text-xs font-medium ${
                                  percentageMode === 'exam' ? 'text-emerald-600' : 'text-orange-600'
                                }`}>
                                  {exercise.total_steps || 0} pasos
                                </span>
                              </div>
                              <div className="flex items-center fluid-gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={percentages.exercises[exercise.id] ?? exercise.percentage ?? 0}
                                  onChange={(e) => updatePercentage('exercises', exercise.id, parseFloat(e.target.value) || 0)}
                                  className={`w-20 fluid-px-3 fluid-py-2 border rounded-fluid-lg text-center font-semibold focus:ring-2 ${
                                    percentageMode === 'exam' 
                                      ? 'border-emerald-200 focus:ring-emerald-500 focus:border-emerald-500'
                                      : 'border-orange-200 focus:ring-orange-500 focus:border-orange-500'
                                  }`}
                                />
                                <span className="text-gray-500 font-medium">%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="fluid-px-6 fluid-py-4 bg-gray-50 border-t flex fluid-gap-3 justify-between">
              {/* Resumen de validación */}
              <div className="flex items-center fluid-gap-4 fluid-text-sm">
                {(() => {
                  const examItems = getFilteredQuestions('exam').length + getFilteredExercises('exam').length
                  const simItems = getFilteredQuestions('simulator').length + getFilteredExercises('simulator').length
                  const examValid = examItems === 0 || Math.abs(calculateTotalPercentageForMode('exam') - 100) <= 0.01
                  const simValid = simItems === 0 || Math.abs(calculateTotalPercentageForMode('simulator') - 100) <= 0.01
                  
                  return (
                    <>
                      {examItems > 0 && (
                        <span className={`flex items-center fluid-gap-1 ${examValid ? 'text-green-600' : 'text-red-600'}`}>
                          {examValid ? '✓' : '✗'} Examen
                        </span>
                      )}
                      {simItems > 0 && (
                        <span className={`flex items-center fluid-gap-1 ${simValid ? 'text-green-600' : 'text-red-600'}`}>
                          {simValid ? '✓' : '✗'} Simulador
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
              
              <div className="flex fluid-gap-3">
                <button
                  onClick={() => setIsPercentageModalOpen(false)}
                  className="fluid-px-5 fluid-py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePercentages}
                  disabled={updatePercentagesMutation.isPending || (() => {
                    const examItems = getFilteredQuestions('exam').length + getFilteredExercises('exam').length
                    const simItems = getFilteredQuestions('simulator').length + getFilteredExercises('simulator').length
                    const examValid = examItems === 0 || Math.abs(calculateTotalPercentageForMode('exam') - 100) <= 0.01
                    const simValid = simItems === 0 || Math.abs(calculateTotalPercentageForMode('simulator') - 100) <= 0.01
                    return !examValid || !simValid
                  })()}
                  className={`fluid-px-5 fluid-py-2 text-white rounded-fluid-xl font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    percentageMode === 'exam'
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-teal-500/25'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25'
                  }`}
                >
                  {updatePercentagesMutation.isPending ? 'Guardando...' : 'Guardar Todo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast de notificaciones */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default TopicDetailPage
