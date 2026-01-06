import { Link } from 'react-router-dom'
import { Check, X, Sparkles } from 'lucide-react'

const plans = [
  {
    name: 'Gratuito',
    description: 'Perfecto para empezar a explorar',
    price: '0',
    period: 'siempre',
    popular: false,
    features: [
      { text: 'Hasta 3 exámenes', included: true },
      { text: '50 estudiantes', included: true },
      { text: '5 tipos de preguntas', included: true },
      { text: 'Reportes básicos', included: true },
      { text: 'Material de estudio', included: false },
      { text: 'Soporte prioritario', included: false },
      { text: 'API access', included: false },
      { text: 'White-label', included: false },
    ],
    cta: 'Comenzar Gratis',
    ctaLink: '/register',
  },
  {
    name: 'Pro',
    description: 'Para educadores profesionales',
    price: '29',
    period: '/mes',
    popular: true,
    features: [
      { text: 'Exámenes ilimitados', included: true },
      { text: 'Estudiantes ilimitados', included: true },
      { text: 'Todos los tipos de preguntas', included: true },
      { text: 'Reportes avanzados', included: true },
      { text: 'Material de estudio completo', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: 'API access', included: false },
      { text: 'White-label', included: false },
    ],
    cta: 'Prueba 14 días gratis',
    ctaLink: '/register?plan=pro',
  },
  {
    name: 'Institucional',
    description: 'Para escuelas y universidades',
    price: 'Personalizado',
    period: '',
    popular: false,
    features: [
      { text: 'Todo lo de Pro', included: true },
      { text: 'Múltiples administradores', included: true },
      { text: 'SSO / LDAP', included: true },
      { text: 'Reportes personalizados', included: true },
      { text: 'Integración LMS', included: true },
      { text: 'Soporte dedicado', included: true },
      { text: 'API access completo', included: true },
      { text: 'White-label', included: true },
    ],
    cta: 'Contactar Ventas',
    ctaLink: '#contact',
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Planes para cada necesidad
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comienza gratis y escala a medida que creces. Sin costos ocultos, cancela cuando quieras.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative rounded-2xl p-8 ${
                plan.popular 
                  ? 'bg-primary-600 text-white shadow-xl scale-105 border-2 border-primary-500' 
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-4 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-semibold">
                    <Sparkles className="w-4 h-4" />
                    Más Popular
                  </div>
                </div>
              )}

              {/* Plan Name */}
              <h3 className={`text-xl font-semibold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`text-sm mb-6 ${plan.popular ? 'text-primary-100' : 'text-gray-600'}`}>
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-6">
                <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price === 'Personalizado' ? '' : '$'}{plan.price}
                </span>
                <span className={`${plan.popular ? 'text-primary-100' : 'text-gray-600'}`}>
                  {plan.period}
                </span>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className={`w-5 h-5 flex-shrink-0 ${plan.popular ? 'text-primary-200' : 'text-green-500'}`} />
                    ) : (
                      <X className={`w-5 h-5 flex-shrink-0 ${plan.popular ? 'text-primary-300' : 'text-gray-300'}`} />
                    )}
                    <span className={`text-sm ${
                      feature.included 
                        ? plan.popular ? 'text-white' : 'text-gray-700'
                        : plan.popular ? 'text-primary-300' : 'text-gray-400'
                    }`}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to={plan.ctaLink}
                className={`block w-full py-3 px-6 rounded-xl font-semibold text-center transition-all ${
                  plan.popular
                    ? 'bg-white text-primary-600 hover:bg-gray-100'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="text-center text-gray-500 mt-12">
          Todos los planes incluyen SSL, backups diarios y actualizaciones gratuitas.
        </p>
      </div>
    </section>
  )
}
