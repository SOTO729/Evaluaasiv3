/**
 * Modal de confirmación cuando el fondo elegido (beca o saldo) no alcanza para
 * cubrir el total y se mezclará automáticamente con el otro fondo.
 *
 * Se muestra solo a coordinador/auxiliar (quienes eligen la fuente de pago)
 * antes de ejecutar el cobro, para que sepan exactamente cómo se repartirá.
 */
import { Wallet, AlertTriangle, X, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../services/balanceService';

interface PaymentMixConfirmModalProps {
  open: boolean;
  /** Fondo que eligió el usuario como prioridad. */
  prefer: 'beca' | 'saldo';
  /** Monto que saldrá de beca. */
  takeBeca: number;
  /** Monto que saldrá de saldo pagado. */
  takePaid: number;
  /** Costo total de la operación. */
  totalCost: number;
  /** Indica si la operación está en curso. */
  processing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PaymentMixConfirmModal({
  open,
  prefer,
  takeBeca,
  takePaid,
  totalCost,
  processing = false,
  onCancel,
  onConfirm,
}: PaymentMixConfirmModalProps) {
  if (!open) return null;

  const preferLabel = prefer === 'beca' ? 'beca' : 'saldo pagado';
  const otherLabel = prefer === 'beca' ? 'saldo pagado' : 'beca';
  const preferShort = prefer === 'beca' ? 'la beca' : 'el saldo pagado';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => !processing && onCancel()}
    >
      <div
        className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Se combinarán dos fondos</h2>
          </div>
          <button
            onClick={() => !processing && onCancel()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Elegiste pagar primero con <strong>{preferLabel}</strong>, pero {preferShort} no
            alcanza para cubrir el total. El resto se descontará automáticamente de tu{' '}
            <strong>{otherLabel}</strong>.
          </p>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-semibold text-indigo-700">Desglose del cobro</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Desde beca</span>
                <span className="font-bold text-indigo-700">{formatCurrency(takeBeca)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Desde saldo pagado</span>
                <span className="font-bold text-emerald-700">{formatCurrency(takePaid)}</span>
              </div>
              <hr className="border-indigo-200 my-1" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total</span>
                <span className="font-bold text-gray-900">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            ¿Deseas continuar con esta combinación?
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => !processing && onCancel()}
            disabled={processing}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {processing ? 'Procesando...' : 'Sí, continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}
