/**
 * BundleCheckoutPage — confirma compra múltiple (varios exámenes).
 *
 * Layout alineado al resto del sitio público:
 *   - Header con marca Evaluaasi + nav
 *   - Footer común
 *   - max-w-7xl, paddings consistentes con CatalogPage
 *
 * Flujo de 2 pasos:
 *   1. addons → selección de productos (examen base, EduIT, CONOCER, material)
 *      + captura de CURP si se elige certificado CONOCER (con validación
 *      local de formato y dígito verificador RENAPO).
 *   2. pay    → resumen + pago (Checkout Pro o tarjeta embebida).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Loader2, ShoppingCart, CheckCircle2, X, Shield, Lock,
  Sparkles, GraduationCap, Mail, CreditCard, ExternalLink, Award, BadgeCheck,
  BookOpen, Check, Info, AlertCircle, IdCard, Medal,
} from 'lucide-react'
import {
  directService,
  DirectExamCard,
  DirectCheckoutCustomer,
  DirectAddon,
} from '../../services/directService'
import { useAuthStore } from '../../store/authStore'
import DirectCheckoutModal from '../../components/payments/DirectCheckoutModal'
import { validateCurpLocal } from '../../utils/curp'

const ADDON_ICONS: Record<string, React.ComponentType<any>> = {
  GraduationCap, Award, BadgeCheck, BookOpen, Medal,
}

/** Información ampliada para cada producto (mostrada en el modal "Saber más"). */
const ADDON_DETAILS: Record<string, {
  intro: string
  bullets: string[]
  note?: string
}> = {
  examen: {
    intro: 'Es el acceso a la evaluación en línea junto con su simulador, más todo el material de estudio (lecturas, videos y ejercicios) sin costo adicional para prepararte.',
    bullets: [
      'Acceso inmediato tras el pago, desde tu cuenta.',
      'Simulador y material de estudio incluidos sin costo adicional: lecturas, videos y ejercicios interactivos.',
      'Resultados al instante: aciertos, áreas a reforzar y porcentaje global.',
      'Un intento por compra; si necesitas reintentar puedes volver a comprar.',
      'Reporte de evaluación descargable.',
    ],
    note: 'Producto obligatorio: incluye examen, simulador y material de estudio en un solo precio.',
  },
  cert_eduit: {
    intro: 'Certificado digital EduIT en PDF de alta calidad, con folio único verificable. Pensado para imprimirse, archivarse o compartirse por correo.',
    bullets: [
      'Documento PDF de alta resolución listo para imprimir.',
      'Folio único y URL de verificación pública.',
      'Incluye datos del candidato, estándar y fecha.',
      'Entrega inmediata tras aprobar la evaluación.',
    ],
    note: 'Es distinto a la insignia digital (Open Badge); puedes adquirir uno, otro o ambos.',
  },
  cert_conocer: {
    intro: 'Certificado oficial CONOCER del estándar de competencia que acredita formalmente tus habilidades ante la SEP y empleadores en México.',
    bullets: [
      'Documento oficial emitido por CONOCER (Consejo Nacional de Normalización y Certificación).',
      'Reconocido a nivel nacional para concursos públicos y procesos laborales.',
      'Trámite automatizado: nosotros gestionamos el envío al organismo certificador.',
      'Tiempo de emisión típico: 15 a 30 días hábiles después del pago.',
    ],
    note: 'Para emitirlo necesitamos tu CURP. Te la pediremos en este mismo formulario.',
  },
  badge: {
    intro: 'Insignia digital verificable bajo el estándar Open Badges 3.0. Pensada para compartirse en LinkedIn, currículum y portafolios digitales.',
    bullets: [
      'Verificable públicamente mediante URL única.',
      'Compatible con LinkedIn, Credly y portales de talento.',
      'Firmada criptográficamente; incluye metadatos del estándar, fecha y emisor.',
      'No requiere trámite presencial; se emite tras aprobar el examen.',
    ],
    note: 'Es distinta al certificado EduIT en PDF; puedes adquirir uno, otro o ambos.',
  },
}

function fmtMxn(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2 })
}

export default function BundleCheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const isAuthenticated = !!user

  const examIds = useMemo<number[]>(() => {
    const raw = searchParams.get('ids') || ''
    return raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0)
  }, [searchParams])

  const [exams, setExams] = useState<DirectExamCard[]>([])
  const [addons, setAddons] = useState<DirectAddon[]>([])
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [infoAddon, setInfoAddon] = useState<DirectAddon | null>(null)

  const [step, setStep] = useState<'addons' | 'pay'>('addons')
  const [customer, setCustomer] = useState<DirectCheckoutCustomer>({
    email: '',
    name: '',
    first_surname: '',
    second_surname: '',
    phone: '',
    password: '',
  })
  const [curp, setCurp] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)

  // Pre-cargar CURP del usuario autenticado si la tiene
  useEffect(() => {
    if (isAuthenticated && user?.curp && !curp) {
      setCurp(user.curp.toUpperCase())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.curp])

  // Carga inicial: exámenes + catálogo de addons
  useEffect(() => {
    if (!examIds.length) {
      setLoadError('No hay exámenes seleccionados')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    Promise.all([
      Promise.all(examIds.map(id => directService.getCatalogExam(id).catch(() => null))),
      directService.listAddons().catch(() => [] as DirectAddon[]),
    ])
      .then(([examResults, addonList]) => {
        if (!alive) return
        const valid = examResults.filter((e): e is DirectExamCard => !!e)
        setExams(valid)
        setAddons(addonList)
        const required = new Set(addonList.filter(a => a.required).map(a => a.key))
        setSelectedAddons(required)
      })
      .catch(err => { if (alive) setLoadError(err?.message || 'No se pudo cargar el detalle') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [examIds])

  const numExams = exams.length
  const lineItems = useMemo(() => {
    return addons
      .filter(a => selectedAddons.has(a.key) || a.required)
      .map(a => ({
        key: a.key,
        label: a.label,
        description: a.description,
        unit_price: a.price,
        quantity: numExams,
        subtotal: a.price * numExams,
      }))
  }, [addons, selectedAddons, numExams])

  const total = useMemo(() => lineItems.reduce((s, li) => s + li.subtotal, 0), [lineItems])
  const totalAddonsArray = useMemo(
    () => addons.filter(a => selectedAddons.has(a.key) || a.required).map(a => a.key),
    [addons, selectedAddons],
  )

  const requiredAddons = useMemo(() => addons.filter(a => a.required), [addons])
  const optionalAddons = useMemo(() => addons.filter(a => !a.required), [addons])

  // ¿El bundle incluye CONOCER? → CURP requerida
  const requiresCurp = useMemo(
    () => totalAddonsArray.includes('cert_conocer'),
    [totalAddonsArray],
  )
  const curpValidation = useMemo(() => validateCurpLocal(curp), [curp])
  const userHasVerifiedCurp = isAuthenticated && !!user?.curp && !!(user as any)?.curp_verified
  // Si el usuario ya tiene una CURP verificada, no exigimos input (la enviará el backend desde la sesión).
  const curpOk = !requiresCurp || userHasVerifiedCurp || curpValidation.valid

  const toggleAddon = (addon: DirectAddon) => {
    if (addon.required) return
    setSelectedAddons(prev => {
      const next = new Set(prev)
      if (next.has(addon.key)) next.delete(addon.key)
      else next.add(addon.key)
      return next
    })
  }

  const handleChange = (field: keyof DirectCheckoutCustomer) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomer(prev => ({ ...prev, [field]: e.target.value }))
    }

  const handleCurpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sólo mayúsculas, sin espacios, máx 18 chars
    const raw = e.target.value.toUpperCase().replace(/[^A-ZÑ0-9]/g, '').slice(0, 18)
    setCurp(raw)
  }

  const doCheckout = async (withCustomer: boolean) => {
    setFormError(null)
    if (requiresCurp && !curpOk) {
      setFormError('La CURP es obligatoria y debe ser válida para el certificado CONOCER.')
      return
    }
    setSubmitting(true)
    try {
      const customerWithCurp: DirectCheckoutCustomer | undefined = withCustomer
        ? { ...customer, curp: requiresCurp ? curp : undefined }
        : undefined
      const result = await directService.checkoutBundle(
        exams.map(e => e.id),
        totalAddonsArray,
        customerWithCurp,
        requiresCurp ? curp : undefined,
      )
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await doCheckout(true)
  }

  const handleContinueToPay = () => {
    setFormError(null)
    if (requiresCurp && !curpOk) {
      setFormError('Captura una CURP válida antes de continuar (necesaria para el certificado CONOCER).')
      return
    }
    setStep('pay')
  }

  if (loading) {
    return (
      <PageShell user={user}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-primary-600" size={40} />
            <p className="text-gray-600">Cargando resumen…</p>
          </div>
        </div>
      </PageShell>
    )
  }

  if (loadError || !exams.length) {
    return (
      <PageShell user={user}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 max-w-md text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="text-red-600" size={28} />
            </div>
            <p className="text-gray-900 font-semibold mb-2">No se pudo continuar</p>
            <p className="text-sm text-gray-600 mb-6">{loadError || 'Sin exámenes seleccionados'}</p>
            <Link
              to={isAuthenticated ? '/mi/catalogo' : '/catalogo'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <ArrowLeft size={16} /> Volver al catálogo
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  const backHref = isAuthenticated ? '/mi/catalogo' : '/catalogo'
  const formattedTotal = fmtMxn(total)
  const optionalCount = Array.from(selectedAddons).filter(
    k => !addons.find(a => a.key === k)?.required
  ).length

  return (
    <PageShell user={user}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in-up">
        {/* Volver + Stepper */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <button
            onClick={() => step === 'pay' ? setStep('addons') : navigate(backHref)}
            className="inline-flex items-center gap-2 text-gray-700 hover:text-primary-700 transition px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">
              {step === 'pay' ? 'Modificar productos' : 'Volver al catálogo'}
            </span>
          </button>

          <div className="flex items-center gap-3">
            <StepDot active={true} done={step === 'pay'} label="1. Productos" />
            <div className={`h-0.5 w-10 sm:w-16 ${step === 'pay' ? 'bg-primary-600' : 'bg-gray-200'}`} />
            <StepDot active={step === 'pay'} done={false} label="2. Pagar" />
          </div>
        </div>

        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 rounded-2xl p-6 md:p-7 mb-6 shadow-lg">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <ShoppingCart className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {step === 'addons' ? 'Arma tu compra' : 'Resumen de tu compra'}
              </h1>
              <p className="text-sm text-white/90 mt-1 flex items-center gap-1.5">
                <Sparkles size={14} />
                {exams.length} certificación{exams.length === 1 ? '' : 'es'}
                {step === 'addons'
                  ? ' — elige los productos que necesitas'
                  : ' lista' + (exams.length === 1 ? '' : 's') + ' para pagar'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/80 uppercase tracking-wide">Total</div>
              <div className="text-3xl font-bold text-white">
                ${formattedTotal} <span className="text-base font-normal text-white/80">MXN</span>
              </div>
            </div>
          </div>
        </div>

        {step === 'addons' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Productos */}
              <section className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={16} /> Productos
                  </h2>
                  <p className="text-xs text-gray-500">
                    Se cobra por examen del bundle ({exams.length})
                  </p>
                </div>

                {/* Incluidos (obligatorios) */}
                {requiredAddons.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Incluido en tu compra
                      </h3>
                      <span className="text-[10px] text-gray-500">
                        ({requiredAddons.length} producto{requiredAddons.length === 1 ? '' : 's'})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {requiredAddons.map(addon => (
                        <AddonCard
                          key={addon.key}
                          addon={addon}
                          selected
                          onToggle={() => { /* required */ }}
                          onInfo={() => setInfoAddon(addon)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Opcionales */}
                {optionalAddons.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-primary-600" />
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Agrega si lo necesitas
                      </h3>
                      <span className="text-[10px] text-gray-500">(opcional)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {optionalAddons.map(addon => (
                        <AddonCard
                          key={addon.key}
                          addon={addon}
                          selected={selectedAddons.has(addon.key)}
                          onToggle={() => toggleAddon(addon)}
                          onInfo={() => setInfoAddon(addon)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* CURP — sólo si CONOCER seleccionado */}
              {requiresCurp && (
                <section className={`rounded-xl p-5 border-2 ${
                  userHasVerifiedCurp
                    ? 'border-green-200 bg-green-50'
                    : curpValidation.valid
                      ? 'border-green-200 bg-green-50'
                      : 'border-amber-300 bg-amber-50'
                }`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      curpOk ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      <IdCard size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        CURP requerida para el certificado CONOCER
                      </h3>
                      <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                        El certificado oficial CONOCER se emite a nombre del titular de la CURP.
                        Asegúrate de capturarla correctamente; validaremos el formato y el dígito
                        verificador en línea.
                      </p>
                    </div>
                  </div>

                  {userHasVerifiedCurp ? (
                    <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg p-3 text-sm">
                      <CheckCircle2 className="text-green-600 flex-shrink-0" size={18} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">CURP verificada en tu cuenta</div>
                        <div className="text-xs text-gray-600 font-mono mt-0.5">{user?.curp}</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Tu CURP (18 caracteres)
                      </label>
                      <input
                        type="text"
                        value={curp}
                        onChange={handleCurpChange}
                        placeholder="AAAA000000HDFXXX00"
                        autoComplete="off"
                        spellCheck={false}
                        className={`w-full px-3 py-2.5 border rounded-lg font-mono text-sm tracking-wider uppercase transition focus:ring-2 focus:outline-none ${
                          curp.length === 0
                            ? 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
                            : curpValidation.valid
                              ? 'border-green-400 focus:ring-green-500 focus:border-green-500 bg-white'
                              : 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-white'
                        }`}
                        maxLength={18}
                      />
                      <div className="mt-2 flex items-start gap-1.5 text-xs">
                        {curp.length === 0 ? (
                          <span className="text-gray-500">Captura tu CURP para continuar.</span>
                        ) : curpValidation.valid ? (
                          <>
                            <CheckCircle2 className="text-green-600 flex-shrink-0 mt-0.5" size={14} />
                            <span className="text-green-700 font-medium">CURP válida.</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={14} />
                            <span className="text-red-700">
                              {curpValidation.message || 'CURP inválida'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Exámenes incluidos */}
              <section>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <GraduationCap size={16} /> Certificaciones incluidas
                </h2>
                <div className="space-y-2">
                  {exams.map(e => (
                    <div
                      key={e.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 shadow-sm"
                    >
                      {e.image_url ? (
                        <img src={e.image_url} alt={e.title}
                          className="w-12 h-12 object-cover rounded flex-shrink-0 border border-gray-100" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded flex-shrink-0 flex items-center justify-center text-white">
                          <GraduationCap size={18} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{e.title}</div>
                        {e.direct_sale_description && (
                          <p className="text-xs text-gray-500 line-clamp-1">{e.direct_sale_description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Sidebar resumen */}
            <aside className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-primary-600" /> Tu selección
                </h2>

                <div className="space-y-2 mb-4">
                  {lineItems.map(li => (
                    <div key={li.key} className="flex items-start justify-between text-sm">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-medium text-gray-900">{li.label}</div>
                        {li.unit_price > 0 ? (
                          <div className="text-xs text-gray-500">
                            ${fmtMxn(li.unit_price)} × {li.quantity} examen{li.quantity === 1 ? '' : 'es'}
                          </div>
                        ) : (
                          <div className="text-xs text-green-700 font-medium">Incluido sin costo</div>
                        )}
                      </div>
                      <div className="text-right text-gray-900 font-medium">
                        {li.unit_price > 0 ? `$${fmtMxn(li.subtotal)}` : '—'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-4 flex items-baseline justify-between">
                  <div className="text-sm text-gray-700 font-medium">Total a pagar</div>
                  <div className="text-2xl font-bold text-primary-700">
                    ${formattedTotal} <span className="text-sm font-normal text-gray-500">MXN</span>
                  </div>
                </div>

                {formError && (
                  <div className="mb-3 text-red-700 text-xs bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-start gap-1.5">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={total <= 0 || (requiresCurp && !curpOk)}
                  onClick={handleContinueToPay}
                  className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition shadow-md"
                >
                  Continuar al pago <ArrowRight size={18} />
                </button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  {optionalCount === 0
                    ? 'Sólo tienes los productos incluidos. Agrega un certificado si lo necesitas.'
                    : `${optionalCount} certificado${optionalCount === 1 ? '' : 's'} extra seleccionado${optionalCount === 1 ? '' : 's'}.`}
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                <ShoppingCart size={16} /> Desglose de tu compra
              </h2>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Productos</div>
                <div className="space-y-2">
                  {lineItems.map(li => {
                    const Icon = ADDON_ICONS[addons.find(a => a.key === li.key)?.icon || ''] || Sparkles
                    return (
                      <div key={li.key} className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-primary-100 text-primary-700 flex-shrink-0">
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900">{li.label}</div>
                          {li.unit_price > 0 ? (
                            <div className="text-xs text-gray-500">${fmtMxn(li.unit_price)} × {li.quantity}</div>
                          ) : (
                            <div className="text-xs text-green-700 font-medium">Incluido sin costo</div>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{li.unit_price > 0 ? `$${fmtMxn(li.subtotal)}` : '—'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3 flex items-center gap-1.5">
                  <GraduationCap size={14} />
                  {exams.length} certificación{exams.length === 1 ? '' : 'es'}
                </div>
                <div className="space-y-1.5">
                  {exams.map(e => (
                    <div key={e.id} className="text-sm text-gray-700 truncate">• {e.title}</div>
                  ))}
                </div>
              </div>

              {requiresCurp && (
                <div className="bg-white border border-green-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <IdCard className="text-green-600 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                      CURP para certificado CONOCER
                    </div>
                    <div className="font-mono text-sm text-gray-900 mt-0.5 truncate">
                      {userHasVerifiedCurp ? user?.curp : curp}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border-2 border-primary-100 rounded-xl p-4 flex items-center justify-between">
                <div className="text-sm text-gray-700 font-medium">Total a pagar</div>
                <div className="text-3xl font-bold text-primary-700">
                  ${formattedTotal} <span className="text-base font-normal text-gray-500">MXN</span>
                </div>
              </div>

              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Shield className="text-primary-600 flex-shrink-0" size={18} />
                    <span>Pago 100% seguro</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <CheckCircle2 className="text-primary-600 flex-shrink-0" size={18} />
                    <span>Acceso inmediato</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="text-primary-600 flex-shrink-0" size={18} />
                    <span>Confirmación por email</span>
                  </div>
                </div>
              </div>
            </div>

            <aside className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Lock size={18} className="text-primary-600" /> Finalizar compra
                </h2>

                {isAuthenticated ? (
                  <div className="space-y-4">
                    <div className="bg-primary-50 border border-primary-100 p-3 rounded-lg flex items-start gap-2">
                      <CheckCircle2 className="text-primary-600 flex-shrink-0 mt-0.5" size={18} />
                      <div className="text-sm min-w-0">
                        <div className="font-medium text-gray-900 truncate">{user?.full_name}</div>
                        <div className="text-gray-600 text-xs truncate">{user?.email}</div>
                      </div>
                    </div>
                    {formError && (
                      <div className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setFormError(null); setShowCardModal(true) }}
                      disabled={submitting}
                      className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition shadow-md"
                    >
                      <CreditCard size={18} />
                      Pagar con tarjeta
                    </button>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span>o</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <button
                      type="button"
                      onClick={() => doCheckout(false)}
                      disabled={submitting}
                      className="w-full py-2.5 bg-white border border-primary-200 text-primary-700 font-medium rounded-xl hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition text-sm"
                    >
                      {submitting && <Loader2 className="animate-spin" size={16} />}
                      <ExternalLink size={15} /> Pagar en Mercado Pago
                    </button>
                    <p className="text-xs text-gray-500 text-center leading-relaxed">
                      Procesado por <strong>Mercado Pago</strong>. Tu tarjeta nunca se almacena en nuestros servidores.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Crearemos tu cuenta automáticamente y te enviaremos las credenciales por email.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email" required value={customer.email} onChange={handleChange('email')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre(s) *</label>
                      <input
                        type="text" required value={customer.name} onChange={handleChange('name')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Primer apellido *</label>
                        <input
                          type="text" required value={customer.first_surname} onChange={handleChange('first_surname')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Segundo apellido</label>
                        <input
                          type="text" value={customer.second_surname || ''} onChange={handleChange('second_surname')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="tel" value={customer.phone || ''} onChange={handleChange('phone')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña (opcional)</label>
                      <input
                        type="password" value={customer.password || ''} onChange={handleChange('password')}
                        placeholder="Si la dejas vacía te enviaremos una"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition text-sm"
                      />
                    </div>
                    {formError && (
                      <div className="text-red-700 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition shadow-md"
                    >
                      {submitting && <Loader2 className="animate-spin" size={18} />}
                      Pagar ${formattedTotal} MXN
                    </button>
                    <p className="text-xs text-gray-500 text-center leading-relaxed">
                      Al continuar aceptas nuestros{' '}
                      <Link to="/terminos" className="underline hover:text-primary-700">términos</Link> y{' '}
                      <Link to="/privacidad" className="underline hover:text-primary-700">política de privacidad</Link>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep('addons')}
                      className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 mt-1 py-1"
                    >
                      <ArrowLeft size={14} /> Modificar productos
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Modal "Saber más" */}
      <AddonInfoModal addon={infoAddon} onClose={() => setInfoAddon(null)} />

      {/* Modal tarjeta */}
      {isAuthenticated && (
        <DirectCheckoutModal
          isOpen={showCardModal}
          exams={exams.map(e => ({ id: e.id, title: e.title, price: 0 }))}
          addons={totalAddonsArray}
          totalAmount={total}
          curp={requiresCurp ? curp : undefined}
          onClose={() => setShowCardModal(false)}
          onPaymentComplete={(result) => {
            if (result.status === 'approved') {
              setTimeout(() => navigate('/dashboard'), 1500)
            }
          }}
        />
      )}
    </PageShell>
  )
}

// ── Layout público compartido (header + footer estilo CatalogPage) ──────────
function PageShell({ user, children }: { user: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/40 to-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary-700">Evaluaasi</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/catalogo" className="text-gray-700 hover:text-primary-700 font-medium">Catálogo</Link>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
              <Shield size={14} className="text-green-600" />
              Pago seguro
            </div>
            {user ? (
              <Link to="/dashboard" className="text-gray-700 hover:text-primary-700">Mi cuenta</Link>
            ) : (
              <Link to="/login" className="text-gray-700 hover:text-primary-700">Iniciar sesión</Link>
            )}
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="bg-white border-t mt-12 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Evaluaasi ·{' '}
        <Link to="/privacidad" className="hover:underline">Privacidad</Link> ·{' '}
        <Link to="/terminos" className="hover:underline">Términos</Link>
      </footer>
    </div>
  )
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
        done ? 'bg-primary-600 text-white'
          : active ? 'bg-primary-600 text-white ring-4 ring-primary-100'
          : 'bg-gray-200 text-gray-500'
      }`}>
        {done ? <Check size={14} /> : label[0]}
      </div>
      <span className={`text-xs font-medium hidden sm:inline ${
        active || done ? 'text-primary-700' : 'text-gray-500'
      }`}>{label}</span>
    </div>
  )
}

// ── Card de producto (incluido u opcional) ──────────────────────────────────
function AddonCard({
  addon, selected, onToggle, onInfo,
}: {
  addon: DirectAddon
  selected: boolean
  onToggle: () => void
  onInfo: () => void
}) {
  const Icon = ADDON_ICONS[addon.icon || ''] || Sparkles
  const isRequired = !!addon.required
  return (
    <div
      className={`relative rounded-xl border-2 transition shadow-sm ${
        selected
          ? isRequired
            ? 'border-green-400 bg-green-50/70'
            : 'border-primary-500 bg-primary-50'
          : 'border-gray-200 bg-white hover:border-primary-200'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={isRequired}
        className={`w-full text-left p-4 pr-10 ${
          isRequired ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            selected
              ? isRequired ? 'bg-green-600 text-white' : 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-500'
          }`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{addon.label}</span>
              {isRequired && (
                <span className="text-[10px] font-medium uppercase bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                  Incluido
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1 leading-snug">{addon.description}</p>
            {addon.price > 0 ? (
              <div className="mt-2 text-sm font-bold text-primary-700">
                ${addon.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                <span className="font-normal text-gray-500 text-xs">/ examen</span>
              </div>
            ) : (
              <div className="mt-2 text-sm font-bold text-green-700">Incluido sin costo</div>
            )}
          </div>
        </div>
        {selected && (
          <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center pointer-events-none ${
            isRequired ? 'bg-green-600' : 'bg-primary-600'
          }`}>
            <Check className="text-white" size={14} />
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onInfo() }}
        className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:text-primary-900 px-2 py-1 rounded-md hover:bg-white/70 transition"
      >
        <Info size={12} /> Saber más
      </button>
    </div>
  )
}

// ── Modal "Saber más" para un addon ─────────────────────────────────────────
function AddonInfoModal({ addon, onClose }: { addon: DirectAddon | null; onClose: () => void }) {
  if (!addon) return null
  const Icon = ADDON_ICONS[addon.icon || ''] || Sparkles
  const detail = ADDON_DETAILS[addon.key]
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-start gap-3">
          <div className="p-2.5 bg-primary-100 text-primary-700 rounded-lg flex-shrink-0">
            <Icon size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900">{addon.label}</h3>
              {addon.required && (
                <span className="text-[10px] font-medium uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  Obligatorio
                </span>
              )}
            </div>
            {addon.price > 0 ? (
              <div className="text-sm font-bold text-primary-700 mt-1">
                ${fmtMxn(addon.price)} <span className="text-xs font-normal text-gray-500">MXN / examen</span>
              </div>
            ) : (
              <div className="text-sm font-bold text-green-700 mt-1">Incluido sin costo</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {detail && (
            <>
              <p className="text-sm text-gray-700 leading-relaxed">{detail.intro}</p>
              <ul className="space-y-2">
                {detail.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {detail.note && (
                <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 text-xs text-primary-900 flex items-start gap-2">
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{detail.note}</span>
                </div>
              )}
            </>
          )}
          {!detail && (
            <p className="text-sm text-gray-700">{addon.description}</p>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
