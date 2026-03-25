/**
 * Dashboard del Portal de Gerencia — Página de Inicio
 * Saludo personalizado, KPIs, accesos rápidos, solicitudes,
 * actividad del sistema y módulo de actividad de editores.
 */
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCheck,
  DollarSign,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  Shield,
  Award,
  PenTool,
  BookOpen,
  HelpCircle,
  Sun,
  Moon,
  Sunset,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  getBalanceStats,
  getRequestsForApproval,
  BalanceRequest,
  BalanceStats,
  formatCurrency,
} from '../../services/balanceService';
import {
  getActivitySummary,
  getEditorActivity,
  ActivitySummary,
  EditorActivity,
  formatRelativeTime,
} from '../../services/activityService';

function getGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return { text: 'Buenos días', icon: Sun };
  if (hour >= 12 && hour < 19) return { text: 'Buenas tardes', icon: Sunset };
  return { text: 'Buenas noches', icon: Moon };
}

function formatFirstName(name: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default function GerenteDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<BalanceRequest[]>([]);
  const [editorData, setEditorData] = useState<EditorActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const firstName = useMemo(() => formatFirstName(user?.name || ''), [user?.name]);
  const GreetingIcon = greeting.icon;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, activityData, approvalsData, editorActivity] = await Promise.all([
        getBalanceStats(),
        getActivitySummary({ days: 7 }),
        getRequestsForApproval({ per_page: 5 }),
        getEditorActivity({ days: 30, limit: 10 }).catch(() => null),
      ]);
      setStats(statsData);
      setActivitySummary(activityData);
      setPendingApprovals(approvalsData.requests);
      setEditorData(editorActivity);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const failedLogins = activitySummary?.failed_logins || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 text-center">
          <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-semibold text-red-800 fluid-mb-2">Error</h2>
          <p className="text-red-600 fluid-text-base">{error}</p>
          <button onClick={loadData} className="fluid-mt-4 fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-xl hover:bg-red-700 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER CON SALUDO ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex items-center justify-between fluid-mb-6">
            <div className="flex items-center fluid-gap-4">
              <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
                <GreetingIcon className="fluid-icon-xl text-white" />
              </div>
              <div>
                <h1 className="fluid-text-3xl font-bold text-white">
                  {greeting.text}{firstName ? `, ${firstName}` : ''}
                </h1>
                <p className="fluid-text-base text-white/80">Panel de gerencia — supervisión y aprobación de operaciones</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="fluid-p-2.5 bg-white/15 hover:bg-white/25 rounded-fluid-xl transition-all duration-300 hover:scale-105 backdrop-blur-sm"
            >
              <RefreshCw className={`fluid-icon-lg text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Mini Stats en Header */}
          <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <p className="fluid-text-xs text-white/70 font-medium">Saldo Total</p>
              <p className="fluid-text-xl font-bold text-white">{formatCurrency(stats?.totals.current_balance || 0)}</p>
              <p className="fluid-text-xs text-white/60">{stats?.coordinators_with_balance || 0} coordinadores</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <p className="fluid-text-xs text-white/70 font-medium">Por Aprobar</p>
              <p className="fluid-text-xl font-bold text-white">{stats?.requests.awaiting_approval || 0}</p>
              <p className="fluid-text-xs text-white/60">Solicitudes</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <p className="fluid-text-xs text-white/70 font-medium">Actividad Hoy</p>
              <p className="fluid-text-xl font-bold text-white">{activitySummary?.today_actions || 0}</p>
              <p className="fluid-text-xs text-white/60">Acciones</p>
            </div>
            <div className={`backdrop-blur-sm rounded-fluid-xl fluid-p-3 border ${failedLogins > 0 ? 'bg-red-500/30 border-red-300/40' : 'bg-white/10 border-white/20'}`}>
              <p className="fluid-text-xs text-white/70 font-medium">Alertas Seguridad</p>
              <p className="fluid-text-xl font-bold text-white">{failedLogins}</p>
              <p className="fluid-text-xs text-white/60">{failedLogins > 0 ? 'Logins fallidos' : 'Sin alertas'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 4 ACCIONES RÁPIDAS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
        <Link
          to="/gerente/aprobaciones"
          className="group flex items-center fluid-gap-4 fluid-p-5 bg-white rounded-fluid-2xl border border-gray-200/80 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 hover:border-purple-300"
        >
          <div className="fluid-p-3 bg-gradient-to-br from-purple-500 to-violet-500 rounded-fluid-xl shadow-md group-hover:shadow-lg transition-shadow">
            <FileCheck className="fluid-icon-lg text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 fluid-text-lg group-hover:text-purple-700 transition-colors">Aprobaciones</p>
            <p className="fluid-text-sm text-gray-500">Revisar y aprobar solicitudes de saldo</p>
          </div>
          <div className="flex items-center fluid-gap-2 flex-shrink-0">
            {(stats?.requests.awaiting_approval || 0) > 0 && (
              <span className="fluid-px-2.5 fluid-py-1 bg-purple-100 text-purple-700 rounded-full fluid-text-xs font-bold">
                {stats?.requests.awaiting_approval}
              </span>
            )}
            <ArrowUpRight className="fluid-icon-sm text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
        </Link>

        <Link
          to="/gerente/finanzas"
          className="group flex items-center fluid-gap-4 fluid-p-5 bg-white rounded-fluid-2xl border border-gray-200/80 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 hover:border-emerald-300"
        >
          <div className="fluid-p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-fluid-xl shadow-md group-hover:shadow-lg transition-shadow">
            <DollarSign className="fluid-icon-lg text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 fluid-text-lg group-hover:text-emerald-700 transition-colors">Finanzas</p>
            <p className="fluid-text-sm text-gray-500">Reportes, coordinadores y delegaciones</p>
          </div>
          <ArrowUpRight className="fluid-icon-sm text-gray-400 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
        </Link>

        <Link
          to="/gerente/monitoreo"
          className="group flex items-center fluid-gap-4 fluid-p-5 bg-white rounded-fluid-2xl border border-gray-200/80 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 hover:border-blue-300"
        >
          <div className={`fluid-p-3 bg-gradient-to-br ${failedLogins > 0 ? 'from-red-500 to-rose-500' : 'from-blue-500 to-indigo-500'} rounded-fluid-xl shadow-md group-hover:shadow-lg transition-shadow`}>
            <Activity className="fluid-icon-lg text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 fluid-text-lg group-hover:text-blue-700 transition-colors">Monitoreo</p>
            <p className="fluid-text-sm text-gray-500">Actividad del personal y seguridad</p>
          </div>
          <div className="flex items-center fluid-gap-2 flex-shrink-0">
            {failedLogins > 0 && (
              <span className="fluid-px-2.5 fluid-py-1 bg-red-100 text-red-700 rounded-full fluid-text-xs font-bold animate-pulse">
                {failedLogins}
              </span>
            )}
            <ArrowUpRight className="fluid-icon-sm text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
        </Link>

        <Link
          to="/gerente/certificados"
          className="group flex items-center fluid-gap-4 fluid-p-5 bg-white rounded-fluid-2xl border border-gray-200/80 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-300 hover:border-amber-300"
        >
          <div className="fluid-p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-fluid-xl shadow-md group-hover:shadow-lg transition-shadow">
            <Award className="fluid-icon-lg text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 fluid-text-lg group-hover:text-amber-700 transition-colors">Certificados</p>
            <p className="fluid-text-sm text-gray-500">Analítica de emisión y reconciliación</p>
          </div>
          <ArrowUpRight className="fluid-icon-sm text-gray-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
        </Link>
      </div>

      {/* ===== CONTENIDO PRINCIPAL — 2 columnas ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Solicitudes Pendientes */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <FileCheck className="fluid-icon-sm text-amber-500" />
              Solicitudes Urgentes
            </h2>
            <Link to="/gerente/aprobaciones" className="fluid-text-xs text-purple-600 hover:text-purple-800 flex items-center fluid-gap-1 font-medium">
              Ver todas <ArrowRight className="fluid-icon-xs" />
            </Link>
          </div>
          <div className="fluid-p-5">
            {pendingApprovals.length === 0 ? (
              <div className="text-center fluid-py-6 text-gray-500">
                <CheckCircle2 className="fluid-icon-xl mx-auto fluid-mb-3 text-gray-300" />
                <p className="fluid-text-sm">No hay solicitudes pendientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((req) => (
                  <Link
                    key={req.id}
                    to={`/gerente/aprobaciones/${req.id}`}
                    className="block fluid-p-4 rounded-fluid-xl border border-gray-100 hover:border-purple-300 hover:bg-purple-50/50 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 fluid-text-sm truncate group-hover:text-purple-700">
                          {req.coordinator?.full_name || 'Coordinador'}
                        </p>
                        <p className="fluid-text-xs text-gray-500 fluid-mt-1 truncate">
                          {req.campus?.name || 'Sin plantel'} • {req.group?.name || 'General'}
                        </p>
                        <p className="fluid-text-xs text-gray-400 fluid-mt-1 flex items-center fluid-gap-1">
                          <Clock className="fluid-icon-xs" />
                          {new Date(req.requested_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-semibold text-green-600 fluid-text-sm">
                          {formatCurrency(req.financiero_recommended_amount || req.amount_requested)}
                        </p>
                        <span className={`inline-block fluid-mt-1 fluid-px-2 fluid-py-0.5 fluid-text-xs rounded-full font-medium ${
                          req.status === 'recommended_approve'
                            ? 'bg-green-100 text-green-700'
                            : req.status === 'recommended_reject'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {req.status === 'recommended_approve' ? '✓ Aprobar' : req.status === 'recommended_reject' ? '✗ Rechazar' : '⏳ Pendiente'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alertas de Seguridad + Actividad Resumen */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <Shield className="fluid-icon-sm text-blue-500" />
              Resumen de Actividad
            </h2>
            <Link to="/gerente/monitoreo" className="fluid-text-xs text-blue-600 hover:text-blue-800 flex items-center fluid-gap-1 font-medium">
              Ver todo <ArrowRight className="fluid-icon-xs" />
            </Link>
          </div>
          <div className="fluid-p-5 space-y-4">
            {failedLogins > 0 && (
              <Link
                to="/gerente/monitoreo"
                className="block fluid-p-4 bg-red-50 rounded-fluid-xl border border-red-200/60 hover:bg-red-100/60 transition-all group"
              >
                <div className="flex items-center fluid-gap-3">
                  <div className="fluid-p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-fluid-lg">
                    <Shield className="fluid-icon-sm text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 fluid-text-sm">{failedLogins} logins fallidos detectados</p>
                    <p className="fluid-text-xs text-red-600">Últimos 7 días — Revisar en Monitoreo</p>
                  </div>
                  <ArrowRight className="fluid-icon-xs text-red-400 group-hover:text-red-600 transition-colors" />
                </div>
              </Link>
            )}

            {activitySummary?.actions_by_type && Object.keys(activitySummary.actions_by_type).length > 0 ? (
              <div className="grid grid-cols-2 fluid-gap-3">
                {Object.entries(activitySummary.actions_by_type).slice(0, 6).map(([type, count]) => (
                  <div key={type} className="bg-gray-50/80 rounded-fluid-xl fluid-p-3 border border-gray-100">
                    <p className="fluid-text-xl font-bold text-gray-800">{count}</p>
                    <p className="fluid-text-xs text-gray-500 capitalize">{type.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center fluid-py-4 text-gray-500">
                <Activity className="fluid-icon-xl mx-auto fluid-mb-2 text-gray-300" />
                <p className="fluid-text-sm">Sin datos de actividad reciente</p>
              </div>
            )}

            {activitySummary?.top_users && activitySummary.top_users.length > 0 && (
              <div>
                <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-2">Usuarios más activos</p>
                <div className="space-y-2">
                  {activitySummary.top_users.slice(0, 3).map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between fluid-text-sm fluid-p-2 rounded-fluid-lg hover:bg-gray-50">
                      <span className="text-gray-600 truncate">{u.email}</span>
                      <span className="font-medium text-gray-800 fluid-text-xs bg-gray-100 fluid-px-2 fluid-py-0.5 rounded-full">{u.action_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== MÓDULO ACTIVIDAD EDITORES ===== */}
      {editorData && (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <PenTool className="fluid-icon-sm text-violet-500" />
              Actividad de Editores
            </h2>
            <span className="fluid-text-xs text-gray-500">Últimos 30 días</span>
          </div>

          {/* KPIs de editores */}
          <div className="fluid-p-5 border-b border-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 fluid-gap-3">
              <div className="text-center fluid-p-3 bg-violet-50 rounded-fluid-xl">
                <p className="fluid-text-xl font-bold text-violet-700">{editorData.summary.total_editors}</p>
                <p className="fluid-text-xs text-violet-600">Editores</p>
              </div>
              <div className="text-center fluid-p-3 bg-blue-50 rounded-fluid-xl">
                <p className="fluid-text-xl font-bold text-blue-700">{editorData.summary.total_exams}</p>
                <p className="fluid-text-xs text-blue-600">Exámenes</p>
              </div>
              <div className="text-center fluid-p-3 bg-green-50 rounded-fluid-xl">
                <p className="fluid-text-xl font-bold text-green-700">{editorData.summary.published_exams}</p>
                <p className="fluid-text-xs text-green-600">Publicados</p>
              </div>
              <div className="text-center fluid-p-3 bg-amber-50 rounded-fluid-xl">
                <p className="fluid-text-xl font-bold text-amber-700">{editorData.summary.total_materials}</p>
                <p className="fluid-text-xs text-amber-600">Materiales</p>
              </div>
              <div className="text-center fluid-p-3 bg-emerald-50 rounded-fluid-xl">
                <p className="fluid-text-xl font-bold text-emerald-700">{editorData.summary.published_materials}</p>
                <p className="fluid-text-xs text-emerald-600">Mat. Publicados</p>
              </div>
              <div className="text-center fluid-p-3 bg-indigo-50 rounded-fluid-xl">
                <p className="fluid-text-xl font-bold text-indigo-700">{editorData.summary.total_questions}</p>
                <p className="fluid-text-xs text-indigo-600">Preguntas</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
            {/* Timeline reciente */}
            <div className="fluid-p-5">
              <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-3">Actividad Reciente</p>
              {editorData.timeline.length === 0 ? (
                <div className="text-center fluid-py-6 text-gray-400">
                  <BookOpen className="fluid-icon-xl mx-auto fluid-mb-2 text-gray-300" />
                  <p className="fluid-text-sm">Sin actividad reciente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editorData.timeline.slice(0, 8).map((item, i) => (
                    <div key={`${item.type}-${item.id}-${i}`} className="flex items-start fluid-gap-3 fluid-p-2 rounded-fluid-lg hover:bg-gray-50 transition-colors">
                      <div className={`fluid-p-1.5 rounded-fluid-lg flex-shrink-0 ${
                        item.type === 'exam' ? 'bg-blue-100' : 'bg-amber-100'
                      }`}>
                        {item.type === 'exam'
                          ? <HelpCircle className="fluid-icon-xs text-blue-600" />
                          : <BookOpen className="fluid-icon-xs text-amber-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="fluid-text-sm text-gray-800 truncate">
                          <span className="font-medium">{item.editor_name}</span>
                          <span className="text-gray-500"> {item.action === 'created' ? 'creó' : 'actualizó'} </span>
                          <span className="font-medium">{item.name}</span>
                        </p>
                        <div className="flex items-center fluid-gap-2 fluid-mt-0.5">
                          <span className={`fluid-text-xs fluid-px-1.5 fluid-py-0.5 rounded font-medium ${
                            item.type === 'exam' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {item.type === 'exam' ? 'Examen' : 'Material'}
                          </span>
                          {item.is_published && (
                            <span className="fluid-text-xs text-green-600 font-medium">Publicado</span>
                          )}
                          {item.date && (
                            <span className="fluid-text-xs text-gray-400">{formatRelativeTime(item.date)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Editores + contribuciones */}
            <div className="fluid-p-5">
              <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-3">Productividad por Editor</p>
              {editorData.editors.length === 0 ? (
                <div className="text-center fluid-py-6 text-gray-400">
                  <PenTool className="fluid-icon-xl mx-auto fluid-mb-2 text-gray-300" />
                  <p className="fluid-text-sm">Sin editores activos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editorData.editors.map((ed) => {
                    const maxContrib = Math.max(...editorData.editors.map(e => e.total_contributions), 1);
                    const pct = (ed.total_contributions / maxContrib) * 100;
                    return (
                      <div key={ed.id} className="fluid-p-3 rounded-fluid-xl border border-gray-100 hover:border-violet-200 transition-colors">
                        <div className="flex items-center justify-between fluid-mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="fluid-text-sm font-medium text-gray-800 truncate">{ed.name}</p>
                            <p className="fluid-text-xs text-gray-400 truncate">{ed.email}</p>
                          </div>
                          <span className="fluid-text-sm font-bold text-violet-700 flex-shrink-0 ml-2">
                            {ed.total_contributions}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden fluid-mb-1.5">
                          <div
                            className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center fluid-gap-3 fluid-text-xs text-gray-500">
                          <span className="flex items-center fluid-gap-1">
                            <span className="w-2 h-2 bg-blue-400 rounded-full" />
                            {ed.exams_created} exám.
                          </span>
                          <span className="flex items-center fluid-gap-1">
                            <span className="w-2 h-2 bg-amber-400 rounded-full" />
                            {ed.materials_created} mat.
                          </span>
                          <span className="flex items-center fluid-gap-1">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                            {ed.questions_created} preg.
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
