/**
 * Página de Trámites CONOCER
 *
 * Muestra candidatos aprobados en grupos con CONOCER habilitado que aún no
 * tienen certificado CONOCER. Permite filtrar, buscar, seleccionar y exportar
 * a Excel para gestionar el trámite ante CONOCER.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Users,
  Award,
  ShieldCheck,
  RefreshCw,
  Filter,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  X,
  Loader2,
  Upload,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getConocerTramites,
  exportConocerTramitesExcel,
  getPartners,
  getAvailableCompetencyStandards,
  ConocerTramiteCandidate,
  ConocerTramiteSummary,
  ConocerTramitesParams,
  Partner,
  AvailableCompetencyStandard,
} from '../../services/partnersService';

export default function ConocerTramitesPage() {
  // Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ConocerTramiteCandidate[]>([]);
  const [summary, setSummary] = useState<ConocerTramiteSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(150);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const conocerStatus = 'pending' as const;
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | undefined>();
  const [selectedEcmId, setSelectedEcmId] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Dropdowns
  const [partners, setPartners] = useState<Partner[]>([]);
  const [ecms, setEcms] = useState<AvailableCompetencyStandard[]>([]);

  // State
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Load filter options
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [partnersData, ecmsData] = await Promise.all([
          getPartners({ per_page: 500, active_only: true }),
          getAvailableCompetencyStandards(),
        ]);
        setPartners(partnersData.partners || []);
        setEcms(ecmsData?.competency_standards || ecmsData || []);
      } catch {
        // silently fail - filters just won't populate
      }
    };
    loadFilters();
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);

      const params: ConocerTramitesParams = {
        page: currentPage,
        per_page: perPage,
        search: debouncedSearch || undefined,
        partner_id: selectedPartnerId,
        ecm_id: selectedEcmId,
        sort_by: sortBy,
        sort_dir: sortDir,
        conocer_status: conocerStatus,
      };

      const data = await getConocerTramites(params);
      setCandidates(data.candidates);
      setSummary(data.summary);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, perPage, debouncedSearch, selectedPartnerId, selectedEcmId, sortBy, sortDir, conocerStatus, refreshing]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (col: string) => {
    if (sortBy !== col) return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="inline w-3 h-3 ml-1 text-emerald-600" />
      : <ArrowDown className="inline w-3 h-3 ml-1 text-emerald-600" />;
  };

  const toggleSelect = (uniqueKey: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uniqueKey)) next.delete(uniqueKey);
      else next.add(uniqueKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      const allKeys = candidates.map(c => `${c.user_id}_${c.ecm_id}`);
      setSelectedIds(new Set(allKeys));
    }
    setSelectAll(!selectAll);
  };

  const handleExport = async (onlySelected: boolean) => {
    try {
      setExporting(true);
      const params: ConocerTramitesParams & { user_ids?: string } = {
        search: debouncedSearch || undefined,
        partner_id: selectedPartnerId,
        ecm_id: selectedEcmId,
        sort_by: sortBy,
        sort_dir: sortDir,
        conocer_status: conocerStatus,
      };

      if (onlySelected && selectedIds.size > 0) {
        const userIds = [...selectedIds].map(k => k.split('_')[0]);
        params.user_ids = [...new Set(userIds)].join(',');
      }

      await exportConocerTramitesExcel(params);
    } catch (err: any) {
      setError('Error al exportar: ' + (err.response?.data?.error || err.message));
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSelectedPartnerId(undefined);
    setSelectedEcmId(undefined);
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Unique key for each candidate row (user + ecm)
  const getKey = (c: ConocerTramiteCandidate) => `${c.user_id}_${c.ecm_id}`;

  if (loading && !refreshing) return <LoadingSpinner />;

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to="/partners/dashboard"
              className="p-2 rounded-fluid-xl bg-white/10 hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="fluid-icon-base" />
            </Link>
            <div>
              <h1 className="fluid-text-2xl font-bold flex items-center gap-2">
                <Award className="fluid-icon-lg" />
                Trámites CONOCER
              </h1>
              <p className="fluid-text-sm text-white/80 mt-1">
                Candidatos aprobados elegibles para certificación CONOCER
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/tramites-conocer/subir"
              className="fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl flex items-center fluid-gap-2 fluid-text-sm transition-all font-semibold"
            >
              <Upload className="fluid-icon-sm" />
              Subir Certificados
            </Link>
            <Link
              to="/tramites-conocer/historial"
              className="fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 rounded-fluid-xl flex items-center fluid-gap-2 fluid-text-sm transition-all"
            >
              <Clock className="fluid-icon-sm" />
              Historial
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="fluid-px-4 fluid-py-2 bg-white/10 hover:bg-white/20 rounded-fluid-xl flex items-center fluid-gap-2 fluid-text-sm transition-all"
            >
              <RefreshCw className={`fluid-icon-sm ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-700 fluid-text-base">Error</p>
            <p className="fluid-text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fluid-mb-6">
          <div className="bg-white rounded-fluid-xl fluid-p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="fluid-text-xs text-gray-500">Total Candidatos</span>
            </div>
            <p className="fluid-text-xl font-bold text-gray-900">{summary.total_candidates}</p>
          </div>
          <div className="bg-white rounded-fluid-xl fluid-p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="fluid-text-xs text-gray-500">Pendientes</span>
            </div>
            <p className="fluid-text-xl font-bold text-amber-600">{summary.pending}</p>
          </div>
          <div className="bg-white rounded-fluid-xl fluid-p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="fluid-text-xs text-gray-500">Con Certificado</span>
            </div>
            <p className="fluid-text-xl font-bold text-emerald-600">{summary.with_certificate}</p>
          </div>
          <div className="bg-white rounded-fluid-xl fluid-p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span className="fluid-text-xs text-gray-500">ECMs</span>
            </div>
            <p className="fluid-text-xl font-bold text-blue-600">{summary.total_ecms}</p>
          </div>
        </div>
      )}

      {/* Toolbar: Search + Filters + Export */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, CURP o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status: siempre pendientes */}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
              showFilters ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>

          {/* Export buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {selectedIds.size > 0 && (
              <button
                onClick={() => handleExport(true)}
                disabled={exporting}
                className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Exportar seleccionados ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => handleExport(false)}
              disabled={exporting}
              className="px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm flex items-center gap-1.5 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar todo
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
            <select
              value={selectedPartnerId || ''}
              onChange={(e) => { setSelectedPartnerId(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los partners</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={selectedEcmId || ''}
              onChange={(e) => { setSelectedEcmId(e.target.value ? Number(e.target.value) : undefined); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los ECM</option>
              {ecms.map(e => (
                <option key={e.id} value={e.id}>{e.code} - {e.name}</option>
              ))}
            </select>

            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value={50}>50 por página</option>
              <option value={150}>150 por página</option>
              <option value={300}>300 por página</option>
              <option value={500}>500 por página</option>
              <option value={1000}>1000 por página</option>
            </select>

            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Results info + Pagination top */}
      <div className="flex items-center justify-between fluid-mb-3">
        <p className="text-sm text-gray-500">
          {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          {selectedIds.size > 0 && (
            <span className="ml-2 text-emerald-600 font-medium">
              ({selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''})
            </span>
          )}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <ChevronLeft className="w-4 h-4 -ml-3" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              <ChevronRight className="w-4 h-4 -ml-3" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll && candidates.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  Candidato {renderSortIcon('name')}
                </th>
                <th
                  onClick={() => handleSort('curp')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none hidden lg:table-cell"
                >
                  CURP {renderSortIcon('curp')}
                </th>
                <th
                  onClick={() => handleSort('ecm')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                >
                  ECM {renderSortIcon('ecm')}
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell"
                >
                  No. Asignación
                </th>
                <th
                  onClick={() => handleSort('score')}
                  className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell"
                >
                  Calif. {renderSortIcon('score')}
                </th>
                <th
                  onClick={() => handleSort('exam_date')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none hidden lg:table-cell"
                >
                  Fecha Eval. {renderSortIcon('exam_date')}
                </th>
                <th
                  onClick={() => handleSort('group')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none hidden xl:table-cell"
                >
                  Grupo {renderSortIcon('group')}
                </th>
                <th
                  onClick={() => handleSort('campus')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none hidden xl:table-cell"
                >
                  Plantel {renderSortIcon('campus')}
                </th>
                <th
                  onClick={() => handleSort('partner')}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none hidden 2xl:table-cell"
                >
                  Partner {renderSortIcon('partner')}
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estatus
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 text-gray-300" />
                      <p className="font-medium">No se encontraron candidatos</p>
                      <p className="text-sm text-gray-400">Ajusta los filtros o la búsqueda</p>
                    </div>
                  </td>
                </tr>
              ) : (
                candidates.map((c) => {
                  const key = getKey(c);
                  const isSelected = selectedIds.has(key);
                  return (
                    <tr
                      key={key}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-emerald-50/50' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(key)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Candidato */}
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {c.full_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{c.email}</p>
                          <p className="text-xs text-gray-400 lg:hidden">{c.curp}</p>
                        </div>
                      </td>

                      {/* CURP */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-sm text-gray-700 font-mono">{c.curp}</span>
                      </td>

                      {/* ECM */}
                      <td className="px-3 py-3">
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                            {c.ecm_code}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{c.ecm_name}</p>
                        </div>
                      </td>

                      {/* No. Asignación */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        {c.assignment_number ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-50 text-blue-700">
                            {c.assignment_number}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Calificación */}
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                          {c.score}
                        </span>
                      </td>

                      {/* Fecha */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-sm text-gray-600">
                          {c.exam_date ? new Date(c.exam_date).toLocaleDateString('es-MX') : '—'}
                        </span>
                      </td>

                      {/* Grupo */}
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <div>
                          <p className="text-sm text-gray-700 truncate max-w-[150px]">{c.group_name}</p>
                          {c.group_code && (
                            <p className="text-xs text-gray-400">{c.group_code}</p>
                          )}
                        </div>
                      </td>

                      {/* Plantel */}
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <span className="text-sm text-gray-600 truncate max-w-[150px] block">{c.campus_name}</span>
                      </td>

                      {/* Partner */}
                      <td className="px-3 py-3 hidden 2xl:table-cell">
                        <span className="text-sm text-gray-600 truncate max-w-[130px] block">{c.partner_name}</span>
                      </td>

                      {/* Estatus */}
                      <td className="px-3 py-3 text-center">
                        {c.tramite_status === 'certificado' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Certificado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" />
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination bottom */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Mostrando {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              className="w-16 text-center border border-gray-300 rounded text-sm py-1.5 focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-500">/ {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
