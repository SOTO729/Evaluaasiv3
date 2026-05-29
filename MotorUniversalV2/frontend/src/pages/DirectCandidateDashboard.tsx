/**
 * DirectCandidateDashboard — pantalla de bienvenida para candidatos del modelo
 * Directo (B2C). Se muestra cuando user.is_system_direct === true.
 *
 * Objetivos UX:
 *   1. Bienvenida amistosa que explica el modelo "compra y certifica".
 *   2. CTA principal: ir al catálogo de certificaciones.
 *   3. Listar exámenes ya adquiridos (acceso inmediato).
 *   4. Mostrar historial de compras (pagos pendientes/aprobados).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, Sparkles, GraduationCap, CheckCircle2, Clock,
  CreditCard, ArrowRight, FileText, ShieldCheck, Award, Layers,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { directService } from '../services/directService'
import { dashboardService, DashboardData } from '../services/dashboardService'

interface Purchase {
  id: number
  status: string
  mp_status?: string | null
  total_amount: number
  units: number
  payment_type: string
  is_bundle?: boolean
  created_at: string
  exam?: { id: number; title: string } | null
  exams?: Array<{ id: number; title: string }> | null
}

export default function DirectCandidateDashboard() {
  const { user } = useAuthStore()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      directService.myPurchases(),
      dashboardService.getDashboard().catch(() => null),
    ]).then(([pRes, dRes]) => {
      if (!alive) return
      if (pRes.status === 'fulfilled') setPurchases(pRes.value as Purchase[])
      if (dRes.status === 'fulfilled' && dRes.value) setDashboard(dRes.value as DashboardData)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const approvedPurchases = purchases.filter(p => p.status === 'approved')
  const pendingPurchases = purchases.filter(p => p.status === 'pending')

  // Exámenes únicos comprados (de pagos aprobados, considerando bundles)
  const purchasedExams = new Map<number, { id: number; title: string }>()
  for (const p of approvedPurchases) {
    if (p.exams && p.exams.length) {
      for (const e of p.exams) purchasedExams.set(e.id, e)
    } else if (p.exam) {
      purchasedExams.set(p.exam.id, p.exam)
    }
  }

  // Exámenes disponibles para presentar (del dashboard real — con acceso)
  const myExams = dashboard?.exams || []

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Hero de bienvenida */}
      <div className="rounded-fluid-xl fluid-p-8 text-white relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-600 to-purple-600">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3 text-blue-100">
            <Sparkles size={20} />
            <span className="font-medium">Modelo Directo — Compra y Certifícate</span>
          </div>
          <h1 className="fluid-text-4xl font-bold fluid-mb-3">
            ¡Bienvenido{user?.name ? `, ${user.name}` : ''}! 👋
          </h1>
          <p className="fluid-text-base text-blue-50 max-w-2xl mb-6">
            En Evaluaasi puedes certificar tus competencias en tres pasos simples:
            elige tu certificación en nuestro catálogo, paga de forma segura y
            preséntala en línea cuando estés listo. Tu certificado digital se
            emite al instante al aprobar.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/mi/catalogo"
              className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold px-6 py-3 rounded-lg shadow-lg transition"
            >
              <ShoppingCart size={20} />
              Explorar catálogo de certificaciones
              <ArrowRight size={18} />
            </Link>
            {myExams.length > 0 && (
              <Link
                to="/exams"
                className="inline-flex items-center gap-2 bg-blue-800/40 hover:bg-blue-800/60 text-white border border-white/20 font-medium px-5 py-3 rounded-lg transition backdrop-blur-sm"
              >
                <FileText size={18} />
                Presentar mis exámenes
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Cómo funciona — 3 pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-fluid-xl fluid-p-5 border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
            <Layers size={24} />
          </div>
          <div className="text-sm text-blue-600 font-semibold mb-1">PASO 1</div>
          <h3 className="font-bold text-gray-900 mb-1">Elige tu certificación</h3>
          <p className="text-sm text-gray-600">
            Explora el catálogo y selecciona una o varias certificaciones para comprar juntas.
          </p>
        </div>
        <div className="bg-white rounded-fluid-xl fluid-p-5 border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mb-3">
            <CreditCard size={24} />
          </div>
          <div className="text-sm text-green-600 font-semibold mb-1">PASO 2</div>
          <h3 className="font-bold text-gray-900 mb-1">Paga seguro</h3>
          <p className="text-sm text-gray-600">
            Paga con MercadoPago (tarjeta, OXXO, SPEI). Acceso inmediato al aprobarse.
          </p>
        </div>
        <div className="bg-white rounded-fluid-xl fluid-p-5 border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
            <Award size={24} />
          </div>
          <div className="text-sm text-purple-600 font-semibold mb-1">PASO 3</div>
          <h3 className="font-bold text-gray-900 mb-1">Presenta y certifícate</h3>
          <p className="text-sm text-gray-600">
            Presenta tu examen en línea y obtén tu certificado digital al instante.
          </p>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<GraduationCap size={24} />}
          label="Certificaciones adquiridas"
          value={purchasedExams.size}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          icon={<ShieldCheck size={24} />}
          label="Compras aprobadas"
          value={approvedPurchases.length}
          accent="bg-green-50 text-green-700"
        />
        <StatCard
          icon={<Clock size={24} />}
          label="Pagos pendientes"
          value={pendingPurchases.length}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      {/* Mis exámenes disponibles */}
      <section className="bg-white rounded-fluid-xl fluid-p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="text-blue-600" /> Mis exámenes
          </h2>
          <Link to="/exams" className="text-sm text-blue-600 hover:underline">Ver todos →</Link>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : myExams.length === 0 && purchasedExams.size === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg">
            <ShoppingCart size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-700 font-medium mb-1">Aún no has adquirido certificaciones</p>
            <p className="text-sm text-gray-500 mb-4">
              Comienza explorando nuestro catálogo de certificaciones disponibles.
            </p>
            <Link
              to="/mi/catalogo"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <ShoppingCart size={18} /> Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from(purchasedExams.values()).map(e => (
              <Link
                key={e.id}
                to="/exams"
                className="border border-gray-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg p-4 transition flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{e.title}</div>
                  <div className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Acceso activo
                  </div>
                </div>
                <ArrowRight className="text-gray-400" size={18} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Historial de compras */}
      {purchases.length > 0 && (
        <section className="bg-white rounded-fluid-xl fluid-p-5 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="text-blue-600" /> Mis compras
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Certificación(es)</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {purchases.slice(0, 10).map(p => {
                  const items = p.exams?.length ? p.exams : (p.exam ? [p.exam] : [])
                  return (
                    <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 pr-3 text-gray-600">
                        {new Date(p.created_at).toLocaleDateString('es-MX')}
                      </td>
                      <td className="py-3 pr-3">
                        {items.length === 0 && <span className="text-gray-400">—</span>}
                        {items.length === 1 && (
                          <span className="text-gray-900">{items[0].title}</span>
                        )}
                        {items.length > 1 && (
                          <details>
                            <summary className="text-blue-600 cursor-pointer">
                              {items.length} certificaciones (bundle)
                            </summary>
                            <ul className="mt-1 ml-4 list-disc text-xs text-gray-600">
                              {items.map(it => <li key={it.id}>{it.title}</li>)}
                            </ul>
                          </details>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        ${Number(p.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number; accent: string;
}) {
  return (
    <div className="bg-white rounded-fluid-xl fluid-p-5 border border-gray-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: 'Aprobado', cls: 'bg-green-100 text-green-700' },
    pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
    refunded: { label: 'Reembolsado', cls: 'bg-gray-100 text-gray-700' },
  }
  const info = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}
