/**
 * Helpers, tipos y constantes del editor de ejercicios interactivos.
 * Extraídos de StudyInteractiveExercisePage para reducir su tamaño (refactor incremental).
 * Son piezas puras (sin estado ni JSX) reutilizables/testeables.
 */
import { StudyInteractiveExerciseAction } from '../../../services/studyContentService'

export const checkRectanglesOverlap = (
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean => {
  const rect1Right = rect1.x + rect1.width
  const rect1Bottom = rect1.y + rect1.height
  const rect2Right = rect2.x + rect2.width
  const rect2Bottom = rect2.y + rect2.height

  // No hay superposición si un rectángulo está completamente a la izquierda, derecha, arriba o abajo del otro
  return !(
    rect1Right <= rect2.x ||
    rect1.x >= rect2Right ||
    rect1Bottom <= rect2.y ||
    rect1.y >= rect2Bottom
  )
}

// Función para verificar si una nueva área se superpone con alguna existente
export const checkOverlapWithExistingActions = (
  newRect: { x: number; y: number; width: number; height: number },
  existingActions: StudyInteractiveExerciseAction[],
  excludeActionId?: string
): StudyInteractiveExerciseAction | null => {
  for (const action of existingActions) {
    // Excluir la acción que se está moviendo/redimensionando
    if (excludeActionId && action.id === excludeActionId) continue

    const actionRect = {
      x: action.position_x,
      y: action.position_y,
      width: action.width,
      height: action.height
    }

    if (checkRectanglesOverlap(newRect, actionRect)) {
      return action
    }
  }
  return null
}

// Helper para obtener el nombre del tipo de acción para mensajes de error
export const getActionTypeName = (action: StudyInteractiveExerciseAction): string => {
  if (action.action_type === 'comment') return 'comentario'
  if (action.action_type === 'text_input') return 'campo de texto'
  if (action.action_type === 'button') {
    return action.correct_answer === 'correct' ? 'botón correcto' : 'botón incorrecto'
  }
  return 'área'
}

export type Tool = 'select' | 'button' | 'button-wrong' | 'text_input' | 'comment'

export interface DragState {
  isDragging: boolean
  actionId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

export interface ResizeState {
  isResizing: boolean
  actionId: string | null
  corner: 'se' | 'sw' | 'ne' | 'nw' | null
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  startPositionX: number
  startPositionY: number
}

// Estado para crear área con arrastre (rubber band selection)
export interface DrawingState {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

// Estado para arrastrar el puntero del comentario (la flecha)
export interface PointerDragState {
  isDragging: boolean
  actionId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

// Constantes de configuración del editor
export const EDITOR_CONFIG = {
  MIN_AREA_WIDTH: 0.5,    // Porcentaje mínimo de ancho para crear área (muy pequeño para permitir botones pequeños)
  MIN_AREA_HEIGHT: 0.5,   // Porcentaje mínimo de alto para crear área
  MIN_RESIZE_WIDTH: 0.5,  // Porcentaje mínimo al redimensionar
  MIN_RESIZE_HEIGHT: 0.5, // Porcentaje mínimo al redimensionar
  ZOOM_LEVELS: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3],
  DEFAULT_ZOOM: 1
}

// Ancho de referencia para escalar las medidas en px de los comentarios
// (fuente, borde, radio, punta del bocadillo). Las cajas son porcentuales, así que
// para que el comentario ocupe la MISMA fracción de la imagen aquí y en el
// reproductor (StudyContentPreviewPage usa el mismo valor), ambos escalan por
// (ancho mostrado de la imagen / este valor). El valor en sí se cancela entre
// editor y reproductor: lo importante es que sea idéntico en ambos.
export const COMMENT_REFERENCE_WIDTH = 1400
