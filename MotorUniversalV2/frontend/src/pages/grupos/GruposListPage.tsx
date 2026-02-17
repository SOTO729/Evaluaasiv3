/**
 * GruposListPage - Gestión de Grupos
 * Tabla directa de todos los grupos con paginación server-side.
 * Filtros avanzados: búsqueda, partner, ciclo escolar, estado.
 * Optimizado para 100K+ registros.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Calendar,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Clock,
  MapPin,
  Globe,
  RefreshCw,
  Loader2,
  XCircle,
  SlidersHorizontal,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  searchGroupsPaginated,
  SearchGroupsResult,
} from '../../services/partnersService';

type SortField = 'name' | 'member_count' | 'campus_name' | 'campus_state' | 'partner_name' | 'school_cycle' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function GruposListPage() {
  const navigate = useNavigate();

  // Datos de grupos
  const [groups, setGroups] = useState<SearchGroupsResult['groups']>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros avanzados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterCycle, setFilterCycle] = useState('');
  const [filterPartnerId, setFilterPartnerId] = useState<number | ''>('')

  // Opciones de filtrado (vienen del backend)
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);
  const [availablePartners, setAvailablePartners] = useState<Array<{ id: number; name: string }>>([]);

  // Paginación server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(150);
  const [pageSizeInput, setPageSizeInput] = useState('150');
  const [pageInputValue, setPageInputValue] = useState('1');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Ordenamiento server-side
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Ref para cancelar respuestas stale
  const searchRequestRef = useRef(0);

  // Búsqueda server-side con paginación
  const handleSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    const requestId = ++searchRequestRef.current;
    try {
      setSearching(true);

      const results = await searchGroupsPaginated({
        page,
        per_page: perPage,
        search: searchTerm || undefined,
        cycle_name: filterCycle || undefined,
        partner_id: filterPartnerId || undefined,
        sort_by: sortField,
        sort_dir: sortDirection,
      });

      if (requestId !== searchRequestRef.current) return;

      setGroups(results.groups);
      setTotalPages(results.pages);
      setTotalResults(results.total);
      setCurrentPage(page);
      setAvailableCycles(results.available_cycles || []);
      setAvailablePartners(results.available_partners || []);
    } catch (err: any) {
      if (requestId !== searchRequestRef.current) return;
      setError(err.response?.data?.error || 'Error al cargar los grupos');
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
        setLoading(false);
      }
    }
  }, [searchTerm, pageSize, filterCycle, filterPartnerId, sortField, sortDirection]);

  // Debounce de búsqueda (400ms)
  useEffect(() => {
    const timer = setTimeout(() => handleSearch(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [handleSearch, pageSize]);

  // Sincronizar pageInputValue con currentPage
  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      handleSearch(newPage, pageSize);
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

  // Ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField === field) {
      return sortDirection === 'asc'
        ? <ArrowUp className="h-3 w-3 ml-1 inline text-blue-600" />
        : <ArrowDown className="h-3 w-3 ml-1 inline text-blue-600" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
  };

  // Limpiar filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterCycle('');
    setFilterPartnerId('');
  };

  const hasActiveFilters = searchTerm || filterCycle || filterPartnerId;
  const activeFilterCount = [searchTerm, filterCycle, filterPartnerId].filter(Boolean).length;

  // Render paginación
  const renderPagination = () => (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="fluid-text-sm text-gray-600">
        {searching ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando...
          </span>
        ) : totalResults > 0 ? (
          <>
            Mostrando{' '}
            <span className="font-semibold">{((currentPage - 1) * pageSize + 1).toLocaleString()}</span>
            {' – '}
            <span className="font-semibold">{Math.min(currentPage * pageSize, totalResults).toLocaleString()}</span>
            {' de '}
            <span className="font-semibold">{totalResults.toLocaleString()}</span> grupos
          </>
        ) : (
          <span>0 grupos</span>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          {/* Primera página */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Primera página"
          >
            <ChevronsLeft className="w-4 h-4 text-gray-600" />
          </button>
          {/* Página anterior */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          {/* Input de página */}
          <div className="flex items-center gap-1.5 mx-1">
            <span className="fluid-text-sm text-gray-500">Pág.</span>
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
            <span className="fluid-text-sm text-gray-400">de {totalPages.toLocaleString()}</span>
          </div>
          {/* Página siguiente */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          {/* Última página */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Cargando grupos..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-4 fluid-mb-6">
        <div>
          <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-fluid-xl flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-white" />
            </div>
            Grupos
          </h1>
          <p className="fluid-text-base text-gray-500 fluid-mt-1">
            Gestión centralizada de todos los grupos
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="fluid-mb-5 fluid-p-5 bg-red-50 border border-red-200 rounded-fluid-xl flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="fluid-text-base text-red-700">{error}</p>
          <button
            onClick={() => handleSearch(currentPage, pageSize)}
            className="ml-auto fluid-text-base text-red-700 underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ===== BARRA DE BÚSQUEDA Y FILTROS ===== */}
      <div className="bg-white rounded-fluid-xl shadow fluid-p-5 fluid-mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 fluid-icon-lg text-gray-400" />
            <input
              type="text"
              placeholder="Buscar grupo, plantel, partner, ciclo escolar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full fluid-pl-12 fluid-pr-10 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Controles de filtro y paginación */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Botón filtros avanzados */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 border rounded-fluid-xl fluid-text-sm transition-colors ${
                showAdvancedFilters || hasActiveFilters
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <SlidersHorizontal className="fluid-icon-sm" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Registros por página */}
            <div className="flex items-center fluid-gap-1.5">
              <span className="fluid-text-xs text-gray-500">Mostrar</span>
              <input
                type="text"
                inputMode="numeric"
                value={pageSizeInput}
                onChange={(e) => setPageSizeInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePageSizeInputSubmit(); }}
                onBlur={handlePageSizeInputSubmit}
                className="w-16 text-center py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                title="Registros por página (máx 1000)"
              />
            </div>

            {/* Refrescar */}
            <button
              onClick={() => handleSearch(currentPage, pageSize)}
              disabled={searching}
              className="fluid-p-2.5 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
              title="Refrescar"
            >
              <RefreshCw className={`fluid-icon-sm text-gray-600 ${searching ? 'animate-spin' : ''}`} />
            </button>

            {/* Limpiar todo */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-fluid-xl fluid-text-sm transition-colors"
                title="Limpiar todos los filtros"
              >
                <XCircle className="fluid-icon-sm" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Panel de filtros avanzados */}
        {showAdvancedFilters && (
          <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Filtro por Partner */}
              <div>
                <label className="block fluid-text-xs font-medium text-gray-500 fluid-mb-1.5 uppercase tracking-wide">
                  <Building2 className="w-3.5 h-3.5 inline mr-1" />
                  Partner
                </label>
                <select
                  value={filterPartnerId}
                  onChange={(e) => setFilterPartnerId(e.target.value ? Number(e.target.value) : '')}
                  className={`w-full fluid-px-3 fluid-py-2.5 border rounded-fluid-lg fluid-text-sm transition-colors cursor-pointer ${
                    filterPartnerId
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <option value="">Todos los partners</option>
                  {availablePartners.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Ciclo Escolar */}
              <div>
                <label className="block fluid-text-xs font-medium text-gray-500 fluid-mb-1.5 uppercase tracking-wide">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  Ciclo Escolar
                </label>
                <select
                  value={filterCycle}
                  onChange={(e) => setFilterCycle(e.target.value)}
                  className={`w-full fluid-px-3 fluid-py-2.5 border rounded-fluid-lg fluid-text-sm transition-colors cursor-pointer ${
                    filterCycle
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <option value="">Todos los ciclos</option>
                  {availableCycles.map(cycle => (
                    <option key={cycle} value={cycle}>{cycle}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Chips de filtros activos */}
        {hasActiveFilters && (
          <div className="flex items-center flex-wrap gap-2 fluid-mt-4 fluid-pt-4 border-t border-gray-100">
            <span className="fluid-text-sm text-gray-500">Filtros:</span>
            {searchTerm && (
              <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-gray-100 text-gray-700 rounded-full fluid-text-sm">
                <Search className="w-3 h-3" />
                "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-gray-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filterPartnerId && (
              <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-purple-100 text-purple-700 rounded-full fluid-text-sm">
                <Building2 className="w-3 h-3" />
                {availablePartners.find(p => p.id === filterPartnerId)?.name || 'Partner'}
                <button onClick={() => setFilterPartnerId('')} className="ml-1 hover:text-purple-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filterCycle && (
              <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-green-100 text-green-700 rounded-full fluid-text-sm">
                <Calendar className="w-3 h-3" />
                {filterCycle}
                <button onClick={() => setFilterCycle('')} className="ml-1 hover:text-green-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===== TABLA DE GRUPOS ===== */}
      {totalResults === 0 && !searching && !loading ? (
        <div className="bg-white rounded-fluid-xl shadow fluid-p-10 text-center">
          <Users className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-5" />
          <h3 className="fluid-text-xl font-medium text-gray-700 fluid-mb-2">
            {hasActiveFilters ? 'No se encontraron grupos' : 'No hay grupos disponibles'}
          </h3>
          <p className="text-gray-500 fluid-text-base fluid-mb-4">
            {hasActiveFilters
              ? 'Intenta con otros filtros o términos de búsqueda'
              : 'No tienes acceso a ningún grupo'
            }
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-fluid-xl fluid-text-base transition-colors"
            >
              <X className="fluid-icon-sm" />
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl shadow overflow-hidden">
          {/* Paginación superior */}
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            {renderPagination()}
          </div>

          <div className="overflow-x-auto">
            <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th
                      className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center fluid-gap-1">
                        Grupo
                        {renderSortIcon('name')}
                      </div>
                    </th>
                    <th
                      className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('partner_name')}
                    >
                      <div className="flex items-center fluid-gap-1">
                        Partner
                        {renderSortIcon('partner_name')}
                      </div>
                    </th>
                    <th
                      className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('campus_name')}
                    >
                      <div className="flex items-center fluid-gap-1">
                        Plantel
                        {renderSortIcon('campus_name')}
                      </div>
                    </th>
                    <th
                      className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('school_cycle')}
                    >
                      <div className="flex items-center fluid-gap-1">
                        Ciclo
                        {renderSortIcon('school_cycle')}
                      </div>
                    </th>
                    <th
                      className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('member_count')}
                    >
                      <div className="flex items-center justify-center fluid-gap-1">
                        Miembros
                        {renderSortIcon('member_count')}
                      </div>
                    </th>
                    <th
                      className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('campus_state')}
                    >
                      <div className="flex items-center fluid-gap-1">
                        Ubicación
                        {renderSortIcon('campus_state')}
                      </div>
                    </th>
                    <th
                      className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center fluid-gap-1">
                        Creación
                        {renderSortIcon('created_at')}
                      </div>
                    </th>
                    <th className="fluid-px-4 fluid-py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groups.map((group) => (
                    <tr
                      key={group.id}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group/row"
                      onClick={() => navigate(`/partners/groups/${group.id}`)}
                    >
                      {/* Nombre del grupo */}
                      <td className="fluid-px-4 fluid-py-3">
                        <div className="flex items-center fluid-gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-fluid-lg flex-shrink-0 flex items-center justify-center ${
                            group.is_active ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <Layers className={`w-4 h-4 ${group.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`fluid-text-sm font-semibold truncate max-w-[220px] ${
                              group.is_active ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {group.name}
                            </p>
                            {group.description && (
                              <p className="fluid-text-xs text-gray-400 truncate max-w-[220px]">{group.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Partner */}
                      <td className="fluid-px-4 fluid-py-3">
                        <div className="flex items-center fluid-gap-2 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span
                            className="fluid-text-sm text-gray-700 truncate max-w-[160px] hover:text-blue-600"
                            title={group.partner_name}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/partners/${group.partner_id}`);
                            }}
                          >
                            {group.partner_name}
                          </span>
                        </div>
                      </td>

                      {/* Plantel */}
                      <td className="fluid-px-4 fluid-py-3">
                        <span
                          className="fluid-text-sm text-gray-600 truncate block max-w-[160px] hover:text-blue-600"
                          title={group.campus_name}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/partners/campuses/${group.campus_id}`);
                          }}
                        >
                          {group.campus_name}
                        </span>
                      </td>

                      {/* Ciclo Escolar */}
                      <td className="fluid-px-4 fluid-py-3">
                        {group.school_cycle ? (
                          <div className="flex items-center fluid-gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span className="fluid-text-sm text-gray-700">{group.school_cycle.name}</span>
                          </div>
                        ) : (
                          <span className="fluid-text-xs text-gray-400 italic">Sin ciclo</span>
                        )}
                      </td>

                      {/* Miembros */}
                      <td className="fluid-px-4 fluid-py-3 text-center">
                        <div className="inline-flex items-center fluid-gap-1.5 fluid-px-2.5 fluid-py-1 bg-amber-50 text-amber-700 rounded-full">
                          <Users className="w-3.5 h-3.5" />
                          <span className="fluid-text-sm font-semibold">{group.member_count || 0}</span>
                        </div>
                      </td>

                      {/* Ubicación (estado / país) */}
                      <td className="fluid-px-4 fluid-py-3">
                        {group.campus_state || group.campus_country ? (
                          <div className="flex items-center fluid-gap-1.5 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              {group.campus_state && (
                                <span className="fluid-text-sm text-gray-700 block truncate max-w-[140px]">{group.campus_state}</span>
                              )}
                              {group.campus_country && group.campus_country !== 'México' && (
                                <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-gray-400">
                                  <Globe className="w-3 h-3" />
                                  {group.campus_country}
                                </span>
                              )}
                              {!group.campus_state && group.campus_country && (
                                <span className="fluid-text-sm text-gray-700">{group.campus_country}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="fluid-text-xs text-gray-400 italic">Sin ubicación</span>
                        )}
                      </td>

                      {/* Fecha de creación */}
                      <td className="fluid-px-4 fluid-py-3">
                        <div className="flex items-center fluid-gap-1.5 fluid-text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {group.created_at
                            ? new Date(group.created_at).toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'
                          }
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="fluid-px-4 fluid-py-3 text-right">
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover/row:text-blue-500 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación inferior */}
          <div className="fluid-px-5 fluid-py-4 bg-gray-50 border-t border-gray-200">
            {renderPagination()}
          </div>
        </div>
      )}
    </div>
  );
}
