/**
 * Dashboard avanzado para el responsable del plantel
 * Muestra gráficos y estadísticas detalladas sobre candidatos, grupos y evaluaciones
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getMiPlantelDashboardAdvanced } from '../../services/partnersService'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import {
  Users, GraduationCap, TrendingUp, Award, BookOpen, BarChart3,
  CheckCircle2, ArrowRight, Building2, FileText
} from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

interface DashboardData {
  campus: { id: number; name: string; code: string }
  stats: {
    total_candidates: number; total_groups: number; total_evaluations: number
    passed_evaluations: number; failed_evaluations: number; approval_rate: number
    average_score: number; certification_rate: number
  }
  charts: {
    approval_by_group: Array<{ group_name: string; approved: number; failed: number; rate: number; total_members: number }>
    scores_by_group: Array<{ group_name: string; average: number; min: number; max: number }>
    score_distribution: Array<{ range: string; count: number }>
    evaluations_over_time: Array<{ month: string; approved: number; failed: number }>
    material_progress_by_group: Array<{ group_name: string; completed: number; in_progress: number; total_members: number }>
    certification_by_type: { constancia_eduit: number; certificado_eduit: number; certificado_conocer: number; insignia_digital: number }
  }
}

const ResponsableDashboard = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMiPlantelDashboardAdvanced()
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

  const { stats, charts, campus } = data

  const certTypeData = [
    { name: 'Constancia Eduit', value: charts.certification_by_type.constancia_eduit },
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
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 rounded-fluid-xl fluid-p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
            <div className="flex-1">
              <div className="flex items-center fluid-gap-2 fluid-mb-2">
                <Building2 className="fluid-icon-lg text-blue-200" />
                <span className="fluid-text-sm text-blue-200 font-medium">{campus.code}</span>
              </div>
              <h1 className="fluid-text-3xl font-bold fluid-mb-1">{campus.name}</h1>
              <p className="text-blue-100 fluid-text-base">
                Panel de gestión — Hola, <span className="font-medium text-white">{user?.name}</span>
              </p>
            </div>
            <div className="flex fluid-gap-3">
              <button
                onClick={() => navigate('/mi-plantel')}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-white/10 hover:bg-white/20 rounded-fluid-lg font-medium fluid-text-sm transition-all border border-white/20"
              >
                <BarChart3 className="fluid-icon" />
                Gestionar Plantel
              </button>
              <button
                onClick={() => navigate('/mi-plantel/certificados')}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 bg-white/10 hover:bg-white/20 rounded-fluid-lg font-medium fluid-text-sm transition-all border border-white/20"
              >
                <Award className="fluid-icon" />
                Certificados
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 fluid-gap-4">
        {[
          { label: 'Candidatos', value: stats.total_candidates, icon: Users, color: 'blue' },
          { label: 'Grupos', value: stats.total_groups, icon: GraduationCap, color: 'indigo' },
          { label: 'Evaluaciones', value: stats.total_evaluations, icon: FileText, color: 'amber' },
          { label: 'Aprobadas', value: stats.passed_evaluations, icon: CheckCircle2, color: 'green' },
          { label: 'Tasa Aprob.', value: `${stats.approval_rate}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Promedio', value: `${stats.average_score}%`, icon: Award, color: 'purple' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-4">
            <div className={`w-9 h-9 rounded-lg bg-${stat.color}-100 flex items-center justify-center fluid-mb-2`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <p className="fluid-text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="fluid-text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Approval by Group + Score Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-5">
        {/* Approval by Group */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <CheckCircle2 className="fluid-icon text-green-600" />
            Aprobación por Grupo
          </h3>
          {charts.approval_by_group.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.approval_by_group} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="group_name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
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

        {/* Score Distribution */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <BarChart3 className="fluid-icon text-blue-600" />
            Distribución de Calificaciones
          </h3>
          {charts.score_distribution.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
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
        {/* Evaluations Over Time */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 lg:col-span-2">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <TrendingUp className="fluid-icon text-indigo-600" />
            Tendencia de Evaluaciones (últimos 6 meses)
          </h3>
          {timelineData.some(d => d.approved > 0 || d.failed > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
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

        {/* Certification Types */}
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

      {/* Charts Row 3: Scores by Group + Material Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-5">
        {/* Average Scores by Group */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <GraduationCap className="fluid-icon text-purple-600" />
            Promedio por Grupo
          </h3>
          {charts.scores_by_group.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.scores_by_group} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="group_name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
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

        {/* Material Progress by Group */}
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center fluid-gap-2">
            <BookOpen className="fluid-icon text-blue-600" />
            Progreso de Materiales por Grupo
          </h3>
          {charts.material_progress_by_group.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.material_progress_by_group} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="group_name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name="Completados" stackId="a" fill="#10b981" />
                <Bar dataKey="in_progress" name="En progreso" stackId="a" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-12">Sin datos de materiales</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 fluid-gap-4">
        {[
          { label: 'Gestionar Plantel', route: '/mi-plantel', icon: Building2, color: 'blue', desc: 'Grupos, candidatos y configuración' },
          { label: 'Certificados', route: '/mi-plantel/certificados', icon: Award, color: 'amber', desc: 'Certificados por grupo' },
          { label: 'Reportes', route: '/mi-plantel/reportes', icon: FileText, color: 'green', desc: 'Evaluaciones y exportaciones' },
          { label: 'Materiales', route: '/study-contents', icon: BookOpen, color: 'purple', desc: 'Material de estudio' },
        ].map(action => (
          <div
            key={action.route}
            onClick={() => navigate(action.route)}
            className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5 cursor-pointer group hover:shadow-lg hover:border-gray-300 transition-all active:scale-[0.98]"
          >
            <div className="flex items-start justify-between fluid-mb-3">
              <div className={`w-10 h-10 rounded-lg bg-${action.color}-100 flex items-center justify-center`}>
                <action.icon className={`w-5 h-5 text-${action.color}-600`} />
              </div>
              <ArrowRight className="fluid-icon text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="font-semibold text-gray-800 fluid-text-base">{action.label}</h3>
            <p className="fluid-text-sm text-gray-500 fluid-mt-1">{action.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ResponsableDashboard
