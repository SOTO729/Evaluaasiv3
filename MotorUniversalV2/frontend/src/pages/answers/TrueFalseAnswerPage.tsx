import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import LoadingSpinner from '../../components/LoadingSpinner'

const TrueFalseAnswerPage = () => {
  const { examId, categoryId, topicId, questionId } = useParams<{
    examId: string
    categoryId: string
    topicId: string
    questionId: string
  }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [correctAnswer, setCorrectAnswer] = useState<boolean | null>(null)

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
    mutationFn: ({ answerId, data }: { answerId: string; data: { is_correct: boolean } }) =>
      examService.updateAnswer(answerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['answers', questionId] })
      queryClient.invalidateQueries({ queryKey: ['questions', topicId] })
    },
  })

  useEffect(() => {
    if (answersData?.answers && answersData.answers.length > 0) {
      const trueAnswer = answersData.answers.find((a: any) => a.answer_text === 'Verdadero')
      if (trueAnswer?.is_correct) {
        setCorrectAnswer(true)
      } else {
        setCorrectAnswer(false)
      }
    }
  }, [answersData])

  const handleSubmit = () => {
    if (correctAnswer === null) return

    const existingAnswers = answersData?.answers || []
    
    if (existingAnswers.length === 0) {
      // Crear ambas respuestas
      Promise.all([
        createAnswerMutation.mutateAsync({
          answer_text: 'Verdadero',
          is_correct: correctAnswer === true,
        }),
        createAnswerMutation.mutateAsync({
          answer_text: 'Falso',
          is_correct: correctAnswer === false,
        })
      ]).then(() => {
        navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)
      })
    } else {
      // Actualizar las respuestas existentes
      const trueAnswer = existingAnswers.find((a: any) => a.answer_text === 'Verdadero')
      const falseAnswer = existingAnswers.find((a: any) => a.answer_text === 'Falso')
      
      const updates = []
      if (trueAnswer) {
        updates.push(
          updateAnswerMutation.mutateAsync({
            answerId: trueAnswer.id,
            data: { is_correct: correctAnswer === true },
          })
        )
      }
      if (falseAnswer) {
        updates.push(
          updateAnswerMutation.mutateAsync({
            answerId: falseAnswer.id,
            data: { is_correct: correctAnswer === false },
          })
        )
      }
      
      Promise.all(updates).then(() => {
        navigate(`/exams/${examId}/categories/${categoryId}/topics/${topicId}`)
      })
    }
  }

  const question = questionsData?.questions.find((q: any) => q.id === questionId)

  if (isLoading || isLoadingAnswers) return <LoadingSpinner message="Cargando pregunta..." fullScreen />
  if (!question) return <div className="text-center py-12 text-gray-600">Pregunta no encontrada</div>

  return (
    <div className="max-w-3xl mx-auto">
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurar Respuesta Verdadero/Falso</h1>
        <p className="text-gray-600">Selecciona la respuesta correcta para esta pregunta</p>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Respuesta Correcta</h3>
        <div className="space-y-3">
          <button
            onClick={() => setCorrectAnswer(true)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
              correctAnswer === true
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-green-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                  correctAnswer === true
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300'
                }`}
              >
                {correctAnswer === true && (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-lg font-medium text-gray-900">Verdadero</span>
            </div>
            {correctAnswer === true && (
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                Correcta
              </span>
            )}
          </button>

          <button
            onClick={() => setCorrectAnswer(false)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
              correctAnswer === false
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-green-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                  correctAnswer === false
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300'
                }`}
              >
                {correctAnswer === false && (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-lg font-medium text-gray-900">Falso</span>
            </div>
            {correctAnswer === false && (
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                Correcta
              </span>
            )}
          </button>
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
          disabled={correctAnswer === null || createAnswerMutation.isPending || updateAnswerMutation.isPending}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createAnswerMutation.isPending || updateAnswerMutation.isPending
            ? 'Guardando...'
            : 'Guardar Respuesta'}
        </button>
      </div>
    </div>
  )
}

export default TrueFalseAnswerPage
