import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import type { Question, Exercise } from '../../types'
import RichTextEditor from '../../components/RichTextEditor'
import ExerciseEditor from '../../components/ExerciseEditor'
import LoadingSpinner from '../../components/LoadingSpinner'

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
      alert('Error al crear ejercicio: ' + (error.response?.data?.error || error.message))
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
      alert('Error al actualizar ejercicio: ' + (error.response?.data?.error || error.message))
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
      alert('Error al eliminar ejercicio: ' + (error.response?.data?.error || error.message))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.question_text && formData.question_type_id) {
      createQuestionMutation.mutate({
        question_type_id: Number(formData.question_type_id),
        question_text: formData.question_text,
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

  const getQuestionTypeName = (name: string) => {
    const types: Record<string, string> = {
      'multiple_choice': 'Opción Múltiple',
      'true_false': 'Verdadero/Falso',
      'multiple_select': 'Selección Múltiple',
      'fill_blank': 'Llenar Espacio',
      'ordering': 'Ordenar',
      'drag_drop': 'Arrastrar y Soltar',
      'drag_order': 'Arrastrar y Ordenar'
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header con gradiente */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-gray-50 via-gray-50 to-transparent pt-4 pb-2 -mx-4 px-4 md:-mx-6 md:px-6">
        {/* Navegación */}
        <div className="mb-4">
          <button
            onClick={() => navigate(`/exams/${examId}/categories/${categoryId}`)}
            className="group flex items-center text-gray-600 hover:text-primary-600 transition-colors duration-200 mb-3"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm group-hover:shadow-md group-hover:bg-primary-50 transition-all duration-200 mr-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <span className="text-sm font-medium">Volver a Temas</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{topic.name}</h1>
        </div>

        {/* Tarjetas de resumen mejoradas */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-xl px-5 py-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Preguntas</div>
                <div className="text-2xl font-bold text-gray-900">{topic.total_questions || 0}</div>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl px-5 py-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ejercicios</div>
                <div className="text-2xl font-bold text-gray-900">{topic.total_exercises || 0}</div>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas modernas */}
        <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 shadow-sm overflow-hidden">
          <nav className="flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('questions')}
              className={`relative flex-1 py-4 px-6 text-sm font-medium transition-all duration-200 ${
                activeTab === 'questions'
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Preguntas</span>
                <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-semibold transition-colors duration-200 ${
                  activeTab === 'questions' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {topic.total_questions || 0}
                </span>
              </div>
              {activeTab === 'questions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('exercises')}
              className={`relative flex-1 py-4 px-6 text-sm font-medium transition-all duration-200 ${
                activeTab === 'exercises'
                  ? 'text-violet-700 bg-violet-50'
                  : 'text-gray-500 hover:text-violet-600 hover:bg-violet-50/50'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Ejercicios</span>
                <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-semibold transition-colors duration-200 ${
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

      {/* Contenido de las pestañas */}
      <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm mb-6">
        {/* Contenido de la pestaña Preguntas */}
        {activeTab === 'questions' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Preguntas</h2>
                <p className="text-sm text-gray-500 mt-1">Gestiona las preguntas de este tema</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva Pregunta
              </button>
            </div>

            {isLoadingQuestions ? (
              <LoadingSpinner message="Cargando preguntas..." />
            ) : questions.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 mb-6">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay preguntas creadas</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">Comienza agregando tu primera pregunta para este tema</p>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /> 
                  </svg>
                  Crear primera pregunta
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                    #
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-44">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
                    Modo
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Pregunta
                  </th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
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
                      }
                    }}
                    className={`group hover:bg-blue-100/60 transition-colors duration-150 ${
                      question.question_type?.name === 'true_false' || 
                      question.question_type?.name === 'multiple_choice' || 
                      question.question_type?.name === 'multiple_select' || 
                      question.question_type?.name === 'ordering' ? 'cursor-pointer' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold text-sm shadow-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200/50">
                        {getQuestionTypeName(question.question_type?.name || '')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                          question.type === 'simulator' 
                            ? 'bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-700 border-amber-200' 
                            : 'bg-gradient-to-r from-indigo-50 to-blue-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        <option value="exam">📝 Examen</option>
                        <option value="simulator">🎮 Simulador</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div 
                        className="text-gray-700 prose prose-sm max-w-none line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: question.question_text }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {questionAnswers[question.id] ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r from-green-50 to-emerald-100 text-green-700 border border-green-200/50">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Listo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200/50">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(question)
                          }}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar pregunta"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(question)
                          }}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar pregunta"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        )}
          </div>
        )}

        {/* Contenido de la pestaña Ejercicios */}
        {activeTab === 'exercises' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Ejercicios Interactivos</h2>
                <p className="text-sm text-gray-500 mt-1">Gestiona los ejercicios paso a paso de este tema</p>
              </div>
              <button 
                onClick={() => setIsCreateExerciseModalOpen(true)}
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-600 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Ejercicio
              </button>
            </div>

            {isLoadingExercises ? (
              <LoadingSpinner message="Cargando ejercicios..." />
            ) : exercises.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 mb-6">
                  <svg className="w-10 h-10 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay ejercicios creados</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">Los ejercicios interactivos permiten a los estudiantes practicar con pasos guiados</p>
                <button 
                  onClick={() => setIsCreateExerciseModalOpen(true)}
                  className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:from-violet-600 hover:to-purple-700 transform hover:-translate-y-0.5 transition-all duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Primer Ejercicio
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-16">
                        #
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Ejercicio
                      </th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-32">
                        Tipo
                      </th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-24">
                        Pasos
                      </th>
                      <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-32">
                        Estado
                      </th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider w-36">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-purple-200 text-violet-700 font-bold text-sm shadow-sm">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4"> 
                          <div 
                            className="text-gray-900 prose prose-sm max-w-none line-clamp-2 group-hover:text-violet-900 transition-colors"
                            dangerouslySetInnerHTML={{ __html: exercise.exercise_text }}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                              exercise.type === 'simulator' 
                                ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 focus:ring-amber-500 hover:from-amber-200 hover:to-yellow-200' 
                                : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 focus:ring-blue-500 hover:from-blue-200 hover:to-indigo-200'
                            }`}
                          >
                            <option value="exam">📝 Examen</option>
                            <option value="simulator">🎮 Simulador</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800">
                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {exercise.total_steps || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {exercise.is_complete ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-green-100 to-emerald-100 text-green-800">
                              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Completo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600">
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenExerciseEditor(exercise)
                              }}
                              className="p-2 rounded-lg text-violet-600 hover:text-violet-700 hover:bg-violet-50 transition-all duration-200"
                              title="Abrir editor visual"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditExercise(exercise)
                              }}
                              className="p-2 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-200"
                              title="Editar descripción"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteExercise(exercise)
                              }}
                              className="p-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                              title="Eliminar ejercicio"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            )}
          </div>
        )}
      </div>

      {/* Modal de Crear Pregunta */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Crear Nueva Pregunta</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Pregunta *
                </label>
                <select
                  value={formData.question_type_id}
                  onChange={(e) => setFormData({ ...formData, question_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Selecciona un tipo</option>
                  {questionTypes?.question_types
                    .filter((type) => !['fill_blank', 'drag_drop', 'drag_order'].includes(type.name)) // Ocultar tipos no disponibles
                    .map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.description}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pregunta *
                </label>
                <RichTextEditor
                  value={formData.question_text}
                  onChange={(value) => setFormData({ ...formData, question_text: value })}
                  placeholder="Escribe la pregunta aquí..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false)
                    setFormData({ question_type_id: '', question_text: '' })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Editar Pregunta</h3>
            <form onSubmit={handleUpdateSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Pregunta *
                </label>
                <select
                  value={formData.question_type_id}
                  onChange={(e) => setFormData({ ...formData, question_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Selecciona un tipo</option>
                  {questionTypes?.question_types
                    .filter((type) => !['fill_blank', 'drag_drop', 'drag_order'].includes(type.name)) // Ocultar tipos no disponibles
                    .map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.description}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pregunta *
                </label>
                <RichTextEditor
                  value={formData.question_text}
                  onChange={(value) => setFormData({ ...formData, question_text: value })}
                  placeholder="Escribe la pregunta aquí..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false)
                    setSelectedQuestion(null)
                    setFormData({ question_type_id: '', question_text: '' })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Confirmar Eliminación
              </h3>
            </div>
            
            <p className="text-gray-700 mb-4">
              ¿Estás seguro de que deseas eliminar esta pregunta?
            </p>
            
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-sm text-red-800 font-medium mb-1">Esta acción no se puede deshacer.</p>
              <p className="text-sm text-red-700 line-clamp-2">{selectedQuestion.question_text}</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setSelectedQuestion(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={deleteQuestionMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                disabled={deleteQuestionMutation.isPending}
              >
                {deleteQuestionMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Crear Ejercicio */}
      {isCreateExerciseModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Crear Nuevo Ejercicio</h3>
            <form onSubmit={handleSubmitExercise}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenido del Ejercicio *
                </label>
                <RichTextEditor
                  value={exerciseFormData.exercise_text}
                  onChange={(value) => setExerciseFormData({ ...exerciseFormData, exercise_text: value })}
                  placeholder="Escribe el contenido del ejercicio aquí..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateExerciseModalOpen(false)
                    setExerciseFormData({ exercise_text: '', is_complete: false })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Editar Ejercicio</h3>
            <form onSubmit={handleUpdateExerciseSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenido del Ejercicio *
                </label>
                <RichTextEditor
                  value={exerciseFormData.exercise_text}
                  onChange={(value) => setExerciseFormData({ ...exerciseFormData, exercise_text: value })}
                  placeholder="Escribe el contenido del ejercicio aquí..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditExerciseModalOpen(false)
                    setSelectedExercise(null)
                    setExerciseFormData({ exercise_text: '', is_complete: false })
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Eliminar Ejercicio</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar este ejercicio? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsDeleteExerciseModalOpen(false)
                  setSelectedExercise(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteExercise}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={deleteExerciseMutation.isPending}
              >
                {deleteExerciseMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
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
    </div>
  )
}

export default TopicDetailPage
