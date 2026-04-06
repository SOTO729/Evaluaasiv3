import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Roberto Méndez',
    role: 'Director de Partner',
    institution: 'Certificaciones del Norte',
    image: null,
    rating: 5,
    text: 'Como partner de Evaluaasi, logramos certificar a más de 300 personas en 6 meses. La plataforma nos permite manejar todo el proceso sin complicaciones y el margen de ganancia es excelente.',
  },
  {
    name: 'Ana Laura Ríos',
    role: 'Coordinadora de Capacitación',
    institution: 'Grupo Empresarial del Bajío',
    image: null,
    rating: 5,
    text: 'Las insignias digitales de Evaluaasi nos ayudaron a reconocer competencias internas. Nuestros colaboradores las comparten en LinkedIn y ha mejorado nuestra marca empleadora.',
  },
  {
    name: 'Carlos Hernández',
    role: 'Candidato Certificado',
    institution: 'EC0217 - Impartición de cursos',
    image: null,
    rating: 5,
    text: 'El proceso de certificación CONOCER fue muy claro. Estudié con el material de la plataforma, hice mi evaluación en línea y en pocas semanas recibí mi certificado oficial.',
  },
  {
    name: 'Patricia Soto',
    role: 'Responsable de Plantel',
    institution: 'Instituto de Formación Profesional',
    image: null,
    rating: 5,
    text: 'Gestionar a nuestros candidatos es muy sencillo. Puedo dar seguimiento a cada uno, solicitar certificados y ver los resultados en tiempo real desde mi panel.',
  },
  {
    name: 'Marco Jiménez',
    role: 'Director General',
    institution: 'TechCapacita MX',
    image: null,
    rating: 5,
    text: 'Empezamos como partner hace un año y ya operamos en 5 estados. La plataforma es confiable, el soporte es rápido y el modelo de negocio nos permite crecer sin inversión en tecnología.',
  },
  {
    name: 'Sofía Ramírez',
    role: 'Candidata',
    institution: 'Certificación en competencias digitales',
    image: null,
    rating: 5,
    text: 'Pagué mi certificación directamente en línea, hice todo el proceso desde mi casa y ahora tengo mi certificado CONOCER y mi insignia digital. Super recomendable.',
  },
]

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="fluid-py-20 bg-gray-50">
      <div className="mx-auto fluid-px-8 2xl:fluid-px-16">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
            Lo que dicen nuestros partners y usuarios
          </h2>
          <p className="fluid-text-xl text-gray-600 max-w-4xl mx-auto">
            Partners, responsables y candidatos confían en Evaluaasi para
            certificar competencias y emitir credenciales digitales.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 fluid-gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white rounded-fluid-2xl fluid-p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              {/* Quote Icon */}
              <div className="fluid-mb-4">
                <Quote className="fluid-icon-xl text-primary-200" />
              </div>

              {/* Rating */}
              <div className="flex fluid-gap-1 fluid-mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="fluid-icon-sm text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-gray-700 fluid-mb-6 leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center fluid-gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {testimonial.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="fluid-text-sm text-gray-500">{testimonial.role}</div>
                  <div className="fluid-text-sm text-primary-600">{testimonial.institution}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
