import { api } from './api'
import type { User } from '../types'

export interface CurpValidationSuccess {
  valid: true
  curp: string
  generic_foreign?: boolean
  message: string
  data?: {
    name?: string
    first_surname?: string
    second_surname?: string
    gender?: string
  }
  user?: User
}

export interface CurpValidationPending {
  verifying: true
  curp: string
  message: string
}

export interface CurpValidationFailure {
  valid: false
  curp: string
  error: string
  reason?: 'format' | 'duplicate' | 'renapo' | 'service_unavailable' | 'persist'
}

export type CurpValidationResult =
  | CurpValidationSuccess
  | CurpValidationPending
  | CurpValidationFailure

/**
 * El candidato envía su CURP para autovalidarse.
 *
 * - Si la CURP es genérica de extranjero: respuesta inmediata 200 con `valid: true`.
 * - Si formato/duplicado falla: respuesta 4xx con `valid: false`.
 * - Si pasa los chequeos rápidos: la verificación contra RENAPO se ejecuta en
 *   segundo plano (hasta 6 rondas con 7 reintentos internos cada una). El
 *   endpoint regresa 202 con `verifying: true` y el frontend debe hacer polling
 *   a `getOwnCurpStatus()` hasta que `verifying === false`.
 */
export async function submitOwnCurp(curp: string): Promise<CurpValidationResult> {
  try {
    const response = await api.post<CurpValidationSuccess | CurpValidationPending>(
      '/user-management/me/validate-curp',
      { curp: curp.trim().toUpperCase() }
    )
    return response.data
  } catch (err: any) {
    const data = err?.response?.data || {}
    return {
      valid: false,
      curp: curp.trim().toUpperCase(),
      error: data.error || 'Error desconocido validando CURP',
      reason: data.reason,
    }
  }
}

export interface CurpStatus {
  user_id: string
  curp: string | null
  curp_verified: boolean
  curp_verified_at: string | null
  verifying: boolean
  requires_validation: boolean
  group_member_statuses: string[]
}

export async function getOwnCurpStatus(): Promise<CurpStatus> {
  const response = await api.get('/user-management/me/curp-status')
  return response.data as CurpStatus
}
