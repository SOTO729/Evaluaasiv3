/**
 * Página de Mis Vouchers - Responsable de Plantel
 *
 * Muestra los vouchers del plantel en UNIDADES + historial de solicitudes integrado.
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Wallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Award,
  Gift,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Paperclip,
  ChevronRight,
  Send,
  Eye,
  Loader2,
  CreditCard,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import CheckoutForm from '../../components/payments/CheckoutForm';
import {
  getMyCampusBalance,
  MyCampusBalanceResponse,
  getCertificateRequests,
  CertificateRequestData,
  CertificateRequestStatus,
} from '../../services/balanceService';

const STATUS_CONFIG: Record<CertificateRequestStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: Clock },
  seen: { label: 'Vista por coordinador', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Eye },
  modified: { label: 'Modificada', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200', icon: ClipboardList },
  approved_by_coordinator: { label: 'Aprobada por coordinador', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  rejected_by_coordinator: { label: 'Rechazada', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  forwarded: { label: 'En proceso de aprobación', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: Send },
  in_review: { label: 'En revisión financiera', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: Eye },
  approved: { label: 'Aprobada', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  rejected: { label: 'Rechazada', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
  resolved: { label: 'Resuelta', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', icon: CheckCircle2 },
};

function getSimplifiedStatus(status: CertificateRequestStatus): string {
  const map: Record<string, string> = {
    pending: 'Pendiente con coordinador',
    seen: 'Pendiente con coordinador',
    modified: 'En revisión de coordinador',
    approved_by_coordinator: 'Aprobada, en proceso',
    rejected_by_coordinator: 'Rechazada por coordinador',
    forwarded: 'En proceso de aprobación',
    in_review: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    resolved: 'Resuelta',
  };
  return map[status] || status;
}

export default function MiSaldoResponsablePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<MyCampusBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [requests, setRequests] = useState<CertificateRequestData[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);

  // Payment return banner
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    const ps = searchParams.get('payment');
    if (ps) {
      setPaymentStatus(ps);
      // Clean URL params
      searchParams.delete('payment');
      searchParams.delete('ref');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const result = await getMyCampusBalance();
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los vouchers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRequests = async () => {
    try {
      setRequestsError(null);
      const result = await getCertificateRequests();
      setRequests(result.requests);
    } catch (err: any) {
      setRequestsError(err.response?.data?.error || 'Error al cargar solicitudes');
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadRequests();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setRequestsLoading(true);
    loadData();
    loadRequests();
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

  if (!data) return null;

  const units = data.totals_units;
  const campus = data.campus;

  const usagePercent = units.total_received > 0
    ? Math.round((units.total_spent / units.total_received) * 100)
    : 0;

  const pendingCount = requests.filter(r => ['pending', 'seen', 'modified'].includes(r.status)).length;
  const approvedCount = requests.filter(r => ['approved', 'resolved', 'forwarded', 'approved_by_coordinator'].includes(r.status)).length;
  const rejectedCount = requests.filter(r => ['rejected', 'rejected_by_coordinator'].includes(r.status)).length;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fadeInDown">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Award className="w-8 h-8 text-primary-600" />
            Mis Vouchers
          </h1>
          <p className="text-gray-600 mt-1">
            Vouchers disponibles — {campus.name}
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

      {/* Payment return banner */}
      {paymentStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between animate-fadeInUp">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">Pago procesado correctamente. Los vouchers se acreditarán en breve.</p>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="p-1 hover:bg-green-100 rounded-lg"><X className="w-4 h-4 text-green-600" /></button>
        </div>
      )}
      {paymentStatus === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between animate-fadeInUp">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">Tu pago está pendiente de confirmación. Los vouchers se acreditarán cuando se confirme.</p>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="p-1 hover:bg-amber-100 rounded-lg"><X className="w-4 h-4 text-amber-600" /></button>
        </div>
      )}
      {paymentStatus === 'failure' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between animate-fadeInUp">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800 font-medium">El pago no pudo ser procesado. Puedes intentar de nuevo.</p>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="p-1 hover:bg-red-100 rounded-lg"><X className="w-4 h-4 text-red-600" /></button>
        </div>
      )}

      {/* Saldo Total Hero - en UNIDADES */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 text-white mb-8 shadow-xl animate-fadeInUp hover-lift">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-primary-100 text-sm font-medium mb-2">Vouchers Disponibles</p>
            <p className="text-5xl font-bold">
              {units.current_balance}
            </p>
            <p className="text-primary-100 mt-2 text-lg">
              vouchers
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex flex-col sm:flex-row gap-3">
            {campus.enable_online_payments && campus.certification_cost > 0 && (
              <button
                onClick={() => setShowCheckout(true)}
                className="flex items-center gap-2 px-5 py-3 bg-white text-primary-600 rounded-xl font-medium hover:bg-primary-50 transition-colors shadow-lg"
              >
                <CreditCard className="w-5 h-5" />
                Comprar Vouchers
              </button>
            )}
            <Link
              to="/solicitar-certificados"
              className="flex items-center gap-2 px-5 py-3 bg-white/20 text-white border border-white/40 rounded-xl font-medium hover:bg-white/30 transition-colors"
            >
              <Award className="w-5 h-5" />
              Solicitar Vouchers
            </Link>
          </div>
        </div>

        {/* Progress Bar */}
        {units.total_received > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm text-primary-100 mb-2">
              <span>Uso de vouchers</span>
              <span>{usagePercent}% consumido</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards en UNIDADES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-100 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Recibidas</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {units.total_received - units.total_scholarships}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers comprados</p>
        </div>

        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-200 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Becas</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">
            {units.total_scholarships}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers de beca</p>
        </div>

        <div className="bg-white rounded-xl p-5 border shadow-sm animate-fadeInUp delay-300 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-600">Consumidas</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">
            {units.total_spent}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers utilizados</p>
        </div>

        <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-5 border border-primary-200 shadow-sm animate-fadeInUp delay-400 hover-lift card-transition">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <WalletIcon className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-sm font-medium text-primary-700">Total Acreditado</span>
          </div>
          <p className="text-2xl font-bold text-primary-700">
            {units.total_received}
          </p>
          <p className="text-xs text-gray-500 mt-1">vouchers en total</p>
        </div>
      </div>

      {/* ==================== Sección Mis Solicitudes ==================== */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-primary-600" />
            Mis Solicitudes
          </h2>
          <Link
            to="/solicitar-certificados"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700 transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4" /> Nueva solicitud
          </Link>
        </div>

        {requestsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{requestsError}</p>
          </div>
        )}

        {/* Stats solicitudes */}
        {!requestsLoading && requests.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3 border shadow-sm text-center">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-800">{requests.length}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-center">
              <p className="text-xs text-amber-700">Pendientes</p>
              <p className="text-xl font-bold text-amber-800">{pendingCount}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 border border-green-200 text-center">
              <p className="text-xs text-green-700">Aprobadas</p>
              <p className="text-xl font-bold text-green-800">{approvedCount}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-center">
              <p className="text-xs text-red-700">Rechazadas</p>
              <p className="text-xl font-bold text-red-800">{rejectedCount}</p>
            </div>
          </div>
        )}

        {/* Lista de solicitudes */}
        {requestsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Sin solicitudes</h3>
            <p className="text-gray-400 mb-6">No has enviado ninguna solicitud de saldo aún.</p>
            <Link
              to="/solicitar-certificados"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" /> Crear primera solicitud
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              return (
                <div key={req.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusCfg.bgColor} ${statusCfg.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {getSimplifiedStatus(req.status)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-primary-600" />
                          <span className="font-bold text-lg text-gray-800">{req.units_requested}</span>
                          <span className="text-sm text-gray-500">unidades solicitadas</span>
                        </div>
                        {req.coordinator_units && req.coordinator_units !== req.units_requested && (
                          <div className="flex items-center gap-1 text-sm">
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-primary-700">{req.coordinator_units}</span>
                            <span className="text-gray-500">aprobadas</span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-2 mb-1">{req.justification}</p>

                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {req.campus && <span>{req.campus.name}</span>}
                        {req.group && <span>• {req.group.name}</span>}
                        {req.attachments && req.attachments.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            {req.attachments.length} archivo{req.attachments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {req.coordinator_notes && (
                        <div className="mt-2 bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                          <p className="text-xs text-gray-500 font-medium">Notas del coordinador:</p>
                          <p className="text-sm text-gray-700">{req.coordinator_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== CheckoutForm ==================== */}
      {data && (
        <CheckoutForm
          isOpen={showCheckout}
          campusName={campus.name}
          certificationCost={campus.certification_cost}
          onClose={() => setShowCheckout(false)}
          onPaymentComplete={() => {
            setShowCheckout(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
