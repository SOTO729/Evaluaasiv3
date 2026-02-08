/**
 * Dashboard del Módulo Financiero
 * 
 * Vista principal para el usuario tipo "financiero":
 * - Resumen de estadísticas
 * - Solicitudes pendientes de revisión
 * - Acceso a reportes
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getPendingRequests,
  getBalanceStats,
  BalanceRequest,
  BalanceStats,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
} from '../../services/balanceService';

export default function FinancieroDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [pendingRequests, setPendingRequests] = useState<BalanceRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, requestsData] = await Promise.all([
        getBalanceStats(),
        getPendingRequests({ status: 'all_pending', per_page: 5 }),
      ]);

      setStats(statsData);
      setPendingRequests(requestsData.requests);
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
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
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
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portal Financiero</h1>
          <p className="text-gray-600 mt-1">Gestión de solicitudes de saldo y reportes</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Solicitudes Pendientes</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats?.requests.pending || 0}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En Revisión</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {stats?.requests.in_review || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Esperando Aprobación</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {stats?.requests.awaiting_approval || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Saldo Total en Sistema</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(stats?.totals.current_balance || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          to="/financiero/solicitudes"
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl p-6 hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg animate-fade-in-up"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Revisar Solicitudes</h3>
              <p className="text-indigo-100 text-sm mt-1">
                {(stats?.requests.pending || 0) + (stats?.requests.in_review || 0)} pendientes
              </p>
            </div>
            <ArrowRight className="w-6 h-6" />
          </div>
        </Link>

        <Link
          to="/financiero/coordinadores"
          className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-6 hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg animate-fade-in-up"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Saldos por Coordinador</h3>
              <p className="text-emerald-100 text-sm mt-1">
                {stats?.coordinators_with_balance || 0} con saldo activo
              </p>
            </div>
            <Users className="w-6 h-6" />
          </div>
        </Link>

        <Link
          to="/financiero/reportes"
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-6 hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg animate-fade-in-up"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Reportes</h3>
              <p className="text-amber-100 text-sm mt-1">
                Estadísticas y análisis
              </p>
            </div>
            <TrendingUp className="w-6 h-6" />
          </div>
        </Link>
      </div>

      {/* Recent Pending Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Solicitudes Recientes
            </h2>
            <Link
              to="/financiero/solicitudes"
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              Ver todas →
            </Link>
          </div>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No hay solicitudes pendientes
            </h3>
            <p className="text-gray-500 mt-1">
              Todas las solicitudes han sido procesadas
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingRequests.map((req) => (
              <Link
                key={req.id}
                to={`/financiero/solicitudes/${req.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    req.request_type === 'beca' ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    <DollarSign className={`w-5 h-5 ${
                      req.request_type === 'beca' ? 'text-purple-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {req.coordinator?.full_name || 'Coordinador'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {req.campus?.name || 'Sin plantel'} • {formatCurrency(req.amount_requested)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                    {getStatusLabel(req.status)}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    req.request_type === 'beca' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {req.request_type_label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen de Saldos
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Otorgado</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(stats?.totals.total_received || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Utilizado</span>
              <span className="font-semibold text-gray-900">
                {formatCurrency(stats?.totals.total_spent || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Becas Otorgadas</span>
              <span className="font-semibold text-purple-600">
                {formatCurrency(stats?.totals.total_scholarships || 0)}
              </span>
            </div>
            <div className="border-t pt-4 flex items-center justify-between">
              <span className="text-gray-900 font-medium">Saldo Disponible</span>
              <span className="font-bold text-green-600 text-xl">
                {formatCurrency(stats?.totals.current_balance || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Acciones Rápidas
          </h3>
          <div className="space-y-3">
            <Link
              to="/financiero/solicitudes?status=pending"
              className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-800">Solicitudes nuevas</span>
              </div>
              <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-sm font-medium">
                {stats?.requests.pending || 0}
              </span>
            </Link>
            <Link
              to="/financiero/solicitudes?type=beca"
              className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="text-purple-800">Solicitudes de beca</span>
              </div>
              <ArrowRight className="w-5 h-5 text-purple-600" />
            </Link>
            <Link
              to="/financiero/coordinadores?low_balance=true"
              className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800">Coordinadores con saldo bajo</span>
              </div>
              <ArrowRight className="w-5 h-5 text-red-600" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
