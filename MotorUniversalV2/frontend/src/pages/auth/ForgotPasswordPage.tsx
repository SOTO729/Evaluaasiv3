import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '../../services/authService'
import { 
  Mail, 
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound
} from 'lucide-react'

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authService.forgotPassword(email)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden overscroll-contain">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center fluid-px-8 bg-white">
        <div className="mx-auto w-full max-w-lg">
          {/* Logo */}
          <Link to="/" className="flex items-center fluid-gap-3 fluid-mb-10">
            <img src="/logo.webp" alt="Evaluaasi" className="fluid-h-14 w-auto" />
            <span className="fluid-text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Evaluaasi</span>
          </Link>

          {submitted ? (
            /* Success State */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto fluid-mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-3">
                Revisa tu correo
              </h1>
              <p className="fluid-text-base text-gray-500 fluid-mb-6">
                Si <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
                Revisa también tu carpeta de spam o correo no deseado.
              </p>
              <p className="fluid-text-sm text-gray-400 fluid-mb-8">
                El enlace expira en 1 hora.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center fluid-gap-2 fluid-text-sm text-primary-600 hover:text-primary-500 font-medium"
              >
                <ArrowLeft className="fluid-icon-sm" />
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="fluid-mb-8">
                <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-2">
                  ¿Olvidaste tu contraseña?
                </h1>
                <p className="fluid-text-base text-gray-500">
                  Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="fluid-mb-6 fluid-p-4 bg-red-50 border border-red-200 fluid-rounded-xl flex items-start fluid-gap-3">
                  <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="fluid-text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-5">
                <div>
                  <label htmlFor="email" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 fluid-pl-4 flex items-center pointer-events-none">
                      <Mail className="fluid-icon-sm text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full fluid-pl-12 fluid-pr-4 fluid-py-3 border border-gray-300 fluid-rounded-xl fluid-text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-primary-600 text-white fluid-rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 fluid-text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="fluid-icon-sm animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar enlace de recuperación'
                  )}
                </button>
              </form>

              {/* Back to Login */}
              <div className="fluid-mt-8 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center fluid-gap-2 fluid-text-sm text-primary-600 hover:text-primary-500 font-medium"
                >
                  <ArrowLeft className="fluid-icon-sm" />
                  Volver a iniciar sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Side - Gradient */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 fluid-w-20 fluid-h-20 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 fluid-w-24 fluid-h-24 bg-white/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center text-white fluid-px-12">
          <div className="fluid-w-20 fluid-h-20 bg-white/20 fluid-rounded-2xl flex items-center justify-center mx-auto fluid-mb-8">
            <KeyRound className="fluid-icon-xl" />
          </div>
          <h2 className="fluid-text-3xl font-bold fluid-mb-4">
            Recupera el acceso
          </h2>
          <p className="text-primary-100 fluid-text-lg max-w-xl mx-auto">
            Te enviaremos un enlace seguro a tu correo para que puedas crear una nueva contraseña.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
