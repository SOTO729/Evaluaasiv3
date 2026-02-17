/**
 * CertificateTypePage — Componente base reutilizable para cada tipo de certificado.
 * Muestra tabla de candidatos certificados con selección individual al estilo
 * de assign-candidates, panel de información y descarga (PDF/ZIP).
 *
 * Props:
 * - certType: 'tier_basic' | 'tier_standard' | 'tier_advanced' | 'digital_badge'
 * - title / subtitle / icon / colors
 * - downloadEnabled: si se permite descargar (false para digital_badge)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Search, Download, RefreshCw, X, Loader2,
  CheckSquare, Square, Eye,
  ArrowUpDown, ArrowUp, ArrowDown, Users, AlertCircle,
  CheckCircle2, Clock, XCircle, Package,
  type LucideIcon,
} from 'lucide-react';
import CandidateCertDetailModal from './CandidateCertDetailModal';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupCertificatesStats,
  downloadGroupCertificatesZip,
  generateGroupCertificates,
  GroupCertificatesStats,
  CandidateGroup,
} from '../../../services/partnersService';

type CertificateType = 'tier_basic' | 'tier_standard' | 'tier_advanced' | 'digital_badge';

interface CertificateTypePageProps {
  certType: CertificateType;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  headerGradient: string;       // tailwind gradient classes
  accentColor: string;          // e.g. 'blue', 'purple', 'emerald', 'amber'
  downloadEnabled: boolean;
  canGenerate: boolean;         // tier_basic/tier_standard can generate on-demand
}

// Row type enriched per cert type
interface CertRow {
  user_id: string;
  full_name: string;
  email: string | null;
  curp: string | null;
  exams_approved: number;
  status: 'ready' | 'pending';  // ready = has PDF/cert, pending = needs generation
  resultCount: number;          // number of results with this cert type
  readyCount: number;
  pendingCount: number;
}

export default function CertificateTypePage({
  certType, title, subtitle, icon: Icon,
  headerGradient, accentColor,
  downloadEnabled, canGenerate,
}: CertificateTypePageProps) {
  const { groupId } = useParams();

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [stats, setStats] = useState<GroupCertificatesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selection
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  // Search & sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string>('full_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Detail modal
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailUserName, setDetailUserName] = useState('');

  // Actions
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load data
  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [groupData, statsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupCertificatesStats(Number(groupId)),
      ]);
      setGroup(groupData);
      setStats(statsData);

      // Auto-regenerate pending PDFs on load (replaces the old "Regenerar PDFs" button)
      if (canGenerate && statsData) {
        const summaryKey = certType === 'tier_basic' ? 'tier_basic' : 'tier_standard';
        const pending = statsData.summary[summaryKey]?.pending || 0;
        if (pending > 0) {
          try {
            await generateGroupCertificates(Number(groupId), certType as 'tier_basic' | 'tier_standard');
            // Reload stats to get updated counts
            const refreshed = await getGroupCertificatesStats(Number(groupId));
            setStats(refreshed);
          } catch {
            // Silently fail auto-generation; user can manually refresh
          }
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [groupId, certType, canGenerate]);

  // Build rows from stats
  const rows = useMemo((): CertRow[] => {
    if (!stats) return [];
    return stats.candidates
      .filter(c => c.exams_approved > 0) // only certified candidates
      .map(c => {
        let readyCount = 0;
        let pendingCount = 0;

        switch (certType) {
          case 'tier_basic':
            readyCount = c.tier_basic_ready;
            pendingCount = c.tier_basic_pending;
            break;
          case 'tier_standard':
            readyCount = c.tier_standard_ready;
            pendingCount = c.tier_standard_pending;
            break;
          case 'tier_advanced':
            readyCount = c.tier_advanced_count;
            break;
          case 'digital_badge':
            readyCount = c.digital_badge_count;
            break;
        }

        const totalForType = readyCount + pendingCount;
        return {
          user_id: c.user_id,
          full_name: c.full_name,
          email: c.email,
          curp: c.curp,
          exams_approved: c.exams_approved,
          status: pendingCount > 0 ? 'pending' as const : 'ready' as const,
          resultCount: totalForType,
          readyCount,
          pendingCount,
        };
      })
      .filter(r => r.resultCount > 0 || certType === 'tier_basic' || certType === 'tier_standard');
      // For tier_basic/tier_standard, show ALL certified candidates (they all get reports/certs)
  }, [stats, certType]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(r =>
      r.full_name.toLowerCase().includes(q) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.curp && r.curp.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let va = '', vb = '';
      switch (sortCol) {
        case 'full_name': va = a.full_name; vb = b.full_name; break;
        case 'email': va = a.email || ''; vb = b.email || ''; break;
        case 'curp': va = a.curp || ''; vb = b.curp || ''; break;
        case 'status': va = a.status; vb = b.status; break;
        case 'readyCount': return sortDir === 'asc' ? a.readyCount - b.readyCount : b.readyCount - a.readyCount;
        default: va = a.full_name; vb = b.full_name;
      }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return sorted;
  }, [filteredRows, sortCol, sortDir]);

  // Selection helpers
  const allOnPageSelected = sortedRows.length > 0 && sortedRows.every(r => selectedCandidates.has(r.user_id));

  const handleToggleCandidate = (userId: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(sortedRows.map(r => r.user_id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
  };

  // Sort handler
  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const renderSortIcon = (col: string) => {
    if (sortCol === col) {
      return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
  };

  // Download handler — 1 selected = PDF via ZIP with single file, 2+ = ZIP
  const handleDownloadSelected = async () => {
    if (!downloadEnabled || selectedCandidates.size === 0) return;

    try {
      setDownloading(true);
      setError(null);

      const userIds = Array.from(selectedCandidates);
      const types = [certType].filter(t => t !== 'digital_badge') as ('tier_basic' | 'tier_standard' | 'tier_advanced')[];

      const blob = await downloadGroupCertificatesZip(Number(groupId), types, userIds);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      if (selectedCandidates.size === 1) {
        // Single candidate — rename to PDF
        const candidate = rows.find(r => r.user_id === userIds[0]);
        const name = candidate?.full_name.replace(/\s+/g, '_') || 'certificado';
        a.download = `${title.replace(/\s+/g, '_')}_${name}.zip`;
      } else {
        a.download = `${title.replace(/\s+/g, '_')}_${group?.name?.replace(/\s+/g, '_') || 'grupo'}_${new Date().toISOString().split('T')[0]}.zip`;
      }

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessMessage(`Descarga completada: ${selectedCandidates.size} candidato(s)`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar certificados');
    } finally {
      setDownloading(false);
    }
  };

  // Download ALL
  const handleDownloadAll = async () => {
    if (!downloadEnabled) return;

    try {
      setDownloading(true);
      setError(null);

      const types = [certType].filter(t => t !== 'digital_badge') as ('tier_basic' | 'tier_standard' | 'tier_advanced')[];
      const blob = await downloadGroupCertificatesZip(Number(groupId), types);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${group?.name?.replace(/\s+/g, '_') || 'grupo'}_Completo_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessMessage('Descarga completa del grupo finalizada');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar certificados');
    } finally {
      setDownloading(false);
    }
  };

  // Manual generate pending (fallback if auto-gen failed)
  const handleGeneratePending = async () => {
    if (!canGenerate) return;
    try {
      setGenerating(true);
      setError(null);
      await generateGroupCertificates(Number(groupId), certType as 'tier_basic' | 'tier_standard');
      await loadData();
      setSuccessMessage('PDFs generados exitosamente');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar certificados');
    } finally {
      setGenerating(false);
    }
  };

  // Summary counts
  const totalCertified = rows.length;
  const totalReady = rows.reduce((acc, r) => acc + r.readyCount, 0);
  const totalPending = rows.reduce((acc, r) => acc + r.pendingCount, 0);

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando certificados..." />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700">{error}</p>
          <Link to={`/partners/groups/${groupId}/documents`} className="ml-auto text-red-700 underline">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: group?.campus?.partner?.name || 'Partner', path: `/partners/${group?.campus?.partner_id}` },
          { label: group?.campus?.name || 'Plantel', path: `/partners/campuses/${group?.campus_id}` },
          { label: group?.name || 'Grupo', path: `/partners/groups/${groupId}` },
          { label: 'Documentos', path: `/partners/groups/${groupId}/documents` },
          { label: title },
        ]}
      />

      {/* Header */}
      <div className={`${headerGradient} rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/groups/${groupId}/documents`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <p className="fluid-text-sm text-white/80 fluid-mb-1">{group?.name}</p>
              <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                <Icon className="fluid-icon-lg" />
                {title}
              </h1>
              <p className="fluid-text-sm text-white/70 mt-1">{subtitle}</p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center fluid-gap-3 flex-wrap">
            {canGenerate && totalPending > 0 && (
              <button
                onClick={handleGeneratePending}
                disabled={generating}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl text-white font-medium fluid-text-sm transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="fluid-icon-sm animate-spin" /> : <RefreshCw className="fluid-icon-sm" />}
                Generar pendientes ({totalPending})
              </button>
            )}
            {downloadEnabled && (
              <button
                onClick={handleDownloadAll}
                disabled={downloading || totalReady === 0}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl text-white font-medium fluid-text-sm transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="fluid-icon-sm animate-spin" /> : <Package className="fluid-icon-sm" />}
                Descargar Todo ({totalReady})
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-4 fluid-mt-6">
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{totalCertified}</p>
            <p className="fluid-text-xs text-white/70">Candidatos</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{totalReady}</p>
            <p className="fluid-text-xs text-white/70">Listos</p>
          </div>
          {totalPending > 0 && (
            <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
              <p className="fluid-text-2xl font-bold">{totalPending}</p>
              <p className="fluid-text-xs text-white/70">Pendientes</p>
            </div>
          )}
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{selectedCandidates.size}</p>
            <p className="fluid-text-xs text-white/70">Seleccionados</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {(error || successMessage) && (
        <div className="fluid-mb-4">
          {error && (
            <div className="fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-2 text-red-700">
              <XCircle className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)}><X className="fluid-icon-sm" /></button>
            </div>
          )}
          {successMessage && (
            <div className="fluid-p-3 bg-green-50 border border-green-200 rounded-fluid-lg flex items-center fluid-gap-2 text-green-700">
              <CheckCircle2 className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm flex-1">{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)}><X className="fluid-icon-sm" /></button>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5">
        <div className="flex flex-wrap items-center fluid-gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, CURP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="fluid-icon-sm" />
              </button>
            )}
          </div>

          {/* Selection info */}
          {selectedCandidates.size > 0 && (
            <div className="flex items-center fluid-gap-2">
              <span className={`fluid-text-sm font-medium text-${accentColor}-700`}>
                {selectedCandidates.size} seleccionado(s)
              </span>
              <button
                onClick={handleClearSelection}
                className="fluid-text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Limpiar
              </button>
            </div>
          )}

          {/* Download selected */}
          {downloadEnabled && selectedCandidates.size > 0 && (
            <button
              onClick={handleDownloadSelected}
              disabled={downloading}
              className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-${accentColor}-600 hover:bg-${accentColor}-700 text-white rounded-fluid-xl font-medium fluid-text-sm transition-colors disabled:opacity-50`}
            >
              {downloading ? <Loader2 className="fluid-icon-sm animate-spin" /> : <Download className="fluid-icon-sm" />}
              Descargar {selectedCandidates.size === 1 ? 'PDF' : `ZIP (${selectedCandidates.size})`}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => loadData()}
            className="fluid-p-2 hover:bg-gray-100 rounded-fluid-lg transition-colors text-gray-500"
            title="Refrescar"
          >
            <RefreshCw className="fluid-icon-sm" />
          </button>
        </div>

        <p className="fluid-text-xs text-gray-400 mt-2">
          {filteredRows.length === rows.length
            ? `${rows.length} candidato(s) certificado(s)`
            : `${filteredRows.length} de ${rows.length} candidato(s)`}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full fluid-text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {/* Checkbox column */}
                <th className="w-12 fluid-px-4 fluid-py-3 text-center">
                  <button onClick={handleToggleSelectAll} className="text-gray-500 hover:text-gray-700">
                    {allOnPageSelected && sortedRows.length > 0
                      ? <CheckSquare className="h-5 w-5 text-blue-600" />
                      : <Square className="h-5 w-5" />}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('full_name')}
                  className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                >
                  Candidato{renderSortIcon('full_name')}
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap hidden md:table-cell"
                >
                  Email{renderSortIcon('email')}
                </th>
                <th
                  onClick={() => handleSort('curp')}
                  className="text-left fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap hidden lg:table-cell"
                >
                  CURP{renderSortIcon('curp')}
                </th>
                <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium whitespace-nowrap">
                  Exámenes
                </th>
                <th
                  onClick={() => handleSort('readyCount')}
                  className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                >
                  Listos{renderSortIcon('readyCount')}
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                >
                  Estado{renderSortIcon('status')}
                </th>
                <th className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium whitespace-nowrap">
                  Detalles
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRows.map(row => {
                const isSelected = selectedCandidates.has(row.user_id);
                return (
                  <tr
                    key={row.user_id}
                    onClick={() => handleToggleCandidate(row.user_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="w-12 fluid-px-4 fluid-py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleToggleCandidate(row.user_id)} className="text-gray-500 hover:text-gray-700">
                        {isSelected
                          ? <CheckSquare className="h-5 w-5 text-blue-600" />
                          : <Square className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <div className="flex items-center fluid-gap-3">
                        <div className={`w-8 h-8 rounded-full bg-${accentColor}-100 flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-xs font-bold text-${accentColor}-700`}>
                            {row.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{row.full_name}</p>
                          <p className="fluid-text-xs text-gray-500 md:hidden truncate">{row.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-gray-600 hidden md:table-cell">
                      <span className="truncate block max-w-[200px]">{row.email || '-'}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-gray-500 font-mono text-xs hidden lg:table-cell">
                      {row.curp || '-'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {row.exams_approved}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />{row.readyCount}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      {row.status === 'ready' ? (
                        <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle2 className="w-3 h-3" />Listo
                        </span>
                      ) : (
                        <span className="inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" />Pendiente
                        </span>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setDetailUserId(row.user_id);
                          setDetailUserName(row.full_name);
                        }}
                        className="inline-flex items-center fluid-gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-fluid-lg transition-colors"
                        title="Ver detalle de certificación"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="fluid-px-4 fluid-py-12 text-center text-gray-400">
                    <Users className="fluid-icon-lg mx-auto mb-2 text-gray-300" />
                    <p className="fluid-text-sm">
                      {searchQuery ? 'No se encontraron candidatos para la búsqueda' : 'No hay candidatos certificados aún'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <CandidateCertDetailModal
        isOpen={!!detailUserId}
        onClose={() => setDetailUserId(null)}
        groupId={Number(groupId)}
        userId={detailUserId || ''}
        userName={detailUserName}
      />
    </div>
  );
}
