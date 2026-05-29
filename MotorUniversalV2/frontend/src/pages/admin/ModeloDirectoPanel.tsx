import { useQuery } from '@tanstack/react-query'
import { directService, type DirectMetrics } from '@/services/directService'
import { Link } from 'react-router-dom'

const fmtMXN = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

function StatCard({
  label,
  value,
  hint,
  accent = 'primary',
}: {
  label: string
  value: string | number
  hint?: string
  accent?: 'primary' | 'green' | 'amber' | 'red' | 'gray'
}) {
  const colors: Record<string, string> = {
    primary: 'border-primary-200 bg-primary-50 text-primary-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[accent]}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs opacity-70">{hint}</div>}
    </div>
  )
}

export default function ModeloDirectoPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<DirectMetrics>({
    queryKey: ['direct-metrics'],
    queryFn: () => directService.getMetrics(),
    refetchInterval: 60_000,
  })

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modelo Directo — Panel</h1>
          <p className="text-sm text-gray-600">
            Métricas del catálogo público B2C (ventas por MercadoPago).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/catalogo"
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
            target="_blank"
          >
            Ver catálogo público
          </Link>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-sm px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isFetching ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-gray-500">Cargando métricas…</div>
      )}
      {isError && (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded p-3">
          No se pudieron cargar las métricas. ¿Tienes permisos de admin/gerente?
        </div>
      )}

      {data && (
        <>
          {/* Ingresos */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Ingresos (pagos aprobados)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Hoy" value={fmtMXN(data.revenue.today)} accent="green" />
              <StatCard label="Últimos 7 días" value={fmtMXN(data.revenue.week)} accent="green" />
              <StatCard label="Últimos 30 días" value={fmtMXN(data.revenue.month)} accent="green" />
              <StatCard label="Histórico" value={fmtMXN(data.revenue.total)} accent="primary" />
            </div>
          </section>

          {/* Pagos por estado */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Pagos por estado</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Aprobados" value={data.payments.approved} accent="green" />
              <StatCard label="Pendientes" value={data.payments.pending} accent="amber" />
              <StatCard label="Rechazados" value={data.payments.rejected} accent="red" />
              <StatCard label="Total intentos" value={data.payments.total} accent="gray" />
            </div>
          </section>

          {/* Catálogo + Conversión */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Catálogo</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Publicados (pago)" value={data.catalog.paid_published} accent="primary" />
                <StatCard label="Muestras gratis" value={data.catalog.free_samples} accent="green" />
                <StatCard
                  label="Con precio sin publicar"
                  value={data.catalog.draft_with_price}
                  accent="gray"
                  hint="Listos para publicar"
                />
              </div>
            </section>
            <section>
              <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">Conversión</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Usuarios registrados" value={data.conversion.registered_users} accent="gray" />
                <StatCard label="Usuarios que pagaron" value={data.conversion.paying_users} accent="green" />
                <StatCard
                  label="Tasa conversión"
                  value={`${data.conversion.rate_pct.toFixed(2)}%`}
                  accent="primary"
                  hint="Pagaron / Registrados"
                />
              </div>
            </section>
          </div>

          {/* Top exámenes */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">
              Top exámenes vendidos (últimos 90 días)
            </h2>
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">Examen</th>
                    <th className="text-right px-4 py-2 font-medium">Vendidos</th>
                    <th className="text-right px-4 py-2 font-medium">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_exams.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                        Sin ventas aún.
                      </td>
                    </tr>
                  )}
                  {data.top_exams.map((row, idx) => (
                    <tr key={row.exam_id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2 text-gray-900">{row.title}</td>
                      <td className="px-4 py-2 text-right font-semibold">{row.sold}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtMXN(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Registros por día */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase mb-3">
              Nuevos usuarios catálogo (últimos 30 días)
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              {data.registrations_by_day.length === 0 ? (
                <div className="text-gray-400 text-sm">Sin nuevos registros en el período.</div>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {data.registrations_by_day.map((d) => {
                    const max = Math.max(...data.registrations_by_day.map((r) => r.count), 1)
                    const h = Math.round((d.count / max) * 100)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center" title={`${d.date}: ${d.count}`}>
                        <div
                          className="w-full bg-primary-500 rounded-t"
                          style={{ height: `${h}%`, minHeight: '4px' }}
                        />
                        <div className="text-[10px] text-gray-400 mt-1 rotate-45 origin-top-left whitespace-nowrap">
                          {d.date.slice(5)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <div className="text-xs text-gray-400 text-right">
            Generado: {new Date(data.generated_at).toLocaleString('es-MX')}
          </div>
        </>
      )}
    </div>
  )
}
