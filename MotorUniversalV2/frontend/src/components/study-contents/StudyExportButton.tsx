/**
 * Botón "Exportar a SCORM" para la página de detalle del material de estudio.
 *
 * Maneja todo el flujo:
 *  - Consulta el estado actual (sin solicitud / pending / approved / consumed / rejected).
 *  - Si no hay solicitud activa → modal para indicar motivo y enviar.
 *  - Si pending → botón deshabilitado con leyenda "En espera de aprobación".
 *  - Si approved → botón verde para descargar el ZIP (consume la autorización).
 *  - Si rejected / consumed → permite crear nueva solicitud.
 */
import { useEffect, useState } from 'react';
import { Package, Download, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  getExportStatus,
  createExportRequest,
  downloadExport,
  type StudyExportRequest,
} from '../../services/studyExportService';

interface Props {
  materialId: number;
  materialTitle: string;
  onNotify?: (msg: string, type: 'success' | 'error') => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Esperando aprobación',
  approved: 'Aprobada — lista para descargar',
  rejected: 'Rechazada',
  consumed: 'Consumida',
};

export default function StudyExportButton({ materialId, materialTitle, onNotify }: Props) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<StudyExportRequest | null>(null);
  const [lastResolved, setLastResolved] = useState<StudyExportRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function refresh() {
    try {
      setLoading(true);
      const res = await getExportStatus(materialId);
      if (res.request && (res.request.status === 'pending' || res.request.status === 'approved')) {
        setActive(res.request);
        setLastResolved(null);
      } else {
        setActive(null);
        setLastResolved(res.request);
      }
    } catch (e: unknown) {
      console.warn('export status error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (materialId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await createExportRequest(materialId, reason.trim() || undefined);
      onNotify?.(
        res.request.status === 'approved'
          ? 'Exportación auto-aprobada. Ya puedes descargar.'
          : 'Solicitud enviada. Te avisaremos al ser aprobada.',
        'success',
      );
      setModalOpen(false);
      setReason('');
      await refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; request?: StudyExportRequest } } };
      const msg = err?.response?.data?.error || 'No se pudo crear la solicitud';
      onNotify?.(msg, 'error');
      if (err?.response?.data?.request) {
        // Refrescar para mostrar la solicitud existente.
        await refresh();
        setModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadExport(materialId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onNotify?.('Paquete SCORM descargado. Autorización consumida.', 'success');
      await refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } | unknown } };
      let msg = 'No se pudo descargar el paquete';
      const data = err?.response?.data;
      if (data && typeof data === 'object' && 'error' in data) {
        msg = (data as { error?: string }).error || msg;
      }
      onNotify?.(msg, 'error');
      await refresh();
    } finally {
      setDownloading(false);
    }
  }

  // ── Render del botón principal ─────────────────────────────────────
  let mainButton: JSX.Element;
  if (loading) {
    mainButton = (
      <button
        disabled
        className="fluid-px-4 fluid-py-2 rounded-fluid-lg bg-gray-100 text-gray-400 border border-gray-200 font-medium flex items-center fluid-gap-2 cursor-wait"
      >
        <Loader2 className="fluid-icon-sm animate-spin" />
        Cargando…
      </button>
    );
  } else if (active?.status === 'pending') {
    mainButton = (
      <button
        disabled
        title="Esperando aprobación de admin o gerente"
        className="fluid-px-4 fluid-py-2 rounded-fluid-lg bg-amber-50 text-amber-700 border border-amber-300 font-medium flex items-center fluid-gap-2 cursor-not-allowed"
      >
        <Clock className="fluid-icon-sm" />
        Esperando aprobación
      </button>
    );
  } else if (active?.status === 'approved') {
    mainButton = (
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="fluid-px-4 fluid-py-2 rounded-fluid-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center fluid-gap-2 shadow-sm disabled:opacity-60"
      >
        {downloading ? <Loader2 className="fluid-icon-sm animate-spin" /> : <Download className="fluid-icon-sm" />}
        Descargar SCORM
      </button>
    );
  } else {
    mainButton = (
      <button
        onClick={() => setModalOpen(true)}
        className="fluid-px-4 fluid-py-2 rounded-fluid-lg bg-white text-amber-700 border border-amber-300 hover:bg-amber-50 font-medium flex items-center fluid-gap-2"
      >
        <Package className="fluid-icon-sm" />
        Exportar a SCORM
      </button>
    );
  }

  // ── Pista de última resolución (rejected/consumed) ─────────────────
  const hint = (() => {
    if (active) return null;
    if (!lastResolved) return null;
    if (lastResolved.status === 'consumed') {
      return 'Tu última autorización fue consumida. Solicita una nueva para descargar otra vez.';
    }
    if (lastResolved.status === 'rejected') {
      return `Solicitud previa rechazada${lastResolved.review_notes ? `: ${lastResolved.review_notes}` : ''}.`;
    }
    return null;
  })();

  return (
    <>
      <div className="flex items-center fluid-gap-2">
        {mainButton}
        <button
          onClick={refresh}
          title="Refrescar estado"
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
        >
          <RefreshCw className="fluid-icon-xs" />
        </button>
      </div>
      {hint && <p className="fluid-text-xs text-gray-500 mt-1 max-w-xs">{hint}</p>}

      {/* Modal de solicitud */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center fluid-p-4">
          <div className="bg-white rounded-fluid-lg shadow-xl max-w-lg w-full">
            <div className="fluid-p-5 border-b">
              <h3 className="fluid-text-lg font-semibold text-gray-800 flex items-center fluid-gap-2">
                <Package className="fluid-icon-sm text-amber-600" />
                Solicitar exportación SCORM
              </h3>
              <p className="fluid-text-sm text-gray-500 mt-1">
                <strong>{materialTitle}</strong>
              </p>
            </div>
            <form onSubmit={handleSubmit} className="fluid-p-5">
              <div className="bg-amber-50 border border-amber-200 rounded-md fluid-p-3 fluid-mb-3 fluid-text-sm text-amber-800">
                Cada autorización aprobada permite <strong>una sola descarga</strong>.
                Para descargar el mismo material nuevamente, deberás solicitar otra autorización.
              </div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                Motivo (opcional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="¿Por qué necesitas exportar este material a SCORM?"
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 fluid-text-sm"
                maxLength={1000}
              />
              <div className="flex justify-end fluid-gap-2 fluid-mt-4">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setReason(''); }}
                  disabled={submitting}
                  className="fluid-px-4 fluid-py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 fluid-text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="fluid-px-4 fluid-py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white fluid-text-sm font-medium flex items-center fluid-gap-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="fluid-icon-xs animate-spin" />}
                  Enviar solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Iconos no usados directamente arriba pero exportados para que TS no se queje
// si se cambia el render rápido — se mantienen para futuro.
export const _icons = { CheckCircle2, XCircle };
