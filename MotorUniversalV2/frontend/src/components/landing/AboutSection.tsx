import { Building2, Target, Eye, Award, ExternalLink } from 'lucide-react'

const companies = [
  { name: 'EduIT', description: 'Centro de Capacitación en Informática' },
  { name: 'CPDS', description: 'Soluciones Tecnológicas Empresariales' },
  { name: 'Colegio de Postgrado en Desarrollo de Software', description: 'Educación Superior en TI' },
]

const microsoftCompetencies = [
  { name: 'Gold Datacenter', icon: '🏢' },
  { name: 'Gold Messaging', icon: '✉️' },
  { name: 'Gold Data Analytics', icon: '📊' },
  { name: 'Gold Communications', icon: '📡' },
  { name: 'Gold Windows and Devices', icon: '💻' },
  { name: 'Gold Application Development', icon: '⚙️' },
  { name: 'Gold Collaboration and Content', icon: '🤝' },
]

export default function AboutSection() {
  return (
    <section id="about" className="fluid-py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto fluid-px-6">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <div className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-primary-100 rounded-full text-primary-700 fluid-text-sm font-medium fluid-mb-6">
            <Building2 className="fluid-icon-sm" />
            20 años de experiencia
          </div>
          <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
            Conoce a{' '}
            <span className="text-primary-600">Grupo EduIT</span>
          </h2>
          <p className="fluid-text-xl text-gray-600 max-w-3xl mx-auto">
            Corporativo de empresas 100% mexicanas, líder en Capacitación en informática 
            y proveedor de soluciones de tecnología.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 fluid-gap-12 fluid-mb-16">
          {/* About Text */}
          <div>
            <h3 className="fluid-text-2xl font-bold text-gray-900 fluid-mb-4">¿Quiénes Somos?</h3>
            <p className="text-gray-600 fluid-mb-6 leading-relaxed">
              <strong className="text-gray-900">Grupo EduIT</strong> es un corporativo de empresas 100% mexicanas, 
              con <strong className="text-primary-600">20 años de experiencia</strong> siendo el Centro líder de 
              Capacitación en informática y proveedor de soluciones de tecnología.
            </p>
            
            <h4 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4">Las empresas que integran Grupo EduIT son:</h4>
            <div className="flex flex-col fluid-gap-3 fluid-mb-8">
              {companies.map((company) => (
                <div 
                  key={company.name}
                  className="flex items-start fluid-gap-3 fluid-p-4 bg-white rounded-fluid-xl border border-gray-100 shadow-sm"
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

          {/* Microsoft Partner */}
          <div>
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-fluid-2xl fluid-p-8 text-white fluid-mb-6">
              <div className="flex items-center fluid-gap-3 fluid-mb-4">
                <Award className="fluid-icon-xl" />
                <div>
                  <h3 className="fluid-text-xl font-bold">Microsoft Partner Gold</h3>
                  <p className="text-blue-200 fluid-text-sm">Partner certificado con múltiples competencias</p>
                </div>
              </div>
              <p className="text-blue-100 fluid-mb-6">
                Somos Partner Gold de Microsoft contando con las siguientes competencias que nos han 
                permitido ubicarnos como uno de los principales proveedores en el país.
              </p>
              <a 
                href="https://partner.microsoft.com/es-mx/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white text-blue-600 rounded-fluid-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Ver perfil en Microsoft
                <ExternalLink className="fluid-icon-sm" />
              </a>
            </div>

            {/* Competencies Grid */}
            <h4 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4">Nuestras Competencias:</h4>
            <div className="grid grid-cols-2 fluid-gap-3">
              {microsoftCompetencies.map((comp) => (
                <div 
                  key={comp.name}
                  className="flex items-center fluid-gap-2 fluid-p-3 bg-white rounded-fluid-lg border border-gray-100 shadow-sm"
                >
                  <span className="fluid-text-lg">{comp.icon}</span>
                  <span className="fluid-text-sm font-medium text-gray-700">{comp.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 fluid-gap-8">
          {/* Mission */}
          <div className="bg-white rounded-fluid-2xl fluid-p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center fluid-gap-3 fluid-mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-fluid-xl flex items-center justify-center">
                <Target className="fluid-icon-lg text-primary-600" />
              </div>
              <h3 className="fluid-text-xl font-bold text-gray-900">Misión</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Mejorar las oportunidades profesionales y laborales de nuestros clientes a través del 
              conocimiento y habilidades en el uso de las tecnologías de la información.
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white rounded-fluid-2xl fluid-p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center fluid-gap-3 fluid-mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-fluid-xl flex items-center justify-center">
                <Eye className="fluid-icon-lg text-purple-600" />
              </div>
              <h3 className="fluid-text-xl font-bold text-gray-900">Visión</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Proveer conocimiento tecnológico alineado a estándares internacionales, 
              en cualquier momento y lugar.
            </p>
          </div>
        </div>

        {/* Value Props */}
        <div className="fluid-mt-12 bg-gradient-to-r from-primary-600 to-primary-700 rounded-fluid-2xl fluid-p-8 text-white">
          <div className="grid md:grid-cols-4 fluid-gap-6 text-center">
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-1">20+</div>
              <div className="text-primary-200">Años de experiencia</div>
            </div>
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-1">100%</div>
              <div className="text-primary-200">Empresa mexicana</div>
            </div>
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-1">7</div>
              <div className="text-primary-200">Competencias Gold</div>
            </div>
            <div>
              <div className="fluid-text-3xl font-bold fluid-mb-1">3</div>
              <div className="text-primary-200">Empresas del grupo</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
