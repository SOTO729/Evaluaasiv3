import { Building2, Target, Eye, Award, ExternalLink, Shield, Handshake } from 'lucide-react'

const alliancePoints = [
  {
    icon: Shield,
    title: 'Centro Evaluador CONOCER',
    description: 'EduIT es Centro Evaluador autorizado por el CONOCER, lo que permite a Evaluaasi gestionar certificaciones con validez oficial.',
  },
  {
    icon: Building2,
    title: '20+ Años de Experiencia',
    description: 'Grupo EduIT es un corporativo 100% mexicano, líder en capacitación en informática y soluciones tecnológicas.',
  },
  {
    icon: Handshake,
    title: 'Microsoft Partner Gold',
    description: 'Partner Gold de Microsoft con 7 competencias certificadas, lo que nos posiciona como uno de los principales proveedores del país.',
  },
  {
    icon: Award,
    title: 'Infraestructura en la Nube',
    description: 'Plataforma alojada en Microsoft Azure con los más altos estándares de seguridad, disponibilidad y escalabilidad.',
  },
]

const companies = [
  { name: 'EduIT', description: 'Centro de Capacitación en Informática y Centro Evaluador CONOCER' },
  { name: 'CPDS', description: 'Soluciones Tecnológicas Empresariales' },
  { name: 'Evaluaasi', description: 'Plataforma de Evaluación, Certificación y Credenciales Digitales' },
]

export default function AboutSection() {
  return (
    <section id="about" className="fluid-py-24 bg-gray-50">
      <div className="mx-auto fluid-px-8 2xl:fluid-px-16">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-primary-100 rounded-full text-primary-700 fluid-text-sm font-medium fluid-mb-6">
            <Building2 className="fluid-icon-sm" />
            Respaldo y Experiencia
          </div>
          <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
            Respaldados por{' '}
            <span className="text-primary-600">Grupo EduIT</span>
          </h2>
          <p className="fluid-text-xl text-gray-600 max-w-4xl mx-auto">
            Evaluaasi es un producto de EduIT, Centro Evaluador autorizado por el CONOCER
            y corporativo líder en tecnología educativa en México.
          </p>
        </div>

        {/* Alliance Points Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 fluid-gap-8 fluid-mb-16">
          {alliancePoints.map((point) => {
            const Icon = point.icon
            return (
              <div 
                key={point.title}
                className="bg-white rounded-fluid-2xl fluid-p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-fluid-xl flex items-center justify-center fluid-mb-6">
                  <Icon className="fluid-icon-lg text-primary-600" />
                </div>
                <h4 className="font-semibold text-gray-900 fluid-mb-3">{point.title}</h4>
                <p className="fluid-text-sm text-gray-600">{point.description}</p>
              </div>
            )
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 fluid-gap-12 fluid-mb-16">
          {/* About Text */}
          <div>
            <h3 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-6">¿Quiénes Somos?</h3>
            <p className="text-gray-600 fluid-mb-8 leading-relaxed">
              <strong className="text-gray-900">Grupo EduIT</strong> es un corporativo de empresas 100% mexicanas, 
              con <strong className="text-primary-600">20 años de experiencia</strong> siendo el Centro líder de 
              Capacitación en informática y proveedor de soluciones de tecnología. A través de su alianza
              con Evaluaasi, ofrece certificaciones CONOCER, insignias digitales, constancias y certificados
              a partners y clientes directos en todo México.
            </p>
            
            <h4 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-6">Las empresas que integran Grupo EduIT:</h4>
            <div className="flex flex-col fluid-gap-4">
              {companies.map((company) => (
                <div 
                  key={company.name}
                  className="flex items-start fluid-gap-4 fluid-p-5 bg-white rounded-fluid-xl border border-gray-100 shadow-sm"
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-fluid-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="fluid-icon-sm text-primary-600" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900">{company.name}</h5>
                    <p className="fluid-text-sm text-gray-500">{company.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CONOCER + Microsoft Card */}
          <div>
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-fluid-2xl fluid-p-10 text-white fluid-mb-8">
              <div className="flex items-center fluid-gap-3 fluid-mb-4">
                <Award className="fluid-icon-xl" />
                <div>
                  <h3 className="fluid-text-xl font-bold">Centro Evaluador CONOCER</h3>
                  <p className="text-primary-200 fluid-text-sm">Autorizado por el Consejo Nacional de Normalización y Certificación</p>
                </div>
              </div>
              <p className="text-primary-100 fluid-mb-6">
                Como Centro Evaluador autorizado, EduIT puede certificar competencias laborales
                con validez oficial ante la SEP. A través de Evaluaasi, este proceso se digitaliza completamente:
                estudio, evaluación, trámite y emisión de certificados.
              </p>
              <a 
                href="https://conocer.gob.mx/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white text-primary-600 rounded-fluid-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                Conoce el CONOCER
                <ExternalLink className="fluid-icon-sm" />
              </a>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-fluid-2xl fluid-p-10 text-white">
              <div className="flex items-center fluid-gap-3 fluid-mb-4">
                <Shield className="fluid-icon-xl" />
                <div>
                  <h3 className="fluid-text-xl font-bold">Microsoft Partner Gold</h3>
                  <p className="text-blue-200 fluid-text-sm">7 competencias Gold certificadas</p>
                </div>
              </div>
              <p className="text-blue-100">
                Somos Partner Gold de Microsoft, lo que garantiza que nuestra infraestructura
                y procesos cumplen con los más altos estándares de la industria.
              </p>
            </div>
          </div>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 fluid-gap-10">
          <div className="bg-white rounded-fluid-2xl fluid-p-10 border border-gray-100 shadow-sm">
            <div className="flex items-center fluid-gap-4 fluid-mb-6">
              <div className="w-12 h-12 bg-primary-100 rounded-fluid-xl flex items-center justify-center">
                <Target className="fluid-icon-lg text-primary-600" />
              </div>
              <h3 className="fluid-text-xl font-bold text-gray-900">Misión</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Democratizar el acceso a certificaciones y credenciales digitales de calidad,
              conectando organizaciones, partners y personas con herramientas que
              validen sus competencias y potencien su desarrollo profesional.
            </p>
          </div>

          <div className="bg-white rounded-fluid-2xl fluid-p-10 border border-gray-100 shadow-sm">
            <div className="flex items-center fluid-gap-4 fluid-mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-fluid-xl flex items-center justify-center">
                <Eye className="fluid-icon-lg text-purple-600" />
              </div>
              <h3 className="fluid-text-xl font-bold text-gray-900">Visión</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Ser la plataforma líder en Latinoamérica para certificación de competencias
              y emisión de credenciales digitales, impulsando la empleabilidad a través
              de estándares internacionales.
            </p>
          </div>
        </div>

        {/* Value Props */}
        <div className="fluid-mt-16 bg-gradient-to-r from-primary-600 to-primary-700 rounded-fluid-2xl fluid-p-10 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-8 text-center">
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-2">20+</div>
              <div className="text-primary-200">Años de experiencia</div>
            </div>
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-2">100%</div>
              <div className="text-primary-200">Empresa mexicana</div>
            </div>
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-2">7</div>
              <div className="text-primary-200">Competencias Gold</div>
            </div>
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-2">4</div>
              <div className="text-primary-200">Productos digitales</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
