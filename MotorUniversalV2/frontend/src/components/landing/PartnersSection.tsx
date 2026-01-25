import { 
  Handshake, 
  Users, 
  CheckCircle2, 
  ArrowRight,
  Award,
  Globe,
  Zap,
  Shield
} from 'lucide-react'

const benefits = [
  {
    icon: Globe,
    title: 'Alcance Nacional',
    description: 'Llega a miles de candidatos en todo México a través de nuestra plataforma digital.',
  },
  {
    icon: Zap,
    title: 'Proceso Automatizado',
    description: 'Evaluaciones en línea, verificación automática y emisión de certificados sin intervención manual.',
  },
  {
    icon: Users,
    title: 'Red de Evaluadores',
    description: 'Acceso a nuestra red de evaluadores certificados para escalar tu capacidad de certificación.',
  },
  {
    icon: Shield,
    title: 'Cumplimiento CONOCER',
    description: 'Plataforma alineada a los requisitos del CONOCER para Centros de Evaluación.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Regístrate como Partner',
    description: 'Completa el formulario con los datos de tu Estándar de Competencia.',
  },
  {
    number: '02',
    title: 'Configura tu Estándar',
    description: 'Carga tus instrumentos de evaluación y criterios en la plataforma.',
  },
  {
    number: '03',
    title: 'Publica y Promociona',
    description: 'Tu estándar estará disponible para candidatos en todo el país.',
  },
  {
    number: '04',
    title: 'Certifica y Cobra',
    description: 'Por cada certificado tramitado, tú defines el precio y nosotros solo cobramos comisión.',
  },
]

export default function PartnersSection() {
  return (
    <section id="partners" className="fluid-py-20 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 text-white">
      <div className="max-w-7xl mx-auto fluid-px-6">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 backdrop-blur rounded-full text-primary-200 fluid-text-sm font-medium fluid-mb-6">
            <Handshake className="fluid-icon-sm" />
            Programa de Partners
          </div>
          <h2 className="fluid-text-3xl font-bold fluid-mb-4">
            ¿Eres dueño de un{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">
              Estándar CONOCER
            </span>?
          </h2>
          <p className="fluid-text-xl text-primary-200 max-w-3xl mx-auto">
            Masifica tu estándar de competencia a través de Evaluaasi. 
            Llega a más candidatos, automatiza el proceso y genera ingresos recurrentes.
          </p>
        </div>

        {/* Main Value Proposition */}
        <div className="grid lg:grid-cols-2 fluid-gap-12 items-center fluid-mb-20">
          {/* Left - Pricing Card */}
          <div className="bg-white rounded-fluid-2xl fluid-p-8 text-gray-900 shadow-2xl">
            <div className="flex items-center fluid-gap-3 fluid-mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-fluid-2xl flex items-center justify-center">
                <Award className="fluid-icon-lg text-white" />
              </div>
              <div>
                <h3 className="fluid-text-2xl font-bold">Modelo de Comisión</h3>
                <p className="text-gray-500">Simple y transparente</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-fluid-2xl fluid-p-6 fluid-mb-6">
              <div className="text-center">
                <p className="text-gray-600 fluid-mb-2">Comisión por certificado tramitado</p>
                <div className="flex items-baseline justify-center fluid-gap-1">
                  <span className="fluid-text-lg text-gray-500">Desde</span>
                  <span className="text-5xl font-bold text-primary-600">$20</span>
                  <span className="fluid-text-xl text-gray-500">MXN</span>
                </div>
                <p className="fluid-text-sm text-gray-500 fluid-mt-2">por certificado emitido</p>
              </div>
            </div>

            <ul className="flex flex-col fluid-gap-4 fluid-mb-8">
              <li className="flex items-start fluid-gap-3">
                <CheckCircle2 className="fluid-icon-lg text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">Tú defines el precio</span>
                  <p className="fluid-text-sm text-gray-500">Establece el costo de tu certificación según el mercado</p>
                </div>
              </li>
              <li className="flex items-start fluid-gap-3">
                <CheckCircle2 className="fluid-icon-lg text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">Sin cuotas mensuales</span>
                  <p className="fluid-text-sm text-gray-500">Solo pagas cuando se tramita un certificado</p>
                </div>
              </li>
              <li className="flex items-start fluid-gap-3">
                <CheckCircle2 className="fluid-icon-lg text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">Pagos semanales</span>
                  <p className="fluid-text-sm text-gray-500">Recibe tus ingresos cada semana de forma automática</p>
                </div>
              </li>
              <li className="flex items-start fluid-gap-3">
                <CheckCircle2 className="fluid-icon-lg text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-900">Dashboard de métricas</span>
                  <p className="fluid-text-sm text-gray-500">Visualiza candidatos, certificaciones y ganancias en tiempo real</p>
                </div>
              </li>
            </ul>

            <a 
              href="#contact"
              className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-primary-600 text-white rounded-fluid-xl hover:bg-primary-700 transition-all font-semibold fluid-text-lg shadow-lg hover:shadow-xl"
            >
              Convertirme en Partner
              <ArrowRight className="fluid-icon-sm" />
            </a>
          </div>

          {/* Right - Benefits */}
          <div>
            <h3 className="fluid-text-2xl font-bold fluid-mb-8">
              ¿Por qué masificar tu estándar con Evaluaasi?
            </h3>
            <div className="flex flex-col fluid-gap-6">
              {benefits.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <div key={benefit.title} className="flex fluid-gap-4">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="fluid-icon-lg text-primary-300" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white fluid-mb-1">{benefit.title}</h4>
                      <p className="text-primary-300">{benefit.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 fluid-gap-4 fluid-mt-10 fluid-pt-10 border-t border-white/10">
              <div className="text-center">
                <div className="fluid-text-3xl font-bold text-white">5,000+</div>
                <div className="fluid-text-sm text-primary-300">Certificados emitidos</div>
              </div>
              <div className="text-center">
                <div className="fluid-text-3xl font-bold text-white">50+</div>
                <div className="fluid-text-sm text-primary-300">Estándares activos</div>
              </div>
              <div className="text-center">
                <div className="fluid-text-3xl font-bold text-white">98%</div>
                <div className="fluid-text-sm text-primary-300">Satisfacción</div>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white/5 backdrop-blur rounded-fluid-2xl fluid-p-8">
          <h3 className="fluid-text-2xl font-bold text-center fluid-mb-12">
            ¿Cómo funciona el programa?
          </h3>
          <div className="grid md:grid-cols-4 fluid-gap-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary-400 to-transparent"></div>
                )}
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-fluid-2xl flex items-center justify-center fluid-text-2xl font-bold fluid-mb-4 shadow-lg">
                    {step.number}
                  </div>
                  <h4 className="font-semibold text-white fluid-mb-2">{step.title}</h4>
                  <p className="text-primary-300 fluid-text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="fluid-mt-16 text-center">
          <p className="text-primary-200 fluid-mb-6 fluid-text-lg">
            ¿Tienes preguntas sobre el programa de partners?
          </p>
          <div className="flex flex-col sm:flex-row fluid-gap-4 justify-center">
            <a 
              href="#contact"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-white text-primary-600 rounded-fluid-xl hover:bg-gray-100 transition-all font-semibold shadow-lg"
            >
              Solicitar información
            </a>
            <a 
              href="tel:+522222379492"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-white/10 backdrop-blur text-white rounded-fluid-xl hover:bg-white/20 transition-all font-semibold border border-white/20"
            >
              Llamar ahora: (222) 237 9492
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
