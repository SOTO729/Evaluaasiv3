/**
 * Página de Historial de Movimientos - Coordinador
 * 
 * Lista de transacciones del saldo del coordinador
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  AlertCircle,
  Filter,
  Calendar,
  Clock,
  Gift,
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getMyBalance, getMyTransactions, BalanceTransaction, formatCurrency } from '../../services/balanceService';

export default function HistorialMovimientosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  // Estadísticas
  const [stats, setStats] = useState({
    totalCredits: 0,
    totalDebits: 0,
    monthCredits: 0,
    monthDebits: 0,
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar balance y transacciones en paralelo
      const [balanceData, transactionsData] = await Promise.all([
        getMyBalance(),
        getMyTransactions({ per_page: 100 }),
      ]);
      
      setTransactions(transactionsData.transactions || []);
      setCurrentBalance(balanceData.current_balance || 0);

      // Calcular estadísticas
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalCredits = 0;
      let totalDebits = 0;
      let monthCredits = 0;
      let monthDebits = 0;

      (transactionsData.transactions || []).forEach((t: BalanceTransaction) => {
        const amount = t.amount || 0;
        const txDate = new Date(t.created_at);

        if (t.transaction_type === 'credit') {
          totalCredits += amount;
          if (txDate >= monthStart) monthCredits += amount;
        } else if (t.transaction_type === 'debit') {
          totalDebits += amount;
          if (txDate >= monthStart) monthDebits += amount;
        }
      });

      setStats({ totalCredits, totalDebits, monthCredits, monthDebits });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const filteredTransactions = typeFilter
    ? transactions.filter(t => t.transaction_type === typeFilter)
    : transactions;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <ArrowDownCircle className="w-5 h-5 text-green-500" />;
      case 'debit':
        return <ArrowUpCircle className="w-5 h-5 text-red-500" />;
      case 'adjustment':
        return <RefreshCw className="w-5 h-5 text-blue-500" />;
      default:
        return <Receipt className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'credit':
        return 'Ingreso';
      case 'debit':
        return 'Gasto';
      case 'adjustment':
        return 'Ajuste';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'credit':
        return 'bg-green-100 text-green-700';
      case 'debit':
        return 'bg-red-100 text-red-700';
      case 'adjustment':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/coordinador/mi-saldo"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Receipt className="w-8 h-8 text-green-600" />
              Historial de Movimientos
            </h1>
            <p className="text-gray-600 mt-1">
              Registro de todos los ingresos y gastos de tu saldo
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadTransactions}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Saldo actual */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Saldo Actual</p>
                <p className="text-3xl font-bold">{formatCurrency(currentBalance)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-green-300" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Ingresos</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(stats.totalCredits)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Gastos</p>
                  <p className="text-lg font-semibold text-red-600">
                    {formatCurrency(stats.totalDebits)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ingresos (Este mes)</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(stats.monthCredits)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gastos (Este mes)</p>
                  <p className="text-lg font-semibold text-orange-600">
                    {formatCurrency(stats.monthDebits)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              >
                <option value="">Todos los movimientos</option>
                <option value="credit">Solo ingresos</option>
                <option value="debit">Solo gastos</option>
                <option value="adjustment">Solo ajustes</option>
              </select>
              <span className="text-sm text-gray-500">
                {filteredTransactions.length} movimientos
              </span>
            </div>
          </div>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No hay movimientos
              </h3>
              <p className="text-gray-500">
                {typeFilter
                  ? 'No se encontraron movimientos de este tipo'
                  : 'Aún no tienes movimientos registrados'
                }
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="divide-y">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className="p-2 bg-gray-50 rounded-lg">
                          {getTypeIcon(transaction.transaction_type)}
                        </div>

                        {/* Info */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(transaction.transaction_type)}`}>
                              {getTypeLabel(transaction.transaction_type)}
                            </span>

                            {transaction.is_scholarship && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                <Gift className="w-3 h-3" />
                                Beca
                              </span>
                            )}

                            {transaction.request_id && (
                              <span className="text-xs text-gray-400">
                                Solicitud #{transaction.request_id}
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-gray-800">
                            {transaction.description || 'Sin descripción'}
                          </p>

                          {/* Destino */}
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            {transaction.campus && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {transaction.campus.name}
                              </span>
                            )}
                            {transaction.group && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {transaction.group.name}
                              </span>
                            )}
                          </div>

                          {/* Fecha */}
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(transaction.created_at).toLocaleDateString()} 
                            {' '}a las {new Date(transaction.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          transaction.transaction_type === 'credit'
                            ? 'text-green-600'
                            : transaction.transaction_type === 'debit'
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}>
                          {transaction.transaction_type === 'credit' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Saldo: {formatCurrency(transaction.balance_after)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
