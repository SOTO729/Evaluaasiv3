/**
 * Histórico de Altas Masivas
 *
 * Tabla con todas las cargas masivas realizadas:
 * fecha, partner, país, estado, plantel, grupo, resumen.
 * Clic en una fila → detalle.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  FileArchive,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  UserPlus,
  UserCheck,
  XCircle,
  BarChart3,
  Search,
  Download,
  Loader2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBulkUploadHistory,
  exportBulkUploadBatch,
  BulkUploadBatchSummary,
} from '../../services/userManagementService';

export default function BulkUploadHistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BulkUploadBatchSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportingId, setExportingId] = useState<number | null>(null);

  const handleExportBatch = async (e: React.MouseEvent, batch: BulkUploadBatchSummary) => {
    e.stopPropagation();
    try {
      setExportingId(batch.id);
      await exportBulkUploadBatch(batch.id, batch.group_name || undefined);
    } catch {
      // silent
    } finally {
      setExportingId(null);
    }
  };

  const loadData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const data = await getBulkUploadHistory({
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Aggregate stats from current page batches
  const aggregateStats = useMemo(() => {
    return batches.reduce(
      (acc, b) => ({
        totalCreated: acc.totalCreated + (b.total_created || 0),
        totalExisting: acc.totalExisting + (b.total_existing_assigned || 0),
        totalErrors: acc.totalErrors + (b.total_errors || 0),
        totalProcessed: acc.totalProcessed + (b.total_processed || 0),
      }),
      { totalCreated: 0, totalExisting: 0, totalErrors: 0, totalProcessed: 0 }
    );
  }, [batches]);

  // Filter batches by search term (client-side)
  const filteredBatches = useMemo(() => {
    if (!searchTerm.trim()) return batches;
    const term = searchTerm.toLowerCase();
    return batches.filter(
      (b) =>
        (b.partner_name || '').toLowerCase().includes(term) ||
        (b.campus_name || '').toLowerCase().includes(term) ||
        (b.group_name || '').toLowerCase().includes(term) ||
        (b.uploaded_by_name || '').toLowerCase().includes(term) ||
        (b.country || '').toLowerCase().includes(term) ||
        (b.state_name || '').toLowerCase().includes(term)
    );
  }, [batches, searchTerm]);

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-14">
        <LoadingSpinner message="Cargando historial de altas masivas..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-fluid-xl fluid-p-6 fluid-mb-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
              <Activity className="fluid-icon-lg" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold">Histórico de Altas Masivas</h1>
              <p className="fluid-text-sm text-indigo-100 fluid-mt-1">
                {total} cargas registradas en el sistema
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row fluid-gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-fluid-lg font-medium fluid-text-sm transition-colors"
            >
              <RefreshCw className={`fluid-icon-sm ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <Link
              to="/user-management"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-fluid-lg font-medium fluid-text-sm transition-colors shadow-sm"
            >
              <ArrowLeft className="fluid-icon-sm" />
              Gestión de Usuarios
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-3 fluid-mb-4 flex items-center fluid-gap-2">
          <AlertTriangle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      {batches.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-fluid-xl shadow-sm">
                <BarChart3 className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Total Procesados</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{aggregateStats.totalProcessed}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-green-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-fluid-xl shadow-sm">
                <UserPlus className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Creados</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{aggregateStats.totalCreated}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-indigo-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-fluid-xl shadow-sm">
                <UserCheck className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Existentes Asignados</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{aggregateStats.totalExisting}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-red-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-fluid-xl shadow-sm">
                <XCircle className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Errores</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{aggregateStats.totalErrors}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {batches.length === 0 ? (
        <div className="bg-white border-2 border-gray-200 rounded-fluid-xl fluid-p-10 text-center shadow-sm">
          <FileArchive className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="font-semibold text-gray-600 fluid-text-lg fluid-mb-1">No hay cargas registradas</h3>
          <p className="text-gray-400 fluid-text-sm fluid-mb-4">
            Realiza una carga masiva de candidatos desde Gestión de Usuarios
          </p>
          <Link
            to="/user-management"
            className="inline-flex items-center fluid-gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
          >
            <Upload className="fluid-icon-sm" />
            Ir a Gestión de Usuarios
          </Link>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 fluid-mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por partner, plantel, grupo, usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 fluid-py-2.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-fluid-xl overflow-hidden shadow-sm">
            {/* Table header with count */}
            <div className="fluid-px-4 fluid-py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="fluid-text-sm text-gray-600 font-medium">
                Mostrando {filteredBatches.length} de {total} registros
              </p>
              {totalPages > 1 && (
                <p className="fluid-text-sm text-gray-500">
                  Página {currentPage} de {totalPages}
                </p>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Realizado por
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Partner
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      País / Estado
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Plantel
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Grupo
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Resultado
                    </th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBatches.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/user-management/bulk-history/${b.id}`)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap font-medium">
                        {b.uploaded_by_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {b.partner_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{b.country || '—'}</span>
                          {b.state_name && (
                            <span className="fluid-text-xs text-gray-400">{b.state_name}</span>
                          )}
                        </div>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 whitespace-nowrap max-w-[180px] truncate">
                        {b.campus_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 whitespace-nowrap">
                        {b.group_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm">
                        <div className="flex flex-col fluid-gap-1">
                          {/* Progress bar */}
                          <div className="flex items-center fluid-gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex" style={{ maxWidth: '140px' }}>
                              {b.total_processed > 0 && (
                                <>
                                  <div
                                    className="h-full bg-emerald-500 transition-all"
                                    style={{ width: `${(b.total_created / b.total_processed) * 100}%` }}
                                  />
                                  <div
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${(b.total_existing_assigned / b.total_processed) * 100}%` }}
                                  />
                                  {b.total_errors > 0 && (
                                    <div
                                      className="h-full bg-red-400 transition-all"
                                      style={{ width: `${(b.total_errors / b.total_processed) * 100}%` }}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                            <span className="fluid-text-xs font-semibold text-gray-500 whitespace-nowrap">
                              {b.total_processed}
                            </span>
                          </div>
                          {/* Labels */}
                          <div className="flex items-center fluid-gap-3 fluid-text-xs text-gray-500">
                            <span className="inline-flex items-center fluid-gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                              {b.total_created} nuevos
                            </span>
                            <span className="inline-flex items-center fluid-gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                              {b.total_existing_assigned} exist.
                            </span>
                            {b.total_errors > 0 && (
                              <span className="inline-flex items-center fluid-gap-1 text-red-500 font-medium">
                                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                                {b.total_errors} error{b.total_errors !== 1 ? 'es' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <div className="inline-flex items-center fluid-gap-1">
                          <button
                            onClick={(e) => handleExportBatch(e, b)}
                            disabled={exportingId === b.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            title="Descargar reporte Excel"
                          >
                            {exportingId === b.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/user-management/bulk-history/${b.id}`);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="fluid-px-4 fluid-py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <p className="fluid-text-sm text-gray-500">
                  Página {currentPage} de {totalPages} ({total} registros)
                </p>
                <div className="flex items-center fluid-gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
