import { 
  BookOpen, 
  FileQuestion, 
  Award,
  BadgeCheck,
  FileText,
  Search,
  CheckCircle2
} from 'lucide-react'

const features = [
  {
    icon: BookOpen,
    title: 'Material de Estudio',
    description: 'Cursos con lecturas, videos y ejercicios interactivos paso a paso. El candidato estudia a su ritmo antes de presentar su evaluación.',
    color: 'primary',
    highlights: ['Videos integrados', 'Ejercicios interactivos', 'Recursos descargables']
  },
  {
    icon: FileQuestion,
    title: 'Evaluación',
    description: '6 tipos de reactivos: verdadero/falso, opción múltiple, selección múltiple, ordenamiento, arrastrar y soltar, y agrupación por columnas.',
    color: 'green',
    highlights: ['6 tipos de reactivos', 'Simuladores prácticos', 'Calificación automática']
  },
  {
    icon: Award,
    title: 'Certificación CONOCER',
    description: 'Proceso de certificación completo ante el CONOCER: evaluación, evidencias, trámite gubernamental y emisión del certificado oficial.',
    color: 'orange',
    highlights: ['Trámite ante CONOCER', 'Gestión de evidencias', 'Seguimiento en línea']
  },
  {
    icon: BadgeCheck,
    title: 'Credenciales Digitales',
    description: 'Emisión de insignias digitales Open Badges 3.0, constancias de evaluación y certificados con verificación pública.',
    color: 'purple',
    highlights: ['Open Badges 3.0', 'QR de verificación', 'Compartir en LinkedIn']
  },
  {
    icon: FileText,
    title: 'Gestión Administrativa',
    description: 'Panel para partners y coordinadores: gestión de candidatos, saldo, solicitudes de certificados y reportes de actividad.',
    color: 'red',
    highlights: ['Multi-tenant', 'Control de saldo', 'Reportes en tiempo real']
  },
  {
    icon: Search,
    title: 'Verificación Pública',
    description: 'Cualquier persona puede verificar la autenticidad de un certificado, insignia o constancia con su código o URL única.',
    color: 'yellow',
    highlights: ['Verificación por código', 'Página pública', 'Sin login requerido']
  },
]

const colorClasses = {
  primary: {
    bg: 'bg-primary-100',
    icon: 'text-primary-600',
    highlight: 'text-primary-600'
  },
  green: {
    bg: 'bg-green-100',
    icon: 'text-green-600',
    highlight: 'text-green-600'
  },
  purple: {
    bg: 'bg-purple-100',
    icon: 'text-purple-600',
    highlight: 'text-purple-600'
  },
  orange: {
    bg: 'bg-orange-100',
    icon: 'text-orange-600',
    highlight: 'text-orange-600'
  },
  red: {
    bg: 'bg-red-100',
    icon: 'text-red-600',
    highlight: 'text-red-600'
  },
  yellow: {
    bg: 'bg-yellow-100',
    icon: 'text-yellow-600',
    highlight: 'text-yellow-600'
  },
}

export default function FeaturesSection() {
  return (
    <section id="platform" className="fluid-py-20 bg-gray-50">
      <div className="mx-auto fluid-px-8 2xl:fluid-px-16">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
            Una plataforma,{' '}
            <span className="text-primary-600">todo el proceso</span>
          </h2>
          <p className="fluid-text-xl text-gray-600 max-w-4xl mx-auto">
            Desde el estudio hasta la emisión de credenciales, Evaluaasi
            gestiona cada paso del proceso de certificación y acreditación.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 fluid-gap-8">
          {features.map((feature) => {
            const colors = colorClasses[feature.color as keyof typeof colorClasses]
            const Icon = feature.icon
            
            return (
              <div 
                key={feature.title}
                className="bg-white rounded-fluid-2xl fluid-p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-primary-100 transition-all group"
              >
                {/* Icon */}
                <div className={`w-14 h-14 ${colors.bg} rounded-fluid-xl flex items-center justify-center fluid-mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon className={`fluid-icon-lg ${colors.icon}`} />
                </div>

                {/* Title */}
                <h3 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 fluid-mb-4">
                  {feature.description}
                </p>

                {/* Highlights */}
                <ul className="flex flex-col fluid-gap-2">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center fluid-gap-2 fluid-text-sm">
                      <CheckCircle2 className={`fluid-icon-sm ${colors.highlight}`} />
                      <span className="text-gray-700">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
