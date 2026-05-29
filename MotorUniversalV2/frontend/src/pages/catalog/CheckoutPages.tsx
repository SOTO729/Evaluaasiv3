/**
 * Páginas de retorno del Checkout Directo (MercadoPago).
 * Públicas. El usuario llega aquí desde back_urls de MP.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react'
import { directService } from '../../services/directService'

export function CheckoutSuccess() {
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''
  const isFreeSample = params.get('free') === '1'
  const [statusMsg, setStatusMsg] = useState<string>('Verificando tu pago...')
  const [done, setDone] = useState(isFreeSample)

  useEffect(() => {
    if (isFreeSample) {
      setStatusMsg('¡Acceso otorgado!')
      return
    }
    if (!ref) {
      setStatusMsg('No se recibió referencia de pago.')
      setDone(true)
      return
    }
    let attempts = 0
    const maxAttempts = 12 // ~ 60s
    const tick = async () => {
      attempts++
      try {
        const st = await directService.getPaymentStatus(ref)
        if (st.status === 'approved' && st.credits_applied) {
          setStatusMsg('¡Pago confirmado! Tu examen ya está disponible.')
          setDone(true)
          return
        }
        if (st.status === 'rejected' || st.status === 'cancelled') {
          setStatusMsg('El pago fue rechazado o cancelado.')
          setDone(true)
          return
        }
        if (attempts >= maxAttempts) {
          setStatusMsg('Tu pago está en proceso. Te enviaremos un correo cuando se confirme.')
          setDone(true)
          return
        }
        setStatusMsg(`Verificando tu pago... (intento ${attempts}/${maxAttempts})`)
        setTimeout(tick, 5000)
      } catch {
        setStatusMsg('No pudimos verificar tu pago automáticamente. Revisa tu correo.')
        setDone(true)
      }
    }
    tick()
  }, [ref, isFreeSample])

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
        <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Listo!</h1>
        <p className="text-gray-600 mb-6">{statusMsg}</p>
        {done && (
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Iniciar sesión <ArrowRight size={18} />
          </Link>
        )}
        <p className="text-xs text-gray-500 mt-6">
          Revisa tu correo: te enviamos tu contraseña (si no la elegiste) y las instrucciones para empezar.
        </p>
      </div>
    </div>
  )
}

export function CheckoutFailure() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
        <XCircle className="mx-auto text-red-500 mb-4" size={64} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago no completado</h1>
        <p className="text-gray-600 mb-6">
          Tu pago no se pudo procesar. No se realizó ningún cargo. Puedes intentar de nuevo.
        </p>
        <Link
          to="/catalogo"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Volver al catálogo
        </Link>
      </div>
    </div>
  )
}

export function CheckoutPending() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
        <Clock className="mx-auto text-yellow-500 mb-4" size={64} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago pendiente</h1>
        <p className="text-gray-600 mb-6">
          Tu pago aún está siendo procesado (por ejemplo, OXXO o transferencia).
          Te enviaremos un correo cuando se confirme y tu examen quede disponible.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  )
}
