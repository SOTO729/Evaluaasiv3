/**
 * Detalle de una Carga Masiva
 *
 * Muestra:
 * 1. Tarjeta resumen con datos del batch (partner, plantel, grupo, contadores)
 * 2. Tabla de candidatos creados/asignados/errores
 * 3. Botón para descargar Excel
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  UserPlus,
  UserCheck,
  XCircle,
  SkipForward,
  Building2,
  MapPin,
  Globe,
  Users,
  Calendar,
  Mail,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBulkUploadDetail,
  exportBulkUploadBatch,
  BulkUploadBatchDetail,
  BulkUploadMember,
} from '../../services/userManagementService';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created: {
    label: 'Creado',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <UserPlus className="w-3 h-3" />,
  },
  existing_assigned: {
    label: 'Existente asignado',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <UserCheck className="w-3 h-3" />,
  },
  error: {
    label: 'Error',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="w-3 h-3" />,
  },
  skipped: {
    label: 'Omitido',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <SkipForward className="w-3 h-3" />,
  },
};

export default function BulkUploadDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BulkUploadBatchDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBulkUploadDetail(Number(batchId));
        setBatch(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar el detalle');
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  const handleExport = async () => {
    if (!batch) return;
    try {
      setExporting(true);
      await exportBulkUploadBatch(batch.id, batch.group_name || undefined);
    } catch (err: any) {
      alert(err.message || 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['skipped'];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  // Filtrar miembros por status
  const filteredMembers: BulkUploadMember[] =
    batch?.members?.filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter)) ?? [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-14">
        <LoadingSpinner message="Cargando detalle de carga masiva..." />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
        <Link
          to="/user-management/bulk-history"
          className="inline-flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-4 transition-colors"
        >
          <ArrowLeft className="fluid-icon-sm" />
          Volver al Historial
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 flex items-center fluid-gap-2">
          <AlertTriangle className="fluid-icon-sm text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error || 'Registro no encontrado'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-mb-6 fluid-gap-4">
        <div>
          <Link
            to="/user-management/bulk-history"
            className="inline-flex items-center fluid-gap-2 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-3 transition-colors"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver al Historial
          </Link>
          <h1 className="fluid-text-2xl font-bold text-gray-900">
            Detalle de Carga Masiva #{batch.id}
          </h1>
          <p className="text-gray-500 fluid-text-sm">{formatDate(batch.created_at)}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center fluid-gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold fluid-px-4 fluid-py-2 rounded-fluid-lg transition-colors fluid-text-sm disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="fluid-icon-sm animate-spin" />
          ) : (
            <Download className="fluid-icon-sm" />
          )}
          Descargar Excel
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white border border-gray-200 rounded-fluid-xl fluid-p-6 fluid-mb-6">
        <h2 className="font-semibold text-gray-900 fluid-text-lg fluid-mb-4 flex items-center fluid-gap-2">
          <FileSpreadsheet className="fluid-icon-base text-blue-600" />
          Resumen de la Carga
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 fluid-gap-4 fluid-mb-6">
          {/* Info de destino */}
          <div className="space-y-2">
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Partner:</span>
              <span className="fluid-text-sm">{batch.partner_name || '—'}</span>
            </div>
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">País:</span>
              <span className="fluid-text-sm">{batch.country || '—'}</span>
            </div>
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Estado:</span>
              <span className="fluid-text-sm">{batch.state_name || '—'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Plantel:</span>
              <span className="fluid-text-sm">{batch.campus_name || '—'}</span>
            </div>
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Grupo:</span>
              <span className="fluid-text-sm">{batch.group_name || '—'}</span>
            </div>
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Fecha:</span>
              <span className="fluid-text-sm">{formatDate(batch.created_at)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Realizado por:</span>
              <span className="fluid-text-sm">{batch.uploaded_by_name || '—'}</span>
            </div>
            {batch.original_filename && (
              <div className="flex items-center fluid-gap-2 text-gray-600">
                <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                <span className="fluid-text-sm font-medium">Archivo:</span>
                <span className="fluid-text-sm truncate max-w-[200px]">{batch.original_filename}</span>
              </div>
            )}
            <div className="flex items-center fluid-gap-2 text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="fluid-text-sm font-medium">Emails enviados:</span>
              <span className="fluid-text-sm">
                {batch.emails_sent}
                {batch.emails_failed > 0 && (
                  <span className="text-red-500 ml-1">({batch.emails_failed} fallidos)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Stat counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 fluid-gap-3">
          <div className="bg-gray-50 rounded-fluid-lg fluid-p-3 text-center">
            <p className="fluid-text-2xl font-bold text-gray-900">{batch.total_processed}</p>
            <p className="fluid-text-xs text-gray-500">Total procesados</p>
          </div>
          <div className="bg-emerald-50 rounded-fluid-lg fluid-p-3 text-center">
            <p className="fluid-text-2xl font-bold text-emerald-700">{batch.total_created}</p>
            <p className="fluid-text-xs text-emerald-600">Creados</p>
          </div>
          <div className="bg-blue-50 rounded-fluid-lg fluid-p-3 text-center">
            <p className="fluid-text-2xl font-bold text-blue-700">{batch.total_existing_assigned}</p>
            <p className="fluid-text-xs text-blue-600">Existentes asignados</p>
          </div>
          <div className="bg-red-50 rounded-fluid-lg fluid-p-3 text-center">
            <p className="fluid-text-2xl font-bold text-red-700">{batch.total_errors}</p>
            <p className="fluid-text-xs text-red-600">Errores</p>
          </div>
          <div className="bg-gray-50 rounded-fluid-lg fluid-p-3 text-center">
            <p className="fluid-text-2xl font-bold text-gray-600">{batch.total_skipped}</p>
            <p className="fluid-text-xs text-gray-500">Omitidos</p>
          </div>
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white border border-gray-200 rounded-fluid-xl overflow-hidden">
        <div className="fluid-px-4 fluid-py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3">
          <h3 className="font-semibold text-gray-900 fluid-text-base">
            Candidatos ({filteredMembers.length})
          </h3>
          {/* Status filter tabs */}
          <div className="flex items-center fluid-gap-1 flex-wrap">
            {[
              { key: 'all', label: 'Todos', count: batch.members?.length ?? 0 },
              { key: 'created', label: 'Creados', count: batch.total_created },
              { key: 'existing_assigned', label: 'Existentes', count: batch.total_existing_assigned },
              { key: 'error', label: 'Errores', count: batch.total_errors },
              { key: 'skipped', label: 'Omitidos', count: batch.total_skipped },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="fluid-p-8 text-center text-gray-400 fluid-text-sm">
            No hay registros con este filtro
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Fila
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Nombre
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Usuario
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    CURP
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Género
                  </th>
                  <th className="text-center fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-2.5 fluid-text-xs font-semibold text-gray-500 uppercase">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-500">
                      {m.row_number ?? '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-900 font-medium">
                      {m.user_id ? (
                        <Link
                          to={`/user-management/${m.user_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {m.full_name || '—'}
                        </Link>
                      ) : (
                        m.full_name || '—'
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-600">
                      {m.email || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-600 font-mono">
                      {m.username || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-600 font-mono">
                      {m.curp || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-600">
                      {m.gender === 'M' ? 'Masculino' : m.gender === 'F' ? 'Femenino' : m.gender || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 text-center">
                      {getStatusBadge(m.status)}
                    </td>
                    <td className="fluid-px-4 fluid-py-2.5 fluid-text-sm text-gray-500">
                      {m.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
