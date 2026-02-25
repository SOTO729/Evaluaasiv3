/**
 * CertificateTypePage — Componente base reutilizable para cada tipo de certificado.
 * Server-side pagination para manejar cientos de miles de registros.
 *
 * Props:
 * - certType: 'tier_basic' | 'tier_standard' | 'tier_advanced' | 'digital_badge'
 * - title / subtitle / icon / colors
 * - downloadEnabled: si se permite descargar (false para digital_badge)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Search, Download, RefreshCw, X, Loader2,
  CheckSquare, Square, Eye,
  ArrowUpDown, ArrowUp, ArrowDown, Users, AlertCircle,
  CheckCircle2, Clock, XCircle, Package,
  ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import CandidateCertDetailModal from './CandidateCertDetailModal';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupCertificatesStats,
  getGroupCertificatesCandidates,
  downloadGroupCertificatesZip,
  generateGroupCertificates,
  GroupCertificatesStats,
  CandidateCertificateStats,
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
  extraHeaderActions?: React.ReactNode;
}

export default function CertificateTypePage({
  certType, title, subtitle, icon: Icon,
  headerGradient, accentColor,
  downloadEnabled, canGenerate,
  extraHeaderActions,
}: CertificateTypePageProps) {
  const { groupId } = useParams();

  // Initial data (group + summary)
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [summaryStats, setSummaryStats] = useState<GroupCertificatesStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Candidates (paginated from server)
  const [candidates, setCandidates] = useState<CandidateCertificateStats[]>([]);
  const [searching, setSearching] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(150);
  const [pageSizeInput, setPageSizeInput] = useState('150');
  const [pageInputValue, setPageInputValue] = useState('1');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Search, sort, filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string>('full_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'pending'>('all');

  // Selection
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  // Detail modal
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailUserName, setDetailUserName] = useState('');

  // Actions
  const [downloading, setDownloading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Race condition prevention
  const searchRequestRef = useRef(0);

  // ---------- Load group + summary on mount ----------
  useEffect(() => {
    (async () => {
      try {
        setInitialLoading(true);
        setError(null);
        const [groupData, statsData] = await Promise.all([
          getGroup(Number(groupId)),
          getGroupCertificatesStats(Number(groupId)),
        ]);
        setGroup(groupData);
        setSummaryStats(statsData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar datos');
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [groupId, certType, canGenerate]);

  // ---------- Server-side candidate search with pagination ----------
  const loadCandidates = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    const requestId = ++searchRequestRef.current;
    try {
      setSearching(true);
      const data = await getGroupCertificatesCandidates(Number(groupId), {
        cert_type: certType,
        page,
        per_page: perPage,
        search: searchQuery || undefined,
        sort_by: sortCol,
        sort_dir: sortDir,
        filter_status: filterStatus !== 'all' ? filterStatus : undefined,
      });

      if (requestId !== searchRequestRef.current) return;

      setCandidates(data.candidates || []);
      setTotalPages(data.pages || 1);
      setTotalResults(data.total || 0);
      setCurrentPage(page);
    } catch (err: any) {
      if (requestId !== searchRequestRef.current) return;
      setError(err.response?.data?.error || 'Error al cargar candidatos');
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  }, [groupId, certType, searchQuery, pageSize, sortCol, sortDir, filterStatus]);

  // Debounced search — fires on mount (after 400ms) and on any param change
  useEffect(() => {
    const timer = setTimeout(() => loadCandidates(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [loadCandidates, pageSize]);

  // Sync page input value
  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  // ---------- Pagination handlers ----------
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadCandidates(newPage, pageSize);
    }
  };

  const handlePageInputSubmit = () => {
    const val = parseInt(pageInputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      handlePageChange(val);
    } else {
      setPageInputValue(String(currentPage));
    }
  };

  const handlePageSizeInputSubmit = () => {
    const val = parseInt(pageSizeInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 1000) {
      setPageSize(val);
      setPageSizeInput(String(val));
    } else {
      setPageSizeInput(String(pageSize));
    }
  };

  // ---------- Sort ----------
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

  // ---------- Selection ----------
  const allOnPageSelected = candidates.length > 0 && candidates.every(c => selectedCandidates.has(c.user_id));

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
      setSelectedCandidates(prev => {
        const next = new Set(prev);
        candidates.forEach(c => next.delete(c.user_id));
        return next;
      });
    } else {
      setSelectedCandidates(prev => {
        const next = new Set(prev);
        candidates.forEach(c => next.add(c.user_id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
  };

  // ---------- Download ----------
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
        const candidate = candidates.find(c => c.user_id === userIds[0]);
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

  // ---------- Generate pending ----------
  const handleGeneratePending = async () => {
    if (!canGenerate) return;
    try {
      setGenerating(true);
      setError(null);
      await generateGroupCertificates(Number(groupId), certType as 'tier_basic' | 'tier_standard');
      // Refresh summary + candidates
      const refreshed = await getGroupCertificatesStats(Number(groupId));
      setSummaryStats(refreshed);
      loadCandidates(currentPage, pageSize);
      setSuccessMessage('PDFs generados exitosamente');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar certificados');
    } finally {
      setGenerating(false);
    }
  };

  // ---------- Summary counts from server ----------
  const getSummaryCounts = () => {
    if (!summaryStats) return { totalReady: 0, totalPending: 0 };
    const s = summaryStats.summary;
    let totalReady = 0, totalPending = 0;
    switch (certType) {
      case 'tier_basic':
        totalReady = s.tier_basic.ready;
        totalPending = s.tier_basic.pending;
        break;
      case 'tier_standard':
        totalReady = s.tier_standard.ready;
        totalPending = s.tier_standard.pending;
        break;
      case 'tier_advanced':
        totalReady = s.tier_advanced.count;
        break;
      case 'digital_badge':
        totalReady = s.digital_badge.count;
        break;
    }
    return { totalReady, totalPending };
  };

  const { totalReady, totalPending } = getSummaryCounts();

  // ---------- Refresh ----------
  const handleRefresh = () => {
    (async () => {
      try {
        const refreshed = await getGroupCertificatesStats(Number(groupId));
        setSummaryStats(refreshed);
      } catch { /* silent */ }
    })();
    loadCandidates(currentPage, pageSize);
  };

  // ---------- Render ----------

  if (initialLoading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando certificados..." />
      </div>
    );
  }

  if (error && !summaryStats) {
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

  // Pagination controls (reused top and bottom)
  const renderPaginationControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
      <div className="fluid-text-sm text-gray-600">
        {searching ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando...
          </span>
        ) : totalResults > 0 ? (
          <>
            Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
            {' - '}
            <span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
            {' de '}
            <span className="font-medium">{totalResults.toLocaleString()}</span> candidatos
          </>
        ) : (
          <span>0 candidatos</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
          title="Primera página"
        >
          1
        </button>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <ChevronLeft className="fluid-icon-sm" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={pageInputValue}
          onChange={(e) => setPageInputValue(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); }}
          onBlur={handlePageInputSubmit}
          className="w-14 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          title="Escribe el número de página y presiona Enter"
        />
        <span className="fluid-text-sm text-gray-400">/ {totalPages}</span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          <ChevronRight className="fluid-icon-sm" />
        </button>
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
          title="Última página"
        >
          {totalPages}
        </button>
      </div>
    </div>
  );

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
            {extraHeaderActions}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-4 fluid-mt-6">
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{totalResults.toLocaleString()}</p>
            <p className="fluid-text-xs text-white/70">Candidatos</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{totalReady.toLocaleString()}</p>
            <p className="fluid-text-xs text-white/70">Listos</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{totalPending.toLocaleString()}</p>
            <p className="fluid-text-xs text-white/70">Pendientes</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{selectedCandidates.size.toLocaleString()}</p>
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

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'ready' | 'pending')}
            className="fluid-py-2 fluid-px-3 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          >
            <option value="all">Todos</option>
            <option value="ready">Listos</option>
            <option value="pending">Pendientes</option>
          </select>

          {/* Page Size */}
          <div className="flex items-center gap-1">
            <span className="fluid-text-xs text-gray-500">Mostrar</span>
            <input
              type="text"
              inputMode="numeric"
              value={pageSizeInput}
              onChange={e => setPageSizeInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') handlePageSizeInputSubmit(); }}
              onBlur={handlePageSizeInputSubmit}
              className="w-16 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-blue-500"
            />
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
            onClick={handleRefresh}
            className="fluid-p-2 hover:bg-gray-100 rounded-fluid-lg transition-colors text-gray-500"
            title="Refrescar"
          >
            <RefreshCw className="fluid-icon-sm" />
          </button>
        </div>
      </div>

      {/* Table with pagination */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Top pagination */}
        <div className="bg-white border-b border-gray-200">
          {renderPaginationControls()}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full fluid-text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {/* Checkbox column */}
                <th className="w-12 fluid-px-4 fluid-py-3 text-center">
                  <button onClick={handleToggleSelectAll} className="text-gray-500 hover:text-gray-700">
                    {allOnPageSelected && candidates.length > 0
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
                  onClick={() => handleSort('ready_count')}
                  className="text-center fluid-px-4 fluid-py-3 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                >
                  Listos{renderSortIcon('ready_count')}
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
              {candidates.map(c => {
                const isSelected = selectedCandidates.has(c.user_id);
                const readyCount = c.ready_count || 0;
                const pendingCount = c.pending_count || 0;
                const status = c.status || (pendingCount > 0 ? 'pending' : 'ready');
                return (
                  <tr
                    key={c.user_id}
                    onClick={() => handleToggleCandidate(c.user_id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="w-12 fluid-px-4 fluid-py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleToggleCandidate(c.user_id)} className="text-gray-500 hover:text-gray-700">
                        {isSelected
                          ? <CheckSquare className="h-5 w-5 text-blue-600" />
                          : <Square className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <div className="flex items-center fluid-gap-3">
                        <div className={`w-8 h-8 rounded-full bg-${accentColor}-100 flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-xs font-bold text-${accentColor}-700`}>
                            {c.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{c.full_name}</p>
                          <p className="fluid-text-xs text-gray-500 md:hidden truncate">{c.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-gray-600 hidden md:table-cell">
                      <span className="truncate block max-w-[200px]">{c.email || '-'}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-gray-500 font-mono text-xs hidden lg:table-cell">
                      {c.curp || '-'}
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {c.exams_approved}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />{readyCount}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      {status === 'ready' ? (
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
                          setDetailUserId(c.user_id);
                          setDetailUserName(c.full_name);
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
              {candidates.length === 0 && !searching && (
                <tr>
                  <td colSpan={8} className="fluid-px-4 fluid-py-12 text-center text-gray-400">
                    <Users className="fluid-icon-lg mx-auto mb-2 text-gray-300" />
                    <p className="fluid-text-sm">
                      {searchQuery || filterStatus !== 'all' ? 'No se encontraron candidatos para los filtros aplicados' : 'No hay candidatos certificados aún'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom pagination */}
        {totalResults > 0 && (
          <div className="bg-white border-t border-gray-200">
            {renderPaginationControls()}
          </div>
        )}
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
