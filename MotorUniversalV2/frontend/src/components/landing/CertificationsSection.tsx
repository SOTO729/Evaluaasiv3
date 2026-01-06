import { Award, BadgeCheck, ScrollText, Shield, CheckCircle2 } from 'lucide-react'

const certifications = [
  {
    icon: Award,
    title: 'Certificados CONOCER',
    description: 'Certificaciones con validez oficial ante la SEP, avaladas por el Consejo Nacional de Normalización y Certificación de Competencias Laborales.',
    features: [
      'Validez oficial en todo México',
      'Alineados a Estándares de Competencia',
      'Registro automático ante CONOCER',
      'Verificación en línea'
    ],
    color: 'primary',
    badge: 'Validez Oficial'
  },
  {
    icon: BadgeCheck,
    title: 'Insignias Digitales',
    description: 'Credenciales digitales verificables que reconocen logros, habilidades y competencias específicas de tus estudiantes.',
    features: [
      'Estándar Open Badges 2.0',
      'Compartir en LinkedIn',
      'Verificación blockchain',
      'Diseños personalizados'
    ],
    color: 'purple',
    badge: 'Verificables'
  },
  {
    icon: ScrollText,
    title: 'Constancias de Estudio',
    description: 'Genera constancias de participación y aprovechamiento con diseños profesionales y códigos de verificación únicos.',
    features: [
      'Generación automática',
      'Código QR de verificación',
      'Plantillas personalizables',
      'Descarga en PDF'
    ],
    color: 'orange',
    badge: 'Automáticas'
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
}

export default function CertificationsSection() {
  return (
    <section id="certifications" className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/20 rounded-full text-primary-300 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            Certificaciones con Valor Real
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Emite Certificados con{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
              Validez Oficial
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            No solo evalúas, también certificas. Otorga reconocimientos que 
            realmente impulsan la carrera de tus estudiantes.
          </p>
        </div>

        {/* Certifications Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {certifications.map((cert) => {
            const colors = colorClasses[cert.color as keyof typeof colorClasses]
            const Icon = cert.icon
            
            return (
              <div 
                key={cert.title}
                className="relative bg-gray-800/50 backdrop-blur rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all group"
              >
                {/* Badge */}
                <div className={`absolute -top-3 right-6 px-3 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
                  {cert.badge}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 ${colors.bgLight} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-8 h-8 ${colors.text}`} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-3">
                  {cert.title}
                </h3>

                {/* Description */}
                <p className="text-gray-400 mb-6">
                  {cert.description}
                </p>

                {/* Features */}
                <ul className="space-y-3">
                  {cert.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className={`w-5 h-5 ${colors.text} flex-shrink-0`} />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* CONOCER Banner */}
        <div className="mt-16 bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">
                ¿Quieres certificar con CONOCER?
              </h3>
              <p className="text-primary-100 max-w-xl">
                Somos Centro de Evaluación autorizado. Te ayudamos a implementar 
                procesos de certificación alineados a los Estándares de Competencia de la SEP.
              </p>
            </div>
            <a 
              href="#contact"
              className="flex-shrink-0 inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-xl hover:bg-gray-100 transition-colors font-semibold shadow-lg"
            >
              Solicitar Información
              <Award className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm mb-6">Avalado por</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            <div className="text-gray-400 font-semibold">
              <span className="text-xl">CONOCER</span>
              <span className="block text-xs text-gray-500">Consejo Nacional de Normalización</span>
            </div>
            <div className="text-gray-400 font-semibold">
              <span className="text-xl">SEP</span>
              <span className="block text-xs text-gray-500">Secretaría de Educación Pública</span>
            </div>
            <div className="text-gray-400 font-semibold">
              <span className="text-xl">STPS</span>
              <span className="block text-xs text-gray-500">Secretaría del Trabajo</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
