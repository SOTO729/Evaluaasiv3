/**
 * Dashboard avanzado para el responsable del partner
 * Muestra gráficos y estadísticas de todos los planteles del partner, con filtro por estado
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getMiPartnerDashboard, PartnerDashboardData } from '../../services/partnersService'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import {
  Users, GraduationCap, TrendingUp, Award, Building2, BarChart3,
  CheckCircle2, ArrowRight, FileText, MapPin, Filter, Building
} from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

const ResponsablePartnerDashboard = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<PartnerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [selectedState])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMiPartnerDashboard(selectedState || undefined)
      setData(res)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando dashboard...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl">
        <p>{error || 'Error desconocido'}</p>
        <button onClick={loadDashboard} className="mt-2 text-sm text-red-700 underline">Reintentar</button>
      </div>
    )
  }

  const { stats, charts, partner, filter } = data

  const certTypeData = [
    { name: 'Reporte Eval.', value: charts.certification_by_type.reporte_evaluacion },
    { name: 'Certif. Eduit', value: charts.certification_by_type.certificado_eduit },
    { name: 'Certif. CONOCER', value: charts.certification_by_type.certificado_conocer },
    { name: 'Insignia Digital', value: charts.certification_by_type.insignia_digital },
  ].filter(d => d.value > 0)

  const monthNames: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
  }

  const timelineData = charts.evaluations_over_time.map(e => ({
    ...e,
    label: monthNames[e.month.split('-')[1]] || e.month
  }))

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Animated gradient keyframes */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Hero with animated gradient */}
      <div
        className="rounded-fluid-xl fluid-p-8 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(270deg, #7c3aed, #4f46e5, #2563eb, #7c3aed)',
          backgroundSize: '300% 300%',
          animation: 'gradientShift 8s ease infinite',
        }}
      >
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex-1">
              <div className="flex items-center fluid-gap-2 fluid-mb-2">
                <Building className="fluid-icon-lg text-purple-200" />
                <span className="fluid-text-sm text-purple-200 font-medium tracking-wide uppercase">Responsable de Partner</span>
              </div>
              <h1 className="fluid-text-3xl font-bold fluid-mb-1 tracking-tight">{partner.name}</h1>
              <p className="text-white/80 fluid-text-base">
                Hola, <span className="font-semibold text-white">{user?.name}</span> — Panel de gestión
              </p>
            </div>
            <div className="flex fluid-gap-3 flex-wrap">
              {/* Filtro por estado */}
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="appearance-none bg-white/15 hover:bg-white/25 border border-white/30 rounded-fluid-lg fluid-px-4 fluid-py-2.5 text-white font-medium fluid-text-sm transition-all cursor-pointer pr-10 backdrop-blur-sm"
                >
                  <option value="" className="text-gray-800">Todos los estados</option>
                  {filter.available_states.map(st => (
                    <option key={st} value={st} className="text-gray-800">{st}</option>
                  ))}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70 pointer-events-none" />
              </div>
              <button
                onClick={() => navigate('/mi-partner/certificados')}
                className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2.5 bg-white/15 hover:bg-white/25 rounded-fluid-lg font-semibold fluid-text-sm transition-all border border-white/30 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <Award className="fluid-icon" />
                Ver Certificados
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 fluid-gap-4">
        {[
          { label: 'Planteles', value: stats.total_campuses, icon: Building2, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
          { label: 'Candidatos', value: stats.total_candidates, icon: Users, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
          { label: 'Grupos', value: stats.total_groups, icon: GraduationCap, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
          { label: 'Evaluaciones', value: stats.total_evaluations, icon: FileText, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
          { label: 'Tasa Aprob.', value: `${stats.approval_rate}%`, icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
          { label: 'Promedio', value: `${stats.average_score}%`, icon: Award, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center fluid-mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <p className="fluid-text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="fluid-text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Approval by Campus + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-5">
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <CheckCircle2 className="fluid-icon text-green-600" />
            Aprobación por Plantel
          </h3>
          {charts.approval_by_campus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.approval_by_campus} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="campus_name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="approved" name="Aprobados" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Reprobados" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin datos de evaluaciones</p>
          )}
        </div>

        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <BarChart3 className="fluid-icon text-blue-600" />
            Distribución de Calificaciones
          </h3>
          {charts.score_distribution.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.score_distribution} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Candidatos" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {charts.score_distribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin datos</p>
          )}
        </div>
      </div>

      {/* Charts Row 2: Evaluations Over Time + Certification Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-5">
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 lg:col-span-2">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <TrendingUp className="fluid-icon text-indigo-600" />
            Tendencia de Evaluaciones (últimos 6 meses)
          </h3>
          {timelineData.some(d => d.approved > 0 || d.failed > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="approved" name="Aprobados" stroke="#10b981" fill="#10b98130" strokeWidth={2} />
                <Area type="monotone" dataKey="failed" name="Reprobados" stroke="#ef4444" fill="#ef444430" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin datos de tendencia</p>
          )}
        </div>

        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <Award className="fluid-icon text-amber-600" />
            Certificaciones por Tipo
          </h3>
          {certTypeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={certTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {certTypeData.map((_, index) => (
                      <Cell key={`pie-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col fluid-gap-1.5 fluid-mt-2">
                {certTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between fluid-text-sm">
                    <div className="flex items-center fluid-gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin certificaciones</p>
          )}
        </div>
      </div>

      {/* Charts Row 3: Scores by Campus + Candidates by State */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-5">
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <GraduationCap className="fluid-icon text-purple-600" />
            Promedio por Plantel
          </h3>
          {charts.scores_by_campus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.scores_by_campus} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="campus_name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="average" name="Promedio" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max" name="Máximo" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="min" name="Mínimo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin datos</p>
          )}
        </div>

        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <MapPin className="fluid-icon text-red-600" />
            Candidatos por Estado
          </h3>
          {charts.candidates_by_state.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts.candidates_by_state} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="candidates" name="Candidatos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="campuses" name="Planteles" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin datos por estado</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4">
        <div
          onClick={() => navigate('/mi-partner/certificados')}
          className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:shadow-lg hover:border-amber-200 transition-all active:scale-[0.98]"
        >
          <div className="flex items-start justify-between fluid-mb-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <ArrowRight className="fluid-icon text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-semibold text-gray-800 fluid-text-base">Certificados</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mt-1">Todos los certificados por plantel y estado</p>
        </div>
        <div
          onClick={() => navigate('/dashboard')}
          className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:shadow-lg hover:border-blue-200 transition-all active:scale-[0.98]"
        >
          <div className="flex items-start justify-between fluid-mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <ArrowRight className="fluid-icon text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-semibold text-gray-800 fluid-text-base">Dashboard General</h3>
          <p className="fluid-text-sm text-gray-500 fluid-mt-1">KPIs y gráficos generales de la plataforma</p>
        </div>
      </div>
    </div>
  )
}

export default ResponsablePartnerDashboard
