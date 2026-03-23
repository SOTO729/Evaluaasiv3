/**
 * Página de Mis Pagos - Responsable de Plantel
 *
 * Historial de pagos en línea (Mercado Pago) + iniciar nuevo checkout.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CreditCard,
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import CheckoutForm from '../../components/payments/CheckoutForm';
import { getMyCampusBalance, MyCampusBalanceResponse } from '../../services/balanceService';
import { getMyPayments, PaymentRecord } from '../../services/paymentService';

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; Icon: typeof Clock }> = {
  pending:   { label: 'Pendiente',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  Icon: Clock },
  approved:  { label: 'Aprobado',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   Icon: CheckCircle2 },
  rejected:  { label: 'Rechazado',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       Icon: XCircle },
  cancelled: { label: 'Cancelado',   color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',     Icon: XCircle },
  refunded:  { label: 'Reembolsado', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     Icon: RefreshCw },
  in_process:{ label: 'En proceso',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     Icon: Loader2 },
};

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.pending;
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label || cfg.label}
    </span>
  );
}

export default function MisPagosPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Campus / balance data (for checkout pricing)
  const [campusData, setCampusData] = useState<MyCampusBalanceResponse | null>(null);
  const [campusLoading, setCampusLoading] = useState(true);

  // Payments list
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false);

  // Payment return banner
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  // Handle ?payment=success|failure|pending from MP redirect
  useEffect(() => {
    const ps = searchParams.get('payment');
    if (ps) {
      setPaymentStatus(ps);
      searchParams.delete('payment');
      searchParams.delete('ref');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Load campus data for checkout pricing
  useEffect(() => {
    getMyCampusBalance()
      .then(d => setCampusData(d))
      .catch(() => {})
      .finally(() => setCampusLoading(false));
  }, []);

  // Load payments
  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const res = await getMyPayments({
        page,
        per_page: perPage,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setPayments(res.payments);
      setTotal(res.total);
    } catch (err: any) {
      setPaymentsError(err.response?.data?.error || 'Error al cargar pagos');
    } finally {
      setPaymentsLoading(false);
    }
  }, [page, perPage, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const campus = campusData?.campus;
  const canPay = campus?.enable_online_payments && (campus?.certification_cost ?? 0) > 0;

  // Summary stats
  const approvedPayments = payments.filter(p => p.status === 'approved');
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'in_process');

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fadeInDown">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary-600" />
            Mis Pagos
          </h1>
          <p className="text-gray-600 mt-1">
            Historial de pagos en línea{campus ? ` — ${campus.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPayments}
            disabled={paymentsLoading}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${paymentsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          {canPay && (
            <button
              onClick={() => setShowCheckout(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors shadow-lg"
            >
              <ShoppingCart className="w-5 h-5" />
              Comprar Vouchers
            </button>
          )}
        </div>
      </div>

      {/* Payment return banners */}
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

      {/* Summary cards */}
      {!paymentsLoading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-fadeInUp">
          <div className="bg-white rounded-xl p-4 border shadow-sm text-center">
            <p className="text-xs text-gray-500 mb-1">Total pagos</p>
            <p className="text-2xl font-bold text-gray-800">{total}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
            <p className="text-xs text-green-700 mb-1">Aprobados</p>
            <p className="text-2xl font-bold text-green-800">{approvedPayments.length}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-center">
            <p className="text-xs text-amber-700 mb-1">Pendientes</p>
            <p className="text-2xl font-bold text-amber-800">{pendingPayments.length}</p>
          </div>
          <div className="bg-primary-50 rounded-xl p-4 border border-primary-200 text-center">
            <p className="text-xs text-primary-700 mb-1">Precio unitario</p>
            <p className="text-2xl font-bold text-primary-800">
              {campus ? `$${campus.certification_cost}` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobado</option>
          <option value="rejected">Rechazado</option>
          <option value="cancelled">Cancelado</option>
          <option value="in_process">En proceso</option>
          <option value="refunded">Reembolsado</option>
        </select>
        <span className="text-sm text-gray-500">{total} pago{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Payments list */}
      {paymentsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{paymentsError}</p>
        </div>
      )}

      {paymentsLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-12 text-center animate-fadeInUp">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Sin pagos registrados</h3>
          <p className="text-gray-400 mb-6">
            {statusFilter ? 'No hay pagos con este filtro.' : 'Aún no has realizado pagos en línea.'}
          </p>
          {canPay && !statusFilter && (
            <button
              onClick={() => setShowCheckout(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium text-sm hover:bg-primary-700"
            >
              <ShoppingCart className="w-4 h-4" /> Comprar Vouchers
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3 animate-fadeInUp">
          {payments.map(p => {
            const date = new Date(p.created_at);
            return (
              <div key={p.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <StatusBadge status={p.status} label={p.status_label} />
                      <span className="text-xs text-gray-400">
                        {date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {' '}
                        {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {p.credits_applied && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Acreditado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-2xl font-bold text-gray-800">{p.units}</span>
                        <span className="text-sm text-gray-500 ml-1">voucher{p.units !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium text-gray-700">${p.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> MXN
                        <span className="text-xs text-gray-400 ml-1">({p.units} × ${p.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })})</span>
                      </div>
                    </div>

                    {p.mp_payment_method && (
                      <p className="text-xs text-gray-400 mt-1">
                        Método: {p.mp_payment_method} {p.mp_payment_type ? `(${p.mp_payment_type})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span className="text-xs text-gray-400 font-mono">#{p.id}</span>
                    {p.mp_external_reference && (
                      <span className="text-xs text-gray-300 font-mono truncate max-w-[120px]" title={p.mp_external_reference}>
                        {p.mp_external_reference.slice(0, 12)}...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================== CheckoutForm ==================== */}
      {campus && canPay && (
        <CheckoutForm
          isOpen={showCheckout}
          campusName={campus.name}
          certificationCost={campus.certification_cost}
          onClose={() => setShowCheckout(false)}
          onPaymentComplete={() => {
            setShowCheckout(false);
            loadPayments();
          }}
        />
      )}
    </div>
  );
}
