import { 
  Handshake, 
  Users, 
  CheckCircle2, 
  ArrowRight,
  ShoppingCart,
  Globe,
  GraduationCap,
  Building2,
  TrendingUp,
  Shield,
  Zap,
  Clock
} from 'lucide-react'

const partnerBenefits = [
  'Precio reducido por producto para maximizar tu margen',
  'Plataforma completa: estudio, evaluación, certificación',
  'Gestión de trámites CONOCER incluida',
  'Panel de control con métricas y reportes',
  'Branding personalizado para tu organización',
  'Soporte dedicado para tu operación',
]

const directBenefits = [
  'El usuario final paga directamente en línea',
  'Proceso 100% digital y autoservicio',
  'Catálogo de certificaciones disponible',
  'Pago seguro con MercadoPago',
  'Emisión automática de credenciales',
  'Soporte por chat en horario laboral',
]

const partnerSteps = [
  {
    number: '01',
    title: 'Regístrate como Partner',
    description: 'Contáctanos y configura tu cuenta de partner con tus datos y branding.',
  },
  {
    number: '02',
    title: 'Registra a tus candidatos',
    description: 'Da de alta a tus usuarios en la plataforma y asígnales evaluaciones.',
  },
  {
    number: '03',
    title: 'Tus candidatos estudian y evalúan',
    description: 'Acceden al material de estudio y presentan su evaluación en línea.',
  },
  {
    number: '04',
    title: 'Se emiten las credenciales',
    description: 'Certificados, insignias o constancias se emiten automáticamente. Nosotros gestionamos los trámites.',
  },
]

export default function PartnersSection() {
  return (
    <section id="models" className="fluid-py-24 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 text-white">
      <div className="mx-auto fluid-px-8 2xl:fluid-px-16">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 backdrop-blur rounded-full text-primary-200 fluid-text-sm font-medium fluid-mb-6">
            <Handshake className="fluid-icon-sm" />
            Modelos de Negocio
          </div>
          <h2 className="fluid-text-3xl font-bold fluid-mb-4">
            Dos formas de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">
              trabajar contigo
            </span>
          </h2>
          <p className="fluid-text-xl text-primary-200 max-w-4xl mx-auto">
            Ya sea como partner que revende nuestros productos o como canal de venta directa,
            Evaluaasi se adapta a tu modelo de negocio.
          </p>
        </div>

        {/* Two Models Side by Side */}
        <div className="grid lg:grid-cols-2 fluid-gap-8 fluid-mb-20">
          {/* Partner Model */}
          <div className="bg-white rounded-fluid-2xl fluid-p-8 text-gray-900 shadow-2xl">
            <div className="flex items-center fluid-gap-3 fluid-mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-fluid-2xl flex items-center justify-center">
                <Building2 className="fluid-icon-lg text-white" />
              </div>
              <div>
                <h3 className="fluid-text-2xl font-bold">Modelo Partners</h3>
                <p className="text-gray-500">Tú vendes, nosotros operamos</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-fluid-2xl fluid-p-5 fluid-mb-6">
              <div className="flex items-center fluid-gap-3">
                <TrendingUp className="fluid-icon-xl text-primary-600" />
                <div>
                  <p className="font-semibold text-gray-900">Tú defines el precio al cliente final</p>
                  <p className="fluid-text-sm text-gray-600">Pagas un precio reducido a Evaluaasi y ganas la diferencia</p>
                </div>
              </div>
            </div>

            <ul className="flex flex-col fluid-gap-3 fluid-mb-6">
              {partnerBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start fluid-gap-3">
                  <CheckCircle2 className="fluid-icon-sm text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 fluid-text-sm">{benefit}</span>
                </li>
              ))}
            </ul>

            <a 
              href="#contact"
              className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-primary-600 text-white rounded-fluid-xl hover:bg-primary-700 transition-all font-semibold shadow-lg hover:shadow-xl"
            >
              Convertirme en Partner
              <ArrowRight className="fluid-icon-sm" />
            </a>
          </div>

          {/* Direct Sale Model */}
          <div className="bg-white rounded-fluid-2xl fluid-p-8 text-gray-900 shadow-2xl">
            <div className="flex items-center fluid-gap-3 fluid-mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-fluid-2xl flex items-center justify-center">
                <ShoppingCart className="fluid-icon-lg text-white" />
              </div>
              <div>
                <h3 className="fluid-text-2xl font-bold">Venta Directa</h3>
                <p className="text-gray-500">El usuario compra en línea</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-fluid-2xl fluid-p-5 fluid-mb-6">
              <div className="flex items-center fluid-gap-3">
                <Users className="fluid-icon-xl text-orange-600" />
                <div>
                  <p className="font-semibold text-gray-900">Evaluaasi vende directamente al cliente final</p>
                  <p className="fluid-text-sm text-gray-600">Proceso completo autoservicio con pago en línea</p>
                </div>
              </div>
            </div>

            <ul className="flex flex-col fluid-gap-3 fluid-mb-6">
              {directBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start fluid-gap-3">
                  <CheckCircle2 className="fluid-icon-sm text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 fluid-text-sm">{benefit}</span>
                </li>
              ))}
            </ul>

            <a 
              href="#contact"
              className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-orange-600 text-white rounded-fluid-xl hover:bg-orange-700 transition-all font-semibold shadow-lg hover:shadow-xl"
            >
              Quiero certificarme
              <ArrowRight className="fluid-icon-sm" />
            </a>
          </div>
        </div>

        {/* How Partner Model Works */}
        <div className="bg-white/5 backdrop-blur rounded-fluid-2xl fluid-p-10 fluid-mb-16">
          <h3 className="fluid-text-2xl font-bold text-center fluid-mb-12">
            ¿Cómo funciona el modelo Partners?
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 fluid-gap-8">
            {partnerSteps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < partnerSteps.length - 1 && (
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

        {/* Coming Soon Models */}
        <div className="text-center fluid-mb-8">
          <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 backdrop-blur rounded-full text-primary-300 fluid-text-sm font-medium">
            <Clock className="fluid-icon-sm" />
            Próximos modelos de negocio
          </div>
        </div>
        <div className="grid md:grid-cols-2 fluid-gap-8 max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur rounded-fluid-2xl fluid-p-8 border border-dashed border-white/20">
            <div className="flex items-start fluid-gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                <Globe className="fluid-icon-lg text-primary-300" />
              </div>
              <div>
                <h4 className="font-semibold text-white fluid-mb-2">Hosting de Insignias</h4>
                <p className="fluid-text-sm text-primary-300">Tu organización emite sus propias insignias digitales usando nuestra infraestructura como servicio.</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-fluid-2xl fluid-p-8 border border-dashed border-white/20">
            <div className="flex items-start fluid-gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                <GraduationCap className="fluid-icon-lg text-primary-300" />
              </div>
              <div>
                <h4 className="font-semibold text-white fluid-mb-2">LMS para Escuelas</h4>
                <p className="fluid-text-sm text-primary-300">Sistema de gestión de aprendizaje estilo Canva, diseñado para escuelas y centros de capacitación.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 fluid-gap-8 fluid-mt-16 fluid-pt-10 border-t border-white/10">
          <div className="text-center">
            <div className="fluid-text-3xl font-bold text-white">100+</div>
            <div className="fluid-text-sm text-primary-300">Partners activos</div>
          </div>
          <div className="text-center">
            <div className="fluid-text-3xl font-bold text-white">4</div>
            <div className="fluid-text-sm text-primary-300">Productos disponibles</div>
          </div>
          <div className="text-center">
            <div className="fluid-text-3xl font-bold text-white">28+</div>
            <div className="fluid-text-sm text-primary-300">Estados cubiertos</div>
          </div>
        </div>
      </div>
    </section>
  )
}
