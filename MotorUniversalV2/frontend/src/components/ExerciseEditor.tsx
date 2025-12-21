import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { examService } from '../services/examService'
import type { Exercise, ExerciseStep, ExerciseAction } from '../types'

interface ExerciseEditorProps {
  exercise: Exercise
  onClose: () => void
}

type Tool = 'select' | 'button' | 'textbox'

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

const ExerciseEditor = ({ exercise, onClose }: ExerciseEditorProps) => {
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Estados principales
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [selectedTool, setSelectedTool] = useState<Tool>('select')
  const [selectedAction, setSelectedAction] = useState<ExerciseAction | null>(null)
  
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
  
  // Modal para editar acción
  const [isEditActionModalOpen, setIsEditActionModalOpen] = useState(false)
  const [actionFormData, setActionFormData] = useState({
    label: '',
    placeholder: '',
    correct_answer: '',
    is_case_sensitive: false
  })

  // Query para obtener los detalles del ejercicio con steps y actions
  const { data: exerciseData, isLoading, refetch } = useQuery({
    queryKey: ['exercise-details', exercise.id],
    queryFn: () => examService.getExerciseDetails(exercise.id),
  })

  const steps = exerciseData?.exercise?.steps || []
  const currentStep = steps[currentStepIndex] as ExerciseStep | undefined

  // Mutations
  const createStepMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string; image_url?: string; image_width?: number; image_height?: number }) => 
      examService.createExerciseStep(exercise.id, data),
    onSuccess: () => {
      refetch()
      // Navegar al nuevo paso creado
      setTimeout(() => {
        setCurrentStepIndex(steps.length)
      }, 100)
    },
  })

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => examService.deleteExerciseStep(stepId),
    onSuccess: () => {
      refetch()
      if (currentStepIndex >= steps.length - 1 && currentStepIndex > 0) {
        setCurrentStepIndex(currentStepIndex - 1)
      }
    },
  })

  const uploadImageMutation = useMutation({
    mutationFn: ({ stepId, imageData, width, height }: { stepId: string; imageData: string; width: number; height: number }) =>
      examService.uploadStepImage(stepId, imageData, width, height),
    onSuccess: () => refetch(),
  })

  const createActionMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: any }) =>
      examService.createStepAction(stepId, data),
    onSuccess: () => refetch(),
  })

  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: any }) =>
      examService.updateStepAction(actionId, data),
    onSuccess: () => refetch(),
  })

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: string) => examService.deleteStepAction(actionId),
    onSuccess: () => {
      refetch()
      setSelectedAction(null)
    },
  })

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

  // Handler para clic en la imagen (crear nueva acción)
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'select' || !currentStep || !imageContainerRef.current) return

    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newAction = {
      action_type: selectedTool as 'button' | 'textbox',
      position_x: Math.max(0, Math.min(90, x - 5)), // Centrar el elemento
      position_y: Math.max(0, Math.min(90, y - 2.5)),
      width: selectedTool === 'button' ? 10 : 15,
      height: selectedTool === 'button' ? 5 : 4,
      label: selectedTool === 'button' ? 'Clic aquí' : '',
      placeholder: selectedTool === 'textbox' ? 'Escribe aquí...' : '',
      correct_answer: '',
      is_case_sensitive: false
    }

    createActionMutation.mutate({ stepId: currentStep.id, data: newAction })
    setSelectedTool('select')
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
      is_case_sensitive: action.is_case_sensitive
    })
    setIsEditActionModalOpen(true)
  }

  const handleSaveAction = () => {
    if (!selectedAction) return
    
    updateActionMutation.mutate({
      actionId: selectedAction.id,
      data: actionFormData
    })
    setIsEditActionModalOpen(false)
  }

  // Handler para seleccionar imagen para nuevo paso
  const handleNewStepImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Crear el paso con la imagen directamente
        createStepMutation.mutate({
          title: `Paso ${steps.length + 1}`,
          image_url: event.target?.result as string,
          image_width: img.width,
          image_height: img.height
        })
      }
      img.src = event.target?.result as string
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Cargando editor...</p>
        </div>
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
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Volver"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Editor de Ejercicio</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {exercise.title || exercise.exercise_text?.replace(/<[^>]*>/g, '').substring(0, 50) || 'Sin título'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {steps.length} paso(s) • {currentStep?.actions?.length || 0} acción(es) en paso actual
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Guardar y Salir
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
              title="Agregar Botón (área de clic)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedTool('textbox')}
              className={`p-2.5 rounded-lg transition-colors ${selectedTool === 'textbox' ? 'bg-green-600 text-white' : 'bg-white border hover:bg-gray-100'}`}
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
                onClick={() => {
                  if (confirm('¿Eliminar esta acción?')) {
                    deleteActionMutation.mutate(selectedAction.id)
                  }
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
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">
                🖱️ Haz clic en la imagen para agregar un área de clic
              </span>
            )}
            {selectedTool === 'textbox' && (
              <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg">
                ✏️ Haz clic en la imagen para agregar un campo de texto
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
              {steps.length === 0 ? (
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('¿Eliminar este paso y todas sus acciones?')) {
                              deleteStepMutation.mutate(step.id)
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
          <div className="flex-1 overflow-auto bg-gray-100 p-6">
            {currentStep ? (
              <div className="max-w-5xl mx-auto">
                {currentStep.image_url ? (
                  <>
                    <div
                      ref={imageContainerRef}
                      className="relative bg-white shadow-xl rounded-lg overflow-hidden"
                      onClick={handleImageClick}
                      style={{ cursor: selectedTool !== 'select' ? 'crosshair' : 'default' }}
                    >
                      <img
                        src={currentStep.image_url}
                        alt={`Paso ${currentStep.step_number}`}
                        className="w-full h-auto"
                        draggable={false}
                      />
                      
                      {/* Actions overlay */}
                      {currentStep.actions?.map((action: ExerciseAction) => (
                        <div
                          key={action.id}
                          data-action-id={action.id}
                          className={`absolute border-2 rounded cursor-move transition-all ${
                            selectedAction?.id === action.id
                              ? 'border-primary-500 bg-primary-200 bg-opacity-50 shadow-lg'
                              : action.action_type === 'button'
                              ? 'border-blue-500 bg-blue-200 bg-opacity-40 hover:bg-opacity-60'
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
                              <span className="text-blue-800">{action.label || 'Clic'}</span>
                            ) : (
                              <span className="text-green-800 italic">{action.placeholder || 'Texto'}</span>
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
                            action.action_type === 'button' ? 'bg-blue-600' : 'bg-green-600'
                          }`}>
                            {action.action_number}
                          </div>
                        </div>
                      ))}
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
                    {currentStep.actions.map((action: ExerciseAction) => (
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
                            action.action_type === 'button' ? 'bg-blue-600' : 'bg-green-600'
                          }`}>
                            {action.action_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            action.action_type === 'button'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {action.action_type === 'button' ? 'Botón' : 'Campo de Texto'}
                          </span>
                        </div>
                        <div className="text-sm">
                          {action.action_type === 'button' ? (
                            <p className="text-gray-700">{action.label || 'Sin etiqueta'}</p>
                          ) : (
                            <>
                              <p className="text-gray-500 italic text-xs">{action.placeholder || 'Sin placeholder'}</p>
                              <p className="text-gray-700 mt-1">
                                Respuesta: <span className="font-medium text-green-700">{action.correct_answer || '(no definida)'}</span>
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
                    ))}
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

      {/* Modal para editar acción */}
      {isEditActionModalOpen && selectedAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Editar {selectedAction.action_type === 'button' ? 'Botón' : 'Campo de Texto'}
            </h3>
            
            <div className="space-y-4">
              {selectedAction.action_type === 'button' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Etiqueta del Botón
                  </label>
                  <input
                    type="text"
                    value={actionFormData.label}
                    onChange={(e) => setActionFormData({ ...actionFormData, label: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Ej: Clic aquí"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={actionFormData.placeholder}
                      onChange={(e) => setActionFormData({ ...actionFormData, placeholder: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Texto que verá el alumno"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Respuesta Correcta *
                    </label>
                    <input
                      type="text"
                      value={actionFormData.correct_answer}
                      onChange={(e) => setActionFormData({ ...actionFormData, correct_answer: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="La respuesta que debe escribir el alumno"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={actionFormData.is_case_sensitive}
                        onChange={(e) => setActionFormData({ ...actionFormData, is_case_sensitive: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Sensible a mayúsculas/minúsculas</span>
                    </label>
                  </div>
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
    </div>
  )
}

export default ExerciseEditor
