/**
 * Servicio de pagos en línea (Mercado Pago)
 */
import api from './api';

export interface CheckoutResponse {
  payment_id: number;
  preference_id: string;
  init_point: string;
  sandbox_init_point: string;
  checkout_url: string;
}

export interface PaymentRecord {
  id: number;
  user_id: string;
  campus_id: number;
  units: number;
  unit_price: number;
  total_amount: number;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  mp_status_detail: string | null;
  mp_payment_method: string | null;
  mp_payment_type: string | null;
  mp_external_reference: string | null;
  status: string;
  status_label: string;
  credits_applied: boolean;
  credits_applied_at: string | null;
  created_at: string;
  updated_at: string;
  campus: { id: number; name: string } | null;
}

export interface MyPaymentsResponse {
  payments: PaymentRecord[];
  total: number;
  page: number;
  per_page: number;
}

export async function createCheckout(units: number): Promise<CheckoutResponse> {
  const response = await api.post('/payments/checkout', { units });
  return response.data;
}

export async function getPaymentStatus(reference: string): Promise<PaymentRecord> {
  const response = await api.get(`/payments/status/${reference}`);
  return response.data;
}

export async function getMyPayments(params?: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<MyPaymentsResponse> {
  const response = await api.get('/payments/my-payments', { params });
  return response.data;
}

// ─── Pago directo con tokenización de tarjeta ───────────────────────────────

export interface CardData {
  card_number: string;
  expiration_month: string;
  expiration_year: string;
  security_code: string;
  cardholder: {
    name: string;
    identification?: {
      type: string;
      number: string;
    };
  };
}

export interface CardTokenResponse {
  id: string;
  first_six_digits: string;
  last_four_digits: string;
  expiration_month: number;
  expiration_year: number;
  status: string;
}

export interface PaymentMethodInfo {
  id: string;
  name: string;
  payment_type_id: string;
  thumbnail: string;
  secure_thumbnail: string;
}

export interface InstallmentOption {
  installments: number;
  installment_rate: number;
  total_amount: number;
  installment_amount: number;
  recommended_message: string;
}

export interface ProcessPaymentRequest {
  units: number;
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id?: string;
  payer_email: string;
}

export interface ProcessPaymentResponse {
  payment_id: number;
  status: string;
  mp_status: string;
  mp_status_detail: string;
  mp_payment_id: string;
  credits_applied: boolean;
}

function getMpPublicKey(): string {
  return import.meta.env.VITE_MP_PUBLIC_KEY || '';
}

/** Tokeniza datos de tarjeta llamando directamente a la API de MP desde el browser. */
export async function createCardToken(cardData: CardData): Promise<CardTokenResponse> {
  const publicKey = getMpPublicKey();
  const response = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.message || err.cause?.[0]?.description || 'Error al procesar los datos de la tarjeta'
    );
  }
  return response.json();
}

/** Identifica el tipo de tarjeta por los primeros 6 dígitos (BIN). */
export async function getPaymentMethods(bin: string): Promise<PaymentMethodInfo[]> {
  const publicKey = getMpPublicKey();
  const response = await fetch(
    `https://api.mercadopago.com/v1/payment_methods?public_key=${publicKey}&bin=${bin}`
  );
  if (!response.ok) return [];
  return response.json();
}

/** Obtiene opciones de cuotas para un monto y método de pago. */
export async function getInstallments(
  amount: number,
  paymentMethodId: string,
  issuerId?: string
): Promise<InstallmentOption[]> {
  const publicKey = getMpPublicKey();
  let url = `https://api.mercadopago.com/v1/payment_methods/installments?public_key=${publicKey}&amount=${amount}&payment_method_id=${paymentMethodId}`;
  if (issuerId) url += `&issuer.id=${issuerId}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data[0]?.payer_costs || [];
}

/** Procesa un pago directo con token a través de nuestro backend. */
export async function processPayment(data: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
  const response = await api.post('/payments/process', data);
  return response.data;
}
