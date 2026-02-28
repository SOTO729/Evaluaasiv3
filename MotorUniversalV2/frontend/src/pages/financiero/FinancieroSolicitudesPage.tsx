/**
 * Página de listado de solicitudes para el financiero
 * 
 * Permite:
 * - Ver todas las solicitudes pendientes
 * - Filtrar por estado y tipo
 * - Acceder al detalle para revisar
 * 
 * Diseño fluid responsive consistente con el resto del sitio
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
  DollarSign,
  Gift,
  ArrowRight,
  FileText,
  Banknote,

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
    ? 'bg-emerald-600' 
    : type === 'error' 
    ? 'bg-red-600' 
    : 'bg-blue-600';

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-fluid-xl shadow-lg ${bgColor} text-white`}>
        {type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
        {type === 'error' && <X className="w-5 h-5 flex-shrink-0" />}
        {type === 'info' && <FileText className="w-5 h-5 flex-shrink-0" />}
        <span className="font-medium text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-80 transition-opacity">
          <X className="w-4 h-4" />
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
  { value: 'cancelled', label: 'Canceladas' },
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
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <Link
                to="/financiero"
                className="fluid-p-2.5 bg-white/20 hover:bg-white/30 rounded-fluid-xl transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="fluid-icon-lg text-white" />
              </Link>
              <div>
                <h1 className="fluid-text-3xl font-bold text-white">Solicitudes de Saldo</h1>
                <p className="fluid-text-base text-white/80 fluid-mt-1">
                  Revisa y recomienda las solicitudes de los coordinadores
                </p>
              </div>
            </div>
            <div className="flex items-center fluid-gap-3 fluid-text-sm text-white/80">
              <span className="bg-white/15 fluid-px-3 fluid-py-1.5 rounded-full backdrop-blur-sm border border-white/20 font-medium">
                {total} solicitudes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BADGES DE ESTADO ===== */}
      <div className="flex flex-wrap fluid-gap-2 fluid-mb-4 animate-fade-in-up">
        <button
          onClick={() => updateParams('status', 'all_pending')}
          className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-full border transition-all duration-200 fluid-text-sm font-medium ${
            status === 'all_pending'
              ? 'bg-indigo-100 border-indigo-300 text-indigo-800 shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <Banknote className="fluid-icon-xs" />
          <span>Todas</span>
        </button>
        <button
          onClick={() => updateParams('status', 'pending')}
          className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-full border transition-all duration-200 fluid-text-sm font-medium ${
            status === 'pending'
              ? 'bg-yellow-100 border-yellow-300 text-yellow-800 shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <Clock className="fluid-icon-xs" />
          <span>Nuevas</span>
          <span className="bg-yellow-200 text-yellow-800 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-bold min-w-[22px] text-center">
            {stats.pending}
          </span>
        </button>
        <button
          onClick={() => updateParams('status', 'in_review')}
          className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-full border transition-all duration-200 fluid-text-sm font-medium ${
            status === 'in_review'
              ? 'bg-blue-100 border-blue-300 text-blue-800 shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <Filter className="fluid-icon-xs" />
          <span>En revisión</span>
          <span className="bg-blue-200 text-blue-800 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-bold min-w-[22px] text-center">
            {stats.in_review}
          </span>
        </button>
        <button
          onClick={() => updateParams('status', 'recommended_approve')}
          className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-full border transition-all duration-200 fluid-text-sm font-medium ${
            status === 'recommended_approve'
              ? 'bg-green-100 border-green-300 text-green-800 shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
          }`}
        >
          <CheckCircle2 className="fluid-icon-xs" />
          <span>Recomendadas</span>
          <span className="bg-green-200 text-green-800 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-bold min-w-[22px] text-center">
            {stats.recommended}
          </span>
        </button>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 fluid-p-4 fluid-mb-5 animate-fade-in-up">
        <div className="flex flex-wrap fluid-gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">Estado</label>
            <select
              value={status}
              onChange={(e) => updateParams('status', e.target.value)}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 fluid-text-sm bg-gray-50/50 transition-all"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider fluid-mb-1.5">Tipo</label>
            <select
              value={type}
              onChange={(e) => updateParams('type', e.target.value)}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 fluid-text-sm bg-gray-50/50 transition-all"
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

      {/* ===== TABLA DE RESULTADOS ===== */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200/80 overflow-hidden animate-fade-in-up">
        {loading ? (
          <div className="fluid-p-12 text-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <div className="fluid-p-12 text-center">
            <div className="fluid-p-4 bg-green-100 rounded-full inline-flex fluid-mb-4">
              <CheckCircle2 className="fluid-icon-xl text-green-500" />
            </div>
            <h3 className="fluid-text-lg font-medium text-gray-900">
              No hay solicitudes
            </h3>
            <p className="text-gray-500 fluid-mt-1 fluid-text-sm">
              No se encontraron solicitudes con los filtros seleccionados
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-12 gap-4 fluid-px-5 fluid-py-3 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">Coordinador</div>
              <div className="col-span-2">Plantel / Grupo</div>
              <div className="col-span-2">Monto</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-1">Fecha</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {requests.map((req, index) => (
                <Link
                  key={req.id}
                  to={`/financiero/solicitudes/${req.id}`}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 fluid-px-5 fluid-py-4 hover:bg-indigo-50/40 transition-all duration-200 items-center group"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {/* Coordinador */}
                  <div className="col-span-3 flex items-center fluid-gap-3">
                    <div className="fluid-w-10 fluid-h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-fluid-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <span className="text-indigo-600 font-semibold fluid-text-sm">
                        {req.coordinator?.full_name?.charAt(0) || 'C'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 fluid-text-sm truncate">
                        {req.coordinator?.full_name || 'Sin nombre'}
                      </p>
                      <p className="fluid-text-xs text-gray-500 truncate">
                        {req.coordinator?.email}
                      </p>
                    </div>
                  </div>

                  {/* Plantel / Grupo */}
                  <div className="col-span-2">
                    <div className="flex items-center fluid-gap-1.5">
                      <Building2 className="fluid-icon-xs text-gray-400 flex-shrink-0" />
                      <span className="text-gray-900 fluid-text-sm truncate">{req.campus?.name || 'Sin plantel'}</span>
                    </div>
                    {req.group && (
                      <div className="flex items-center fluid-gap-1.5 fluid-mt-0.5">
                        <Users className="fluid-icon-xs text-gray-400 flex-shrink-0" />
                        <span className="fluid-text-xs text-gray-500 truncate">{req.group.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Monto */}
                  <div className="col-span-2">
                    <p className="fluid-text-base font-bold text-gray-900">
                      {formatCurrency(req.amount_requested)}
                    </p>
                    {req.financiero_recommended_amount && req.financiero_recommended_amount !== req.amount_requested && (
                      <p className="fluid-text-xs text-blue-600 font-medium">
                        Rec: {formatCurrency(req.financiero_recommended_amount)}
                      </p>
                    )}
                  </div>

                  {/* Tipo */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-medium ${
                      req.request_type === 'beca'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {req.request_type === 'beca' ? <Gift className="fluid-icon-xs" /> : <DollarSign className="fluid-icon-xs" />}
                      {req.request_type_label}
                    </span>
                  </div>

                  {/* Estado */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center fluid-px-2.5 fluid-py-1 rounded-full fluid-text-xs font-medium ${getStatusColor(req.status)}`}>
                      {getStatusLabel(req.status)}
                    </span>
                  </div>

                  {/* Fecha */}
                  <div className="col-span-1 flex items-center justify-between">
                    <span className="fluid-text-xs text-gray-500">
                      {new Date(req.requested_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                    <ArrowRight className="fluid-icon-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="fluid-px-5 fluid-py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
                <p className="fluid-text-sm text-gray-500">
                  Mostrando <span className="font-medium text-gray-700">{requests.length}</span> de <span className="font-medium text-gray-700">{total}</span> solicitudes
                </p>
                <div className="flex items-center fluid-gap-2">
                  <button
                    onClick={() => updateParams('page', String(page - 1))}
                    disabled={page <= 1}
                    className="fluid-p-2 border border-gray-200 rounded-fluid-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="fluid-icon-sm" />
                  </button>
                  <span className="fluid-px-4 fluid-py-1.5 fluid-text-sm font-medium bg-white border border-gray-200 rounded-fluid-xl">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => updateParams('page', String(page + 1))}
                    disabled={page >= totalPages}
                    className="fluid-p-2 border border-gray-200 rounded-fluid-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="fluid-icon-sm" />
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
