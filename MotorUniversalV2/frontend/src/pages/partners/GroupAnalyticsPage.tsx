/**
 * GroupAnalyticsPage — Dashboard analítico avanzado del grupo.
 * Muestra gráficas interactivas (Recharts) y filtros para visualizar:
 * miembros, exámenes, resultados, certificados, materiales, ECAs, tendencias.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle, BarChart3, Users, BookOpen,
  Award, Shield, FileText, TrendingUp, Clock, Target,
  Filter, RefreshCw, Trophy, GraduationCap,
  CheckCircle2, XCircle, UserX, Mail, CreditCard,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupAnalytics,
  GroupAnalytics,
  CandidateGroup,
} from '../../services/partnersService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVal = any;
const PIE_COLORS = { certified: '#10b981', in_progress: '#3b82f6', failed: '#ef4444', pending: '#9ca3af' };

export default function GroupAnalyticsPage() {
  const { groupId } = useParams();

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [analytics, setAnalytics] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [examFilter, setExamFilter] = useState<number | undefined>();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [groupData, analyticsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupAnalytics(Number(groupId), {
          exam_id: examFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
      ]);
      setGroup(groupData);
      setAnalytics(analyticsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar analítica');
    } finally {
      setLoading(false);
    }
  }, [groupId, examFilter, dateFrom, dateTo]);

  const applyFilters = () => {
    loadData();
  };

  const clearFilters = () => {
    setExamFilter(undefined);
    setDateFrom('');
    setDateTo('');
    // Will trigger loadData via useEffect-like behavior; let's just call it
    setTimeout(() => loadData(), 0);
  };

  // Derived data
  const membersPieData = useMemo(() => {
    if (!analytics) return [];
    const m = analytics.members;
    return [
      { name: 'Certificados', value: m.certified, color: PIE_COLORS.certified },
      { name: 'En Progreso', value: m.in_progress, color: PIE_COLORS.in_progress },
      { name: 'Reprobados', value: m.failed, color: PIE_COLORS.failed },
      { name: 'Pendientes', value: m.pending, color: PIE_COLORS.pending },
    ].filter(d => d.value > 0);
  }, [analytics]);

  const certPieData = useMemo(() => {
    if (!analytics) return [];
    const c = analytics.certificates;
    return [
      { name: 'Reportes', value: c.tier_basic.ready, color: '#3b82f6' },
      { name: 'Cert. Eduit', value: c.tier_standard.ready, color: '#8b5cf6' },
      { name: 'CONOCER', value: c.tier_advanced, color: '#10b981' },
      { name: 'Insignias', value: c.digital_badge, color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [analytics]);

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando analítica del grupo..." />
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700">{error}</p>
          <Link to={`/partners/groups/${groupId}`} className="ml-auto text-red-700 underline">Volver</Link>
        </div>
      </div>
    );
  }

  const data = analytics!;

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: group?.campus?.partner?.name || 'Partner', path: `/partners/${group?.campus?.partner_id}` },
          { label: group?.campus?.name || 'Plantel', path: `/partners/campuses/${group?.campus_id}` },
          { label: group?.name || 'Grupo', path: `/partners/groups/${groupId}` },
          { label: 'Analítica' },
        ]}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/groups/${groupId}`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <p className="fluid-text-sm text-white/80 fluid-mb-1">{group?.name}</p>
              <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                <BarChart3 className="fluid-icon-lg" />
                Dashboard Analítico
              </h1>
              <p className="fluid-text-sm text-white/70 mt-1">Vista completa del rendimiento del grupo</p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl font-medium fluid-text-sm transition-colors ${
                showFilters ? 'bg-white text-indigo-700' : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <Filter className="fluid-icon-sm" />
              Filtros
            </button>
            <button
              onClick={() => loadData()}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl text-white font-medium fluid-text-sm transition-colors"
            >
              <RefreshCw className="fluid-icon-sm" />
              Actualizar
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-4 fluid-mt-6">
          {[
            { label: 'Candidatos', value: data.members.total, icon: Users },
            { label: 'Certificados', value: data.members.certified, icon: GraduationCap },
            { label: 'Tasa Aprob.', value: `${data.results.pass_rate}%`, icon: Target },
            { label: 'Prom. Calif.', value: data.results.avg_score, icon: TrendingUp },
            { label: 'Prom. Duración', value: `${data.results.avg_duration_minutes}m`, icon: Clock },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
              <kpi.icon className="w-5 h-5 mx-auto mb-1 text-white/70" />
              <p className="fluid-text-2xl font-bold">{kpi.value}</p>
              <p className="fluid-text-xs text-white/70">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5 animate-fade-in-up">
          <div className="flex flex-wrap items-end fluid-gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block fluid-text-xs font-medium text-gray-600 mb-1">Examen</label>
              <select
                value={examFilter || ''}
                onChange={e => setExamFilter(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              >
                <option value="">Todos los exámenes</option>
                {data.exams.details.map(ex => (
                  <option key={ex.exam_id} value={ex.exam_id}>{ex.exam_name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="block fluid-text-xs font-medium text-gray-600 mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block fluid-text-xs font-medium text-gray-600 mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm"
              />
            </div>
            <button
              onClick={applyFilters}
              className="fluid-px-4 fluid-py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-lg font-medium fluid-text-sm"
            >
              Aplicar
            </button>
            <button
              onClick={clearFilters}
              className="fluid-px-4 fluid-py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-fluid-lg font-medium fluid-text-sm"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Row 1: Members + Certification Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Members overview */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <Users className="fluid-icon text-indigo-600" />
            Estado de Candidatos
          </h3>
          <div className="flex items-center fluid-gap-6">
            <div className="w-[180px] h-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membersPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {membersPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: AnyVal) => [value, 'Candidatos']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {[
                { label: 'Certificados', value: data.members.certified, color: 'bg-green-500', icon: CheckCircle2 },
                { label: 'En Progreso', value: data.members.in_progress, color: 'bg-blue-500', icon: Clock },
                { label: 'Reprobados', value: data.members.failed, color: 'bg-red-500', icon: XCircle },
                { label: 'Pendientes', value: data.members.pending, color: 'bg-gray-400', icon: UserX },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center fluid-gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="fluid-text-sm text-gray-600">{item.label}</span>
                  </div>
                  <span className="font-bold text-gray-900">{item.value}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                <div className="flex items-center justify-between fluid-text-xs text-gray-500">
                  <span className="flex items-center fluid-gap-1"><Mail className="w-3 h-3" />Con email</span>
                  <span>{data.members.with_email}/{data.members.total}</span>
                </div>
                <div className="flex items-center justify-between fluid-text-xs text-gray-500">
                  <span className="flex items-center fluid-gap-1"><CreditCard className="w-3 h-3" />Con CURP</span>
                  <span>{data.members.with_curp}/{data.members.total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Certificates overview */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <Award className="fluid-icon text-purple-600" />
            Documentos y Certificados
          </h3>
          <div className="flex items-center fluid-gap-6">
            <div className="w-[180px] h-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={certPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {certPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: AnyVal) => [value, 'Documentos']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {[
                { label: 'Reportes de Evaluación', ready: data.certificates.tier_basic.ready, pending: data.certificates.tier_basic.pending, color: 'text-blue-600', icon: FileText },
                { label: 'Certificados Eduit', ready: data.certificates.tier_standard.ready, pending: data.certificates.tier_standard.pending, color: 'text-purple-600', icon: Award },
                { label: 'Certificados CONOCER', ready: data.certificates.tier_advanced, pending: 0, color: 'text-emerald-600', icon: Shield },
                { label: 'Insignias Digitales', ready: data.certificates.digital_badge, pending: 0, color: 'text-amber-600', icon: Award },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center fluid-gap-2">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="fluid-text-sm text-gray-600">{item.label}</span>
                  </div>
                  <div className="flex items-center fluid-gap-2">
                    <span className="font-bold text-gray-900">{item.ready}</span>
                    {item.pending > 0 && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">+{item.pending} pend.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Score Distribution + Pass Rate by Exam */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Score distribution */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <BarChart3 className="fluid-icon text-blue-600" />
            Distribución de Calificaciones
          </h3>
          {data.results.score_distribution.some(d => d.count > 0) ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.results.score_distribution} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: AnyVal) => [value, 'Candidatos']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Candidatos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No hay calificaciones registradas" />
          )}
        </div>

        {/* Pass rate by exam */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <Target className="fluid-icon text-green-600" />
            Tasa de Aprobación por Examen
          </h3>
          {data.results.by_exam.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.results.by_exam}
                  layout="vertical"
                  barSize={20}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis
                    dataKey="exam_name"
                    type="category"
                    width={140}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value: AnyVal, name: AnyVal) => [`${value}%`, name]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="pass_rate" fill="#10b981" radius={[0, 4, 4, 0]} name="Aprobación" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No hay exámenes con resultados" />
          )}
        </div>
      </div>

      {/* Row 3: Results by exam (stacked) + Results over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Stacked bar by exam */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <BookOpen className="fluid-icon text-indigo-600" />
            Resultados por Examen
          </h3>
          {data.results.by_exam.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.results.by_exam} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="exam_name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="approved" stackId="a" fill="#10b981" name="Aprobados" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Reprobados" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="in_progress" stackId="a" fill="#6366f1" name="En curso" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No hay resultados por examen" />
          )}
        </div>

        {/* Time trend */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <TrendingUp className="fluid-icon text-cyan-600" />
            Tendencia de Resultados
          </h3>
          {data.results.by_date.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.results.by_date}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: AnyVal) => {
                      const d = new Date(v + 'T00:00:00');
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(label: AnyVal) => {
                      const d = new Date(label + 'T00:00:00');
                      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
                    }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="approved" stackId="1" stroke="#10b981" fill="#10b98140" name="Aprobados" />
                  <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef444440" name="Reprobados" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No hay datos de tendencia" />
          )}
        </div>
      </div>

      {/* Row 4: Top performers + ECMs + Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6 fluid-mb-6">
        {/* Top performers */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <Trophy className="fluid-icon text-amber-500" />
            Top 10 Candidatos
          </h3>
          {data.top_performers.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.top_performers.map((tp, idx) => (
                <div
                  key={tp.user_id}
                  className="flex items-center fluid-gap-3 fluid-p-2 rounded-fluid-lg hover:bg-gray-50"
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-gray-200 text-gray-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="fluid-text-sm font-medium text-gray-900 truncate">{tp.full_name}</p>
                    <p className="fluid-text-xs text-gray-500">{tp.exams_completed} exámen(es)</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="fluid-text-sm font-bold text-indigo-700">{tp.avg_score}%</p>
                    <p className="fluid-text-xs text-gray-400">prom.</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No hay resultados aún" />
          )}
        </div>

        {/* ECMs */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <Shield className="fluid-icon text-emerald-600" />
            ECMs Asignados ({data.ecm.unique_ecms})
          </h3>
          {data.ecm.details.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {data.ecm.details.map(ecm => (
                <div
                  key={ecm.ecm_id}
                  className="bg-emerald-50 border border-emerald-100 rounded-fluid-lg fluid-p-3"
                >
                  <p className="font-medium text-emerald-900 fluid-text-sm truncate">{ecm.ecm_name || ecm.ecm_code}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="fluid-text-xs text-emerald-600 font-mono">{ecm.ecm_code}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      {ecm.assignments} asignaciones
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No hay ECMs asignados" />
          )}
        </div>

        {/* Materials */}
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6">
          <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
            <BookOpen className="fluid-icon text-blue-600" />
            Materiales de Estudio ({data.materials.assigned})
          </h3>
          {data.materials.details.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {data.materials.details.map(mat => (
                <div
                  key={mat.id}
                  className="bg-blue-50 border border-blue-100 rounded-fluid-lg fluid-p-3"
                >
                  <p className="font-medium text-blue-900 fluid-text-sm truncate">{mat.material_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="fluid-text-xs text-blue-600">
                      {mat.assigned_at ? new Date(mat.assigned_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {mat.assigned_members} miembros
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No hay materiales asignados" />
          )}
        </div>
      </div>

      {/* Row 5: Exam details table */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-6 fluid-mb-6">
        <h3 className="fluid-text-base font-bold text-gray-900 flex items-center fluid-gap-2 fluid-mb-4">
          <BookOpen className="fluid-icon text-indigo-600" />
          Detalle de Certificaciones Asignadas
        </h3>
        {data.exams.details.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full fluid-text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium">Examen</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Puntaje Mín.</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Intentos</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Tiempo Lím.</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Aprob.</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Reprob.</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">En curso</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Prom.</th>
                  <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium">Tasa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.exams.details.map(exam => {
                  const resultData = data.results.by_exam.find(r => r.exam_id === exam.exam_id);
                  return (
                    <tr key={exam.exam_id} className="hover:bg-gray-50">
                      <td className="fluid-px-4 fluid-py-3 font-medium text-gray-900">{exam.exam_name}</td>
                      <td className="fluid-px-4 fluid-py-3 text-center">{exam.passing_score}%</td>
                      <td className="fluid-px-4 fluid-py-3 text-center">{exam.max_attempts}</td>
                      <td className="fluid-px-4 fluid-py-3 text-center">{exam.time_limit_minutes ? `${exam.time_limit_minutes}m` : '∞'}</td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {resultData?.approved || 0}
                        </span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {resultData?.failed || 0}
                        </span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {resultData?.in_progress || 0}
                        </span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center font-bold text-indigo-700">
                        {resultData?.avg_score || 0}%
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <span className={`font-bold ${
                          (resultData?.pass_rate || 0) >= 70 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {resultData?.pass_rate || 0}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No hay certificaciones asignadas" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center fluid-py-8 text-gray-400">
      <p className="fluid-text-sm">{message}</p>
    </div>
  );
}
