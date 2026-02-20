/**
 * Página de Mi Saldo - Coordinador / Admin
 * 
 * Para Coordinador: ver saldos por grupo, solicitar más saldo/becas,
 * y ver el historial de transacciones
 * 
 * Para Admin: ver todos los saldos de coordinadores (agrupados por grupo)
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
  Users,
  Search,
  Eye,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  getMyBalance,
  getMyRequests,
  getMyTransactions,
  getAllBalances,
  CoordinatorBalance,
  MyBalanceResponse,
  BalanceRequest,
  BalanceTransaction,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
} from '../../services/balanceService';

// Helper para formatear unidades usando el costo real de certificación del grupo
const formatUnits = (amount: number, certCost?: number): string => {
  if (!certCost || certCost <= 0) return '';
  const units = Math.floor(amount / certCost);
  return `≈ ${units} cert${units !== 1 ? 's' : ''}.`;
};

interface CoordinatorBalanceInfo {
  coordinator: {
    id: string;
    full_name: string;
    email: string;
  };
  balances: CoordinatorBalance[];
  totals: {
    current_balance: number;
    total_received: number;
    total_spent: number;
    total_scholarships: number;
  };
}

export default function MiSaldoPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceData, setBalanceData] = useState<MyBalanceResponse | null>(null);
  const [recentRequests, setRecentRequests] = useState<BalanceRequest[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<BalanceTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estado para admin
  const [allCoordinators, setAllCoordinators] = useState<CoordinatorBalanceInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalBalances, setTotalBalances] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isAdmin) {
        const data = await getAllBalances({ per_page: 50 });
        setAllCoordinators(data.coordinators);
        setTotalBalances({ total: data.total, pages: data.pages });
      } else {
        const [balData, requestsData, transactionsData] = await Promise.all([
          getMyBalance(),
          getMyRequests({ per_page: 5 }),
          getMyTransactions({ per_page: 5 }),
        ]);

        setBalanceData(balData);
        setRecentRequests(requestsData.requests);
        setRecentTransactions(transactionsData.transactions);
      }
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

  // Filtrar coordinadores para admin
  const filteredCoordinators = allCoordinators.filter(coord => 
    coord.coordinator.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coord.coordinator.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular totales para admin
  const adminTotals = {
    totalBalance: allCoordinators.reduce((sum, c) => sum + (c.totals?.current_balance || 0), 0),
    totalReceived: allCoordinators.reduce((sum, c) => sum + (c.totals?.total_received || 0), 0),
    totalSpent: allCoordinators.reduce((sum, c) => sum + (c.totals?.total_spent || 0), 0),
  };

  // ===== Vista Admin =====
  if (isAdmin) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Saldos de Coordinadores
            </h1>
            <p className="text-gray-600 mt-1">
              Vista administrativa — saldo por grupo
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-blue-200" />
              <span className="text-blue-100 text-sm">Coordinadores</span>
            </div>
            <p className="text-3xl font-bold">{totalBalances.total}</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="w-6 h-6 text-green-200" />
              <span className="text-green-100 text-sm">Saldo Total Disponible</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(adminTotals.totalBalance)}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-200" />
              <span className="text-purple-100 text-sm">Total Acreditado</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(adminTotals.totalReceived)}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-6 h-6 text-amber-200" />
              <span className="text-amber-100 text-sm">Total Consumido</span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(adminTotals.totalSpent)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar coordinador por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Coordinador</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Grupos con Saldo</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Saldo Total</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total Recibido</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total Consumido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCoordinators.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No se encontraron coordinadores</p>
                    </td>
                  </tr>
                ) : (
                  filteredCoordinators.map((coord) => (
                    <tr key={coord.coordinator.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{coord.coordinator.full_name}</p>
                          <p className="text-sm text-gray-500">{coord.coordinator.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {coord.balances.map(bal => (
                            <span key={bal.id} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full">
                              {bal.group?.name || `Grupo #${bal.group_id}`}: {formatCurrency(bal.current_balance)}
                            </span>
                          ))}
                          {coord.balances.length === 0 && (
                            <span className="text-sm text-gray-400">Sin saldo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold ${coord.totals.current_balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {formatCurrency(coord.totals.current_balance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {formatCurrency(coord.totals.total_received)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700">
                        {formatCurrency(coord.totals.total_spent)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/gerente"
            className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-medium text-gray-800">Dashboard Gerencia</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
          
          <Link
            to="/gerente/aprobaciones"
            className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-green-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <span className="font-medium text-gray-800">Aprobaciones Pendientes</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
          
          <Link
            to="/financiero/solicitudes"
            className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-purple-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <span className="font-medium text-gray-800">Revisar Solicitudes</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </div>
    );
  }

  // ===== Vista Coordinador =====
  const totals = balanceData?.totals || { current_balance: 0, total_received: 0, total_spent: 0, total_scholarships: 0 };
  const groupBalances = balanceData?.balances || [];
  
  const usagePercent = totals.total_received > 0
    ? Math.round((totals.total_spent / totals.total_received) * 100)
    : 0;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fadeInDown">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Wallet className="w-8 h-8 text-green-600" />
            Mi Saldo
          </h1>
          <p className="text-gray-600 mt-1">
            Saldo por grupo para certificaciones
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

      {/* Saldo Total Hero */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 text-white mb-8 shadow-xl animate-fadeInUp hover-lift">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium mb-2">Saldo Total Disponible</p>
            <p className="text-5xl font-bold">
              {formatCurrency(totals.current_balance)}
            </p>
            <p className="text-green-100 mt-2">
              Distribuido en {groupBalances.length} grupo{groupBalances.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex gap-3">
            <Link
              to="/solicitar-saldo"
              className="flex items-center gap-2 px-5 py-3 bg-white text-green-600 rounded-xl font-medium hover:bg-green-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Solicitar Saldo
            </Link>
            <Link
              to="/solicitar-beca"
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
            <span>Uso global del saldo</span>
            <span>{usagePercent}% consumido</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Saldos por Grupo */}
      <div className="bg-white rounded-xl border shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            Saldo por Grupo
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Cada grupo tiene su propio saldo independiente
          </p>
        </div>
        <div className="p-6">
          {groupBalances.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="mb-2">No tienes saldo asignado a ningún grupo</p>
              <Link
                to="/solicitar-saldo"
                className="text-blue-600 hover:underline"
              >
                Solicitar tu primer saldo
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {groupBalances.map((bal) => {
                const groupUsage = bal.total_received > 0
                  ? Math.round((bal.total_spent / bal.total_received) * 100)
                  : 0;
                return (
                  <div
                    key={bal.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border hover:border-green-200 transition-colors"
                  >
                    <div className="mb-3 sm:mb-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">
                          {bal.group?.name || `Grupo #${bal.group_id}`}
                        </p>
                        {bal.group?.campus_name && (
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                            {bal.group.campus_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>Recibido: {formatCurrency(bal.total_received)}</span>
                        <span>Consumido: {formatCurrency(bal.total_spent)}</span>
                        {bal.total_scholarships > 0 && (
                          <span className="text-purple-600">Becas: {formatCurrency(bal.total_scholarships)}</span>
                        )}
                      </div>
                      {/* Mini progress bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${groupUsage > 80 ? 'bg-red-500' : groupUsage > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(groupUsage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{groupUsage}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${bal.current_balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatCurrency(bal.current_balance)}
                      </p>
                      {bal.group?.certification_cost && bal.group.certification_cost > 0 && (
                        <p className="text-xs text-gray-500">
                          {formatUnits(bal.current_balance, bal.group.certification_cost)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards - 4 columnas (totales globales) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-100 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Saldo Recibido</span>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {formatCurrency(totals.total_received - totals.total_scholarships)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-200 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Becas Recibidas</span>
          </div>
          <p className="text-xl font-bold text-purple-700">
            {formatCurrency(totals.total_scholarships)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-300 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total Consumido</span>
          </div>
          <p className="text-xl font-bold text-amber-700">
            {formatCurrency(totals.total_spent)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200 shadow-sm animate-fadeInUp delay-400 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-700">Total Acreditado</span>
          </div>
          <p className="text-xl font-bold text-green-700">
            {formatCurrency(totals.total_received)}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solicitudes Recientes */}
        <div className="bg-white rounded-xl border shadow-sm animate-fadeInUp delay-500 hover-lift card-transition">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Mis Solicitudes
            </h2>
            <Link
              to="/historial-solicitudes"
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
                  to="/solicitar-saldo"
                  className="mt-3 inline-block text-blue-600 hover:underline"
                >
                  Crear tu primera solicitud
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRequests.map((req) => (
                  <Link
                    key={req.id}
                    to={`/mi-saldo/solicitud/${req.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          req.request_type === 'beca'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {req.request_type_label}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(req.status)}`}>
                          {getStatusLabel(req.status)}
                        </span>
                        {req.group && (
                          <span className="text-xs text-gray-500">
                            → {req.group.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(req.amount_requested)}
                        </p>
                        {req.amount_approved && req.status === 'approved' && (
                          <p className="text-xs text-green-600">
                            Aprobado: {formatCurrency(req.amount_approved)}
                          </p>
                        )}
                      </div>
                      <Eye className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Últimos Movimientos */}
        <div className="bg-white rounded-xl border shadow-sm animate-fadeInUp delay-600 hover-lift card-transition">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-green-500" />
              Últimos Movimientos
            </h2>
            <Link
              to="/historial-movimientos"
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
                          {tx.group && <span className="ml-1">· {tx.group.name}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        tx.transaction_type === 'credit'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {tx.transaction_type === 'credit' ? '+' : '-'}
                        {formatCurrency(Math.abs(tx.amount))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Asignaciones */}
      <div className="mt-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-medium text-emerald-800">Historial de Asignaciones</p>
            <p className="text-sm text-emerald-600">Rastrea cada peso invertido en certificaciones</p>
          </div>
        </div>
        <Link
          to="/historial-asignaciones"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          Ver detalle <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Alerta de saldo bajo */}
      {totals.current_balance > 0 && totals.current_balance < (totals.total_received * 0.2) && totals.total_received > 0 && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Saldo bajo</p>
            <p className="text-sm text-amber-700">
              Tu saldo está por debajo del 20%. Considera solicitar más saldo para continuar asignando certificaciones.
            </p>
            <Link
              to="/solicitar-saldo"
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
