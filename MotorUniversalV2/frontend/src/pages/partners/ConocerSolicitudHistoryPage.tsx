/**
 * Página de Historial de Envíos de Solicitudes CONOCER (línea de captura)
 *
 * Muestra el listado de correos enviados a los contactos CONOCER
 * (manuales + programados), con acceso al reporte completo de cada envío.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Send,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getConocerSolicitudLogs,
  getConocerSolicitudLogDetail,
  ConocerSolicitudLog,
} from '../../services/partnersService';

export default function ConocerSolicitudHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConocerSolicitudLog[]>([]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConocerSolicitudLog | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const data = await getConocerSolicitudLogs();
      setLogs(data.logs);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el historial de envíos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDetail = async (id: number) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await getConocerSolicitudLogDetail(id);
      setDetail(data.log);
    } catch (err: any) {
      setDetailError(err.response?.data?.error || 'No se pudo cargar el reporte del envío');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const statusBadge = (status: string) => {
    if (status === 'sent') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Enviado
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3 h-3" /> Falló
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl shadow-lg p-6 mb-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to="/tramites-conocer"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Volver"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Mail className="w-6 h-6" /> Historial de envíos al CONOCER
                </h1>
                <p className="text-sm text-white/80 mt-1">
                  Reportes de los correos de línea de captura enviados a los contactos CONOCER
                </p>
              </div>
            </div>
            <button
              onClick={() => { setRefreshing(true); loadData(); }}
              disabled={refreshing}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg flex items-center gap-2 text-sm transition disabled:opacity-50"
            >
              {refreshing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              Actualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Send className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>Aún no se ha enviado ninguna solicitud de línea de captura.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Enviado por</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Destinatarios</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Certificados</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {formatDate(log.sent_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {log.sent_by_name || <span className="text-slate-400 italic">Automático</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="max-w-[260px] truncate" title={log.recipients.join(', ')}>
                          {log.recipients.join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {log.total_certificates}
                      </td>
                      <td className="px-4 py-3">{statusBadge(log.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(log.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver reporte
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal reporte */}
      {(detail || detailLoading || detailError) && (
        <ConocerSolicitudDetailModal
          log={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de Reporte
// ---------------------------------------------------------------------------

function ConocerSolicitudDetailModal({
  log,
  loading,
  error,
  onClose,
}: {
  log: ConocerSolicitudLog | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" /> Reporte de envío al CONOCER
            </h2>
            {log && (
              <p className="text-xs text-slate-500 mt-0.5">
                #{log.id} · {formatDate(log.sent_at)} · Enviado por {log.sent_by_name || 'sistema automático'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            aria-label="Cerrar"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando reporte…
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          {log && !loading && !error && (
            <div className="space-y-5">
              {/* Metadata del correo */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Datos del correo</h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
                  <Row label="Asunto" value={log.email_subject || '—'} />
                  <Row label="Para (To)" value={log.email_to || log.recipients[0] || '—'} />
                  <Row
                    label="Con copia (Cc)"
                    value={
                      (log.email_cc && log.email_cc.length > 0)
                        ? log.email_cc.join(', ')
                        : <span className="text-slate-400">(sin CC)</span>
                    }
                  />
                  <Row
                    label="Destinatarios totales"
                    value={log.recipients.join(', ') || '—'}
                  />
                  <Row label="Estado" value={log.status} />
                  {log.error_message && (
                    <Row label="Error" value={<span className="text-red-700">{log.error_message}</span>} />
                  )}
                  <Row label="Certificados solicitados" value={String(log.total_certificates)} />
                </div>
              </section>

              {/* Resumen por ECM */}
              {log.ecm_summary && log.ecm_summary.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Resumen por estándar (ECM)</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Código</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Cantidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {log.ecm_summary.map(item => (
                          <tr key={item.code}>
                            <td className="px-3 py-2 text-slate-700">{item.code}</td>
                            <td className="px-3 py-2 text-center font-semibold text-slate-700">{item.count}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-2 text-slate-800">Total</td>
                          <td className="px-3 py-2 text-center text-slate-800">{log.total_certificates}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Adjuntos */}
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Archivos adjuntos</h3>
                {(log.email_attachments && log.email_attachments.length > 0) ? (
                  <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
                    {log.email_attachments.map((a, i) => (
                      <li key={i} className="px-3 py-2 flex items-center justify-between">
                        <span className="font-mono text-slate-700">{a.name}</span>
                        <span className="text-xs text-slate-500">
                          {a.content_type || '—'}
                          {typeof a.size_bytes === 'number'
                            ? ` · ${(a.size_bytes / 1024).toFixed(1)} KB`
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : log.attachment_names ? (
                  <p className="text-sm text-slate-600">{log.attachment_names}</p>
                ) : (
                  <p className="text-sm text-slate-400">(sin adjuntos)</p>
                )}
              </section>

              {/* Snapshot de asignaciones */}
              {log.assignments_snapshot && log.assignments_snapshot.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Candidatos incluidos en este envío ({log.assignments_snapshot.length})
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Núm.</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">CURP</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Nombre</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">ECM</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Nivel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {log.assignments_snapshot.map(a => (
                          <tr key={a.eca_id}>
                            <td className="px-3 py-2 text-slate-700 font-mono">{a.assignment_number || '—'}</td>
                            <td className="px-3 py-2 text-slate-700 font-mono">{a.curp || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{a.name || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{a.ecm_code || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{a.competency_level || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Cuerpo del correo */}
              {log.email_body_html && (
                <section>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Cuerpo del correo</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <iframe
                      title={`correo-${log.id}`}
                      srcDoc={log.email_body_html}
                      sandbox=""
                      className="w-full"
                      style={{ height: 520, border: 0, background: '#ffffff' }}
                    />
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
      <span className="text-xs font-semibold text-slate-500 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 break-all">{value}</span>
    </div>
  );
}
