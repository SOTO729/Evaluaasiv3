/**
 * Dashboard del Módulo Financiero
 * 
 * Vista principal para el usuario tipo "financiero":
 * - Resumen de estadísticas con diseño fluid responsive
 * - Solicitudes pendientes de revisión
 * - Acceso rápido a módulos
 * - Gradiente header consistente con el resto del sitio
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
  TrendingDown,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Gift,
  BarChart3,
  ArrowUpRight,
  Building2,
  Banknote,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
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
  const user = useAuthStore((s) => s.user);
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
      <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 text-center">
          <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-4" />
          <h2 className="fluid-text-xl font-semibold text-red-800 fluid-mb-2">Error</h2>
          <p className="text-red-600 fluid-text-base">{error}</p>
          <button
            onClick={loadData}
            className="fluid-mt-4 fluid-px-4 fluid-py-2 bg-red-600 text-white rounded-fluid-xl hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const totalPending = (stats?.requests.pending || 0) + (stats?.requests.in_review || 0);

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <div className="fluid-p-3 bg-white/20 rounded-fluid-xl backdrop-blur-sm">
                <Banknote className="fluid-icon-xl text-white" />
              </div>
              <div>
                <h1 className="fluid-text-3xl font-bold text-white">Portal Financiero</h1>
                <p className="fluid-text-base text-white/80 fluid-mt-1">
                  Gestión de solicitudes de saldo, becas y reportes financieros
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 backdrop-blur-sm border border-white/20"
            >
              <RefreshCw className={`fluid-icon-sm ${refreshing ? 'animate-spin' : ''}`} />
              <span className="fluid-text-sm font-medium">Actualizar</span>
            </button>
          </div>

          {/* Mini Stats en el Header */}
          <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-3 fluid-mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <div className="flex items-center fluid-gap-2 fluid-mb-1">
                <Clock className="fluid-icon-xs text-yellow-300" />
                <span className="fluid-text-xs text-white/70">Pendientes</span>
              </div>
              <p className="fluid-text-2xl font-bold">{stats?.requests.pending || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <div className="flex items-center fluid-gap-2 fluid-mb-1">
                <FileText className="fluid-icon-xs text-blue-300" />
                <span className="fluid-text-xs text-white/70">En Revisión</span>
              </div>
              <p className="fluid-text-2xl font-bold">{stats?.requests.in_review || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <div className="flex items-center fluid-gap-2 fluid-mb-1">
                <CheckCircle2 className="fluid-icon-xs text-purple-300" />
                <span className="fluid-text-xs text-white/70">Por Aprobar</span>
              </div>
              <p className="fluid-text-2xl font-bold">{stats?.requests.awaiting_approval || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/20">
              <div className="flex items-center fluid-gap-2 fluid-mb-1">
                <Wallet className="fluid-icon-xs text-green-300" />
                <span className="fluid-text-xs text-white/70">Saldo Total</span>
              </div>
              <p className="fluid-text-lg font-bold">{formatCurrency(stats?.totals.current_balance || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delegation Banner */}
      {user?.can_approve_balance && (
        <div className="fluid-mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-fluid-2xl fluid-p-4 flex flex-col sm:flex-row items-start sm:items-center fluid-gap-3 animate-fade-in-up shadow-sm">
          <div className="fluid-p-2.5 bg-amber-100 rounded-fluid-xl">
            <ShieldCheck className="fluid-icon-lg text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 fluid-text-base">Aprobador Delegado Activo</p>
            <p className="fluid-text-sm text-amber-600">
              Tiene permisos para aprobar o rechazar solicitudes de saldo. Revise las solicitudes recomendadas.
            </p>
          </div>
          <Link
            to="/financiero/solicitudes?status=recommended_approve"
            className="fluid-px-4 fluid-py-2 bg-amber-600 text-white rounded-fluid-xl hover:bg-amber-700 fluid-text-sm font-medium whitespace-nowrap transition-all duration-300 hover:scale-105 shadow-sm"
          >
            Ver pendientes de aprobación
          </Link>
        </div>
      )}

      {/* ===== ACCIONES RÁPIDAS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
        <Link
          to="/financiero/solicitudes"
          className="group bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white rounded-fluid-2xl fluid-p-5 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] shadow-lg relative overflow-hidden"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full transition-transform group-hover:scale-125" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center fluid-gap-2 fluid-mb-2">
                <FileText className="fluid-icon-sm" />
                <h3 className="fluid-text-lg font-semibold">Revisar Solicitudes</h3>
              </div>
              <p className="text-indigo-100 fluid-text-sm">
                {totalPending} pendientes de revisión
              </p>
              {totalPending > 0 && (
                <span className="inline-flex items-center fluid-mt-2 fluid-px-2.5 fluid-py-1 bg-white/20 rounded-full fluid-text-xs font-medium backdrop-blur-sm">
                  Requiere atención
                </span>
              )}
            </div>
            <ArrowUpRight className="fluid-icon-lg opacity-60 group-hover:opacity-100 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
        </Link>

        <Link
          to="/financiero/coordinadores"
          className="group bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white rounded-fluid-2xl fluid-p-5 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] shadow-lg relative overflow-hidden"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full transition-transform group-hover:scale-125" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center fluid-gap-2 fluid-mb-2">
                <Users className="fluid-icon-sm" />
                <h3 className="fluid-text-lg font-semibold">Saldos por Coordinador</h3>
              </div>
              <p className="text-emerald-100 fluid-text-sm">
                {stats?.coordinators_with_balance || 0} con saldo activo
              </p>
            </div>
            <ArrowUpRight className="fluid-icon-lg opacity-60 group-hover:opacity-100 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
        </Link>

        <Link
          to="/financiero/reportes"
          className="group bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white rounded-fluid-2xl fluid-p-5 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] shadow-lg relative overflow-hidden"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full transition-transform group-hover:scale-125" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center fluid-gap-2 fluid-mb-2">
                <BarChart3 className="fluid-icon-sm" />
                <h3 className="fluid-text-lg font-semibold">Reportes</h3>
              </div>
              <p className="text-amber-100 fluid-text-sm">
                Estadísticas y análisis financiero
              </p>
            </div>
            <ArrowUpRight className="fluid-icon-lg opacity-60 group-hover:opacity-100 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
          </div>
        </Link>
      </div>

      {/* ===== CONTENIDO PRINCIPAL: 2 columnas ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 fluid-gap-6">
        {/* Solicitudes Recientes (2/3) */}
        <div className="xl:col-span-2 bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="fluid-p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-2 bg-indigo-100 rounded-fluid-xl">
                  <Clock className="fluid-icon-sm text-indigo-600" />
                </div>
                <div>
                  <h2 className="fluid-text-lg font-semibold text-gray-900">Solicitudes Recientes</h2>
                  <p className="fluid-text-xs text-gray-500">Últimas solicitudes pendientes de revisión</p>
                </div>
              </div>
              <Link
                to="/financiero/solicitudes"
                className="flex items-center fluid-gap-1 text-indigo-600 hover:text-indigo-700 fluid-text-sm font-medium transition-colors"
              >
                Ver todas
                <ArrowRight className="fluid-icon-xs" />
              </Link>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="fluid-p-10 text-center">
              <div className="fluid-p-4 bg-green-100 rounded-full inline-flex fluid-mb-4">
                <CheckCircle2 className="fluid-icon-xl text-green-500" />
              </div>
              <h3 className="fluid-text-lg font-medium text-gray-900">
                Todo al día
              </h3>
              <p className="text-gray-500 fluid-mt-1 fluid-text-sm">
                Todas las solicitudes han sido procesadas
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((req, index) => (
                <Link
                  key={req.id}
                  to={`/financiero/solicitudes/${req.id}`}
                  className="flex items-center justify-between fluid-p-4 hover:bg-gray-50/80 transition-all duration-200 group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center fluid-gap-4">
                    <div className={`fluid-p-2.5 rounded-fluid-xl transition-transform group-hover:scale-110 ${
                      req.request_type === 'beca' 
                        ? 'bg-purple-100' 
                        : 'bg-blue-100'
                    }`}>
                      {req.request_type === 'beca' 
                        ? <Gift className="fluid-icon-sm text-purple-600" />
                        : <DollarSign className="fluid-icon-sm text-blue-600" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 fluid-text-sm">
                        {req.coordinator?.full_name || 'Coordinador'}
                      </p>
                      <div className="flex items-center fluid-gap-2 fluid-mt-0.5">
                        <Building2 className="fluid-icon-xs text-gray-400" />
                        <p className="fluid-text-xs text-gray-500">
                          {req.campus?.name || 'Sin plantel'}
                        </p>
                        <span className="text-gray-300">•</span>
                        <p className="fluid-text-xs font-semibold text-gray-700">
                          {formatCurrency(req.amount_requested)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center fluid-gap-2">
                    <span className={`fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-medium ${getStatusColor(req.status)}`}>
                      {getStatusLabel(req.status)}
                    </span>
                    <span className={`fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium ${
                      req.request_type === 'beca' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {req.request_type_label}
                    </span>
                    <ArrowRight className="fluid-icon-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Resumen + Atajos (1/3) */}
        <div className="space-y-4">
          {/* Resumen de Saldos */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5">
            <div className="flex items-center fluid-gap-2 fluid-mb-4">
              <div className="fluid-p-1.5 bg-emerald-100 rounded-fluid-lg">
                <TrendingUp className="fluid-icon-xs text-emerald-600" />
              </div>
              <h3 className="fluid-text-base font-semibold text-gray-900">Resumen de Saldos</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between fluid-py-2 border-b border-gray-100">
                <div className="flex items-center fluid-gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="fluid-text-sm text-gray-600">Total Otorgado</span>
                </div>
                <span className="font-semibold text-gray-900 fluid-text-sm">
                  {formatCurrency(stats?.totals.total_received || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between fluid-py-2 border-b border-gray-100">
                <div className="flex items-center fluid-gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="fluid-text-sm text-gray-600">Total Utilizado</span>
                </div>
                <span className="font-semibold text-gray-900 fluid-text-sm">
                  {formatCurrency(stats?.totals.total_spent || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between fluid-py-2 border-b border-gray-100">
                <div className="flex items-center fluid-gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="fluid-text-sm text-gray-600">Becas Otorgadas</span>
                </div>
                <span className="font-semibold text-purple-600 fluid-text-sm">
                  {formatCurrency(stats?.totals.total_scholarships || 0)}
                </span>
              </div>
              <div className="fluid-pt-3 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 -mx-5 -mb-5 fluid-p-4 rounded-b-fluid-2xl border-t border-emerald-100">
                <div className="flex items-center fluid-gap-2">
                  <Wallet className="fluid-icon-sm text-emerald-600" />
                  <span className="text-gray-900 font-semibold fluid-text-sm">Saldo Disponible</span>
                </div>
                <span className="font-bold text-emerald-600 fluid-text-xl">
                  {formatCurrency(stats?.totals.current_balance || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5">
            <div className="flex items-center fluid-gap-2 fluid-mb-4">
              <div className="fluid-p-1.5 bg-blue-100 rounded-fluid-lg">
                <ArrowRight className="fluid-icon-xs text-blue-600" />
              </div>
              <h3 className="fluid-text-base font-semibold text-gray-900">Acciones Rápidas</h3>
            </div>
            <div className="fluid-gap-2 flex flex-col">
              <Link
                to="/financiero/solicitudes?status=pending"
                className="flex items-center justify-between fluid-p-3 bg-yellow-50 rounded-fluid-xl hover:bg-yellow-100 transition-all duration-200 group border border-yellow-100"
              >
                <div className="flex items-center fluid-gap-2.5">
                  <Clock className="fluid-icon-sm text-yellow-600" />
                  <span className="text-yellow-800 fluid-text-sm font-medium">Solicitudes nuevas</span>
                </div>
                <span className="bg-yellow-200 text-yellow-800 fluid-px-2.5 fluid-py-0.5 rounded-full fluid-text-xs font-bold min-w-[28px] text-center">
                  {stats?.requests.pending || 0}
                </span>
              </Link>
              <Link
                to="/financiero/solicitudes?type=beca"
                className="flex items-center justify-between fluid-p-3 bg-purple-50 rounded-fluid-xl hover:bg-purple-100 transition-all duration-200 group border border-purple-100"
              >
                <div className="flex items-center fluid-gap-2.5">
                  <Gift className="fluid-icon-sm text-purple-600" />
                  <span className="text-purple-800 fluid-text-sm font-medium">Solicitudes de beca</span>
                </div>
                <ArrowRight className="fluid-icon-xs text-purple-400 group-hover:text-purple-600 transition-colors" />
              </Link>
              <Link
                to="/financiero/coordinadores?low_balance=true"
                className="flex items-center justify-between fluid-p-3 bg-red-50 rounded-fluid-xl hover:bg-red-100 transition-all duration-200 group border border-red-100"
              >
                <div className="flex items-center fluid-gap-2.5">
                  <TrendingDown className="fluid-icon-sm text-red-600" />
                  <span className="text-red-800 fluid-text-sm font-medium">Saldo bajo</span>
                </div>
                <ArrowRight className="fluid-icon-xs text-red-400 group-hover:text-red-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
