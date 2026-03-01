/**
 * Página de Aprobaciones del Gerente
 * Listado de solicitudes de saldo con filtros y paginación
 */
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileCheck,
  ArrowLeft,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getRequestsForApproval,
  BalanceRequest,
  formatCurrency,
} from '../../services/balanceService';

type FilterStatus = 'all' | 'pending' | 'in_review' | 'recommended_approve' | 'recommended_reject';

/* ---- Toast Component ---- */
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const colors = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  };
  return (
    <div className={`fixed top-6 right-6 z-50 ${colors[type]} border rounded-fluid-xl fluid-p-4 shadow-lg flex items-center fluid-gap-3 max-w-md animate-fade-in-up`}>
      {type === 'success' ? <CheckCircle2 className="fluid-icon-sm text-green-600 flex-shrink-0" /> :
       type === 'error' ? <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0" /> :
       <Eye className="fluid-icon-sm text-blue-600 flex-shrink-0" />}
      <span className="fluid-text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose}><X className="fluid-icon-xs opacity-60 hover:opacity-100" /></button>
    </div>
  );
}

export default function GerenteApprovalsPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const perPage = 10;

  useEffect(() => {
    if (location.state?.message) {
      setToast({ message: location.state.message, type: location.state.type || 'success' });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => { loadData(); }, [currentPage, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, per_page: perPage };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const data = await getRequestsForApproval(params);
      setRequests(data.requests);
      setTotalRequests(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  const totalPages = Math.ceil(totalRequests / perPage);

  const getRecommendationBadge = (status: string) => {
    switch (status) {
      case 'recommended_approve':
        return (
          <span className="inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-semibold bg-green-100 text-green-700 border border-green-200/60">
            <ThumbsUp className="fluid-icon-xs" /> Aprobar
          </span>
        );
      case 'recommended_reject':
        return (
          <span className="inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-semibold bg-red-100 text-red-700 border border-red-200/60">
            <ThumbsDown className="fluid-icon-xs" /> Rechazar
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200/60">
            <Eye className="fluid-icon-xs" /> En revisión
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200/60">
            <Clock className="fluid-icon-xs" /> Pendiente
          </span>
        );
    }
  };

  const statusFilters: { value: FilterStatus; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: 'Todas', icon: <Filter className="fluid-icon-xs" /> },
    { value: 'pending', label: 'Pendientes', icon: <Clock className="fluid-icon-xs" /> },
    { value: 'in_review', label: 'En revisión', icon: <Eye className="fluid-icon-xs" /> },
    { value: 'recommended_approve', label: 'Recom. Aprobar', icon: <ThumbsUp className="fluid-icon-xs" /> },
    { value: 'recommended_reject', label: 'Recom. Rechazar', icon: <ThumbsDown className="fluid-icon-xs" /> },
  ];

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center fluid-gap-4">
            <Link to="/gerente" className="fluid-p-2 bg-white/15 rounded-fluid-lg hover:bg-white/25 transition-colors">
              <ArrowLeft className="fluid-icon-sm text-white" />
            </Link>
            <div className="fluid-p-3 bg-white/15 rounded-fluid-xl backdrop-blur-sm">
              <FileCheck className="fluid-icon-xl text-white" />
            </div>
            <div>
              <h1 className="fluid-text-3xl font-bold">Aprobaciones</h1>
              <p className="fluid-text-base text-white/80">{totalRequests} solicitudes encontradas</p>
            </div>
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

      {/* ===== FILTROS ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-5 fluid-mb-6">
        <div className="flex flex-col md:flex-row fluid-gap-4 items-start md:items-center">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex fluid-gap-2 flex-1 w-full md:w-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-xs text-gray-400" />
              <input
                type="text"
                placeholder="Buscar coordinador, plantel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 fluid-py-2 fluid-px-4 bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all"
              />
            </div>
            <button type="submit" className="fluid-px-4 fluid-py-2 bg-purple-600 text-white rounded-fluid-xl hover:bg-purple-700 transition-colors fluid-text-sm font-medium">
              Buscar
            </button>
          </form>

          {/* Pill Filters */}
          <div className="flex flex-wrap fluid-gap-2">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => { setStatusFilter(f.value); setCurrentPage(1); }}
                className={`inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 rounded-full fluid-text-xs font-medium transition-all duration-200 border ${
                  statusFilter === f.value
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== TABLA ===== */}
      {loading ? (
        <div className="flex justify-center fluid-py-6">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-fluid-2xl fluid-p-6 text-center">
          <AlertCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-3" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-6 text-center">
          <FileCheck className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-3" />
          <p className="fluid-text-lg text-gray-500">No hay solicitudes</p>
          <p className="fluid-text-sm text-gray-400 fluid-mt-1">Ajusta los filtros o vuelve más tarde</p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80">
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Coordinador</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Plantel / Grupo</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-right fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Recomendación</th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-purple-50/40 transition-colors">
                    <td className="fluid-px-4 fluid-py-3">
                      <div className="flex items-center fluid-gap-2">
                        <div className="fluid-w-8 fluid-h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-medium fluid-text-xs">
                            {(req.coordinator?.full_name || 'C')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-800 fluid-text-sm truncate">{req.coordinator?.full_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600">
                      <div className="flex items-center fluid-gap-1">
                        <Building2 className="fluid-icon-xs text-gray-400 flex-shrink-0" />
                        <span className="truncate">{req.campus?.name || '-'}</span>
                      </div>
                      {req.group?.name && (
                        <div className="flex items-center fluid-gap-1 fluid-mt-0.5 fluid-text-xs text-gray-400">
                          <Users className="fluid-icon-xs" />
                          <span className="truncate">{req.group.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 capitalize">
                      {(req.request_type || 'general').replace(/_/g, ' ')}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-right">
                      <p className="font-semibold text-gray-800 fluid-text-sm">{formatCurrency(req.amount_requested)}</p>
                      {req.financiero_recommended_amount && req.financiero_recommended_amount !== req.amount_requested && (
                        <p className="fluid-text-xs text-blue-600 fluid-mt-0.5">
                          Rec: {formatCurrency(req.financiero_recommended_amount)}
                        </p>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">{getRecommendationBadge(req.status)}</td>
                    <td className="fluid-px-4 fluid-py-3 text-center fluid-text-xs text-gray-500">
                      {new Date(req.requested_at).toLocaleDateString('es-MX')}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      <Link
                        to={`/gerente/aprobaciones/${req.id}`}
                        className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 bg-purple-50 text-purple-700 rounded-fluid-lg hover:bg-purple-100 transition-colors fluid-text-xs font-medium"
                      >
                        <Eye className="fluid-icon-xs" /> Revisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="fluid-px-4 fluid-py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
              <span className="fluid-text-xs text-gray-500">
                Página {currentPage} de {totalPages} ({totalRequests} total)
              </span>
              <div className="flex fluid-gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Primera
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="fluid-px-2.5 fluid-py-1 rounded-fluid-lg fluid-text-xs font-medium bg-white border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
