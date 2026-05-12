/**
 * Dashboard de auditoría del worker CURP (RENAPO).
 *
 * Solo admin/developer — accesible vía /user-management/curp-queue
 *
 * Polling en tiempo real con intervalo configurable.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ServerCog,
  ShieldAlert,
  Unlock,
  XCircle,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import {
  getCurpQueueDashboard,
  releaseCurpQueueLock,
  CurpQueueDashboard,
  CurpQueueRow,
} from '../../services/userManagementService';
import { useAuthStore } from '../../store/authStore';

const REFRESH_OPTIONS = [
  { label: '3 s', value: 3000 },
  { label: '5 s', value: 5000 },
  { label: '10 s', value: 10000 },
  { label: '30 s', value: 30000 },
  { label: '1 min', value: 60000 },
];

function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 0) {
    const future = -secs;
    if (future < 60) return `en ${future}s`;
    if (future < 3600) return `en ${Math.floor(future / 60)}m`;
    return `en ${Math.floor(future / 3600)}h`;
  }
  if (secs < 60) return `hace ${secs}s`;
  if (secs < 3600) return `hace ${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `hace ${Math.floor(secs / 3600)}h`;
  return `hace ${Math.floor(secs / 86400)}d`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function StatusPill({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    done: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    failed: 'bg-rose-100 text-rose-800 border-rose-200',
    rejected: 'bg-orange-100 text-orange-800 border-orange-200',
  };
  const cls = colors[status || ''] || 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status || 'desconocido'}
    </span>
  );
}

export default function CurpQueueDashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  const [data, setData] = useState<CurpQueueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [refreshMs, setRefreshMs] = useState(5000);
  const [paused, setPaused] = useState(false);
  const [releasingId, setReleasingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getCurpQueueDashboard();
      setData(result);
      setError(null);
      setLastFetch(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (paused || !isAdmin) return;
    const interval = setInterval(fetchData, refreshMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshMs, paused, isAdmin]);

  const handleRelease = async (queueId: number) => {
    if (!confirm(`¿Liberar manualmente el lock de la fila #${queueId}?\n\nEsto la regresa a "pending" para que el worker la retome.`)) {
      return;
    }
    setReleasingId(queueId);
    try {
      await releaseCurpQueueLock(queueId);
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Error liberando lock');
    } finally {
      setReleasingId(null);
    }
  };

  const completionRate = useMemo(() => {
    if (!data) return 0;
    const finalized = data.counts.done + data.counts.rejected + data.counts.failed;
    if (data.total === 0) return 0;
    return Math.round((finalized / data.total) * 100);
  }, [data]);

  const maxBucket = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      ...data.throughput_24h.map((b) => b.done + b.rejected + b.failed)
    );
  }, [data]);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto mt-12 p-6 bg-rose-50 border border-rose-200 rounded-xl">
        <h2 className="text-lg font-semibold text-rose-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Acceso restringido
        </h2>
        <p className="text-rose-700 mt-2">
          Esta página solo está disponible para administradores.
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>Cargando dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <Link
            to="/user-management"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a usuarios
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Auditoría worker CURP / RENAPO
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitoreo en tiempo real de la cola de validación CURP contra RENAPO.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={refreshMs}
            onChange={(e) => setRefreshMs(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Refresco: {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setPaused((p) => !p)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              paused
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? 'Reanudar' : 'Pausar'}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">{error}</div>
        </div>
      )}

      {data && (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Total cola"
              value={data.total}
              icon={<Database className="w-5 h-5" />}
              color="gray"
            />
            <MetricCard
              label="Pendientes"
              value={data.counts.pending}
              icon={<Clock className="w-5 h-5" />}
              color="amber"
            />
            <MetricCard
              label="Procesando"
              value={data.counts.processing}
              icon={<Loader2 className={`w-5 h-5 ${data.counts.processing > 0 ? 'animate-spin' : ''}`} />}
              color="blue"
            />
            <MetricCard
              label="Completadas"
              value={data.counts.done}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="emerald"
            />
            <MetricCard
              label="Rechazadas"
              value={data.counts.rejected}
              icon={<XCircle className="w-5 h-5" />}
              color="orange"
            />
            <MetricCard
              label="Errores"
              value={data.counts.failed}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="rose"
            />
          </div>

          {/* Estado RENAPO + Workers + Cache + Throughput */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* RENAPO */}
            <div className={`rounded-xl border p-4 ${
              data.renapo.circuit_open
                ? 'bg-rose-50 border-rose-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ServerCog className="w-4 h-4" />
                RENAPO
              </div>
              <div className={`mt-1 text-lg font-bold ${
                data.renapo.circuit_open ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {data.renapo.circuit_open ? 'Caído (circuit OPEN)' : 'Disponible'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Fallos consecutivos:{' '}
                <span className="font-semibold">
                  {data.renapo.consecutive_failures ?? 0} / {data.renapo.threshold ?? 10}
                </span>
              </div>
              {data.renapo.circuit_open && data.renapo.cooldown_remaining != null && (
                <div className="text-xs text-rose-700 mt-1">
                  Cooldown restante: {data.renapo.cooldown_remaining}s
                </div>
              )}
            </div>

            {/* Workers vivos */}
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Zap className="w-4 h-4" />
                Workers activos
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {data.active_workers.length}
              </div>
              <div className="text-xs text-gray-500 mt-1 truncate space-y-0.5 max-h-16 overflow-y-auto">
                {data.active_workers.length === 0 ? (
                  <span>Sin locks recientes (&lt;10 min)</span>
                ) : (
                  data.active_workers.map((w) => (
                    <div key={w} className="truncate font-mono">
                      {w}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cache RENAPO */}
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Database className="w-4 h-4" />
                Cache RENAPO
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {data.cache.total}{' '}
                <span className="text-xs font-normal text-gray-500">entradas</span>
              </div>
              <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                <div>
                  Positivas: <b>{data.cache.positive}</b> · Negativas:{' '}
                  <b>{data.cache.negative}</b>
                </div>
                <div>
                  Hits: <b>{data.cache.total_hits}</b> · Frescas:{' '}
                  <b>{data.cache.fresh}</b>
                </div>
              </div>
            </div>

            {/* Throughput última hora */}
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Activity className="w-4 h-4" />
                Última hora
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">
                {data.last_hour_total}{' '}
                <span className="text-xs font-normal text-gray-500">finalizadas</span>
              </div>
              <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                <div>
                  ✅ {data.last_hour.done} · ❌ {data.last_hour.rejected} · ⚠️{' '}
                  {data.last_hour.failed}
                </div>
                <div>
                  Progreso global: <b>{completionRate}%</b>
                </div>
              </div>
            </div>
          </div>

          {/* Alerta zombies */}
          {data.zombie_locks > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="text-sm">
                <b>{data.zombie_locks}</b> lock(s) zombi detectados (
                <i>locked_at &gt; 10 min</i>). Usa el botón "Liberar" en la tabla de
                "Procesando ahora" para regresarlos a pending.
              </div>
            </div>
          )}

          {/* Gráfico de barras throughput 24h */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Throughput últimas 24h (UTC)
            </h2>
            <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
              {data.throughput_24h.map((b) => {
                const total = b.done + b.rejected + b.failed;
                const heightPct = (total / maxBucket) * 100;
                return (
                  <div
                    key={b.bucket}
                    className="flex-1 min-w-[8px] flex flex-col justify-end h-full group relative"
                  >
                    <div
                      className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-sm"
                      style={{ height: `${heightPct}%` }}
                      title={`${b.bucket}: done=${b.done} rej=${b.rejected} fail=${b.failed}`}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {b.bucket}
                      <br />
                      done: {b.done} · rej: {b.rejected} · fail: {b.failed}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Cada barra = 1 hora. Total apilado (done + rejected + failed).
            </div>
          </div>

          {/* Tablas en grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Procesando ahora */}
            <QueueTable
              title={`Procesando ahora (${data.processing_count})`}
              icon={<Loader2 className="w-4 h-4" />}
              rows={data.processing}
              emptyMsg="No hay filas en procesamiento."
              columns={[
                { header: 'ID', accessor: (r) => `#${r.id}` },
                { header: 'CURP', accessor: (r) => r.curp, className: 'font-mono text-xs' },
                {
                  header: 'Lock',
                  accessor: (r) => (
                    <span className={r.is_zombie ? 'text-rose-600 font-semibold' : ''}>
                      {formatDuration(r.lock_age_seconds)}
                      {r.is_zombie ? ' 💀' : ''}
                    </span>
                  ),
                },
                { header: 'Intentos', accessor: (r) => r.attempts },
                {
                  header: 'Acción',
                  accessor: (r) => (
                    <button
                      onClick={() => handleRelease(r.id)}
                      disabled={releasingId === r.id}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {releasingId === r.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                      Liberar
                    </button>
                  ),
                },
              ]}
            />

            {/* Próximas pending */}
            <QueueTable
              title={`Próximas a procesar (${data.next_pending.length})`}
              icon={<Clock className="w-4 h-4" />}
              rows={data.next_pending}
              emptyMsg="No hay filas pendientes."
              columns={[
                { header: 'ID', accessor: (r) => `#${r.id}` },
                { header: 'CURP', accessor: (r) => r.curp, className: 'font-mono text-xs' },
                {
                  header: 'Espera',
                  accessor: (r) => {
                    const w = r.wait_seconds;
                    if (w == null) return '—';
                    if (w <= 0) return <span className="text-emerald-600 font-medium">lista</span>;
                    return formatDuration(w);
                  },
                },
                { header: 'Intentos', accessor: (r) => r.attempts },
                { header: 'Circuit', accessor: (r) => r.circuit_open_retries },
              ]}
            />
          </div>

          {/* Finalizadas recientes + Top errores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <QueueTable
                title={`Finalizadas recientemente (${data.recent_finished.length})`}
                icon={<CheckCircle2 className="w-4 h-4" />}
                rows={data.recent_finished}
                emptyMsg="Aún sin filas finalizadas."
                columns={[
                  { header: 'ID', accessor: (r) => `#${r.id}` },
                  { header: 'CURP', accessor: (r) => r.curp, className: 'font-mono text-xs' },
                  { header: 'Estado', accessor: (r) => <StatusPill status={r.status} /> },
                  { header: 'Duración', accessor: (r) => formatDuration(r.duration_seconds) },
                  { header: 'Finalizó', accessor: (r) => formatRelative(r.finished_at) },
                  {
                    header: 'Error',
                    accessor: (r) => (
                      <span className="text-xs text-gray-500 truncate inline-block max-w-[200px]" title={r.last_error || ''}>
                        {r.last_error || '—'}
                      </span>
                    ),
                  },
                ]}
              />
            </div>

            {/* Top errores */}
            <div className="rounded-xl border bg-white">
              <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-semibold text-gray-700">
                <AlertTriangle className="w-4 h-4" /> Top errores (24h)
              </div>
              {data.top_errors.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Sin errores recientes.</div>
              ) : (
                <ul className="divide-y">
                  {data.top_errors.map((e, idx) => (
                    <li key={idx} className="px-4 py-2 flex items-start gap-2">
                      <span className="text-xs font-mono bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                        {e.count}
                      </span>
                      <span className="text-xs text-gray-700 break-words">{e.error}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 text-center pt-4">
            Server time: {data.server_time} · Última actualización local:{' '}
            {lastFetch?.toLocaleTimeString() || '—'}
            {paused && <span className="ml-2 text-amber-600 font-medium">[PAUSADO]</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'gray' | 'amber' | 'blue' | 'emerald' | 'orange' | 'rose';
}) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

interface ColumnDef {
  header: string;
  accessor: (r: CurpQueueRow) => React.ReactNode;
  className?: string;
}

function QueueTable({
  title,
  icon,
  rows,
  columns,
  emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  rows: CurpQueueRow[];
  columns: ColumnDef[];
  emptyMsg: string;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-semibold text-gray-700">
        {icon} {title}
      </div>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">{emptyMsg}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.header}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c.header} className={`px-3 py-2 ${c.className || ''}`}>
                      {c.accessor(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
