import { Link } from 'react-router-dom'
import { Play, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function HeroSection() {
  const benefits = [
    'Sin tarjeta de crédito',
    'Configuración en 5 minutos',
    'Soporte 24/7',
  ]

  return (
    <section className="pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-full text-primary-700 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              Un producto de <span className="font-bold">Eduit</span> · Plataforma #1 en evaluación educativa
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Evalúa y{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">
                potencia
              </span>{' '}
              el aprendizaje
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-gray-600 mb-8 max-w-lg mx-auto lg:mx-0">
              Crea exámenes, gestiona contenido de estudio, emite constancias, 
              insignias digitales y <strong className="text-primary-600">certificados avalados por el CONOCER</strong>. Todo en una plataforma.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Comenzar Gratis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold text-lg border border-gray-200 shadow-sm">
                <Play className="w-5 h-5 text-primary-600" />
                Ver Demo
              </button>
            </div>

            {/* Benefits */}
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-gray-600">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Illustration/Image */}
          <div className="relative lg:ml-8">
            <div className="relative">
              {/* Main visual */}
              <div className="bg-gradient-to-br from-primary-100 via-primary-50 to-white rounded-3xl p-8 shadow-2xl">
                {/* Mock Dashboard */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="flex-1 text-center text-sm text-gray-500">
                      evaluaasi.com/dashboard
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-primary-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-primary-600">12</div>
                        <div className="text-xs text-gray-600">Exámenes</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">156</div>
                        <div className="text-xs text-gray-600">Estudiantes</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-600">89%</div>
                        <div className="text-xs text-gray-600">Aprobación</div>
                      </div>
                    </div>
                    
                    {/* Progress bars */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Matemáticas</span>
                          <span className="text-gray-900 font-medium">92%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Ciencias</span>
                          <span className="text-gray-900 font-medium">78%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: '78%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Historia</span>
                          <span className="text-gray-900 font-medium">85%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 animate-bounce">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">+23 aprobados</div>
                    <div className="text-xs text-gray-500">esta semana</div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 bg-primary-200 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-green-200 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-purple-200 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="text-sm">
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
