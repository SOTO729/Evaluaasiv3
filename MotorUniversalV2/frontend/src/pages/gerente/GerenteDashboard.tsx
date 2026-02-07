/**
 * Dashboard del Portal de Gerencia
 * 
 * Vista principal para el usuario tipo "gerente":
 * - Resumen de estadísticas de saldos
 * - Solicitudes pendientes de aprobación final
 * - Actividad reciente del personal
 * - Acceso a reportes y logs
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  DollarSign,
  FileCheck,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Shield,
  BarChart3,
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

  useEffect(() => {
    loadData();
  }, []);

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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-purple-600" />
            Portal de Gerencia
          </h1>
          <p className="text-gray-600 mt-1">
            Supervisión y aprobación de operaciones
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Saldo Total */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-700">Saldo Total</span>
          </div>
          <p className="text-2xl font-bold text-green-800">
            {formatCurrency(stats?.totals.current_balance || 0)}
          </p>
          <p className="text-sm text-green-600 mt-1">
            {stats?.coordinators_with_balance || 0} coordinadores
          </p>
        </div>

        {/* Pendientes de Aprobación */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <FileCheck className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-amber-700">Por Aprobar</span>
          </div>
          <p className="text-2xl font-bold text-amber-800">
            {stats?.requests.awaiting_approval || 0}
          </p>
          <p className="text-sm text-amber-600 mt-1">
            Solicitudes recomendadas
          </p>
        </div>

        {/* Actividad Hoy */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-blue-700">Actividad Hoy</span>
          </div>
          <p className="text-2xl font-bold text-blue-800">
            {activitySummary?.today_actions || 0}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            Acciones registradas
          </p>
        </div>

        {/* Total Aprobado */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-purple-700">Total Aprobado</span>
          </div>
          <p className="text-2xl font-bold text-purple-800">
            {formatCurrency(stats?.totals.total_received || 0)}
          </p>
          <p className="text-sm text-purple-600 mt-1">
            Histórico acumulado
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solicitudes Pendientes de Aprobación */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-amber-500" />
              Pendientes de Aprobación
            </h2>
            <Link
              to="/gerente/aprobaciones"
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6">
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay solicitudes pendientes de aprobación</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((request) => (
                  <Link
                    key={request.id}
                    to={`/gerente/aprobaciones/${request.id}`}
                    className="block p-4 rounded-lg border hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800">
                          {request.coordinator?.full_name || 'Coordinador'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {request.campus?.name || 'Sin plantel'} • {request.group?.name || 'General'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(request.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(request.financiero_recommended_amount || request.amount_requested)}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                          request.status === 'recommended_approve' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {request.status === 'recommended_approve' ? 'Recomienda Aprobar' : 'Recomienda Rechazar'}
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
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Actividad del Personal
            </h2>
            <Link
              to="/gerente/actividad"
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6">
            {activitySummary ? (
              <div className="space-y-4">
                {/* Acciones por tipo */}
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(activitySummary.actions_by_type || {}).slice(0, 4).map(([type, count]) => (
                    <div key={type} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xl font-bold text-gray-800">{count}</p>
                      <p className="text-xs text-gray-500 capitalize">{type.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>

                {/* Usuarios más activos */}
                {activitySummary.top_users && activitySummary.top_users.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Usuarios más activos</p>
                    <div className="space-y-2">
                      {activitySummary.top_users.slice(0, 3).map((user, _idx) => (
                        <div key={user.user_id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{user.email}</span>
                          <span className="font-medium text-gray-800">{user.action_count} acciones</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logins fallidos */}
                {activitySummary.failed_logins > 0 && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2 text-red-700">
                      <Shield className="w-4 h-4" />
                      <span className="font-medium">{activitySummary.failed_logins} intentos de login fallidos</span>
                    </div>
                    <Link
                      to="/gerente/seguridad"
                      className="text-sm text-red-600 hover:underline mt-1 inline-block"
                    >
                      Ver reporte de seguridad →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay datos de actividad</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          to="/gerente/aprobaciones"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:border-purple-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-purple-100 rounded-lg">
            <FileCheck className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800">Aprobaciones</p>
            <p className="text-sm text-gray-500">Revisar y aprobar</p>
          </div>
        </Link>

        <Link
          to="/gerente/actividad"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-blue-100 rounded-lg">
            <Activity className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800">Logs de Actividad</p>
            <p className="text-sm text-gray-500">Ver historial</p>
          </div>
        </Link>

        <Link
          to="/gerente/reportes"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:border-green-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-green-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800">Reportes</p>
            <p className="text-sm text-gray-500">Estadísticas</p>
          </div>
        </Link>

        <Link
          to="/gerente/seguridad"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border hover:border-red-300 hover:shadow-md transition-all"
        >
          <div className="p-3 bg-red-100 rounded-lg">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-medium text-gray-800">Seguridad</p>
            <p className="text-sm text-gray-500">Alertas y riesgos</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
