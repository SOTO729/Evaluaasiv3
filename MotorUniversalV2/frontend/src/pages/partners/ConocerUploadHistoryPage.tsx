/**
 * Página de Historial de Cargas de Certificados CONOCER
 *
 * Muestra todos los batches de carga masiva con paginación,
 * estado, contadores y navegación al detalle.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getConocerUploadBatches,
  ConocerUploadBatch,
} from '../../services/partnersService';

export default function ConocerUploadHistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ConocerUploadBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const data = await getConocerUploadBatches({
        page: currentPage,
        per_page: perPage,
      });
      setBatches(data.batches);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el historial');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, perPage, refreshing]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      queued: {
        label: 'En cola',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: <Clock className="w-3 h-3" />,
      },
      processing: {
        label: 'Procesando',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      },
      completed: {
        label: 'Completado',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 className="w-3 h-3" />,
      },
      failed: {
        label: 'Fallido',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <XCircle className="w-3 h-3" />,
      },
    };
    const s = map[status] || map['queued'];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
        {s.icon}
        {s.label}
      </span>
    );
  };

  const getDuration = (b: ConocerUploadBatch) => {
    if (!b.started_at || !b.completed_at) return '—';
    const ms = new Date(b.completed_at).getTime() - new Date(b.started_at).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-14">
        <LoadingSpinner message="Cargando historial..." />
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-mb-6 fluid-gap-4">
        <div>
          <Link
            to="/tramites-conocer"
            className="inline-flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-3 transition-colors"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver a Trámites CONOCER
          </Link>
          <h1 className="fluid-text-2xl font-bold text-gray-900">Historial de Cargas</h1>
          <p className="text-gray-500 fluid-text-sm">{total} cargas registradas</p>
        </div>
        <div className="flex items-center fluid-gap-3">
          <button
            onClick={() => { setRefreshing(true); loadData(); }}
            disabled={refreshing}
            className="inline-flex items-center fluid-gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 fluid-px-4 fluid-py-2 rounded-fluid-lg transition-colors fluid-text-sm"
          >
            <RefreshCw className={`fluid-icon-sm ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <Link
            to="/tramites-conocer/subir"
            className="inline-flex items-center fluid-gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold fluid-px-4 fluid-py-2 rounded-fluid-lg transition-colors fluid-text-sm"
          >
            <Upload className="fluid-icon-sm" />
            Nueva Carga
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-mb-4 flex items-center fluid-gap-2">
          <AlertTriangle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      {batches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-fluid-xl fluid-p-10 text-center">
          <FileArchive className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="font-semibold text-gray-600 fluid-text-lg fluid-mb-1">No hay cargas registradas</h3>
          <p className="text-gray-400 fluid-text-sm fluid-mb-4">
            Sube un archivo ZIP con certificados CONOCER para comenzar
          </p>
          <Link
            to="/tramites-conocer/subir"
            className="inline-flex items-center fluid-gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
          >
            <Upload className="fluid-icon-sm" />
            Subir Certificados
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-fluid-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Archivo</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Nuevos</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Reemp.</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Desc.</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Errores</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">Duración</th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/tramites-conocer/historial/${b.id}`)}
                    >
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm font-medium text-gray-900 max-w-[200px] truncate">
                        {b.filename}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 text-center font-medium">
                        {b.total_files}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-emerald-600 text-center font-semibold">
                        {b.matched_files || 0}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-blue-600 text-center font-semibold">
                        {b.replaced_files || 0}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-amber-600 text-center font-semibold">
                        {b.discarded_files || 0}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-red-600 text-center font-semibold">
                        {b.error_files || 0}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        {getStatusBadge(b.status)}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-500 text-center whitespace-nowrap">
                        {getDuration(b)}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <button className="text-gray-400 hover:text-emerald-600 transition-colors">
                          <Eye className="fluid-icon-sm" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between fluid-mt-4">
              <p className="fluid-text-sm text-gray-500">
                Página {currentPage} de {totalPages} ({total} registros)
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-fluid-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
