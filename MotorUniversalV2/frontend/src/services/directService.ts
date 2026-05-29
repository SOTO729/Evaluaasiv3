/**
 * Servicio del Modelo Directo (B2C):
 * - Catálogo público de exámenes (sin auth)
 * - Checkout self-service con MercadoPago
 */
import { api } from './api'

export interface DirectAddon {
  key: string
  label: string
  description: string
  price: number
  required: boolean
  icon?: string | null
}

export interface DirectExamCard {
  id: number
  title: string
  description?: string | null
  direct_sale_description?: string | null
  direct_price_mxn: number | null
  is_free_sample: boolean
  is_public_catalog: boolean
  image_url?: string | null
  info_sheet_url?: string | null
  time_limit_minutes?: number | null
  total_questions?: number | null
}

export interface DirectCheckoutCustomer {
  email: string
  name: string
  first_surname: string
  second_surname?: string
  phone?: string
  password?: string
  curp?: string
}

export interface DirectCheckoutResult {
  payment_id?: number
  preference_id?: string
  init_point?: string
  sandbox_init_point?: string
  checkout_url?: string
  external_reference?: string
  free_sample?: boolean
  user: {
    id: string
    email: string
    created: boolean
    temp_password?: string | null
  }
  exam: { id: number; title: string }
  message?: string
}

export interface DirectPaymentStatus {
  status: string
  mp_status?: string | null
  credits_applied: boolean
  payment_type: string
  group_exam_id?: number | null
}

export interface DirectBundleLineItem {
  key: string
  label: string
  description?: string
  unit_price: number
  quantity: number
  subtotal: number
}

export interface DirectBundleCheckoutResult {
  payment_id?: number
  preference_id?: string
  init_point?: string
  sandbox_init_point?: string
  checkout_url?: string
  external_reference?: string
  user: {
    id: string
    email: string
    created: boolean
    temp_password?: string | null
  }
  exams: Array<{ id: number; title: string }>
  addons: string[]
  line_items: DirectBundleLineItem[]
  total_amount: number
  units: number
}

export const directService = {
  async listCatalog(q?: string): Promise<DirectExamCard[]> {
    const params: Record<string, string> = {}
    if (q) params.q = q
    const { data } = await api.get('/direct/catalog', { params })
    return data.exams || []
  },

  async getCatalogExam(examId: number): Promise<DirectExamCard> {
    const { data } = await api.get(`/direct/catalog/${examId}`)
    return data.exam
  },

  async checkout(examId: number, customer?: DirectCheckoutCustomer): Promise<DirectCheckoutResult> {
    // Si hay JWT, el backend reutiliza el usuario autenticado y customer es opcional.
    const body: Record<string, unknown> = { exam_id: examId }
    if (customer) body.customer = customer
    const { data } = await api.post('/direct/checkout', body)
    return data
  },

  async checkoutBundle(examIds: number[], addons: string[], customer?: DirectCheckoutCustomer, curp?: string): Promise<DirectBundleCheckoutResult> {
    const body: Record<string, unknown> = { exam_ids: examIds, addons }
    if (customer) body.customer = customer
    if (curp) body.curp = curp
    const { data } = await api.post('/direct/checkout-bundle', body)
    return data
  },

  /**
   * Cobro embebido con token de tarjeta MP (sin redirigir al usuario).
   * Requiere usuario autenticado.
   */
  async payBundle(payload: {
    exam_ids: number[]
    addons: string[]
    token: string
    payment_method_id: string
    installments: number
    issuer_id?: string
    payer_email?: string
    curp?: string
  }): Promise<{
    payment_id: number
    status: string
    mp_status: string
    mp_status_detail: string
    mp_payment_id: string
    credits_applied: boolean
    exam_ids: number[]
    addons: string[]
    line_items: DirectBundleLineItem[]
    total_amount: number
    units: number
  }> {
    const { data } = await api.post('/direct/pay-bundle', payload)
    return data
  },

  async listAddons(): Promise<DirectAddon[]> {
    const { data } = await api.get('/direct/addons')
    return data.addons || []
  },

  async getPaymentStatus(externalRef: string): Promise<DirectPaymentStatus> {
    const { data } = await api.get('/direct/payment-status', { params: { ref: externalRef } })
    return data
  },

  async myPurchases() {
    const { data } = await api.get('/direct/my-purchases')
    return data.purchases || []
  },

  async getMetrics(): Promise<DirectMetrics> {
    const { data } = await api.get('/direct/metrics')
    return data
  },

  // === Ficha informativa (Conoce más) — admin/editor/coordinator ===
  async uploadInfoSheet(examId: number, file: File): Promise<{ info_sheet_url: string }> {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post(`/exams/${examId}/info-sheet`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async deleteInfoSheet(examId: number): Promise<void> {
    await api.delete(`/exams/${examId}/info-sheet`)
  },
}

export interface DirectMetrics {
  revenue: { today: number; week: number; month: number; total: number }
  payments: { approved: number; pending: number; rejected: number; total: number }
  top_exams: Array<{ exam_id: number; title: string; sold: number; revenue: number }>
  registrations_by_day: Array<{ date: string; count: number }>
  conversion: { paying_users: number; registered_users: number; rate_pct: number }
  catalog: { paid_published: number; free_samples: number; draft_with_price: number }
  generated_at: string
}
