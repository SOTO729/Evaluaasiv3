/**
 * Página de Aprobaciones del Gerente
 * 
 * Lista de solicitudes recomendadas por el financiero
 * que requieren aprobación final del gerente/admin
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getRequestsForApproval,
  BalanceRequest,
  formatCurrency,
} from '../../services/balanceService';

type FilterStatus = 'all' | 'recommended_approve' | 'recommended_reject';

export default function GerenteApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const perPage = 10;

  useEffect(() => {
    loadRequests();
  }, [currentPage, statusFilter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getRequestsForApproval({
        page: currentPage,
        per_page: perPage,
        show_all: statusFilter === 'all',
      });

      // Filter by status if needed
      let filteredRequests = data.requests;
      if (statusFilter !== 'all') {
        filteredRequests = data.requests.filter(r => r.status === statusFilter);
      }

      setRequests(filteredRequests);
      setTotalRequests(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadRequests();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const totalPages = Math.ceil(totalRequests / perPage);

  const getRecommendationBadge = (status: string) => {
    if (status === 'recommended_approve') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
          <ThumbsUp className="w-3 h-3" />
          Recomienda Aprobar
        </span>
      );
    }
    if (status === 'recommended_reject') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
          <ThumbsDown className="w-3 h-3" />
          Recomienda Rechazar
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
        <Clock className="w-3 h-3" />
        Pendiente
      </span>
    );
  };

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
              <FileCheck className="w-8 h-8 text-purple-600" />
              Aprobaciones Pendientes
            </h1>
            <p className="text-gray-600 mt-1">
              Solicitudes recomendadas por el área financiera
            </p>
          </div>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por coordinador, plantel o grupo..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </form>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as FilterStatus);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todas las solicitudes</option>
              <option value="recommended_approve">Recomienda Aprobar</option>
              <option value="recommended_reject">Recomienda Rechazar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadRequests}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No hay solicitudes pendientes
          </h3>
          <p className="text-gray-500">
            Todas las solicitudes han sido procesadas
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coordinador
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plantel / Grupo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recomendación
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">
                          {request.coordinator?.full_name || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {request.coordinator?.email || ''}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">
                            {request.campus?.name || 'Sin plantel'}
                          </p>
                          {request.group && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Users className="w-3 h-3" />
                              {request.group.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        request.request_type === 'beca'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {request.request_type_label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(request.financiero_recommended_amount || request.amount_requested)}
                        </p>
                        {request.financiero_recommended_amount && request.financiero_recommended_amount !== request.amount_requested && (
                          <p className="text-xs text-gray-500 line-through">
                            {formatCurrency(request.amount_requested)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRecommendationBadge(request.status)}
                      {request.financiero && (
                        <p className="text-xs text-gray-500 mt-1">
                          Por: {request.financiero.full_name}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        <p>{new Date(request.requested_at).toLocaleDateString()}</p>
                        <p className="text-xs">
                          {new Date(request.requested_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        to={`/gerente/aprobaciones/${request.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Revisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Mostrando {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, totalRequests)} de {totalRequests}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
