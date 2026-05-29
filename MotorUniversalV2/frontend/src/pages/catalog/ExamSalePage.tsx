/**
 * Página de detalle de un examen del catálogo público + formulario de checkout.
 * Pública (sin auth).
 */
import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, FileText, ShieldCheck, Gift, Loader2, CheckCircle2, BookOpen } from 'lucide-react'
import { directService, DirectExamCard, DirectCheckoutCustomer } from '../../services/directService'
import { useAuthStore } from '../../store/authStore'
import InfoSheetModal from '../../components/catalog/InfoSheetModal'

export default function ExamSalePage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAuthenticated = !!user
  const [exam, setExam] = useState<DirectExamCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [customer, setCustomer] = useState<DirectCheckoutCustomer>({
    email: '',
    name: '',
    first_surname: '',
    second_surname: '',
    phone: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showInfoSheet, setShowInfoSheet] = useState(false)

  useEffect(() => {
    if (!examId) return
    setLoading(true)
    directService.getCatalogExam(Number(examId))
      .then(setExam)
      .catch(err => setError(err?.response?.data?.error || err?.message || 'No se encontró el examen'))
      .finally(() => setLoading(false))
  }, [examId])

  const handleChange = (field: keyof DirectCheckoutCustomer) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomer(prev => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exam) return
    setFormError(null)
    setSubmitting(true)
    try {
      const result = await directService.checkout(exam.id, customer)
      if (result.free_sample) {
        navigate(`/checkout/success?free=1&exam=${exam.id}`)
        return
      }
      const url = result.checkout_url || result.init_point || result.sandbox_init_point
      if (url) {
        window.location.href = url
      } else {
        setFormError('No se recibió URL de pago. Intenta de nuevo.')
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || 'Error procesando la compra')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBuyAuthenticated = async () => {
    if (!exam) return
    setFormError(null)
    setSubmitting(true)
    try {
      const result = await directService.checkout(exam.id)
      if (result.free_sample) {
        navigate(`/checkout/success?free=1&exam=${exam.id}`)
        return
      }
      const url = result.checkout_url || result.init_point || result.sandbox_init_point
      if (url) {
        window.location.href = url
      } else {
        setFormError('No se recibió URL de pago. Intenta de nuevo.')
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || 'Error procesando la compra')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (error || !exam) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error || 'Examen no encontrado'}</p>
        <Link to="/catalogo" className="text-blue-600 hover:underline">← Volver al catálogo</Link>
      </div>
    </div>
  )

  const isFree = exam.is_free_sample

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/catalogo" className="flex items-center gap-2 text-gray-700 hover:text-blue-700">
            <ArrowLeft size={18} /> Volver al catálogo
          </Link>
          <Link to="/login" className="text-gray-700 hover:text-blue-700">Iniciar sesión</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Detalle del examen */}
        <div className="lg:col-span-2">
          {exam.image_url && (
            <img src={exam.image_url} alt={exam.title} className="w-full h-72 object-cover rounded-xl mb-6" />
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{exam.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
            {exam.time_limit_minutes != null && (
              <span className="flex items-center gap-1"><Clock size={16} />{exam.time_limit_minutes} minutos</span>
            )}
            {exam.total_questions != null && (
              <span className="flex items-center gap-1"><FileText size={16} />{exam.total_questions} reactivos</span>
            )}
            <span className="flex items-center gap-1 text-green-700"><ShieldCheck size={16} />Certificado digital</span>
          </div>

          {exam.info_sheet_url && (
            <button
              type="button"
              onClick={() => setShowInfoSheet(true)}
              className="mb-6 inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 transition font-medium"
            >
              <BookOpen size={18} /> Conoce más (ficha informativa)
            </button>
          )}

          {exam.direct_sale_description && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-900">Descripción</h2>
              <p className="text-gray-700 whitespace-pre-line">{exam.direct_sale_description}</p>
            </div>
          )}

          {exam.description && (
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold mb-3 text-gray-900">Más detalles</h2>
              <p className="text-gray-700 whitespace-pre-line">{exam.description}</p>
            </div>
          )}
        </div>

        {/* Card de compra */}
        <aside className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-4">
            {isFree ? (
              <div className="text-center mb-6">
                <Gift className="mx-auto mb-2 text-green-600" size={36} />
                <p className="text-3xl font-bold text-green-700">Gratis</p>
                <p className="text-sm text-gray-500">Examen de muestra</p>
              </div>
            ) : (
              <div className="text-center mb-6">
                <p className="text-base font-semibold text-blue-900">Arma tu compra</p>
                <p className="text-sm text-gray-600 mt-1">
                  Elige los productos que quieres (examen, certificados, material) y conoce el precio total en el siguiente paso.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3" hidden={isAuthenticated || !isFree}>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={customer.email}
                  onChange={handleChange('email')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre(s) *</label>
                <input
                  type="text"
                  required
                  value={customer.name}
                  onChange={handleChange('name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Primer apellido *</label>
                <input
                  type="text"
                  required
                  value={customer.first_surname}
                  onChange={handleChange('first_surname')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Segundo apellido</label>
                <input
                  type="text"
                  value={customer.second_surname || ''}
                  onChange={handleChange('second_surname')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={customer.phone || ''}
                  onChange={handleChange('phone')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contraseña (opcional)
                </label>
                <input
                  type="password"
                  value={customer.password || ''}
                  onChange={handleChange('password')}
                  placeholder="Si la dejas vacía te enviaremos una"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formError && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{formError}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="animate-spin" size={18} />}
                {isFree ? 'Obtener acceso gratis' : 'Pagar con MercadoPago'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                Al continuar aceptas nuestros{' '}
                <Link to="/terminos" className="underline">términos</Link> y{' '}
                <Link to="/privacidad" className="underline">política de privacidad</Link>.
              </p>
            </form>

            {!isFree && !isAuthenticated && (
              <div className="space-y-3">
                <Link
                  to={`/checkout/bundle?ids=${exam.id}`}
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  Continuar a elegir productos
                </Link>
                <p className="text-xs text-gray-500 text-center">
                  Pago seguro · Acceso inmediato tras la confirmación
                </p>
              </div>
            )}

            {isAuthenticated && (
              <div className="space-y-3">
                <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2">
                  <CheckCircle2 className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <div className="font-medium text-blue-900">{user?.full_name}</div>
                    <div className="text-blue-700 text-xs">{user?.email}</div>
                  </div>
                </div>
                {formError && (
                  <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{formError}</div>
                )}
                {isFree ? (
                  <button
                    type="button"
                    onClick={handleBuyAuthenticated}
                    disabled={submitting}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting && <Loader2 className="animate-spin" size={18} />}
                    Obtener acceso gratis
                  </button>
                ) : (
                  <Link
                    to={`/checkout/bundle?ids=${exam.id}`}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    Continuar a elegir productos
                  </Link>
                )}
                <p className="text-xs text-gray-500 text-center">
                  Pago seguro · Acceso inmediato tras la confirmación
                </p>
              </div>
            )}
          </div>
        </aside>
      </main>

      <InfoSheetModal
        open={showInfoSheet}
        pdfUrl={exam.info_sheet_url || null}
        title={exam.title}
        onClose={() => setShowInfoSheet(false)}
      />
    </div>
  )
}
