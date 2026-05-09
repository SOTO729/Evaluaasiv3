import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { authService } from '../../services/authService'
import { useAuthStore } from '../../store/authStore'

/**
 * Landing pública para el flujo SSO ("API Tokenización Evaluaasi").
 *
 * Recibe `?token=<opaco>` (emitido por POST /api/sso/generar_token), lo
 * intercambia por un par JWT vía /api/auth/sso/exchange y deja al alumno
 * autenticado dentro del LMS.
 */
export default function SsoLandingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const exchangedRef = useRef(false) // evita doble ejecución por StrictMode

  useEffect(() => {
    if (exchangedRef.current) return
    exchangedRef.current = true

    const token = (searchParams.get('token') || '').trim()
    if (!token) {
      setStatus('error')
      setErrorMsg('No se recibió un token SSO en la URL.')
      return
    }

    ;(async () => {
      try {
        const response = await authService.ssoExchange(token)
        login(response.user, response.access_token, response.refresh_token)
        setStatus('success')

        // Limpiar el token de la URL (es single-use, evita compartir por error)
        try {
          window.history.replaceState({}, document.title, '/sso')
        } catch {
          /* noop */
        }

        const role = String(response.user?.role || '').trim().toLowerCase()
        const target =
          role === 'soporte' || role === 'support'
            ? '/support/dashboard'
            : role === 'gerente'
            ? '/gerente'
            : role === 'financiero'
            ? '/gerente/aprobaciones'
            : role === 'responsable_estatal'
            ? '/mi-estado'
            : '/dashboard'

        // Pequeño delay solo para que el usuario vea el OK, no es crítico
        setTimeout(() => navigate(target, { replace: true }), 400)
      } catch (err: any) {
        const apiMsg =
          err?.response?.data?.error ||
          err?.response?.data?.mensajeError ||
          'No fue posible iniciar tu sesión SSO.'
        setStatus('error')
        setErrorMsg(
          err?.response?.status === 401
            ? `${apiMsg} Solicita uno nuevo a tu institución.`
            : apiMsg
        )
      }
    })()
  }, [searchParams, login, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow rounded-2xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 text-blue-600 animate-spin" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              Iniciando sesión…
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Validando tu acceso desde tu institución.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              ¡Acceso concedido!
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Te estamos llevando a tu panel.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              No pudimos iniciar tu sesión
            </h1>
            <p className="mt-2 text-sm text-gray-600">{errorMsg}</p>
            <Link
              to="/login"
              className="mt-6 inline-block px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Ir al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
