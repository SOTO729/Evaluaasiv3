/**
 * Página de Finanzas del Gerente
 * Fusión de Reportes + Delegaciones con sistema de tabs
 * Tabs: Resumen | Coordinadores | Delegar
 */
import { useState, useEffect, useCallback } from 'react';
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
  Shield,
  ShieldCheck,
  ShieldOff,
  CheckCircle2,
  Mail,
  Info,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBalanceStats,
  getAllBalances,
  getTransactions,
  getFinancierosForDelegation,
  toggleFinancieroDelegation,
  BalanceStats,
  BalanceTransaction,
  DelegatedFinanciero,
  formatCurrency,
} from '../../services/balanceService';

type TabKey = 'resumen' | 'coordinadores' | 'delegar';

export default function GerenteFinanzasPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Resumen state
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<BalanceTransaction[]>([]);

  // Coordinadores state
  const [allCoordinators, setAllCoordinators] = useState<Array<{
    coordinator: { id: string; full_name: string; email: string };
    totals: { current_balance: number; total_received: number; total_spent: number; total_scholarships: number };
  }>>([]);

  // Delegaciones state
  const [financieros, setFinancieros] = useState<DelegatedFinanciero[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadResumen = useCallback(async () => {
    const [statsData, transData] = await Promise.all([
      getBalanceStats(),
      getTransactions({ per_page: 10 }),
    ]);
    setStats(statsData);
    setRecentTransactions(transData?.transactions?.slice(0, 5) || []);
  }, []);

  const loadCoordinadores = useCallback(async () => {
    const balancesData = await getAllBalances({ per_page: 50 });
    const coordData = balancesData?.coordinators || [];
    setAllCoordinators([...coordData].sort((a, b) => b.totals.current_balance - a.totals.current_balance));
  }, []);

  const loadDelegaciones = useCallback(async () => {
    const data = await getFinancierosForDelegation();
    setFinancieros(data);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (activeTab === 'resumen') {
        await Promise.all([loadResumen(), loadCoordinadores()]);
      } else if (activeTab === 'coordinadores') {
        await loadCoordinadores();
      } else if (activeTab === 'delegar') {
        await loadDelegaciones();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadResumen, loadCoordinadores, loadDelegaciones]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      setTogglingId(id);
      setError(null);
      const result = await toggleFinancieroDelegation(id, !currentState);
      setFinancieros((prev) =>
        prev.map((f) => (f.id === id ? { ...f, can_approve_balance: result.financiero.can_approve_balance } : f))
      );
      setSuccess(result.financiero.can_approve_balance ? 'Delegación activada exitosamente' : 'Delegación revocada');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar delegación');
    } finally {
      setTogglingId(null);
    }
  };

  const exportCSV = () => {
    if (!allCoordinators.length) return;
    const headers = 'Coordinador,Email,Saldo Actual,Total Recibido,Total Consumido,Becas\n';
    const rows = allCoordinators.map((c) =>
      `"${c.coordinator.full_name}","${c.coordinator.email}",${c.totals.current_balance},${c.totals.total_received},${c.totals.total_spent},${c.totals.total_scholarships}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reporte_saldos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const tabs: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
    { key: 'resumen', label: 'Resumen', icon: BarChart3 },
    { key: 'coordinadores', label: 'Coordinadores', icon: Users },
    { key: 'delegar', label: 'Delegar Permisos', icon: Shield },
  ];

  const delegatedCount = financieros.filter((f) => f.can_approve_balance).length;

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
              <DollarSign className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Finanzas</h1>
              <p className="fluid-text-base text-white/80">Reportes, coordinadores y delegaciones</p>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            {activeTab === 'resumen' && (
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
            )}
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

      {/* ===== TABS ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-1.5 fluid-mb-6">
        <div className="flex fluid-gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-py-3 fluid-px-4 rounded-fluid-xl fluid-text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="fluid-icon-sm" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2 animate-fade-in-up">
          <CheckCircle2 className="fluid-icon-sm text-green-500 flex-shrink-0" />
          <p className="text-green-700 fluid-text-sm font-medium">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-center fluid-gap-2">
          <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* ===== TAB: RESUMEN ===== */}
          {activeTab === 'resumen' && (
            <div className="animate-fade-in-up">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
                {[
                  { label: 'Saldo Actual', value: formatCurrency(stats?.totals.current_balance || 0), icon: DollarSign, gradient: 'from-emerald-500 to-green-500' },
                  { label: 'Total Aprobado', value: formatCurrency(stats?.totals.total_received || 0), icon: TrendingUp, gradient: 'from-blue-500 to-indigo-500' },
                  { label: 'Total Consumido', value: formatCurrency(stats?.totals.total_spent || 0), icon: TrendingDown, gradient: 'from-amber-500 to-orange-500' },
                  { label: 'Becas', value: formatCurrency(stats?.totals.total_scholarships || 0), icon: Users, gradient: 'from-purple-500 to-violet-500' },
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

              {/* Transactions + Request Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6 fluid-mb-6">
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

                {/* Request Status Summary */}
                <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
                  <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                      <PieChart className="fluid-icon-sm text-emerald-500" />
                      Solicitudes por Estado
                    </h2>
                  </div>
                  <div className="fluid-p-5">
                    <div className="space-y-4">
                      {[
                        { label: 'Pendientes', value: stats?.requests.pending || 0, color: 'amber' },
                        { label: 'En Revisión', value: stats?.requests.in_review || 0, color: 'blue' },
                        { label: 'Esperando Aprobación', value: stats?.requests.awaiting_approval || 0, color: 'violet' },
                      ].map((item) => (
                        <div key={item.label} className={`fluid-p-4 bg-${item.color}-50/80 rounded-fluid-xl border border-${item.color}-200/60`}>
                          <div className="flex items-center justify-between">
                            <p className={`fluid-text-sm font-medium text-${item.color}-700`}>{item.label}</p>
                            <p className={`fluid-text-2xl font-bold text-${item.color}-700`}>{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top 5 preview + Export */}
              <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
                <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
                  <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                    <Users className="fluid-icon-sm text-purple-500" />
                    Top Coordinadores
                  </h2>
                  <div className="flex items-center fluid-gap-3">
                    <button
                      onClick={() => handleTabChange('coordinadores')}
                      className="fluid-text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                      Ver todos →
                    </button>
                    <button
                      onClick={exportCSV}
                      disabled={allCoordinators.length === 0}
                      className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-fluid-xl hover:from-emerald-600 hover:to-teal-600 transition-all fluid-text-xs font-medium disabled:opacity-50 hover:scale-[1.02]"
                    >
                      <Download className="fluid-icon-xs" /> CSV
                    </button>
                  </div>
                </div>
                <div className="fluid-p-5">
                  {allCoordinators.length === 0 ? (
                    <p className="text-center text-gray-400 fluid-text-sm fluid-py-6">Sin datos</p>
                  ) : (
                    <div className="space-y-3">
                      {allCoordinators.slice(0, 5).map((coord, i) => {
                        const maxBal = allCoordinators[0]?.totals.current_balance || 1;
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
                              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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

          {/* ===== TAB: COORDINADORES ===== */}
          {activeTab === 'coordinadores' && (
            <div className="animate-fade-in-up">
              {allCoordinators.length === 0 ? (
                <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-6 text-center">
                  <Users className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-3" />
                  <p className="fluid-text-lg text-gray-500">No hay coordinadores con saldo asignado</p>
                </div>
              ) : (
                <>
                  {/* Export bar */}
                  <div className="flex items-center justify-between fluid-mb-4">
                    <p className="fluid-text-sm text-gray-500">{allCoordinators.length} coordinadores</p>
                    <button
                      onClick={exportCSV}
                      className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-fluid-xl hover:from-emerald-600 hover:to-teal-600 transition-all fluid-text-sm font-medium hover:scale-[1.02] shadow-sm"
                    >
                      <Download className="fluid-icon-sm" /> Exportar CSV
                    </button>
                  </div>

                  {/* Full coordinator table */}
                  <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-emerald-50 to-teal-50">
                            <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                            <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Coordinador</th>
                            <th className="text-right fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo Actual</th>
                            <th className="text-right fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Recibido</th>
                            <th className="text-right fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Consumido</th>
                            <th className="text-right fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Becas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {allCoordinators.map((coord, i) => (
                            <tr key={coord.coordinator.id} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="fluid-px-4 fluid-py-3">
                                <span className={`fluid-w-6 fluid-h-6 rounded-full flex items-center justify-center fluid-text-xs font-bold text-white inline-flex ${
                                  i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-300'
                                }`}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="fluid-px-4 fluid-py-3">
                                <div className="flex items-center fluid-gap-3">
                                  <div className="fluid-w-8 fluid-h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white font-medium fluid-text-xs">{coord.coordinator.full_name[0]}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-800 fluid-text-sm">{coord.coordinator.full_name}</p>
                                    <p className="fluid-text-xs text-gray-500">{coord.coordinator.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="fluid-px-4 fluid-py-3 text-right font-semibold text-gray-800 fluid-text-sm">{formatCurrency(coord.totals.current_balance)}</td>
                              <td className="fluid-px-4 fluid-py-3 text-right fluid-text-sm text-emerald-600">{formatCurrency(coord.totals.total_received)}</td>
                              <td className="fluid-px-4 fluid-py-3 text-right fluid-text-sm text-amber-600">{formatCurrency(coord.totals.total_spent)}</td>
                              <td className="fluid-px-4 fluid-py-3 text-right fluid-text-sm text-purple-600">{formatCurrency(coord.totals.total_scholarships)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== TAB: DELEGAR ===== */}
          {activeTab === 'delegar' && (
            <div className="animate-fade-in-up">
              {/* Banner informativo */}
              <div className="bg-indigo-50/80 border border-indigo-200/60 rounded-fluid-2xl fluid-p-5 fluid-mb-6">
                <div className="flex items-start fluid-gap-3">
                  <Info className="fluid-icon-sm text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-indigo-800 fluid-text-sm">¿Cómo funcionan las delegaciones?</p>
                    <p className="fluid-text-xs text-indigo-600 fluid-mt-1 leading-relaxed">
                      Los financieros con delegación activada pueden aprobar solicitudes de saldo directamente sin necesidad de su aprobación. 
                      Los financieros sin delegación solo pueden recomendar aprobación o rechazo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
                <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 flex items-center fluid-gap-4">
                  <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-fluid-xl shadow-sm">
                    <Users className="fluid-icon-lg text-white" />
                  </div>
                  <div>
                    <p className="fluid-text-2xl font-bold text-gray-800">{financieros.length}</p>
                    <p className="fluid-text-xs text-gray-500 font-medium">Total Financieros</p>
                  </div>
                </div>
                <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 flex items-center fluid-gap-4">
                  <div className="fluid-p-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-fluid-xl shadow-sm">
                    <ShieldCheck className="fluid-icon-lg text-white" />
                  </div>
                  <div>
                    <p className="fluid-text-2xl font-bold text-gray-800">{delegatedCount}</p>
                    <p className="fluid-text-xs text-gray-500 font-medium">Con Delegación</p>
                  </div>
                </div>
                <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 flex items-center fluid-gap-4">
                  <div className="fluid-p-3 bg-gradient-to-br from-gray-400 to-gray-500 rounded-fluid-xl shadow-sm">
                    <ShieldOff className="fluid-icon-lg text-white" />
                  </div>
                  <div>
                    <p className="fluid-text-2xl font-bold text-gray-800">{financieros.length - delegatedCount}</p>
                    <p className="fluid-text-xs text-gray-500 font-medium">Solo Recomendación</p>
                  </div>
                </div>
              </div>

              {/* Financieros Grid */}
              {financieros.length === 0 ? (
                <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-6 text-center">
                  <Users className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-3" />
                  <p className="fluid-text-lg text-gray-500">No hay financieros registrados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 fluid-gap-4">
                  {financieros.map((fin) => (
                    <div
                      key={fin.id}
                      className={`bg-white rounded-fluid-2xl shadow-sm border overflow-hidden transition-all duration-300 hover:shadow-md ${
                        fin.can_approve_balance ? 'border-emerald-200 hover:border-emerald-300' : 'border-gray-200/80 hover:border-gray-300'
                      }`}
                    >
                      <div className={`h-1 ${fin.can_approve_balance ? 'bg-gradient-to-r from-emerald-400 to-green-400' : 'bg-gray-200'}`} />
                      <div className="fluid-p-5">
                        <div className="flex items-start justify-between fluid-mb-4">
                          <div className="flex items-center fluid-gap-3">
                            <div className={`fluid-w-10 fluid-h-10 rounded-full flex items-center justify-center font-semibold text-white fluid-text-sm ${
                              fin.can_approve_balance
                                ? 'bg-gradient-to-br from-emerald-500 to-green-500'
                                : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                              {(fin.full_name || fin.email || 'F')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 fluid-text-sm">{fin.full_name || 'Sin nombre'}</p>
                              <p className="fluid-text-xs text-gray-500 flex items-center fluid-gap-1">
                                <Mail className="fluid-icon-xs" /> {fin.email}
                              </p>
                            </div>
                          </div>

                          {/* Toggle */}
                          <button
                            onClick={() => handleToggle(fin.id, fin.can_approve_balance)}
                            disabled={togglingId === fin.id}
                            className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
                              fin.can_approve_balance ? 'bg-emerald-500' : 'bg-gray-300'
                            } ${togglingId === fin.id ? 'opacity-50' : ''}`}
                          >
                            <div
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                                fin.can_approve_balance ? 'translate-x-6' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <div className={`fluid-px-3 fluid-py-2 rounded-fluid-xl fluid-text-xs font-medium ${
                          fin.can_approve_balance
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-gray-50 text-gray-500 border border-gray-200/60'
                        }`}>
                          {fin.can_approve_balance ? (
                            <span className="flex items-center fluid-gap-1"><ShieldCheck className="fluid-icon-xs" /> Puede aprobar directamente</span>
                          ) : (
                            <span className="flex items-center fluid-gap-1"><ShieldOff className="fluid-icon-xs" /> Solo puede recomendar</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
