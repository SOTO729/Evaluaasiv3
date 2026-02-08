/**
 * Página de listado de solicitudes para el financiero
 * 
 * Permite:
 * - Ver todas las solicitudes pendientes
 * - Filtrar por estado y tipo
 * - Acceder al detalle para revisar
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Filter,
  Clock,
  CheckCircle2,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

// Componente Toast para notificaciones
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' 
    ? 'bg-green-600' 
    : type === 'error' 
    ? 'bg-red-600' 
    : 'bg-blue-600';

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${bgColor} text-white`}>
        {type === 'success' && (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {type === 'error' && (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {type === 'info' && (
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-80 transition-opacity">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
import {
  getPendingRequests,
  BalanceRequest,
  RequestType,
  getStatusColor,
  getStatusLabel,
  formatCurrency,
} from '../../services/balanceService';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all_pending', label: 'Todas pendientes' },
  { value: 'pending', label: 'Nuevas' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'recommended_approve', label: 'Recomendadas aprobar' },
  { value: 'recommended_reject', label: 'Recomendadas rechazar' },
  { value: 'all', label: 'Todas' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'beca', label: 'Beca' },
];

export default function FinancieroSolicitudesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<BalanceRequest[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ pending: number; in_review: number; recommended: number }>({
    pending: 0,
    in_review: 0,
    recommended: 0,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const page = parseInt(searchParams.get('page') || '1');
  const status = searchParams.get('status') || 'all_pending';
  const type = searchParams.get('type') || '';

  // Mostrar toast si venimos de una accion exitosa
  useEffect(() => {
    if (location.state?.message) {
      setToast({
        message: location.state.message,
        type: location.state.type || 'success'
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleCloseToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    loadRequests();
  }, [page, status, type]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await getPendingRequests({
        page,
        per_page: 20,
        status: status as any,
        type: type as RequestType || undefined,
      });
      setRequests(data.requests);
      setTotalPages(data.pages);
      setTotal(data.total);
      setStats(data.stats);
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateParams = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 animate-fade-in-up">
        <Link
          to="/financiero"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Saldo</h1>
          <p className="text-gray-600">Revisa y recomienda las solicitudes de los coordinadores</p>
        </div>
      </div>

      {/* Stats Badges */}
      <div className="flex flex-wrap gap-3 mb-6 animate-fade-in-up">
        <button
          onClick={() => updateParams('status', 'pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
            status === 'pending'
              ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Nuevas</span>
          <span className="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium">
            {stats.pending}
          </span>
        </button>
        <button
          onClick={() => updateParams('status', 'in_review')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
            status === 'in_review'
              ? 'bg-blue-100 border-blue-300 text-blue-800'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>En revisión</span>
          <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
            {stats.in_review}
          </span>
        </button>
        <button
          onClick={() => updateParams('status', 'recommended_approve')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
            status === 'recommended_approve'
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Recomendadas</span>
          <span className="bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
            {stats.recommended}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 animate-fade-in-up">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => updateParams('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={type}
              onChange={(e) => updateParams('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
        {loading ? (
          <div className="p-12 text-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No hay solicitudes
            </h3>
            <p className="text-gray-500 mt-1">
              No se encontraron solicitudes con los filtros seleccionados
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b text-sm font-medium text-gray-500">
              <div className="col-span-3">Coordinador</div>
              <div className="col-span-2">Plantel / Grupo</div>
              <div className="col-span-2">Monto</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-1">Fecha</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  to={`/financiero/solicitudes/${req.id}`}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50 transition-colors items-center"
                >
                  {/* Coordinador */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-semibold">
                        {req.coordinator?.full_name?.charAt(0) || 'C'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {req.coordinator?.full_name || 'Sin nombre'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {req.coordinator?.email}
                      </p>
                    </div>
                  </div>

                  {/* Plantel / Grupo */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{req.campus?.name || 'Sin plantel'}</span>
                    </div>
                    {req.group && (
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">{req.group.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Monto */}
                  <div className="col-span-2">
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(req.amount_requested)}
                    </p>
                    {req.financiero_recommended_amount && req.financiero_recommended_amount !== req.amount_requested && (
                      <p className="text-sm text-blue-600">
                        Rec: {formatCurrency(req.financiero_recommended_amount)}
                      </p>
                    )}
                  </div>

                  {/* Tipo */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      req.request_type === 'beca'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {req.request_type_label}
                    </span>
                  </div>

                  {/* Estado */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                      {getStatusLabel(req.status)}
                    </span>
                  </div>

                  {/* Fecha */}
                  <div className="col-span-1 text-sm text-gray-500">
                    {new Date(req.requested_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Mostrando {requests.length} de {total} solicitudes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateParams('page', String(page - 1))}
                    disabled={page <= 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => updateParams('page', String(page + 1))}
                    disabled={page >= totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast de notificacion */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleCloseToast}
        />
      )}
    </div>
  );
}
