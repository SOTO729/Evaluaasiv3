/**
 * Página de Reportes del Gerente
 * 
 * Estadísticas y reportes de saldos, coordinadores, etc.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  ArrowLeft,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  PieChart,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBalanceStats,
  getAllBalances,
  getTransactions,
  BalanceStats,
  CoordinatorBalance,
  BalanceTransaction,
  formatCurrency,
} from '../../services/balanceService';

export default function GerenteReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [topCoordinators, setTopCoordinators] = useState<CoordinatorBalance[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<BalanceTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, balancesData, transactionsData] = await Promise.all([
        getBalanceStats(),
        getAllBalances({ per_page: 10 }),
        getTransactions({ per_page: 10 }),
      ]);

      setStats(statsData);
      // balancesData.coordinators contains array of {coordinator, balance}
      setTopCoordinators(balancesData.coordinators?.map((c: any) => c.balance) || []);
      setRecentTransactions(transactionsData.transactions || []);
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/gerente"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-green-600" />
              Reportes y Estadísticas
            </h1>
            <p className="text-gray-600 mt-1">
              Análisis de saldos y movimientos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
          >
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="all">Todo el tiempo</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-700">Saldo Actual Total</span>
          </div>
          <p className="text-3xl font-bold text-green-800">
            {formatCurrency(stats?.totals.current_balance || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-blue-700">Total Aprobado</span>
          </div>
          <p className="text-3xl font-bold text-blue-800">
            {formatCurrency(stats?.totals.total_received || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-amber-700">Total Consumido</span>
          </div>
          <p className="text-3xl font-bold text-amber-800">
            {formatCurrency(stats?.totals.total_spent || 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-purple-700">Becas Otorgadas</span>
          </div>
          <p className="text-3xl font-bold text-purple-800">
            {formatCurrency(stats?.totals.total_scholarships || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Coordinators */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Top Coordinadores por Saldo
            </h2>
          </div>
          <div className="p-6">
            {topCoordinators.length > 0 ? (
              <div className="space-y-4">
                {topCoordinators.slice(0, 5).map((balance, idx) => {
                  const usagePercent = balance.total_received > 0
                    ? Math.round((balance.total_spent / balance.total_received) * 100)
                    : 0;
                  return (
                    <div key={balance.id} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {balance.coordinator?.full_name || 'Coordinador'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{usagePercent}% usado</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(balance.current_balance)}
                        </p>
                        <p className="text-xs text-gray-500">
                          de {formatCurrency(balance.total_received)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay datos de coordinadores</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Últimas Transacciones
            </h2>
          </div>
          <div className="p-6">
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'credit'
                          ? 'bg-green-100'
                          : tx.transaction_type === 'debit'
                          ? 'bg-red-100'
                          : 'bg-gray-100'
                      }`}>
                        {tx.transaction_type === 'credit' ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : tx.transaction_type === 'debit' ? (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        ) : (
                          <DollarSign className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {tx.concept_label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tx.coordinator?.full_name || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.transaction_type === 'credit'
                          ? 'text-green-600'
                          : tx.transaction_type === 'debit'
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {tx.transaction_type === 'credit' ? '+' : tx.transaction_type === 'debit' ? '-' : ''}
                        {formatCurrency(Math.abs(tx.amount))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay transacciones recientes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Requests Summary */}
      <div className="mt-6 bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-500" />
          Estado de Solicitudes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-yellow-50 rounded-xl border border-yellow-100">
            <p className="text-4xl font-bold text-yellow-700">
              {stats?.requests.pending || 0}
            </p>
            <p className="text-sm text-yellow-600 mt-2">Pendientes</p>
          </div>
          <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-4xl font-bold text-blue-700">
              {stats?.requests.in_review || 0}
            </p>
            <p className="text-sm text-blue-600 mt-2">En Revisión</p>
          </div>
          <div className="text-center p-6 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-4xl font-bold text-purple-700">
              {stats?.requests.awaiting_approval || 0}
            </p>
            <p className="text-sm text-purple-600 mt-2">Esperando Aprobación</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-4">
        <button
          className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-5 h-5" />
          Exportar Reporte
        </button>
      </div>
    </div>
  );
}
