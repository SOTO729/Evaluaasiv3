import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertCircle, Loader2, CheckCircle2, XCircle, Lock, BadgeCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { submitOwnCurp, getOwnCurpStatus } from '../../services/curpValidationService'
import { validateCurpLocal } from '../../utils/curp'

export default function MiCurpPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [curp, setCurp] = useState((user?.curp || '').toUpperCase())
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [pollAttempts, setPollAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [renapoData, setRenapoData] = useState<{
    name?: string
    first_surname?: string
    second_surname?: string
    gender?: string
  } | null>(null)
  /** Confirma que el usuario aceptó que los datos de la CURP son suyos. */
  const [accepted, setAccepted] = useState(false)
  const pollTimerRef = useRef<number | null>(null)

  const alreadyVerified = !!user?.curp_verified

  // Validación local en vivo (formato + dígito verificador)
  const localValidation = useMemo(() => validateCurpLocal(curp), [curp])

  // Limpieza del timer al desmontar
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [])

  // Si la página se carga y el usuario ya tiene una verificación en curso
  // (group_member.status = 'curp_verifying') retomamos el polling.
  useEffect(() => {
    let cancelled = false
    async function checkInitial() {
      try {
        const st = await getOwnCurpStatus()
        if (cancelled) return
        if (st.curp_verified) {
          // Por si entró aquí pero ya está verificado en backend
          if (user) {
            updateUser({ ...user, curp: st.curp || user.curp, curp_verified: true, requires_curp_validation: false })
          }
          return
        }
        if (st.verifying) {
          setVerifying(true)
          setCurp((st.curp || '').toUpperCase())
          startPolling()
        }
      } catch {
        /* noop */
      }
    }
    if (!alreadyVerified) {
      checkInitial()
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startPolling() {
    // Polling cada 4s; tope ~10 minutos (150 intentos) para no quedar abierto eternamente.
    const tick = async () => {
      try {
        const st = await getOwnCurpStatus()
        setPollAttempts((n) => n + 1)
        if (st.curp_verified) {
          // ¡Éxito!
          setVerifying(false)
          setSuccess('CURP validada exitosamente. Ya puedes continuar.')
          if (user) {
            updateUser({ ...user, curp: st.curp || user.curp, curp_verified: true, requires_curp_validation: false })
          }
          setTimeout(() => navigate('/dashboard'), 2500)
          return
        }
        if (!st.verifying) {
          // Background terminó sin éxito → group_member volvió a 'curp_required'
          setVerifying(false)
          setError(
            'No pudimos validar tu CURP contra RENAPO después de varios intentos. ' +
              'Verifica que esté bien escrita o intenta de nuevo en unos minutos.'
          )
          return
        }
        // Sigue verificando → reagendar
        if (pollAttempts < 150) {
          pollTimerRef.current = window.setTimeout(tick, 4000)
        } else {
          setVerifying(false)
          setError(
            'La validación está tardando demasiado. Recarga la página más tarde para ver el resultado.'
          )
        }
      } catch {
        // En error de red, reintentar más espaciado
        pollTimerRef.current = window.setTimeout(tick, 8000)
      }
    }
    pollTimerRef.current = window.setTimeout(tick, 4000)
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setRenapoData(null)

    const trimmed = curp.trim().toUpperCase()
    // Validación local antes de tocar al backend
    const local = validateCurpLocal(trimmed)
    if (!local.valid) {
      setError(local.message || 'La CURP no es válida.')
      return
    }
    if (!accepted) {
      setError('Antes de continuar, confirma que esta CURP corresponde a tus datos personales.')
      return
    }

    // Si hay una verificación en curso, detenemos el polling local antes
    // de reenviar. El backend detecta el cambio de CURP y aborta el thread
    // anterior por sí mismo (ver _run_candidate_curp_verification).
    if (verifying) {
      stopPolling()
      setVerifying(false)
      setPollAttempts(0)
    }

    setSubmitting(true)
    try {
      const result = await submitOwnCurp(trimmed)
      // Caso 1: CURP genérica de extranjero → éxito inmediato
      if ('valid' in result && result.valid) {
        setSuccess(result.message)
        setRenapoData(result.data || null)
        if (result.user) {
          updateUser(result.user)
        } else if (user) {
          updateUser({ ...user, curp: trimmed, curp_verified: true, requires_curp_validation: false })
        }
        setTimeout(() => navigate('/dashboard'), 2500)
        return
      }
      // Caso 2: validación contra RENAPO inició en background → polling
      if ('verifying' in result && result.verifying) {
        setVerifying(true)
        setPollAttempts(0)
        if (user) {
          // Actualizamos la CURP local (aún sin verificar)
          updateUser({ ...user, curp: trimmed })
        }
        startPolling()
        return
      }
      // Caso 3: falla síncrona (formato, duplicado, etc.)
      if ('valid' in result && !result.valid) {
        let msg = result.error || 'CURP no válida'
        if (result.reason === 'service_unavailable') {
          msg += ' Espera un par de minutos e inténtalo otra vez.'
        } else if (result.reason === 'duplicate') {
          msg += ' Si crees que se trata de un error, contacta a tu coordinador.'
        }
        setError(msg)
      }
    } catch (err: any) {
      setError(err?.message || 'Error inesperado validando CURP.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Validación de CURP</h1>
              <p className="text-sm text-blue-100">Confirma tu CURP contra RENAPO para continuar</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {alreadyVerified ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-semibold">Tu CURP ya está validada</p>
                <p className="mt-1">
                  No necesitas volver a validarla. Si crees que hay un error, contacta a tu coordinador.
                </p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Ir al panel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Tu CURP aún no ha sido validada</p>
                  <p className="mt-1">
                    No podrás iniciar exámenes ni descargar materiales hasta que tu CURP coincida con
                    los datos de RENAPO. Ingrésala correctamente abajo y presiona <em>Validar</em>.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CURP (18 caracteres)
                  </label>
                  <input
                    type="text"
                    value={curp}
                    onChange={(e) => {
                      setCurp(e.target.value.toUpperCase().slice(0, 18))
                      // Si cambia la CURP el usuario debe volver a aceptar
                      setAccepted(false)
                      if (error) setError(null)
                    }}
                    maxLength={18}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="XXXX000000HDFXXX00"
                    disabled={submitting}
                    className={`w-full px-4 py-2 border rounded-lg font-mono uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 ${
                      curp.length === 0
                        ? 'border-gray-300'
                        : localValidation.valid
                          ? 'border-green-500 ring-1 ring-green-200'
                          : 'border-amber-400'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">{curp.length}/18 caracteres</p>
                    {curp.length === 18 && localValidation.valid && (
                      <span className="text-xs text-green-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Formato y dígito verificador correctos
                      </span>
                    )}
                  </div>

                  {/* Retroalimentación de validación local */}
                  {curp.length > 0 && !localValidation.valid && (
                    <div className="mt-2 text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-2 flex gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{localValidation.message}</span>
                    </div>
                  )}
                </div>

                {/* Casilla de aceptación: sólo si formato + dígito son válidos */}
                {localValidation.valid && (
                  <label className="flex items-start gap-2 p-3 border border-blue-200 bg-blue-50 rounded-lg cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      disabled={submitting}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-900">
                      <strong>Acepto que estos son mis datos personales.</strong>{' '}
                      Confirmo que la CURP <span className="font-mono">{localValidation.normalized}</span>{' '}
                      es mía y autorizo su uso para mi identificación en la plataforma.
                    </span>
                  </label>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800 whitespace-pre-line">{error}</div>
                  </div>
                )}

                {verifying && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                    <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                    <div className="text-sm text-blue-800 flex-1">
                      <p className="font-semibold">Validando contra RENAPO en segundo plano…</p>
                      <p className="mt-1 text-xs">
                        Estamos consultando RENAPO con varios reintentos automáticos. Puedes
                        dejar esta pestaña abierta; te avisaremos en cuanto termine.
                      </p>
                      <p className="mt-1 text-xs text-blue-600">
                        Verificaciones intentadas: {pollAttempts}
                      </p>
                      <p className="mt-2 text-xs">
                        Si crees que la CURP que enviaste tiene un error, edítala arriba
                        y presiona <em>Validar con esta CURP</em> para reiniciar la verificación.
                      </p>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-800">
                        <p className="font-semibold">{success}</p>
                        {renapoData && (
                          <div className="mt-2 text-xs space-y-1">
                            <p><strong>Nombre:</strong> {renapoData.name}</p>
                            <p><strong>Apellidos:</strong> {renapoData.first_surname} {renapoData.second_surname}</p>
                            <p><strong>Sexo:</strong> {renapoData.gender === 'M' ? 'Hombre' : renapoData.gender === 'F' ? 'Mujer' : '—'}</p>
                          </div>
                        )}
                        <p className="mt-2">Redirigiendo al panel…</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !localValidation.valid ||
                    !accepted ||
                    !!success
                  }
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enviando…
                    </>
                  ) : verifying ? (
                    <>
                      <Lock className="w-5 h-5" />
                      Validar con esta CURP
                    </>
                  ) : localValidation.valid && accepted ? (
                    <>
                      <BadgeCheck className="w-5 h-5" />
                      Acepto, estos son mis datos personales — Desbloquear mi cuenta
                    </>
                  ) : localValidation.valid ? (
                    <>
                      <Lock className="w-5 h-5" />
                      Confirma la casilla para continuar
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Ingresa una CURP válida
                    </>
                  )}
                </button>
              </form>

              <div className="text-xs text-gray-500 border-t pt-3">
                <p>
                  La validación consulta directamente al servicio de RENAPO de gob.mx con hasta
                  6 rondas de reintentos automáticos. Si tu CURP es válida pero RENAPO está caído,
                  la verificación se reintentará sola; puedes dejar esta pestaña abierta. Si tu
                  CURP es realmente inválida, contacta a tu coordinador para que actualicen tus
                  datos.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
