/**
 * CandidateCheckoutModal — Modal de pago para candidatos (certificación / retoma).
 * 2 pasos: 1) Datos de tarjeta  2) Resultado
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Lock,
} from 'lucide-react';
import {
  createCardToken,
  getPaymentMethods,
  getInstallments,
  candidatePay,
  candidateRetake,
  type CardData,
  type PaymentMethodInfo,
  type InstallmentOption,
  type CandidatePaymentResponse,
} from '../../services/paymentService';
import { useAuthStore } from '../../store/authStore';

interface CandidateCheckoutModalProps {
  isOpen: boolean;
  groupExamId: number;
  cost: number;
  paymentType: 'certification' | 'retake';
  examName?: string;
  onClose: () => void;
  onPaymentComplete: (result: CandidatePaymentResponse) => void;
}

const STATUS_DETAIL_MESSAGES: Record<string, string> = {
  accredited: 'Pago acreditado exitosamente.',
  pending_contingency: 'El pago está siendo procesado.',
  pending_review_manual: 'El pago está en revisión.',
  cc_rejected_bad_filled_card_number: 'Verifica el número de la tarjeta.',
  cc_rejected_bad_filled_date: 'Verifica la fecha de vencimiento.',
  cc_rejected_bad_filled_other: 'Verifica los datos ingresados.',
  cc_rejected_bad_filled_security_code: 'Verifica el código de seguridad.',
  cc_rejected_blacklist: 'No se pudo procesar el pago con esta tarjeta.',
  cc_rejected_call_for_authorize: 'Debes autorizar el pago con tu banco.',
  cc_rejected_card_disabled: 'La tarjeta está deshabilitada.',
  cc_rejected_card_error: 'No se pudo procesar el pago.',
  cc_rejected_duplicated_payment: 'Ya realizaste un pago por este monto.',
  cc_rejected_high_risk: 'Pago rechazado por seguridad.',
  cc_rejected_insufficient_amount: 'Fondos insuficientes.',
  cc_rejected_invalid_installments: 'La tarjeta no acepta ese número de cuotas.',
  cc_rejected_max_attempts: 'Demasiados intentos. Usa otra tarjeta.',
  cc_rejected_other_reason: 'No se pudo procesar. Intenta con otra tarjeta.',
};

const CARD_BRANDS: Record<string, string> = {
  visa: 'Visa',
  master: 'Mastercard',
  amex: 'American Express',
  debvisa: 'Visa Débito',
  debmaster: 'Mastercard Débito',
};

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export default function CandidateCheckoutModal({
  isOpen,
  groupExamId,
  cost,
  paymentType,
  examName,
  onClose,
  onPaymentComplete,
}: CandidateCheckoutModalProps) {
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<1 | 2>(1);
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [installments, setInstallments] = useState(1);
  const [cardBrand, setCardBrand] = useState<PaymentMethodInfo | null>(null);
  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);
  const [issuerId, setIssuerId] = useState<string | undefined>(undefined);
  const binRef = useRef('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CandidatePaymentResponse | null>(null);

  const label = paymentType === 'certification' ? 'Certificación' : 'Retoma';

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCardNumber('');
      setExpMonth('');
      setExpYear('');
      setCvv('');
      setCardholderName('');
      setEmail(user?.email || '');
      setInstallments(1);
      setCardBrand(null);
      setInstallmentOptions([]);
      setIssuerId(undefined);
      setProcessing(false);
      setError(null);
      setResult(null);
      binRef.current = '';
    }
  }, [isOpen, user?.email]);

  const detectCardBrand = useCallback(async (digits: string) => {
    const bin = digits.slice(0, 6);
    if (bin.length < 6 || bin === binRef.current) return;
    binRef.current = bin;
    try {
      const methods = await getPaymentMethods(bin);
      if (methods.length > 0) {
        setCardBrand(methods[0]);
        setIssuerId(undefined);
        const opts = await getInstallments(cost, methods[0].id);
        setInstallmentOptions(opts);
        if (opts.length > 0) setInstallments(opts[0].installments);
      } else {
        setCardBrand(null);
        setInstallmentOptions([]);
      }
    } catch { /* ignore */ }
  }, [cost]);

  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumber(value);
    setCardNumber(formatted);
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 6) detectCardBrand(digits);
    else { setCardBrand(null); setInstallmentOptions([]); binRef.current = ''; }
  };

  const validateForm = (): string | null => {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return 'Número de tarjeta inválido.';
    if (!luhnCheck(digits)) return 'Número de tarjeta inválido.';
    if (!expMonth || !expYear) return 'Selecciona la fecha de vencimiento.';
    const now = new Date();
    const expDate = new Date(parseInt(expYear), parseInt(expMonth), 0);
    if (expDate < now) return 'La tarjeta está vencida.';
    if (cvv.length < 3 || cvv.length > 4) return 'CVV debe tener 3 o 4 dígitos.';
    if (!cardholderName.trim()) return 'Ingresa el nombre del titular.';
    if (!email.trim() || !email.includes('@')) return 'Ingresa un email válido.';
    return null;
  };

  const handlePay = async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    setProcessing(true);
    setError(null);

    try {
      const cardData: CardData = {
        card_number: cardNumber.replace(/\D/g, ''),
        expiration_month: expMonth,
        expiration_year: expYear,
        security_code: cvv,
        cardholder: { name: cardholderName.trim() },
      };

      const tokenResponse = await createCardToken(cardData);
      const payFn = paymentType === 'retake' ? candidateRetake : candidatePay;
      const paymentResult = await payFn({
        group_exam_id: groupExamId,
        token: tokenResponse.id,
        payment_method_id: cardBrand?.id || 'visa',
        installments,
        issuer_id: issuerId,
        payer_email: email.trim(),
      });

      setResult(paymentResult);
      setStep(2);
      onPaymentComplete(paymentResult);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Error al procesar el pago.';
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !processing && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fadeInUp" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-500" />
            Pagar {label}
          </h3>
          <button onClick={() => !processing && onClose()} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 pt-4">
          {/* ── Step 1: Card Form ───────────────────────────── */}
          {step === 1 && (
            <>
              {/* Payment summary */}
              <div className="bg-amber-50 rounded-xl p-4 mb-5 border border-amber-200">
                <p className="text-sm text-amber-700 mb-1">{label} — {examName || 'Examen'}</p>
                <p className="text-2xl font-bold text-amber-800">
                  ${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </p>
                {paymentType === 'certification' && (
                  <p className="text-xs text-amber-600 mt-1">Este pago cubre todos los intentos configurados para este examen.</p>
                )}
                {paymentType === 'retake' && (
                  <p className="text-xs text-amber-600 mt-1">Este pago te otorga un intento adicional.</p>
                )}
              </div>

              {/* Card number */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Número de tarjeta</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    disabled={processing}
                    maxLength={19}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm pr-20"
                  />
                  {cardBrand && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {CARD_BRANDS[cardBrand.id] || cardBrand.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                  <select value={expMonth} onChange={(e) => setExpMonth(e.target.value)} disabled={processing}
                    className="w-full px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">MM</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                  <select value={expYear} onChange={(e) => setExpYear(e.target.value)} disabled={processing}
                    className="w-full px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">AAAA</option>
                    {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CVV</label>
                  <input type="text" inputMode="numeric" placeholder="123" value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    disabled={processing} maxLength={4}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>

              {/* Cardholder name */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del titular</label>
                <input type="text" placeholder="Como aparece en la tarjeta" value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)} disabled={processing}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" placeholder="correo@ejemplo.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} disabled={processing}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>

              {/* Installments */}
              {installmentOptions.length > 1 && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cuotas</label>
                  <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} disabled={processing}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                    {installmentOptions.map((opt) => (
                      <option key={opt.installments} value={opt.installments}>
                        {opt.installments === 1
                          ? `1 pago de $${opt.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          : `${opt.installments} cuotas de $${opt.installment_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}${opt.installment_rate > 0 ? ` (Total: $${opt.total_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })})` : ''}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Pay button */}
              <button onClick={handlePay} disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all">
                {processing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Procesando pago...</>
                ) : (
                  <><CreditCard className="w-5 h-5" /> Pagar ${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                Pago seguro procesado por Mercado Pago. No almacenamos datos de tu tarjeta.
              </p>
            </>
          )}

          {/* ── Step 2: Result ──────────────────────────────── */}
          {step === 2 && result && (
            <div className="text-center py-4">
              {result.status === 'approved' ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">¡Pago exitoso!</h4>
                  <p className="text-gray-600 mb-1">
                    {paymentType === 'certification'
                      ? 'Tu certificación ha sido desbloqueada. Ya puedes iniciar el examen.'
                      : 'Tu retoma ha sido registrada. Ya puedes intentar de nuevo.'}
                  </p>
                  <p className="text-sm text-gray-400 mb-6">
                    {STATUS_DETAIL_MESSAGES[result.mp_status_detail] || 'Pago procesado correctamente.'}
                  </p>
                </>
              ) : result.status === 'processing' ? (
                <>
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-amber-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">Pago en proceso</h4>
                  <p className="text-gray-600 mb-1">Tu pago está siendo procesado. Se desbloqueará automáticamente cuando se confirme.</p>
                  <p className="text-sm text-gray-400 mb-6">
                    {STATUS_DETAIL_MESSAGES[result.mp_status_detail] || 'Te notificaremos cuando se confirme.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">Pago rechazado</h4>
                  <p className="text-gray-600 mb-1">
                    {STATUS_DETAIL_MESSAGES[result.mp_status_detail] || 'No se pudo procesar el pago. Intenta con otra tarjeta.'}
                  </p>
                  <p className="text-sm text-gray-400 mb-6">Puedes intentar nuevamente.</p>
                </>
              )}

              <button onClick={onClose}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-lg transition-all">
                {result.status === 'approved' ? 'Continuar' : 'Entendido'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
