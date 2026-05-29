/**
 * DirectCheckoutModal — Modal de pago embebido para el modelo Directo (B2C).
 * Permite al usuario pagar uno o varios exámenes del catálogo público con
 * tarjeta sin salir del sitio. Espejo de CandidateCheckoutModal adaptado a
 * bundles.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  X,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import {
  createCardToken,
  getPaymentMethods,
  getInstallments,
  type CardData,
  type PaymentMethodInfo,
  type InstallmentOption,
} from '../../services/paymentService';
import { directService } from '../../services/directService';
import { useAuthStore } from '../../store/authStore';
import Confetti from '../ui/Confetti';

export interface DirectCheckoutExam {
  id: number;
  title: string;
  price: number;
}

export interface DirectCheckoutResult {
  payment_id: number;
  status: string;
  mp_status: string;
  mp_status_detail: string;
  mp_payment_id: string;
  credits_applied: boolean;
  exam_ids: number[];
  total_amount: number;
}

interface DirectCheckoutModalProps {
  isOpen: boolean;
  exams: DirectCheckoutExam[];
  addons: string[];
  totalAmount: number;
  curp?: string;
  onClose: () => void;
  onPaymentComplete: (result: DirectCheckoutResult) => void;
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

export default function DirectCheckoutModal({
  isOpen,
  exams,
  addons,
  totalAmount,
  curp,
  onClose,
  onPaymentComplete,
}: DirectCheckoutModalProps) {
  const user = useAuthStore((s) => s.user);
  const cost = Number(totalAmount) || 0;

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
  const [result, setResult] = useState<DirectCheckoutResult | null>(null);

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
        let detectedId = '';
        if (/^4/.test(bin)) detectedId = 'visa';
        else if (/^(5[1-5]|2[2-7])/.test(bin)) detectedId = 'master';
        else if (/^3[47]/.test(bin)) detectedId = 'amex';

        const matched = methods.find((m) => m.id === detectedId)
          || methods.find((m) => ['visa', 'master', 'amex'].includes(m.id))
          || methods[0];
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
      const paymentResult = await directService.payBundle({
        exam_ids: exams.map((e) => e.id),
        addons,
        token: tokenResponse.id,
        payment_method_id: cardBrand?.id || 'visa',
        installments,
        issuer_id: issuerId,
        payer_email: email.trim(),
        curp: curp || undefined,
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

  const headerSubtitle = exams.length === 1
    ? exams[0].title
    : `${exams.length} certificaciones seleccionadas`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-xl w-full max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col animate-fadeInUp">
        {/* Header */}
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
              <h3 className="text-lg font-bold text-white">Pagar con tarjeta</h3>
              <p className="text-white/70 text-xs line-clamp-1">{headerSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Form */}
          {step === 1 && (
            <div className="p-4 sm:p-6">
              <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl p-4 mb-5 border border-primary-200/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Total a pagar</p>
                    <p className="text-2xl font-extrabold text-primary-700">
                      ${cost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-primary-500 ml-1">MXN</span>
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                <p className="text-[10px] text-primary-500 mt-1">
                  Acceso inmediato a {exams.length === 1 ? 'la certificación' : `las ${exams.length} certificaciones`}.
                </p>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Número de tarjeta</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text" inputMode="numeric" autoComplete="cc-number" name="cardnumber"
                    placeholder="1234 5678 9012 3456" value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)} disabled={processing} maxLength={19}
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

              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nombre del titular</label>
                <input type="text" autoComplete="cc-name" name="ccname" placeholder="Como aparece en la tarjeta" value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)} disabled={processing}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors" />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email del pagador</label>
                <input type="email" autoComplete="email" name="email" placeholder="correo@ejemplo.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} disabled={processing}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50 hover:bg-white transition-colors" />
              </div>

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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

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

          {/* Step 2: Result */}
          {step === 2 && result && (
            <div className="p-4 sm:p-6">
              {result.status === 'approved' && <Confetti count={140} duration={4.5} zIndex={70} />}
              {result.status === 'approved' ? (
                <div className="text-center py-6">
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full bg-emerald-300/40 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl flex items-center justify-center">
                      <CheckCircle2 className="w-16 h-16 text-white" />
                    </div>
                  </div>
                  <h4 className="text-2xl font-extrabold text-gray-800 mb-2">¡Pago exitoso!</h4>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                    <p className="text-emerald-800 text-sm font-medium mb-1">
                      Tus {exams.length === 1 ? 'examen está' : 'exámenes están'} desbloqueado{exams.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-emerald-600 text-xs">
                      Ya puedes acceder desde tu panel y comenzar cuando estés list@.
                    </p>
                  </div>
                  <button onClick={onClose}
                    className="w-full px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors">
                    Ir a mis exámenes
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-800 mb-2">Pago no completado</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {STATUS_DETAIL_MESSAGES[result.mp_status_detail] || 'No pudimos procesar el pago. Verifica los datos o usa otra tarjeta.'}
                  </p>
                  <button onClick={() => { setStep(1); setError(null); setResult(null); }}
                    className="w-full px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors">
                    Intentar de nuevo
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
