import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import LoadingSpinner from '../../components/LoadingSpinner'

interface AnswerOption {
  id?: string
  answer_text: string
  is_correct: boolean
}

const MultipleChoiceAnswerPage = () => {
  const { examId, categoryId, topicId, questionId } = useParams<{
    examId: string
    categoryId: string
    topicId: string
    questionId: string
  }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<AnswerOption[]>([
    { answer_text: '', is_correct: false },
    { answer_text: '', is_correct: false },
  ])

  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['questions', topicId],
    queryFn: () => examService.getQuestions(Number(topicId)),
    enabled: !!topicId,
  })

  const { data: answersData, isLoading: isLoadingAnswers } = useQuery({
    queryKey: ['answers', questionId],
    queryFn: () => examService.getAnswers(questionId!),
    enabled: !!questionId,
  })

  const createAnswerMutation = useMutation({
    mutationFn: (data: { answer_text: string; is_correct: boolean }) =>
      examService.createAnswer(questionId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] })
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
    },
  })

  const updateAnswerMutation = useMutation({
    mutationFn: ({ answerId, data }: { answerId: string; data: { answer_text?: string; is_correct?: boolean } }) =>
      examService.updateAnswer(answerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] })
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
    },
  })

  const deleteAnswerMutation = useMutation({
    mutationFn: (answerId: string) => examService.deleteAnswer(answerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] })
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
    },
  })

  useEffect(() => {
    if (answersData?.answers && answersData.answers.length > 0) {
      setAnswers(
        answersData.answers.map((a: any) => ({
          id: a.id,
          answer_text: a.answer_text,
          is_correct: a.is_correct,
        }))
      )
    }
  }, [answersData])

  const handleAddAnswer = () => {
    if (answers.length < 6) {
      setAnswers([...answers, { answer_text: '', is_correct: false }])
    }
  }

  const handleRemoveAnswer = (index: number) => {
    if (answers.length > 2) {
      const newAnswers = answers.filter((_, i) => i !== index)
      setAnswers(newAnswers)
    }
  }

  const handleAnswerTextChange = (index: number, text: string) => {
    const newAnswers = [...answers]
    newAnswers[index].answer_text = text
    setAnswers(newAnswers)
  }

  const handleCorrectChange = (index: number) => {
    const newAnswers = answers.map((ans, i) => ({
      ...ans,
      is_correct: i === index,
    }))
    setAnswers(newAnswers)
  }

  const handleSubmit = async () => {
    // Validar que haya al menos una respuesta correcta
    if (!answers.some((a) => a.is_correct)) {
      alert('Debes seleccionar al menos una respuesta correcta')
      return
    }

    // Validar que todas las respuestas tengan texto
    if (answers.some((a) => !a.answer_text.trim())) {
      alert('Todas las respuestas deben tener texto')
      return
    }

    try {
      const existingAnswers = answersData?.answers || []

      // Si hay respuestas existentes, actualizar o eliminar
      if (existingAnswers.length > 0) {
        // Eliminar respuestas que ya no están
        const answersToDelete = existingAnswers.filter(
          (existing: any) => !answers.some((a) => a.id === existing.id)
        )
        
        for (const answerToDelete of answersToDelete) {
          await deleteAnswerMutation.mutateAsync(answerToDelete.id)
        }

        // Actualizar o crear respuestas
        for (const answer of answers) {
          if (answer.id) {
            // Actualizar existente
            await updateAnswerMutation.mutateAsync({
              answerId: answer.id,
              data: {
                answer_text: answer.answer_text,
                is_correct: answer.is_correct,
              },
            })
          } else {
            // Crear nueva
            await createAnswerMutation.mutateAsync({
              answer_text: answer.answer_text,
              is_correct: answer.is_correct,
            })
          }
        }
      } else {
        // Crear todas las respuestas nuevas
        for (const answer of answers) {
          await createAnswerMutation.mutateAsync({
            answer_text: answer.answer_text,
            is_correct: answer.is_correct,
          })
        }
      }

      // Navegar de vuelta
      navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)
    } catch (error) {
      console.error('Error al guardar respuestas:', error)
      alert('Error al guardar las respuestas')
    }
  }

  const question = questionsData?.questions.find((q: any) => q.id === questionId)

  if (isLoading || isLoadingAnswers) return <LoadingSpinner message="Cargando pregunta..." fullScreen />
  if (!question) return <div className="text-center py-12 text-gray-600">Pregunta no encontrada</div>

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Preguntas
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurar Respuestas - Opción Múltiple</h1>
        <p className="text-gray-600">Agrega las opciones de respuesta y selecciona la correcta</p>
      </div>

      {/* Pregunta */}
      <div className="card mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Pregunta:</h3>
            <p className="text-lg font-medium text-gray-900">{question.question_text}</p>
          </div>
        </div>
      </div>

      {/* Opciones de Respuesta */}
      <div className="card mb-6">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Opciones de Respuesta</h3>
              <p className="text-sm text-gray-600">
                Agrega las posibles respuestas y marca cuál es la correcta
              </p>
            </div>
            <button
              onClick={handleAddAnswer}
              disabled={answers.length >= 6}
              className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Opción
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {answers.map((answer, index) => (
            <div 
              key={index} 
              className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                answer.is_correct 
                  ? 'bg-green-50 border-green-400 shadow-sm' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Radio para marcar correcta */}
              <div className="flex flex-col items-center">
                <label className="flex items-center cursor-pointer group">
                  <div className={`relative w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    answer.is_correct 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-gray-400 bg-white group-hover:border-green-400'
                  }`}>
                    <input
                      type="radio"
                      name="correct"
                      checked={answer.is_correct}
                      onChange={() => handleCorrectChange(index)}
                      className="sr-only"
                    />
                    {answer.is_correct && (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </label>
                {answer.is_correct && (
                  <span className="text-xs text-green-700 font-medium mt-1">Correcta</span>
                )}
              </div>

              {/* Letra de la opción */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                answer.is_correct 
                  ? 'bg-green-600 text-white' 
                  : 'bg-primary-600 text-white'
              }`}>
                {String.fromCharCode(65 + index)}
              </div>

              {/* Campo de texto */}
              <div className="flex-1">
                <input
                  type="text"
                  value={answer.answer_text}
                  onChange={(e) => handleAnswerTextChange(index, e.target.value)}
                  placeholder={`Escribe la opción ${String.fromCharCode(65 + index)}...`}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:outline-none transition-all ${
                    answer.is_correct
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500 bg-white'
                      : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                  }`}
                  required
                />
              </div>

              {/* Botón eliminar */}
              {answers.length > 2 ? (
                <button
                  onClick={() => handleRemoveAnswer(index)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0"
                  title="Eliminar esta opción"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              ) : (
                <div className="w-9"></div>
              )}
            </div>
          ))}
        </div>

        {/* Resumen de estado */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              <strong>{answers.length}</strong> {answers.length === 1 ? 'opción' : 'opciones'} 
              {answers.length < 6 && ` (máximo 6)`}
            </span>
            {answers.some((a) => a.is_correct) ? (
              <span className="inline-flex items-center text-green-600 font-medium">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Respuesta correcta seleccionada
              </span>
            ) : (
              <span className="inline-flex items-center text-amber-600 font-medium">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Debes seleccionar la respuesta correcta
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)}
          className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            createAnswerMutation.isPending ||
            updateAnswerMutation.isPending ||
            deleteAnswerMutation.isPending ||
            !answers.some((a) => a.is_correct) ||
            answers.some((a) => !a.answer_text.trim())
          }
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createAnswerMutation.isPending || updateAnswerMutation.isPending || deleteAnswerMutation.isPending
            ? 'Guardando...'
            : 'Guardar Respuestas'}
        </button>
      </div>
    </div>
  )
}

export default MultipleChoiceAnswerPage
