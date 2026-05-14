/**
 * Validación local de CURP (formato + dígito verificador).
 *
 * Replica la misma lógica que usa user-management para dar
 * retroalimentación inmediata al usuario antes de enviarla al backend.
 *
 * Reglas:
 *  - 18 caracteres
 *  - Formato: 4 letras + 6 dígitos (fecha) + H|M + 5 letras (entidad+consonantes)
 *             + [A-Z0-9] (homoclave) + 1 dígito (verificador)
 *  - El dígito verificador se calcula con el algoritmo oficial RENAPO:
 *      sumValue(c_i) * (18 - i)   para i = 0..16
 *      digit = (10 - (suma % 10)) % 10
 *    donde los caracteres se mapean a:
 *      0..9 -> 0..9, A=10, B=11, ..., Z=36 (Ñ=24)
 */

const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/

const CHAR_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 18,
  J: 19, K: 20, L: 21, M: 22, N: 23, Ñ: 24, O: 25, P: 26, Q: 27,
  R: 28, S: 29, T: 30, U: 31, V: 32, W: 33, X: 34, Y: 35, Z: 36,
}

export type CurpValidationIssue =
  | 'empty'
  | 'length'
  | 'format'
  | 'date'
  | 'gender'
  | 'check_digit'

export interface CurpLocalValidation {
  /** Mayúsculas y sin espacios. */
  normalized: string
  /** Pasa formato + dígito verificador + fecha válida. */
  valid: boolean
  /** El formato regex coincide (sin todavía verificar el dígito). */
  formatOk: boolean
  /** El dígito verificador es correcto. */
  checkDigitOk: boolean
  /** Razón principal por la que falla, si falla. */
  issue?: CurpValidationIssue
  /** Mensaje legible para mostrar al usuario. */
  message?: string
}

/**
 * Calcula el dígito verificador esperado para los primeros 17 caracteres
 * de una CURP normalizada. Devuelve `null` si algún carácter no es válido.
 */
export function computeCurpCheckDigit(curp17: string): number | null {
  if (curp17.length < 17) return null
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const ch = curp17[i]
    const value = CHAR_VALUES[ch]
    if (value === undefined) return null
    sum += value * (18 - i)
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Valida CURP localmente. No consulta servicios externos.
 * Pensado para retroalimentación inmediata en formularios.
 */
export function validateCurpLocal(input: string): CurpLocalValidation {
  const normalized = (input || '').trim().toUpperCase()

  if (!normalized) {
    return {
      normalized,
      valid: false,
      formatOk: false,
      checkDigitOk: false,
      issue: 'empty',
      message: 'Ingresa tu CURP.',
    }
  }

  if (normalized.length !== 18) {
    return {
      normalized,
      valid: false,
      formatOk: false,
      checkDigitOk: false,
      issue: 'length',
      message: `La CURP debe tener exactamente 18 caracteres (tiene ${normalized.length}).`,
    }
  }

  if (!CURP_REGEX.test(normalized)) {
    return {
      normalized,
      valid: false,
      formatOk: false,
      checkDigitOk: false,
      issue: 'format',
      message:
        'El formato no es válido. Revisa que sean 4 letras, 6 dígitos de fecha (AAMMDD), H o M, 5 letras, 1 carácter alfanumérico y 1 dígito.',
    }
  }

  // Verificar que la fecha (posiciones 4..9 = AAMMDD) sea coherente
  const yy = parseInt(normalized.slice(4, 6), 10)
  const mm = parseInt(normalized.slice(6, 8), 10)
  const dd = parseInt(normalized.slice(8, 10), 10)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || Number.isNaN(yy)) {
    return {
      normalized,
      valid: false,
      formatOk: true,
      checkDigitOk: false,
      issue: 'date',
      message: 'La fecha de nacimiento (caracteres 5–10) no es válida.',
    }
  }

  // Género
  const gender = normalized[10]
  if (gender !== 'H' && gender !== 'M') {
    return {
      normalized,
      valid: false,
      formatOk: true,
      checkDigitOk: false,
      issue: 'gender',
      message: 'El carácter 11 debe ser H (hombre) o M (mujer).',
    }
  }

  // Dígito verificador
  const expected = computeCurpCheckDigit(normalized.slice(0, 17))
  const actual = parseInt(normalized[17], 10)
  if (expected === null || expected !== actual) {
    return {
      normalized,
      valid: false,
      formatOk: true,
      checkDigitOk: false,
      issue: 'check_digit',
      message:
        'El dígito verificador (último carácter) no coincide. Revisa que escribiste tu CURP exactamente como aparece en tu documento oficial.',
    }
  }

  return {
    normalized,
    valid: true,
    formatOk: true,
    checkDigitOk: true,
  }
}
