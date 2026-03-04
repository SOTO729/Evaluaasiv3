/**
 * Histórico de Altas Masivas
 *
 * Tabla con todas las cargas masivas realizadas:
 * fecha, partner, país, estado, plantel, grupo, resumen.
 * Clic en una fila → detalle.
 */
import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBulkUploadHistory,
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

  if (loading && !refreshing) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-14">
        <LoadingSpinner message="Cargando historial de altas masivas..." />
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-mb-6 fluid-gap-4">
        <div>
          <Link
            to="/user-management"
            className="inline-flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-3 transition-colors"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver a Gestión de Usuarios
          </Link>
          <h1 className="fluid-text-2xl font-bold text-gray-900">Histórico de Altas Masivas</h1>
          <p className="text-gray-500 fluid-text-sm">{total} cargas registradas</p>
        </div>
        <div className="flex items-center fluid-gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="inline-flex items-center fluid-gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 fluid-px-4 fluid-py-2 rounded-fluid-lg transition-colors fluid-text-sm"
          >
            <RefreshCw className={`fluid-icon-sm ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
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
            Realiza una carga masiva de candidatos desde Gestión de Usuarios
          </p>
          <Link
            to="/user-management"
            className="inline-flex items-center fluid-gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold fluid-px-5 fluid-py-2.5 rounded-fluid-lg transition-colors"
          >
            <Upload className="fluid-icon-sm" />
            Ir a Gestión de Usuarios
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-fluid-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Realizado por
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Partner
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      País
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Plantel
                    </th>
                    <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Grupo
                    </th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Creados
                    </th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Existentes
                    </th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Errores
                    </th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/user-management/bulk-history/${b.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(b.created_at)}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {b.uploaded_by_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {b.partner_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {b.country || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {b.state_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {b.campus_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-700 whitespace-nowrap">
                        {b.group_name || '—'}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                          {b.total_created}
                        </span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {b.total_existing_assigned}
                        </span>
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-center">
                        {b.total_errors > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            {b.total_errors}
                          </span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-center font-medium text-gray-900">
                        {b.total_processed}
                      </td>
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/user-management/bulk-history/${b.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
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
                  className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
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
