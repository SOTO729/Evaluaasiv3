/**
 * Página de auditoría de solicitudes de exportación SCORM.
 *
 * Accesible para admin / developer / gerente. Permite:
 *  - Ver estadísticas globales.
 *  - Filtrar por estado.
 *  - Aprobar o rechazar solicitudes pending.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Package, CheckCircle2, XCircle, Clock, Download, Loader2,
  Filter, RefreshCw, Eye,
} from 'lucide-react';
import {
  listExportRequests, approveExportRequest, rejectExportRequest,
  getExportStats,
  type StudyExportRequest, type StudyExportStats,
} from '../../services/studyExportService';

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'consumed' | 'active' | 'all';

export default function StudyExportRequestsPage() {
  const [stats, setStats] = useState<StudyExportStats | null>(null);
  const [requests, setRequests] = useState<StudyExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reviewing, setReviewing] = useState<StudyExportRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [detail, setDetail] = useState<StudyExportRequest | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        getExportStats(),
        listExportRequests({ status: filter, page, per_page: 20 }),
      ]);
      setStats(statsRes);
      setRequests(listRes.requests);
      setPages(listRes.pages || 1);
      setTotal(listRes.total || 0);
    } catch (e) {
      console.error('load export audit error', e);
      setToast({ msg: 'No se pudieron cargar las solicitudes', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, page]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function openReview(req: StudyExportRequest, action: 'approve' | 'reject') {
    setReviewing(req);
    setReviewAction(action);
    setReviewNotes('');
  }

  async function submitReview() {
    if (!reviewing) return;
    if (reviewAction === 'reject' && !reviewNotes.trim()) {
      setToast({ msg: 'Indica un motivo para rechazar', type: 'error' });
      return;
    }
    setSubmittingReview(true);
    try {
      if (reviewAction === 'approve') {
        await approveExportRequest(reviewing.id, reviewNotes.trim() || undefined);
        setToast({ msg: 'Solicitud aprobada', type: 'success' });
      } else {
        await rejectExportRequest(reviewing.id, reviewNotes.trim());
        setToast({ msg: 'Solicitud rechazada', type: 'success' });
      }
      setReviewing(null);
      setReviewNotes('');
      await loadAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setToast({ msg: err?.response?.data?.error || 'Error al procesar', type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  }

  const statusBadge = useMemo(() => (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: JSX.Element; label: string }> = {
      pending:  { bg: 'bg-amber-100',   text: 'text-amber-800',   icon: <Clock className="w-3 h-3" />,        label: 'Pendiente' },
      approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Aprobada' },
      rejected: { bg: 'bg-red-100',     text: 'text-red-800',     icon: <XCircle className="w-3 h-3" />,      label: 'Rechazada' },
      consumed: { bg: 'bg-blue-100',    text: 'text-blue-800',    icon: <Download className="w-3 h-3" />,     label: 'Descargada' },
    };
    const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Clock className="w-3 h-3" />, label: status };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.icon}{s.label}
      </span>
    );
  }, []);

  function fmtDate(s: string | null) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString(); } catch { return s; }
  }

  function fmtBytes(b: number | null) {
    if (!b) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exportaciones SCORM</h1>
            <p className="text-sm text-gray-500">Solicitudes de editores para exportar materiales a SCORM.</p>
          </div>
        </div>
        <button
          onClick={loadAll}
          className="px-3 py-2 text-sm rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refrescar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Pendientes" value={stats.pending} color="amber" />
          <StatCard label="Aprobadas" value={stats.approved} color="emerald" />
          <StatCard label="Rechazadas" value={stats.rejected} color="red" />
          <StatCard label="Descargadas" value={stats.consumed} color="blue" />
          <StatCard label="Total" value={stats.total} color="gray" />
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['pending', 'active', 'approved', 'rejected', 'consumed', 'all'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filter === f
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {{
                pending: 'Pendientes',
                active: 'Activas (pend + apr)',
                approved: 'Aprobadas',
                rejected: 'Rechazadas',
                consumed: 'Descargadas',
                all: 'Todas',
              }[f]}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-500">{total} resultado(s)</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            Sin solicitudes en este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Material</th>
                  <th className="px-4 py-2 text-left">Solicitado por</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Solicitud</th>
                  <th className="px-4 py-2 text-left">Revisión</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.material?.title || `Material #${r.material_id}`}</div>
                      <div className="text-xs text-gray-500">ID #{r.material_id} {r.material?.is_published ? '· Publicado' : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{r.requested_by_name || '—'}</div>
                      <div className="text-xs text-gray-500">{r.requested_by_email || ''}</div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {fmtDate(r.created_at)}
                      {r.reason && (
                        <div className="text-gray-500 italic max-w-xs truncate" title={r.reason}>
                          “{r.reason}”
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {r.reviewed_at ? (
                        <>
                          {fmtDate(r.reviewed_at)}
                          <div className="text-gray-500">{r.reviewed_by_name || ''}</div>
                          {r.review_notes && <div className="italic max-w-xs truncate" title={r.review_notes}>{r.review_notes}</div>}
                        </>
                      ) : '—'}
                      {r.status === 'consumed' && (
                        <div className="mt-1 text-blue-700">
                          {fmtBytes(r.size_bytes)} · {fmtDate(r.consumed_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setDetail(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50 mr-1"
                      >
                        <Eye className="w-3 h-3" /> Ver
                      </button>
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openReview(r, 'approve')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 mr-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Aprobar
                          </button>
                          <button
                            onClick={() => openReview(r, 'reject')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                          >
                            <XCircle className="w-3 h-3" /> Rechazar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Paginación */}
        {pages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-gray-100 text-sm text-gray-600">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >Anterior</button>
            <span>Página {page} de {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >Siguiente</button>
          </div>
        )}
      </div>

      {/* Modal de revisión */}
      {reviewing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-5 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                {reviewAction === 'approve' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Material: <strong>{reviewing.material?.title || `#${reviewing.material_id}`}</strong>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Solicitada por {reviewing.requested_by_name} ({reviewing.requested_by_email})
              </p>
            </div>
            <div className="p-5">
              {reviewAction === 'approve' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mb-3 text-sm text-emerald-800">
                  Al aprobar, el editor podrá descargar el paquete <strong>una sola vez</strong>.
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {reviewAction === 'reject' ? 'Motivo del rechazo' : 'Notas (opcional)'}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setReviewing(null)}
                  disabled={submittingReview}
                  className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >Cancelar</button>
                <button
                  onClick={submitReview}
                  disabled={submittingReview}
                  className={`px-4 py-2 rounded-md text-white text-sm font-medium flex items-center gap-2 disabled:opacity-60 ${
                    reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submittingReview && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Detalle de solicitud #{detail.id}</h3>
                <p className="text-sm text-gray-500">{detail.material?.title || `Material #${detail.material_id}`}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <Row k="Estado" v={statusBadge(detail.status)} />
              <Row k="Solicitada por" v={`${detail.requested_by_name || '—'} (${detail.requested_by_email || ''})`} />
              <Row k="Creada" v={fmtDate(detail.created_at)} />
              <Row k="Motivo" v={detail.reason || <em className="text-gray-400">Sin motivo indicado</em>} />
              <Row k="Revisada por" v={detail.reviewed_by_name || '—'} />
              <Row k="Fecha de revisión" v={fmtDate(detail.reviewed_at)} />
              <Row k="Notas de revisión" v={detail.review_notes || '—'} />
              <Row k="Descargada" v={detail.consumed_at ? fmtDate(detail.consumed_at) : '—'} />
              {detail.consumed_filename && <Row k="Archivo entregado" v={`${detail.consumed_filename} (${fmtBytes(detail.size_bytes)})`} />}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-md shadow-lg z-50 text-sm ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>{toast.msg}</div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const palette: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-lg border p-3 ${palette[color] || palette.gray}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-gray-500">{k}</div>
      <div className="col-span-2 text-gray-800">{v}</div>
    </div>
  );
}
