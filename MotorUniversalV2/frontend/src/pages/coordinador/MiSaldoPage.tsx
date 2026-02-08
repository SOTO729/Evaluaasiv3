/**
 * Página de Mi Saldo - Coordinador / Admin
 * 
 * Para Coordinador: ver su saldo actual, solicitar más saldo/becas,
 * y ver el historial de transacciones
 * 
 * Para Admin: ver todos los saldos de coordinadores
 */
import { useState, useEffect, useMemo } from 'react';
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
  Calculator,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import {
  getMyBalance,
  getMyRequests,
  getMyTransactions,
  getAllBalances,
  CoordinatorBalance,
  BalanceRequest,
  BalanceTransaction,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
} from '../../services/balanceService';
import { getAvailableCampuses } from '../../services/userManagementService';
import { getGroups } from '../../services/partnersService';

interface CoordinatorBalanceInfo {
  coordinator: {
    id: string;
    full_name: string;
    email: string;
  };
  balance: CoordinatorBalance;
}

interface GroupEquivalence {
  id: number;
  name: string;
  campusName: string;
  campusId: number;
  price: number;
  equivalentUnits: number;
  hasDifferentPrice: boolean;
}

export default function MiSaldoPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<CoordinatorBalance | null>(null);
  const [recentRequests, setRecentRequests] = useState<BalanceRequest[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<BalanceTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estado para admin - lista de todos los coordinadores
  const [allCoordinators, setAllCoordinators] = useState<CoordinatorBalanceInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalBalances, setTotalBalances] = useState({ total: 0, pages: 1 });
  
  // Estado para equivalencias por grupo
  const [groupEquivalences, setGroupEquivalences] = useState<GroupEquivalence[]>([]);
  const [showEquivalences, setShowEquivalences] = useState(false);
  const [loadingEquivalences, setLoadingEquivalences] = useState(false);

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isAdmin) {
        // Admin: cargar todos los saldos de coordinadores
        const data = await getAllBalances({ per_page: 50 });
        setAllCoordinators(data.coordinators);
        setTotalBalances({ total: data.total, pages: data.pages });
      } else {
        // Coordinador: cargar su propio saldo
        const [balanceData, requestsData, transactionsData] = await Promise.all([
          getMyBalance(),
          getMyRequests({ per_page: 5 }),
          getMyTransactions({ per_page: 5 }),
        ]);

        setBalance(balanceData);
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

  // Cargar equivalencias por grupo (lazy loading)
  const loadGroupEquivalences = async () => {
    if (groupEquivalences.length > 0 || !balance) return;
    
    try {
      setLoadingEquivalences(true);
      
      // Obtener todos los campuses del coordinador
      const campusesData = await getAvailableCampuses();
      const campuses = campusesData.campuses || [];
      
      const equivalences: GroupEquivalence[] = [];
      const currentBalance = balance.current_balance || 0;
      
      // Para cada campus, obtener los grupos con sus precios
      for (const campus of campuses) {
        const baseCampusPrice = campus.certification_cost || 500;
        
        // Agregar equivalencia a nivel plantel
        const plantelUnits = baseCampusPrice > 0 ? Math.floor(currentBalance / baseCampusPrice) : 0;
        equivalences.push({
          id: 0,
          name: `Precio base plantel`,
          campusName: campus.name,
          campusId: campus.id,
          price: baseCampusPrice,
          equivalentUnits: plantelUnits,
          hasDifferentPrice: false,
        });
        
        // Obtener grupos del campus
        try {
          const groupsData = await getGroups(campus.id, { active_only: true, include_config: true });
          
          for (const group of groupsData.groups) {
            const groupPrice = group.effective_config?.certification_cost ?? baseCampusPrice;
            
            // Solo agregar si tiene precio diferente al campus
            if (groupPrice !== baseCampusPrice) {
              const groupUnits = groupPrice > 0 ? Math.floor(currentBalance / groupPrice) : 0;
              equivalences.push({
                id: group.id,
                name: group.name,
                campusName: campus.name,
                campusId: campus.id,
                price: groupPrice,
                equivalentUnits: groupUnits,
                hasDifferentPrice: true,
              });
            }
          }
        } catch (err) {
          console.error(`Error loading groups for campus ${campus.id}:`, err);
        }
      }
      
      setGroupEquivalences(equivalences);
    } catch (err) {
      console.error('Error loading group equivalences:', err);
    } finally {
      setLoadingEquivalences(false);
    }
  };

  const handleToggleEquivalences = async () => {
    if (!showEquivalences) {
      await loadGroupEquivalences();
    }
    setShowEquivalences(!showEquivalences);
  };

  // Agrupar equivalencias por campus
  const equivalencesByCampus = useMemo(() => {
    const grouped: { [campusId: number]: { campusName: string; items: GroupEquivalence[] } } = {};
    
    groupEquivalences.forEach(eq => {
      if (!grouped[eq.campusId]) {
        grouped[eq.campusId] = { campusName: eq.campusName, items: [] };
      }
      grouped[eq.campusId].items.push(eq);
    });
    
    return grouped;
  }, [groupEquivalences]);

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
    totalBalance: allCoordinators.reduce((sum, c) => sum + (c.balance?.current_balance || 0), 0),
    totalReceived: allCoordinators.reduce((sum, c) => sum + (c.balance?.total_received || 0), 0),
    totalSpent: allCoordinators.reduce((sum, c) => sum + (c.balance?.total_spent || 0), 0),
  };

  // Vista para Admin
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
              Vista administrativa de todos los saldos
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
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Saldo Actual</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total Recibido</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Total Consumido</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Becas</th>
                  <th className="text-center px-6 py-4 text-sm font-semibold text-gray-600">Uso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCoordinators.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No se encontraron coordinadores</p>
                    </td>
                  </tr>
                ) : (
                  filteredCoordinators.map((coord) => {
                    const totalReceived = coord.balance?.total_received || 0;
                    const totalSpent = coord.balance?.total_spent || 0;
                    const currentBalance = coord.balance?.current_balance || 0;
                    const totalScholarships = coord.balance?.total_scholarships || 0;
                    const usage = totalReceived > 0 
                      ? Math.round((totalSpent / totalReceived) * 100) 
                      : 0;
                    return (
                      <tr key={coord.coordinator.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-800">{coord.coordinator.full_name}</p>
                            <p className="text-sm text-gray-500">{coord.coordinator.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-semibold ${currentBalance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {formatCurrency(currentBalance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700">
                          {formatCurrency(totalReceived)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700">
                          {formatCurrency(totalSpent)}
                        </td>
                        <td className="px-6 py-4 text-right text-purple-600">
                          {formatCurrency(totalScholarships)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${usage > 80 ? 'bg-red-500' : usage > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${usage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10">{usage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Links a otras vistas de gerencia */}
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

  // Vista para Coordinador (original)
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
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
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

      {/* Equivalencias por Grupo - Desplegable */}
      {balance && balance.current_balance > 0 && (
        <div className="bg-white rounded-xl border shadow-sm mb-8 overflow-hidden">
          <button
            onClick={handleToggleEquivalences}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-800">Equivalencias por Grupo</p>
                <p className="text-sm text-gray-500">Ver cuántas certificaciones equivale tu saldo en cada grupo</p>
              </div>
            </div>
            {loadingEquivalences ? (
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            ) : showEquivalences ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          {showEquivalences && (
            <div className="border-t p-4">
              {loadingEquivalences ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  <p className="text-gray-500 mt-2">Calculando equivalencias...</p>
                </div>
              ) : groupEquivalences.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Calculator className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>No se encontraron grupos con configuración de precios</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(equivalencesByCampus).map(([campusId, { campusName, items }]) => (
                    <div key={campusId}>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <h4 className="font-medium text-gray-700">{campusName}</h4>
                      </div>
                      <div className="space-y-2">
                        {items.map((eq, idx) => (
                          <div 
                            key={`${eq.id}-${idx}`}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              eq.hasDifferentPrice ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${eq.hasDifferentPrice ? 'text-amber-800' : 'text-gray-700'}`}>
                                  {eq.name}
                                </span>
                                {eq.hasDifferentPrice && (
                                  <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-700 rounded-full">
                                    Precio diferente
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                Precio: {formatCurrency(eq.price)}/certificación
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${eq.hasDifferentPrice ? 'text-amber-700' : 'text-green-600'}`}>
                                {eq.equivalentUnits}
                              </p>
                              <p className="text-xs text-gray-500">certificaciones</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Nota:</strong> El saldo a nivel plantel se puede usar en cualquier grupo.
                      La cantidad de certificaciones varía según el precio configurado en cada grupo.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Desglose del Saldo */}
      {balance && (
        <div className="bg-white rounded-xl border shadow-sm mb-8 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              Desglose del Saldo
            </h2>
            
            <div className="space-y-3">
              {/* Total Recibido */}
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Saldo Recibido</p>
                    <p className="text-xs text-green-600">Aprobaciones de solicitudes de saldo</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-green-700">
                  +{formatCurrency(balance.total_received - (balance.total_scholarships || 0))}
                </p>
              </div>

              {/* Becas Recibidas */}
              {(balance.total_scholarships || 0) > 0 && (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Gift className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-purple-800">Becas Recibidas</p>
                      <p className="text-xs text-purple-600">Aprobaciones de solicitudes de beca</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-purple-700">
                    +{formatCurrency(balance.total_scholarships || 0)}
                  </p>
                </div>
              )}

              {/* Total Consumido */}
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-red-800">Saldo Consumido</p>
                    <p className="text-xs text-red-600">Certificaciones asignadas a alumnos</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-red-700">
                  -{formatCurrency(balance.total_spent)}
                </p>
              </div>

              {/* Línea divisora */}
              <div className="border-t border-gray-200 my-2" />

              {/* Saldo Actual */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Wallet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Saldo Disponible</p>
                    <p className="text-xs text-gray-600">= Recibido + Becas - Consumido</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(balance.current_balance)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <Link
                    key={request.id}
                    to={`/coordinador/mi-saldo/solicitud/${request.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
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
                    <div className="flex items-center gap-4">
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
                      <Eye className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
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
