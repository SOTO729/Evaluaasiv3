/**
 * Página de Mi Saldo - Coordinador
 * 
 * El coordinador puede ver su saldo actual, solicitar más saldo/becas,
 * y ver el historial de transacciones
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  FileText,
  ArrowRight,
  Gift,
  History,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getMyBalance,
  getMyRequests,
  getMyTransactions,
  CoordinatorBalance,
  BalanceRequest,
  BalanceTransaction,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
} from '../../services/balanceService';

export default function MiSaldoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<CoordinatorBalance | null>(null);
  const [recentRequests, setRecentRequests] = useState<BalanceRequest[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<BalanceTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [balanceData, requestsData, transactionsData] = await Promise.all([
        getMyBalance(),
        getMyRequests({ per_page: 5 }),
        getMyTransactions({ per_page: 5 }),
      ]);

      setBalance(balanceData);
      setRecentRequests(requestsData.requests);
      setRecentTransactions(transactionsData.transactions);
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

  // Calcular porcentaje de uso
  const usagePercent = balance && balance.total_received > 0
    ? Math.round((balance.total_spent / balance.total_received) * 100)
    : 0;

  // Calcular certificaciones disponibles (si hay costo promedio)
  // Esto es una estimación, el real se calcula por grupo
  const estimatedCertifications = balance && balance.current_balance > 0
    ? Math.floor(balance.current_balance / 500) // Asumiendo $500 promedio
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-green-600" />
            Mi Saldo
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona tu inventario de certificaciones
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

      {/* Saldo Principal */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 text-white mb-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium mb-2">Saldo Disponible</p>
            <p className="text-5xl font-bold">
              {formatCurrency(balance?.current_balance || 0)}
            </p>
            <p className="text-green-100 mt-2">
              ≈ {estimatedCertifications} certificaciones estimadas
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex gap-3">
            <Link
              to="/coordinador/solicitar-saldo"
              className="flex items-center gap-2 px-5 py-3 bg-white text-green-600 rounded-xl font-medium hover:bg-green-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Solicitar Saldo
            </Link>
            <Link
              to="/coordinador/solicitar-beca"
              className="flex items-center gap-2 px-5 py-3 bg-green-400 bg-opacity-30 text-white rounded-xl font-medium hover:bg-opacity-50 transition-colors border border-white/30"
            >
              <Gift className="w-5 h-5" />
              Solicitar Beca
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-sm text-green-100 mb-2">
            <span>Uso del saldo</span>
            <span>{usagePercent}% consumido</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Recibido</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(balance?.total_received || 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Consumido</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(balance?.total_spent || 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Gift className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Becas Recibidas</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(balance?.total_scholarships || 0)}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solicitudes Recientes */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Mis Solicitudes
            </h2>
            <Link
              to="/coordinador/historial-solicitudes"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6">
            {recentRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No has realizado solicitudes</p>
                <Link
                  to="/coordinador/solicitar-saldo"
                  className="mt-3 inline-block text-blue-600 hover:underline"
                >
                  Crear tu primera solicitud
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          request.request_type === 'beca'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {request.request_type_label}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">
                        {formatCurrency(request.amount_requested)}
                      </p>
                      {request.amount_approved && request.status === 'approved' && (
                        <p className="text-xs text-green-600">
                          Aprobado: {formatCurrency(request.amount_approved)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Últimos Movimientos */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-green-500" />
              Últimos Movimientos
            </h2>
            <Link
              to="/coordinador/historial-movimientos"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver todo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay movimientos registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'credit'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}>
                        {tx.transaction_type === 'credit' ? (
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {tx.concept_label}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${
                      tx.transaction_type === 'credit'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de saldo bajo */}
      {balance && balance.current_balance < (balance.total_received * 0.2) && balance.total_received > 0 && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Saldo bajo</p>
            <p className="text-sm text-amber-700">
              Tu saldo está por debajo del 20%. Considera solicitar más saldo para continuar asignando certificaciones.
            </p>
            <Link
              to="/coordinador/solicitar-saldo"
              className="mt-2 inline-block text-amber-600 hover:underline text-sm font-medium"
            >
              Solicitar más saldo →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
