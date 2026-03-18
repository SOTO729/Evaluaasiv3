/**
 * Módulo de Reportes — Coordinador y Responsable
 * 
 * Filtros avanzados:
 * - Partner, Plantel, Ciclo Escolar, Grupo
 * - Estándar (código, nombre, nivel, sector), Marca
 * - Rol, Género, Estado activo, CURP verificada
 * - Resultado (Aprobado/Reprobado), Rango de calificación
 * - Búsqueda libre por nombre/email/CURP/username
 * 
 * Visualización en tabla con exportación a Excel.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  Users,
  BarChart3,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Minus,
  RefreshCw,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getReportFilters,
  getReports,
  exportReports,
  ReportFiltersData,
  ReportRow,
} from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';

interface Props {
  backPath?: string;
}

const ROLE_MAP: Record<string, string> = { candidato: 'Candidato', responsable: 'Responsable' };

export default function ReportsPage({ backPath = '/partners' }: Props) {
  const { user } = useAuthStore();
  const isResponsable = user?.role === 'responsable';

  // Filter options
  const [filtersData, setFiltersData] = useState<ReportFiltersData | null>(null);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Active filters
  const [partnerId, setPartnerId] = useState<string>('');
  const [campusId, setCampusId] = useState<string>('');
  const [cycleId, setCycleId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [standardId, setStandardId] = useState<string>('');
  const [brandId, setBrandId] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');
  const [curpVerifiedFilter, setCurpVerifiedFilter] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<string>('');
  const [hasAssignment, setHasAssignment] = useState<string>('');
  const [scoreMin, setScoreMin] = useState<string>('');
  const [scoreMax, setScoreMax] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);

  // Data
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  // Load filter options
  useEffect(() => {
    (async () => {
      try {
        const data = await getReportFilters();
        setFiltersData(data);
      } catch (err: any) {
        console.error('Error loading filters:', err);
      } finally {
        setFiltersLoading(false);
      }
    })();
  }, []);

  // Derived filter options based on selections
  const filteredCampuses = useMemo(() => {
    if (!filtersData) return [];
    if (partnerId) return filtersData.campuses.filter(c => c.partner_id === Number(partnerId));
    return filtersData.campuses;
  }, [filtersData, partnerId]);

  const filteredCycles = useMemo(() => {
    if (!filtersData) return [];
    if (campusId) return filtersData.school_cycles.filter(c => c.campus_id === Number(campusId));
    if (partnerId) {
      const campusIds = new Set(filteredCampuses.map(c => c.id));
      return filtersData.school_cycles.filter(c => campusIds.has(c.campus_id));
    }
    return filtersData.school_cycles;
  }, [filtersData, campusId, partnerId, filteredCampuses]);

  const filteredGroups = useMemo(() => {
    if (!filtersData) return [];
    let groups = filtersData.groups;
    if (campusId) groups = groups.filter(g => g.campus_id === Number(campusId));
    else if (partnerId) {
      const campusIds = new Set(filteredCampuses.map(c => c.id));
      groups = groups.filter(g => campusIds.has(g.campus_id));
    }
    if (cycleId) groups = groups.filter(g => g.school_cycle_id === Number(cycleId));
    return groups;
  }, [filtersData, campusId, partnerId, cycleId, filteredCampuses]);

  const sectors = useMemo(() => {
    if (!filtersData) return [];
    const s = new Set(filtersData.standards.map(st => st.sector).filter(Boolean));
    return Array.from(s).sort() as string[];
  }, [filtersData]);

  const levels = useMemo(() => {
    if (!filtersData) return [];
    const l = new Set(filtersData.standards.map(st => st.level).filter(Boolean));
    return Array.from(l).sort() as number[];
  }, [filtersData]);

  const buildParams = useCallback(() => {
    const params: Record<string, string | number | undefined> = {
      page,
      per_page: perPage,
    };
    if (partnerId) params.partner_id = Number(partnerId);
    if (campusId) params.campus_id = Number(campusId);
    if (cycleId) params.school_cycle_id = Number(cycleId);
    if (groupId) params.group_id = Number(groupId);
    if (standardId) params.standard_id = Number(standardId);
    if (brandId) params.brand_id = Number(brandId);
    if (levelFilter) params.level = Number(levelFilter);
    if (sectorFilter) params.sector = sectorFilter;
    if (roleFilter) params.role = roleFilter;
    if (genderFilter) params.gender = genderFilter;
    if (isActiveFilter) params.is_active = isActiveFilter;
    if (curpVerifiedFilter) params.curp_verified = curpVerifiedFilter;
    if (resultFilter) params.result = resultFilter;
    if (hasAssignment) params.has_assignment = hasAssignment;
    if (scoreMin) params.score_min = Number(scoreMin);
    if (scoreMax) params.score_max = Number(scoreMax);
    if (search) params.search = search;
    return params;
  }, [page, perPage, partnerId, campusId, cycleId, groupId, standardId, brandId, levelFilter, sectorFilter, roleFilter, genderFilter, isActiveFilter, curpVerifiedFilter, resultFilter, hasAssignment, scoreMin, scoreMax, search]);

  const handleSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setHasQueried(true);
      const data = await getReports(buildParams());
      setRows(data.rows);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Re-fetch when page changes (but only if queried)
  useEffect(() => {
    if (hasQueried) handleSearch();
  }, [page]);

  const handleApplyFilters = () => {
    setPage(1);
    handleSearch();
  };

  const handleClearFilters = () => {
    setPartnerId('');
    setCampusId('');
    setCycleId('');
    setGroupId('');
    setStandardId('');
    setBrandId('');
    setLevelFilter('');
    setSectorFilter('');
    setRoleFilter('');
    setGenderFilter('');
    setIsActiveFilter('');
    setCurpVerifiedFilter('');
    setResultFilter('');
    setHasAssignment('');
    setScoreMin('');
    setScoreMax('');
    setSearch('');
    setSearchInput('');
    setPage(1);
    setRows([]);
    setTotal(0);
    setHasQueried(false);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = buildParams();
      delete params.page;
      delete params.per_page;
      const blob = await exportReports(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Error al exportar el reporte');
    } finally {
      setExporting(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
      setPage(1);
      setTimeout(() => handleSearch(), 0);
    }
  };

  const activeFilterCount = [partnerId, campusId, cycleId, groupId, standardId, brandId, levelFilter, sectorFilter, roleFilter, genderFilter, isActiveFilter, curpVerifiedFilter, resultFilter, hasAssignment, scoreMin, scoreMax, search].filter(Boolean).length;

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (filtersLoading) return <LoadingSpinner message="Cargando módulo de reportes..." />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-fluid-2xl shadow-lg fluid-p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={backPath} className="p-2 hover:bg-white/10 rounded-fluid-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="fluid-text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="fluid-icon-lg" /> Reportes
              </h1>
              <p className="fluid-text-sm text-white/80 mt-1">
                Genera reportes personalizados de usuarios y certificaciones
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasQueried && total > 0 && (
              <span className="bg-white/20 fluid-px-3 fluid-py-1.5 rounded-fluid-lg fluid-text-sm font-medium">
                {total.toLocaleString()} resultado{total !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={handleExport}
              disabled={exporting || !hasQueried || total === 0}
              className="inline-flex items-center gap-2 fluid-px-4 fluid-py-2.5 bg-white/20 hover:bg-white/30 rounded-fluid-xl fluid-text-sm font-semibold transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Primary filters */}
        <div className="fluid-p-4 space-y-3">
          {/* Row 1: Search + primary dropdowns */}
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px] max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, CURP, usuario..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Partner (solo coord) */}
            {!isResponsable && filtersData && filtersData.partners.length > 0 && (
              <select value={partnerId} onChange={e => { setPartnerId(e.target.value); setCampusId(''); setCycleId(''); setGroupId(''); }} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[160px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los partners</option>
                {filtersData.partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            {/* Campus */}
            <select value={campusId} onChange={e => { setCampusId(e.target.value); setCycleId(''); setGroupId(''); }} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[160px] focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos los planteles</option>
              {filteredCampuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Cycle */}
            {filteredCycles.length > 0 && (
              <select value={cycleId} onChange={e => setCycleId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Todos los ciclos</option>
                {filteredCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            {/* Group */}
            <select value={groupId} onChange={e => setGroupId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos los grupos</option>
              {filteredGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {/* Row 2: Standard + result */}
          <div className="flex flex-wrap gap-3">
            {/* Standard */}
            <select value={standardId} onChange={e => setStandardId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[200px] focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos los estándares</option>
              {filtersData?.standards.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>

            {/* Brand */}
            <select value={brandId} onChange={e => setBrandId(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
              <option value="">Todas las marcas</option>
              {filtersData?.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            {/* Result */}
            <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
              <option value="">Todos los resultados</option>
              <option value="approved">Aprobado (Certificado)</option>
              <option value="rejected">Reprobado (No certificado)</option>
            </select>

            {/* Toggle advanced */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-fluid-lg fluid-text-sm font-medium transition-all"
            >
              <Filter className="w-4 h-4" />
              Más filtros
              {activeFilterCount > 3 && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{activeFilterCount}</span>}
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Advanced filters (collapsible) */}
          {showAdvanced && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
              {/* Level */}
              <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[120px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Nivel</option>
                {levels.map(l => <option key={l} value={l}>Nivel {l}</option>)}
              </select>

              {/* Sector */}
              <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[160px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Sector</option>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Role */}
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[130px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Tipo de usuario</option>
                <option value="candidato">Candidato</option>
                <option value="responsable">Responsable</option>
              </select>

              {/* Gender */}
              <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[120px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Género</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>

              {/* Active */}
              <select value={isActiveFilter} onChange={e => setIsActiveFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[120px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Estado</option>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>

              {/* CURP verified */}
              <select value={curpVerifiedFilter} onChange={e => setCurpVerifiedFilter(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[140px] focus:ring-2 focus:ring-indigo-500">
                <option value="">CURP verificada</option>
                <option value="1">Verificada</option>
                <option value="0">No verificada</option>
              </select>

              {/* Has assignment */}
              <select value={hasAssignment} onChange={e => setHasAssignment(e.target.value)} className="border border-gray-300 rounded-fluid-lg px-3 py-2.5 fluid-text-sm min-w-[150px] focus:ring-2 focus:ring-indigo-500">
                <option value="">Con/Sin asignación</option>
                <option value="1">Con asignación ECM</option>
                <option value="0">Sin asignación ECM</option>
              </select>

              {/* Score range */}
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={100} placeholder="Cal. mín" value={scoreMin} onChange={e => setScoreMin(e.target.value)} className="w-20 border border-gray-300 rounded-fluid-lg px-2 py-2.5 fluid-text-sm focus:ring-2 focus:ring-indigo-500" />
                <Minus className="w-3 h-3 text-gray-400" />
                <input type="number" min={0} max={100} placeholder="Cal. máx" value={scoreMax} onChange={e => setScoreMax(e.target.value)} className="w-20 border border-gray-300 rounded-fluid-lg px-2 py-2.5 fluid-text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-xl font-semibold fluid-text-sm shadow-sm transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Generar Reporte
            </button>
            {activeFilterCount > 0 && (
              <button onClick={handleClearFilters} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-fluid-lg fluid-text-sm transition-all">
                <X className="w-4 h-4" /> Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 fluid-text-sm">{error}</p>
        </div>
      )}

      {/* Results table */}
      {!hasQueried ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-12 text-center">
          <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="fluid-text-lg font-semibold text-gray-700 mb-2">Configura tu reporte</h3>
          <p className="fluid-text-sm text-gray-500 max-w-md mx-auto">
            Selecciona los filtros que desees y presiona <strong>"Generar Reporte"</strong> para ver los resultados.
            Puedes exportar a Excel en cualquier momento.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-8">
          <LoadingSpinner message="Generando reporte..." />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm fluid-p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="fluid-text-lg font-semibold text-gray-700 mb-2">Sin resultados</h3>
          <p className="fluid-text-sm text-gray-500">No se encontraron registros con los filtros aplicados. Intenta ajustar los filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Summary bar */}
          <div className="fluid-px-4 fluid-py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <p className="fluid-text-sm text-gray-600">
              <strong>{total.toLocaleString()}</strong> resultado{total !== 1 ? 's' : ''}
              {totalPages > 1 && <> — Página {page} de {totalPages}</>}
            </p>
            <button onClick={handleSearch} disabled={loading} className="inline-flex items-center gap-1.5 fluid-text-xs text-gray-500 hover:text-indigo-600 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  {!isResponsable && <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Partner</th>}
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Plantel</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Grupo</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Usuario</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase hidden xl:table-cell">Email</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase hidden lg:table-cell">CURP</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Estándar</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase hidden lg:table-cell">Marca</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Cal.</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Cal. (1000)</th>
                  <th className="px-3 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase">Resultado</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase hidden xl:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => (
                  <tr key={`${row.user_id}-${row.assignment_number}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                    {!isResponsable && <td className="px-3 py-2.5 fluid-text-xs text-gray-600 max-w-[120px] truncate">{row.partner_name}</td>}
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-700 font-medium max-w-[120px] truncate">{row.campus_name}</td>
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-600 max-w-[100px] truncate">{row.group_name}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {row.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="fluid-text-xs font-medium text-gray-900 truncate max-w-[140px]">{row.full_name}</p>
                          <p className="text-[10px] text-gray-400">{ROLE_MAP[row.role] || row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-600 font-mono">{row.username}</td>
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-500 hidden xl:table-cell max-w-[160px] truncate">{row.email || '-'}</td>
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-500 font-mono hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        {row.curp || '-'}
                        {row.curp && row.curp_verified && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.standard_code ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-[130px]" title={`${row.standard_code} — ${row.standard_name}`}>
                          {row.standard_code}
                        </span>
                      ) : (
                        <span className="text-gray-400 fluid-text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-500 hidden lg:table-cell">{row.brand_name || '-'}</td>
                    <td className="px-3 py-2.5 text-center">
                      {row.score !== null ? (
                        <span className="fluid-text-sm font-bold text-gray-900">{row.score}</span>
                      ) : (
                        <span className="text-gray-400 fluid-text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.score_1000 !== null ? (
                        <span className="fluid-text-xs font-semibold text-gray-700">{row.score_1000}</span>
                      ) : (
                        <span className="text-gray-400 fluid-text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.result === 'Aprobado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle2 className="w-3 h-3" /> Certificado
                        </span>
                      ) : row.result === 'Reprobado' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200">
                          <XCircle className="w-3 h-3" /> No cert.
                        </span>
                      ) : row.result === 'Sin evaluar' ? (
                        <span className="text-[10px] text-gray-400">Pendiente</span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 fluid-text-xs text-gray-500 hidden xl:table-cell">{formatDate(row.result_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="fluid-px-4 fluid-py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50/50">
              <p className="fluid-text-xs text-gray-500">
                Mostrando {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} de {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border rounded-fluid-lg fluid-text-xs font-medium disabled:opacity-50 hover:bg-gray-100 transition-colors"
                >
                  Anterior
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 rounded-fluid-lg fluid-text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'border hover:bg-gray-100'}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border rounded-fluid-lg fluid-text-xs font-medium disabled:opacity-50 hover:bg-gray-100 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
