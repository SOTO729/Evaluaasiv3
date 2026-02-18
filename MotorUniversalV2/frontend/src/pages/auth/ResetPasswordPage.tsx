import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'
import { 
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck
} from 'lucide-react'

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Enlace inválido. Solicita un nuevo enlace de recuperación.')
      return
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    try {
      await authService.resetPassword(token, newPassword)
      setSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al restablecer la contraseña. El enlace puede haber expirado.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 fluid-px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto fluid-mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-3">
            Enlace inválido
          </h1>
          <p className="fluid-text-base text-gray-500 fluid-mb-6">
            El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-primary-600 text-white fluid-rounded-xl hover:bg-primary-700 font-semibold transition-colors"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    )
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

          {success ? (
            /* Success State */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto fluid-mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-3">
                ¡Contraseña restablecida!
              </h1>
              <p className="fluid-text-base text-gray-500 fluid-mb-6">
                Tu contraseña ha sido actualizada exitosamente. Serás redirigido al inicio de sesión...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-primary-600 text-white fluid-rounded-xl hover:bg-primary-700 font-semibold transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="fluid-mb-8">
                <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-2">
                  Crear nueva contraseña
                </h1>
                <p className="fluid-text-base text-gray-500">
                  Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
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
                {/* New Password */}
                <div>
                  <label htmlFor="newPassword" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 fluid-pl-4 flex items-center pointer-events-none">
                      <Lock className="fluid-icon-sm text-gray-400" />
                    </div>
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      className="block w-full fluid-pl-12 fluid-pr-12 fluid-py-3 border border-gray-300 fluid-rounded-xl fluid-text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="Mínimo 8 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 fluid-pr-4 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="fluid-icon-sm text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="fluid-icon-sm text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 fluid-pl-4 flex items-center pointer-events-none">
                      <Lock className="fluid-icon-sm text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      className="block w-full fluid-pl-12 fluid-pr-4 fluid-py-3 border border-gray-300 fluid-rounded-xl fluid-text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="fluid-text-sm text-red-500 fluid-mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="w-full flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-primary-600 text-white fluid-rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 fluid-text-base font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="fluid-icon-sm animate-spin" />
                      Restableciendo...
                    </>
                  ) : (
                    'Restablecer contraseña'
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
            <ShieldCheck className="fluid-icon-xl" />
          </div>
          <h2 className="fluid-text-3xl font-bold fluid-mb-4">
            Crea una contraseña segura
          </h2>
          <p className="text-primary-100 fluid-text-lg max-w-xl mx-auto">
            Elige una contraseña que no hayas utilizado en otros sitios y que sea fácil de recordar para ti.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
