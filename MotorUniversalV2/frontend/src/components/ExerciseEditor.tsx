import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { examService } from '../services/examService'
import type { Exercise, ExerciseStep, ExerciseAction } from '../types'
import LoadingSpinner from './LoadingSpinner'

interface ExerciseEditorProps {
  exercise: Exercise
  onClose: () => void
}

type Tool = 'select' | 'button' | 'button-wrong' | 'textbox'

interface DragState {
  isDragging: boolean
  actionId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

interface ResizeState {
  isResizing: boolean
  actionId: string | null
  corner: 'se' | 'sw' | 'ne' | 'nw' | null
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}

// Estado para crear área con arrastre (rubber band selection)
interface DrawingState {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

// Constantes de configuración del editor
const EDITOR_CONFIG = {
  ZOOM_LEVELS: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3],
  DEFAULT_ZOOM: 1
}

const ExerciseEditor = ({ exercise, onClose }: ExerciseEditorProps) => {
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Estados principales
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [selectedAction, setSelectedAction] = useState<ExerciseAction | null>(null)
  
  // Estado para previsualización local de imagen mientras se guarda
  const [localPreviewImage, setLocalPreviewImage] = useState<string | null>(null)
  const [isCreatingStep, setIsCreatingStep] = useState(false)
  
  // Estado para cambios pendientes (sin guardar)
  const [pendingChanges, setPendingChanges] = useState<any[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Estado para mostrar/ocultar descripción del ejercicio
  const [showExerciseDescription, setShowExerciseDescription] = useState(false)
  
  // Estados para drag & resize
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    actionId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  })
  
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    actionId: null,
    corner: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0
  })

  // Estado para dibujar área con arrastre (rubber band)
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  })

  // Zoom para la vista del canvas
  const [zoom, setZoom] = useState(EDITOR_CONFIG.DEFAULT_ZOOM)
  
  // Modal para editar acción
  const [isEditActionModalOpen, setIsEditActionModalOpen] = useState(false)
  const [actionFormData, setActionFormData] = useState({
    label: '',
    placeholder: '',
    correct_answer: '',
    scoring_mode: 'exact',
    showPlaceholder: false,
    on_error_action: 'next_step',
    error_message: '',
    max_attempts: 3,
    text_color: '#000000',
    font_family: 'Arial',
    label_style: 'invisible' as 'invisible' | 'text_only' | 'text_with_shadow' | 'shadow_only'
  })

  // Modal de confirmación para eliminar paso
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean
    stepId: string | null
    stepNumber: number | null
    hasImage: boolean
    actionsCount: number
  }>({
    isOpen: false,
    stepId: null,
    stepNumber: null,
    hasImage: false,
    actionsCount: 0
  })

  // Modal de advertencia para validaciones
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean
    title: string
    message: string
  }>({
    isOpen: false,
    title: '',
    message: ''
  })

  // Modal de confirmación para eliminar acción
  const [deleteActionModal, setDeleteActionModal] = useState<{
    isOpen: boolean
    actionId: string | null
    actionType: string | null
    isCorrect: boolean
  }>({
    isOpen: false,
    actionId: null,
    actionType: null,
    isCorrect: false
  })

  // Modal de éxito para operaciones completadas
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean
    title: string
    message: string
  }>({
    isOpen: false,
    title: '',
    message: ''
  })

  // Función para agregar cambio pendiente
  const addPendingChange = (change: any) => {
    setPendingChanges(prev => [...prev, change])
    setHasUnsavedChanges(true)
  }

  // Query para obtener los detalles del ejercicio con steps y actions
  const { data: exerciseData, isLoading, refetch } = useQuery({
    queryKey: ['exercise-details', exercise.id],
    queryFn: () => examService.getExerciseDetails(exercise.id),
  })

  const steps = exerciseData?.exercise?.steps || []
  const currentStep = steps[currentStepIndex] as ExerciseStep | undefined

  // Debug: Log cuando cambian los datos
  console.log('ExerciseEditor - steps:', steps.length, 'currentStep:', currentStep?.id, 'actions:', currentStep?.actions?.length || 0)

  // Mutations
  const createStepMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string; image_url?: string; image_width?: number; image_height?: number }) => 
      examService.createExerciseStep(exercise.id, data),
    onSuccess: async (response) => {
      console.log('Step created:', response)
      // Esperar a que se actualicen los datos
      const result = await refetch()
      console.log('Refetch result:', result.data)
      // Limpiar previsualización local
      setLocalPreviewImage(null)
      setIsCreatingStep(false)
      // Navegar al nuevo paso creado (usar step_number - 1 como índice)
      const newStepNumber = response.step?.step_number
      console.log('New step number:', newStepNumber, 'Steps after refetch:', result.data?.exercise?.steps?.length)
      if (newStepNumber) {
        setCurrentStepIndex(newStepNumber - 1)
      }
    },
    onError: (error) => {
      console.error('Error creating step:', error)
      setLocalPreviewImage(null)
      setIsCreatingStep(false)
    }
  })

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => {
      console.log('Deleting step:', stepId)
      return examService.deleteExerciseStep(stepId)
    },
    onSuccess: (response) => {
      console.log('Step deleted successfully:', response)
      setDeleteConfirmModal({ isOpen: false, stepId: null, stepNumber: null, hasImage: false, actionsCount: 0 })
      refetch()
      if (currentStepIndex >= steps.length - 1 && currentStepIndex > 0) {
        setCurrentStepIndex(currentStepIndex - 1)
      }
    },
    onError: (error) => {
      console.error('Error deleting step:', error)
      setDeleteConfirmModal({ isOpen: false, stepId: null, stepNumber: null, hasImage: false, actionsCount: 0 })
      alert('Error al eliminar el paso. Por favor intente de nuevo.')
    }
  })

  const uploadImageMutation = useMutation({
    mutationFn: ({ stepId, imageData, width, height }: { stepId: string; imageData: string; width: number; height: number }) =>
      examService.uploadStepImage(stepId, imageData, width, height),
    onSuccess: (_response, variables) => {
      addPendingChange({ type: 'upload_image', stepId: variables.stepId })
      refetch()
    },
  })

  const createActionMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: any }) => {
      console.log('Creating action for step:', stepId, 'data:', data)
      return examService.createStepAction(stepId, data)
    },
    onSuccess: (response) => {
      console.log('Action created successfully:', response)
      addPendingChange({ type: 'create_action', stepId: response.action?.step_id, actionId: response.action?.id })
      refetch()
    },
    onError: (error) => {
      console.error('Error creating action:', error)
    }
  })

  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: any }) =>
      examService.updateStepAction(actionId, data),
    onSuccess: (_response, variables) => {
      addPendingChange({ type: 'update_action', actionId: variables.actionId, data: variables.data })
      refetch()
    },
  })

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: string) => examService.deleteStepAction(actionId),
    onSuccess: (_response, actionId) => {
      addPendingChange({ type: 'delete_action', actionId })
      refetch()
      setSelectedAction(null)
    },
  })

  // Mutation para reordenar pasos
  const reorderStepMutation = useMutation({
    mutationFn: async ({ stepId, newStepNumber }: { stepId: string; newStepNumber: number }) => {
      return examService.updateExerciseStep(stepId, { step_number: newStepNumber })
    },
    onSuccess: (_response, variables) => {
      addPendingChange({ type: 'reorder_step', stepId: variables.stepId, stepNumber: variables.newStepNumber })
      refetch()
    },
    onError: (error) => {
      console.error('Error reordering step:', error)
    }
  })

  // Función para mover un paso hacia arriba
  const handleMoveStepUp = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (index === 0 || !exerciseData?.exercise?.steps) return

    const currentStep = exerciseData.exercise.steps[index]
    const previousStep = exerciseData.exercise.steps[index - 1]

    // Intercambiar step_number
    await reorderStepMutation.mutateAsync({
      stepId: currentStep.id,
      newStepNumber: previousStep.step_number
    })
    await reorderStepMutation.mutateAsync({
      stepId: previousStep.id,
      newStepNumber: currentStep.step_number
    })
  }

  // Función para mover un paso hacia abajo
  const handleMoveStepDown = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (!exerciseData?.exercise?.steps || index === exerciseData.exercise.steps.length - 1) return

    const currentStep = exerciseData.exercise.steps[index]
    const nextStep = exerciseData.exercise.steps[index + 1]

    // Intercambiar step_number
    await reorderStepMutation.mutateAsync({
      stepId: currentStep.id,
      newStepNumber: nextStep.step_number
    })
    await reorderStepMutation.mutateAsync({
      stepId: nextStep.id,
      newStepNumber: currentStep.step_number
    })
  }

  // Handlers para subir imagen
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentStep) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        uploadImageMutation.mutate({
          stepId: currentStep.id,
          imageData: event.target?.result as string,
          width: img.width,
          height: img.height
        })
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  // Handler para iniciar dibujo de área (rubber band) - mousedown
  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'select' || !currentStep || !imageContainerRef.current) return
    
    e.preventDefault()
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setDrawingState({
      isDrawing: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    })
  }

  // Handler para actualizar área mientras arrastra - mousemove
  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawingState.isDrawing || !imageContainerRef.current) return

    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    setDrawingState(prev => ({
      ...prev,
      currentX: x,
      currentY: y
    }))
  }

  // Handler para finalizar dibujo y crear acción - mouseup
  const handleImageMouseUp = () => {
    if (!drawingState.isDrawing || !currentStep) {
      setDrawingState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
      return
    }

    // Calcular posición y tamaño del área
    const left = Math.min(drawingState.startX, drawingState.currentX)
    const top = Math.min(drawingState.startY, drawingState.currentY)
    const width = Math.abs(drawingState.currentX - drawingState.startX)
    const height = Math.abs(drawingState.currentY - drawingState.startY)

    // Solo crear si el área tiene un tamaño mínimo (evitar clics accidentales)
    if (width > 2 && height > 2) {
      // Calcular el número de la nueva acción
      const currentActions = currentStep.actions || []
      const nextActionNumber = currentActions.length + 1
      
      // Determinar el tipo de acción y configuración
      const isButton = selectedTool === 'button' || selectedTool === 'button-wrong'
      const isCorrectButton = selectedTool === 'button'
      const isTextbox = selectedTool === 'textbox'
      
      // Validar que solo haya una respuesta correcta por paso
      const hasCorrectAnswer = currentActions.some(a => 
        (a.action_type === 'button' && a.correct_answer === 'correct') ||
        (a.action_type === 'textbox' && a.correct_answer && a.correct_answer.trim() !== '')
      )
      
      if ((isCorrectButton || isTextbox) && hasCorrectAnswer) {
        setWarningModal({
          isOpen: true,
          title: 'Respuesta correcta ya existe',
          message: 'Este paso ya tiene una respuesta correcta configurada. Solo puede haber un botón correcto o un campo de texto con respuesta por cada paso del ejercicio.'
        })
        setDrawingState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
        return
      }
      
      // Validar que campos incorrectos no se superpongan con respuestas correctas
      const isWrongButton = selectedTool === 'button-wrong'
      if (isWrongButton) {
        const correctAction = currentActions.find(a => 
          (a.action_type === 'button' && a.correct_answer === 'correct') ||
          (a.action_type === 'textbox' && a.correct_answer && a.correct_answer.trim() !== '' && a.correct_answer !== 'wrong')
        )
        
        if (correctAction) {
          // Verificar superposición de rectángulos
          const newRight = left + width
          const newBottom = top + height
          const correctRight = correctAction.position_x + correctAction.width
          const correctBottom = correctAction.position_y + correctAction.height
          
          const overlaps = !(
            newRight <= correctAction.position_x ||
            left >= correctRight ||
            newBottom <= correctAction.position_y ||
            top >= correctBottom
          )
          
          if (overlaps) {
            setWarningModal({
              isOpen: true,
              title: 'Superposición no permitida',
              message: 'El campo incorrecto no puede quedar por encima de la respuesta correcta. Por favor, coloca el área en otra posición.'
            })
            setDrawingState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
            return
          }
        }
      }
      
      const newAction = {
        action_type: isButton ? 'button' : 'textbox',
        position_x: left,
        position_y: top,
        width: width,
        height: height,
        label: isButton ? `Botón ${nextActionNumber}` : '',
        placeholder: '',
        correct_answer: isButton ? (isCorrectButton ? 'correct' : 'wrong') : '',
        scoring_mode: 'exact'
      }

      createActionMutation.mutate({ stepId: currentStep.id, data: newAction })
    }

    // Resetear estado de dibujo
    setDrawingState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
  }

  // Calcular rectángulo de selección para mostrar mientras dibuja
  const getDrawingRect = () => {
    if (!drawingState.isDrawing) return null
    
    return {
      left: Math.min(drawingState.startX, drawingState.currentX),
      top: Math.min(drawingState.startY, drawingState.currentY),
      width: Math.abs(drawingState.currentX - drawingState.startX),
      height: Math.abs(drawingState.currentY - drawingState.startY)
    }
  }

  // Handlers para drag
  const handleActionMouseDown = (e: React.MouseEvent, action: ExerciseAction) => {
    e.stopPropagation()
    
    if (selectedTool !== 'select') return

    setSelectedAction(action)
    
    const rect = imageContainerRef.current?.getBoundingClientRect()
    if (!rect) return

    setDragState({
      isDragging: true,
      actionId: action.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: action.position_x,
      offsetY: action.position_y
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!imageContainerRef.current) return

    const rect = imageContainerRef.current.getBoundingClientRect()

    if (dragState.isDragging && dragState.actionId) {
      const deltaX = ((e.clientX - dragState.startX) / rect.width) * 100
      const deltaY = ((e.clientY - dragState.startY) / rect.height) * 100

      const newX = Math.max(0, Math.min(100 - 10, dragState.offsetX + deltaX))
      const newY = Math.max(0, Math.min(100 - 5, dragState.offsetY + deltaY))

      // Actualizar visualmente (optimistic update)
      const actionEl = document.querySelector(`[data-action-id="${dragState.actionId}"]`) as HTMLElement
      if (actionEl) {
        actionEl.style.left = `${newX}%`
        actionEl.style.top = `${newY}%`
      }
    }

    if (resizeState.isResizing && resizeState.actionId) {
      const deltaX = ((e.clientX - resizeState.startX) / rect.width) * 100
      const deltaY = ((e.clientY - resizeState.startY) / rect.height) * 100

      let newWidth = resizeState.startWidth
      let newHeight = resizeState.startHeight

      if (resizeState.corner === 'se') {
        newWidth = Math.max(5, resizeState.startWidth + deltaX)
        newHeight = Math.max(3, resizeState.startHeight + deltaY)
      }

      const actionEl = document.querySelector(`[data-action-id="${resizeState.actionId}"]`) as HTMLElement
      if (actionEl) {
        actionEl.style.width = `${newWidth}%`
        actionEl.style.height = `${newHeight}%`
      }
    }
  }, [dragState, resizeState])

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.actionId) {
      const actionEl = document.querySelector(`[data-action-id="${dragState.actionId}"]`) as HTMLElement
      if (actionEl) {
        const left = parseFloat(actionEl.style.left)
        const top = parseFloat(actionEl.style.top)
        
        updateActionMutation.mutate({
          actionId: dragState.actionId,
          data: { position_x: left, position_y: top }
        })
      }
    }

    if (resizeState.isResizing && resizeState.actionId) {
      const actionEl = document.querySelector(`[data-action-id="${resizeState.actionId}"]`) as HTMLElement
      if (actionEl) {
        const width = parseFloat(actionEl.style.width)
        const height = parseFloat(actionEl.style.height)
        
        updateActionMutation.mutate({
          actionId: resizeState.actionId,
          data: { width, height }
        })
      }
    }

    setDragState({ isDragging: false, actionId: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 })
    setResizeState({ isResizing: false, actionId: null, corner: null, startX: 0, startY: 0, startWidth: 0, startHeight: 0 })
  }, [dragState, resizeState, updateActionMutation])

  useEffect(() => {
    if (dragState.isDragging || resizeState.isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState.isDragging, resizeState.isResizing, handleMouseMove, handleMouseUp])

  // Handler para resize
  const handleResizeMouseDown = (e: React.MouseEvent, action: ExerciseAction, corner: 'se') => {
    e.stopPropagation()
    
    setResizeState({
      isResizing: true,
      actionId: action.id,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: action.width,
      startHeight: action.height
    })
  }

  // Handler para editar acción
  const handleEditAction = (action: ExerciseAction) => {
    setSelectedAction(action)
    setActionFormData({
      label: action.label || '',
      placeholder: action.placeholder || '',
      correct_answer: action.correct_answer || '',
      scoring_mode: (action as any).scoring_mode || 'exact',
      showPlaceholder: !!(action.placeholder && action.placeholder.trim() !== ''),
      on_error_action: (action as any).on_error_action || 'next_step',
      error_message: (action as any).error_message || '',
      max_attempts: (action as any).max_attempts || 3,
      text_color: (action as any).text_color || '#000000',
      font_family: (action as any).font_family || 'Arial',
      label_style: (action as any).label_style || 'invisible'
    })
    setIsEditActionModalOpen(true)
  }

  // Handler para eliminar acción directamente desde la tarjeta (abre modal de confirmación)
  const handleDeleteAction = (action: ExerciseAction) => {
    const isCorrect = action.action_type === 'button' 
      ? action.correct_answer === 'correct'
      : (action.correct_answer && action.correct_answer.trim() !== '')
    
    setDeleteActionModal({
      isOpen: true,
      actionId: action.id,
      actionType: action.action_type,
      isCorrect: !!isCorrect
    })
  }

  // Confirmar eliminación de acción
  const confirmDeleteAction = () => {
    if (!deleteActionModal.actionId) return
    deleteActionMutation.mutate(deleteActionModal.actionId)
    setDeleteActionModal({ isOpen: false, actionId: null, actionType: null, isCorrect: false })
  }

  const handleSaveAction = () => {
    if (!selectedAction) return
    
    // Preparar los datos, eliminando el placeholder si showPlaceholder es false
    const dataToSend = {
      ...actionFormData,
      placeholder: actionFormData.showPlaceholder ? actionFormData.placeholder : ''
    }
    
    // Eliminar showPlaceholder ya que no es un campo del backend
    const { showPlaceholder, ...backendData } = dataToSend
    
    updateActionMutation.mutate({
      actionId: selectedAction.id,
      data: backendData
    })
    setIsEditActionModalOpen(false)
  }

  // Handler para seleccionar imagen para nuevo paso
  const handleNewStepImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCreatingStep(true)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const imageDataUrl = event.target?.result as string
      
      // Mostrar previsualización inmediata
      setLocalPreviewImage(imageDataUrl)
      
      const img = new Image()
      img.onload = () => {
        // Crear el paso con la imagen directamente
        createStepMutation.mutate({
          title: `Paso ${steps.length + 1}`,
          image_url: imageDataUrl,
          image_width: img.width,
          image_height: img.height
        })
      }
      img.src = imageDataUrl
    }
    reader.readAsDataURL(file)
    
    // Limpiar el input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handler para crear nuevo paso (abre selector de archivo)
  const handleCreateStep = () => {
    fileInputRef.current?.click()
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <LoadingSpinner message="Cargando editor..." />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Input oculto para seleccionar imagen de nuevo paso */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleNewStepImageSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowUnsavedWarning(true)
              } else {
                onClose()
              }
            }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Volver"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Editor de Ejercicio</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-gray-500">
                Ejercicio #{exercise.exercise_number || 'N/A'}
              </p>
              {exercise.exercise_text && (
                <button
                  onClick={() => setShowExerciseDescription(!showExerciseDescription)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  {showExerciseDescription ? (
                    <>
                      Ocultar vista
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Vista del ejercicio
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {pendingChanges.length} cambio(s) sin guardar
            </span>
          )}
          <span className="text-sm text-gray-500">
            {steps.length} paso(s) • {currentStep?.actions?.length || 0} acción(es) en paso actual
          </span>
          <button
            onClick={async () => {
              setIsSaving(true)
              try {
                // Actualizar el ejercicio como completo
                await examService.updateExercise(exercise.id, { is_complete: true })
                // Limpiar cambios pendientes
                setPendingChanges([])
                setHasUnsavedChanges(false)
                onClose()
              } catch (error) {
                console.error('Error al guardar ejercicio:', error)
                alert('Error al guardar. Por favor intente de nuevo.')
              } finally {
                setIsSaving(false)
              }
            }}
            disabled={steps.length === 0 || isSaving}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              steps.length === 0 || isSaving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
            title={steps.length === 0 ? 'Debes crear al menos un paso antes de guardar' : ''}
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </>
            ) : (
              'Guardar y Salir'
            )}
          </button>
        </div>
      </div>

      {/* Panel expandible con la descripción del ejercicio */}
      {showExerciseDescription && exercise.exercise_text && (
        <div className="border-b bg-gradient-to-r from-primary-50 to-blue-50 px-6 py-4 animate-fadeIn">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-gray-800">Descripción del Ejercicio</h3>
            </div>
            <div 
              className="prose prose-sm max-w-none bg-white rounded-lg p-4 shadow-sm border"
              dangerouslySetInnerHTML={{ __html: exercise.exercise_text }}
              style={{
                maxHeight: '300px',
                overflowY: 'auto'
              }}
            />
            <style>{`
              .prose h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
              .prose h2 { font-size: 1.3em; font-weight: bold; margin: 0.5em 0; }
              .prose h3 { font-size: 1.1em; font-weight: bold; margin: 0.5em 0; }
              .prose p { margin: 0.5em 0; line-height: 1.6; }
              .prose ul, .prose ol { margin: 0.5em 0; padding-left: 1.5em; }
              .prose li { margin: 0.25em 0; }
              .prose strong { font-weight: 600; }
              .prose em { font-style: italic; }
              .prose a { color: #2563eb; text-decoration: underline; }
              .prose img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 0.5rem; }
              .prose table { width: 100%; border-collapse: collapse; margin: 1em 0; }
              .prose th, .prose td { border: 1px solid #e5e7eb; padding: 0.5em; }
              .prose th { background-color: #f3f4f6; font-weight: 600; }
              .prose blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; margin: 1em 0; color: #6b7280; }
              .prose code { background-color: #f3f4f6; padding: 0.2em 0.4em; border-radius: 0.25rem; font-family: monospace; font-size: 0.9em; }
              .prose pre { background-color: #1f2937; color: #f3f4f6; padding: 1em; border-radius: 0.5rem; overflow-x: auto; }
              .prose pre code { background-color: transparent; padding: 0; }
            `}</style>
          </div>
        </div>
      )}

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Herramientas:</span>
            <button
              onClick={() => setSelectedTool('select')}
              className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'select' ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-gray-100'}`}
              title="Seleccionar y Mover"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </button>
            
            {/* Separador visual */}
            <div className="h-6 w-px bg-gray-300 mx-1"></div>
            
            {/* Grupo de acciones correctas (verdes/azules) */}
            <button
              onClick={() => setSelectedTool('button')}
              className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'button' ? 'bg-teal-600 text-white' : 'bg-white border hover:bg-teal-50 hover:border-teal-300'}`}
              title="Agregar Botón Correcto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedTool('textbox')}
              className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'textbox' ? 'bg-lime-600 text-white' : 'bg-white border hover:bg-lime-50 hover:border-lime-300'}`}
              title="Agregar Campo de Texto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>

          {/* Separador visual */}
          <div className="h-6 w-px bg-gray-300"></div>

          {/* Campo incorrecto (naranja) */}
          <button
            onClick={() => setSelectedTool('button-wrong')}
            className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'button-wrong' ? 'bg-orange-600 text-white' : 'bg-white border hover:bg-orange-50 hover:border-orange-300'}`}
            title="Agregar Campo Incorrecto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <div className="h-6 w-px bg-gray-300"></div>

          {/* Controles de zoom */}
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-gray-700">Zoom:</span>
            <button
              onClick={() => {
                const idx = EDITOR_CONFIG.ZOOM_LEVELS.indexOf(zoom)
                if (idx > 0) setZoom(EDITOR_CONFIG.ZOOM_LEVELS[idx - 1])
              }}
              disabled={zoom === EDITOR_CONFIG.ZOOM_LEVELS[0]}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Alejar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[45px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => {
                const idx = EDITOR_CONFIG.ZOOM_LEVELS.indexOf(zoom)
                if (idx < EDITOR_CONFIG.ZOOM_LEVELS.length - 1) setZoom(EDITOR_CONFIG.ZOOM_LEVELS[idx + 1])
              }}
              disabled={zoom === EDITOR_CONFIG.ZOOM_LEVELS[EDITOR_CONFIG.ZOOM_LEVELS.length - 1]}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Acercar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-600 ml-1"
              title="Restablecer zoom"
            >
              Reset
            </button>
          </div>

          <div className="h-6 w-px bg-gray-300"></div>

          {selectedAction && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEditAction(selectedAction)}
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
              >
                Editar Respuesta
              </button>
              <button
                onClick={() => {
                  deleteActionMutation.mutate(selectedAction.id)
                }}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
              >
                Eliminar Acción
              </button>
            </div>
          )}

          <div className="flex-1"></div>

          <div className="flex items-center gap-2 text-sm">
            {selectedTool === 'button' && (
              <span className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg">
                ✅ Dibuja un área en la imagen para agregar un botón correcto
              </span>
            )}
            {selectedTool === 'button-wrong' && (
              <span className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg">
                ❌ Dibuja un área en la imagen para agregar un campo incorrecto
              </span>
            )}
            {selectedTool === 'textbox' && (
              <span className="px-3 py-1.5 bg-lime-50 text-lime-700 rounded-lg">
                ✏️ Dibuja un área en la imagen para agregar un campo de texto
              </span>
            )}
            {selectedTool === 'select' && currentStep?.image_url && (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg">
                Arrastra los elementos para moverlos • Doble clic para editar
              </span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Steps sidebar */}
          <div className="w-64 border-r bg-gray-50 flex flex-col">
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Pasos del Ejercicio</h3>
                <span className="text-sm text-gray-500">{steps.length}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {steps.length === 0 && !isCreatingStep ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">No hay pasos</p>
                  <p className="text-xs text-gray-400">Agrega un paso con una imagen</p>
                </div>
              ) : (
                steps.map((step: ExerciseStep, index: number) => (
                  <div
                    key={step.id}
                    onClick={() => setCurrentStepIndex(index)}
                    className={`rounded-lg cursor-pointer transition-all ${
                      currentStepIndex === index
                        ? 'ring-2 ring-primary-500 shadow-md'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div className={`p-3 rounded-lg ${currentStepIndex === index ? 'bg-primary-50' : 'bg-white'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${currentStepIndex === index ? 'text-primary-700' : 'text-gray-700'}`}>
                          Paso {step.step_number}
                        </span>
                        <div className="flex items-center gap-1">
                          {/* Botón para mover hacia arriba */}
                          <button
                            onClick={(e) => handleMoveStepUp(e, index)}
                            disabled={index === 0}
                            className={`p-1 rounded ${
                              index === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                            }`}
                            title="Mover paso arriba"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          {/* Botón para mover hacia abajo */}
                          <button
                            onClick={(e) => handleMoveStepDown(e, index)}
                            disabled={index === steps.length - 1}
                            className={`p-1 rounded ${
                              index === steps.length - 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
                            }`}
                            title="Mover paso abajo"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {/* Botón para eliminar */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmModal({
                                isOpen: true,
                                stepId: step.id,
                                stepNumber: step.step_number,
                                hasImage: !!step.image_url,
                                actionsCount: step.total_actions || step.actions?.length || 0
                              })
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            title="Eliminar paso"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {step.image_url && (
                        <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                          <img src={step.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-gray-500">{step.total_actions || 0} acción(es)</span>
                        {currentStepIndex === index && (
                          <span className="text-primary-600 font-medium">Editando</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Mostrar previsualización del nuevo paso mientras se crea */}
              {isCreatingStep && localPreviewImage && (
                <div className="rounded-lg ring-2 ring-primary-500 shadow-md animate-pulse">
                  <div className="p-3 rounded-lg bg-primary-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary-700">
                        Paso {steps.length + 1}
                      </span>
                      <svg className="animate-spin h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                      <img src={localPreviewImage} alt="Nuevo paso" className="w-full h-full object-cover" />
                    </div>
                    <div className="mt-2 text-xs text-primary-600 font-medium text-center">
                      Guardando...
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-3 border-t bg-white">
              <button
                onClick={handleCreateStep}
                disabled={createStepMutation.isPending}
                className="w-full px-4 py-3 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
              >
                {createStepMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar Paso con Imagen
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-gray-50 p-8">
            {/* Mostrar previsualización mientras se crea el paso */}
            {isCreatingStep && localPreviewImage ? (
              <div className="w-full mx-auto" style={{ maxWidth: '1400px' }}>
                <div className="relative bg-white shadow-2xl rounded-lg overflow-hidden">
                  <img
                    src={localPreviewImage}
                    alt="Previsualización"
                    className="w-full h-auto rounded-lg"
                    draggable={false}
                  />
                  {/* Overlay de cargando */}
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center rounded-lg">
                    <div className="bg-white rounded-lg p-6 shadow-xl text-center">
                      <svg className="animate-spin h-10 w-10 text-primary-600 mx-auto" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-3 text-gray-700 font-medium">Guardando imagen...</p>
                      <p className="text-sm text-gray-500">Por favor espera</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : currentStep ? (
              <div className="w-full">
                {currentStep.image_url ? (
                  <>
                    {/* Contenedor con scroll para zoom */}
                    <div className="overflow-auto mx-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                      <div
                        ref={imageContainerRef}
                        className="relative bg-white shadow-2xl rounded-lg select-none mx-auto origin-top-left"
                        onMouseDown={handleImageMouseDown}
                        onMouseMove={handleImageMouseMove}
                        onMouseUp={handleImageMouseUp}
                        onMouseLeave={handleImageMouseUp}
                        style={{ 
                          cursor: selectedTool !== 'select' ? 'crosshair' : 'default', 
                          maxWidth: `${1400 * zoom}px`,
                          transform: `scale(${zoom})`,
                          transformOrigin: 'top center'
                        }}
                      >
                      <img
                        src={currentStep.image_url}
                        alt={`Paso ${currentStep.step_number}`}
                        className="w-full h-auto pointer-events-none rounded-lg"
                        draggable={false}
                      />

                      {/* Rubber band selection mientras dibuja */}
                      {drawingState.isDrawing && (() => {
                        const rect = getDrawingRect()
                        if (!rect) return null
                        return (
                          <div
                            className={`absolute border-2 border-dashed rounded pointer-events-none z-20 ${
                              selectedTool === 'button'
                                ? 'border-blue-500 bg-blue-200 bg-opacity-30'
                                : selectedTool === 'button-wrong'
                                ? 'border-orange-500 bg-orange-200 bg-opacity-30'
                                : 'border-green-500 bg-green-200 bg-opacity-30'
                            }`}
                            style={{
                              left: `${rect.left}%`,
                              top: `${rect.top}%`,
                              width: `${rect.width}%`,
                              height: `${rect.height}%`,
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                              <span className={
                                selectedTool === 'button' 
                                  ? 'text-blue-700' 
                                  : selectedTool === 'button-wrong' 
                                  ? 'text-orange-700' 
                                  : 'text-green-700'
                              }>
                                {rect.width.toFixed(0)}% × {rect.height.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                      
                      {/* Actions overlay */}
                      {currentStep.actions?.map((action: ExerciseAction) => {
                        // Determinar si es un textbox sin respuesta definida
                        const isTextboxWithoutAnswer = action.action_type === 'textbox' && (!action.correct_answer || action.correct_answer.trim() === '')
                        // Determinar si es un botón incorrecto
                        const isWrongButton = action.action_type === 'button' && action.correct_answer === 'wrong'
                        const isCorrectButton = action.action_type === 'button' && action.correct_answer === 'correct'
                        
                        return (
                        <div
                          key={action.id}
                          data-action-id={action.id}
                          className={`absolute border-2 rounded cursor-move transition-all z-10 ${
                            selectedAction?.id === action.id
                              ? 'border-primary-500 bg-primary-200 bg-opacity-50 shadow-lg'
                              : isCorrectButton
                              ? 'border-blue-500 bg-blue-200 bg-opacity-40 hover:bg-opacity-60'
                              : isWrongButton
                              ? 'border-orange-500 bg-orange-200 bg-opacity-40 hover:bg-opacity-60'
                              : isTextboxWithoutAnswer
                              ? 'border-red-500 bg-red-200 bg-opacity-40 hover:bg-opacity-60'
                              : 'border-green-500 bg-green-200 bg-opacity-40 hover:bg-opacity-60'
                          }`}
                          style={{
                            left: `${action.position_x}%`,
                            top: `${action.position_y}%`,
                            width: `${action.width}%`,
                            height: `${action.height}%`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => handleActionMouseDown(e, action)}
                          onDoubleClick={() => handleEditAction(action)}
                        >
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium truncate px-1">
                            {action.action_type === 'button' ? (
                              <span className={isWrongButton ? 'text-orange-800' : 'text-blue-800'}>
                                {action.placeholder ? action.placeholder : `(${action.label || 'Botón'})`}
                              </span>
                            ) : isTextboxWithoutAnswer ? (
                              <span className="text-red-800 italic font-semibold">Sin respuesta</span>
                            ) : (
                              <span className="text-green-800 italic">
                                {action.placeholder || '(Campo de texto)'}
                              </span>
                            )}
                          </div>
                          
                          {/* Resize handle */}
                          {selectedAction?.id === action.id && (
                            <div
                              className="absolute bottom-0 right-0 w-4 h-4 bg-primary-500 cursor-se-resize rounded-tl"
                              onMouseDown={(e) => handleResizeMouseDown(e, action, 'se')}
                            />
                          )}
                          
                          {/* Action number badge */}
                          <div className={`absolute -top-3 -left-3 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold shadow ${
                            isCorrectButton 
                              ? 'bg-blue-600' 
                              : isWrongButton 
                              ? 'bg-orange-600' 
                              : isTextboxWithoutAnswer 
                              ? 'bg-red-600' 
                              : 'bg-green-600'
                          }`}>
                            {action.action_number}
                          </div>
                        </div>
                      )})}
                    </div>
                    </div>
                    
                    {/* Botón para cambiar imagen */}
                    <div className="mt-4 text-center">
                      <label className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer border shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Cambiar Imagen
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl shadow-lg p-16 text-center">
                    <svg className="w-20 h-20 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-4 text-lg text-gray-600">Este paso no tiene imagen</p>
                    <p className="text-sm text-gray-400 mt-1">Sube una imagen para comenzar a agregar acciones</p>
                    <label className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer font-medium">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Subir Imagen
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="mt-4 text-xl text-gray-600">No hay pasos en este ejercicio</h3>
                  <p className="text-gray-400 mt-2">
                    Cada paso es una imagen donde el alumno debe realizar acciones como hacer clic en botones o escribir texto.
                  </p>
                  <button
                    onClick={handleCreateStep}
                    disabled={createStepMutation.isPending}
                    className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar Primer Paso
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions panel */}
          {currentStep && currentStep.image_url && (
            <div className="w-80 border-l bg-white flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900">Acciones del Paso {currentStep.step_number}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {currentStep.actions?.length || 0} acción(es) configurada(s)
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3">
                {!currentStep.actions?.length ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Sin acciones</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Usa las herramientas para agregar botones o campos de texto
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      // Ordenar acciones: textbox primero (ambos rojo y verde), luego botones correctos, luego incorrectos
                      const sortedActions = [...currentStep.actions]
                        .sort((a, b) => {
                          // textbox siempre primero (prioridad 0)
                          // botones correctos segundo (prioridad 1)
                          // botones incorrectos al final (prioridad 2)
                          const getPriority = (action: ExerciseAction) => {
                            if (action.action_type === 'textbox') return 0;
                            if (action.action_type === 'button' && action.correct_answer === 'correct') return 1;
                            return 2;
                          };
                          const priorityDiff = getPriority(a) - getPriority(b);
                          if (priorityDiff !== 0) return priorityDiff;
                          // Si tienen la misma prioridad, ordenar por action_number
                          return a.action_number - b.action_number;
                        });
                      
                      return sortedActions.map((action: ExerciseAction, index: number) => {
                        const isTextboxWithoutAnswer = action.action_type === 'textbox' && (!action.correct_answer || action.correct_answer.trim() === '')
                        const isTextbox = action.action_type === 'textbox'
                        const isWrongButton = action.action_type === 'button' && action.correct_answer === 'wrong'
                        const isCorrectButton = action.action_type === 'button' && action.correct_answer === 'correct'
                        const isCorrectAction = isCorrectButton || isTextbox
                        
                        // Calcular número de display contando solo acciones incorrectas (wrong buttons)
                        const incorrectIndex = sortedActions
                          .slice(0, index)
                          .filter((a: ExerciseAction) => {
                            const aIsCorrectButton = a.action_type === 'button' && a.correct_answer === 'correct'
                            const aIsTextbox = a.action_type === 'textbox'
                            return !(aIsCorrectButton || aIsTextbox)
                          })
                          .length
                        const displayNumber = isCorrectAction ? null : incorrectIndex + 1
                        
                        return (
                          <div
                            key={action.id}
                            onClick={() => setSelectedAction(action)}
                            className={`relative p-3 rounded-lg cursor-pointer transition-all border overflow-hidden ${
                              selectedAction?.id === action.id
                                ? 'border-primary-500 bg-primary-50 shadow ring-2 ring-primary-200'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {/* Botón eliminar en esquina superior derecha */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAction(action)
                              }}
                              className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar acción"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>

                            <div className="flex items-center gap-2 mb-2 pr-6">
                              <span className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold ${
                                isCorrectButton 
                                  ? 'bg-teal-600' 
                                  : isTextboxWithoutAnswer
                                    ? 'bg-red-600'
                                    : isTextbox
                                      ? 'bg-lime-600'
                                      : isWrongButton 
                                        ? 'bg-orange-600' 
                                        : 'bg-lime-600'
                              }`}>
                                {isCorrectAction ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : displayNumber}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isCorrectButton
                                  ? 'bg-teal-100 text-teal-700'
                                  : isWrongButton
                                    ? 'bg-orange-100 text-orange-700'
                                    : isTextboxWithoutAnswer
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-lime-100 text-lime-700'
                              }`}>
                                {action.action_type === 'button' 
                                  ? (isCorrectButton ? 'Botón Correcto' : 'Campo Incorrecto') 
                                  : 'Campo de Texto'}
                              </span>
                            </div>
                            
                            <div className="text-sm">
                              {action.action_type === 'button' ? (
                                <div>
                                  {isCorrectButton && (
                                    <div className="space-y-1.5 mt-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                        <span className="text-xs text-gray-600 truncate min-w-0">
                                          Estilo: <span className="font-medium text-purple-700">Invisible</span>
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        <span className="text-xs text-gray-600 truncate min-w-0">
                                          Etiqueta: <span className="font-medium text-gray-700">{action.label || `Botón ${action.action_number}`}</span>
                                        </span>
                                      </div>
                                      <p className="text-xs text-teal-600">✓ Respuesta correcta</p>
                                    </div>
                                  )}
                                  {isWrongButton && (
                                    <div className="space-y-1.5 mt-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                        <span className="text-xs text-gray-600 truncate min-w-0">
                                          Estilo: <span className="font-medium text-purple-700">Invisible</span>
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        <span className="text-xs text-gray-600 truncate min-w-0">
                                          Etiqueta: <span className="font-medium text-gray-700">{action.label || `Botón ${action.action_number}`}</span>
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="text-xs text-gray-600">
                                          <span className="font-medium text-orange-700">Área incorrecta</span>
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1.5 mt-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <svg className="w-3.5 h-3.5 text-lime-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs text-gray-600 truncate min-w-0">
                                      Respuesta: <span className={`font-medium ${isTextboxWithoutAnswer ? 'text-red-600' : 'text-lime-700'}`}>
                                        {action.correct_answer || 'Sin definir'}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <svg className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                    <span className="text-xs text-gray-600 truncate min-w-0">
                                      Estilo: <span className="font-medium text-purple-700">Invisible</span>
                                    </span>
                                  </div>
                                  {action.placeholder && (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                      <span className="text-xs text-gray-600 truncate min-w-0">
                                        Placeholder: <span className="font-medium text-gray-700 italic">{action.placeholder}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditAction(action)
                              }}
                              className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Editar configuración
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Leyenda */}
              <div className="p-4 border-t bg-gray-50">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Leyenda de colores</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-gray-600">Botón Correcto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
                    <span className="text-gray-600">Campo Incorrecto (distractor)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-lime-600 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-gray-600">Campo de Texto (con respuesta)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-gray-600">Campo de Texto (sin respuesta)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Modal para editar acción */}
      {isEditActionModalOpen && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] overflow-y-auto" onClick={() => setIsEditActionModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Editar {selectedAction.action_type === 'button' ? 'Botón' : 'Campo de Texto'}
              </h3>
              <button
                onClick={() => setIsEditActionModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Campos específicos según el tipo */}
              {selectedAction.action_type === 'button' ? (
                <>
                  {/* Sección 1: Identificación del Botón */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Identificación del Botón
                    </h4>
                    <p className="text-sm text-blue-800 mb-3">
                      Etiqueta: <span className="font-medium">{actionFormData.label || `Botón ${selectedAction.action_number}`}</span>
                    </p>
                    <p className="text-xs text-blue-700">
                      La etiqueta se asigna automáticamente y se usa para identificar el botón en los reportes
                    </p>
                    
                    {/* Tipo de Respuesta */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Respuesta
                      </label>
                      <div className="space-y-2">
                        <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-blue-100 ${actionFormData.correct_answer === 'correct' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="radio"
                            name="button-type"
                            value="correct"
                            checked={actionFormData.correct_answer === 'correct'}
                            onChange={(e) => setActionFormData({ ...actionFormData, correct_answer: e.target.value })}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium text-gray-900">Botón Correcto</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-7">Este botón representa la acción correcta que el alumno debe seleccionar</p>
                          </div>
                        </label>
                        
                        <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-orange-100 ${actionFormData.correct_answer === 'wrong' ? 'border-orange-500 bg-orange-100' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="radio"
                            name="button-type"
                            value="wrong"
                            checked={actionFormData.correct_answer === 'wrong'}
                            onChange={(e) => setActionFormData({ ...actionFormData, correct_answer: e.target.value })}
                            className="w-4 h-4 text-orange-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium text-gray-900">Botón Incorrecto</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-7">Este botón representa una acción incorrecta o errónea</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    
                    {/* Nota: En exámenes, las áreas son siempre invisibles */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 p-2 rounded-lg">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                        <span className="font-medium">✨ Área Invisible</span>
                        <span className="text-purple-600">- En exámenes, las áreas siempre son invisibles para el alumno</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Sección 2: Tipo de cursor (solo para acciones incorrectas) */}
                  {actionFormData.correct_answer === 'wrong' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        Tipo de Cursor
                      </h4>
                      <p className="text-xs text-gray-600 mb-3">
                        Elige cómo se verá el cursor cuando el alumno pase sobre esta área
                      </p>
                      
                      <div className="space-y-2">
                        <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-purple-100 ${!actionFormData.scoring_mode || actionFormData.scoring_mode === 'exact' ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="radio"
                            name="cursor-type"
                            value="exact"
                            checked={!actionFormData.scoring_mode || actionFormData.scoring_mode === 'exact'}
                            onChange={() => setActionFormData({ ...actionFormData, scoring_mode: 'exact' })}
                            className="w-4 h-4 text-purple-600"
                          />
                          <div className="flex-1 flex items-start gap-2">
                            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                            </svg>
                            <div>
                              <span className="font-medium text-gray-900">Botón Incorrecto</span>
                              <p className="text-xs text-gray-500 mt-1">Cursor de puntero (mano) - parece un botón clickeable</p>
                            </div>
                          </div>
                        </label>
                        
                        <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-purple-100 ${actionFormData.scoring_mode === 'text_cursor' ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="radio"
                            name="cursor-type"
                            value="text_cursor"
                            checked={actionFormData.scoring_mode === 'text_cursor'}
                            onChange={() => setActionFormData({ ...actionFormData, scoring_mode: 'text_cursor' })}
                            className="w-4 h-4 text-purple-600"
                          />
                          <div className="flex-1 flex items-start gap-2">
                            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <div>
                              <span className="font-medium text-gray-900">Campo Incorrecto</span>
                              <p className="text-xs text-gray-500 mt-1">Cursor de texto (I) - parece un campo para escribir</p>
                            </div>
                          </div>
                        </label>
                        
                        <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-purple-100 ${actionFormData.scoring_mode === 'default_cursor' ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white'}`}>
                          <input
                            type="radio"
                            name="cursor-type"
                            value="default_cursor"
                            checked={actionFormData.scoring_mode === 'default_cursor'}
                            onChange={() => setActionFormData({ ...actionFormData, scoring_mode: 'default_cursor' })}
                            className="w-4 h-4 text-purple-600"
                          />
                          <div className="flex-1 flex items-start gap-2">
                            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                            </svg>
                            <div>
                              <span className="font-medium text-gray-900">Cursor Normal</span>
                              <p className="text-xs text-gray-500 mt-1">Cursor de flecha normal - no indica interactividad</p>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {/* Sección 3: Configuración de acción en error (solo para acciones incorrectas) */}
                  {actionFormData.correct_answer === 'wrong' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Acción cuando se seleccione esta área incorrecta
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ¿Qué hacer al seleccionar?
                          </label>
                          <select
                            value={actionFormData.on_error_action}
                            onChange={(e) => setActionFormData({ ...actionFormData, on_error_action: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                          >
                            <option value="show_message">Mostrar mensaje de error y permitir reintentar</option>
                            <option value="next_step">Pasar al siguiente paso</option>
                            <option value="next_exercise">Pasar al siguiente ejercicio</option>
                          </select>
                        </div>
                        
                        {actionFormData.on_error_action === 'show_message' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mensaje de error
                              </label>
                              <textarea
                                value={actionFormData.error_message}
                                onChange={(e) => setActionFormData({ ...actionFormData, error_message: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                                rows={2}
                                placeholder="Ej: Respuesta incorrecta. Inténtalo de nuevo."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Número máximo de intentos adicionales
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={actionFormData.max_attempts}
                                onChange={(e) => setActionFormData({ ...actionFormData, max_attempts: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Después de este número de intentos, se terminará el ejercicio
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Sección 1: Respuesta Esperada */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Respuesta Esperada
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Respuesta Correcta <span className="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={actionFormData.correct_answer}
                          onChange={(e) => setActionFormData({ ...actionFormData, correct_answer: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${!actionFormData.correct_answer?.trim() ? 'border-red-400' : 'border-gray-300'}`}
                          placeholder="La respuesta que debe escribir el alumno"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Esta es la respuesta contra la cual se comparará lo que escriba el alumno
                        </p>
                      </div>

                      {/* Nota: En exámenes, las áreas son siempre invisibles */}
                      <div className="pt-2 border-t border-green-200">
                        <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 p-2 rounded-lg">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                          <span className="font-medium">✨ Área Invisible</span>
                          <span className="text-purple-600">- En exámenes, las áreas siempre son invisibles para el alumno</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Modo de Evaluación */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Modo de Evaluación
                    </h4>
                    
                    <div className="space-y-2">
                      <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-blue-100 ${actionFormData.scoring_mode === 'exact' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-white'}`}>
                        <input
                          type="radio"
                          name="scoring-mode"
                          value="exact"
                          checked={actionFormData.scoring_mode === 'exact'}
                          onChange={(e) => setActionFormData({ ...actionFormData, scoring_mode: e.target.value })}
                          className="w-4 h-4 text-blue-600 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">Exacta (0% o 100%)</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            La respuesta debe coincidir exactamente. Si es correcta: 100%, si no: 0%
                          </p>
                        </div>
                      </label>
                      
                      <label className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-blue-100 ${actionFormData.scoring_mode === 'similarity' ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-white'}`}>
                        <input
                          type="radio"
                          name="scoring-mode"
                          value="similarity"
                          checked={actionFormData.scoring_mode === 'similarity'}
                          onChange={(e) => setActionFormData({ ...actionFormData, scoring_mode: e.target.value })}
                          className="w-4 h-4 text-blue-600 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">Por Similitud</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            La puntuación será el porcentaje de similitud entre la respuesta del alumno y la correcta. Ej: si escribe "Hol" y la correcta es "Hola", obtiene ~75%
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Sección 3: Apariencia del Texto */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      Apariencia del Texto
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Color de texto
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActionFormData({ ...actionFormData, text_color: '#000000' })}
                            className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                              actionFormData.text_color === '#000000' 
                                ? 'bg-gray-900 text-white border-gray-900' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            Negro
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionFormData({ ...actionFormData, text_color: '#ffffff' })}
                            className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                              actionFormData.text_color === '#ffffff' 
                                ? 'bg-white text-gray-900 border-gray-900 ring-2 ring-gray-900' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            Blanco
                          </button>
                          <input
                            type="color"
                            value={actionFormData.text_color}
                            onChange={(e) => setActionFormData({ ...actionFormData, text_color: e.target.value })}
                            className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={actionFormData.text_color}
                            onChange={(e) => {
                              const value = e.target.value
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                setActionFormData({ ...actionFormData, text_color: value })
                              }
                            }}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                            placeholder="#000000"
                            maxLength={7}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tipo de letra
                        </label>
                        <select
                          value={actionFormData.font_family}
                          onChange={(e) => setActionFormData({ ...actionFormData, font_family: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                        >
                          <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                          <option value="Helvetica" style={{ fontFamily: 'Helvetica' }}>Helvetica</option>
                          <option value="Times New Roman" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                          <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
                          <option value="Courier New" style={{ fontFamily: 'Courier New' }}>Courier New</option>
                          <option value="Verdana" style={{ fontFamily: 'Verdana' }}>Verdana</option>
                          <option value="Comic Sans MS" style={{ fontFamily: 'Comic Sans MS' }}>Comic Sans MS</option>
                          <option value="monospace" style={{ fontFamily: 'monospace' }}>Monospace</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Sección 4: Configuración de Error (solo si el modo es exacto) */}
                  {actionFormData.scoring_mode === 'exact' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Acción cuando la respuesta sea incorrecta
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ¿Qué hacer con respuesta incorrecta?
                          </label>
                          <select
                            value={actionFormData.on_error_action}
                            onChange={(e) => setActionFormData({ ...actionFormData, on_error_action: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                          >
                            <option value="show_message">Mostrar mensaje de error y permitir reintentar</option>
                            <option value="next_step">Pasar al siguiente paso</option>
                            <option value="next_exercise">Pasar al siguiente ejercicio</option>
                          </select>
                        </div>
                        
                        {actionFormData.on_error_action === 'show_message' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mensaje de error
                              </label>
                              <textarea
                                value={actionFormData.error_message}
                                onChange={(e) => setActionFormData({ ...actionFormData, error_message: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                                rows={2}
                                placeholder="Ej: Respuesta incorrecta. Revisa tu respuesta."
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Número máximo de intentos adicionales
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={actionFormData.max_attempts}
                                onChange={(e) => setActionFormData({ ...actionFormData, max_attempts: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Después de este número de intentos adicionales, se avanzará automáticamente
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Nota informativa para modo similitud */}
                  {actionFormData.scoring_mode === 'similarity' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-blue-900">Modo Similitud</p>
                          <p className="text-xs text-blue-700 mt-1">
                            En este modo, cualquier respuesta es aceptada y se avanza automáticamente. La puntuación final será el porcentaje de similitud calculado.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setIsEditActionModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAction}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                disabled={updateActionMutation.isPending}
              >
                {updateActionMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar paso */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
            {/* Icono de advertencia */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            
            {/* Título */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              ¿Eliminar Paso {deleteConfirmModal.stepNumber}?
            </h3>
            
            {/* Descripción */}
            <p className="text-gray-600 text-center mb-4">
              Esta acción no se puede deshacer. Se eliminará permanentemente:
            </p>
            
            {/* Lista de elementos a eliminar */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              {deleteConfirmModal.hasImage && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>La imagen asociada al paso</span>
                </div>
              )}
              {deleteConfirmModal.actionsCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <span>{deleteConfirmModal.actionsCount} área(s) interactiva(s)</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Los datos del paso en la base de datos</span>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmModal({ isOpen: false, stepId: null, stepNumber: null, hasImage: false, actionsCount: 0 })}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmModal.stepId) {
                    console.log('Button clicked, deleting step:', deleteConfirmModal.stepId)
                    deleteStepMutation.mutate(deleteConfirmModal.stepId)
                  }
                }}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                disabled={deleteStepMutation.isPending}
              >
                {deleteStepMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Sí, Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de advertencia de cambios sin guardar */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cambios sin guardar
                </h3>
                <p className="text-gray-600 mb-4">
                  Tienes <strong>{pendingChanges.length} cambio(s)</strong> que no se guardarán hasta que hagas clic en <strong>"Guardar y Salir"</strong>.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Si abandonas el editor ahora, perderás todos los cambios realizados.
                </p>

                {/* Lista de cambios */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-700 mb-2">Cambios pendientes:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {pendingChanges.slice(0, 5).map((change, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-orange-500 rounded-full"></span>
                        {change.type === 'create_action' && 'Acción creada'}
                        {change.type === 'update_action' && 'Acción actualizada'}
                        {change.type === 'delete_action' && 'Acción eliminada'}
                        {change.type === 'reorder_step' && 'Paso reordenado'}
                        {change.type === 'upload_image' && 'Imagen subida'}
                      </li>
                    ))}
                    {pendingChanges.length > 5 && (
                      <li className="text-gray-400">+ {pendingChanges.length - 5} cambios más...</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Continuar Editando
              </button>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false)
                  setPendingChanges([])
                  setHasUnsavedChanges(false)
                  onClose()
                }}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Salir sin Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de advertencia para validaciones */}
      {warningModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => setWarningModal({ isOpen: false, title: '', message: '' })}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              {/* Icono de advertencia */}
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              {/* Título */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {warningModal.title}
              </h3>
              
              {/* Mensaje */}
              <p className="text-gray-600 mb-6">
                {warningModal.message}
              </p>
              
              {/* Botón */}
              <button
                onClick={() => setWarningModal({ isOpen: false, title: '', message: '' })}
                className="px-6 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar acción */}
      {deleteActionModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => setDeleteActionModal({ isOpen: false, actionId: null, actionType: null, isCorrect: false })}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              {/* Icono de eliminación */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              
              {/* Título */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Eliminar {deleteActionModal.actionType === 'button' ? 'Botón' : 'Campo de Texto'}
              </h3>
              
              {/* Mensaje */}
              <p className="text-gray-600 mb-2">
                ¿Estás seguro de que deseas eliminar esta acción?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {deleteActionModal.isCorrect ? (
                  <span className="text-green-600 font-medium">Esta es la respuesta correcta del paso.</span>
                ) : (
                  <span className="text-orange-600 font-medium">Esta es una opción incorrecta.</span>
                )}
              </p>
              
              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteActionModal({ isOpen: false, actionId: null, actionType: null, isCorrect: false })}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteAction}
                  className="px-5 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => setSuccessModal({ isOpen: false, title: '', message: '' })}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              {/* Icono de éxito */}
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              {/* Título */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {successModal.title}
              </h3>
              
              {/* Mensaje */}
              <p className="text-gray-600 mb-6">
                {successModal.message}
              </p>
              
              {/* Botón */}
              <button
                onClick={() => setSuccessModal({ isOpen: false, title: '', message: '' })}
                className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExerciseEditor
