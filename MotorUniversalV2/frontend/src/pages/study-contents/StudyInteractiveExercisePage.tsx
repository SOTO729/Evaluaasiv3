/**
 * Página de edición de ejercicio interactivo para contenidos de estudio
 * Basado en el diseño de ExerciseEditor
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  getTopic,
  createInteractive,
  updateInteractive,
  createStep,
  updateStep,
  deleteStep,
  createAction,
  updateAction,
  deleteAction,
  StudyInteractiveExercise,
  StudyInteractiveExerciseStep,
  StudyInteractiveExerciseAction
} from '../../services/studyContentService'
import api from '../../services/api'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import LoadingSpinner from '../../components/LoadingSpinner'

// Modal genérico
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className={`bg-white rounded-lg ${sizeClasses[size]} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

type Tool = 'select' | 'button' | 'button-wrong' | 'text_input'

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

const StudyInteractiveExercisePage = () => {
  const { id: materialId, sessionId, topicId } = useParams<{ 
    id: string; 
    sessionId: string; 
    topicId: string 
  }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados principales
  const [exercise, setExercise] = useState<StudyInteractiveExercise | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [selectedAction, setSelectedAction] = useState<StudyInteractiveExerciseAction | null>(null)
  const [localPreviewImage, setLocalPreviewImage] = useState<string | null>(null)
  const [isCreatingStep, setIsCreatingStep] = useState(false)
  
  // Estado para cambios pendientes (sin guardar)
  const [pendingChanges, setPendingChanges] = useState<any[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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

  // Zoom para la vista del canvas (desactivado por ahora)
  // const [_zoom, setZoom] = useState(1)

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
    font_family: 'Arial'
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

  // Modal para editar información del ejercicio (título y descripción/instrucciones)
  const [isExerciseInfoModalOpen, setIsExerciseInfoModalOpen] = useState(false)
  const [exerciseInfoForm, setExerciseInfoForm] = useState({
    title: '',
    description: ''
  })
  const [isSavingExerciseInfo, setIsSavingExerciseInfo] = useState(false)

  // Función para agregar cambio pendiente
  const addPendingChange = (change: any) => {
    setPendingChanges(prev => [...prev, change])
    setHasUnsavedChanges(true)
  }

  // Query para obtener el tema con ejercicio interactivo
  const { data: topicData, isLoading } = useQuery({
    queryKey: ['study-topic', materialId, sessionId, topicId],
    queryFn: () => getTopic(Number(materialId), Number(sessionId), Number(topicId)),
    enabled: !!materialId && !!sessionId && !!topicId
  })

  // Inicializar ejercicio
  useEffect(() => {
    if (topicData?.interactive_exercise) {
      setExercise(topicData.interactive_exercise)
    }
  }, [topicData])

  // Crear ejercicio si no existe
  const createExerciseMutation = useMutation({
    mutationFn: () => createInteractive(
      Number(materialId),
      Number(sessionId),
      Number(topicId),
      { title: 'Ejercicio Interactivo' }
    ),
    onSuccess: (data) => {
      setExercise(data)
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
      // Abrir modal para configurar título e instrucciones al crear un nuevo ejercicio
      setExerciseInfoForm({
        title: data.title || 'Ejercicio Interactivo',
        description: data.description || ''
      })
      setIsExerciseInfoModalOpen(true)
    }
  })

  const saveExerciseMutation = useMutation({
    mutationFn: (data: Partial<{ is_active: boolean; title?: string; description?: string }>) => updateInteractive(
      Number(materialId),
      Number(sessionId),
      Number(topicId),
      data
    ),
    onSuccess: () => {
      setPendingChanges([])
      setHasUnsavedChanges(false)
      navigate(`/study-contents/${materialId}`)
    },
    onError: (err) => {
      console.error('Error saving interactive exercise', err)
      alert('Error al guardar el ejercicio.')
    }
  })

  // Mutación para actualizar solo título y descripción (sin navegar)
  const updateExerciseInfoMutation = useMutation({
    mutationFn: (data: { title: string; description: string }) => updateInteractive(
      Number(materialId),
      Number(sessionId),
      Number(topicId),
      data
    ),
    onSuccess: (updatedData: StudyInteractiveExercise) => {
      if (exercise) {
        setExercise({ ...exercise, title: updatedData.title, description: updatedData.description })
      }
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
      setIsExerciseInfoModalOpen(false)
      setIsSavingExerciseInfo(false)
    },
    onError: (err) => {
      console.error('Error updating exercise info', err)
      alert('Error al actualizar la información del ejercicio.')
      setIsSavingExerciseInfo(false)
    }
  })

  // Función para abrir el modal de edición de información del ejercicio
  const openExerciseInfoModal = () => {
    setExerciseInfoForm({
      title: exercise?.title || 'Ejercicio Interactivo',
      description: exercise?.description || ''
    })
    setIsExerciseInfoModalOpen(true)
  }

  // Función para guardar la información del ejercicio
  const handleSaveExerciseInfo = async () => {
    if (!exerciseInfoForm.title.trim()) {
      alert('El título es requerido')
      return
    }
    setIsSavingExerciseInfo(true)
    await updateExerciseInfoMutation.mutateAsync(exerciseInfoForm)
  }

  // Actualizar ejercicio - eslint-disable-next-line @typescript-eslint/no-unused-vars
  // Se mantiene para uso futuro
  void updateInteractive

  // Crear paso
  const createStepMutation = useMutation({
    mutationFn: (data: { image_url?: string; image_width?: number; image_height?: number }) => createStep(
      Number(materialId),
      Number(sessionId),
      Number(topicId),
      data
    ),
    onSuccess: (newStep) => {
      if (exercise) {
        const updatedSteps = [...(exercise.steps || []), newStep]
        setExercise({ ...exercise, steps: updatedSteps })
        setCurrentStepIndex(updatedSteps.length - 1)
      }
      setIsCreatingStep(false)
      setLocalPreviewImage(null)
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
    }
  })

  // Actualizar paso - se mantiene para uso futuro
  void updateStep

  // Eliminar paso
  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => deleteStep(
      Number(materialId),
      Number(sessionId),
      Number(topicId),
      stepId
    ),
    onSuccess: (_, stepId: string) => {
      if (exercise && exercise.steps) {
        const updatedSteps = exercise.steps.filter((s: StudyInteractiveExerciseStep) => s.id !== stepId)
        setExercise({ ...exercise, steps: updatedSteps })
        if (currentStepIndex >= updatedSteps.length) {
          setCurrentStepIndex(Math.max(0, updatedSteps.length - 1))
        }
      }
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
    }
  })

  // Crear acción
  const createActionMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: any }) => createAction(
      Number(materialId),
      Number(sessionId),
      Number(topicId),
      stepId,
      data
    ),
    onSuccess: (newAction: StudyInteractiveExerciseAction) => {
      if (exercise && exercise.steps) {
        const updatedSteps = exercise.steps.map((step: StudyInteractiveExerciseStep) => {
          if (step.id === newAction.step_id) {
            return { ...step, actions: [...(step.actions || []), newAction] }
          }
          return step
        })
        setExercise({ ...exercise, steps: updatedSteps })
      }
      addPendingChange({ type: 'create_action', stepId: newAction.step_id, actionId: newAction.id })
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
    }
  })

  // Actualizar acción
  const updateActionMutation = useMutation({
    mutationFn: ({ stepId, actionId, data }: { stepId: string; actionId: string; data: any }) => 
      updateAction(Number(materialId), Number(sessionId), Number(topicId), stepId, actionId, data),
    onSuccess: (updatedAction: StudyInteractiveExerciseAction) => {
      if (exercise && exercise.steps) {
        const updatedSteps = exercise.steps.map((step: StudyInteractiveExerciseStep) => {
          if (step.id === updatedAction.step_id) {
            return {
              ...step,
              actions: (step.actions || []).map((a: StudyInteractiveExerciseAction) => a.id === updatedAction.id ? updatedAction : a)
            }
          }
          return step
        })
        setExercise({ ...exercise, steps: updatedSteps })
      }
      addPendingChange({ type: 'update_action', actionId: updatedAction.id })
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
    }
  })

  // Eliminar acción
  const deleteActionMutation = useMutation({
    mutationFn: ({ stepId, actionId }: { stepId: string; actionId: string }) => 
      deleteAction(Number(materialId), Number(sessionId), Number(topicId), stepId, actionId),
    onSuccess: (_, { stepId, actionId }: { stepId: string; actionId: string }) => {
      if (exercise && exercise.steps) {
        const updatedSteps = exercise.steps.map((step: StudyInteractiveExerciseStep) => {
          if (step.id === stepId) {
            return { ...step, actions: (step.actions || []).filter((a: StudyInteractiveExerciseAction) => a.id !== actionId) }
          }
          return step
        })
        setExercise({ ...exercise, steps: updatedSteps })
      }
      addPendingChange({ type: 'delete_action', actionId })
      setSelectedAction(null)
    }
  })

  // Mutation para reordenar pasos
  const reorderStepMutation = useMutation({
    mutationFn: async ({ stepId, newStepNumber }: { stepId: string; newStepNumber: number }) => {
      return updateStep(Number(materialId), Number(sessionId), Number(topicId), stepId, { step_number: newStepNumber })
    },
    onSuccess: (_response, variables) => {
      addPendingChange({ type: 'reorder_step', stepId: variables.stepId, stepNumber: variables.newStepNumber })
      // Try to sync local exercise state from the cached topic data
      try {
        const cached = queryClient.getQueryData(['study-topic', materialId, sessionId, topicId]) as any
        const latestExercise = cached?.interactive_exercise
        if (latestExercise) {
          setExercise(latestExercise)
        } else {
          queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
        }
      } catch (err) {
        // fallback to invalidation
        queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
      }
    },
    onError: (error) => {
      console.error('Error reordering step:', error)
    }
  })

  // Función para mover un paso hacia arriba
  const handleMoveStepUp = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (index === 0 || !exercise?.steps) return

    const currentStepItem = exercise.steps[index]
    const previousStep = exercise.steps[index - 1]

    // Intercambiar step_number
    const prevSteps = exercise.steps
    // Optimistic UI: swap positions locally
    const newSteps = [...prevSteps]
    // swap elements
    const tmp = newSteps[index - 1]
    newSteps[index - 1] = newSteps[index]
    newSteps[index] = tmp
    // swap their step_number values as well
    const aNumber = newSteps[index - 1].step_number
    newSteps[index - 1].step_number = newSteps[index].step_number
    newSteps[index].step_number = aNumber

    setExercise({ ...exercise, steps: newSteps })
    setCurrentStepIndex(index - 1)

    try {
      await reorderStepMutation.mutateAsync({ stepId: currentStepItem.id, newStepNumber: previousStep.step_number })
      await reorderStepMutation.mutateAsync({ stepId: previousStep.id, newStepNumber: currentStepItem.step_number })
    } catch (err) {
      // Revert optimistic update on error
      console.error('Error moving step up, reverting UI', err)
      setExercise({ ...exercise, steps: prevSteps })
      // refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
    }
  }

  // Función para mover un paso hacia abajo
  const handleMoveStepDown = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (!exercise?.steps || index === exercise.steps.length - 1) return

    const currentStepItem = exercise.steps[index]
    const nextStep = exercise.steps[index + 1]

    // Intercambiar step_number
    const prevSteps = exercise.steps
    // Optimistic UI: swap positions locally
    const newSteps = [...prevSteps]
    const tmp = newSteps[index + 1]
    newSteps[index + 1] = newSteps[index]
    newSteps[index] = tmp
    // swap their step_number values as well
    const aNumber = newSteps[index + 1].step_number
    newSteps[index + 1].step_number = newSteps[index].step_number
    newSteps[index].step_number = aNumber

    setExercise({ ...exercise, steps: newSteps })
    setCurrentStepIndex(index + 1)

    try {
      await reorderStepMutation.mutateAsync({ stepId: currentStepItem.id, newStepNumber: nextStep.step_number })
      await reorderStepMutation.mutateAsync({ stepId: nextStep.id, newStepNumber: currentStepItem.step_number })
    } catch (err) {
      console.error('Error moving step down, reverting UI', err)
      setExercise({ ...exercise, steps: prevSteps })
      queryClient.invalidateQueries({ queryKey: ['study-topic', materialId, sessionId, topicId] })
    }
  }

  const steps = exercise?.steps || []
  const currentStep = steps[currentStepIndex] as StudyInteractiveExerciseStep | undefined

  // Subir imagen al almacenamiento Hot
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('image', file)
    
    // Usar el endpoint de imágenes de study contents (Hot storage)
    const response = await api.post('/study-contents/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data.url
  }

  // Manejar subida de imagen (para paso existente o nuevo)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Mostrar preview local
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setLocalPreviewImage(result)
      
      // Obtener dimensiones
      const img = new Image()
      img.onload = async () => {
        try {
          setIsCreatingStep(true)
          
          // Si no hay ejercicio, crearlo primero
          if (!exercise) {
            await createExerciseMutation.mutateAsync()
          }
          
          // Subir imagen
          const imageUrl = await uploadImage(file)
          
          // Crear paso
          await createStepMutation.mutateAsync({
            image_url: imageUrl,
            image_width: img.width,
            image_height: img.height
          })
        } catch (error) {
          console.error('Error al subir imagen:', error)
          setIsCreatingStep(false)
          setLocalPreviewImage(null)
        }
      }
      img.src = result
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
      const isTextInput = selectedTool === 'text_input'
      
      // Validar que solo haya una respuesta correcta por paso
      const hasCorrectAnswer = currentActions.some(a => 
        (a.action_type === 'button' && a.correct_answer === 'correct') ||
        (a.action_type === 'text_input' && a.correct_answer && a.correct_answer.trim() !== '')
      )
      
      if ((isCorrectButton || isTextInput) && hasCorrectAnswer) {
        setWarningModal({
          isOpen: true,
          title: 'Respuesta correcta ya existe',
          message: 'Este paso ya tiene una respuesta correcta configurada. Solo puede haber un botón correcto o un campo de texto con respuesta por cada paso del ejercicio.'
        })
        setDrawingState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
        return
      }
      
      const newAction = {
        action_type: isButton ? 'button' : 'text_input',
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
  const handleActionMouseDown = (e: React.MouseEvent, action: StudyInteractiveExerciseAction) => {
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
    if (dragState.isDragging && dragState.actionId && currentStep) {
      const actionEl = document.querySelector(`[data-action-id="${dragState.actionId}"]`) as HTMLElement
      if (actionEl) {
        const left = parseFloat(actionEl.style.left)
        const top = parseFloat(actionEl.style.top)
        
        updateActionMutation.mutate({
          stepId: currentStep.id,
          actionId: dragState.actionId,
          data: { position_x: left, position_y: top }
        })
      }
    }

    if (resizeState.isResizing && resizeState.actionId && currentStep) {
      const actionEl = document.querySelector(`[data-action-id="${resizeState.actionId}"]`) as HTMLElement
      if (actionEl) {
        const width = parseFloat(actionEl.style.width)
        const height = parseFloat(actionEl.style.height)
        
        updateActionMutation.mutate({
          stepId: currentStep.id,
          actionId: resizeState.actionId,
          data: { width, height }
        })
      }
    }

    setDragState({ isDragging: false, actionId: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 })
    setResizeState({ isResizing: false, actionId: null, corner: null, startX: 0, startY: 0, startWidth: 0, startHeight: 0 })
  }, [dragState, resizeState, currentStep, updateActionMutation])

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
  const handleResizeMouseDown = (e: React.MouseEvent, action: StudyInteractiveExerciseAction, corner: 'se') => {
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
  const handleEditAction = (action: StudyInteractiveExerciseAction) => {
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
      font_family: (action as any).font_family || 'Arial'
    })
    setIsEditActionModalOpen(true)
  }

  // Guardar cambios de acción
  const handleSaveAction = () => {
    if (!selectedAction || !currentStep) return
    
    // Preparar los datos, eliminando el placeholder si showPlaceholder es false
    const dataToSend = {
      ...actionFormData,
      placeholder: actionFormData.showPlaceholder ? actionFormData.placeholder : ''
    }
    
    // Eliminar showPlaceholder ya que no es un campo del backend
    const { showPlaceholder, ...backendData } = dataToSend
    
    updateActionMutation.mutate({
      stepId: currentStep.id,
      actionId: selectedAction.id,
      data: backendData
    })
    setIsEditActionModalOpen(false)
  }

  // Mostrar modal de confirmación para eliminar acción
  const handleDeleteAction = () => {
    if (!selectedAction || !currentStep) return
    
    // Determinar si es la respuesta correcta
    const isCorrect = selectedAction.action_type === 'button' 
      ? selectedAction.correct_answer === 'correct'
      : (selectedAction.correct_answer && selectedAction.correct_answer.trim() !== '')
    
    setDeleteActionModal({
      isOpen: true,
      actionId: selectedAction.id,
      actionType: selectedAction.action_type,
      isCorrect: !!isCorrect
    })
  }

  // Confirmar eliminación de acción
  const confirmDeleteAction = () => {
    if (!deleteActionModal.actionId || !currentStep) return
    deleteActionMutation.mutate({ stepId: currentStep.id, actionId: deleteActionModal.actionId })
    setDeleteActionModal({ isOpen: false, actionId: null, actionType: null, isCorrect: false })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
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
        onChange={handleImageUpload}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/study-contents/${materialId}`)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Volver"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {exercise?.title || 'Ejercicio Interactivo'}
              </h1>
              <button
                onClick={openExerciseInfoModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Editar título e instrucciones"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {topicData?.title || 'Cargando...'}
            </p>
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
                await saveExerciseMutation.mutateAsync({ is_active: true })
              } catch (err) {
                console.error(err)
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
          <button
            onClick={() => setSelectedTool('button')}
            className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'button' ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-100'}`}
            title="Agregar Botón Correcto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => setSelectedTool('button-wrong')}
            className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'button-wrong' ? 'bg-orange-600 text-white' : 'bg-white border hover:bg-gray-100'}`}
            title="Agregar Botón Incorrecto/Erróneo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => setSelectedTool('text_input')}
            className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'text_input' ? 'bg-green-600 text-white' : 'bg-white border hover:bg-gray-100'}`}
            title="Agregar Campo de Texto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
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
              onClick={handleDeleteAction}
              className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
            >
              Eliminar Acción
            </button>
          </div>
        )}

        <div className="flex-1"></div>

        <div className="flex items-center gap-2 text-sm">
          {selectedTool === 'button' && (
            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">
              ✅ Dibuja un área en la imagen para agregar un botón correcto
            </span>
          )}
          {selectedTool === 'button-wrong' && (
            <span className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg">
              ❌ Dibuja un área en la imagen para agregar un botón incorrecto
            </span>
          )}
          {selectedTool === 'text_input' && (
            <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
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
              steps.map((step: StudyInteractiveExerciseStep, index: number) => (
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
                              actionsCount: step.actions?.length || 0
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
                      <span className="text-gray-500">{step.actions?.length || 0} acción(es)</span>
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isCreatingStep}
              className="w-full px-4 py-3 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {isCreatingStep ? (
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
                  <div
                    ref={imageContainerRef}
                    className="relative bg-white shadow-2xl rounded-lg select-none mx-auto"
                    onMouseDown={handleImageMouseDown}
                    onMouseMove={handleImageMouseMove}
                    onMouseUp={handleImageMouseUp}
                    onMouseLeave={handleImageMouseUp}
                    style={{ cursor: selectedTool !== 'select' ? 'crosshair' : 'default', maxWidth: '1400px' }}
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
                    {currentStep.actions?.map((action: StudyInteractiveExerciseAction) => {
                      const isTextboxWithoutAnswer = action.action_type === 'text_input' && (!action.correct_answer || action.correct_answer.trim() === '')
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
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCreatingStep}
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
                    {currentStep.actions.map((action: StudyInteractiveExerciseAction) => {
                      const isTextboxWithoutAnswer = action.action_type === 'text_input' && (!action.correct_answer || action.correct_answer.trim() === '')
                      const isWrongButton = action.action_type === 'button' && action.correct_answer === 'wrong'
                      const isCorrectButton = action.action_type === 'button' && action.correct_answer === 'correct'
                      return (
                        <div
                          key={action.id}
                          onClick={() => setSelectedAction(action)}
                          className={`p-3 rounded-lg cursor-pointer transition-all border ${
                            selectedAction?.id === action.id
                              ? 'border-primary-500 bg-primary-50 shadow'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold ${
                              isCorrectButton 
                                ? 'bg-blue-600' 
                                : isWrongButton 
                                  ? 'bg-orange-600' 
                                  : isTextboxWithoutAnswer 
                                    ? 'bg-red-600' 
                                    : 'bg-green-600'
                            }`}>
                              {action.action_number}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium flex-1 ${
                              isCorrectButton
                                ? 'bg-blue-100 text-blue-700'
                                : isWrongButton
                                  ? 'bg-orange-100 text-orange-700'
                                  : isTextboxWithoutAnswer
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                            }`}>
                              {action.action_type === 'button' 
                                ? (isCorrectButton ? 'Botón Correcto' : 'Botón Incorrecto') 
                                : 'Campo de Texto'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Determinar si es la respuesta correcta
                                const actionIsCorrect = action.action_type === 'button' 
                                  ? action.correct_answer === 'correct'
                                  : (action.correct_answer && action.correct_answer.trim() !== '')
                                
                                setDeleteActionModal({
                                  isOpen: true,
                                  actionId: action.id,
                                  actionType: action.action_type,
                                  isCorrect: !!actionIsCorrect
                                })
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar acción"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <div className="text-sm">
                            {action.action_type === 'button' ? (
                              <div>
                                <p className="text-gray-700">{action.label || 'Sin etiqueta'}</p>
                                {isWrongButton && (
                                  <p className="text-xs text-orange-600 mt-1">⚠️ Respuesta incorrecta</p>
                                )}
                                {isCorrectButton && (
                                  <p className="text-xs text-blue-600 mt-1">✓ Respuesta correcta</p>
                                )}
                              </div>
                            ) : (
                              <>
                                <p className="text-gray-500 italic text-xs">{action.placeholder || 'Sin placeholder'}</p>
                                <p className={`mt-1 ${isTextboxWithoutAnswer ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                                  Respuesta: <span className={`font-medium ${isTextboxWithoutAnswer ? 'text-red-700' : 'text-green-700'}`}>
                                    {action.correct_answer || 'Sin definir'}
                                  </span>
                                </p>
                              </>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditAction(action)
                            }}
                            className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Editar configuración →
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Leyenda */}
              <div className="p-4 border-t bg-gray-50">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Tipos de acción</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-blue-500"></span>
                    <span className="text-gray-600">Botón: El alumno debe hacer clic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-green-500"></span>
                    <span className="text-gray-600">Texto: El alumno debe escribir</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Modal de confirmación para eliminar paso */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">¿Eliminar Paso {deleteConfirmModal.stepNumber}?</h3>
            <p className="text-gray-600 text-center mb-4">Esta acción no se puede deshacer. Se eliminará permanentemente:</p>

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
                  'Sí, Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar acción */}
      {isEditActionModalOpen && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Editar {selectedAction.action_type === 'button' ? 'Botón' : 'Campo de Texto'}
            </h3>
            
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
                    
                    {/* Checkbox para mostrar texto indicativo */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={actionFormData.showPlaceholder}
                          onChange={(e) => setActionFormData({ ...actionFormData, showPlaceholder: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700 font-medium">Mostrar texto indicativo en el botón</span>
                      </label>
                      <p className="text-xs text-gray-500 ml-6 mt-1">
                        El texto ayuda al estudiante a entender qué hacer
                      </p>
                    </div>

                    {/* Campo de texto indicativo (si está activado) */}
                    {actionFormData.showPlaceholder && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Texto Indicativo
                        </label>
                        <input
                          type="text"
                          value={actionFormData.placeholder}
                          onChange={(e) => setActionFormData({ ...actionFormData, placeholder: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Ej: Haz clic aquí"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Sección 2: Tipo de Respuesta */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Tipo de Respuesta
                    </h4>
                    
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-blue-50 ${actionFormData.correct_answer === 'correct' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
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
                          <p className="text-xs text-gray-500 mt-1 ml-7">Este botón representa una acción correcta</p>
                        </div>
                      </label>
                      
                      <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-orange-50 ${actionFormData.correct_answer === 'wrong' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
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
                  
                  {/* Sección 3: Configuración de acción en error (solo para botones incorrectos) */}
                  {actionFormData.correct_answer === 'wrong' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Acción cuando se seleccione este botón incorrecto
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
                                Después de este número de intentos adicionales, se avanzará automáticamente
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          placeholder="La respuesta que debe escribir el alumno"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Esta es la respuesta contra la cual se comparará lo que escriba el alumno
                        </p>
                      </div>

                      {/* Checkbox para mostrar texto indicativo */}
                      <div className="pt-2 border-t border-green-200">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={actionFormData.showPlaceholder}
                            onChange={(e) => setActionFormData({ ...actionFormData, showPlaceholder: e.target.checked })}
                            className="w-4 h-4 text-green-600 rounded"
                          />
                          <span className="text-sm text-gray-700 font-medium">Mostrar texto indicativo en el campo</span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6 mt-1">
                          El texto indicativo ayuda al estudiante a entender qué escribir
                        </p>
                      </div>

                      {/* Campo de texto indicativo (si está activado) */}
                      {actionFormData.showPlaceholder && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Texto Indicativo
                          </label>
                          <input
                            type="text"
                            value={actionFormData.placeholder}
                            onChange={(e) => setActionFormData({ ...actionFormData, placeholder: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                            placeholder="Ej: Escribe tu respuesta aquí"
                          />
                        </div>
                      )}
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

                  {/* Sección 3: Apariencia del Texto (solo si NO es similitud) */}
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

      {/* Modal para editar información del ejercicio (título e instrucciones) */}
      <Modal
        isOpen={isExerciseInfoModalOpen}
        onClose={() => setIsExerciseInfoModalOpen(false)}
        title="Configurar Ejercicio Interactivo"
        size="lg"
      >
        <div className="space-y-5">
          {/* Header descriptivo */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-indigo-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-indigo-800">Información del Ejercicio</h4>
                <p className="text-sm text-indigo-600 mt-1">
                  Configura el título y las instrucciones que verán los estudiantes antes de realizar el ejercicio interactivo.
                </p>
              </div>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título del ejercicio <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={exerciseInfoForm.title}
              onChange={(e) => setExerciseInfoForm({ ...exerciseInfoForm, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="Ej: Identifica las partes del motor"
            />
          </div>

          {/* Instrucciones con editor de texto enriquecido */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrucciones del ejercicio
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Describe qué debe hacer el estudiante para completar el ejercicio.
            </p>
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
              <ReactQuill
                theme="snow"
                value={exerciseInfoForm.description}
                onChange={(content) => setExerciseInfoForm({ ...exerciseInfoForm, description: content })}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'],
                    ['clean']
                  ],
                }}
                formats={[
                  'header',
                  'bold', 'italic', 'underline',
                  'color',
                  'list', 'bullet',
                  'link'
                ]}
                placeholder="Ej: Haz clic en cada parte señalada para identificar correctamente los componentes..."
                style={{ minHeight: '150px' }}
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
            <button 
              onClick={() => setIsExerciseInfoModalOpen(false)} 
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveExerciseInfo}
              disabled={isSavingExerciseInfo || !exerciseInfoForm.title.trim()}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              {isSavingExerciseInfo ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guardar Información
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmación para eliminar acción */}
      {deleteActionModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
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

      {/* Modal de advertencia */}
      {warningModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
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
    </div>
  )
}

export default StudyInteractiveExercisePage
