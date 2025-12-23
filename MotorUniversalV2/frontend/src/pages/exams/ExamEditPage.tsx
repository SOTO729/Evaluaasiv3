import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

// Componente de notificación toast
interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
        type === 'success' 
          ? 'bg-green-600 text-white' 
          : 'bg-red-600 text-white'
      }`}>
        {type === 'success' ? (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 hover:opacity-80 transition-opacity"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

interface ValidationError {
  type: string
  message: string
  details: string
}

const ExamEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean
    errors: ValidationError[]
    warnings: ValidationError[]
    summary: { total_categories: number; total_topics: number; total_questions: number; total_exercises: number }
  } | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true), // Incluir detalles completos
    enabled: !!id,
  })

  const deleteExamMutation = useMutation({
    mutationFn: async (password: string) => {
      // Verificar contraseña primero
      try {
        await api.post('/auth/verify-password', { password })
      } catch (err: any) {
        // Extraer el mensaje de error de la respuesta
        const errorMsg = err.response?.data?.error || 'Contraseña incorrecta'
        throw new Error(errorMsg)
      }
      // Si la contraseña es correcta, eliminar el examen
      return await examService.deleteExam(Number(id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      navigate('/exams')
    },
    onError: (error: any) => {
      setDeleteError(error.message || 'Error al eliminar el examen')
    },
  })

  const publishExamMutation = useMutation({
    mutationFn: () => examService.publishExam(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', id] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      setShowPublishModal(false)
      setValidationResult(null)
      setToast({ message: '¡Examen publicado exitosamente! Ya está disponible para los estudiantes.', type: 'success' })
    },
    onError: (error: any) => {
      console.error('Error publishing exam:', error)
      setToast({ 
        message: `Error al publicar: ${error.response?.data?.message || error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    },
  })

  const unpublishExamMutation = useMutation({
    mutationFn: () => examService.unpublishExam(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', id] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      setToast({ message: 'El examen ha sido cambiado a borrador.', type: 'success' })
    },
    onError: (error: any) => {
      console.error('Error unpublishing exam:', error)
      setToast({ 
        message: `Error al cambiar a borrador: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    },
  })

  const handleValidateAndPublish = async () => {
    setIsValidating(true)
    try {
      const result = await examService.validateExam(Number(id))
      setValidationResult(result)
      setShowPublishModal(true)
    } catch (error: any) {
      console.error('Error validating exam:', error)
      setToast({ 
        message: `Error al validar el examen: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handlePublish = () => {
    console.log('handlePublish called, validationResult:', validationResult)
    if (validationResult?.is_valid) {
      console.log('Calling publishExamMutation.mutate()')
      publishExamMutation.mutate()
    } else {
      console.log('Cannot publish: validation is not valid')
    }
  }

  const handleUnpublish = () => {
    unpublishExamMutation.mutate()
  }

  const handleDeleteExam = (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteError('')
    if (password.trim()) {
      deleteExamMutation.mutate(password)
    }
  }

  // Debug: Ver qué datos llegan
  console.log('Exam data:', exam)
  console.log('Categories:', exam?.categories)
  console.log('Categories length:', exam?.categories?.length)

  if (isLoading) return <LoadingSpinner message="Cargando examen..." fullScreen />
  if (error) return <div className="text-center py-12 text-red-600">Error al cargar el examen</div>
  if (!exam) return <div className="text-center py-12 text-gray-600">Examen no encontrado</div>

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/exams')}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Exámenes
        </button>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Editar Examen</h1>
            <span className={`px-3 py-1 text-sm rounded-full ${
              exam.is_published 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {exam.is_published ? 'Publicado' : 'Borrador'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Botón Publicar/Despublicar */}
            {exam.is_published ? (
              <button
                onClick={handleUnpublish}
                disabled={unpublishExamMutation.isPending}
                className="px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {unpublishExamMutation.isPending ? 'Cambiando...' : 'Cambiar a Borrador'}
              </button>
            ) : (
              <button
                onClick={handleValidateAndPublish}
                disabled={isValidating}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isValidating ? 'Validando...' : 'Publicar'}
              </button>
            )}
            
            {/* Botón Eliminar (solo admin) */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar Examen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Información General del Examen */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Información General</h2>
        
        <div className="space-y-4">
          {/* Nombre del Examen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Examen
            </label>
            <p className="text-lg font-semibold text-gray-900">{exam.name}</p>
          </div>

          {/* Código ECM */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código ECM
            </label>
            <p className="text-lg font-mono font-semibold text-primary-600">{exam.version}</p>
          </div>

          {/* Información adicional en grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Duración
              </label>
              <p className="text-base font-semibold">{exam.duration_minutes || 0} min</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Puntaje Mínimo
              </label>
              <p className="text-base font-semibold">{exam.passing_score}%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Preguntas
              </label>
              <p className="text-base font-semibold">{exam.total_questions}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Ejercicios
              </label>
              <p className="text-base font-semibold">{exam.total_exercises}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categorías del Examen */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Categorías del Examen</h2>
          <span className="text-sm text-gray-600">
            {exam.categories?.length || 0} categoría{exam.categories?.length !== 1 ? 's' : ''}
          </span>
        </div>

        {exam.categories && exam.categories.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Porcentaje
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preguntas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ejercicios
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exam.categories.map((category, index) => (
                  <tr 
                    key={category.id} 
                    onClick={() => {
                      if (exam.is_published) {
                        setToast({ message: 'Cambie el examen a borrador para editar las categorías', type: 'error' })
                      } else {
                        navigate(`/exams/${id}/categories/${category.id}`)
                      }
                    }}
                    className="hover:bg-primary-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-gray-500 mt-1">{category.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-700">
                        {category.percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{category.total_questions || 0}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{category.total_exercises || 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No hay categorías registradas para este examen
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Confirmar Eliminación del Examen
              </h3>
            </div>
            
            <p className="text-gray-700 mb-2">
              ¿Estás seguro de que deseas eliminar el examen <strong>"{exam.name}"</strong>?
            </p>
            
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800 font-medium">
                    Esta acción no se puede deshacer. Se eliminarán permanentemente:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                    <li>Todas las categorías del examen ({exam.categories?.length || 0})</li>
                    <li>Todos los temas, preguntas y ejercicios</li>
                    <li>Toda la información asociada al examen</li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleDeleteExam}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Para confirmar, ingresa tu contraseña:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setDeleteError('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Tu contraseña"
                  required
                  autoFocus
                />
                {deleteError && (
                  <p className="mt-2 text-sm text-red-600">{deleteError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false)
                    setPassword('')
                    setDeleteError('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={deleteExamMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
                  disabled={deleteExamMutation.isPending}
                >
                  {deleteExamMutation.isPending ? 'Eliminando...' : 'Sí, eliminar examen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Validación y Publicación */}
      {showPublishModal && validationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                  validationResult.is_valid ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {validationResult.is_valid ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {validationResult.is_valid ? 'Examen listo para publicar' : 'El examen tiene errores'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {validationResult.is_valid 
                      ? 'Todas las validaciones han pasado correctamente'
                      : 'Corrige los siguientes errores antes de publicar'
                    }
                  </p>
                </div>
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-4 gap-3 mb-6 bg-gray-50 p-4 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{validationResult.summary.total_categories}</p>
                  <p className="text-xs text-gray-600">Categorías</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{validationResult.summary.total_topics}</p>
                  <p className="text-xs text-gray-600">Temas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{validationResult.summary.total_questions}</p>
                  <p className="text-xs text-gray-600">Preguntas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{validationResult.summary.total_exercises}</p>
                  <p className="text-xs text-gray-600">Ejercicios</p>
                </div>
              </div>

              {/* Errores */}
              {validationResult.errors.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Errores ({validationResult.errors.length})
                  </h4>
                  <div className="space-y-3">
                    {validationResult.errors.map((error, index) => (
                      <div key={index} className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r">
                        <p className="text-sm font-medium text-red-800">{error.message}</p>
                        <p className="text-xs text-red-600 mt-1">{error.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advertencias */}
              {validationResult.warnings.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Advertencias ({validationResult.warnings.length})
                  </h4>
                  <div className="space-y-3">
                    {validationResult.warnings.map((warning, index) => (
                      <div key={index} className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-r">
                        <p className="text-sm font-medium text-yellow-800">{warning.message}</p>
                        <p className="text-xs text-yellow-600 mt-1">{warning.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensaje de éxito */}
              {validationResult.is_valid && validationResult.warnings.length === 0 && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm font-medium text-green-800">
                      El examen está completo y listo para ser publicado
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishModal(false)
                    setValidationResult(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {validationResult.is_valid ? 'Cancelar' : 'Cerrar'}
                </button>
                {validationResult.is_valid && (
                  <button
                    onClick={handlePublish}
                    disabled={publishExamMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {publishExamMutation.isPending ? 'Publicando...' : 'Confirmar Publicación'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast de notificación */}
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

export default ExamEditPage
