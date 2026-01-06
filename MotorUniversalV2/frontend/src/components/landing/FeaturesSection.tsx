import { 
  FileQuestion, 
  BarChart3, 
  BookOpen, 
  CheckCircle2,
  Award,
  BadgeCheck,
  ScrollText
} from 'lucide-react'

const features = [
  {
    icon: FileQuestion,
    title: 'Múltiples Tipos de Preguntas',
    description: 'Verdadero/Falso, opción múltiple, selección múltiple, ordenamiento y más. Crea evaluaciones dinámicas y completas.',
    color: 'primary',
    highlights: ['4+ tipos de preguntas', 'Editor visual', 'Imágenes y videos']
  },
  {
    icon: Award,
    title: 'Certificados CONOCER',
    description: 'Emite certificados con validez oficial avalados por el Consejo Nacional de Normalización y Certificación de Competencias Laborales.',
    color: 'green',
    highlights: ['Validez oficial', 'Estándares EC', 'Registro automático']
  },
  {
    icon: BadgeCheck,
    title: 'Insignias Digitales',
    description: 'Otorga insignias digitales verificables que reconocen logros y competencias de tus estudiantes.',
    color: 'purple',
    highlights: ['Verificación blockchain', 'Compartir en LinkedIn', 'Diseños personalizados']
  },
  {
    icon: ScrollText,
    title: 'Constancias de Estudio',
    description: 'Genera constancias de participación y aprovechamiento con diseños profesionales y códigos de verificación.',
    color: 'orange',
    highlights: ['Generación automática', 'QR de verificación', 'Plantillas editables']
  },
  {
    icon: BookOpen,
    title: 'Material de Estudio',
    description: 'Crea contenido interactivo con lecturas, videos y ejercicios prácticos guiados.',
    color: 'red',
    highlights: ['Videos integrados', 'Ejercicios paso a paso', 'Recursos descargables']
  },
  {
    icon: BarChart3,
    title: 'Análisis Detallado',
    description: 'Dashboard con métricas en tiempo real. Identifica fortalezas y áreas de mejora de cada estudiante.',
    color: 'yellow',
    highlights: ['Reportes automáticos', 'Gráficos interactivos', 'Exportar a PDF']
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
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Todo lo que necesitas para{' '}
            <span className="text-primary-600">evaluar mejor</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Herramientas poderosas diseñadas para educadores que buscan 
            mejorar la experiencia de aprendizaje de sus estudiantes.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const colors = colorClasses[feature.color as keyof typeof colorClasses]
            const Icon = feature.icon
            
            return (
              <div 
                key={feature.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:border-primary-100 transition-all group"
              >
                {/* Icon */}
                <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-7 h-7 ${colors.icon}`} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 mb-4">
                  {feature.description}
                </p>

                {/* Highlights */}
                <ul className="space-y-2">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`w-4 h-4 ${colors.highlight}`} />
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
