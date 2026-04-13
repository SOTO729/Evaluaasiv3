/**
 * CandidateCheckoutModal — Modal de pago para candidatos (certificación / retoma).
 * Diseño premium con paleta dinámica del campus.
 * 2 pasos: 1) Datos de tarjeta  2) Resultado
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  X,
  AlertCircle,
  Loader2,
  Clock,
  XCircle,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  BookOpen,
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

const CARD_LOGOS: Record<string, string> = {
  visa: '/images/cards/visa.webp',
  master: '/images/cards/mastercard.webp',
  amex: '/images/cards/amex.webp',
  debvisa: '/images/cards/visa.webp',
  debmaster: '/images/cards/mastercard.webp',
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
        // Detectar marca por BIN range (la API de MP devuelve todos los métodos sin filtrar)
        let detectedId = '';
        if (/^4/.test(bin)) {
          detectedId = 'visa';
        } else if (/^(5[1-5]|2[2-7])/.test(bin)) {
          detectedId = 'master';
        } else if (/^3[47]/.test(bin)) {
          detectedId = 'amex';
        }

        const matched = methods.find((m) => m.id === detectedId) || methods.find((m) => ['visa', 'master', 'amex'].includes(m.id)) || methods[0];
        setCardBrand(matched);
        const instResult = await getInstallments(cost, matched.id);
        setIssuerId(instResult.issuer_id);
        setInstallmentOptions(instResult.payer_costs);
        if (instResult.payer_costs.length > 0) setInstallments(instResult.payer_costs[0].installments);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-xl w-full max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col animate-fadeInUp">
        {/* Header con gradiente de la paleta */}
        <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 flex-shrink-0">
          <button
            onClick={() => !processing && onClose()}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {step === 2 && result?.status !== 'approved' && (
            <button
              onClick={() => { setStep(1); setError(null); setResult(null); }}
              className="absolute top-3 left-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Pagar {label}</h3>
              <p className="text-white/70 text-xs line-clamp-1">{examName || 'Examen'}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Step 1: Card Form ───────────────────────────── */}
          {step === 1 && (
            <div className="p-4 sm:p-6">
              {/* Monto */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl p-4 mb-5 border border-primary-200/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">
                      Total a pagar
                    </p>
                    <p className="text-2xl font-extrabold text-primary-700">
                      ${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-primary-500 ml-1">MXN</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                {paymentType === 'certification' && (
                  <p className="text-[10px] text-primary-500 mt-1">Cubre todos los intentos configurados para este examen.</p>
                )}
                {paymentType === 'retake' && (
                  <p className="text-[10px] text-primary-500 mt-1">Este pago te otorga un intento adicional.</p>
                )}
              </div>

              {/* Card number */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Número de tarjeta</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    name="cardnumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    disabled={processing}
                    maxLength={19}
                    className="w-full pl-10 pr-24 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors"
                  />
                  {cardBrand && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
                      {CARD_LOGOS[cardBrand.id] ? (
                        <img src={CARD_LOGOS[cardBrand.id]} alt={CARD_BRANDS[cardBrand.id] || cardBrand.name} className="h-8 w-auto object-contain" />
                      ) : (
                        <span className="text-[10px] font-bold text-primary-600 px-2 py-1">{CARD_BRANDS[cardBrand.id] || cardBrand.name}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Expiry + CVV */}
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mes</label>
                  <select value={expMonth} onChange={(e) => setExpMonth(e.target.value)} disabled={processing}
                    autoComplete="cc-exp-month" name="cc-exp-month"
                    className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors appearance-none">
                    <option value="">MM</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Año</label>
                  <select value={expYear} onChange={(e) => setExpYear(e.target.value)} disabled={processing}
                    autoComplete="cc-exp-year" name="cc-exp-year"
                    className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors appearance-none">
                    <option value="">AA</option>
                    {years.map((y) => <option key={y} value={String(y)}>{String(y).slice(-2)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">CVV</label>
                  <input type="text" inputMode="numeric" autoComplete="cc-csc" name="cvc" placeholder="123" value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    disabled={processing} maxLength={4}
                    className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors text-center tracking-widest" />
                </div>
              </div>

              {/* Cardholder name */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre del titular</label>
                <input type="text" autoComplete="cc-name" name="ccname" placeholder="Como aparece en la tarjeta" value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)} disabled={processing}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors" />
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email del pagador</label>
                <input type="email" autoComplete="email" name="email" placeholder="correo@ejemplo.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} disabled={processing}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors" />
              </div>

              {/* Installments */}
              {installmentOptions.length > 1 && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cuotas</label>
                  <select value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} disabled={processing}
                    className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors appearance-none">
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
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm">
                {processing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Procesando pago...</>
                ) : (
                  <><ShieldCheck className="w-5 h-5" /> Pagar ${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</>
                )}
              </button>

              <p className="text-[10px] text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Pago seguro procesado por Mercado Pago
              </p>
            </div>
          )}

          {/* ── Step 2: Result ──────────────────────────────── */}
          {step === 2 && result && (
            <div className="p-4 sm:p-6">
              {result.status === 'approved' ? (
                <div className="text-center py-6">
                  {/* Animated success circle */}
                  <div className="relative w-28 h-28 mx-auto mb-6">
                    {/* Confetti ring */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-200 via-green-100 to-teal-200 animate-confetti-burst" />
                    {/* Main circle */}
                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 animate-check-circle flex items-center justify-center">
                      <svg className="w-14 h-14" viewBox="0 0 40 40" fill="none">
                        <path d="M12 20.5L18 26.5L28 14.5" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="animate-check-stroke" />
                      </svg>
                    </div>
                  </div>

                  <h4 className="text-2xl font-extrabold text-gray-800 mb-2 animate-fade-in-up">¡Pago exitoso!</h4>

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <p className="text-emerald-800 text-sm font-medium mb-1">
                      {paymentType === 'certification'
                        ? 'Tu certificación ha sido desbloqueada'
                        : 'Tu retoma ha sido registrada'}
                    </p>
                    <p className="text-emerald-600 text-xs">
                      {paymentType === 'certification'
                        ? 'Ya puedes iniciar el examen cuando estés listo.'
                        : 'Ya puedes intentar de nuevo el examen.'}
                    </p>
                  </div>

                  {/* Payment receipt summary */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-2 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Examen</span>
                      <span className="text-gray-700 font-medium text-right max-w-[60%] truncate">{examName || 'Examen'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">Monto</span>
                      <span className="text-gray-700 font-bold">${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</span>
                    </div>
                    {cardBrand && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Método</span>
                        <span className="flex items-center gap-1.5">
                          {CARD_LOGOS[cardBrand.id] && <img src={CARD_LOGOS[cardBrand.id]} alt="" className="h-4 w-auto" />}
                          <span className="text-gray-700">{CARD_BRANDS[cardBrand.id] || cardBrand.name}</span>
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-200">
                      <span className="text-gray-500">Referencia</span>
                      <span className="text-gray-400 font-mono text-[10px]">#{result.mp_payment_id}</span>
                    </div>
                  </div>

                  {/* Study materials notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 flex items-start gap-2.5 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
                    <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-700 text-xs leading-relaxed">
                      Tu material de estudio ya está disponible en el módulo de <span className="font-semibold">Materiales de Estudio</span>. Te recomendamos revisarlo antes de presentar tu examen.
                    </p>
                  </div>

                  <button onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition-all text-sm animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                    <ArrowRight className="w-4 h-4" />
                    Continuar al examen
                  </button>
                </div>
              ) : result.status === 'processing' ? (
                <div className="text-center py-6">
                  <div className="w-24 h-24 mx-auto mb-5">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center ring-4 ring-amber-50 animate-check-circle">
                      <Clock className="w-11 h-11 text-amber-600" />
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">Pago en proceso</h4>
                  <p className="text-gray-600 text-sm mb-1">Tu pago está siendo procesado. Se desbloqueará automáticamente cuando se confirme.</p>
                  <p className="text-xs text-gray-400 mb-6">
                    {STATUS_DETAIL_MESSAGES[result.mp_status_detail] || 'Te notificaremos cuando se confirme.'}
                  </p>
                  <button onClick={onClose}
                    className="w-full px-5 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/20 transition-all text-sm">
                    Entendido
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-24 h-24 mx-auto mb-5">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center ring-4 ring-red-50 animate-check-circle">
                      <XCircle className="w-11 h-11 text-red-500" />
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">Pago rechazado</h4>
                  <p className="text-gray-600 text-sm mb-1">
                    {STATUS_DETAIL_MESSAGES[result.mp_status_detail] || 'No se pudo procesar el pago. Intenta con otra tarjeta.'}
                  </p>
                  <p className="text-xs text-gray-400 mb-6">Puedes intentar nuevamente.</p>
                  <button onClick={() => { setStep(1); setError(null); setResult(null); }}
                    className="w-full px-5 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-lg shadow-primary-600/20 transition-all text-sm">
                    Intentar de nuevo
                  </button>
                  <button onClick={onClose}
                    className="w-full mt-2 px-4 py-2 text-gray-500 hover:text-gray-700 text-xs transition-colors">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
