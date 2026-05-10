/**
 * Helpers para manejo uniforme de errores HTTP del backend Partners y similares.
 * - 409 con error_type='integrity_violation' (M8 backend) -> mensaje específico.
 * - 403 multi-tenant (H1/H5 backend) -> aviso de permisos.
 * - 400 / 422 -> mensaje del backend si lo trae.
 * - 0 / network errors -> aviso de conexión.
 */
export interface ApiErrorLike {
  response?: {
    status?: number
    data?: {
      error?: string
      error_type?: string
      detail?: string
      message?: string
    }
  }
  message?: string
}

export const getDetailedErrorMessage = (
  error: ApiErrorLike | unknown,
  fallback = 'Ocurrió un error en la operación. Intenta nuevamente.'
): string => {
  const err = (error as ApiErrorLike) || {}
  const status = err.response?.status
  const data = err.response?.data || {}

  // 409: conflicto/integridad (típicamente duplicado)
  if (status === 409) {
    if (data.error_type === 'integrity_violation') {
      return (
        data.error ||
        'Ya existe un registro con esos datos (duplicado). Verifica los campos únicos.'
      )
    }
    return data.error || 'Conflicto al guardar. Verifica los datos.'
  }

  // 403: multi-tenant denegado
  if (status === 403) {
    return data.error || 'No tienes permiso para acceder a este recurso.'
  }

  // 404
  if (status === 404) {
    return data.error || 'Recurso no encontrado.'
  }

  // 400 / 422: validación
  if (status === 400 || status === 422) {
    return data.error || data.message || 'Datos inválidos. Revisa el formulario.'
  }

  // 429: rate limit
  if (status === 429) {
    return 'Demasiadas peticiones. Espera unos segundos e intenta de nuevo.'
  }

  // 5xx
  if (status && status >= 500) {
    return data.error || 'El servidor tuvo un problema. Intenta nuevamente.'
  }

  // Network / timeout / sin respuesta
  if (!status) {
    return 'No se pudo conectar al servidor. Revisa tu conexión.'
  }

  return data.error || fallback
}

/**
 * True si el error parece transitorio (idempotente para retry).
 */
export const isTransientError = (error: ApiErrorLike | unknown): boolean => {
  const err = (error as ApiErrorLike) || {}
  const status = err.response?.status
  return status === 502 || status === 503 || status === 504 || status === 408
}
