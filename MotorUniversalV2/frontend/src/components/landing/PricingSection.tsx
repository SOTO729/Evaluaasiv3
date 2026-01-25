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
    <section id="pricing" className="fluid-py-20 bg-white">
      <div className="max-w-7xl mx-auto fluid-px-6">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
            Planes para cada necesidad
          </h2>
          <p className="fluid-text-xl text-gray-600 max-w-2xl mx-auto">
            Comienza gratis y escala a medida que creces. Sin costos ocultos, cancela cuando quieras.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 fluid-gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative rounded-fluid-2xl fluid-p-8 ${
                plan.popular 
                  ? 'bg-primary-600 text-white shadow-xl scale-105 border-2 border-primary-500' 
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center fluid-gap-1 fluid-px-4 fluid-py-1 bg-yellow-400 text-yellow-900 rounded-full fluid-text-sm font-semibold">
                    <Sparkles className="fluid-icon-sm" />
                    Más Popular
                  </div>
                </div>
              )}

              {/* Plan Name */}
              <h3 className={`fluid-text-xl font-semibold fluid-mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`fluid-text-sm fluid-mb-6 ${plan.popular ? 'text-primary-100' : 'text-gray-600'}`}>
                {plan.description}
              </p>

              {/* Price */}
              <div className="fluid-mb-6">
                <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price === 'Personalizado' ? '' : '$'}{plan.price}
                </span>
                <span className={`${plan.popular ? 'text-primary-100' : 'text-gray-600'}`}>
                  {plan.period}
                </span>
              </div>

              {/* Features */}
              <ul className="flex flex-col fluid-gap-3 fluid-mb-8">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-center fluid-gap-3">
                    {feature.included ? (
                      <Check className={`fluid-icon-sm flex-shrink-0 ${plan.popular ? 'text-primary-200' : 'text-green-500'}`} />
                    ) : (
                      <X className={`fluid-icon-sm flex-shrink-0 ${plan.popular ? 'text-primary-300' : 'text-gray-300'}`} />
                    )}
                    <span className={`fluid-text-sm ${
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
                className={`block w-full fluid-py-3 fluid-px-6 rounded-fluid-xl font-semibold text-center transition-all ${
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
        <p className="text-center text-gray-500 fluid-mt-12">
          Todos los planes incluyen SSL, backups diarios y actualizaciones gratuitas.
        </p>
      </div>
    </section>
  )
}
