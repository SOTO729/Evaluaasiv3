import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'María González',
    role: 'Directora Académica',
    institution: 'Colegio San Martín',
    image: null,
    rating: 5,
    text: 'Evaluaasi transformó la forma en que evaluamos a nuestros estudiantes. Los reportes detallados nos permiten identificar exactamente dónde cada alumno necesita más apoyo.',
  },
  {
    name: 'Carlos Rodríguez',
    role: 'Profesor de Matemáticas',
    institution: 'Universidad Nacional',
    image: null,
    rating: 5,
    text: 'La variedad de tipos de preguntas y la facilidad de uso son increíbles. Puedo crear exámenes complejos en minutos, no horas.',
  },
  {
    name: 'Ana Martínez',
    role: 'Coordinadora de Capacitación',
    institution: 'TechCorp México',
    image: null,
    rating: 5,
    text: 'Usamos Evaluaasi para certificar a nuestro equipo técnico. La integración con nuestra plataforma fue sencilla y el soporte es excelente.',
  },
  {
    name: 'Roberto Sánchez',
    role: 'Rector',
    institution: 'Instituto Tecnológico del Sur',
    image: null,
    rating: 5,
    text: 'Desde que implementamos Evaluaasi, hemos visto una mejora del 40% en la retención del conocimiento gracias al material de estudio integrado.',
  },
  {
    name: 'Laura Pérez',
    role: 'Profesora de Ciencias',
    institution: 'Secundaria Benito Juárez',
    image: null,
    rating: 5,
    text: 'Mis estudiantes adoran los ejercicios interactivos. Es una forma mucho más atractiva de aprender que los métodos tradicionales.',
  },
  {
    name: 'Diego Fernández',
    role: 'CEO',
    institution: 'Academia Online Plus',
    image: null,
    rating: 5,
    text: 'Evaluaasi nos permitió escalar nuestra academia de 200 a 5,000 estudiantes sin aumentar el equipo administrativo. ROI increíble.',
  },
]

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Lo que dicen nuestros usuarios
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Miles de educadores confían en Evaluaasi para transformar la experiencia de aprendizaje.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              {/* Quote Icon */}
              <div className="mb-4">
                <Quote className="w-8 h-8 text-primary-200" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {testimonial.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                  <div className="text-sm text-primary-600">{testimonial.institution}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
