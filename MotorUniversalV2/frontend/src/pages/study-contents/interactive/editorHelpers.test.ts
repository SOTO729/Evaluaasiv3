import { describe, it, expect } from 'vitest'
import {
  checkRectanglesOverlap,
  checkOverlapWithExistingActions,
  getActionTypeName,
} from './editorHelpers'

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

describe('checkRectanglesOverlap', () => {
  it('detecta superposición cuando se solapan', () => {
    expect(checkRectanglesOverlap(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true)
  })

  it('uno contenido dentro del otro se considera superpuesto', () => {
    expect(checkRectanglesOverlap(rect(0, 0, 20, 20), rect(5, 5, 5, 5))).toBe(true)
  })

  it('no se superponen si están separados', () => {
    expect(checkRectanglesOverlap(rect(0, 0, 10, 10), rect(20, 20, 5, 5))).toBe(false)
  })

  it('bordes que apenas se tocan NO cuentan como superposición', () => {
    expect(checkRectanglesOverlap(rect(0, 0, 10, 10), rect(10, 0, 5, 5))).toBe(false)
  })
})

describe('checkOverlapWithExistingActions', () => {
  const actions = [
    { id: 'a', position_x: 0, position_y: 0, width: 10, height: 10 },
    { id: 'b', position_x: 40, position_y: 40, width: 10, height: 10 },
  ] as any

  it('devuelve la acción que se superpone', () => {
    expect(checkOverlapWithExistingActions(rect(5, 5, 5, 5), actions)?.id).toBe('a')
  })

  it('excluye la acción indicada (la que se está moviendo/redimensionando)', () => {
    expect(checkOverlapWithExistingActions(rect(5, 5, 5, 5), actions, 'a')).toBeNull()
  })

  it('devuelve null cuando no hay superposición con ninguna', () => {
    expect(checkOverlapWithExistingActions(rect(20, 20, 5, 5), actions)).toBeNull()
  })
})

describe('getActionTypeName', () => {
  it('comentario', () => {
    expect(getActionTypeName({ action_type: 'comment' } as any)).toBe('comentario')
  })
  it('campo de texto', () => {
    expect(getActionTypeName({ action_type: 'text_input' } as any)).toBe('campo de texto')
  })
  it('botón correcto', () => {
    expect(getActionTypeName({ action_type: 'button', correct_answer: 'correct' } as any)).toBe('botón correcto')
  })
  it('botón incorrecto', () => {
    expect(getActionTypeName({ action_type: 'button', correct_answer: 'wrong' } as any)).toBe('botón incorrecto')
  })
  it('otro tipo → área', () => {
    expect(getActionTypeName({ action_type: 'unknown' } as any)).toBe('área')
  })
})
