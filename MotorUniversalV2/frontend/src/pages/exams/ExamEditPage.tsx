import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'
import ExamTestConfigModal from '../../components/ExamTestConfigModal'
import Breadcrumb from '../../components/Breadcrumb'

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
      <div className={`flex items-center fluid-gap-3 fluid-px-6 fluid-py-4 rounded-fluid-lg shadow-lg ${
        type === 'success' 
          ? 'bg-green-600 text-white' 
          : 'bg-red-600 text-white'
      }`}>
        {type === 'success' ? (
          <svg className="fluid-icon-lg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="fluid-icon-lg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="fluid-ml-2 hover:opacity-80 transition-opacity"
        >
          <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const [showEcmConflictModal, setShowEcmConflictModal] = useState(false)
  const [ecmConflictData, setEcmConflictData] = useState<{
    current_exam?: { id: number; name: string; version: string; ecm_code: string | null };
    conflicting_exam?: { id: number; name: string; version: string; is_published: boolean };
  } | null>(null)
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
  const [editExamPauseOnDisconnect, setEditExamPauseOnDisconnect] = useState(true)
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
  const [showTestModal, setShowTestModal] = useState(false)
  const [testQuestionCount, setTestQuestionCount] = useState(0)
  const [testExerciseCount, setTestExerciseCount] = useState(0)
  const [dominantColor, setDominantColor] = useState<string | null>(null)
  const [isDownloadingContent, setIsDownloadingContent] = useState(false)
  
  // Estados para configuración de asignación por defecto
  const [showAssignConfigEditor, setShowAssignConfigEditor] = useState(false)
  const [assignMaxAttempts, setAssignMaxAttempts] = useState(2)
  const [assignMaxDisconnections, setAssignMaxDisconnections] = useState(3)
  const [assignContentType, setAssignContentType] = useState('mixed')
  const [assignExamQuestionsCount, setAssignExamQuestionsCount] = useState<number | null>(null)
  const [assignExamExercisesCount, setAssignExamExercisesCount] = useState<number | null>(null)
  const [assignSimulatorQuestionsCount, setAssignSimulatorQuestionsCount] = useState<number | null>(null)
  const [assignSimulatorExercisesCount, setAssignSimulatorExercisesCount] = useState<number | null>(null)
  const [savingAssignConfig, setSavingAssignConfig] = useState(false)

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true), // Incluir detalles completos
    enabled: !!id,
  })

  // Función para extraer el color dominante de una imagen
  const extractDominantColor = (imageUrl: string) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Escalar la imagen para analizar menos píxeles (más rápido)
      const scale = 0.1
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        let r = 0, g = 0, b = 0, count = 0

        // Analizar los píxeles de la parte inferior de la imagen (donde va el texto)
        const startY = Math.floor(canvas.height * 0.5) // Solo la mitad inferior
        for (let y = startY; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4
            // Ignorar píxeles muy claros o muy oscuros
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
            if (brightness > 30 && brightness < 230) {
              r += data[i]
              g += data[i + 1]
              b += data[i + 2]
              count++
            }
          }
        }

        if (count > 0) {
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          
          // Oscurecer el color para mejor contraste con texto blanco
          r = Math.round(r * 0.6)
          g = Math.round(g * 0.6)
          b = Math.round(b * 0.6)
          
          setDominantColor(`rgb(${r}, ${g}, ${b})`)
        }
      } catch (e) {
        // Si hay error de CORS, usar color por defecto
        console.log('No se pudo extraer el color de la imagen')
      }
    }
    img.src = imageUrl
  }

  // Extraer color cuando cambia la imagen del examen
  useEffect(() => {
    if (exam?.image_url) {
      extractDominantColor(exam.image_url)
    } else {
      setDominantColor(null)
    }
  }, [exam?.image_url])

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
    mutationFn: (data: { name: string; version: string; duration_minutes: number; passing_score: number; pause_on_disconnect: boolean; image_url?: string }) => 
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

  const handlePublish = async () => {
    console.log('handlePublish called, validationResult:', validationResult)
    if (validationResult?.is_valid) {
      // Verificar conflicto de ECM antes de publicar
      try {
        const conflictResult = await examService.checkEcmConflict(Number(id))
        if (conflictResult.has_conflict) {
          // Mostrar modal de conflicto
          setEcmConflictData({
            current_exam: conflictResult.current_exam,
            conflicting_exam: conflictResult.conflicting_exam
          })
          setShowPublishModal(false)
          setShowEcmConflictModal(true)
          return
        }
        // No hay conflicto, publicar directamente
        console.log('Calling publishExamMutation.mutate()')
        publishExamMutation.mutate()
      } catch (error: any) {
        console.error('Error checking ECM conflict:', error)
        // Si falla la verificación, publicar de todos modos
        publishExamMutation.mutate()
      }
    } else {
      console.log('Cannot publish: validation is not valid')
    }
  }

  // Publicar el examen actual y despublicar el conflictivo
  const handlePublishAndReplaceConflicting = async () => {
    if (!ecmConflictData?.conflicting_exam) return
    
    try {
      // Primero despublicar el examen conflictivo
      await examService.unpublishExam(ecmConflictData.conflicting_exam.id)
      // Luego publicar el actual
      publishExamMutation.mutate()
      setShowEcmConflictModal(false)
      setEcmConflictData(null)
    } catch (error: any) {
      console.error('Error replacing conflicting exam:', error)
      setToast({
        message: `Error al reemplazar el examen: ${error.response?.data?.error || error.message || 'Error desconocido'}`,
        type: 'error'
      })
    }
  }

  // Mantener el examen publicado actual (no hacer nada)
  const handleKeepConflictingPublished = () => {
    setShowEcmConflictModal(false)
    setEcmConflictData(null)
    setToast({
      message: 'Publicación cancelada. El examen existente se mantiene publicado.',
      type: 'success'
    })
  }

  const handleUnpublish = () => {
    unpublishExamMutation.mutate()
  }

  const handleOpenTestModal = () => {
    // Calcular totales
    let totalQuestions = 0
    let totalExercises = 0
    
    if (exam?.categories) {
      exam.categories.forEach((cat: any) => {
        cat.topics?.forEach((topic: any) => {
          totalQuestions += topic.questions?.length || 0
          totalExercises += topic.exercises?.length || 0
        })
      })
    }
    
    setTestQuestionCount(totalQuestions)
    setTestExerciseCount(totalExercises)
    setShowTestModal(true)
  }

  const handleStartTest = (questionCount: number, exerciseCount: number) => {
    navigate(`/test-exams/${id}/run`, {
      state: {
        questionCount,
        exerciseCount
      }
    })
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
      setEditExamPauseOnDisconnect(exam.pause_on_disconnect ?? true)
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
        pause_on_disconnect: editExamPauseOnDisconnect,
        image_url: editExamImageUrl || undefined
      })
    }
  }

  // Funciones para configuración de asignación por defecto
  const openAssignConfigEditor = () => {
    if (exam) {
      setAssignMaxAttempts(exam.default_max_attempts ?? 2)
      setAssignMaxDisconnections(exam.default_max_disconnections ?? 3)
      setAssignContentType(exam.default_exam_content_type || 'mixed')
      setAssignExamQuestionsCount(exam.default_exam_questions_count ?? null)
      setAssignExamExercisesCount(exam.default_exam_exercises_count ?? null)
      setAssignSimulatorQuestionsCount(exam.default_simulator_questions_count ?? null)
      setAssignSimulatorExercisesCount(exam.default_simulator_exercises_count ?? null)
      setShowAssignConfigEditor(true)
    }
  }

  const handleSaveAssignConfig = async () => {
    if (!exam) return
    try {
      setSavingAssignConfig(true)
      await examService.updateExam(Number(id), {
        default_max_attempts: assignMaxAttempts,
        default_max_disconnections: assignMaxDisconnections,
        default_exam_content_type: assignContentType,
        default_exam_questions_count: assignExamQuestionsCount,
        default_exam_exercises_count: assignExamExercisesCount,
        default_simulator_questions_count: assignSimulatorQuestionsCount,
        default_simulator_exercises_count: assignSimulatorExercisesCount,
      } as any)
      await queryClient.invalidateQueries({ queryKey: ['exam', id] })
      setShowAssignConfigEditor(false)
      setToast({ message: 'Configuración de asignación actualizada', type: 'success' })
    } catch (error: any) {
      setToast({ message: `Error: ${error.response?.data?.error || error.message}`, type: 'error' })
    } finally {
      setSavingAssignConfig(false)
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

  // Función para descargar contenido del examen (preguntas, respuestas y ejercicios)
  const handleDownloadExamContent = async () => {
    if (!exam) return
    
    setIsDownloadingContent(true)
    
    try {
      const separator = '═'.repeat(80)
      const subSeparator = '─'.repeat(60)
      
      let content = `${separator}\n`
      content += `                         EXAMEN: ${exam.name.toUpperCase()}\n`
      content += `${separator}\n\n`
      content += `Versión:         ${exam.version}\n`
      content += `Duración:        ${exam.duration_minutes} minutos\n`
      content += `Puntaje mínimo:  ${exam.passing_score}%\n`
      content += `\n${separator}\n\n`
      
      // Iterar sobre categorías
      if (exam.categories && exam.categories.length > 0) {
        for (let catIndex = 0; catIndex < exam.categories.length; catIndex++) {
          const category = exam.categories[catIndex]
          content += `╔${'═'.repeat(78)}╗\n`
          content += `║  CATEGORÍA ${catIndex + 1}: ${category.name.toUpperCase().padEnd(62)}║\n`
          content += `╚${'═'.repeat(78)}╝\n`
          content += `Porcentaje: ${category.percentage}%\n`
          if (category.description) {
            content += `Descripción: ${category.description}\n`
          }
          content += `\n`
          
          // Obtener temas de la categoría
          try {
            const topicsResponse = await examService.getTopics(category.id)
            const topics = topicsResponse.topics || []
            
            for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
              const topic = topics[topicIndex]
              content += `┌${subSeparator}┐\n`
              content += `│ TEMA ${topicIndex + 1}: ${topic.name}\n`
              content += `└${subSeparator}┘\n`
              if (topic.description) {
                content += `Descripción: ${topic.description}\n`
              }
              content += `\n`
              
              // Obtener preguntas del tema
              try {
                const questionsResponse = await examService.getQuestions(topic.id)
                const questions = questionsResponse.questions || []
                
                if (questions.length > 0) {
                  content += `    ▶ PREGUNTAS (${questions.length})\n`
                  content += `    ${'─'.repeat(40)}\n\n`
                  
                  for (const question of questions) {
                    content += `    Pregunta ${question.question_number}:\n`
                    content += `    ${question.question_text}\n\n`
                    content += `    [Tipo: ${question.question_type?.name || 'No especificado'}] `
                    content += `[Dificultad: ${question.difficulty}] `
                    content += `[Puntos: ${question.points}]\n`
                    
                    if (question.image_url) {
                      content += `    📷 [Imagen adjunta]\n`
                    }
                    
                    // Obtener respuestas de la pregunta
                    try {
                      const questionDetail = await examService.getQuestion(question.id)
                      const answers = questionDetail.question?.answers || []
                      
                      if (answers.length > 0) {
                        content += `\n    Respuestas:\n`
                        for (const answer of answers) {
                          const correctMark = answer.is_correct ? '✓ CORRECTA' : '✗'
                          content += `        ${answer.answer_number}. ${answer.answer_text}\n`
                          content += `           ${correctMark}\n`
                          if (answer.explanation) {
                            content += `           💡 ${answer.explanation}\n`
                          }
                        }
                      }
                    } catch (e) {
                      console.error('Error obteniendo respuestas:', e)
                    }
                    
                    content += `\n    ${'·'.repeat(40)}\n\n`
                  }
                }
              } catch (e) {
                console.error('Error obteniendo preguntas:', e)
              }
              
              // Obtener ejercicios del tema
              try {
                const exercisesResponse = await examService.getExercises(topic.id)
                const exercises = exercisesResponse.exercises || []
                
                if (exercises.length > 0) {
                  content += `    ▶ EJERCICIOS (${exercises.length})\n`
                  content += `    ${'─'.repeat(40)}\n\n`
                  
                  for (const exercise of exercises) {
                    content += `    Ejercicio ${exercise.exercise_number}: ${exercise.title || 'Sin título'}\n`
                    content += `    ${exercise.exercise_text}\n`
                    content += `    Total de pasos: ${exercise.total_steps}\n`
                    
                    if (exercise.image_url) {
                      content += `    📷 [Imagen adjunta]\n`
                    }
                    
                    // Obtener pasos del ejercicio desde la API
                    try {
                      const stepsResponse = await examService.getExerciseSteps(exercise.id.toString())
                      const steps = stepsResponse.steps || []
                      
                      if (steps.length > 0) {
                        content += `\n    Pasos del ejercicio:\n`
                        for (const step of steps) {
                          content += `        ┌${'─'.repeat(50)}┐\n`
                          content += `        │ Paso ${step.step_number}: ${step.title || step.description || 'Sin descripción'}\n`
                          content += `        └${'─'.repeat(50)}┘\n`
                          
                          // Obtener acciones del paso desde la API
                          try {
                            const actionsResponse = await examService.getStepActions(step.id.toString())
                            const actions = actionsResponse.actions || []
                            
                            if (actions.length > 0) {
                              // Contar clicks y campos de texto
                              const clickActions = actions.filter((a: { action_type: string }) => a.action_type === 'click')
                              const textActions = actions.filter((a: { action_type: string }) => 
                                a.action_type === 'text' || a.action_type === 'input' || a.action_type === 'textarea'
                              )
                              
                              // Mostrar resumen de interacciones
                              if (clickActions.length > 0) {
                                content += `            🖱️ Este paso requiere ${clickActions.length} click${clickActions.length > 1 ? 's' : ''}\n`
                                for (const click of clickActions) {
                                  const label = click.label || click.placeholder || 'elemento'
                                  content += `               • Click en: "${label}"\n`
                                }
                              }
                              
                              if (textActions.length > 0) {
                                content += `            ✏️ Este paso requiere ${textActions.length} campo${textActions.length > 1 ? 's' : ''} de texto:\n`
                                for (const textAction of textActions) {
                                  const fieldName = textAction.label || textAction.placeholder || 'Campo de texto'
                                  const answer = textAction.correct_answer || '(sin respuesta definida)'
                                  content += `               • ${fieldName}\n`
                                  content += `                 📝 Respuesta correcta: "${answer}"\n`
                                }
                              }
                              
                              // Mostrar otras acciones que no son click ni texto
                              const otherActions = actions.filter((a: { action_type: string }) => 
                                a.action_type !== 'click' && 
                                a.action_type !== 'text' && 
                                a.action_type !== 'input' && 
                                a.action_type !== 'textarea'
                              )
                              
                              if (otherActions.length > 0) {
                                content += `            📋 Otras acciones:\n`
                                for (const action of otherActions) {
                                  content += `               • ${action.action_type}: ${action.label || action.placeholder || 'Sin etiqueta'}`
                                  if (action.correct_answer) {
                                    content += ` → "${action.correct_answer}"`
                                  }
                                  content += `\n`
                                }
                              }
                            } else {
                              content += `            ℹ️ Paso sin interacciones definidas\n`
                            }
                          } catch (actionsError) {
                            console.error('Error obteniendo acciones del paso:', actionsError)
                            content += `            ⚠️ Error al obtener acciones\n`
                          }
                          content += `\n`
                        }
                      } else {
                        content += `\n    ℹ️ Ejercicio sin pasos definidos\n`
                      }
                    } catch (stepsError) {
                      console.error('Error obteniendo pasos del ejercicio:', stepsError)
                      content += `\n    ⚠️ Error al obtener pasos del ejercicio\n`
                    }
                    
                    content += `\n    ${'·'.repeat(40)}\n\n`
                  }
                }
              } catch (e) {
                console.error('Error obteniendo ejercicios:', e)
              }
            }
          } catch (e) {
            console.error('Error obteniendo temas:', e)
          }
          
          content += `\n`
        }
      }
      
      content += `\n${separator}\n`
      content += `                    FIN DEL DOCUMENTO\n`
      content += `${separator}\n`
      
      // Crear y descargar el archivo
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const link = document.createElement('a')
      const cleanName = exam.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().replace(/\s+/g, '_')
      link.download = `${cleanName}_${exam.version}_contenido.txt`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
      
      setToast({ message: 'Contenido descargado exitosamente', type: 'success' })
    } catch (error) {
      console.error('Error al descargar contenido:', error)
      setToast({ message: 'Error al descargar el contenido', type: 'error' })
    } finally {
      setIsDownloadingContent(false)
    }
  }

  // Debug: Ver qué datos llegan
  console.log('Exam data:', exam)
  console.log('Categories:', exam?.categories)
  console.log('Categories length:', exam?.categories?.length)

  if (isLoading) return <LoadingSpinner message="Cargando examen..." fullScreen />
  if (error) return <div className="text-center fluid-py-12 text-red-600 fluid-text-base">Error al cargar el examen</div>
  if (!exam) return <div className="text-center fluid-py-12 text-gray-600 fluid-text-base">Examen no encontrado</div>

  const breadcrumbItems = [
    { label: exam.name, isActive: true },
  ]

  return (
    <div className="w-full max-w-[2800px] mx-auto fluid-px-6 animate-fade-in-up">
      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Botón volver a lista */}
      <button
        onClick={() => navigate('/exams')}
        className="fluid-mb-4 text-primary-600 hover:text-primary-700 flex items-center fluid-text-sm font-medium transition-colors group"
      >
        <svg className="fluid-icon-sm fluid-mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a lista de exámenes
      </button>

      {/* Header */}
      <div className="fluid-mb-8">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <h1 className="fluid-text-3xl font-bold text-gray-900">Editar Examen</h1>
            <span className={`fluid-px-4 fluid-py-1.5 fluid-text-sm font-semibold rounded-full transition-all ${
              exam.is_published 
                ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200' 
                : 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200'
            }`}>
              {exam.is_published ? '✓ Publicado' : '✎ Borrador'}
            </span>
          </div>
          <div className="flex flex-wrap items-center fluid-gap-3">
            {/* Botón Probar Examen - solo visible cuando está publicado */}
            {exam.is_published && (
              <button
                onClick={handleOpenTestModal}
                className="fluid-px-4 fluid-py-2 btn-animated-gradient text-white rounded-fluid-lg font-medium flex items-center fluid-gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-300"
              >
                <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Probar Examen
              </button>
            )}

            {/* Botón Publicar/Despublicar */}
            {exam.is_published ? (
              <button
                onClick={handleUnpublish}
                disabled={unpublishExamMutation.isPending}
                className="fluid-px-4 fluid-py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-fluid-lg transition-colors font-medium flex items-center fluid-gap-2 disabled:opacity-50"
              >
                <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {unpublishExamMutation.isPending ? 'Cambiando...' : 'Cambiar a Borrador'}
              </button>
            ) : (
              <button
                onClick={handleValidateAndPublish}
                disabled={isValidating}
                className="fluid-px-4 fluid-py-2 bg-green-600 text-white hover:bg-green-700 rounded-fluid-lg transition-colors font-medium flex items-center fluid-gap-2 disabled:opacity-50"
              >
                <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isValidating ? 'Validando...' : 'Publicar'}
              </button>
            )}
            
            {/* Botón Descargar Contenido y Respuestas */}
            <button
              onClick={handleDownloadExamContent}
              disabled={isDownloadingContent}
              className="fluid-px-4 fluid-py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-fluid-lg transition-colors font-medium flex items-center fluid-gap-2 disabled:opacity-50"
              title="Descargar preguntas, respuestas y ejercicios"
            >
              <svg className="fluid-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isDownloadingContent ? 'Descargando...' : 'Descargar Contenido y Respuestas'}
            </button>
            
            {/* Botón Eliminar (solo admin) */}
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="fluid-px-4 fluid-py-2 bg-red-600 text-white hover:bg-red-700 rounded-fluid-lg transition-colors font-medium flex items-center fluid-gap-2"
              >
                <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar Examen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header con Imagen de Fondo y Estadísticas Superpuestas */}
      <div className="relative rounded-fluid-xl overflow-hidden fluid-mb-6 shadow-lg">
        {/* Background Image */}
        {exam.image_url ? (
          <div className="absolute inset-0">
            <img 
              src={exam.image_url} 
              alt={exam.name}
              className="w-full h-full object-cover"
            />
            <div 
              className="absolute inset-0 transition-colors duration-500"
              style={{
                background: dominantColor 
                  ? `linear-gradient(to top, ${dominantColor} 0%, ${dominantColor}dd 40%, ${dominantColor}99 70%, transparent 100%)`
                  : 'linear-gradient(to top, rgba(30,58,138,1) 0%, rgba(30,58,138,0.85) 40%, rgba(30,58,138,0.6) 70%, transparent 100%)'
              }}
            />
          </div>
        ) : (
          <div 
            className="absolute inset-0 transition-colors duration-500"
            style={{
              background: dominantColor 
                ? `linear-gradient(135deg, ${dominantColor} 0%, ${dominantColor}dd 100%)`
                : 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
            }}
          />
        )}
        
        {/* Content */}
        <div className="relative z-10 fluid-p-6">
          {/* Header con título y botón editar */}
          <div className="flex justify-between items-start fluid-mb-6">
            <div>
              <div className="flex items-center fluid-gap-3 fluid-mb-2">
                <h2 className="fluid-text-3xl font-bold text-white drop-shadow-lg">{exam.name}</h2>
                <span className={`fluid-px-4 fluid-py-1.5 rounded-full fluid-text-sm font-bold flex items-center fluid-gap-2 shadow-lg ${
                  exam.is_published 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-amber-500 text-white'
                }`}>
                  {exam.is_published ? (
                    <svg className="fluid-icon-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="fluid-icon-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  )}
                  {exam.is_published ? 'Publicado' : 'Borrador'}
                </span>
              </div>
              <div className="flex items-center fluid-gap-4 flex-wrap">
                <p className="fluid-text-xl font-mono font-semibold text-white/80">{exam.version}</p>
                {exam.competency_standard?.code && (
                  <span className="fluid-px-3 fluid-py-1 bg-white/20 rounded-fluid-lg fluid-text-sm font-mono text-white/90  border border-white/10">
                    ECM: {exam.competency_standard.code}
                  </span>
                )}
                {exam.pause_on_disconnect && (
                  <span className="fluid-px-3 fluid-py-1 bg-blue-500/30 rounded-fluid-lg fluid-text-xs font-medium text-white/90  flex items-center fluid-gap-1">
                    <svg className="fluid-icon-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pausa al desconectar
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={openEditExamModal}
              disabled={exam.is_published}
              className={`fluid-px-5 fluid-py-2.5 rounded-fluid-xl font-semibold flex items-center fluid-gap-2 transition-all duration-200 ${
                exam.is_published
                  ? 'bg-white/20 text-white/50 cursor-not-allowed border border-white/20'
                  : 'bg-white/40 text-white hover:bg-white/50 border border-white/30 hover:border-white/50 hover:-translate-y-0.5 shadow-md hover:shadow-lg '
              }`}
              title={exam.is_published ? 'Cambie a borrador para editar' : 'Editar información del examen'}
            >
              <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modificar
            </button>
          </div>
          
          {/* Estadísticas superpuestas sobre la imagen */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fluid-gap-4">
            <div className="bg-white/20  rounded-fluid-xl fluid-p-4 text-center border border-white/10 hover:bg-white/30 hover:scale-105 transition-all duration-300 group cursor-default">
              <div className="flex items-center justify-center fluid-mb-2">
                <svg className="fluid-icon-base text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="fluid-text-2xl font-bold text-white">{exam.duration_minutes || 0}</p>
              <p className="fluid-text-sm text-white/70 font-medium">Minutos</p>
            </div>
            <div className="bg-white/20  rounded-fluid-xl fluid-p-4 text-center border border-white/10 hover:bg-white/30 hover:scale-105 transition-all duration-300 group cursor-default">
              <div className="flex items-center justify-center fluid-mb-2">
                <svg className="fluid-icon-base text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="fluid-text-2xl font-bold text-white">{exam.passing_score}%</p>
              <p className="fluid-text-sm text-white/70 font-medium">Puntaje Mínimo</p>
            </div>
            <div className="bg-white/20  rounded-fluid-xl fluid-p-4 text-center border border-white/10 hover:bg-white/30 hover:scale-105 transition-all duration-300 group cursor-default">
              <div className="flex items-center justify-center fluid-mb-2">
                <svg className="fluid-icon-base text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="fluid-text-2xl font-bold text-white">{exam.total_categories || 0}</p>
              <p className="fluid-text-sm text-white/70 font-medium">Categorías</p>
            </div>
            <div className="bg-white/20  rounded-fluid-xl fluid-p-4 text-center border border-white/10 hover:bg-white/30 hover:scale-105 transition-all duration-300 group cursor-default">
              <div className="flex items-center justify-center fluid-mb-2">
                <svg className="fluid-icon-base text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <p className="fluid-text-2xl font-bold text-white">
                {exam.categories?.reduce((acc, cat) => acc + (cat.total_topics || 0), 0) || 0}
              </p>
              <p className="fluid-text-sm text-white/70 font-medium">Temas</p>
            </div>
            <div className="bg-white/20  rounded-fluid-xl fluid-p-4 text-center border border-white/10 hover:bg-white/30 hover:scale-105 transition-all duration-300 group cursor-default">
              <div className="flex items-center justify-center fluid-mb-2">
                <svg className="fluid-icon-base text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="fluid-text-2xl font-bold text-white">{exam.total_questions}</p>
              <p className="fluid-text-sm text-white/70 font-medium">Preguntas</p>
            </div>
            <div className="bg-white/20  rounded-fluid-xl fluid-p-4 text-center border border-white/10 hover:bg-white/30 hover:scale-105 transition-all duration-300 group cursor-default">
              <div className="flex items-center justify-center fluid-mb-2">
                <svg className="fluid-icon-base text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <p className="fluid-text-2xl font-bold text-white">{exam.total_exercises}</p>
              <p className="fluid-text-sm text-white/70 font-medium">Ejercicios</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de información adicional del examen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-8">
        {/* Código ECM */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-lg hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2 bg-indigo-100 rounded-fluid-lg">
              <svg className="fluid-icon-base text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <span className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide">Código ECM</span>
          </div>
          <p className="fluid-text-lg font-mono font-bold text-gray-900">{exam.competency_standard?.code || 'No asignado'}</p>
        </div>

        {/* Pausa al desconectar */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className={`fluid-p-2 rounded-fluid-lg ${exam.pause_on_disconnect ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <svg className={`fluid-icon-base ${exam.pause_on_disconnect ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide">Pausa al Desconectar</span>
          </div>
          <div className="flex items-center fluid-gap-2">
            <span className={`fluid-px-3 fluid-py-1 rounded-full fluid-text-sm font-semibold ${exam.pause_on_disconnect ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {exam.pause_on_disconnect ? 'Activado' : 'Desactivado'}
            </span>
          </div>
        </div>

        {/* Fecha de creación */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-lg hover:border-green-200 hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2 bg-green-100 rounded-fluid-lg">
              <svg className="fluid-icon-base text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide">Creado</span>
          </div>
          <p className="fluid-text-base font-medium text-gray-900">
            {exam.created_at ? new Date(exam.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No disponible'}
          </p>
        </div>

        {/* Última actualización */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 hover:shadow-lg hover:border-purple-200 hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center fluid-gap-3 fluid-mb-3">
            <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
              <svg className="fluid-icon-base text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <span className="fluid-text-sm font-semibold text-gray-600 uppercase tracking-wide">Actualizado</span>
          </div>
          <p className="fluid-text-base font-medium text-gray-900">
            {exam.updated_at ? new Date(exam.updated_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No disponible'}
          </p>
        </div>
      </div>

      {/* Configuración de Asignación por Defecto */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 fluid-mb-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
        <div className="flex items-center justify-between fluid-mb-5">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2.5 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-fluid-xl">
              <svg className="fluid-icon-base text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="fluid-text-lg font-bold text-gray-900">Configuración de Asignación</h3>
              <p className="fluid-text-xs text-gray-500">Se hereda al asignar este examen a grupos</p>
            </div>
          </div>
          <button
            onClick={() => showAssignConfigEditor ? setShowAssignConfigEditor(false) : openAssignConfigEditor()}
            className="fluid-px-4 fluid-py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-fluid-lg font-medium fluid-text-sm transition-colors flex items-center fluid-gap-2"
          >
            <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {showAssignConfigEditor ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {!showAssignConfigEditor ? (
          /* Vista de solo lectura */
          <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4">
            <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
              <p className="fluid-text-2xl font-bold text-gray-800">{exam.default_max_attempts ?? 2}</p>
              <p className="fluid-text-xs text-gray-500 font-medium fluid-mt-1">Reintentos</p>
            </div>
            <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
              <p className="fluid-text-2xl font-bold text-gray-800">{exam.default_max_disconnections ?? 3}</p>
              <p className="fluid-text-xs text-gray-500 font-medium fluid-mt-1">Desconexiones</p>
            </div>
            <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
              <p className="fluid-text-base font-bold text-gray-800 capitalize">
                {(exam.default_exam_content_type || 'mixed') === 'mixed' ? 'Mixto' : 
                 (exam.default_exam_content_type || 'mixed') === 'questions_only' ? 'Solo Preguntas' : 'Solo Ejercicios'}
              </p>
              <p className="fluid-text-xs text-gray-500 font-medium fluid-mt-1">Tipo Contenido</p>
            </div>
            <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
              <p className="fluid-text-base font-bold text-gray-800">
                {exam.linked_material_ids?.length || 0}
              </p>
              <p className="fluid-text-xs text-gray-500 font-medium fluid-mt-1">Materiales Ligados</p>
            </div>
          </div>
        ) : (
          /* Vista de edición */
          <div className="fluid-space-y-5 border-t border-gray-100 fluid-pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
              {/* Reintentos */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Reintentos Permitidos</label>
                <input type="number" min={1} max={10} value={assignMaxAttempts}
                  onChange={e => setAssignMaxAttempts(parseInt(e.target.value) || 1)}
                  className="w-full fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm" />
              </div>
              {/* Desconexiones */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Oportunidades de Desconexión</label>
                <input type="number" min={0} max={10} value={assignMaxDisconnections}
                  onChange={e => setAssignMaxDisconnections(parseInt(e.target.value) || 0)}
                  className="w-full fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm" />
              </div>
            </div>

            {/* Tipo de contenido */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Tipo de Contenido</label>
              <div className="grid grid-cols-3 fluid-gap-3">
                {[
                  { value: 'mixed', label: 'Mixto', desc: 'Preguntas + Ejercicios' },
                  { value: 'questions_only', label: 'Solo Preguntas', desc: 'Únicamente preguntas' },
                  { value: 'exercises_only', label: 'Solo Ejercicios', desc: 'Únicamente ejercicios' },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setAssignContentType(opt.value)}
                    className={`fluid-p-3 rounded-fluid-lg border-2 text-left transition-all ${
                      assignContentType === opt.value 
                        ? 'border-blue-500 bg-blue-50 text-blue-800' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}>
                    <p className="font-semibold fluid-text-sm">{opt.label}</p>
                    <p className="fluid-text-xs text-gray-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cantidades personalizadas - Examen */}
            {assignContentType !== 'exercises_only' && (
              <div className="bg-blue-50 rounded-fluid-xl fluid-p-4 border border-blue-100">
                <p className="fluid-text-sm font-semibold text-blue-800 fluid-mb-3">Cantidades — Examen</p>
                <div className="grid grid-cols-2 fluid-gap-4">
                  {(assignContentType === 'mixed' || assignContentType === 'questions_only') && (
                    <div>
                      <label className="flex items-center fluid-gap-2 fluid-mb-2">
                        <input type="checkbox" checked={assignExamQuestionsCount === null}
                          onChange={e => setAssignExamQuestionsCount(e.target.checked ? null : (exam.exam_questions_count || 0))}
                          className="rounded border-gray-300 text-blue-600" />
                        <span className="fluid-text-sm text-gray-700">Usar todas las preguntas</span>
                      </label>
                      {assignExamQuestionsCount !== null && (
                        <input type="number" min={1} max={exam.exam_questions_count || 999} value={assignExamQuestionsCount}
                          onChange={e => setAssignExamQuestionsCount(parseInt(e.target.value) || 1)}
                          className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                          placeholder={`Máx: ${exam.exam_questions_count || 0}`} />
                      )}
                    </div>
                  )}
                  {(assignContentType === 'mixed' || assignContentType === 'exercises_only') && (
                    <div>
                      <label className="flex items-center fluid-gap-2 fluid-mb-2">
                        <input type="checkbox" checked={assignExamExercisesCount === null}
                          onChange={e => setAssignExamExercisesCount(e.target.checked ? null : (exam.exam_exercises_count || 0))}
                          className="rounded border-gray-300 text-blue-600" />
                        <span className="fluid-text-sm text-gray-700">Usar todos los ejercicios</span>
                      </label>
                      {assignExamExercisesCount !== null && (
                        <input type="number" min={1} max={exam.exam_exercises_count || 999} value={assignExamExercisesCount}
                          onChange={e => setAssignExamExercisesCount(parseInt(e.target.value) || 1)}
                          className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                          placeholder={`Máx: ${exam.exam_exercises_count || 0}`} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cantidades personalizadas - Simulador */}
            {assignContentType !== 'exercises_only' && (
              <div className="bg-purple-50 rounded-fluid-xl fluid-p-4 border border-purple-100">
                <p className="fluid-text-sm font-semibold text-purple-800 fluid-mb-3">Cantidades — Simulador</p>
                <div className="grid grid-cols-2 fluid-gap-4">
                  <div>
                    <label className="flex items-center fluid-gap-2 fluid-mb-2">
                      <input type="checkbox" checked={assignSimulatorQuestionsCount === null}
                        onChange={e => setAssignSimulatorQuestionsCount(e.target.checked ? null : (exam.simulator_questions_count || 0))}
                        className="rounded border-gray-300 text-purple-600" />
                      <span className="fluid-text-sm text-gray-700">Usar todas las preguntas</span>
                    </label>
                    {assignSimulatorQuestionsCount !== null && (
                      <input type="number" min={1} max={exam.simulator_questions_count || 999} value={assignSimulatorQuestionsCount}
                        onChange={e => setAssignSimulatorQuestionsCount(parseInt(e.target.value) || 1)}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                        placeholder={`Máx: ${exam.simulator_questions_count || 0}`} />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center fluid-gap-2 fluid-mb-2">
                      <input type="checkbox" checked={assignSimulatorExercisesCount === null}
                        onChange={e => setAssignSimulatorExercisesCount(e.target.checked ? null : (exam.simulator_exercises_count || 0))}
                        className="rounded border-gray-300 text-purple-600" />
                      <span className="fluid-text-sm text-gray-700">Usar todos los ejercicios</span>
                    </label>
                    {assignSimulatorExercisesCount !== null && (
                      <input type="number" min={1} max={exam.simulator_exercises_count || 999} value={assignSimulatorExercisesCount}
                        onChange={e => setAssignSimulatorExercisesCount(parseInt(e.target.value) || 1)}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                        placeholder={`Máx: ${exam.simulator_exercises_count || 0}`} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Botón guardar */}
            <div className="flex justify-end fluid-gap-3">
              <button type="button" onClick={() => setShowAssignConfigEditor(false)}
                className="fluid-px-5 fluid-py-2.5 text-gray-600 hover:text-gray-900 font-medium fluid-text-sm transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveAssignConfig} disabled={savingAssignConfig}
                className="fluid-px-6 fluid-py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-fluid-xl font-semibold fluid-text-sm transition-colors flex items-center fluid-gap-2">
                {savingAssignConfig ? (
                  <><div className="animate-spin fluid-icon-sm border-2 border-white border-t-transparent rounded-full" /> Guardando...</>
                ) : (
                  <><svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Guardar Configuración</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Advertencia de contenido publicado */}
      {exam.is_published && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-4 fluid-mb-6 animate-fade-in-up">
          <div className="fluid-p-3 bg-amber-100 rounded-fluid-xl">
            <svg className="fluid-icon-lg text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-amber-800 font-semibold fluid-text-base">Contenido publicado</p>
            <p className="text-amber-700 fluid-text-sm">Para editar el contenido, primero cambia el examen a borrador.</p>
          </div>
        </div>
      )}

      {/* Categorías del Examen */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 fluid-mb-8">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center fluid-gap-4 fluid-mb-6">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-blue-100 rounded-fluid-xl">
              <svg className="fluid-icon-lg text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="fluid-text-xl font-bold text-gray-900">Categorías del Examen</h2>
              <p className="fluid-text-sm text-gray-500">{exam.categories?.length || 0} categoría{exam.categories?.length !== 1 ? 's' : ''} configurada{exam.categories?.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {/* Botón Agregar Categoría - solo en modo borrador */}
          <button
            onClick={() => setShowCreateCategoryModal(true)}
            disabled={exam.is_published}
            className={`fluid-px-5 fluid-py-2.5 rounded-fluid-xl font-semibold flex items-center fluid-gap-2 transition-all duration-200 ${
              exam.is_published
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5'
            }`}
            title={exam.is_published ? 'Cambie a borrador para agregar categorías' : 'Agregar categoría'}
          >
            <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar Categoría
          </button>
        </div>

        {exam.categories && exam.categories.length > 0 ? (
          <div className="overflow-x-auto animate-fadeSlideIn">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Porcentaje
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temas
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preguntas
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ejercicios
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exam.categories.map((category, index) => (
                  <tr 
                    key={category.id} 
                    className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200 cursor-pointer group"
                    onClick={() => {
                      if (exam.is_published) {
                        setToast({ message: 'Cambie el examen a borrador para editar las categorías', type: 'error' })
                      } else {
                        navigate(`/exams/${id}/categories/${category.id}`)
                      }
                    }}
                  >
                    <td className="fluid-px-4 fluid-py-4 whitespace-nowrap">
                      <span className="inline-flex items-center justify-center fluid-icon-lg rounded-fluid-lg bg-blue-100 text-blue-700 font-bold fluid-text-sm shadow-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-4">
                      <div className="fluid-text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{category.name}</div>
                      {category.description && (
                        <div className="fluid-text-sm text-gray-500 fluid-mt-1">{category.description}</div>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-4 whitespace-nowrap">
                      <span className="inline-flex items-center fluid-px-3 py-1.5 rounded-fluid-lg fluid-text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {category.percentage}%
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center fluid-px-3 py-1.5 rounded-fluid-lg fluid-text-xs font-semibold bg-green-100 text-green-700">
                        {category.total_topics || 0}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center fluid-px-3 py-1.5 rounded-fluid-lg fluid-text-xs font-semibold bg-blue-100 text-blue-700">
                        {category.total_questions || 0}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center fluid-px-3 py-1.5 rounded-fluid-lg fluid-text-xs font-semibold bg-violet-100 text-violet-700">
                        {category.total_exercises || 0}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-4 whitespace-nowrap fluid-text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center fluid-gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!exam.is_published) {
                              openEditCategoryModal(category)
                            }
                          }}
                          disabled={exam.is_published}
                          className={`fluid-p-2 rounded-fluid-lg transition-colors ${
                            exam.is_published
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                          }`}
                          title={exam.is_published ? 'Cambie a borrador para editar' : 'Editar categoría'}
                        >
                          <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          className={`fluid-p-2 rounded-fluid-lg transition-colors ${
                            exam.is_published
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                          }`}
                          title={exam.is_published ? 'Cambie a borrador para eliminar' : 'Eliminar categoría'}
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
        ) : (
          <div className="text-center fluid-py-8 text-gray-500">
            <p className="fluid-mb-4">No hay categorías registradas para este examen</p>
            {!exam.is_published && (
              <button
                onClick={() => setShowCreateCategoryModal(true)}
                className="fluid-px-4 fluid-py-2 bg-primary-600 text-white rounded-fluid-lg hover:bg-primary-700 transition-colors font-medium inline-flex items-center fluid-gap-2"
              >
                <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-w-10 fluid-h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">
                  Eliminar Examen
                </h3>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <p className="text-gray-700 fluid-mb-4">
                ¿Estás seguro de que deseas eliminar el examen <strong className="text-gray-900">"{exam.name}"</strong>?
              </p>
            
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="fluid-icon-sm text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="fluid-ml-3">
                    <p className="fluid-text-sm text-red-800 font-semibold">
                      Esta acción no se puede deshacer. Se eliminarán permanentemente:
                    </p>
                    <ul className="list-disc list-inside fluid-text-sm text-red-700 fluid-mt-2 flex flex-col fluid-gap-1">
                      <li>Todas las categorías del examen ({exam.categories?.length || 0})</li>
                      <li>Todos los temas, preguntas y ejercicios</li>
                      <li>Toda la información asociada al examen</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleDeleteExam}>
                <div className="fluid-mb-4">
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Para confirmar, ingresa tu contraseña:
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setDeleteError('')
                    }}
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                    placeholder="Tu contraseña"
                    required
                    autoFocus
                  />
                  {deleteError && (
                    <p className="fluid-mt-2 fluid-text-sm text-red-600">{deleteError}</p>
                  )}
                </div>

                <div className="flex fluid-gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setPassword('')
                      setDeleteError('')
                    }}
                    className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                    disabled={deleteExamMutation.isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="fluid-px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deleteExamMutation.isPending}
                  >
                    {deleteExamMutation.isPending ? 'Eliminando...' : 'Sí, eliminar examen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validación y Publicación */}
      {showPublishModal && validationResult && (
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowPublishModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className={`fluid-px-6 fluid-py-4 ${validationResult.is_valid ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-w-10 fluid-h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  {validationResult.is_valid ? (
                    <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="fluid-text-xl font-bold text-white">
                    {validationResult.is_valid ? 'Examen listo para publicar' : 'El examen tiene errores'}
                  </h3>
                  <p className={`fluid-text-sm fluid-mt-1 ${validationResult.is_valid ? 'text-green-100' : 'text-red-100'}`}>
                    {validationResult.is_valid 
                      ? 'Todas las validaciones han pasado correctamente'
                      : 'Corrige los siguientes errores antes de publicar'
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-80px)]">

              {/* Resumen */}
              <div className="grid grid-cols-4 fluid-gap-3 fluid-mb-6 bg-gray-50 fluid-p-4 rounded-fluid-lg">
                <div className="text-center">
                  <p className="fluid-text-2xl font-bold text-primary-600">{validationResult.summary.total_categories}</p>
                  <p className="fluid-text-xs text-gray-600">Categorías</p>
                </div>
                <div className="text-center">
                  <p className="fluid-text-2xl font-bold text-primary-600">{validationResult.summary.total_topics}</p>
                  <p className="fluid-text-xs text-gray-600">Temas</p>
                </div>
                <div className="text-center">
                  <p className="fluid-text-2xl font-bold text-primary-600">{validationResult.summary.total_questions}</p>
                  <p className="fluid-text-xs text-gray-600">Preguntas</p>
                </div>
                <div className="text-center">
                  <p className="fluid-text-2xl font-bold text-primary-600">{validationResult.summary.total_exercises}</p>
                  <p className="fluid-text-xs text-gray-600">Ejercicios</p>
                </div>
              </div>

              {/* Errores */}
              {validationResult.errors.length > 0 && (
                <div className="fluid-mb-6">
                  <h4 className="fluid-text-sm font-semibold text-red-800 fluid-mb-3 flex items-center">
                    <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Errores ({validationResult.errors.length})
                  </h4>
                  <div className="flex flex-col fluid-gap-3">
                    {validationResult.errors.map((error, index) => (
                      <div key={index} className="bg-red-50 border-l-4 border-red-500 fluid-p-3 rounded-r">
                        <p className="fluid-text-sm font-medium text-red-800">{error.message}</p>
                        <p className="fluid-text-xs text-red-600 fluid-mt-1">{error.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advertencias */}
              {validationResult.warnings.length > 0 && (
                <div className="fluid-mb-6">
                  <h4 className="fluid-text-sm font-semibold text-yellow-800 fluid-mb-3 flex items-center">
                    <svg className="fluid-icon-sm fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Advertencias ({validationResult.warnings.length})
                  </h4>
                  <div className="flex flex-col fluid-gap-3">
                    {validationResult.warnings.map((warning, index) => (
                      <div key={index} className="bg-yellow-50 border-l-4 border-yellow-500 fluid-p-3 rounded-r">
                        <p className="fluid-text-sm font-medium text-yellow-800">{warning.message}</p>
                        <p className="fluid-text-xs text-yellow-600 fluid-mt-1">{warning.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensaje de éxito */}
              {validationResult.is_valid && validationResult.warnings.length === 0 && (
                <div className="bg-green-50 border-l-4 border-green-500 fluid-p-4 fluid-mb-6 rounded-r">
                  <div className="flex items-center">
                    <svg className="fluid-icon-sm text-green-600 fluid-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="fluid-text-sm font-medium text-green-800">
                      El examen está completo y listo para ser publicado
                    </p>
                  </div>
                </div>
              )}

              <div className="flex fluid-gap-3 justify-end fluid-pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishModal(false)
                    setValidationResult(null)
                  }}
                  className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  {validationResult.is_valid ? 'Cancelar' : 'Cerrar'}
                </button>
                {validationResult.is_valid && (
                  <button
                    onClick={handlePublish}
                    disabled={publishExamMutation.isPending}
                    className="fluid-px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center fluid-gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Modal de Conflicto ECM */}
      {showEcmConflictModal && ecmConflictData && (
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowEcmConflictModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-w-10 fluid-h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon-lg text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="fluid-text-xl font-bold text-white">Conflicto de Código ECM</h3>
                  <p className="text-amber-100 fluid-text-sm fluid-mt-1">
                    Ya existe un examen publicado con este código
                  </p>
                </div>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <div className="bg-amber-50 border-l-4 border-amber-500 fluid-p-4 rounded-r fluid-mb-6">
                <p className="fluid-text-sm text-amber-800">
                  El código ECM <span className="font-bold">{ecmConflictData.current_exam?.ecm_code}</span> ya está 
                  asignado a otro examen publicado. Solo puede haber un examen publicado por código ECM.
                </p>
              </div>
              
              <div className="flex flex-col fluid-gap-4">
                {/* Examen actual (el que se quiere publicar) */}
                <div className="border-2 border-primary-200 bg-primary-50 rounded-fluid-xl fluid-p-4">
                  <div className="flex items-center justify-between fluid-mb-2">
                    <span className="fluid-text-xs font-medium text-primary-600 uppercase tracking-wider">Este examen</span>
                    <span className="fluid-text-xs bg-gray-200 text-gray-600 fluid-px-2 py-0.5 rounded-full">Borrador</span>
                  </div>
                  <p className="font-semibold text-gray-900">{ecmConflictData.current_exam?.name}</p>
                  <p className="fluid-text-sm text-gray-600">Versión: {ecmConflictData.current_exam?.version}</p>
                </div>
                
                {/* Examen conflictivo (ya publicado) */}
                <div className="border-2 border-gray-200 bg-white rounded-fluid-xl fluid-p-4">
                  <div className="flex items-center justify-between fluid-mb-2">
                    <span className="fluid-text-xs font-medium text-gray-500 uppercase tracking-wider">Examen existente</span>
                    <span className="fluid-text-xs bg-green-100 text-green-700 fluid-px-2 py-0.5 rounded-full">Publicado</span>
                  </div>
                  <p className="font-semibold text-gray-900">{ecmConflictData.conflicting_exam?.name}</p>
                  <p className="fluid-text-sm text-gray-600">Versión: {ecmConflictData.conflicting_exam?.version}</p>
                </div>
              </div>
              
              <p className="fluid-text-sm text-gray-600 fluid-mt-6 fluid-mb-4">
                ¿Cuál examen desea mantener publicado?
              </p>
              
              <div className="flex flex-col fluid-gap-3">
                <button
                  onClick={handlePublishAndReplaceConflicting}
                  disabled={publishExamMutation.isPending}
                  className="w-full fluid-px-5 fluid-py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-fluid-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center fluid-gap-2 disabled:opacity-50"
                >
                  <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {publishExamMutation.isPending ? 'Publicando...' : 'Publicar este y despublicar el existente'}
                </button>
                
                <button
                  onClick={handleKeepConflictingPublished}
                  className="w-full fluid-px-5 fluid-py-3 bg-gray-100 text-gray-700 rounded-fluid-xl font-medium hover:bg-gray-200 transition-all duration-200 flex items-center justify-center fluid-gap-2"
                >
                  <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Mantener el existente publicado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Categoría */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowCreateCategoryModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Nueva Categoría</h3>
              <p className="text-primary-100 fluid-text-sm fluid-mt-1">Añade una nueva categoría al examen</p>
            </div>
            
            <form onSubmit={handleCreateCategory} className="fluid-p-6">
              <div className="flex flex-col fluid-gap-4">
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
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
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
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
                  <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                    Peso de esta categoría en la calificación final (1-100%)
                  </p>
                </div>
                
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
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
              
              <div className="flex justify-end fluid-gap-3 fluid-mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCategoryModal(false)
                    setNewCategoryName('')
                    setNewCategoryPercentage('')
                    setNewCategoryDescription('')
                  }}
                  className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending || !newCategoryName.trim() || !newCategoryPercentage}
                  className="fluid-px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:from-primary-600 hover:to-primary-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowEditCategoryModal(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Editar Categoría</h3>
              <p className="text-blue-100 fluid-text-sm fluid-mt-1">Modifica la información de la categoría</p>
            </div>
            
            <form onSubmit={handleEditCategory} className="fluid-p-6">
              <div className="flex flex-col fluid-gap-4">
                <div>
                  <label htmlFor="editCategoryName" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    id="editCategoryName"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Seguridad Vial"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="editCategoryPercentage" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Porcentaje *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="editCategoryPercentage"
                      value={editCategoryPercentage}
                      onChange={(e) => setEditCategoryPercentage(e.target.value)}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: 25"
                      min="0"
                      max="100"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="editCategoryDescription" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    id="editCategoryDescription"
                    value={editCategoryDescription}
                    onChange={(e) => setEditCategoryDescription(e.target.value)}
                    className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Breve descripción de la categoría..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end fluid-gap-3 fluid-mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCategoryModal(null)
                    setEditCategoryName('')
                    setEditCategoryPercentage('')
                    setEditCategoryDescription('')
                  }}
                  className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateCategoryMutation.isPending || !editCategoryName.trim() || !editCategoryPercentage}
                  className="fluid-px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowDeleteCategoryModal(null)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-w-10 fluid-h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">Eliminar Categoría</h3>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <p className="text-gray-700 fluid-mb-4">
                ¿Estás seguro de que deseas eliminar esta categoría?
              </p>
            
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="fluid-icon-sm text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="fluid-ml-3">
                    <p className="fluid-text-sm text-red-800 font-semibold">
                      Esta acción no se puede deshacer. Se eliminarán:
                    </p>
                    <ul className="list-disc list-inside fluid-text-sm text-red-700 fluid-mt-2 flex flex-col fluid-gap-1">
                      <li>Todos los temas de esta categoría</li>
                      <li>Todas las preguntas y ejercicios asociados</li>
                    </ul>
                  </div>
                </div>
              </div>
            
              <div className="flex justify-end fluid-gap-3">
                <button
                  onClick={() => setShowDeleteCategoryModal(null)}
                  className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteCategory(showDeleteCategoryModal)}
                  disabled={deleteCategoryMutation.isPending}
                  className="fluid-px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-rose-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteCategoryMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Examen */}
      {showEditExamModal && (
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => { setShowEditExamModal(false); setEditExamImagePreview(exam.image_url || null); }}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 fluid-px-6 fluid-py-4">
              <h3 className="fluid-text-xl font-bold text-white">Modificar Examen</h3>
              <p className="text-blue-100 fluid-text-sm fluid-mt-1">Actualiza la información del examen</p>
            </div>
            
            <form onSubmit={handleEditExam} className="fluid-p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="flex flex-col fluid-gap-4">
                {/* Imagen del Examen - Ancho completo */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Imagen de Identidad Gráfica
                  </label>
                  {editExamImagePreview ? (
                    <div className="relative">
                      <img 
                        src={editExamImagePreview} 
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-fluid-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-red-600 text-white fluid-p-2 rounded-full hover:bg-red-700 shadow-lg"
                        title="Eliminar imagen"
                      >
                        <svg className="fluid-icon-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded-fluid-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="fluid-icon-xl text-gray-400 fluid-mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="fluid-mb-2 fluid-text-sm text-gray-500">
                          <span className="font-semibold">Clic para subir</span> o arrastra y suelta
                        </p>
                        <p className="fluid-text-xs text-gray-500">PNG, JPG o GIF. Máximo 2MB.</p>
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
                  <label htmlFor="editExamName" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Nombre del Examen *
                  </label>
                  <input
                    type="text"
                    id="editExamName"
                    value={editExamName}
                    onChange={(e) => setEditExamName(e.target.value)}
                    className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Evaluación de Conocimientos de Seguridad"
                    required
                  />
                </div>
                
                {/* Código ECM */}
                <div>
                  <label htmlFor="editExamVersion" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Código ECM *
                  </label>
                  <input
                    type="text"
                    id="editExamVersion"
                    value={editExamVersion}
                    onChange={(e) => setEditExamVersion(e.target.value)}
                    className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    placeholder="Ej: ECM-001"
                    required
                  />
                </div>
                
                {/* Duración y Puntaje Mínimo en grid */}
                <div className="grid grid-cols-2 fluid-gap-4">
                  <div>
                    <label htmlFor="editExamDuration" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      id="editExamDuration"
                      value={editExamDuration}
                      onChange={(e) => setEditExamDuration(e.target.value)}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: 60"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="editExamPassingScore" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Puntaje Mínimo (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="editExamPassingScore"
                        value={editExamPassingScore}
                        onChange={(e) => setEditExamPassingScore(e.target.value)}
                        className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ej: 70"
                        min="0"
                        max="100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>
                </div>

                {/* Configuración de temporizador al desconectarse */}
                <div className="bg-blue-50 rounded-fluid-lg fluid-p-4 border border-blue-100">
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Comportamiento del temporizador al perder conexión
                  </label>
                  <div className="flex flex-col fluid-gap-2">
                    <label className="flex items-center fluid-gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="pauseOnDisconnect"
                        checked={editExamPauseOnDisconnect === true}
                        onChange={() => setEditExamPauseOnDisconnect(true)}
                        className="fluid-icon-sm text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="fluid-text-sm font-medium text-gray-800">Pausar tiempo</span>
                        <p className="fluid-text-xs text-gray-500">El tiempo se detiene si el alumno pierde conexión o cierra el navegador</p>
                      </div>
                    </label>
                    <label className="flex items-center fluid-gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="pauseOnDisconnect"
                        checked={editExamPauseOnDisconnect === false}
                        onChange={() => setEditExamPauseOnDisconnect(false)}
                        className="fluid-icon-sm text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="fluid-text-sm font-medium text-gray-800">Tiempo continúa</span>
                        <p className="fluid-text-xs text-gray-500">El tiempo sigue corriendo aunque el alumno se desconecte</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Estadísticas del examen (solo lectura) */}
                <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-3">
                    Contenido del Examen
                  </label>
                  <div className="grid grid-cols-4 fluid-gap-3 text-center">
                    <div className="bg-white rounded-fluid-lg fluid-p-2 border border-gray-200">
                      <div className="fluid-text-lg font-bold text-primary-600">{exam?.total_categories || 0}</div>
                      <div className="fluid-text-xs text-gray-500">Categorías</div>
                    </div>
                    <div className="bg-white rounded-fluid-lg fluid-p-2 border border-gray-200">
                      <div className="fluid-text-lg font-bold text-blue-600">
                        {exam?.categories?.reduce((acc, cat) => acc + (cat.total_topics || 0), 0) || 0}
                      </div>
                      <div className="fluid-text-xs text-gray-500">Temas</div>
                    </div>
                    <div className="bg-white rounded-fluid-lg fluid-p-2 border border-gray-200">
                      <div className="fluid-text-lg font-bold text-green-600">{exam?.total_questions || 0}</div>
                      <div className="fluid-text-xs text-gray-500">Preguntas</div>
                    </div>
                    <div className="bg-white rounded-fluid-lg fluid-p-2 border border-gray-200">
                      <div className="fluid-text-lg font-bold text-purple-600">{exam?.total_exercises || 0}</div>
                      <div className="fluid-text-xs text-gray-500">Ejercicios</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end fluid-gap-3 fluid-mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditExamModal(false)
                    setEditExamImagePreview(null)
                  }}
                  className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateExamMutation.isPending || !editExamName.trim() || !editExamVersion.trim()}
                  className="fluid-px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-fluid-xl font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 fluid-p-4" onClick={() => setShowPercentageWarningModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeSlideIn" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 fluid-px-6 fluid-py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 fluid-w-10 fluid-h-10 rounded-fluid-xl bg-white/20 flex items-center justify-center fluid-mr-3">
                  <svg className="fluid-icon-sm text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="fluid-text-xl font-bold text-white">Ajustar Porcentajes</h3>
              </div>
            </div>
            
            <div className="fluid-p-6">
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="fluid-icon-sm text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="fluid-ml-3">
                    <p className="fluid-text-sm text-amber-800 font-semibold">
                      La suma de los porcentajes debe ser exactamente 100%
                    </p>
                    <p className="fluid-text-sm text-amber-700 fluid-mt-1">
                      Suma actual: <span className={`font-bold ${getCurrentAdjustmentSum() === 100 ? 'text-green-600' : 'text-red-600'}`}>{getCurrentAdjustmentSum()}%</span>
                      {getCurrentAdjustmentSum() !== 100 && (
                        <span className="fluid-ml-2">
                          ({getCurrentAdjustmentSum() > 100 ? `Excede por ${getCurrentAdjustmentSum() - 100}%` : `Faltan ${100 - getCurrentAdjustmentSum()}%`})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Botón para distribuir equitativamente */}
              <div className="fluid-mb-4">
                <button
                  type="button"
                  onClick={() => {
                    const categories = exam?.categories || []
                    if (categories.length === 0) return
                    
                    const equalPercentage = Math.floor(100 / categories.length)
                    const remainder = 100 - (equalPercentage * categories.length)
                    
                    const newAdjustments: { [key: number]: string } = {}
                    categories.forEach((cat: any, index: number) => {
                      // Dar el residuo a la primera categoría
                      const percentage = index === 0 ? equalPercentage + remainder : equalPercentage
                      newAdjustments[cat.id] = percentage.toString()
                    })
                    
                    setPercentageAdjustments(newAdjustments)
                  }}
                  className="w-full fluid-px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-fluid-xl hover:bg-blue-100 transition-all duration-200 font-medium flex items-center justify-center fluid-gap-2"
                >
                  <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Distribuir Equitativamente
                </button>
              </div>

              <div className="flex flex-col fluid-gap-3 max-h-60 overflow-y-auto">
                {exam?.categories?.map((category: any) => (
                  <div key={category.id} className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-xl">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{category.name}</p>
                    </div>
                    <div className="flex items-center fluid-gap-2">
                      <input
                        type="number"
                        value={percentageAdjustments[category.id] || '0'}
                        onChange={(e) => setPercentageAdjustments({
                          ...percentageAdjustments,
                          [category.id]: e.target.value
                        })}
                        className="w-20 fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center transition-all duration-200"
                        min="0"
                        max="100"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end fluid-gap-3 fluid-mt-6">
                <button
                  onClick={() => {
                    setShowPercentageWarningModal(false)
                    setPercentageAdjustments({})
                  }}
                  className="fluid-px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-fluid-xl font-medium transition-all duration-200"
                >
                  Corregir Después
                </button>
                <button
                  onClick={handleSavePercentageAdjustments}
                  disabled={getCurrentAdjustmentSum() !== 100}
                  className={`fluid-px-5 py-2.5 rounded-fluid-xl font-medium transition-all duration-200 ${
                    getCurrentAdjustmentSum() === 100 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:from-green-600 hover:to-emerald-700' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuración de Prueba */}
      {showTestModal && (
        <ExamTestConfigModal
          examTitle={exam.name}
          totalQuestions={testQuestionCount}
          totalExercises={testExerciseCount}
          onClose={() => setShowTestModal(false)}
          onStart={handleStartTest}
        />
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
