/**
 * Página de Detalle de un Batch de Carga CONOCER
 *
 * Muestra el resumen y los logs detallados de un batch específico.
 * Tabs para filtrar por estado: Todos, Exitosos, Reemplazados, Omitidos, Descartados, Errores.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  SkipForward,
  Replace,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  User,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getConocerUploadBatchDetail,
  getConocerUploadBatchLogs,
  exportConocerUploadBatchLogs,
  retryConocerUploadBatch,
  ConocerUploadBatch,
  ConocerUploadLog,
} from '../../services/partnersService';

type TabType = 'all' | 'matched' | 'replaced' | 'skipped' | 'discarded' | 'error';

const TABS: { id: TabType; label: string; color: string }[] = [
  { id: 'all', label: 'Todos', color: 'gray' },
  { id: 'matched', label: 'Nuevos', color: 'emerald' },
  { id: 'replaced', label: 'Reemplazados', color: 'blue' },
  { id: 'skipped', label: 'Omitidos', color: 'gray' },
  { id: 'discarded', label: 'Descartados', color: 'amber' },
  { id: 'error', label: 'Errores', color: 'red' },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  matched: {
    label: 'Nuevo',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  replaced: {
    label: 'Reemplazado',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Replace className="w-3 h-3" />,
  },
  skipped: {
    label: 'Omitido',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <SkipForward className="w-3 h-3" />,
  },
  discarded: {
    label: 'Descartado',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <XCircle className="w-3 h-3" />,
  },
  error: {
    label: 'Error',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

const DISCARD_LABELS: Record<string, string> = {
  not_pdf: 'No es PDF',
  parse_error: 'Error de lectura',
  no_curp: 'CURP no encontrado',
  no_ecm_code: 'ECM no encontrado',
  curp_not_found: 'CURP no registrado',
  ecm_not_found: 'ECM no registrado',
  no_pending_tramite: 'Sin trámite pendiente',
  duplicate_in_batch: 'Duplicado en carga',
  processing_error: 'Error de procesamiento',
};

export default function ConocerUploadDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<ConocerUploadBatch | null>(null);
  const [logs, setLogs] = useState<ConocerUploadLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPages, setLogsPages] = useState(1);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [summary, setSummary] = useState({
    matched: 0, replaced: 0, skipped: 0, discarded: 0, error: 0,
  });

  const loadBatch = useCallback(async () => {
    try {
      const data = await getConocerUploadBatchDetail(id);
      setBatch(data.batch);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el batch');
    }
  }, [id]);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      const data = await getConocerUploadBatchLogs(id, {
        page: currentPage,
        per_page: perPage,
        status: statusFilter,
      });
      setLogs(data.logs);
      setLogsTotal(data.total);
      setLogsPages(data.pages);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los logs');
    } finally {
      setLoading(false);
    }
  }, [id, activeTab, currentPage, perPage]);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Polling si el batch está en processing
  useEffect(() => {
    if (!batch || (batch.status !== 'processing' && batch.status !== 'queued')) return;
    const interval = setInterval(() => {
      loadBatch();
      loadLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [batch?.status, loadBatch, loadLogs]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportConocerUploadBatchLogs(id);
    } catch {
      alert('Error al exportar los logs');
    } finally {
      setExporting(false);
    }
  };

  const handleRetry = async () => {
    try {
      setRetrying(true);
      await retryConocerUploadBatch(id);
      await loadBatch();
      await loadLogs();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al reintentar');
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getDuration = () => {
    if (!batch?.started_at || !batch?.completed_at) return '—';
    const ms = new Date(batch.completed_at).getTime() - new Date(batch.started_at).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status];
    if (!s) return <span className="text-gray-500 text-xs">{status}</span>;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  if (!batch && loading) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-14">
        <LoadingSpinner message="Cargando detalle del batch..." />
      </div>
    );
  }

  if (error && !batch) {
    return (
      <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-6 text-center">
          <XCircle className="fluid-icon-xl text-red-500 mx-auto fluid-mb-3" />
          <p className="text-red-700">{error}</p>
          <Link to="/tramites-conocer/historial" className="text-emerald-600 hover:underline fluid-mt-3 inline-block">
            Volver al historial
          </Link>
        </div>
      </div>
    );
  }

  const isActive = batch?.status === 'processing' || batch?.status === 'queued';
  const progressPct = batch && batch.total_files > 0
    ? Math.round((batch.processed_files / batch.total_files) * 100)
    : 0;

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="fluid-mb-6">
        <Link
          to="/tramites-conocer/historial"
          className="inline-flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-3 transition-colors"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver al Historial
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3">
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-900 flex items-center fluid-gap-3">
              <FileText className="fluid-icon-lg text-emerald-600" />
              {batch?.filename || 'Carga'}
            </h1>
            <div className="flex items-center fluid-gap-4 fluid-mt-1 text-gray-500 fluid-text-sm">
              <span className="flex items-center fluid-gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(batch?.created_at || null)}
              </span>
              {batch?.status === 'completed' && (
                <span>Duración: {getDuration()}</span>
              )}
              {batch?.uploader_name && (
                <span className="flex items-center fluid-gap-1">
                  <User className="w-3.5 h-3.5" />
                  {batch.uploader_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center fluid-gap-2">
            {batch?.status === 'failed' && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center fluid-gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold fluid-px-4 fluid-py-2 rounded-fluid-lg transition-colors fluid-text-sm"
              >
                {retrying ? <Loader2 className="fluid-icon-sm animate-spin" /> : <RefreshCw className="fluid-icon-sm" />}
                Reintentar
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={exporting || isActive}
              className="inline-flex items-center fluid-gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 fluid-px-4 fluid-py-2 rounded-fluid-lg transition-colors fluid-text-sm disabled:opacity-50"
            >
              {exporting ? <Loader2 className="fluid-icon-sm animate-spin" /> : <Download className="fluid-icon-sm" />}
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar if active */}
      {isActive && batch && (
        <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-4 fluid-mb-6">
          <div className="flex items-center fluid-gap-3 fluid-mb-2">
            <Loader2 className="fluid-icon-sm text-blue-500 animate-spin" />
            <span className="font-semibold text-blue-900 fluid-text-sm">
              Procesando... {batch.processed_files} de {batch.total_files} archivos
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {batch?.status === 'failed' && batch.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-mb-4 flex items-center fluid-gap-2">
          <XCircle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{batch.error_message}</p>
        </div>
      )}

      {/* Summary Cards */}
      {batch && (
        <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-3 fluid-mb-6">
          <SummaryCard icon={<CheckCircle2 className="fluid-icon-sm" />} label="Nuevos" value={batch.matched_files} color="emerald" />
          <SummaryCard icon={<Replace className="fluid-icon-sm" />} label="Reemplazados" value={batch.replaced_files} color="blue" />
          <SummaryCard icon={<SkipForward className="fluid-icon-sm" />} label="Omitidos" value={batch.skipped_files} color="gray" />
          <SummaryCard icon={<XCircle className="fluid-icon-sm" />} label="Descartados" value={batch.discarded_files} color="amber" />
          <SummaryCard icon={<AlertTriangle className="fluid-icon-sm" />} label="Errores" value={batch.error_files} color="red" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center fluid-gap-1 fluid-mb-4 border-b border-gray-200 pb-px">
        {TABS.map((tab) => {
          const count = tab.id === 'all' ? logsTotal : summary[tab.id as keyof typeof summary] || 0;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                fluid-px-4 fluid-py-2 fluid-text-sm font-medium rounded-t-lg
                transition-colors border-b-2
                ${isActive
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-gray-200 rounded-fluid-xl overflow-hidden">
        {loading ? (
          <div className="fluid-p-8 text-center">
            <Loader2 className="fluid-icon-md text-gray-400 animate-spin mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="fluid-p-8 text-center text-gray-400">
            <FileText className="fluid-icon-lg mx-auto fluid-mb-2 opacity-30" />
            <p className="fluid-text-sm">No hay registros para este filtro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Archivo</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">CURP</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">ECM</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Folio</th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-900 font-medium max-w-[180px] truncate" title={log.filename}>
                      {log.filename}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 font-mono">
                      {log.extracted_curp || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm">
                      {log.extracted_ecm_code ? (
                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-medium">
                          {log.extracted_ecm_code}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 max-w-[150px] truncate" title={log.extracted_name || ''}>
                      {log.extracted_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 font-mono">
                      {log.extracted_folio || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-gray-500 max-w-[200px]">
                      {log.discard_reason ? (
                        <span title={log.discard_detail || ''}>
                          <span className="font-medium text-gray-600">
                            {DISCARD_LABELS[log.discard_reason] || log.discard_reason}
                          </span>
                          {log.discard_detail && (
                            <span className="block text-gray-400 truncate">{log.discard_detail}</span>
                          )}
                        </span>
                      ) : log.status === 'matched' ? (
                        <span className="text-emerald-600">Certificado creado</span>
                      ) : log.status === 'replaced' ? (
                        <span className="text-blue-600">Certificado actualizado</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {logsPages > 1 && (
        <div className="flex items-center justify-between fluid-mt-4">
          <p className="fluid-text-sm text-gray-500">
            Página {currentPage} de {logsPages} ({logsTotal} registros)
          </p>
          <div className="flex items-center fluid-gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-2 rounded-fluid-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(logsPages, p + 1))}
              disabled={currentPage >= logsPages}
              className="p-2 rounded-fluid-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: number;
  color: 'emerald' | 'blue' | 'gray' | 'amber' | 'red';
}) {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  const numStyles: Record<string, string> = {
    emerald: 'text-emerald-900',
    blue: 'text-blue-900',
    gray: 'text-gray-900',
    amber: 'text-amber-900',
    red: 'text-red-900',
  };

  return (
    <div className={`border rounded-fluid-lg fluid-p-3 ${styles[color]}`}>
      <div className="flex items-center fluid-gap-2 fluid-mb-1">
        {icon}
        <span className="fluid-text-xs font-medium">{label}</span>
      </div>
      <p className={`fluid-text-xl font-bold ${numStyles[color]}`}>{value || 0}</p>
    </div>
  );
}
