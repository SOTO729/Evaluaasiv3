/**
 * Página de Historial de Solicitudes - Coordinador
 * 
 * Lista completa de solicitudes realizadas por el coordinador
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  RefreshCw,
  DollarSign,
  Gift,
  Building2,
  Users,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getMyRequests,
  BalanceRequest,
  RequestStatus,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
} from '../../services/balanceService';

export default function HistorialSolicitudesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const perPage = 10;

  useEffect(() => {
    loadRequests();
  }, [currentPage, statusFilter, typeFilter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getMyRequests({
        page: currentPage,
        per_page: perPage,
        status: (statusFilter || undefined) as RequestStatus | undefined,
        request_type: (typeFilter || undefined) as any,
      });

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
    await loadRequests();
    setRefreshing(false);
  };

  const totalPages = Math.ceil(totalRequests / perPage);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'in_review':
      case 'recommended_approve':
      case 'recommended_reject':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
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
              <FileText className="w-8 h-8 text-blue-600" />
              Historial de Solicitudes
            </h1>
            <p className="text-gray-600 mt-1">
              Todas tus solicitudes de saldo y becas
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

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="in_review">En revisión</option>
              <option value="recommended_approve">Recomendada aprobar</option>
              <option value="recommended_reject">Recomendada rechazar</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="saldo">Saldo</option>
            <option value="beca">Beca</option>
          </select>
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
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            No hay solicitudes
          </h3>
          <p className="text-gray-500 mb-4">
            {statusFilter || typeFilter 
              ? 'No se encontraron solicitudes con los filtros seleccionados'
              : 'Aún no has realizado ninguna solicitud'
            }
          </p>
          <Link
            to="/coordinador/solicitar-saldo"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Crear primera solicitud
          </Link>
        </div>
      ) : (
        <>
          {/* Solicitudes */}
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {/* Tipo */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        request.request_type === 'beca'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {request.request_type === 'beca' ? (
                          <Gift className="w-3 h-3" />
                        ) : (
                          <DollarSign className="w-3 h-3" />
                        )}
                        {request.request_type_label}
                      </span>

                      {/* Estado */}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        {getStatusLabel(request.status)}
                      </span>

                      {/* ID */}
                      <span className="text-xs text-gray-400">
                        #{request.id}
                      </span>
                    </div>

                    {/* Destino */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {request.campus && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {request.campus.name}
                        </span>
                      )}
                      {request.group && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          {request.group.name}
                        </span>
                      )}
                    </div>

                    {/* Justificación preview */}
                    {request.justification && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {request.justification}
                      </p>
                    )}

                    {/* Fecha */}
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Solicitado el {new Date(request.requested_at).toLocaleDateString()} 
                      {' '}a las {new Date(request.requested_at).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Montos */}
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">
                      {formatCurrency(request.amount_requested)}
                    </p>
                    <p className="text-xs text-gray-500">Solicitado</p>

                    {request.amount_approved !== null && (
                      <div className="mt-2">
                        <p className={`font-semibold ${
                          request.status === 'approved' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(request.amount_approved)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {request.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                        </p>
                      </div>
                    )}

                    {request.financiero_recommended_amount && request.status.includes('recommended') && (
                      <div className="mt-2">
                        <p className="font-medium text-blue-600">
                          {formatCurrency(request.financiero_recommended_amount)}
                        </p>
                        <p className="text-xs text-gray-500">Recomendado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notas del financiero */}
                {request.financiero_notes && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-1">Notas del área financiera:</p>
                    <p className="text-sm text-blue-800">{request.financiero_notes}</p>
                  </div>
                )}

                {/* Notas del aprobador */}
                {request.approver_notes && (
                  <div className={`mt-4 p-3 rounded-lg border ${
                    request.status === 'approved'
                      ? 'bg-green-50 border-green-100'
                      : 'bg-red-50 border-red-100'
                  }`}>
                    <p className={`text-xs font-medium mb-1 ${
                      request.status === 'approved' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {request.status === 'approved' ? 'Aprobado' : 'Rechazado'} por gerencia:
                    </p>
                    <p className={`text-sm ${
                      request.status === 'approved' ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {request.approver_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
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
