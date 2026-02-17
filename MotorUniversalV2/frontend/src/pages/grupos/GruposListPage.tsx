/**
 * GruposListPage - Gestión de Grupos
 * Tabla de planteles con ordenación y filtros, al seleccionar uno muestra sus grupos
 * Paginación y búsqueda server-side para grupos — optimizado para 100K+ registros
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  Building2,
  Search,
  ChevronRight,
  ChevronLeft,
  Plus,
  AlertCircle,
  MapPin,
  Calendar,
  ArrowLeft,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ExternalLink,
  Settings,
  Layers,
  Clock,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getPartners,
  getCampuses,
  searchGroupsPaginated,
  Campus,
} from '../../services/partnersService';

interface CampusWithPartner extends Campus {
  partner_name: string;
  partner_id: number;
}

type SortField = 'name' | 'partner_name' | 'city' | 'state_name' | 'group_count';
type SortDirection = 'asc' | 'desc';
type GroupSortField = 'name' | 'member_count' | 'school_cycle' | 'created_at' | 'is_active';

export default function GruposListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Estado para la vista actual: 'campuses' o 'groups'
  const [view, setView] = useState<'campuses' | 'groups'>('campuses');
  
  // Estado para planteles
  const [campuses, setCampuses] = useState<CampusWithPartner[]>([]);
  const [loadingCampuses, setLoadingCampuses] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para ordenación
  const [sortField, setSortField] = useState<SortField>('partner_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Estado para filtros
  const [filterPartner, setFilterPartner] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [showPartnerFilter, setShowPartnerFilter] = useState(false);
  const [showStateFilter, setShowStateFilter] = useState(false);
  
  // Estado para grupos — server-side pagination
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [searchingGroups, setSearchingGroups] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<CampusWithPartner | null>(null);
  
  // Búsqueda, filtros y ordenamiento de grupos (server-side)
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [groupSortField, setGroupSortField] = useState<GroupSortField>('name');
  const [groupSortDirection, setGroupSortDirection] = useState<SortDirection>('asc');
  const [filterGroupStatus, setFilterGroupStatus] = useState<'' | 'active' | 'inactive'>('');
  const [filterSchoolCycle, setFilterSchoolCycle] = useState<string>('');

  // Paginación server-side para grupos
  const [groupCurrentPage, setGroupCurrentPage] = useState(1);
  const [groupPageSize, setGroupPageSize] = useState(150);
  const [groupPageSizeInput, setGroupPageSizeInput] = useState('150');
  const [groupPageInputValue, setGroupPageInputValue] = useState('1');
  const [groupTotalPages, setGroupTotalPages] = useState(1);
  const [groupTotalResults, setGroupTotalResults] = useState(0);
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);

  // Ref para cancelar respuestas stale
  const groupSearchRequestRef = useRef(0);
  
  // Estado general
  const [error, setError] = useState<string | null>(null);

  // Obtener lista única de partners para el filtro
  const uniquePartners = useMemo(() => {
    const partners = [...new Set(campuses.map(c => c.partner_name))];
    return partners.sort((a, b) => a.localeCompare(b));
  }, [campuses]);

  // Obtener lista única de estados para el filtro
  const uniqueStates = useMemo(() => {
    const states = [...new Set(campuses.map(c => c.state_name).filter(Boolean))] as string[];
    return states.sort((a, b) => a.localeCompare(b));
  }, [campuses]);

  // Ciclos escolares vienen del servidor (availableCycles)

  // Cargar todos los planteles
  const loadAllCampuses = useCallback(async () => {
    try {
      setLoadingCampuses(true);
      setError(null);
      
      // Obtener todos los partners
      const partnersResponse = await getPartners({ per_page: 200, active_only: true });
      
      // Obtener todos los campuses de cada partner
      const allCampuses: CampusWithPartner[] = [];
      
      for (const partner of partnersResponse.partners) {
        try {
          const campusesResponse = await getCampuses(partner.id, { active_only: true });
          for (const campus of campusesResponse.campuses) {
            allCampuses.push({
              ...campus,
              partner_name: partner.name,
              partner_id: partner.id,
            });
          }
        } catch (err) {
          console.error(`Error loading campuses for partner ${partner.id}:`, err);
        }
      }
      
      setCampuses(allCampuses);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los planteles');
    } finally {
      setLoadingCampuses(false);
    }
  }, []);

  // Búsqueda server-side con paginación para grupos
  const handleGroupSearch = useCallback(async (page: number = 1, perPage: number = groupPageSize) => {
    if (!selectedCampus) return;
    const requestId = ++groupSearchRequestRef.current;
    try {
      setSearchingGroups(true);
      const results = await searchGroupsPaginated({
        page,
        per_page: perPage,
        search: groupSearchTerm || undefined,
        campus_id: selectedCampus.id,
        status: filterGroupStatus || undefined,
        cycle_name: filterSchoolCycle || undefined,
        sort_by: groupSortField,
        sort_dir: groupSortDirection,
        active_only: !filterGroupStatus ? true : undefined,
      });

      if (requestId !== groupSearchRequestRef.current) return;

      setGroups(results.groups);
      setGroupTotalPages(results.pages);
      setGroupTotalResults(results.total);
      setGroupCurrentPage(page);
      setAvailableCycles(results.available_cycles || []);
    } catch (err: any) {
      if (requestId !== groupSearchRequestRef.current) return;
      setError(err.response?.data?.error || 'Error al cargar los grupos');
    } finally {
      if (requestId === groupSearchRequestRef.current) {
        setSearchingGroups(false);
        setLoadingGroups(false);
      }
    }
  }, [selectedCampus, groupSearchTerm, groupPageSize, filterGroupStatus, filterSchoolCycle, groupSortField, groupSortDirection]);

  // Debounce de búsqueda de grupos (400ms)
  useEffect(() => {
    if (view !== 'groups' || !selectedCampus) return;
    const timer = setTimeout(() => handleGroupSearch(1, groupPageSize), 400);
    return () => clearTimeout(timer);
  }, [handleGroupSearch, groupPageSize, view, selectedCampus]);

  // Sincronizar pageInputValue con currentPage
  useEffect(() => {
    setGroupPageInputValue(String(groupCurrentPage));
  }, [groupCurrentPage]);

  const handleGroupPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= groupTotalPages) {
      handleGroupSearch(newPage, groupPageSize);
    }
  };

  const handleGroupPageInputSubmit = () => {
    const val = parseInt(groupPageInputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= groupTotalPages) {
      handleGroupPageChange(val);
    } else {
      setGroupPageInputValue(String(groupCurrentPage));
    }
  };

  const handleGroupPageSizeInputSubmit = () => {
    const val = parseInt(groupPageSizeInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 1000) {
      setGroupPageSize(val);
      setGroupPageSizeInput(String(val));
    } else {
      setGroupPageSizeInput(String(groupPageSize));
    }
  };

  // Seleccionar un campus
  const handleSelectCampus = (campus: CampusWithPartner) => {
    setSelectedCampus(campus);
    setView('groups');
    setSearchParams({ campus: campus.id.toString() });
    setLoadingGroups(true);
    // handleGroupSearch fires via useEffect when selectedCampus changes
  };

  // Volver al listado de planteles
  const handleBackToCampuses = () => {
    setSelectedCampus(null);
    setGroups([]);
    setView('campuses');
    setSearchParams({});
    // Limpiar filtros y paginación de grupos
    setGroupSearchTerm('');
    setFilterGroupStatus('');
    setFilterSchoolCycle('');
    setGroupCurrentPage(1);
    setGroupPageInputValue('1');
    setGroupTotalPages(1);
    setGroupTotalResults(0);
  };

  // Manejar ordenación
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Obtener icono de ordenación
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="fluid-icon-xs text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="fluid-icon-xs text-blue-600" />
      : <ArrowDown className="fluid-icon-xs text-blue-600" />;
  };

  // Manejar ordenación de grupos
  const handleGroupSort = (field: GroupSortField) => {
    if (groupSortField === field) {
      setGroupSortDirection(groupSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setGroupSortField(field);
      setGroupSortDirection('asc');
    }
  };

  // Obtener icono de ordenación para grupos
  const getGroupSortIcon = (field: GroupSortField) => {
    if (groupSortField !== field) {
      return <ArrowUpDown className="fluid-icon-xs text-gray-400" />;
    }
    return groupSortDirection === 'asc' 
      ? <ArrowUp className="fluid-icon-xs text-blue-600" />
      : <ArrowDown className="fluid-icon-xs text-blue-600" />;
  };

  // Efecto inicial: cargar campuses y verificar parámetros de URL
  useEffect(() => {
    loadAllCampuses();
  }, [loadAllCampuses]);

  // Si hay un campus en la URL, seleccionarlo
  useEffect(() => {
    const campusIdParam = searchParams.get('campus');
    if (campusIdParam && campuses.length > 0) {
      const campus = campuses.find(c => c.id === parseInt(campusIdParam));
      if (campus && !selectedCampus) {
        handleSelectCampus(campus);
      }
    }
  }, [searchParams, campuses]);

  // Filtrar y ordenar planteles
  const processedCampuses = useMemo(() => {
    let result = [...campuses];
    
    // Aplicar búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(campus => 
        campus.name.toLowerCase().includes(searchLower) ||
        campus.partner_name.toLowerCase().includes(searchLower) ||
        campus.city?.toLowerCase().includes(searchLower) ||
        campus.state_name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Aplicar filtro de partner
    if (filterPartner) {
      result = result.filter(campus => campus.partner_name === filterPartner);
    }
    
    // Aplicar filtro de estado
    if (filterState) {
      result = result.filter(campus => campus.state_name === filterState);
    }
    
    // Ordenar
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'partner_name':
          comparison = a.partner_name.localeCompare(b.partner_name);
          break;
        case 'city':
          comparison = (a.city || '').localeCompare(b.city || '');
          break;
        case 'state_name':
          comparison = (a.state_name || '').localeCompare(b.state_name || '');
          break;
        case 'group_count':
          comparison = (a.group_count || 0) - (b.group_count || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [campuses, searchTerm, filterPartner, filterState, sortField, sortDirection]);

  // Limpiar todos los filtros
  const clearFilters = () => {
    setSearchTerm('');
    setFilterPartner('');
    setFilterState('');
  };

  const hasActiveFilters = searchTerm || filterPartner || filterState;

  // Limpiar filtros de grupos
  const clearGroupFilters = () => {
    setGroupSearchTerm('');
    setFilterGroupStatus('');
    setFilterSchoolCycle('');
  };

  const hasActiveGroupFilters = groupSearchTerm || filterGroupStatus || filterSchoolCycle;

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-5 fluid-mb-6">
        <div className="flex items-center fluid-gap-4">
          {view === 'groups' && (
            <button
              onClick={handleBackToCampuses}
              className="fluid-p-2 hover:bg-gray-100 rounded-fluid-lg transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-2 fluid-gap-4">
              <Users className="fluid-icon-xl text-blue-600" />
              {view === 'campuses' ? 'Grupos' : selectedCampus?.name}
            </h1>
            <p className="text-sm fluid-text-lg text-gray-600 fluid-mt-1">
              {view === 'campuses' 
                ? 'Busca y selecciona un plantel para gestionar sus grupos'
                : (
                  <span className="flex items-center fluid-gap-2 flex-wrap">
                    <Link 
                      to={`/partners/${selectedCampus?.partner_id}`}
                      className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center fluid-gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {selectedCampus?.partner_name}
                      <ExternalLink className="fluid-icon-xs" />
                    </Link>
                    <span className="text-gray-400">•</span>
                    <span>{groupTotalResults.toLocaleString()} grupo{groupTotalResults !== 1 ? 's' : ''}</span>
                  </span>
                )
              }
            </p>
          </div>
        </div>
        
        {view === 'groups' && selectedCampus && (
          <div className="flex flex-col sm:flex-row fluid-gap-3 w-full sm:w-auto">
            <Link
              to={`/partners/${selectedCampus.partner_id}`}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-fluid-xl font-medium fluid-text-sm transition-colors"
            >
              <Building2 className="fluid-icon" />
              <span className="hidden sm:inline">Ver Partner</span>
            </Link>
            <Link
              to={`/partners/campuses/${selectedCampus.id}`}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-fluid-xl font-medium fluid-text-sm transition-colors"
            >
              <Settings className="fluid-icon" />
              <span className="hidden sm:inline">Ver Plantel</span>
            </Link>
            <Link
              to={`/partners/campuses/${selectedCampus.id}/groups/new`}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
            >
              <Plus className="fluid-icon-lg" />
              Nuevo Grupo
            </Link>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="fluid-mb-5 fluid-p-5 bg-red-50 border border-red-200 rounded-fluid-xl flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600 flex-shrink-0" />
          <p className="fluid-text-base text-red-700">{error}</p>
          <button 
            onClick={() => view === 'campuses' ? loadAllCampuses() : handleGroupSearch(groupCurrentPage, groupPageSize)} 
            className="ml-auto fluid-text-base text-red-700 underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Vista de Planteles */}
      {view === 'campuses' && (
        <>
          {/* Search and Filters Bar */}
          <div className="bg-white rounded-fluid-xl shadow fluid-p-5 fluid-mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 fluid-icon-lg text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por plantel, partner, ciudad o estado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full fluid-pl-12 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                />
              </div>
              
              {/* Filtros */}
              <div className="flex flex-wrap gap-3">
                {/* Filtro Partner */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowPartnerFilter(!showPartnerFilter);
                      setShowStateFilter(false);
                    }}
                    className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 border rounded-fluid-xl fluid-text-sm transition-colors ${
                      filterPartner 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Building2 className="fluid-icon-sm" />
                    <span className="hidden sm:inline">{filterPartner || 'Partner'}</span>
                    <ChevronDown className={`fluid-icon-xs transition-transform ${showPartnerFilter ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showPartnerFilter && (
                    <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-fluid-xl shadow-lg z-20">
                      <button
                        onClick={() => {
                          setFilterPartner('');
                          setShowPartnerFilter(false);
                        }}
                        className={`w-full text-left fluid-px-4 fluid-py-3 fluid-text-sm hover:bg-gray-50 ${
                          !filterPartner ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        Todos los partners
                      </button>
                      {uniquePartners.map(partner => (
                        <button
                          key={partner}
                          onClick={() => {
                            setFilterPartner(partner);
                            setShowPartnerFilter(false);
                          }}
                          className={`w-full text-left fluid-px-4 fluid-py-3 fluid-text-sm hover:bg-gray-50 ${
                            filterPartner === partner ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {partner}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Filtro Estado */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowStateFilter(!showStateFilter);
                      setShowPartnerFilter(false);
                    }}
                    className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 border rounded-fluid-xl fluid-text-sm transition-colors ${
                      filterState 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <MapPin className="fluid-icon-sm" />
                    <span className="hidden sm:inline">{filterState || 'Estado'}</span>
                    <ChevronDown className={`fluid-icon-xs transition-transform ${showStateFilter ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showStateFilter && (
                    <div className="absolute top-full left-0 mt-2 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-fluid-xl shadow-lg z-20">
                      <button
                        onClick={() => {
                          setFilterState('');
                          setShowStateFilter(false);
                        }}
                        className={`w-full text-left fluid-px-4 fluid-py-3 fluid-text-sm hover:bg-gray-50 ${
                          !filterState ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        Todos los estados
                      </button>
                      {uniqueStates.map(state => (
                        <button
                          key={state}
                          onClick={() => {
                            setFilterState(state);
                            setShowStateFilter(false);
                          }}
                          className={`w-full text-left fluid-px-4 fluid-py-3 fluid-text-sm hover:bg-gray-50 ${
                            filterState === state ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Limpiar filtros */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-fluid-xl fluid-text-sm transition-colors"
                  >
                    <X className="fluid-icon-sm" />
                    <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="flex items-center flex-wrap gap-2 fluid-mt-4 fluid-pt-4 border-t border-gray-100">
                <span className="fluid-text-sm text-gray-500">Filtros activos:</span>
                {searchTerm && (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-gray-100 text-gray-700 rounded-full fluid-text-sm">
                    Búsqueda: "{searchTerm}"
                    <button onClick={() => setSearchTerm('')} className="hover:text-gray-900">
                      <X className="fluid-icon-xs" />
                    </button>
                  </span>
                )}
                {filterPartner && (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-blue-100 text-blue-700 rounded-full fluid-text-sm">
                    Partner: {filterPartner}
                    <button onClick={() => setFilterPartner('')} className="hover:text-blue-900">
                      <X className="fluid-icon-xs" />
                    </button>
                  </span>
                )}
                {filterState && (
                  <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-green-100 text-green-700 rounded-full fluid-text-sm">
                    Estado: {filterState}
                    <button onClick={() => setFilterState('')} className="hover:text-green-900">
                      <X className="fluid-icon-xs" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tabla de Planteles */}
          {loadingCampuses ? (
            <div className="bg-white rounded-fluid-xl shadow fluid-p-10">
              <LoadingSpinner message="Cargando planteles..." />
            </div>
          ) : processedCampuses.length === 0 ? (
            <div className="bg-white rounded-fluid-xl shadow fluid-p-10 text-center">
              <Building2 className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-5" />
              <h3 className="fluid-text-xl font-medium text-gray-700 fluid-mb-2">
                {hasActiveFilters ? 'No se encontraron planteles' : 'No hay planteles disponibles'}
              </h3>
              <p className="text-gray-500 fluid-text-base fluid-mb-4">
                {hasActiveFilters ? 'Intenta con otros filtros o términos de búsqueda' : 'No tienes acceso a ningún plantel'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-fluid-xl fluid-text-base transition-colors"
                >
                  <X className="fluid-icon-sm" />
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-fluid-xl shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th 
                        className="text-left fluid-px-5 fluid-py-4 fluid-text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center fluid-gap-2">
                          Plantel
                          {getSortIcon('name')}
                        </div>
                      </th>
                      <th 
                        className="text-left fluid-px-5 fluid-py-4 fluid-text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('partner_name')}
                      >
                        <div className="flex items-center fluid-gap-2">
                          Partner
                          {getSortIcon('partner_name')}
                        </div>
                      </th>
                      <th 
                        className="text-left fluid-px-5 fluid-py-4 fluid-text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors hidden md:table-cell"
                        onClick={() => handleSort('city')}
                      >
                        <div className="flex items-center fluid-gap-2">
                          Ciudad
                          {getSortIcon('city')}
                        </div>
                      </th>
                      <th 
                        className="text-left fluid-px-5 fluid-py-4 fluid-text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors hidden lg:table-cell"
                        onClick={() => handleSort('state_name')}
                      >
                        <div className="flex items-center fluid-gap-2">
                          Estado
                          {getSortIcon('state_name')}
                        </div>
                      </th>
                      <th 
                        className="text-center fluid-px-5 fluid-py-4 fluid-text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('group_count')}
                      >
                        <div className="flex items-center justify-center fluid-gap-2">
                          Grupos
                          {getSortIcon('group_count')}
                        </div>
                      </th>
                      <th className="fluid-px-5 fluid-py-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedCampuses.map((campus) => (
                      <tr 
                        key={campus.id}
                        className="hover:bg-blue-50 cursor-pointer transition-colors group"
                        onClick={() => handleSelectCampus(campus)}
                      >
                        <td className="fluid-px-5 fluid-py-4">
                          <div className="flex items-center fluid-gap-3">
                            <div className="w-10 h-10 rounded-fluid-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                              <Building2 className="fluid-icon text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 fluid-text-base group-hover:text-blue-600 transition-colors">
                                {campus.name}
                              </p>
                              <p className="fluid-text-sm text-gray-500 md:hidden">
                                {[campus.city, campus.state_name].filter(Boolean).join(', ') || 'Sin ubicación'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="fluid-px-5 fluid-py-4">
                          <span className="fluid-text-sm text-gray-700">{campus.partner_name}</span>
                        </td>
                        <td className="fluid-px-5 fluid-py-4 hidden md:table-cell">
                          <span className="fluid-text-sm text-gray-600">{campus.city || '—'}</span>
                        </td>
                        <td className="fluid-px-5 fluid-py-4 hidden lg:table-cell">
                          <span className="fluid-text-sm text-gray-600">{campus.state_name || '—'}</span>
                        </td>
                        <td className="fluid-px-5 fluid-py-4 text-center">
                          <span className="inline-flex items-center justify-center fluid-gap-1 min-w-[3rem] fluid-px-3 fluid-py-1 bg-blue-100 text-blue-700 rounded-full fluid-text-sm font-medium">
                            <Users className="fluid-icon-xs" />
                            {campus.group_count || 0}
                          </span>
                        </td>
                        <td className="fluid-px-5 fluid-py-4 text-right">
                          <ChevronRight className="fluid-icon-lg text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Footer con estadísticas */}
              <div className="fluid-px-5 fluid-py-4 bg-gray-50 border-t border-gray-200">
                <p className="fluid-text-sm text-gray-600 text-center">
                  Mostrando <span className="font-semibold">{processedCampuses.length}</span> de{' '}
                  <span className="font-semibold">{campuses.length}</span> plantel{campuses.length !== 1 ? 'es' : ''}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Vista de Grupos */}
      {view === 'groups' && selectedCampus && (
        <>
          {loadingGroups && groups.length === 0 ? (
            <div className="bg-white rounded-fluid-xl shadow fluid-p-10">
              <LoadingSpinner message="Cargando grupos..." />
            </div>
          ) : (
            <>
              {/* Barra de búsqueda, filtros y paginación para grupos */}
              <div className="bg-white rounded-fluid-xl shadow fluid-p-5 fluid-mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Búsqueda */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 fluid-icon-lg text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, descripción o ciclo..."
                      value={groupSearchTerm}
                      onChange={(e) => setGroupSearchTerm(e.target.value)}
                      className="w-full fluid-pl-12 fluid-pr-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent fluid-text-base"
                    />
                  </div>
                  
                  {/* Filtros */}
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* Filtro Estado */}
                    <select
                      value={filterGroupStatus}
                      onChange={(e) => setFilterGroupStatus(e.target.value as '' | 'active' | 'inactive')}
                      className={`fluid-px-4 fluid-py-3 border rounded-fluid-xl fluid-text-sm transition-colors cursor-pointer ${
                        filterGroupStatus 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <option value="">Todos los estados</option>
                      <option value="active">Activos</option>
                      <option value="inactive">Inactivos</option>
                    </select>
                    
                    {/* Filtro Ciclo Escolar */}
                    {availableCycles.length > 0 && (
                      <select
                        value={filterSchoolCycle}
                        onChange={(e) => setFilterSchoolCycle(e.target.value)}
                        className={`fluid-px-4 fluid-py-3 border rounded-fluid-xl fluid-text-sm transition-colors cursor-pointer ${
                          filterSchoolCycle 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <option value="">Todos los ciclos</option>
                        {availableCycles.map(cycle => (
                          <option key={cycle} value={cycle}>{cycle}</option>
                        ))}
                      </select>
                    )}

                    {/* Registros por página */}
                    <div className="flex items-center fluid-gap-1.5">
                      <span className="fluid-text-xs text-gray-500">Mostrar</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={groupPageSizeInput}
                        onChange={(e) => setGroupPageSizeInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleGroupPageSizeInputSubmit(); }}
                        onBlur={handleGroupPageSizeInputSubmit}
                        className="w-16 text-center py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        title="Registros por página (máx 1000)"
                      />
                    </div>

                    {/* Botón refrescar */}
                    <button
                      onClick={() => handleGroupSearch(groupCurrentPage, groupPageSize)}
                      disabled={searchingGroups}
                      className="fluid-p-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
                      title="Refrescar"
                    >
                      <RefreshCw className={`fluid-icon-sm text-gray-600 ${searchingGroups ? 'animate-spin' : ''}`} />
                    </button>
                    
                    {/* Limpiar filtros */}
                    {hasActiveGroupFilters && (
                      <button
                        onClick={clearGroupFilters}
                        className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-fluid-xl fluid-text-sm transition-colors"
                      >
                        <X className="fluid-icon-sm" />
                        <span className="hidden sm:inline">Limpiar</span>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Resumen de filtros activos */}
                {hasActiveGroupFilters && (
                  <div className="flex items-center flex-wrap gap-2 fluid-mt-4 fluid-pt-4 border-t border-gray-100">
                    <span className="fluid-text-sm text-gray-500">Filtros activos:</span>
                    {groupSearchTerm && (
                      <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-gray-100 text-gray-700 rounded-full fluid-text-sm">
                        Búsqueda: "{groupSearchTerm}"
                        <button onClick={() => setGroupSearchTerm('')} className="hover:text-gray-900">
                          <X className="fluid-icon-xs" />
                        </button>
                      </span>
                    )}
                    {filterGroupStatus && (
                      <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-blue-100 text-blue-700 rounded-full fluid-text-sm">
                        Estado: {filterGroupStatus === 'active' ? 'Activos' : 'Inactivos'}
                        <button onClick={() => setFilterGroupStatus('')} className="hover:text-blue-900">
                          <X className="fluid-icon-xs" />
                        </button>
                      </span>
                    )}
                    {filterSchoolCycle && (
                      <span className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-1 bg-green-100 text-green-700 rounded-full fluid-text-sm">
                        Ciclo: {filterSchoolCycle}
                        <button onClick={() => setFilterSchoolCycle('')} className="hover:text-green-900">
                          <X className="fluid-icon-xs" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {groupTotalResults === 0 && !searchingGroups && !hasActiveGroupFilters ? (
                <div className="bg-white rounded-fluid-xl shadow fluid-p-10 text-center">
                  <Users className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-5" />
                  <h3 className="fluid-text-xl font-medium text-gray-700 fluid-mb-2">
                    No hay grupos en este plantel
                  </h3>
                  <p className="text-gray-500 fluid-text-base fluid-mb-5">
                    Crea un nuevo grupo para comenzar a gestionar candidatos
                  </p>
                  <Link
                    to={`/partners/campuses/${selectedCampus.id}/groups/new`}
                    className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-base transition-colors"
                  >
                    <Plus className="fluid-icon-lg" />
                    Crear Grupo
                  </Link>
                </div>
              ) : groupTotalResults === 0 && !searchingGroups ? (
                <div className="bg-white rounded-fluid-xl shadow fluid-p-10 text-center">
                  <Users className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-5" />
                  <h3 className="fluid-text-xl font-medium text-gray-700 fluid-mb-2">
                    No se encontraron grupos
                  </h3>
                  <p className="text-gray-500 fluid-text-base fluid-mb-4">
                    Intenta con otros filtros o términos de búsqueda
                  </p>
                  {hasActiveGroupFilters && (
                    <button
                      onClick={clearGroupFilters}
                      className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-fluid-xl fluid-text-base transition-colors"
                    >
                      <X className="fluid-icon-sm" />
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : (
            <div className="bg-white rounded-fluid-xl shadow overflow-hidden">
              {/* Paginación arriba de la tabla */}
              <div className="bg-white border-b border-gray-200 px-6 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="fluid-text-sm text-gray-600">
                    {searchingGroups ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando...
                      </span>
                    ) : (
                      <>
                        Mostrando <span className="font-medium">{((groupCurrentPage - 1) * groupPageSize + 1).toLocaleString()}</span>
                        {' - '}
                        <span className="font-medium">{Math.min(groupCurrentPage * groupPageSize, groupTotalResults).toLocaleString()}</span>
                        {' de '}
                        <span className="font-medium">{groupTotalResults.toLocaleString()}</span> grupos
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleGroupPageChange(1)}
                      disabled={groupCurrentPage === 1}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                      title="Primera página"
                    >
                      1
                    </button>
                    <button
                      onClick={() => handleGroupPageChange(groupCurrentPage - 1)}
                      disabled={groupCurrentPage === 1}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="fluid-icon-sm" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={groupPageInputValue}
                      onChange={(e) => setGroupPageInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleGroupPageInputSubmit(); }}
                      onBlur={handleGroupPageInputSubmit}
                      className="w-14 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      title="Escribe el número de página y presiona Enter"
                    />
                    <span className="fluid-text-sm text-gray-400">/ {groupTotalPages}</span>
                    <button
                      onClick={() => handleGroupPageChange(groupCurrentPage + 1)}
                      disabled={groupCurrentPage === groupTotalPages}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="fluid-icon-sm" />
                    </button>
                    <button
                      onClick={() => handleGroupPageChange(groupTotalPages)}
                      disabled={groupCurrentPage === groupTotalPages}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                      title="Última página"
                    >
                      {groupTotalPages}
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th 
                          className="fluid-px-5 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleGroupSort('name')}
                        >
                          <div className="flex items-center fluid-gap-2">
                            Grupo
                            {getGroupSortIcon('name')}
                          </div>
                        </th>
                        <th 
                          className="fluid-px-5 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleGroupSort('member_count')}
                        >
                          <div className="flex items-center justify-center fluid-gap-2">
                            Miembros
                            {getGroupSortIcon('member_count')}
                          </div>
                        </th>
                        <th 
                          className="fluid-px-5 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleGroupSort('school_cycle')}
                        >
                          <div className="flex items-center fluid-gap-2">
                            Ciclo Escolar
                            {getGroupSortIcon('school_cycle')}
                          </div>
                        </th>
                        <th 
                          className="fluid-px-5 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleGroupSort('created_at')}
                        >
                          <div className="flex items-center fluid-gap-2">
                            Creación
                            {getGroupSortIcon('created_at')}
                          </div>
                        </th>
                        <th 
                          className="fluid-px-5 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleGroupSort('is_active')}
                        >
                          <div className="flex items-center justify-center fluid-gap-2">
                            Estado
                            {getGroupSortIcon('is_active')}
                          </div>
                        </th>
                        <th className="fluid-px-5 fluid-py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groups.map((group) => (
                        <tr
                          key={group.id}
                          className="hover:bg-blue-50 transition-colors cursor-pointer group"
                          onClick={() => window.location.href = `/partners/groups/${group.id}`}
                        >
                          <td className="fluid-px-5 fluid-py-4">
                            <div className="flex items-center fluid-gap-3 min-w-0">
                              <div className={`fluid-p-2 rounded-fluid-lg flex-shrink-0 ${group.is_active ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                <Layers className={`fluid-icon-sm ${group.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                              </div>
                              <div className="min-w-0">
                                <p className={`fluid-text-sm font-semibold truncate ${group.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {group.name}
                                </p>
                                {group.description && (
                                  <p className="fluid-text-xs text-gray-500 truncate max-w-xs">{group.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="fluid-px-5 fluid-py-4 text-center">
                            <div className="inline-flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-1 bg-amber-50 text-amber-700 rounded-full">
                              <Users className="fluid-icon-xs" />
                              <span className="fluid-text-sm font-medium">{group.member_count || 0}</span>
                            </div>
                          </td>
                          <td className="fluid-px-5 fluid-py-4">
                            {group.school_cycle ? (
                              <div className="flex items-center fluid-gap-2">
                                <Calendar className="fluid-icon-xs text-gray-400" />
                                <span className="fluid-text-sm text-gray-700">{group.school_cycle.name}</span>
                              </div>
                            ) : (
                              <span className="fluid-text-xs text-gray-400">Sin ciclo</span>
                            )}
                          </td>
                          <td className="fluid-px-5 fluid-py-4">
                            <div className="flex items-center fluid-gap-2 fluid-text-xs text-gray-600">
                              <Clock className="fluid-icon-xs text-gray-400" />
                              {group.created_at 
                                ? new Date(group.created_at).toLocaleDateString('es-MX', { 
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                : '—'
                              }
                            </div>
                          </td>
                          <td className="fluid-px-5 fluid-py-4 text-center">
                            {group.is_active ? (
                              <span className="inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 bg-emerald-100 text-emerald-700 rounded-full fluid-text-xs font-semibold">
                                <CheckCircle2 className="fluid-icon-xs" />
                                Activo
                              </span>
                            ) : (
                              <span className="inline-flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 bg-red-100 text-red-600 rounded-full fluid-text-xs font-semibold">
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="fluid-px-5 fluid-py-4 text-right">
                            <div className="flex items-center fluid-gap-2 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                              <span className="fluid-text-xs font-medium">Ver</span>
                              <ChevronRight className="fluid-icon-sm" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Footer con paginación */}
              <div className="fluid-px-5 fluid-py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="fluid-text-sm text-gray-600">
                    Mostrando <span className="font-semibold">{((groupCurrentPage - 1) * groupPageSize + 1).toLocaleString()}</span>
                    {' - '}
                    <span className="font-semibold">{Math.min(groupCurrentPage * groupPageSize, groupTotalResults).toLocaleString()}</span>
                    {' de '}
                    <span className="font-semibold">{groupTotalResults.toLocaleString()}</span> grupo{groupTotalResults !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleGroupPageChange(1)}
                      disabled={groupCurrentPage === 1}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                    >
                      1
                    </button>
                    <button
                      onClick={() => handleGroupPageChange(groupCurrentPage - 1)}
                      disabled={groupCurrentPage === 1}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="fluid-icon-sm" />
                    </button>
                    <span className="fluid-text-sm text-gray-500 px-2">{groupCurrentPage} / {groupTotalPages}</span>
                    <button
                      onClick={() => handleGroupPageChange(groupCurrentPage + 1)}
                      disabled={groupCurrentPage === groupTotalPages}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="fluid-icon-sm" />
                    </button>
                    <button
                      onClick={() => handleGroupPageChange(groupTotalPages)}
                      disabled={groupCurrentPage === groupTotalPages}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600"
                    >
                      {groupTotalPages}
                    </button>
                  </div>
                </div>
              </div>
            </div>
              )}
            </>
          )}
        </>
      )}
      
      {/* Cerrar dropdowns al hacer click fuera */}
      {(showPartnerFilter || showStateFilter) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setShowPartnerFilter(false);
            setShowStateFilter(false);
          }}
        />
      )}
    </div>
  );
}
