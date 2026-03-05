/**
 * Detalle de una Carga Masiva
 *
 * Muestra:
 * 1. Header con gradiente y resumen rápido
 * 2. Stats cards con contadores
 * 3. Tarjeta con datos del batch (partner, plantel, grupo)
 * 4. Tabla de candidatos creados/asignados/errores con filtros
 * 5. Botón para descargar Excel
 */
import { useState, useEffect, useMemo } from 'react';
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
  BarChart3,
  Search,
  FileText,
  User,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getBulkUploadDetail,
  exportBulkUploadBatch,
  BulkUploadBatchDetail,
  BulkUploadMember,
} from '../../services/userManagementService';

const STATUS_CONFIG: Record<string, { label: string; color: string; badgeColor: string; icon: React.ReactNode }> = {
  created: {
    label: 'Creado',
    color: 'from-green-500 to-green-600',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <UserPlus className="w-3.5 h-3.5" />,
  },
  existing_assigned: {
    label: 'Existente asignado',
    color: 'from-blue-500 to-blue-600',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <UserCheck className="w-3.5 h-3.5" />,
  },
  error: {
    label: 'Error',
    color: 'from-red-500 to-red-600',
    badgeColor: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  skipped: {
    label: 'Omitido',
    color: 'from-gray-400 to-gray-500',
    badgeColor: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <SkipForward className="w-3.5 h-3.5" />,
  },
};

export default function BulkUploadDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BulkUploadBatchDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [memberSearch, setMemberSearch] = useState('');

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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badgeColor}`}
      >
        {cfg.icon}
        {cfg.label}
      </span>
    );
  };

  // Filter members by status + search
  const filteredMembers: BulkUploadMember[] = useMemo(() => {
    let members = batch?.members ?? [];
    if (statusFilter !== 'all') {
      members = members.filter((m) => m.status === statusFilter);
    }
    if (memberSearch.trim()) {
      const term = memberSearch.toLowerCase();
      members = members.filter(
        (m) =>
          (m.full_name || '').toLowerCase().includes(term) ||
          (m.email || '').toLowerCase().includes(term) ||
          (m.username || '').toLowerCase().includes(term) ||
          (m.curp || '').toLowerCase().includes(term)
      );
    }
    return members;
  }, [batch, statusFilter, memberSearch]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-14">
        <LoadingSpinner message="Cargando detalle de carga masiva..." />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
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
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-fluid-xl fluid-p-6 fluid-mb-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
              <FileSpreadsheet className="fluid-icon-lg" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold">
                Carga Masiva #{batch.id}
              </h1>
              <p className="fluid-text-sm text-indigo-100 fluid-mt-1">
                {formatDate(batch.created_at)} · {batch.uploaded_by_name || 'Usuario desconocido'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row fluid-gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-fluid-lg font-medium fluid-text-sm transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="fluid-icon-sm animate-spin" />
              ) : (
                <Download className="fluid-icon-sm" />
              )}
              Descargar Excel
            </button>
            <Link
              to="/user-management/bulk-history"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-fluid-lg font-medium fluid-text-sm transition-colors shadow-sm"
            >
              <ArrowLeft className="fluid-icon-sm" />
              Volver al Historial
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {(() => {
        const total = batch.total_processed || 1;
        const stats = [
          { label: 'Total Procesados', value: batch.total_processed, pct: 100, icon: <BarChart3 className="fluid-icon-sm text-white" />, gradient: 'from-blue-500 to-blue-600', bar: 'bg-blue-500', border: 'hover:border-blue-300' },
          { label: 'Creados', value: batch.total_created, pct: Math.round((batch.total_created / total) * 100), icon: <UserPlus className="fluid-icon-sm text-white" />, gradient: 'from-emerald-500 to-emerald-600', bar: 'bg-emerald-500', border: 'hover:border-emerald-300' },
          { label: 'Existentes Asignados', value: batch.total_existing_assigned, pct: Math.round((batch.total_existing_assigned / total) * 100), icon: <UserCheck className="fluid-icon-sm text-white" />, gradient: 'from-indigo-500 to-indigo-600', bar: 'bg-indigo-500', border: 'hover:border-indigo-300' },
          { label: 'Errores', value: batch.total_errors, pct: Math.round((batch.total_errors / total) * 100), icon: <XCircle className="fluid-icon-sm text-white" />, gradient: 'from-red-500 to-red-600', bar: 'bg-red-500', border: 'hover:border-red-300' },
          { label: 'Omitidos', value: batch.total_skipped, pct: Math.round((batch.total_skipped / total) * 100), icon: <SkipForward className="fluid-icon-sm text-white" />, gradient: 'from-gray-400 to-gray-500', bar: 'bg-gray-400', border: 'hover:border-gray-400' },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 fluid-gap-4 fluid-mb-6">
            {stats.map((s, i) => (
              <div key={i} className={`bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 ${s.border} hover:shadow-md transition-all`}>
                <div className="flex items-center fluid-gap-3">
                  <div className={`fluid-p-2.5 bg-gradient-to-br ${s.gradient} rounded-fluid-xl shadow-sm`}>
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="fluid-text-xs text-gray-500 font-medium truncate">{s.label}</p>
                    <div className="flex items-baseline fluid-gap-1.5">
                      <p className="fluid-text-xl font-bold text-gray-900">{s.value}</p>
                      {i > 0 && <span className="fluid-text-xs text-gray-400 font-medium">{s.pct}%</span>}
                    </div>
                  </div>
                </div>
                {i > 0 && (
                  <div className="mt-2.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${s.bar} rounded-full transition-all duration-500`} style={{ width: `${s.pct}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Información del Batch */}
      <div className="bg-white border-2 border-gray-200 rounded-fluid-xl fluid-p-6 fluid-mb-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 fluid-text-base fluid-mb-4 flex items-center fluid-gap-2">
          <FileText className="fluid-icon-base text-indigo-600" />
          Información de la Carga
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 fluid-gap-3">
          {[
            { icon: <Building2 className="w-4 h-4" />, label: 'Partner', value: batch.partner_name, color: 'text-violet-500', bg: 'bg-violet-50' },
            { icon: <Globe className="w-4 h-4" />, label: 'País', value: batch.country, color: 'text-sky-500', bg: 'bg-sky-50' },
            { icon: <MapPin className="w-4 h-4" />, label: 'Estado', value: batch.state_name, color: 'text-amber-500', bg: 'bg-amber-50' },
            { icon: <Building2 className="w-4 h-4" />, label: 'Plantel', value: batch.campus_name, color: 'text-teal-500', bg: 'bg-teal-50' },
            { icon: <Users className="w-4 h-4" />, label: 'Grupo', value: batch.group_name, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { icon: <Calendar className="w-4 h-4" />, label: 'Fecha', value: formatDate(batch.created_at), color: 'text-pink-500', bg: 'bg-pink-50' },
            { icon: <User className="w-4 h-4" />, label: 'Realizado por', value: batch.uploaded_by_name, color: 'text-cyan-500', bg: 'bg-cyan-50' },
            ...(batch.original_filename ? [{ icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Archivo', value: batch.original_filename, color: 'text-emerald-500', bg: 'bg-emerald-50' }] : []),
            { icon: <Mail className="w-4 h-4" />, label: 'Emails', value: `${batch.emails_sent} enviados${batch.emails_failed > 0 ? ` (${batch.emails_failed} fallidos)` : ''}`, color: 'text-orange-500', bg: 'bg-orange-50' },
          ].map((item, i) => (
            <div key={i} className="rounded-fluid-lg border border-gray-100 fluid-p-3 hover:shadow-sm transition-all">
              <div className="flex items-center fluid-gap-2 fluid-mb-1.5">
                <div className={`${item.bg} ${item.color} p-1.5 rounded-lg`}>
                  {item.icon}
                </div>
                <span className="fluid-text-xs text-gray-400 font-medium uppercase tracking-wider">{item.label}</span>
              </div>
              <p className="fluid-text-sm font-semibold text-gray-800 truncate pl-0.5" title={item.value || '—'}>
                {item.value || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Members table */}
      <div className="bg-white border-2 border-gray-200 rounded-fluid-xl overflow-hidden shadow-sm">
        {/* Table header with filters */}
        <div className="fluid-px-4 fluid-py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3">
            <h3 className="font-semibold text-gray-900 fluid-text-base">
              Candidatos ({filteredMembers.length})
            </h3>
            {/* Status filter tabs */}
            <div className="flex items-center fluid-gap-1.5 flex-wrap">
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
                  className={`inline-flex items-center fluid-gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    statusFilter === tab.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    statusFilter === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* Search inside members */}
          <div className="relative fluid-mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar candidato por nombre, email, usuario, CURP..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-9 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
            />
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="fluid-p-8 text-center text-gray-400 fluid-text-sm">
            No hay registros con este filtro
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    CURP
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Género
                  </th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-400 font-mono">
                      {m.row_number ?? '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-900 font-medium">
                      {m.user_id ? (
                        <Link
                          to={`/user-management/${m.user_id}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                        >
                          {m.full_name || '—'}
                        </Link>
                      ) : (
                        m.full_name || '—'
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600">
                      {m.email || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 font-mono">
                      {m.username || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 font-mono">
                      {m.curp || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600">
                      {m.gender === 'M' ? 'Masculino' : m.gender === 'F' ? 'Femenino' : m.gender || '—'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      {getStatusBadge(m.status)}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-500 max-w-[250px]">
                      {m.error_message ? (
                        <span className="text-red-600 fluid-text-xs">{m.error_message}</span>
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
    </div>
  );
}
