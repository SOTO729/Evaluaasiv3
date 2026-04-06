import { Award, BadgeCheck, ScrollText, FileCheck, Shield, CheckCircle2, Globe, GraduationCap, Clock } from 'lucide-react'

const products = [
  {
    icon: Award,
    title: 'Certificados CONOCER',
    description: 'Certificaciones de competencias laborales con validez oficial ante la SEP, emitidas a través de nuestra alianza con EduIT como Centro Evaluador autorizado.',
    features: [
      'Validez oficial en todo México',
      'Alineados a Estándares de Competencia',
      'Trámite completo ante CONOCER',
      'Verificación en línea'
    ],
    color: 'primary',
    badge: 'Validez Oficial'
  },
  {
    icon: BadgeCheck,
    title: 'Insignias Digitales',
    description: 'Credenciales digitales verificables bajo el estándar Open Badges 3.0 que reconocen competencias, logros y habilidades específicas.',
    features: [
      'Estándar Open Badges 3.0',
      'Compartir en LinkedIn',
      'Verificación pública',
      'Diseños personalizados'
    ],
    color: 'purple',
    badge: 'Open Badges 3.0'
  },
  {
    icon: ScrollText,
    title: 'Constancias de Evaluación',
    description: 'Constancias de participación y aprovechamiento generadas automáticamente con diseño profesional y verificación por código QR.',
    features: [
      'Generación automática',
      'Código QR de verificación',
      'Plantillas personalizables',
      'Descarga en PDF'
    ],
    color: 'orange',
    badge: 'Automáticas'
  },
  {
    icon: FileCheck,
    title: 'Certificados',
    description: 'Certificados digitales con código de verificación único, personalizables con la identidad de tu organización o partner.',
    features: [
      'Verificación en línea',
      'Branding personalizado',
      'Generación por lote',
      'Historial de emisión'
    ],
    color: 'green',
    badge: 'Verificables'
  },
]

const comingSoon = [
  {
    icon: Globe,
    title: 'Hosting de Insignias Digitales',
    description: 'Infraestructura SaaS para que terceros emitan sus propias insignias digitales usando nuestra plataforma.',
  },
  {
    icon: GraduationCap,
    title: 'LMS para Escuelas',
    description: 'Sistema de gestión de aprendizaje estilo Canva, diseñado para escuelas y centros de capacitación.',
  },
]

const colorClasses = {
  primary: {
    bg: 'bg-primary-600',
    bgLight: 'bg-primary-100',
    text: 'text-primary-600',
    border: 'border-primary-200',
    badge: 'bg-primary-100 text-primary-700',
  },
  purple: {
    bg: 'bg-purple-600',
    bgLight: 'bg-purple-100',
    text: 'text-purple-600',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
  },
  orange: {
    bg: 'bg-orange-600',
    bgLight: 'bg-orange-100',
    text: 'text-orange-600',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
  },
  green: {
    bg: 'bg-green-600',
    bgLight: 'bg-green-100',
    text: 'text-green-600',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700',
  },
}

export default function CertificationsSection() {
  return (
    <section id="products" className="fluid-py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="mx-auto fluid-px-8 2xl:fluid-px-16">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-primary-500/20 rounded-full text-primary-300 fluid-text-sm font-medium fluid-mb-6">
            <Shield className="fluid-icon-sm" />
            Nuestros Productos
          </div>
          <h2 className="fluid-text-3xl font-bold fluid-mb-4">
            Cuatro productos para{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
              certificar y acreditar
            </span>
          </h2>
          <p className="fluid-text-xl text-gray-400 max-w-4xl mx-auto">
            Desde certificaciones con validez oficial CONOCER hasta insignias digitales verificables.
            Todo lo que necesitas para acreditar competencias y talento.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 fluid-gap-8">
          {products.map((product) => {
            const colors = colorClasses[product.color as keyof typeof colorClasses]
            const Icon = product.icon
            
            return (
              <div 
                key={product.title}
                className="relative bg-gray-800/50 backdrop-blur rounded-fluid-2xl fluid-p-8 pt-10 border border-gray-700 hover:border-gray-600 transition-all group"
              >
                {/* Badge */}
                <div className={`absolute -top-3 right-4 fluid-px-3 fluid-py-1 rounded-full fluid-text-xs font-semibold ${colors.badge}`}>
                  {product.badge}
                </div>

                {/* Icon */}
                <div className={`w-14 h-14 ${colors.bgLight} rounded-fluid-2xl flex items-center justify-center fluid-mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className={`fluid-icon-lg ${colors.text}`} />
                </div>

                {/* Title */}
                <h3 className="fluid-text-lg font-bold text-white fluid-mb-4">
                  {product.title}
                </h3>

                {/* Description */}
                <p className="text-gray-400 fluid-mb-6 fluid-text-sm">
                  {product.description}
                </p>

                {/* Features */}
                <ul className="flex flex-col fluid-gap-3">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-center fluid-gap-2 fluid-text-sm">
                      <CheckCircle2 className={`fluid-icon-xs ${colors.text} flex-shrink-0`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Coming Soon */}
        <div className="fluid-mt-16">
          <div className="text-center fluid-mb-10">
            <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/5 rounded-full text-gray-400 fluid-text-sm font-medium">
              <Clock className="fluid-icon-sm" />
              Próximamente
            </div>
          </div>
          <div className="grid md:grid-cols-2 fluid-gap-8 max-w-4xl mx-auto">
            {comingSoon.map((item) => {
              const Icon = item.icon
              return (
                <div 
                  key={item.title}
                  className="bg-gray-800/30 backdrop-blur rounded-fluid-2xl fluid-p-8 border border-dashed border-gray-700 opacity-80"
                >
                  <div className="flex items-start fluid-gap-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="fluid-icon-lg text-gray-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-300 fluid-mb-1">{item.title}</h4>
                      <p className="fluid-text-sm text-gray-500">{item.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* CONOCER Banner */}
        <div className="fluid-mt-16 bg-gradient-to-r from-primary-600 to-primary-700 rounded-fluid-2xl fluid-p-8">
          <div className="flex flex-col md:flex-row items-center justify-between fluid-gap-8">
            <div className="text-center md:text-left">
              <h3 className="fluid-text-2xl font-bold text-white fluid-mb-2">
                ¿Necesitas certificar con CONOCER?
              </h3>
              <p className="text-primary-100 max-w-xl">
                Gracias a nuestra alianza con EduIT, Centro Evaluador autorizado,
                gestionamos todo el proceso de certificación ante el CONOCER por ti.
              </p>
            </div>
            <a 
              href="#contact"
              className="flex-shrink-0 inline-flex items-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-white text-primary-600 rounded-fluid-xl hover:bg-gray-100 transition-colors font-semibold shadow-lg"
            >
              Solicitar Información
              <Award className="fluid-icon-sm" />
            </a>
          </div>
        </div>


      </div>
    </section>
  )
}
