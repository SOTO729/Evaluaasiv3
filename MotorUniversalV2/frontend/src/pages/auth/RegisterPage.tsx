import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService } from '../../services/authService'
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  User,
  Phone
} from 'lucide-react'

const RegisterPage = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    first_surname: '',
    second_surname: '',
    phone: '',
    acceptTerms: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', met: formData.password.length >= 8 },
    { label: 'Una mayúscula', met: /[A-Z]/.test(formData.password) },
    { label: 'Una minúscula', met: /[a-z]/.test(formData.password) },
    { label: 'Un número', met: /[0-9]/.test(formData.password) },
  ]

  const isStep1Valid = formData.email && formData.username && formData.password && 
    formData.confirmPassword && formData.password === formData.confirmPassword &&
    passwordRequirements.every(r => r.met)

  const isStep2Valid = formData.name && formData.first_surname && formData.acceptTerms

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (step === 1) {
      if (isStep1Valid) setStep(2)
      return
    }

    setError('')
    setLoading(true)

    try {
      await authService.register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        name: formData.name,
        first_surname: formData.first_surname,
        second_surname: formData.second_surname,
        phone: formData.phone,
      })
      navigate('/login', { state: { registered: true } })
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Error al registrar'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-x-hidden overscroll-contain">
      {/* Left Side - Simple Gradient */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-500 to-primary-700 items-center justify-center relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/4 fluid-w-20 fluid-h-20 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 left-1/4 fluid-w-24 fluid-h-24 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center text-white fluid-px-12">
          <div className="fluid-w-20 fluid-h-20 bg-white/20 rounded-fluid-2xl flex items-center justify-center mx-auto fluid-mb-8">
            <GraduationCap className="fluid-icon-xl" />
          </div>
          <h2 className="fluid-text-3xl font-bold fluid-mb-4">
            Únete a Evaluaasi
          </h2>
          <p className="text-primary-100 fluid-text-lg max-w-md">
            Crea tu cuenta y accede a evaluaciones, certificaciones y material de estudio.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col justify-center fluid-px-8 bg-white">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <Link to="/" className="flex items-center fluid-gap-3 fluid-mb-10">
            <img src="/logo.png" alt="Evaluaasi" className="fluid-h-12 w-auto" />
            <span className="fluid-text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Evaluaasi</span>
          </Link>

          {/* Header */}
          <div className="fluid-mb-6">
            <h1 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-2">
              Crear cuenta
            </h1>
            <p className="fluid-text-base text-gray-500">
              {step === 1 ? 'Paso 1: Credenciales de acceso' : 'Paso 2: Información personal'}
            </p>
          </div>

          {/* Progress */}
          <div className="flex fluid-gap-2 fluid-mb-6">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
            <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="fluid-mb-6 fluid-p-4 bg-red-50 border border-red-200 rounded-fluid-xl flex items-start fluid-gap-3">
              <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0 mt-0.5" />
              <p className="fluid-text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-4">
            {step === 1 ? (
              <>
                {/* Email */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input
                      type="email"
                      required
                      className="w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="tu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Usuario</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input
                      type="text"
                      required
                      className="w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="usuario123"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      className="w-full fluid-pl-10 fluid-pr-10 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="fluid-icon-sm text-gray-400" /> : <Eye className="fluid-icon-sm text-gray-400" />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="fluid-mt-2 grid grid-cols-2 fluid-gap-1">
                      {passwordRequirements.map((req) => (
                        <div key={req.label} className={`flex items-center fluid-gap-1 fluid-text-xs ${req.met ? 'text-green-600' : 'text-gray-400'}`}>
                          <CheckCircle2 className="fluid-icon-xs" />
                          {req.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input
                      type="password"
                      required
                      className={`w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword
                          ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="fluid-mt-1 fluid-text-xs text-red-500">Las contraseñas no coinciden</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Name */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Nombre(s) *</label>
                  <input
                    type="text"
                    required
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Juan Carlos"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Surnames */}
                <div className="grid grid-cols-2 fluid-gap-3">
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Apellido paterno *</label>
                    <input
                      type="text"
                      required
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="García"
                      value={formData.first_surname}
                      onChange={(e) => setFormData({ ...formData, first_surname: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Apellido materno</label>
                    <input
                      type="text"
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="López"
                      value={formData.second_surname}
                      onChange={(e) => setFormData({ ...formData, second_surname: e.target.value })}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Teléfono (opcional)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                    <input
                      type="tel"
                      className="w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="222 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start fluid-gap-2 cursor-pointer fluid-pt-2">
                  <input
                    type="checkbox"
                    checked={formData.acceptTerms}
                    onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="fluid-text-sm text-gray-600">
                    Acepto los{' '}
                    <Link to="/terminos" className="text-primary-600 hover:underline" target="_blank">Términos</Link>
                    {' '}y el{' '}
                    <Link to="/privacidad" className="text-primary-600 hover:underline" target="_blank">Aviso de Privacidad</Link>
                  </span>
                </label>
              </>
            )}

            {/* Buttons */}
            <div className="flex fluid-gap-3 fluid-pt-2">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 fluid-py-3 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50 font-medium"
                >
                  Atrás
                </button>
              )}
              <button
                type="submit"
                disabled={loading || (step === 1 ? !isStep1Valid : !isStep2Valid)}
                className="flex-1 flex items-center justify-center fluid-gap-2 fluid-py-3 bg-primary-600 text-white rounded-fluid-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="fluid-icon-sm animate-spin" />
                ) : (
                  <>
                    {step === 1 ? 'Continuar' : 'Crear cuenta'}
                    <ArrowRight className="fluid-icon-xs" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative fluid-my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center fluid-text-sm">
              <span className="fluid-px-4 bg-white text-gray-500">O regístrate con</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-3 fluid-gap-3">
            <button
              type="button"
              className="flex items-center justify-center fluid-gap-2 fluid-py-3 fluid-px-4 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="fluid-icon-sm" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="fluid-text-sm font-medium text-gray-700 hidden sm:inline">Google</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center fluid-gap-2 fluid-py-3 fluid-px-4 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="fluid-icon-sm" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
              </svg>
              <span className="fluid-text-sm font-medium text-gray-700 hidden sm:inline">Apple</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center fluid-gap-2 fluid-py-3 fluid-px-4 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="fluid-icon-sm" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              <span className="fluid-text-sm font-medium text-gray-700 hidden sm:inline">Microsoft</span>
            </button>
          </div>

          {/* Login Link */}
          <p className="fluid-mt-6 text-center fluid-text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-500">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
