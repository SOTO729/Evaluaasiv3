/**
 * Página de Reportes del Gerente
 * Estadísticas de saldos, coordinadores y transacciones
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
  BalanceTransaction,
  formatCurrency,
} from '../../services/balanceService';

export default function GerenteReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [topCoordinators, setTopCoordinators] = useState<Array<{
    coordinator: { id: string; full_name: string; email: string };
    totals: { current_balance: number; total_received: number; total_spent: number; total_scholarships: number };
  }>>([]);
  const [recentTransactions, setRecentTransactions] = useState<BalanceTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => { loadData(); }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, balancesData, transData] = await Promise.all([
        getBalanceStats(),
        getAllBalances({ per_page: 10 }),
        getTransactions({ per_page: 10 }),
      ]);
      setStats(statsData);

      // Map balances - use actual coordinator objects
      const coordData = balancesData?.coordinators || [];
      setTopCoordinators([...coordData].sort((a, b) => b.totals.current_balance - a.totals.current_balance).slice(0, 5));
      setRecentTransactions(transData?.transactions?.slice(0, 5) || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const exportCSV = () => {
    if (!topCoordinators.length) return;
    const headers = 'Coordinador,Email,Saldo Actual,Total Recibido,Total Consumido,Becas\n';
    const rows = topCoordinators.map((c) =>
      `"${c.coordinator.full_name}","${c.coordinator.email}",${c.totals.current_balance},${c.totals.total_received},${c.totals.total_spent},${c.totals.total_scholarships}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte_saldos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" />
    </div>
  );

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/5 rounded-full" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center fluid-gap-4">
            <Link to="/gerente" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
              <ArrowLeft className="fluid-icon-sm text-white" />
            </Link>
            <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
              <BarChart3 className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Reportes</h1>
              <p className="fluid-text-base text-white/80">Estadísticas y análisis</p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            {/* Date range pills */}
            <div className="hidden md:flex fluid-gap-1 bg-white/10 rounded-fluid-xl fluid-p-1">
              {([['7d', '7 días'], ['30d', '30 días'], ['90d', '90 días'], ['all', 'Todo']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDateRange(val)}
                  className={`fluid-px-3 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium transition-all ${
                    dateRange === val ? 'bg-white text-teal-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="fluid-p-2.5 bg-white/15 hover:bg-white/25 rounded-fluid-xl transition-all hover:scale-105 backdrop-blur-sm"
            >
              <RefreshCw className={`fluid-icon-lg text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
          <AlertCircle className="fluid-icon-sm text-red-500" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* ===== STATS CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
        {[
          { label: 'Saldo Actual', value: formatCurrency(stats?.totals.current_balance || 0), icon: DollarSign, gradient: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'Total Aprobado', value: formatCurrency(stats?.totals.total_received || 0), icon: TrendingUp, gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Total Consumido', value: formatCurrency(stats?.totals.total_spent || 0), icon: TrendingDown, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'Becas', value: formatCurrency(stats?.totals.total_scholarships || 0), icon: Users, gradient: 'from-purple-500 to-violet-500', bg: 'bg-purple-50', text: 'text-purple-700' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between fluid-mb-3">
              <div className={`fluid-p-2.5 bg-gradient-to-br ${card.gradient} rounded-fluid-xl shadow-sm`}>
                <card.icon className="fluid-icon-sm text-white" />
              </div>
            </div>
            <p className="fluid-text-xl font-bold text-gray-800">{card.value}</p>
            <p className="fluid-text-xs text-gray-500 font-medium fluid-mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ===== TOP COORDINATORS & TRANSACTIONS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
        {/* Top Coordinators */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <Users className="fluid-icon-sm text-purple-500" />
              Top Coordinadores
            </h2>
            <span className="fluid-text-xs text-gray-400">Por saldo</span>
          </div>
          <div className="fluid-p-5">
            {topCoordinators.length === 0 ? (
              <p className="text-center text-gray-400 fluid-text-sm fluid-py-6">Sin datos</p>
            ) : (
              <div className="space-y-3">
                {topCoordinators.map((coord, i) => {
                  const maxBal = topCoordinators[0]?.totals.current_balance || 1;
                  const pct = Math.round((coord.totals.current_balance / maxBal) * 100);
                  return (
                    <div key={coord.coordinator.id} className="fluid-p-3 rounded-fluid-xl hover:bg-gray-50/80 transition-colors">
                      <div className="flex items-center justify-between fluid-mb-1.5">
                        <div className="flex items-center fluid-gap-2">
                          <span className={`fluid-w-6 fluid-h-6 rounded-full flex items-center justify-center fluid-text-xs font-bold text-white ${
                            i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-400'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="font-medium text-gray-800 fluid-text-sm truncate">{coord.coordinator.full_name}</span>
                        </div>
                        <span className="font-semibold text-gray-800 fluid-text-sm flex-shrink-0">{formatCurrency(coord.totals.current_balance)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-purple-500 to-violet-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
              <TrendingUp className="fluid-icon-sm text-blue-500" />
              Transacciones Recientes
            </h2>
          </div>
          <div className="fluid-p-5">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-gray-400 fluid-text-sm fluid-py-6">Sin transacciones</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between fluid-p-3 rounded-fluid-xl hover:bg-gray-50/80 transition-colors border border-gray-100">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 fluid-text-sm truncate">{tx.coordinator?.full_name || 'Coordinador'}</p>
                      <p className="fluid-text-xs text-gray-500 capitalize">{(tx.transaction_type || 'adjustment').replace(/_/g, ' ')}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className={`font-semibold fluid-text-sm ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </p>
                      <p className="fluid-text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('es-MX')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== REQUEST STATUS SUMMARY ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden fluid-mb-6">
        <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
            <PieChart className="fluid-icon-sm text-emerald-500" />
            Solicitudes por Estado
          </h2>
        </div>
        <div className="fluid-p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4">
            <div className="fluid-p-4 bg-amber-50/80 rounded-fluid-xl border border-amber-200/60 text-center">
              <p className="fluid-text-3xl font-bold text-amber-700">{stats?.requests.pending || 0}</p>
              <p className="fluid-text-xs text-amber-600 font-medium fluid-mt-1">Pendientes</p>
            </div>
            <div className="fluid-p-4 bg-blue-50/80 rounded-fluid-xl border border-blue-200/60 text-center">
              <p className="fluid-text-3xl font-bold text-blue-700">{stats?.requests.in_review || 0}</p>
              <p className="fluid-text-xs text-blue-600 font-medium fluid-mt-1">En Revisión</p>
            </div>
            <div className="fluid-p-4 bg-violet-50/80 rounded-fluid-xl border border-violet-200/60 text-center">
              <p className="fluid-text-3xl font-bold text-violet-700">{stats?.requests.awaiting_approval || 0}</p>
              <p className="fluid-text-xs text-violet-600 font-medium fluid-mt-1">Esperando Aprobación</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={exportCSV}
          disabled={topCoordinators.length === 0}
          className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-fluid-xl hover:from-emerald-600 hover:to-teal-600 transition-all hover:scale-[1.02] shadow-sm font-medium fluid-text-sm disabled:opacity-50"
        >
          <Download className="fluid-icon-sm" /> Exportar CSV
        </button>
      </div>
    </div>
  );
}
