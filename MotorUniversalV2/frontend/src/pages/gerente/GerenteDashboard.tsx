/**
 * Dashboard del Portal de Gerencia
 * Diseño fluid responsive con gradientes y animaciones
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCheck,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  Shield,
  BarChart3,
  Users,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBalanceStats,
  getRequestsForApproval,
  BalanceRequest,
  BalanceStats,
  formatCurrency,
} from '../../services/balanceService';
import {
  getActivitySummary,
  ActivitySummary,
} from '../../services/activityService';

export default function GerenteDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<BalanceRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, activityData, approvalsData] = await Promise.all([
        getBalanceStats(),
        getActivitySummary({ days: 7 }),
        getRequestsForApproval({ per_page: 5 }),
      ]);
      setStats(statsData);
      setActivitySummary(activityData);
      setPendingApprovals(approvalsData.requests);
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
      {/* ===== HEADER GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex items-center justify-between fluid-mb-6">
            <div className="flex items-center fluid-gap-4">
              <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
                <LayoutDashboard className="fluid-icon-xl text-white" />
              </div>
              <div>
                <h1 className="fluid-text-3xl font-bold text-white">Portal de Gerencia</h1>
                <p className="fluid-text-base text-white/80">Supervisión y aprobación de operaciones</p>
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
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <p className="fluid-text-xs text-white/70 font-medium">Total Aprobado</p>
              <p className="fluid-text-xl font-bold text-white">{formatCurrency(stats?.totals.total_received || 0)}</p>
              <p className="fluid-text-xs text-white/60">Histórico</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ACCIONES RÁPIDAS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-5 fluid-gap-4 fluid-mb-6">
        {[
          { to: '/gerente/aprobaciones', icon: FileCheck, label: 'Aprobaciones', sub: 'Revisar y aprobar', color: 'purple', bg: 'from-purple-500 to-violet-500' },
          { to: '/gerente/actividad', icon: Activity, label: 'Logs', sub: 'Actividad', color: 'blue', bg: 'from-blue-500 to-indigo-500' },
          { to: '/gerente/reportes', icon: BarChart3, label: 'Reportes', sub: 'Estadísticas', color: 'emerald', bg: 'from-emerald-500 to-teal-500' },
          { to: '/gerente/seguridad', icon: Shield, label: 'Seguridad', sub: 'Alertas', color: 'red', bg: 'from-red-500 to-rose-500' },
          { to: '/gerente/delegaciones', icon: Users, label: 'Delegaciones', sub: 'Aprobadores', color: 'amber', bg: 'from-amber-500 to-orange-500' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center fluid-gap-3 fluid-p-4 bg-white rounded-fluid-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
          >
            <div className={`fluid-p-2.5 bg-gradient-to-br ${item.bg} rounded-fluid-xl shadow-sm`}>
              <item.icon className="fluid-icon-sm text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 fluid-text-sm truncate">{item.label}</p>
              <p className="fluid-text-xs text-gray-500 truncate">{item.sub}</p>
            </div>
            <ArrowUpRight className="fluid-icon-xs text-gray-400 group-hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      {/* ===== CONTENIDO PRINCIPAL ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
        {/* Solicitudes Pendientes */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <FileCheck className="fluid-icon-sm text-amber-500" />
              Pendientes de Aprobación
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
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {req.status === 'recommended_approve' ? '✓ Aprobar' : '✗ Rechazar'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resumen de Actividad */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <Activity className="fluid-icon-sm text-blue-500" />
              Actividad del Personal
            </h2>
            <Link to="/gerente/actividad" className="fluid-text-xs text-purple-600 hover:text-purple-800 flex items-center fluid-gap-1 font-medium">
              Ver todo <ArrowRight className="fluid-icon-xs" />
            </Link>
          </div>
          <div className="fluid-p-5">
            {activitySummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 fluid-gap-3">
                  {Object.entries(activitySummary.actions_by_type || {}).slice(0, 4).map(([type, count]) => (
                    <div key={type} className="bg-gray-50/80 rounded-fluid-xl fluid-p-3 border border-gray-100">
                      <p className="fluid-text-xl font-bold text-gray-800">{count}</p>
                      <p className="fluid-text-xs text-gray-500 capitalize">{type.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>

                {activitySummary.top_users && activitySummary.top_users.length > 0 && (
                  <div className="fluid-mt-4">
                    <p className="fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-2">Usuarios más activos</p>
                    <div className="space-y-2">
                      {activitySummary.top_users.slice(0, 3).map((user) => (
                        <div key={user.user_id} className="flex items-center justify-between fluid-text-sm fluid-p-2 rounded-fluid-lg hover:bg-gray-50">
                          <span className="text-gray-600 truncate">{user.email}</span>
                          <span className="font-medium text-gray-800 fluid-text-xs bg-gray-100 fluid-px-2 fluid-py-0.5 rounded-full">{user.action_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activitySummary.failed_logins > 0 && (
                  <div className="fluid-mt-4 fluid-p-3 bg-red-50 rounded-fluid-xl border border-red-200/60">
                    <div className="flex items-center fluid-gap-2 text-red-700">
                      <Shield className="fluid-icon-xs" />
                      <span className="font-medium fluid-text-sm">{activitySummary.failed_logins} logins fallidos</span>
                    </div>
                    <Link to="/gerente/seguridad" className="fluid-text-xs text-red-600 hover:underline fluid-mt-1 inline-block">
                      Ver reporte de seguridad →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center fluid-py-6 text-gray-500">
                <Activity className="fluid-icon-xl mx-auto fluid-mb-3 text-gray-300" />
                <p className="fluid-text-sm">No hay datos de actividad</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
