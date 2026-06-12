import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  GraduationCap,
  BookOpen,
  FlaskConical,
  Award,
  LifeBuoy,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/authService'
import { getCandidatoBranding } from '../../services/partnersService'
import { useQuery } from '@tanstack/react-query'

/**
 * Recorrido de bienvenida que se muestra al candidato en su primer inicio de
 * sesión. Persiste en backend (`onboarding_completed`) porque el logout limpia
 * localStorage. UI/UX alineada con el resto del sitio: tarjeta modal con
 * gradiente `primary-*` (respeta el branding del plantel), utilidades `fluid-*`
 * e iconografía lucide.
 *
 * Se monta en Layout junto a CurpRequiredModal. No aparece si:
 *  - el usuario no es candidato o ya completó el onboarding,
 *  - tiene la validación de CURP pendiente (ese flujo tiene prioridad),
 *  - está dentro de un examen/resultado (para no taparlo).
 */

interface Slide {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  bullets: string[]
}

export default function CandidateOnboarding() {
  const { user, updateUser } = useAuthStore()
  const location = useLocation()
  const [step, setStep] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [anim, setAnim] = useState<'in' | 'out-left' | 'out-right'>('in')
  const primaryBtnRef = useRef<HTMLButtonElement>(null)

  const isCandidate = user?.role === 'candidato'
  const pendingCurp = !!user?.requires_curp_validation
  const onExamSurface =
    location.pathname.includes('/run') ||
    location.pathname.includes('/test-exams') ||
    location.pathname.includes('/results')

  const shouldShow =
    isCandidate &&
    user?.onboarding_completed === false &&
    !pendingCurp &&
    !onExamSurface &&
    !dismissed

  // Branding del plantel (reutiliza la cache de Layout/HomePage).
  const { data: brandingData } = useQuery({
    queryKey: ['candidato-branding'],
    queryFn: getCandidatoBranding,
    enabled: isCandidate,
    staleTime: 10 * 60 * 1000,
  })
  const campusName: string | undefined = brandingData?.branding?.campus_name ?? undefined
  const campusLogo: string | undefined = brandingData?.branding?.logo_url ?? undefined

  const firstName = (user?.name || '').trim().split(' ')[0]

  const slides: Slide[] = useMemo(
    () => [
      {
        icon: BookOpen,
        eyebrow: 'Paso 1 · Prepárate',
        title: 'Estudia a tu ritmo',
        description:
          'En Materiales de estudio encontrarás todo lo necesario para dominar cada tema antes de tu examen.',
        bullets: [
          'Lecturas, videos y ejercicios interactivos',
          'Tu avance se guarda automáticamente',
          'Retoma justo donde lo dejaste',
        ],
      },
      {
        icon: FlaskConical,
        eyebrow: 'Paso 2 · Practica',
        title: 'Ponte a prueba con el simulador',
        description:
          'El simulador replica las condiciones del examen real para que llegues con confianza.',
        bullets: [
          'Mismas preguntas y ejercicios que el examen',
          'Genera un reporte con tu nivel de preparación',
          'Practica las veces que necesites',
        ],
      },
      {
        icon: Award,
        eyebrow: 'Paso 3 · Certifícate',
        title: 'Presenta tu examen y certifícate',
        description:
          'Cuando estés listo, presenta tu examen oficial. Al aprobarlo obtienes tu reconocimiento.',
        bullets: [
          'Certificado y reporte de evaluación',
          'Insignia digital verificable',
          'Consulta tus resultados en Certificaciones',
        ],
      },
      {
        icon: LifeBuoy,
        eyebrow: 'Estamos para ayudarte',
        title: '¿Tienes dudas? Cuenta con soporte',
        description:
          'Si algo no funciona o necesitas orientación, nuestro equipo de soporte está disponible para ti.',
        bullets: [
          'Chat de soporte dentro de la plataforma',
          'Atención en horario hábil (centro de México)',
          'Tu progreso siempre queda resguardado',
        ],
      },
    ],
    []
  )

  const totalSteps = slides.length + 1 // +1 por la pantalla de bienvenida
  const isWelcome = step === 0
  const isLast = step === totalSteps - 1

  // Reiniciar al primer paso cada vez que se vuelve a mostrar.
  useEffect(() => {
    if (shouldShow) {
      setStep(0)
      setAnim('in')
    }
  }, [shouldShow])

  // Bloquear scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!shouldShow) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [shouldShow])

  // Enfocar el botón principal al cambiar de paso.
  useEffect(() => {
    if (shouldShow) {
      const t = setTimeout(() => primaryBtnRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [shouldShow, step])

  if (!shouldShow || !user) return null

  const goTo = (next: number, dir: 'left' | 'right') => {
    setAnim(dir === 'right' ? 'out-left' : 'out-right')
    setTimeout(() => {
      setStep(next)
      setAnim('in')
    }, 150)
  }

  const handleNext = () => {
    if (isLast) {
      void finish()
    } else {
      goTo(step + 1, 'right')
    }
  }

  const handleBack = () => {
    if (step > 0) goTo(step - 1, 'left')
  }

  const finish = async () => {
    setSaving(true)
    // Optimista: ocultar de inmediato y marcar en el store para que no reaparezca.
    setDismissed(true)
    updateUser({ ...user, onboarding_completed: true })
    try {
      await authService.completeOnboarding()
    } catch {
      // Si falla, a lo sumo se mostrará de nuevo en otra sesión; no es crítico.
    } finally {
      setSaving(false)
    }
  }

  const animClass =
    anim === 'in'
      ? 'opacity-100 translate-x-0'
      : anim === 'out-left'
      ? 'opacity-0 -translate-x-6'
      : 'opacity-0 translate-x-6'

  const activeSlide = isWelcome ? null : slides[step - 1]
  const SlideIcon = activeSlide?.icon

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center fluid-p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white rounded-fluid-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        {/* Cabecera con gradiente del plantel */}
        <div className="relative bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 text-white fluid-px-6 fluid-py-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <button
            onClick={() => void finish()}
            className="absolute top-3 right-3 z-10 text-white/80 hover:text-white transition-colors fluid-text-xs font-medium flex items-center fluid-gap-1"
            aria-label="Saltar la introducción"
          >
            Saltar <X className="fluid-icon-xs" />
          </button>
          <div className="relative flex items-center fluid-gap-3">
            {campusLogo ? (
              <img
                src={campusLogo}
                alt={campusName || 'Plantel'}
                className="h-12 w-auto object-contain rounded-lg bg-white/15 p-1.5"
              />
            ) : (
              <div className="fluid-icon-xl rounded-full bg-white/15 flex items-center justify-center">
                <GraduationCap className="fluid-icon-sm text-white" />
              </div>
            )}
            <div className="min-w-0">
              <p className="fluid-text-xs text-white/80 font-medium">
                {campusName || 'Tu plataforma de certificación'}
              </p>
              <h2 id="onboarding-title" className="fluid-text-lg font-bold truncate">
                {isWelcome ? '¡Te damos la bienvenida!' : 'Cómo aprovechar la plataforma'}
              </h2>
            </div>
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="flex-1 overflow-y-auto fluid-px-6 fluid-py-6">
          <div className={`transition-all duration-200 ease-out ${animClass}`}>
            {isWelcome ? (
              <div className="text-center">
                <div className="mx-auto fluid-mb-5 w-[clamp(3.5rem,3rem+2vw,5rem)] h-[clamp(3.5rem,3rem+2vw,5rem)] rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <Sparkles className="fluid-icon-lg text-white" />
                </div>
                <h3 className="fluid-text-2xl font-bold text-gray-800 fluid-mb-2">
                  {firstName ? <>Hola, {firstName} 👋</> : <>¡Hola! 👋</>}
                </h3>
                <p className="fluid-text-base text-gray-600 leading-relaxed fluid-mb-5">
                  Esta es tu plataforma para <strong>prepararte</strong>, <strong>certificarte</strong> y
                  obtener tus <strong>reconocimientos</strong>. Te mostramos en unos segundos cómo sacarle
                  el máximo provecho.
                </p>
                <div className="grid grid-cols-3 fluid-gap-3 text-center">
                  {[
                    { icon: BookOpen, label: 'Estudia' },
                    { icon: FlaskConical, label: 'Practica' },
                    { icon: Award, label: 'Certifícate' },
                  ].map(({ icon: I, label }) => (
                    <div key={label} className="rounded-fluid-lg border border-gray-100 bg-gray-50 fluid-py-4 fluid-px-2">
                      <div className="mx-auto fluid-mb-2 fluid-icon-lg rounded-full bg-primary-100 flex items-center justify-center">
                        <I className="fluid-icon-sm text-primary-600" />
                      </div>
                      <p className="fluid-text-xs font-medium text-gray-700">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              activeSlide && (
                <div>
                  <div className="flex items-center fluid-gap-4 fluid-mb-5">
                    <div className="flex-shrink-0 w-[clamp(3rem,2.5rem+1.5vw,4rem)] h-[clamp(3rem,2.5rem+1.5vw,4rem)] rounded-fluid-xl bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center shadow-md shadow-primary-500/25">
                      {SlideIcon && <SlideIcon className="fluid-icon-lg text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="fluid-text-xs font-semibold text-primary-600 uppercase tracking-wide fluid-mb-1">
                        {activeSlide.eyebrow}
                      </p>
                      <h3 className="fluid-text-xl font-bold text-gray-800 leading-tight">
                        {activeSlide.title}
                      </h3>
                    </div>
                  </div>
                  <p className="fluid-text-base text-gray-600 leading-relaxed fluid-mb-5">
                    {activeSlide.description}
                  </p>
                  <ul className="flex flex-col fluid-gap-3">
                    {activeSlide.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start fluid-gap-3 fluid-p-3 rounded-fluid-lg bg-primary-50 border border-primary-100"
                      >
                        <CheckCircle2 className="fluid-icon-sm text-primary-600 flex-shrink-0 fluid-mt-0.5" />
                        <span className="fluid-text-sm text-gray-700">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        </div>

        {/* Pie: progreso + navegación */}
        <div className="border-t border-gray-100 fluid-px-6 fluid-py-4">
          <div className="flex items-center fluid-gap-2 fluid-mb-4 justify-center">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > step ? 'right' : 'left')}
                className={`h-2 rounded-full transition-all ${
                  i === step ? 'w-6 bg-primary-600' : 'w-2 bg-gray-200 hover:bg-gray-300'
                }`}
                aria-label={`Ir al paso ${i + 1} de ${totalSteps}`}
                aria-current={i === step}
              />
            ))}
          </div>
          <div className="flex items-center justify-between fluid-gap-3">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className={`flex items-center fluid-gap-2 fluid-px-5 fluid-py-2.5 rounded-fluid-lg font-semibold fluid-text-sm transition-all ${
                step === 0
                  ? 'opacity-0 pointer-events-none'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 active:scale-95'
              }`}
            >
              <ArrowLeft className="fluid-icon-xs" />
              Atrás
            </button>
            <button
              ref={primaryBtnRef}
              onClick={handleNext}
              disabled={saving}
              className="flex items-center fluid-gap-2 fluid-px-6 fluid-py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-fluid-lg font-semibold fluid-text-sm shadow-md transition-all active:scale-95"
            >
              {isLast ? (
                <>
                  Comenzar
                  <CheckCircle2 className="fluid-icon-xs" />
                </>
              ) : (
                <>
                  {isWelcome ? 'Empezar' : 'Siguiente'}
                  <ArrowRight className="fluid-icon-xs" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
