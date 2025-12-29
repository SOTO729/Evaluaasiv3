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
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState<number | null>(null)
  const [showEditCategoryModal, setShowEditCategoryModal] = useState<number | null>(null)
  const [showPercentageWarningModal, setShowPercentageWarningModal] = useState(false)
  const [showEditExamModal, setShowEditExamModal] = useState(false)
  const [percentageAdjustments, setPercentageAdjustments] = useState<{[key: number]: string}>({})
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryPercentage, setNewCategoryPercentage] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryPercentage, setEditCategoryPercentage] = useState('')
  const [editCategoryDescription, setEditCategoryDescription] = useState('')
  // Estados para editar examen
  const [editExamName, setEditExamName] = useState('')
  const [editExamVersion, setEditExamVersion] = useState('')
  const [editExamDuration, setEditExamDuration] = useState('')
  const [editExamPassingScore, setEditExamPassingScore] = useState('')
  const [editExamImageUrl, setEditExamImageUrl] = useState('')
  const [editExamImagePreview, setEditExamImagePreview] = useState<string | null>(null)
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

  const updateExamMutation = useMutation({
    mutationFn: (data: { name: string; version: string; duration_minutes: number; passing_score: number; image_url?: string }) => 
      examService.updateExam(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', id] })
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      setShowEditExamModal(false)
      setToast({ message: 'Examen actualizado exitosamente', type: 'success' })
    },
    onError: (error: any) => {
      console.error('Error updating exam:', error)
      setToast({ 
        message: `Error al actualizar examen: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; percentage: number; description?: string }) => 
      examService.createCategory(Number(id), data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exam', id] })
      setShowCreateCategoryModal(false)
      setNewCategoryName('')
      setNewCategoryPercentage('')
      setNewCategoryDescription('')
      setToast({ message: 'Categoría creada exitosamente', type: 'success' })
      // Verificar porcentajes después de un breve delay para que se actualicen los datos
      setTimeout(() => checkPercentageSum(), 500)
    },
    onError: (error: any) => {
      console.error('Error creating category:', error)
      setToast({ 
        message: `Error al crear categoría: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: number) => examService.deleteCategory(Number(id), categoryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exam', id] })
      setShowDeleteCategoryModal(null)
      setToast({ message: 'Categoría eliminada exitosamente', type: 'success' })
      // Verificar porcentajes después de un breve delay para que se actualicen los datos
      setTimeout(() => checkPercentageSum(), 500)
    },
    onError: (error: any) => {
      console.error('Error deleting category:', error)
      setToast({ 
        message: `Error al eliminar categoría: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: number; data: { name: string; percentage: number; description?: string } }) => 
      examService.updateCategory(Number(id), categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam', id] })
      setShowEditCategoryModal(null)
      setEditCategoryName('')
      setEditCategoryPercentage('')
      setEditCategoryDescription('')
      setToast({ message: 'Categoría actualizada exitosamente', type: 'success' })
    },
    onError: (error: any) => {
      console.error('Error updating category:', error)
      setToast({ 
        message: `Error al actualizar categoría: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
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

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCategoryName.trim() && newCategoryPercentage) {
      createCategoryMutation.mutate({
        name: newCategoryName.trim(),
        percentage: parseInt(newCategoryPercentage),
        description: newCategoryDescription.trim() || undefined
      })
    }
  }

  const handleDeleteCategory = (categoryId: number) => {
    deleteCategoryMutation.mutate(categoryId)
  }

  const handleEditCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (showEditCategoryModal && editCategoryName.trim() && editCategoryPercentage) {
      updateCategoryMutation.mutate({
        categoryId: showEditCategoryModal,
        data: {
          name: editCategoryName.trim(),
          percentage: parseInt(editCategoryPercentage),
          description: editCategoryDescription.trim() || undefined
        }
      })
    }
  }

  const openEditCategoryModal = (category: any) => {
    setEditCategoryName(category.name || '')
    setEditCategoryPercentage(category.percentage?.toString() || '')
    setEditCategoryDescription(category.description || '')
    setShowEditCategoryModal(category.id)
  }

  // Función para verificar si la suma de porcentajes es 100
  const checkPercentageSum = () => {
    const currentExam = queryClient.getQueryData<typeof exam>(['exam', id])
    if (currentExam?.categories && currentExam.categories.length > 0) {
      const totalPercentage = currentExam.categories.reduce(
        (sum: number, cat: any) => sum + (cat.percentage || 0), 
        0
      )
      if (totalPercentage !== 100) {
        // Inicializar los valores actuales para el modal
        const adjustments: {[key: number]: string} = {}
        currentExam.categories.forEach((cat: any) => {
          adjustments[cat.id] = cat.percentage?.toString() || '0'
        })
        setPercentageAdjustments(adjustments)
        setShowPercentageWarningModal(true)
      }
    }
  }

  // Calcular la suma actual de porcentajes en el modal de ajuste
  const getCurrentAdjustmentSum = () => {
    return Object.values(percentageAdjustments).reduce(
      (sum, val) => sum + (parseInt(val) || 0), 
      0
    )
  }

  // Guardar ajustes de porcentajes
  const handleSavePercentageAdjustments = async () => {
    const currentExam = queryClient.getQueryData<typeof exam>(['exam', id])
    if (!currentExam?.categories) return

    try {
      // Actualizar cada categoría con su nuevo porcentaje
      for (const category of currentExam.categories) {
        const newPercentage = parseInt(percentageAdjustments[category.id]) || 0
        if (newPercentage !== category.percentage) {
          await examService.updateCategory(Number(id), category.id, {
            name: category.name,
            percentage: newPercentage,
            description: category.description
          })
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['exam', id] })
      setShowPercentageWarningModal(false)
      setPercentageAdjustments({})
      setToast({ message: 'Porcentajes actualizados correctamente', type: 'success' })
    } catch (error: any) {
      console.error('Error updating percentages:', error)
      setToast({ 
        message: `Error al actualizar porcentajes: ${error.response?.data?.error || error.message || 'Error desconocido'}`, 
        type: 'error' 
      })
    }
  }

  // Funciones para editar examen
  const openEditExamModal = () => {
    if (exam) {
      setEditExamName(exam.name || '')
      setEditExamVersion(exam.version || '')
      setEditExamDuration(exam.duration_minutes?.toString() || '')
      setEditExamPassingScore(exam.passing_score?.toString() || '70')
      setEditExamImageUrl(exam.image_url || '')
      setEditExamImagePreview(exam.image_url || null)
      setShowEditExamModal(true)
    }
  }

  const handleEditExam = (e: React.FormEvent) => {
    e.preventDefault()
    if (editExamName.trim() && editExamVersion.trim()) {
      updateExamMutation.mutate({
        name: editExamName.trim(),
        version: editExamVersion.trim(),
        duration_minutes: parseInt(editExamDuration) || 0,
        passing_score: parseInt(editExamPassingScore) || 70,
        image_url: editExamImageUrl || undefined
      })
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Verificar tamaño (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setToast({ message: 'La imagen no debe superar 2MB', type: 'error' })
        return
      }
      
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setEditExamImageUrl(base64)
        setEditExamImagePreview(base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setEditExamImageUrl('')
    setEditExamImagePreview(null)
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Información General</h2>
          <button
            onClick={openEditExamModal}
            disabled={exam.is_published}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              exam.is_published
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title={exam.is_published ? 'Cambie a borrador para editar' : 'Editar información del examen'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modificar Examen
          </button>
        </div>
        
        {/* Imagen del examen - ancho completo */}
        <div className="mb-6">
          {exam.image_url ? (
            <img 
              src={exam.image_url} 
              alt={exam.name}
              className="w-full h-48 object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <div className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">Sin imagen de identidad gráfica</p>
              </div>
            </div>
          )}
        </div>
        
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
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Categorías del Examen</h2>
            <span className="text-sm text-gray-600">
              {exam.categories?.length || 0} categoría{exam.categories?.length !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Botón Agregar Categoría - solo en modo borrador */}
          <button
            onClick={() => setShowCreateCategoryModal(true)}
            disabled={exam.is_published}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              exam.is_published
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
            title={exam.is_published ? 'Cambie a borrador para agregar categorías' : 'Agregar categoría'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Categoría
          </button>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exam.categories.map((category, index) => (
                  <tr 
                    key={category.id} 
                    className="hover:bg-primary-50 transition-colors"
                  >
                    <td 
                      className="px-4 py-4 whitespace-nowrap cursor-pointer"
                      onClick={() => {
                        if (exam.is_published) {
                          setToast({ message: 'Cambie el examen a borrador para editar las categorías', type: 'error' })
                        } else {
                          navigate(`/exams/${id}/categories/${category.id}`)
                        }
                      }}
                    >
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td 
                      className="px-4 py-4 cursor-pointer"
                      onClick={() => {
                        if (exam.is_published) {
                          setToast({ message: 'Cambie el examen a borrador para editar las categorías', type: 'error' })
                        } else {
                          navigate(`/exams/${id}/categories/${category.id}`)
                        }
                      }}
                    >
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!exam.is_published) {
                              openEditCategoryModal(category)
                            }
                          }}
                          disabled={exam.is_published}
                          className={`p-2 rounded-lg transition-colors ${
                            exam.is_published
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                          title={exam.is_published ? 'Cambie a borrador para editar' : 'Editar categoría'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!exam.is_published) {
                              setShowDeleteCategoryModal(category.id)
                            }
                          }}
                          disabled={exam.is_published}
                          className={`p-2 rounded-lg transition-colors ${
                            exam.is_published
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                          }`}
                          title={exam.is_published ? 'Cambie a borrador para eliminar' : 'Eliminar categoría'}
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
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No hay categorías registradas para este examen</p>
            {!exam.is_published && (
              <button
                onClick={() => setShowCreateCategoryModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Agregar Primera Categoría
              </button>
            )}
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

      {/* Modal Crear Categoría */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Nueva Categoría
              </h3>
            </div>
            
            <form onSubmit={handleCreateCategory}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la categoría *
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="input w-full"
                    placeholder="Ej: Conocimientos Básicos"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Porcentaje del examen *
                  </label>
                  <input
                    type="number"
                    value={newCategoryPercentage}
                    onChange={(e) => setNewCategoryPercentage(e.target.value)}
                    className="input w-full"
                    placeholder="Ej: 25"
                    min="1"
                    max="100"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Peso de esta categoría en la calificación final (1-100%)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    className="input w-full"
                    rows={2}
                    placeholder="Descripción breve de la categoría"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCategoryModal(false)
                    setNewCategoryName('')
                    setNewCategoryPercentage('')
                    setNewCategoryDescription('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending || !newCategoryName.trim() || !newCategoryPercentage}
                  className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {createCategoryMutation.isPending ? 'Creando...' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Categoría */}
      {showEditCategoryModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Editar Categoría
              </h3>
            </div>
            
            <form onSubmit={handleEditCategory}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="editCategoryName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="editCategoryName"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Seguridad Vial"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="editCategoryPercentage" className="block text-sm font-medium text-gray-700 mb-1">
                    Porcentaje *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editCategoryPercentage"
                      value={editCategoryPercentage}
                      onChange={(e) => setEditCategoryPercentage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: 25"
                      min="0"
                      max="100"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="editCategoryDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    id="editCategoryDescription"
                    value={editCategoryDescription}
                    onChange={(e) => setEditCategoryDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Breve descripción de la categoría..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCategoryModal(null)
                    setEditCategoryName('')
                    setEditCategoryPercentage('')
                    setEditCategoryDescription('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateCategoryMutation.isPending || !editCategoryName.trim() || !editCategoryPercentage}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {updateCategoryMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Eliminar Categoría */}
      {showDeleteCategoryModal !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Eliminar Categoría
              </h3>
            </div>
            
            <p className="text-gray-700 mb-2">
              ¿Estás seguro de que deseas eliminar esta categoría?
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
                    Esta acción no se puede deshacer. Se eliminarán:
                  </p>
                  <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                    <li>Todos los temas de esta categoría</li>
                    <li>Todas las preguntas y ejercicios asociados</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteCategoryModal(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteCategory(showDeleteCategoryModal)}
                disabled={deleteCategoryMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {deleteCategoryMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Examen */}
      {showEditExamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Modificar Examen
              </h3>
            </div>
            
            <form onSubmit={handleEditExam}>
              <div className="space-y-4">
                {/* Imagen del Examen - Ancho completo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Imagen de Identidad Gráfica
                  </label>
                  {editExamImagePreview ? (
                    <div className="relative">
                      <img 
                        src={editExamImagePreview} 
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg"
                        title="Eliminar imagen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Clic para subir</span> o arrastra y suelta
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG o GIF. Máximo 2MB.</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Nombre del Examen */}
                <div>
                  <label htmlFor="editExamName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Examen *
                  </label>
                  <input
                    type="text"
                    id="editExamName"
                    value={editExamName}
                    onChange={(e) => setEditExamName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Evaluación de Conocimientos de Seguridad"
                    required
                  />
                </div>
                
                {/* Código ECM */}
                <div>
                  <label htmlFor="editExamVersion" className="block text-sm font-medium text-gray-700 mb-1">
                    Código ECM *
                  </label>
                  <input
                    type="text"
                    id="editExamVersion"
                    value={editExamVersion}
                    onChange={(e) => setEditExamVersion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="Ej: ECM-001"
                    required
                  />
                </div>
                
                {/* Duración y Puntaje Mínimo en grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="editExamDuration" className="block text-sm font-medium text-gray-700 mb-1">
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      id="editExamDuration"
                      value={editExamDuration}
                      onChange={(e) => setEditExamDuration(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: 60"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="editExamPassingScore" className="block text-sm font-medium text-gray-700 mb-1">
                      Puntaje Mínimo (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="editExamPassingScore"
                        value={editExamPassingScore}
                        onChange={(e) => setEditExamPassingScore(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ej: 70"
                        min="0"
                        max="100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditExamModal(false)
                    setEditExamImagePreview(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateExamMutation.isPending || !editExamName.trim() || !editExamVersion.trim()}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  {updateExamMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Advertencia de Porcentajes */}
      {showPercentageWarningModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Ajustar Porcentajes
              </h3>
            </div>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-800 font-medium">
                    La suma de los porcentajes debe ser exactamente 100%
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Suma actual: <span className={`font-bold ${getCurrentAdjustmentSum() === 100 ? 'text-green-600' : 'text-red-600'}`}>{getCurrentAdjustmentSum()}%</span>
                    {getCurrentAdjustmentSum() !== 100 && (
                      <span className="ml-2">
                        ({getCurrentAdjustmentSum() > 100 ? `Excede por ${getCurrentAdjustmentSum() - 100}%` : `Faltan ${100 - getCurrentAdjustmentSum()}%`})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {exam?.categories?.map((category: any) => (
                <div key={category.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{category.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={percentageAdjustments[category.id] || '0'}
                      onChange={(e) => setPercentageAdjustments({
                        ...percentageAdjustments,
                        [category.id]: e.target.value
                      })}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-center"
                      min="0"
                      max="100"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPercentageWarningModal(false)
                  setPercentageAdjustments({})
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Corregir Después
              </button>
              <button
                onClick={handleSavePercentageAdjustments}
                disabled={getCurrentAdjustmentSum() !== 100}
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  getCurrentAdjustmentSum() === 100 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Guardar Cambios
              </button>
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
