/**
 * Página de Asignación de Candidatos a Grupo
 * Buscar y Asignar - Con filtros avanzados y asignación masiva por criterios
 * La carga masiva Excel se encuentra en GroupBulkUploadPage
 *
 * Reglas de negocio:
 * - Un candidato puede pertenecer a N grupos simultáneamente
 * - La asignación a un grupo es permanente (no se puede deshacer)
 * - La tabla está optimizada para manejar cientos de miles de registros
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  UserPlus,
  Users,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Filter,
  FileSpreadsheet,
  Eye,
  UserCheck,
  Zap,
  Award,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembersCount,
  getGroupExams,
  searchCandidatesAdvanced,
  addGroupMembersBulk,

  bulkAssignByCriteria,
  CandidateGroup,
  CandidateSearchResult,
  GroupExamAssignment,
} from '../../services/partnersService';

// Campos de búsqueda disponibles
const SEARCH_FIELDS = [
  { key: 'all', label: 'Todos los campos' },
  { key: 'name', label: 'Nombre' },
  { key: 'first_surname', label: 'Primer Apellido' },
  { key: 'second_surname', label: 'Segundo Apellido' },
  { key: 'email', label: 'Email' },
  { key: 'curp', label: 'CURP' },
];

const MAX_PAGE_SIZE = 1000;

export default function GroupAssignCandidatesPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  // Estado del grupo
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [currentMemberCount, setCurrentMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Estado de búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [searchResults, setSearchResults] = useState<CandidateSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [pageSizeInput, setPageSizeInput] = useState('500');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  
  // Filtros avanzados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterHasEmail, setFilterHasEmail] = useState<'' | 'yes' | 'no'>('');
  const [filterHasCurp, setFilterHasCurp] = useState<'' | 'yes' | 'no'>('');
  const [filterEligibility, setFilterEligibility] = useState<string>('');
  
  // Estado de selección
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  
  // Estado de acciones
  const [addingMembers, setAddingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  

  
  // Ref para cancelar respuestas stale de búsquedas anteriores
  const searchRequestRef = useRef(0);
  

  
  // Estado de ordenamiento en tabla de búsqueda
  const [searchSortCol, setSearchSortCol] = useState<string>('');
  const [searchSortDir, setSearchSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Estado para asignación masiva por criterios
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [assigningAll, setAssigningAll] = useState(false);
  
  // Modo liviano para page sizes extremos (>1000) — en la práctica nunca se activa
  const isLightweight = pageSize > 1000;

  // Computed: todos los candidatos de la página actual están seleccionados
  const allOnPageSelected = searchResults.length > 0 && searchResults.every(c => selectedCandidates.has(c.id));
  
  // Estado para panel de seleccionados
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [selectedPanelSearch, setSelectedPanelSearch] = useState('');
  const [selectedCandidatesData, setSelectedCandidatesData] = useState<Map<string, CandidateSearchResult>>(new Map());

  // Estado para modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalSearch, setConfirmModalSearch] = useState('');

  // Estado para ECMs activos del grupo (auto-asignación)
  const [groupExams, setGroupExams] = useState<GroupExamAssignment[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<Set<number>>(new Set());

  // Cargar datos iniciales
  useEffect(() => {
    loadGroupData();
    loadGroupExams();
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const [groupData, membersCountData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembersCount(Number(groupId)),
      ]);
      setGroup(groupData);
      setCurrentMemberCount(membersCountData.count);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupExams = async () => {
    try {
      const data = await getGroupExams(Number(groupId));
      const activeExams = (data.assigned_exams || []).filter(e => e.is_active);
      setGroupExams(activeExams);
      // Auto-seleccionar todos los ECMs activos por defecto
      setSelectedExamIds(new Set(activeExams.map(e => e.id)));
    } catch (err) {
      console.error('Error loading group exams:', err);
    }
  };

  // Búsqueda de candidatos con filtros avanzados
  const handleSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    const requestId = ++searchRequestRef.current;
    try {
      setSearching(true);
      setSelectAllMatching(false);
      
      // Si no hay término de búsqueda ni filtros avanzados, mostrar los más recientes
      const hasActiveFilters = filterGender || filterHasEmail || filterHasCurp || filterEligibility;
      const isDefaultView = !searchQuery && !hasActiveFilters;
      
      // Elegibilidad mapea a has_email / has_curp en el backend
      let effectiveHasEmail = filterHasEmail || undefined;
      let effectiveHasCurp = filterHasCurp || undefined;
      if (filterEligibility === 'CC') effectiveHasCurp = 'yes'; // CC requiere CURP
      if (filterEligibility === 'ID') effectiveHasEmail = 'yes'; // ID requiere email
      if (filterEligibility === 'no_CC') effectiveHasCurp = 'no'; // Sin CC = sin CURP
      if (filterEligibility === 'no_ID') effectiveHasEmail = 'no'; // Sin ID = sin email
      
      const results = await searchCandidatesAdvanced({
        search: searchQuery.length >= 2 ? searchQuery : undefined,
        search_field: searchField !== 'all' ? searchField : undefined,
        exclude_group_id: Number(groupId),
        gender: filterGender || undefined,
        has_email: effectiveHasEmail as string | undefined,
        has_curp: effectiveHasCurp as string | undefined,
        page,
        per_page: perPage,
        sort_by: isDefaultView ? 'recent' : 'name',
      });
      // Ignorar respuestas de búsquedas anteriores (race condition)
      if (requestId !== searchRequestRef.current) return;
      setSearchResults(results.candidates);
      setTotalPages(results.pages);
      setTotalResults(results.total);
      setCurrentPage(page);
    } catch (err: any) {
      if (requestId !== searchRequestRef.current) return;
      console.error('Error searching candidates:', err);
      setError('Error al buscar candidatos');
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  }, [searchQuery, searchField, groupId, pageSize, filterGender, filterHasEmail, filterHasCurp, filterEligibility]);

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => handleSearch(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [handleSearch, pageSize]);

  // Selección de candidatos
  const handleToggleCandidate = (candidateId: string, candidateData?: CandidateSearchResult) => {
    // Si está en modo "seleccionar todos", desactivar ese modo
    if (selectAllMatching) {
      setSelectAllMatching(false);
    }
    
    const newSelected = new Set(selectedCandidates);
    const newDataMap = new Map(selectedCandidatesData);
    
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
      newDataMap.delete(candidateId);
    } else {
      newSelected.add(candidateId);
      if (candidateData) {
        newDataMap.set(candidateId, candidateData);
      }
    }
    setSelectedCandidates(newSelected);
    setSelectedCandidatesData(newDataMap);
    setError(null);
  };

  const handleToggleSelectAllOnPage = () => {
    if (selectAllMatching) {
      setSelectAllMatching(false);
    }
    
    const newDataMap = new Map(selectedCandidatesData);
    
    if (allOnPageSelected) {
      const newSelected = new Set(selectedCandidates);
      searchResults.forEach(c => {
        newSelected.delete(c.id);
        newDataMap.delete(c.id);
      });
      setSelectedCandidates(newSelected);
      setSelectedCandidatesData(newDataMap);
    } else {
      const newSelected = new Set(selectedCandidates);
      for (const candidate of searchResults) {
        newSelected.add(candidate.id);
        newDataMap.set(candidate.id, candidate);
      }
      setSelectedCandidates(newSelected);
      setSelectedCandidatesData(newDataMap);
    }
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
    setSelectedCandidatesData(new Map());
    setSelectAllMatching(false);
    setShowSelectedPanel(false);
    setShowConfirmModal(false);
  };
  
  // Seleccionar TODOS los candidatos que coinciden con los criterios (cross-page)
  const handleSelectAllMatching = () => {
    setSelectAllMatching(true);
    setSelectedCandidates(new Set());
    setSelectedCandidatesData(new Map());
    setShowSelectedPanel(false);
  };
  
  // Filtrar candidatos seleccionados para el modal de confirmación
  const filteredConfirmCandidates = Array.from(selectedCandidatesData.values()).filter(candidate => {
    if (!confirmModalSearch) return true;
    const search = confirmModalSearch.toLowerCase();
    return (
      candidate.full_name?.toLowerCase().includes(search) ||
      candidate.email?.toLowerCase().includes(search) ||
      candidate.curp?.toLowerCase().includes(search)
    );
  });

  // Filtrar candidatos seleccionados para el panel
  const filteredSelectedCandidates = Array.from(selectedCandidatesData.values()).filter(candidate => {
    if (!selectedPanelSearch) return true;
    const search = selectedPanelSearch.toLowerCase();
    return (
      candidate.full_name?.toLowerCase().includes(search) ||
      candidate.email?.toLowerCase().includes(search) ||
      candidate.curp?.toLowerCase().includes(search)
    );
  });

  // Ordenar resultados de búsqueda localmente
  const sortedSearchResults = useMemo(() => {
    if (!searchSortCol) return searchResults;
    return [...searchResults].sort((a, b) => {
      let va = '', vb = '';
      switch (searchSortCol) {
        case 'name': va = a.full_name || ''; vb = b.full_name || ''; break;
        case 'email': va = a.email || ''; vb = b.email || ''; break;
        case 'curp': va = a.curp || ''; vb = b.curp || ''; break;
        case 'gender': va = a.gender || ''; vb = b.gender || ''; break;
        case 'group': va = a.current_group?.group_name || ''; vb = b.current_group?.group_name || ''; break;
        case 'eligibility': {
          const score = (c: CandidateSearchResult) => (c.curp ? 1 : 0) + (c.email ? 1 : 0);
          return searchSortDir === 'asc' ? score(a) - score(b) : score(b) - score(a);
        }
        default: return 0;
      }
      return searchSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [searchResults, searchSortCol, searchSortDir]);

  const handleSearchSort = (col: string) => {
    if (searchSortCol === col) {
      setSearchSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSearchSortCol(col);
      setSearchSortDir('asc');
    }
  };

  const renderSearchSortIcon = (col: string) => {
    if (searchSortCol === col) {
      return searchSortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
  };

  // Helper: renderizar badges de elegibilidad de certificados
  const renderEligibilityBadges = (email?: string | null, curp?: string | null) => {
    const badges = [
      { label: 'RE', title: 'Reporte de Evaluación', eligible: true },
      { label: 'CE', title: 'Certificado EDUIT', eligible: true },
      { label: 'CC', title: 'Certificado CONOCER', eligible: !!curp, requirement: 'Requiere CURP' },
      { label: 'ID', title: 'Insignia Digital', eligible: !!email, requirement: 'Requiere email' },
    ];
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {badges.map(b => (
          <span
            key={b.label}
            title={b.eligible ? `${b.title}: Elegible` : `${b.title}: No elegible — ${b.requirement}`}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${
              b.eligible
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-400 border border-red-200 line-through'
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
    );
  };

  // Agregar candidatos seleccionados (individual selection)
  const handleAddSelectedCandidates = async () => {
    if (selectedCandidates.size === 0) return;
    
    try {
      setAddingMembers(true);
      setError(null);
      
      const userIds = Array.from(selectedCandidates);
      const autoAssignExamIds = groupExams.length > 0 ? Array.from(selectedExamIds) : undefined;
      const result = await addGroupMembersBulk(Number(groupId), userIds, autoAssignExamIds);
      
      if (result.added.length > 0) {
        let msg = `${result.added.length} candidato(s) agregado(s) al grupo`;
        if (result.auto_assigned_exams && result.auto_assigned_exams > 0) {
          msg += ` y asignado(s) a ${result.auto_assigned_exams} certificación(es)`;
        }
        setSuccessMessage(msg);
        setCurrentMemberCount(prev => prev + result.added.length);
        setSelectedCandidates(new Set());
        setSelectedCandidatesData(new Map());
        setShowSelectedPanel(false);
        setShowConfirmModal(false);
        handleSearch(currentPage, pageSize);
      }
      
      if (result.errors.length > 0) {
        setError(`${result.errors.length} candidato(s) no pudieron ser agregados`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al agregar candidatos');
    } finally {
      setAddingMembers(false);
    }
  };

  // Asignar TODOS los candidatos que coinciden con los criterios de búsqueda
  const handleAssignAllMatching = async () => {
    if (!selectAllMatching || totalResults === 0) return;
    
    const confirmMsg = `¿Estás seguro de asignar ${totalResults.toLocaleString()} candidato(s) al grupo "${group?.name}"?\n\nEsta acción no se puede deshacer.`;
    if (!confirm(confirmMsg)) return;
    
    try {
      setAssigningAll(true);
      setError(null);
      
      const criteria: Record<string, string | undefined> = {};
      if (searchQuery.length >= 2) criteria.search = searchQuery;
      if (searchField !== 'all') criteria.search_field = searchField;
      if (filterGender) criteria.gender = filterGender;
      if (filterHasEmail) criteria.has_email = filterHasEmail;
      if (filterHasCurp) criteria.has_curp = filterHasCurp;
      if (filterEligibility === 'CC') criteria.has_curp = 'yes';
      if (filterEligibility === 'ID') criteria.has_email = 'yes';
      if (filterEligibility === 'no_CC') criteria.has_curp = 'no';
      if (filterEligibility === 'no_ID') criteria.has_email = 'no';
      
      const result = await bulkAssignByCriteria(Number(groupId), criteria);
      
      if (result.added > 0) {
        setSuccessMessage(`${result.added.toLocaleString()} candidato(s) asignado(s) al grupo`);
        setCurrentMemberCount(prev => prev + result.added);
        setSelectAllMatching(false);
        setSelectedCandidates(new Set());
        handleSearch(1, pageSize);
      } else {
        setSuccessMessage('No se encontraron candidatos nuevos para asignar');
      }
      
      if (result.skipped > 0) {
        setError(`${result.skipped} candidato(s) ya eran miembros del grupo`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al asignar candidatos masivamente');
    } finally {
      setAssigningAll(false);
    }
  };

  // Estado local para el input de página (permite escribir libremente)
  const [pageInputValue, setPageInputValue] = useState(String(currentPage));
  
  // Sincronizar cuando la página real cambia
  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  // Paginación
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

  const handlePageSizeChange = (newSize: number) => {
    const clamped = Math.max(1, Math.min(MAX_PAGE_SIZE, newSize));
    setPageSize(clamped);
    setPageSizeInput(String(clamped));
    // No llamar handleSearch directamente: el debounce se encarga al detectar el cambio de pageSize
  };

  const handlePageSizeInputSubmit = () => {
    const val = parseInt(pageSizeInput, 10);
    if (!isNaN(val) && val >= 1) {
      handlePageSizeChange(val);
    } else {
      setPageSizeInput(String(pageSize));
    }
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando candidatos..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* ===== BREADCRUMB ===== */}
      <PartnersBreadcrumb 
        items={[
          { label: group?.campus?.partner?.name || 'Partner', path: `/partners/${group?.campus?.partner_id}` },
          { label: group?.campus?.name || 'Plantel', path: `/partners/campuses/${group?.campus_id}` },
          { label: group?.name || 'Grupo', path: `/partners/groups/${groupId}` },
          { label: 'Asignar Candidatos' }
        ]} 
      />

      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <Link
                to={`/partners/groups/${groupId}`}
                className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
              >
                <ArrowLeft className="fluid-icon-lg" />
              </Link>
              <div>
                <p className="fluid-text-sm text-white/80 fluid-mb-1">{group?.name}</p>
                <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                  <UserPlus className="fluid-icon-lg" />
                  Asignar Candidatos
                </h1>
              </div>
            </div>
            <button
              onClick={() => navigate(`/partners/groups/${groupId}/bulk-upload`)}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 text-white rounded-fluid-xl font-medium transition-colors fluid-text-sm backdrop-blur-sm"
            >
              <FileSpreadsheet className="fluid-icon-sm" />
              Carga Masiva Excel
            </button>
          </div>

          {/* Stats en header */}
          <div className="grid grid-cols-3 fluid-gap-4 fluid-mt-5">
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{currentMemberCount}</p>
              <p className="fluid-text-xs text-white/70">Miembros Actuales</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{selectedCandidates.size || (selectAllMatching ? totalResults : 0)}</p>
              <p className="fluid-text-xs text-white/70">Seleccionados</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{totalResults.toLocaleString()}</p>
              <p className="fluid-text-xs text-white/70">Disponibles</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MENSAJES DE ESTADO ===== */}
      {(error || successMessage) && (
        <div className="fluid-mb-4">
          {error && (
            <div className="fluid-p-3 bg-red-50 border border-red-200 rounded-fluid-lg flex items-center fluid-gap-2 text-red-700">
              <XCircle className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)}>
                <X className="fluid-icon-sm" />
              </button>
            </div>
          )}
          {successMessage && (
            <div className="fluid-p-3 bg-green-50 border border-green-200 rounded-fluid-lg flex items-center fluid-gap-2 text-green-700">
              <CheckCircle2 className="fluid-icon flex-shrink-0" />
              <p className="fluid-text-sm flex-1">{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)}>
                <X className="fluid-icon-sm" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== CONTENIDO PRINCIPAL ===== */}
        
        {/* ==================== BÚSQUEDA Y ASIGNACIÓN ==================== */}
          <>
            {/* Barra de herramientas */}
            <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5">
              <div className="flex flex-wrap items-center fluid-gap-3">
                {/* Campo de búsqueda */}
                <div className="flex-1 min-w-[300px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, email o CURP (mín. 2 caracteres)..."
                    className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 fluid-text-sm"
                  />
                </div>
                
                {/* Selector de campo */}
                <select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {SEARCH_FIELDS.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
                
                {/* Botón filtros avanzados */}
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 border rounded-fluid-lg fluid-text-sm transition-colors ${
                    showAdvancedFilters
                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="fluid-icon-sm" />
                  Filtros
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
                    className="w-16 text-center py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    title={`Registros por página (máx ${MAX_PAGE_SIZE})`}
                  />
                </div>
                
                {/* Botón refrescar */}
                <button
                  onClick={() => handleSearch(currentPage, pageSize)}
                  disabled={searching}
                  className="fluid-p-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors"
                  title="Refrescar"
                >
                  <RefreshCw className={`fluid-icon-sm text-gray-600 ${searching ? 'animate-spin' : ''}`} />
                </button>
                
                <div className="h-6 w-px bg-gray-300" />
                
                {/* Info de selección */}
                {(selectedCandidates.size > 0 || selectAllMatching) && (
                  <div className="flex items-center fluid-gap-2 fluid-text-sm">
                    <span className="font-medium text-purple-700">
                      {selectAllMatching 
                        ? `${totalResults.toLocaleString()} (todos)` 
                        : `${selectedCandidates.size} seleccionado(s)`}
                    </span>
                    {!selectAllMatching && selectedCandidates.size > 0 && (
                      <button
                        onClick={() => setShowSelectedPanel(!showSelectedPanel)}
                        className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 rounded transition-colors ${
                          showSelectedPanel 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'text-purple-600 hover:bg-purple-50'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </button>
                    )}
                    <button
                      onClick={handleClearSelection}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
                
                {/* Botón asignar seleccionados — abre modal de confirmación */}
                {!selectAllMatching && (
                  <button
                    onClick={() => { setConfirmModalSearch(''); setShowConfirmModal(true); }}
                    disabled={selectedCandidates.size === 0 || addingMembers}
                    className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-lg font-medium transition-colors"
                  >
                    {addingMembers ? (
                      <Loader2 className="fluid-icon-sm animate-spin" />
                    ) : (
                      <UserPlus className="fluid-icon-sm" />
                    )}
                    {selectedCandidates.size > 0 ? `Agregar (${selectedCandidates.size})` : 'Agregar'}
                  </button>
                )}
                
                {/* Botón asignar TODOS los que coinciden */}
                {selectAllMatching && (
                  <button
                    onClick={handleAssignAllMatching}
                    disabled={assigningAll || totalResults === 0}
                    className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-lg font-medium transition-colors"
                  >
                    {assigningAll ? (
                      <Loader2 className="fluid-icon-sm animate-spin" />
                    ) : (
                      <Zap className="fluid-icon-sm" />
                    )}
                    Asignar {totalResults.toLocaleString()}
                  </button>
                )}
              </div>
              
              {/* Filtros */}
              {showAdvancedFilters && (
                <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-100 flex flex-wrap items-center fluid-gap-4">
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">Género:</label>
                    <select
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                      <option value="O">Otro</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">Email:</label>
                    <select
                      value={filterHasEmail}
                      onChange={(e) => setFilterHasEmail(e.target.value as '' | 'yes' | 'no')}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="yes">Con email</option>
                      <option value="no">Sin email</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">CURP:</label>
                    <select
                      value={filterHasCurp}
                      onChange={(e) => setFilterHasCurp(e.target.value as '' | 'yes' | 'no')}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="yes">Con CURP</option>
                      <option value="no">Sin CURP</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">Elegibilidad:</label>
                    <select
                      value={filterEligibility}
                      onChange={(e) => setFilterEligibility(e.target.value)}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="CC">Elegible CC (con CURP)</option>
                      <option value="no_CC">No elegible CC (sin CURP)</option>
                      <option value="ID">Elegible ID (con email)</option>
                      <option value="no_ID">No elegible ID (sin email)</option>
                    </select>
                  </div>
                  
                  {(filterGender || filterHasEmail || filterHasCurp || filterEligibility) && (
                    <button
                      onClick={() => {
                        setFilterGender('');
                        setFilterHasEmail('');
                        setFilterHasCurp('');
                        setFilterEligibility('');
                      }}
                      className="fluid-text-sm text-purple-600 hover:text-purple-700"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
              
              {/* Panel de candidatos seleccionados */}
              {showSelectedPanel && selectedCandidates.size > 0 && !selectAllMatching && (
                <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-100">
                  <div className="bg-purple-50 border border-purple-200 rounded-fluid-lg fluid-p-4">
                    <div className="flex items-center justify-between fluid-mb-3">
                      <div className="flex items-center fluid-gap-2">
                        <UserCheck className="fluid-icon text-purple-600" />
                        <span className="font-medium text-purple-800">
                          {selectedCandidates.size} candidato(s) seleccionado(s)
                        </span>
                      </div>
                      <button
                        onClick={() => setShowSelectedPanel(false)}
                        className="fluid-p-1 hover:bg-purple-100 rounded transition-colors"
                      >
                        <X className="fluid-icon-sm text-purple-600" />
                      </button>
                    </div>
                    
                    {/* Búsqueda en seleccionados */}
                    <div className="relative fluid-mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                      <input
                        type="text"
                        value={selectedPanelSearch}
                        onChange={(e) => setSelectedPanelSearch(e.target.value)}
                        placeholder="Buscar en seleccionados..."
                        className="w-full fluid-pl-10 fluid-pr-4 fluid-py-2 border border-purple-200 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                      />
                    </div>
                    
                    {/* Lista de seleccionados */}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredSelectedCandidates.length === 0 ? (
                        <p className="fluid-text-sm text-purple-600 text-center fluid-py-2">
                          No se encontraron candidatos
                        </p>
                      ) : (
                        filteredSelectedCandidates.map((candidate) => (
                          <div
                            key={candidate.id}
                            className="flex items-center justify-between bg-white fluid-px-3 fluid-py-2 rounded-fluid-lg border border-purple-100 hover:border-purple-300 transition-colors"
                          >
                            <div className="flex items-center fluid-gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold fluid-text-xs flex-shrink-0">
                                {candidate.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 fluid-text-sm truncate">
                                  {candidate.full_name}
                                </p>
                                <p className="fluid-text-xs text-gray-500 truncate">
                                  {candidate.email}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleCandidate(candidate.id, candidate)}
                              className="fluid-p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0 fluid-ml-2"
                              title="Quitar de selección"
                            >
                              <X className="fluid-icon-sm" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Banner de selección masiva */}
            {selectAllMatching && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-fluid-lg fluid-px-6 fluid-py-3 fluid-mb-5">
                <div className="flex items-center fluid-gap-3">
                  <Zap className="fluid-icon text-emerald-600 flex-shrink-0" />
                  <p className="fluid-text-sm text-emerald-800 flex-1">
                    Se asignarán <strong>{totalResults.toLocaleString()}</strong> candidatos que coinciden con los criterios de búsqueda actuales.
                    Esta acción no se puede deshacer.
                  </p>
                  <button
                    onClick={() => setSelectAllMatching(false)}
                    className="fluid-text-sm text-emerald-700 hover:text-emerald-900 font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Tabla de resultados */}
            <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
              {searching && searchResults.length === 0 ? (
                <div className="flex items-center justify-center fluid-py-20">
                  <Loader2 className="fluid-icon-lg animate-spin text-purple-500" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center fluid-py-20 text-gray-400">
                  <Users className="w-16 h-16 text-gray-200 fluid-mb-4" />
                  <p className="fluid-text-lg font-medium text-gray-500">No se encontraron candidatos</p>
                  <p className="fluid-text-sm text-gray-400">Intenta con otros criterios de búsqueda</p>
                </div>
              ) : (
                <>
                  {/* Mensaje indicando qué está viendo */}
                  {!searchQuery && !filterGender && !filterHasEmail && !filterHasCurp && !filterEligibility && (
                    <div className="bg-purple-50 border-b border-purple-100 px-6 py-2">
                      <p className="text-sm text-purple-700 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Mostrando los <strong>candidatos más recientes</strong> que aún no pertenecen a este grupo. Usa el buscador para encontrar candidatos específicos.</span>
                      </p>
                    </div>
                  )}
                  
                  
                  {totalResults > searchResults.length && !selectAllMatching && allOnPageSelected && (
                    <div className="bg-purple-50 border-b border-purple-200 px-6 py-2">
                      <p className="text-sm text-purple-700 flex items-center gap-2">
                        Se seleccionaron los {searchResults.length} candidatos de esta página.
                        <button
                          onClick={handleSelectAllMatching}
                          className="font-semibold underline hover:text-purple-900"
                        >
                          Seleccionar los {totalResults.toLocaleString()} candidatos que coinciden
                        </button>
                      </p>
                    </div>
                  )}
                  
                  {/* Paginación arriba de la tabla */}
                  {totalResults > 0 && (
                    <div className="bg-white border-b border-gray-200 px-6 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="fluid-text-sm text-gray-600">
                          Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                          {' - '}
                          <span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
                          {' de '}
                          <span className="font-medium">{totalResults.toLocaleString()}</span> candidatos
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
                            className="w-14 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                    </div>
                  )}

                  <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="w-12 fluid-px-4 fluid-py-3 text-left">
                        <button
                          onClick={handleToggleSelectAllOnPage}
                          className="fluid-p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {allOnPageSelected || selectAllMatching ? (
                            <CheckSquare className="fluid-icon text-purple-600" />
                          ) : (
                            <Square className="fluid-icon text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th onClick={() => handleSearchSort('name')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Candidato{renderSearchSortIcon('name')}</th>
                      <th onClick={() => handleSearchSort('email')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden md:table-cell cursor-pointer hover:bg-gray-100 select-none">Email{renderSearchSortIcon('email')}</th>
                      {!isLightweight && <th onClick={() => handleSearchSort('curp')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell cursor-pointer hover:bg-gray-100 select-none">CURP{renderSearchSortIcon('curp')}</th>}
                      {!isLightweight && <th onClick={() => handleSearchSort('gender')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell cursor-pointer hover:bg-gray-100 select-none">Género{renderSearchSortIcon('gender')}</th>}
                      {!isLightweight && <th onClick={() => handleSearchSort('group')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell cursor-pointer hover:bg-gray-100 select-none">Último Grupo{renderSearchSortIcon('group')}</th>}
                      {!isLightweight && <th onClick={() => handleSearchSort('eligibility')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell cursor-pointer hover:bg-gray-100 select-none">Elegibilidad{renderSearchSortIcon('eligibility')}</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedSearchResults.map((candidate) => {
                      const isSelected = selectAllMatching || selectedCandidates.has(candidate.id);
                      return (
                        <tr
                          key={candidate.id}
                          onClick={() => handleToggleCandidate(candidate.id, candidate)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="fluid-px-4 fluid-py-3">
                            {isSelected ? (
                              <CheckSquare className="fluid-icon text-purple-600" />
                            ) : (
                              <Square className="fluid-icon text-gray-300" />
                            )}
                          </td>
                          <td className="fluid-px-4 fluid-py-3">
                            <div className="flex items-center fluid-gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold fluid-text-sm">
                                {candidate.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{candidate.full_name}</p>
                                <p className="fluid-text-xs text-gray-500 md:hidden">{candidate.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-gray-400" />
                              {candidate.email}
                            </div>
                          </td>
                          {!isLightweight && (
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell font-mono">
                            {candidate.curp || <span className="text-gray-400">-</span>}
                          </td>
                          )}
                          {!isLightweight && (
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell">
                            {candidate.gender ? (
                              <div className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-gray-400" />
                                {candidate.gender === 'M' ? 'Masculino' : candidate.gender === 'F' ? 'Femenino' : 'Otro'}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          )}
                          {!isLightweight && (
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm hidden xl:table-cell">
                            {candidate.current_group ? (
                              <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-purple-50 text-purple-700 rounded-full fluid-text-xs font-medium">
                                <Users className="h-3 w-3" />
                                {candidate.current_group.group_name}
                              </span>
                            ) : (
                              <span className="text-gray-400 fluid-text-xs italic">Sin grupo</span>
                            )}
                          </td>
                          )}
                          {!isLightweight && (
                          <td className="fluid-px-4 fluid-py-3 hidden lg:table-cell">
                            {renderEligibilityBadges(candidate.email, candidate.curp)}
                          </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </>
              )}
            </div>


          </>

      {/* ===== MODAL DE CONFIRMACIÓN DE ASIGNACIÓN ===== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}>
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                  Confirmar Asignación
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedCandidates.size} candidato(s) serán asignados al grupo <strong>"{group?.name}"</strong>
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Barra de búsqueda */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={confirmModalSearch}
                  onChange={(e) => setConfirmModalSearch(e.target.value)}
                  placeholder="Buscar en candidatos seleccionados..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-fluid-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              {confirmModalSearch && filteredConfirmCandidates.length !== selectedCandidates.size && (
                <p className="text-xs text-gray-500 mt-1.5">
                  Mostrando {filteredConfirmCandidates.length} de {selectedCandidates.size} seleccionados
                </p>
              )}
            </div>

            {/* Certificaciones activas — auto-asignar */}
            {groupExams.length > 0 && (
              <div className="px-6 pb-2 flex-shrink-0">
                <div className="bg-indigo-50 border border-indigo-200 rounded-fluid-xl p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-800">Asignar también a certificaciones</span>
                  </div>
                  <p className="text-xs text-indigo-600 mb-2.5">
                    Los nuevos candidatos se asignarán automáticamente a las certificaciones seleccionadas:
                  </p>
                  <div className="space-y-1.5">
                    {groupExams.map((ge) => {
                      const isChecked = selectedExamIds.has(ge.id);
                      const label = ge.exam?.ecm?.code
                        ? `${ge.exam.ecm.code} — ${ge.exam.name}`
                        : ge.exam?.name || `Examen #${ge.exam_id}`;
                      return (
                        <label key={ge.id} className="flex items-center gap-2.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-indigo-100/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(selectedExamIds);
                              isChecked ? next.delete(ge.id) : next.add(ge.id);
                              setSelectedExamIds(next);
                            }}
                            className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-indigo-900">{label}</span>
                          {ge.assignment_type === 'all' && (
                            <span className="text-[10px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">auto</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Lista de candidatos */}
            <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
              {selectedCandidates.size === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mb-3" />
                  <p className="text-sm font-medium">No hay candidatos seleccionados</p>
                </div>
              ) : filteredConfirmCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <Search className="w-10 h-10 mb-2" />
                  <p className="text-sm">No se encontraron candidatos con "{confirmModalSearch}"</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredConfirmCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-fluid-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {candidate.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {candidate.full_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {candidate.email}
                            {candidate.curp && <span className="ml-2 text-gray-400">• {candidate.curp}</span>}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleCandidate(candidate.id, candidate)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100"
                        title="Quitar de selección"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-fluid-2xl flex-shrink-0">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={addingMembers}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddSelectedCandidates}
                disabled={selectedCandidates.size === 0 || addingMembers}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
              >
                {addingMembers ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {addingMembers ? 'Asignando...' : `Confirmar Asignación (${selectedCandidates.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
