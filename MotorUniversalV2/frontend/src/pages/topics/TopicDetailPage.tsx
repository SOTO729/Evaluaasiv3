import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import type { Question, Exercise } from '../../types'

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
      queryClient.invalidateQueries({ queryKey: ['topics', categoryId] })
      setIsCreateExerciseModalOpen(false)
      setExerciseFormData({ exercise_text: '', is_complete: false })
    },
    onError: (error: any) => {
      console.error('Error al crear ejercicio:', error)
      alert('Error al crear ejercicio: ' + (error.response?.data?.error || error.message))
    },
  })

  const updateExerciseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { exercise_text?: string; is_complete?: boolean } }) =>
      examService.updateExercise(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', topicId] })
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

  if (isLoading) return <div>Cargando tema...</div>
  if (!topic) return <div>Tema no encontrado</div>

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/exams/${examId}/categories/${categoryId}`)}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Temas
        </button>
        <h1 className="text-3xl font-bold text-gray-900">{topic.name}</h1>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Preguntas</div>
          <div className="text-2xl font-bold text-gray-900">{topic.total_questions || 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Ejercicios</div>
          <div className="text-2xl font-bold text-gray-900">{topic.total_exercises || 0}</div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="card mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('questions')}
              className={`${
                activeTab === 'questions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Preguntas
              <span className={`ml-2 ${
                activeTab === 'questions' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-900'
              } py-0.5 px-2.5 rounded-full text-xs font-medium`}>
                {topic.total_questions || 0}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('exercises')}
              className={`${
                activeTab === 'exercises'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Ejercicios
              <span className={`ml-2 ${
                activeTab === 'exercises' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-900'
              } py-0.5 px-2.5 rounded-full text-xs font-medium`}>
                {topic.total_exercises || 0}
              </span>
            </button>
          </nav>
        </div>

        {/* Contenido de la pestaña Preguntas */}
        {activeTab === 'questions' && (
          <div className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Preguntas</h2>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Pregunta
              </button>
            </div>

            {isLoadingQuestions ? (
              <div className="text-center py-12 text-gray-500">Cargando preguntas...</div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium mb-2">No hay preguntas creadas</p>
                <p className="text-sm">Crea la primera pregunta para este tema</p>
              </div>
            ) : (
              <div className="overflow-x-auto">{/* tabla de preguntas aquí */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Tipo
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pregunta
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Respuesta
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
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
                    className={`hover:bg-gray-50 ${
                      question.question_type?.name === 'true_false' || 
                      question.question_type?.name === 'multiple_choice' || 
                      question.question_type?.name === 'multiple_select' || 
                      question.question_type?.name === 'ordering' ? 'cursor-pointer' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {getQuestionTypeName(question.question_type?.name || '')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 font-medium">{question.question_text}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {questionAnswers[question.id] && (
                        <svg className="w-6 h-6 text-green-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(question)
                        }}
                        className="text-primary-600 hover:text-primary-900 mr-4"
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
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar pregunta"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
          <div className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Ejercicios</h2>
              <button 
                onClick={() => setIsCreateExerciseModalOpen(true)}
                className="btn btn-primary"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear Ejercicio
              </button>
            </div>

            {isLoadingExercises ? (
              <div className="text-center py-12 text-gray-500">Cargando ejercicios...</div>
            ) : exercises.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium mb-2">No hay ejercicios creados</p>
                <p className="text-sm">Crea el primer ejercicio para este tema</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                        #
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ejercicio
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                        Ejercicio Completo
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {exercises.map((exercise: any, index: number) => (
                      <tr key={exercise.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-900 font-medium">{exercise.exercise_text}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {exercise.is_complete ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Completo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Incompleto
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditExercise(exercise)}
                            className="text-primary-600 hover:text-primary-900 mr-4"
                            title="Editar ejercicio"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(exercise)}
                            className="text-red-600 hover:text-red-900"
                            title="Eliminar ejercicio"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
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
                <textarea
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                  required
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
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
                <textarea
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                  required
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-semibold mb-4">Crear Nuevo Ejercicio</h3>
            <form onSubmit={handleSubmitExercise}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ejercicio *
                </label>
                <textarea
                  value={exerciseFormData.exercise_text}
                  onChange={(e) => setExerciseFormData({ ...exerciseFormData, exercise_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                  required
                  placeholder="Escribe el ejercicio aquí..."
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exerciseFormData.is_complete}
                    onChange={(e) => setExerciseFormData({ ...exerciseFormData, is_complete: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Marcar como completo</span>
                </label>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-semibold mb-4">Editar Ejercicio</h3>
            <form onSubmit={handleUpdateExerciseSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ejercicio *
                </label>
                <textarea
                  value={exerciseFormData.exercise_text}
                  onChange={(e) => setExerciseFormData({ ...exerciseFormData, exercise_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={4}
                  required
                  placeholder="Escribe el ejercicio aquí..."
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exerciseFormData.is_complete}
                    onChange={(e) => setExerciseFormData({ ...exerciseFormData, is_complete: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Marcar como completo</span>
                </label>
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
    </div>
  )
}

export default TopicDetailPage
