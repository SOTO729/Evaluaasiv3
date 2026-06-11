import { describe, it, expect } from 'vitest'
import { getLabelStyleInfo, styleHasText } from './LabelStyle'

describe('getLabelStyleInfo', () => {
  it('invisible', () => {
    expect(getLabelStyleInfo('invisible').name).toBe('Invisible')
  })
  it('text_only', () => {
    expect(getLabelStyleInfo('text_only').name).toBe('Texto sin sombra')
  })
  it('text_with_shadow', () => {
    expect(getLabelStyleInfo('text_with_shadow').name).toBe('Texto con sombra')
  })
  it('shadow_only', () => {
    expect(getLabelStyleInfo('shadow_only').name).toBe('Solo sombra')
  })
  it('undefined → Invisible (por defecto)', () => {
    expect(getLabelStyleInfo(undefined).name).toBe('Invisible')
  })
})

describe('styleHasText', () => {
  it('text_only tiene texto', () => expect(styleHasText('text_only')).toBe(true))
  it('text_with_shadow tiene texto', () => expect(styleHasText('text_with_shadow')).toBe(true))
  it('invisible no tiene texto', () => expect(styleHasText('invisible')).toBe(false))
  it('shadow_only no tiene texto', () => expect(styleHasText('shadow_only')).toBe(false))
  it('undefined no tiene texto', () => expect(styleHasText(undefined)).toBe(false))
})
