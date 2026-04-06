import { ArrowRight, CheckCircle2, Award, BadgeCheck, ScrollText, FileCheck } from 'lucide-react'

export default function HeroSection() {
  const highlights = [
    'Centro Evaluador CONOCER',
    'Open Badges 3.0',
    'Verificación pública en línea',
  ]

  return (
    <section className="fluid-pt-16 fluid-pb-16 overflow-hidden">
      <div className="mx-auto fluid-px-8 2xl:fluid-px-16">
        <div className="grid lg:grid-cols-2 fluid-gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-primary-50 rounded-full text-primary-700 fluid-text-sm font-medium fluid-mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              Alianza <span className="font-bold">EduIT</span> · Centro Evaluador CONOCER
            </div>

            {/* Heading */}
            <h1 className="fluid-text-3xl font-bold text-gray-900 leading-tight fluid-mb-6">
              Certifica, acredita y{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">
                potencia el talento
              </span>
            </h1>

            {/* Subtitle */}
            <p className="fluid-text-xl text-gray-600 fluid-mb-8 max-w-2xl mx-auto lg:mx-0">
              Plataforma integral para emitir{' '}
              <strong className="text-primary-600">certificados CONOCER</strong>,{' '}
              insignias digitales, constancias de evaluación y certificados.
              Para partners y venta directa.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row fluid-gap-4 justify-center lg:justify-start fluid-mb-8">
              <a
                href="#products"
                className="inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-primary-600 text-white rounded-fluid-xl hover:bg-primary-700 transition-all font-semibold fluid-text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Conoce nuestros productos
                <ArrowRight className="fluid-icon-sm" />
              </a>
              <a
                href="#models"
                className="inline-flex items-center justify-center fluid-gap-2 fluid-px-8 fluid-py-4 bg-white text-gray-700 rounded-fluid-xl hover:bg-gray-50 transition-all font-semibold fluid-text-lg border border-gray-200 shadow-sm"
              >
                Quiero ser Partner
              </a>
            </div>

            {/* Highlights */}
            <div className="flex flex-wrap fluid-gap-4 justify-center lg:justify-start">
              {highlights.map((h) => (
                <div key={h} className="flex items-center fluid-gap-2 text-gray-600">
                  <CheckCircle2 className="fluid-icon-sm text-green-500" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Illustration */}
          <div className="relative lg:ml-8">
            <div className="relative">
              <div className="bg-gradient-to-br from-primary-100 via-primary-50 to-white rounded-fluid-2xl fluid-p-8 shadow-2xl">
                <div className="bg-white rounded-fluid-2xl shadow-lg overflow-hidden">
                  {/* Browser header */}
                  <div className="bg-gray-50 fluid-px-4 fluid-py-3 flex items-center fluid-gap-2 border-b">
                    <div className="flex fluid-gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="flex-1 text-center fluid-text-sm text-gray-500">
                      evaluaasi.com/dashboard
                    </div>
                  </div>
                  
                  {/* Mock content */}
                  <div className="fluid-p-6 flex flex-col fluid-gap-4">
                    {/* Product stats */}
                    <div className="grid sm:grid-cols-2 fluid-gap-3">
                      <div className="bg-yellow-50 rounded-fluid-lg fluid-p-3 flex items-center fluid-gap-3">
                        <Award className="fluid-icon-lg text-yellow-500" />
                        <div>
                          <div className="fluid-text-xs text-gray-500">CONOCER</div>
                          <div className="fluid-text-lg font-bold text-gray-900">1,247</div>
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-fluid-lg fluid-p-3 flex items-center fluid-gap-3">
                        <BadgeCheck className="fluid-icon-lg text-purple-500" />
                        <div>
                          <div className="fluid-text-xs text-gray-500">Insignias</div>
                          <div className="fluid-text-lg font-bold text-gray-900">3,580</div>
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-fluid-lg fluid-p-3 flex items-center fluid-gap-3">
                        <ScrollText className="fluid-icon-lg text-blue-500" />
                        <div>
                          <div className="fluid-text-xs text-gray-500">Constancias</div>
                          <div className="fluid-text-lg font-bold text-gray-900">5,912</div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-fluid-lg fluid-p-3 flex items-center fluid-gap-3">
                        <FileCheck className="fluid-icon-lg text-green-500" />
                        <div>
                          <div className="fluid-text-xs text-gray-500">Certificados</div>
                          <div className="fluid-text-lg font-bold text-gray-900">2,304</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity feed */}
                    <div className="flex flex-col fluid-gap-2">
                      {[
                        { label: 'Certificado CONOCER emitido', color: 'bg-yellow-400' },
                        { label: 'Insignia digital verificada', color: 'bg-purple-400' },
                        { label: 'Constancia generada', color: 'bg-blue-400' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center fluid-gap-3 fluid-p-2 bg-gray-50 rounded-fluid-lg">
                          <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                          <span className="fluid-text-sm text-gray-600 flex-1">{item.label}</span>
                          <span className="fluid-text-xs text-gray-400">Hace 2m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating element */}
              <div className="absolute -top-4 -right-4 bg-white rounded-fluid-xl shadow-lg fluid-p-4 animate-bounce">
                <div className="flex items-center fluid-gap-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="fluid-icon-lg text-green-600" />
                  </div>
                  <div>
                    <div className="fluid-text-sm font-semibold text-gray-900">+23 aprobados</div>
                    <div className="fluid-text-xs text-gray-500">esta semana</div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-white rounded-fluid-xl shadow-lg fluid-p-4">
                <div className="flex items-center fluid-gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 bg-primary-200 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-green-200 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-purple-200 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="fluid-text-sm">
                    <span className="font-semibold text-gray-900">+1,200</span>
                    <span className="text-gray-500"> educadores</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
