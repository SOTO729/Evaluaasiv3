import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authService } from '../../services/authService'
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react'

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No se proporcionó un token de verificación.')
      return
    }

    const verify = async () => {
      try {
        const res = await authService.verifyEmail(token)
        if (res.already_verified) {
          setStatus('already')
        } else {
          setStatus('success')
        }
        setMessage(res.message)
      } catch (err: any) {
        setStatus('error')
        setMessage(err.response?.data?.error || 'Error al verificar el correo electrónico.')
      }
    }

    verify()
  }, [token])

  const handleResend = async () => {
    if (!resendEmail.trim()) return
    setResending(true)
    setResendMessage('')
    try {
      const res = await authService.resendVerification(resendEmail.trim())
      setResendMessage(res.message)
    } catch (err: any) {
      setResendMessage(err.response?.data?.error || 'Error al reenviar el correo.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <Mail className="w-12 h-12 text-white mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white">Verificación de Correo</h1>
            <p className="text-blue-100 text-sm mt-1">Evaluaasi — Plataforma de Evaluación</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {status === 'loading' && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Verificando tu correo electrónico...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">¡Correo verificado!</h2>
                <p className="text-slate-600 mb-6">{message}</p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Iniciar Sesión <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {status === 'already' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Correo ya verificado</h2>
                <p className="text-slate-600 mb-6">{message}</p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Iniciar Sesión <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Error de verificación</h2>
                <p className="text-slate-600 mb-6">{message}</p>

                {/* Resend form */}
                <div className="bg-slate-50 rounded-lg p-4 text-left">
                  <p className="text-sm text-slate-700 font-medium mb-3">
                    ¿Necesitas un nuevo enlace de verificación?
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Tu correo electrónico"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      onClick={handleResend}
                      disabled={resending || !resendEmail.trim()}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reenviar'}
                    </button>
                  </div>
                  {resendMessage && (
                    <p className="text-sm text-green-600 mt-2">{resendMessage}</p>
                  )}
                </div>

                <div className="mt-6">
                  <Link
                    to="/login"
                    className="text-blue-600 text-sm font-medium hover:text-blue-700"
                  >
                    ← Volver al inicio de sesión
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailPage
