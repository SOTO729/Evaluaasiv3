import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight,
  AlertCircle,
  Loader2
} from 'lucide-react'

const LoginPage = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authService.login(formData)
      login(response.user, response.access_token, response.refresh_token)
      navigate('/dashboard')
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Error al iniciar sesión'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden overscroll-contain">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 xs:px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-24 4xl:px-32 bg-white">
        <div className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl 3xl:max-w-3xl 4xl:max-w-4xl">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 xs:gap-3 lg:gap-4 3xl:gap-5 mb-6 xs:mb-8 lg:mb-10 2xl:mb-12 3xl:mb-14">
            <img src="/logo.png" alt="Evaluaasi" className="h-10 xs:h-12 lg:h-14 xl:h-16 2xl:h-20 3xl:h-24 4xl:h-28 w-auto" />
            <span className="text-xl xs:text-2xl lg:text-3xl 2xl:text-4xl 3xl:text-5xl 4xl:text-6xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Evaluaasi</span>
          </Link>

          {/* Header */}
          <div className="mb-6 xs:mb-8 lg:mb-10 3xl:mb-12">
            <h1 className="text-xl xs:text-2xl lg:text-3xl 2xl:text-4xl 3xl:text-5xl 4xl:text-6xl font-bold text-gray-900 mb-2 3xl:mb-3">
              Iniciar sesión
            </h1>
            <p className="text-sm xs:text-base lg:text-lg 2xl:text-xl 3xl:text-2xl 4xl:text-3xl text-gray-500">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 xs:mb-6 lg:mb-8 p-3 xs:p-4 lg:p-5 3xl:p-6 bg-red-50 border border-red-200 rounded-lg xs:rounded-xl lg:rounded-2xl flex items-start gap-2 xs:gap-3 lg:gap-4">
              <AlertCircle className="w-4 h-4 xs:w-5 xs:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl text-red-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 xs:space-y-5 lg:space-y-6 3xl:space-y-8">
            {/* Username/Email Field */}
            <div>
              <label htmlFor="username" className="block text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl font-medium text-gray-700 mb-1.5 xs:mb-2 lg:mb-3">
                Usuario o Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 xs:pl-4 lg:pl-5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 xs:h-5 xs:w-5 lg:h-6 lg:w-6 3xl:h-8 3xl:w-8 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="block w-full pl-10 xs:pl-11 lg:pl-14 3xl:pl-16 pr-3 xs:pr-4 lg:pr-5 py-2.5 xs:py-3 lg:py-4 3xl:py-5 border border-gray-300 rounded-lg xs:rounded-xl lg:rounded-2xl text-sm xs:text-base lg:text-lg 2xl:text-xl 3xl:text-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="tu@email.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl font-medium text-gray-700 mb-1.5 xs:mb-2 lg:mb-3">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 xs:pl-4 lg:pl-5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 xs:h-5 xs:w-5 lg:h-6 lg:w-6 3xl:h-8 3xl:w-8 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 xs:pl-11 lg:pl-14 3xl:pl-16 pr-10 xs:pr-12 lg:pr-14 py-2.5 xs:py-3 lg:py-4 3xl:py-5 border border-gray-300 rounded-lg xs:rounded-xl lg:rounded-2xl text-sm xs:text-base lg:text-lg 2xl:text-xl 3xl:text-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 xs:pr-4 lg:pr-5 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 xs:h-5 xs:w-5 lg:h-6 lg:w-6 3xl:h-8 3xl:w-8 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 xs:h-5 xs:w-5 lg:h-6 lg:w-6 3xl:h-8 3xl:w-8 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl text-primary-600 hover:text-primary-500">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-6 py-2.5 xs:py-3 lg:py-4 3xl:py-5 bg-primary-600 text-white rounded-lg xs:rounded-xl lg:rounded-2xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 text-sm xs:text-base lg:text-lg 2xl:text-xl 3xl:text-2xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 xs:w-5 xs:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8 animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4 xs:w-5 xs:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5 xs:my-6 lg:my-8 3xl:my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl">
              <span className="px-3 xs:px-4 lg:px-5 bg-white text-gray-500">O continúa con</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-3 gap-2 xs:gap-3 lg:gap-4 3xl:gap-6">
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 xs:gap-2 lg:gap-3 py-2 xs:py-2.5 lg:py-3 3xl:py-4 px-3 xs:px-4 lg:px-5 border border-gray-300 rounded-lg lg:rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 xs:w-5 xs:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl font-medium text-gray-700 hidden sm:inline">Google</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 xs:gap-2 lg:gap-3 py-2 xs:py-2.5 lg:py-3 3xl:py-4 px-3 xs:px-4 lg:px-5 border border-gray-300 rounded-lg lg:rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 xs:w-5 xs:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
              </svg>
              <span className="text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl font-medium text-gray-700 hidden sm:inline">Apple</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 xs:gap-2 lg:gap-3 py-2 xs:py-2.5 lg:py-3 3xl:py-4 px-3 xs:px-4 lg:px-5 border border-gray-300 rounded-lg lg:rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 xs:w-5 xs:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              <span className="text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl font-medium text-gray-700 hidden sm:inline">Microsoft</span>
            </button>
          </div>

          {/* Register Link */}
          <p className="mt-6 xs:mt-8 lg:mt-10 3xl:mt-12 text-center text-xs xs:text-sm lg:text-base 2xl:text-lg 3xl:text-xl text-gray-500">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-500">
              Regístrate
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Simple Gradient */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-48 xl:w-64 2xl:w-80 3xl:w-96 4xl:w-[28rem] h-48 xl:h-64 2xl:h-80 3xl:h-96 4xl:h-[28rem] bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-56 xl:w-80 2xl:w-96 3xl:w-[28rem] 4xl:w-[32rem] h-56 xl:h-80 2xl:h-96 3xl:h-[28rem] 4xl:h-[32rem] bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center text-white px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-24">
          <div className="w-16 h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 2xl:w-28 2xl:h-28 3xl:w-32 3xl:h-32 4xl:w-40 4xl:h-40 bg-white/20 rounded-xl lg:rounded-2xl xl:rounded-3xl flex items-center justify-center mx-auto mb-6 lg:mb-8 xl:mb-10 3xl:mb-12">
            <GraduationCap className="w-8 h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 2xl:w-14 2xl:h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20" />
          </div>
          <h2 className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-5xl 3xl:text-6xl 4xl:text-7xl font-bold mb-3 lg:mb-4 xl:mb-5 3xl:mb-6">
            Bienvenido a Evaluaasi
          </h2>
          <p className="text-primary-100 text-base lg:text-lg xl:text-xl 2xl:text-2xl 3xl:text-3xl 4xl:text-4xl max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl 3xl:max-w-3xl mx-auto">
            La plataforma integral para evaluación, certificación y gestión del aprendizaje.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
