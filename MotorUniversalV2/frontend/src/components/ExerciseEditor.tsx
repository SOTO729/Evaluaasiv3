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
    mutationFn: (data: { title?: string; description?: string }) => 
      examService.createExerciseStep(exercise.id, data),
    onSuccess: () => {
      refetch()
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

  // Handler para crear nuevo paso
  const handleCreateStep = () => {
    createStepMutation.mutate({ title: `Paso ${steps.length + 1}` })
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Editor de Ejercicio</h2>
            <p className="text-sm text-gray-500">{exercise.exercise_text || 'Sin título'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Herramientas:</span>
            <button
              onClick={() => setSelectedTool('select')}
              className={`p-2 rounded-lg ${selectedTool === 'select' ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}
              title="Seleccionar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedTool('button')}
              className={`p-2 rounded-lg ${selectedTool === 'button' ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}
              title="Agregar Botón"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedTool('textbox')}
              className={`p-2 rounded-lg ${selectedTool === 'textbox' ? 'bg-primary-100 text-primary-700' : 'bg-white border hover:bg-gray-50'}`}
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
                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                Editar Respuesta
              </button>
              <button
                onClick={() => {
                  if (confirm('¿Eliminar esta acción?')) {
                    deleteActionMutation.mutate(selectedAction.id)
                  }
                }}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Eliminar
              </button>
            </div>
          )}

          <div className="flex-1"></div>

          <span className="text-sm text-gray-500">
            {selectedTool === 'button' && 'Haz clic en la imagen para agregar un botón'}
            {selectedTool === 'textbox' && 'Haz clic en la imagen para agregar un campo de texto'}
            {selectedTool === 'select' && 'Arrastra los elementos para moverlos'}
          </span>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Steps sidebar */}
          <div className="w-48 border-r bg-gray-50 flex flex-col">
            <div className="p-3 border-b">
              <h3 className="text-sm font-medium text-gray-700">Pasos ({steps.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {steps.map((step: ExerciseStep, index: number) => (
                <div
                  key={step.id}
                  onClick={() => setCurrentStepIndex(index)}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    currentStepIndex === index
                      ? 'bg-primary-100 border-2 border-primary-500'
                      : 'bg-white border hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Paso {step.step_number}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('¿Eliminar este paso?')) {
                          deleteStepMutation.mutate(step.id)
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {step.image_url && (
                    <div className="mt-2 aspect-video bg-gray-200 rounded overflow-hidden">
                      <img src={step.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {step.total_actions} acción(es)
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t">
              <button
                onClick={handleCreateStep}
                disabled={createStepMutation.isPending}
                className="w-full px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                + Agregar Paso
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 p-4 overflow-auto bg-gray-100">
            {currentStep ? (
              <div className="max-w-4xl mx-auto">
                {currentStep.image_url ? (
                  <div
                    ref={imageContainerRef}
                    className="relative bg-white shadow-lg cursor-crosshair"
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
                        className={`absolute border-2 rounded cursor-move transition-colors ${
                          selectedAction?.id === action.id
                            ? 'border-primary-500 bg-primary-100 bg-opacity-50'
                            : action.action_type === 'button'
                            ? 'border-blue-500 bg-blue-100 bg-opacity-30 hover:bg-opacity-50'
                            : 'border-green-500 bg-green-100 bg-opacity-30 hover:bg-opacity-50'
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
                            <span className="text-blue-700">{action.label || 'Botón'}</span>
                          ) : (
                            <span className="text-green-700 italic">{action.placeholder || 'Texto'}</span>
                          )}
                        </div>
                        
                        {/* Resize handle */}
                        {selectedAction?.id === action.id && (
                          <div
                            className="absolute bottom-0 right-0 w-3 h-3 bg-primary-500 cursor-se-resize"
                            onMouseDown={(e) => handleResizeMouseDown(e, action, 'se')}
                          />
                        )}
                        
                        {/* Action number badge */}
                        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center">
                          {action.action_number}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                    <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-4 text-gray-600">No hay imagen para este paso</p>
                    <label className="mt-4 inline-block">
                      <span className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
                        Subir Imagen
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                )}
                
                {/* Botón para cambiar imagen */}
                {currentStep.image_url && (
                  <div className="mt-4 text-center">
                    <label className="inline-block">
                      <span className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer">
                        Cambiar Imagen
                      </span>
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
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="mt-4 text-gray-600">No hay pasos en este ejercicio</p>
                  <button
                    onClick={handleCreateStep}
                    className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Crear Primer Paso
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions panel */}
          {currentStep && currentStep.actions && currentStep.actions.length > 0 && (
            <div className="w-72 border-l bg-gray-50 flex flex-col">
              <div className="p-3 border-b">
                <h3 className="text-sm font-medium text-gray-700">
                  Acciones del Paso {currentStep.step_number}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {currentStep.actions.map((action: ExerciseAction) => (
                  <div
                    key={action.id}
                    onClick={() => setSelectedAction(action)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedAction?.id === action.id
                        ? 'bg-primary-100 border-2 border-primary-500'
                        : 'bg-white border hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-gray-800 text-white text-xs flex items-center justify-center">
                        {action.action_number}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        action.action_type === 'button'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {action.action_type === 'button' ? 'Botón' : 'Texto'}
                      </span>
                    </div>
                    <div className="text-sm">
                      {action.action_type === 'button' ? (
                        <p className="text-gray-700">{action.label || 'Sin etiqueta'}</p>
                      ) : (
                        <>
                          <p className="text-gray-500 italic text-xs">{action.placeholder || 'Sin placeholder'}</p>
                          <p className="text-gray-700 mt-1">
                            Respuesta: <span className="font-medium">{action.correct_answer || '(no definida)'}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {steps.length} paso(s) • {currentStep?.actions?.length || 0} acción(es) en el paso actual
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              Cerrar
            </button>
          </div>
        </div>
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
