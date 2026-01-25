import { Users, Building2, GraduationCap, Award } from 'lucide-react'

const stats = [
  {
    value: '10,000+',
    label: 'Estudiantes Evaluados',
    icon: Users,
    color: 'primary'
  },
  {
    value: '500+',
    label: 'Instituciones',
    icon: Building2,
    color: 'green'
  },
  {
    value: '5,000+',
    label: 'Certificados CONOCER',
    icon: Award,
    color: 'orange'
  },
  {
    value: '50,000+',
    label: 'Exámenes Completados',
    icon: GraduationCap,
    color: 'purple'
  },
]

export default function StatsSection() {
  return (
    <section className="fluid-py-16 bg-white">
      <div className="max-w-7xl mx-auto fluid-px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 fluid-gap-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            const colorClasses = {
              primary: 'bg-primary-100 text-primary-600',
              green: 'bg-green-100 text-green-600',
              orange: 'bg-orange-100 text-orange-600',
              purple: 'bg-purple-100 text-purple-600',
            }
            
            return (
              <div 
                key={stat.label}
                className="text-center fluid-p-8 rounded-fluid-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100"
              >
                <div className={`w-16 h-16 ${colorClasses[stat.color as keyof typeof colorClasses]} rounded-fluid-2xl flex items-center justify-center mx-auto fluid-mb-4`}>
                  <Icon className="fluid-icon-xl" />
                </div>
                <div className="text-4xl font-bold text-gray-900 fluid-mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
