/**
 * Página de Asignación de Candidatos a Grupo
 * 3 modos de asignación:
 * 1. Buscar y Asignar - Con filtros avanzados
 * 2. Carga Masiva Excel - Con preview antes de procesar
 * 3. Mover desde otro Grupo - Seleccionar grupo origen y mover
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Download,
  Upload,
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
  Building2,
  Filter,
  ArrowRightLeft,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Eye,
  UserCheck,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  searchCandidatesAdvanced,
  addGroupMembersBulk,
  uploadGroupMembersExcel,
  downloadGroupMembersTemplate,
  previewGroupMembersExcel,
  moveMembersToGroup,
  listAllGroups,
  getMexicanStates,
  CandidateGroup,
  CandidateSearchResult,
  ExcelPreviewResult,
  GroupListItem,
} from '../../services/partnersService';

type TabType = 'search' | 'excel' | 'move';

// Campos de búsqueda disponibles
const SEARCH_FIELDS = [
  { key: 'all', label: 'Todos los campos' },
  { key: 'name', label: 'Nombre' },
  { key: 'first_surname', label: 'Primer Apellido' },
  { key: 'second_surname', label: 'Segundo Apellido' },
  { key: 'email', label: 'Email' },
  { key: 'curp', label: 'CURP' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function GroupAssignCandidatesPage() {
  const { groupId } = useParams();
  
  // Estado del tab activo
  const [activeTab, setActiveTab] = useState<TabType>('search');
  
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
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  
  // Filtros avanzados
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterHasGroup, setFilterHasGroup] = useState<'all' | 'yes' | 'no'>('all');
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [mexicanStates, setMexicanStates] = useState<string[]>([]);
  
  // Estado de selección
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);
  
  // Estado de acciones
  const [addingMembers, setAddingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Estado de carga masiva con preview
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<ExcelPreviewResult | null>(null);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'move' | 'add'>('add');
  
  // Ref para scroll automático al preview
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Estado para mover candidatos
  const [allGroups, setAllGroups] = useState<GroupListItem[]>([]);
  const [sourceGroupId, setSourceGroupId] = useState<number | null>(null);
  const [sourceGroupMembers, setSourceGroupMembers] = useState<CandidateSearchResult[]>([]);
  const [loadingSourceMembers, setLoadingSourceMembers] = useState(false);
  const [selectedToMove, setSelectedToMove] = useState<Set<string>>(new Set());
  const [movingMembers, setMovingMembers] = useState(false);
  
  // IDs de miembros actuales del grupo destino (para marcar en "mover")
  const [currentMemberIds, setCurrentMemberIds] = useState<Set<string>>(new Set());
  
  // Estado para panel de seleccionados
  const [showSelectedPanel, setShowSelectedPanel] = useState(false);
  const [selectedPanelSearch, setSelectedPanelSearch] = useState('');
  const [selectedCandidatesData, setSelectedCandidatesData] = useState<Map<string, CandidateSearchResult>>(new Map());

  // Cargar datos iniciales
  useEffect(() => {
    loadGroupData();
    loadMexicanStates();
    loadAllGroups();
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
      ]);
      setGroup(groupData);
      setCurrentMemberCount(membersData.members.length);
      // Guardar IDs de miembros actuales
      setCurrentMemberIds(new Set(membersData.members.map((m: any) => m.id)));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  const loadMexicanStates = async () => {
    try {
      const states = await getMexicanStates();
      setMexicanStates(states);
    } catch (err) {
      console.error('Error loading states:', err);
    }
  };

  const loadAllGroups = async () => {
    try {
      const data = await listAllGroups();
      // Excluir el grupo actual
      setAllGroups(data.groups.filter(g => g.id !== Number(groupId)));
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  };

  // Búsqueda de candidatos con filtros avanzados
  const handleSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    // Siempre hacer búsqueda - mostrar candidatos
    try {
      setSearching(true);
      
      // Si no hay término de búsqueda ni filtros avanzados, mostrar los 10 más recientes
      const isDefaultView = !searchQuery && filterHasGroup === 'all' && !filterGender && !filterState;
      
      const results = await searchCandidatesAdvanced({
        search: searchQuery.length >= 2 ? searchQuery : undefined,
        search_field: searchField !== 'all' ? searchField : undefined,
        exclude_group_id: Number(groupId),
        has_group: filterHasGroup !== 'all' ? filterHasGroup : undefined,
        gender: filterGender || undefined,
        state: filterState || undefined,
        page,
        per_page: isDefaultView ? 10 : perPage, // 10 candidatos si es vista por defecto
        sort_by: isDefaultView ? 'recent' : 'name', // Ordenar por recientes si no hay búsqueda
      });
      setSearchResults(results.candidates);
      setTotalPages(results.pages);
      setTotalResults(results.total);
      setCurrentPage(page);
      setSelectAllOnPage(false);
    } catch (err: any) {
      console.error('Error searching candidates:', err);
      setError('Error al buscar candidatos');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchField, groupId, pageSize, filterHasGroup, filterGender, filterState]);

  // Debounce de búsqueda - se ejecuta cuando cambian los filtros
  useEffect(() => {
    const timer = setTimeout(() => handleSearch(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [handleSearch, pageSize]);

  // Selección de candidatos
  const handleToggleCandidate = (candidateId: string, candidateData?: CandidateSearchResult) => {
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
    const newDataMap = new Map(selectedCandidatesData);
    
    if (selectAllOnPage) {
      // Deseleccionar todos en la página
      const newSelected = new Set(selectedCandidates);
      searchResults.forEach(c => {
        newSelected.delete(c.id);
        newDataMap.delete(c.id);
      });
      setSelectedCandidates(newSelected);
      setSelectedCandidatesData(newDataMap);
      setSelectAllOnPage(false);
    } else {
      // Seleccionar todos en la página
      const newSelected = new Set(selectedCandidates);
      for (const candidate of searchResults) {
        newSelected.add(candidate.id);
        newDataMap.set(candidate.id, candidate);
      }
      setSelectedCandidates(newSelected);
      setSelectedCandidatesData(newDataMap);
      setSelectAllOnPage(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
    setSelectedCandidatesData(new Map());
    setSelectAllOnPage(false);
    setShowSelectedPanel(false);
  };
  
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

  // Agregar candidatos seleccionados
  const handleAddSelectedCandidates = async () => {
    if (selectedCandidates.size === 0) return;
    
    try {
      setAddingMembers(true);
      setError(null);
      
      const userIds = Array.from(selectedCandidates);
      const result = await addGroupMembersBulk(Number(groupId), userIds);
      
      if (result.added.length > 0) {
        setSuccessMessage(`${result.added.length} candidato(s) agregado(s) al grupo`);
        setCurrentMemberCount(prev => prev + result.added.length);
        setSelectedCandidates(new Set());
        setSelectAllOnPage(false);
        // Recargar búsqueda para excluir los agregados
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

  // Carga masiva con preview
  const handleDownloadTemplate = async () => {
    try {
      await downloadGroupMembersTemplate();
    } catch (err: any) {
      setError('Error al descargar la plantilla');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setUploadFile(file);
      setPreviewData(null);
      
      // Auto-preview al seleccionar archivo
      try {
        setUploading(true);
        setError(null);
        const preview = await previewGroupMembersExcel(Number(groupId), file);
        setPreviewData(preview);
        
        // Scroll automático al preview
        setTimeout(() => {
          previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al procesar el archivo');
      } finally {
        setUploading(false);
      }
    } else if (file) {
      setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
    // Resetear input para permitir reseleccionar el mismo archivo
    e.target.value = '';
  };

  const handleProcessExcel = async () => {
    if (!uploadFile) return;
    
    try {
      setProcessingUpload(true);
      setError(null);
      
      const result = await uploadGroupMembersExcel(Number(groupId), uploadFile, uploadMode);
      
      const totalProcessed = result.added.length + (result.moved?.length || 0);
      if (totalProcessed > 0) {
        let message = '';
        if (result.added.length > 0) {
          message += `${result.added.length} candidato(s) agregado(s)`;
        }
        if (result.moved?.length > 0) {
          if (message) message += ', ';
          message += `${result.moved.length} candidato(s) movido(s) de otros grupos`;
        }
        setSuccessMessage(message);
        setCurrentMemberCount(prev => prev + totalProcessed);
        setUploadFile(null);
        setPreviewData(null);
      }
      
      if (result.errors.length > 0) {
        setError(`${result.errors.length} candidato(s) con errores`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setProcessingUpload(false);
    }
  };

  const handleResetUpload = () => {
    setUploadFile(null);
    setPreviewData(null);
  };

  // ===== MOVER DESDE OTRO GRUPO =====
  const handleSourceGroupChange = async (newSourceGroupId: number | null) => {
    setSourceGroupId(newSourceGroupId);
    setSelectedToMove(new Set());
    
    if (!newSourceGroupId) {
      setSourceGroupMembers([]);
      return;
    }
    
    try {
      setLoadingSourceMembers(true);
      const results = await searchCandidatesAdvanced({
        group_id: newSourceGroupId,
        per_page: 100,
      });
      setSourceGroupMembers(results.candidates);
    } catch (err: any) {
      setError('Error al cargar miembros del grupo');
    } finally {
      setLoadingSourceMembers(false);
    }
  };

  const handleToggleMoveCandidate = (candidateId: string) => {
    const newSelected = new Set(selectedToMove);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedToMove(newSelected);
    setError(null);
  };

  const handleMoveSelectedCandidates = async () => {
    if (selectedToMove.size === 0 || !sourceGroupId) return;
    
    try {
      setMovingMembers(true);
      setError(null);
      
      const userIds = Array.from(selectedToMove);
      const result = await moveMembersToGroup(sourceGroupId, Number(groupId), userIds);
      
      if (result.moved.length > 0) {
        setSuccessMessage(`${result.moved.length} candidato(s) movido(s) exitosamente`);
        setCurrentMemberCount(prev => prev + result.moved.length);
        setSelectedToMove(new Set());
        // Recargar miembros del grupo origen
        handleSourceGroupChange(sourceGroupId);
        // Actualizar lista de grupos
        loadAllGroups();
      }
      
      if (result.errors.length > 0) {
        setError(`${result.errors.length} candidato(s) no pudieron ser movidos`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al mover candidatos');
    } finally {
      setMovingMembers(false);
    }
  };

  // Paginación
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      handleSearch(newPage, pageSize);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    handleSearch(1, newSize);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-100">
      {/* ===== HEADER CON TABS ===== */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="fluid-px-4 fluid-py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center fluid-gap-4">
              <Link
                to={`/partners/groups/${groupId}`}
                className="fluid-p-2 hover:bg-gray-100 rounded-fluid-lg transition-colors"
              >
                <ArrowLeft className="fluid-icon text-gray-600" />
              </Link>
              <div>
                <h1 className="fluid-text-lg font-bold text-gray-900">
                  Asignar Candidatos
                </h1>
                <p className="fluid-text-sm text-gray-500">
                  {group?.name} • {currentMemberCount} miembros
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="fluid-px-4 border-t border-gray-100">
          <nav className="flex fluid-gap-6">
            <button
              onClick={() => setActiveTab('search')}
              className={`fluid-py-3 px-1 border-b-2 font-medium fluid-text-sm transition-colors ${
                activeTab === 'search'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center fluid-gap-2">
                <Search className="fluid-icon-sm" />
                Buscar y Asignar
              </div>
            </button>
            <button
              onClick={() => setActiveTab('move')}
              className={`fluid-py-3 px-1 border-b-2 font-medium fluid-text-sm transition-colors ${
                activeTab === 'move'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center fluid-gap-2">
                <ArrowRightLeft className="fluid-icon-sm" />
                Mover desde otro Grupo
              </div>
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              className={`fluid-py-3 px-1 border-b-2 font-medium fluid-text-sm transition-colors ${
                activeTab === 'excel'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center fluid-gap-2">
                <FileSpreadsheet className="fluid-icon-sm" />
                Carga Masiva Excel
              </div>
            </button>
          </nav>
        </div>
      </header>

      {/* ===== MENSAJES DE ESTADO ===== */}
      {(error || successMessage) && (
        <div className="fluid-px-4 fluid-py-2 bg-white border-b">
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
      <div className="flex-1 overflow-auto flex flex-col">
        
        {/* ==================== TAB 1: BUSCAR Y ASIGNAR ==================== */}
        {activeTab === 'search' && (
          <>
            {/* Barra de herramientas */}
            <div className="bg-white border-b border-gray-200 fluid-px-4 fluid-py-3">
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
                {selectedCandidates.size > 0 && (
                  <div className="flex items-center fluid-gap-2 fluid-text-sm">
                    <span className="font-medium text-purple-700">
                      {selectedCandidates.size} seleccionado(s)
                    </span>
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
                    <button
                      onClick={handleClearSelection}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
                
                {/* Botón agregar */}
                <button
                  onClick={handleAddSelectedCandidates}
                  disabled={selectedCandidates.size === 0 || addingMembers}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-lg font-medium transition-colors"
                >
                  {addingMembers ? (
                    <Loader2 className="fluid-icon-sm animate-spin" />
                  ) : (
                    <UserPlus className="fluid-icon-sm" />
                  )}
                  Agregar
                </button>
              </div>
              
              {/* Filtros avanzados */}
              {showAdvancedFilters && (
                <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-200 flex flex-wrap items-center fluid-gap-4">
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">Con grupo:</label>
                    <select
                      value={filterHasGroup}
                      onChange={(e) => setFilterHasGroup(e.target.value as 'all' | 'yes' | 'no')}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    >
                      <option value="all">Todos</option>
                      <option value="no">Sin grupo (disponibles)</option>
                      <option value="yes">Con grupo asignado</option>
                    </select>
                  </div>
                  
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
                    <label className="fluid-text-sm text-gray-600">Estado:</label>
                    <select
                      value={filterState}
                      onChange={(e) => setFilterState(e.target.value)}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    >
                      <option value="">Todos</option>
                      {mexicanStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={() => {
                      setFilterHasGroup('no');
                      setFilterGender('');
                      setFilterState('');
                    }}
                    className="fluid-text-sm text-purple-600 hover:text-purple-700"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
              
              {/* Panel de candidatos seleccionados */}
              {showSelectedPanel && selectedCandidates.size > 0 && (
                <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-200">
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
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold fluid-text-xs flex-shrink-0">
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

            {/* Tabla de resultados */}
            <div className="flex-1 overflow-auto">
              {searching && searchResults.length === 0 ? (
                <div className="flex items-center justify-center fluid-py-20">
                  <Loader2 className="fluid-icon-lg animate-spin text-purple-500" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center fluid-py-20 text-gray-500">
                  <Users className="w-16 h-16 text-gray-300 fluid-mb-4" />
                  <p className="fluid-text-lg font-medium">No se encontraron candidatos</p>
                  <p className="fluid-text-sm">Intenta con otros criterios de búsqueda</p>
                </div>
              ) : (
                <>
                  {/* Mensaje indicando qué está viendo */}
                  {!searchQuery && filterHasGroup === 'all' && !filterGender && !filterState && (
                    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
                      <p className="text-sm text-blue-700 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>Mostrando los <strong>10 candidatos más recientes</strong> que aún no pertenecen a este grupo. Usa el buscador para encontrar candidatos específicos.</span>
                      </p>
                    </div>
                  )}
                  <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="w-12 fluid-px-4 fluid-py-3 text-left">
                        <button
                          onClick={handleToggleSelectAllOnPage}
                          className="fluid-p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {selectAllOnPage ? (
                            <CheckSquare className="fluid-icon text-purple-600" />
                          ) : (
                            <Square className="fluid-icon text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase">Candidato</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Email</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">CURP</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Género</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden xl:table-cell">Grupo Actual</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {searchResults.map((candidate) => {
                      const isSelected = selectedCandidates.has(candidate.id);
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
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell font-mono">
                            {candidate.curp || <span className="text-gray-400">-</span>}
                          </td>
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
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm hidden xl:table-cell">
                            {candidate.current_group ? (
                              <div className="min-w-0 max-w-[250px]">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                                  <p className="text-gray-900 truncate fluid-text-xs font-semibold">
                                    {candidate.current_group.group_name}
                                  </p>
                                </div>
                                {candidate.current_group.partner_name && (
                                  <p className="fluid-text-xs text-gray-500 truncate pl-5">
                                    {candidate.current_group.partner_name}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 fluid-text-xs italic">Sin grupo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </>
              )}
            </div>

            {/* Paginación */}
            {totalResults > 0 && (
              <div className="bg-white border-t border-gray-200 fluid-px-4 fluid-py-3">
                <div className="flex flex-wrap items-center justify-between fluid-gap-4">
                  <div className="fluid-text-sm text-gray-600">
                    Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                    {' - '}
                    <span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
                    {' de '}
                    <span className="font-medium">{totalResults}</span> candidatos
                  </div>
                  
                  <div className="flex items-center fluid-gap-4">
                    <div className="flex items-center fluid-gap-2">
                      <span className="fluid-text-sm text-gray-600">Por página:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="fluid-px-2 py-1 border border-gray-300 rounded fluid-text-sm"
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronLeft className="fluid-icon-sm" />
                      </button>
                      <span className="fluid-px-3 fluid-text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ChevronRight className="fluid-icon-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== TAB 2: CARGA MASIVA EXCEL ==================== */}
        {activeTab === 'excel' && (
          <div className="flex-1 overflow-auto fluid-p-6">
            <div className="max-w-4xl mx-auto">
              {/* Paso 1: Descargar plantilla */}
              <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6 fluid-mb-6">
                <div className="flex items-start fluid-gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Download className="fluid-icon text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 1: Descargar Plantilla</h3>
                    <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                      Descarga la plantilla Excel, llena la columna con los emails o CURPs de los candidatos que deseas asignar.
                    </p>
                    <button
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg font-medium transition-colors"
                    >
                      <Download className="fluid-icon-sm" />
                      Descargar Plantilla
                    </button>
                  </div>
                </div>
              </div>

              {/* Paso 2: Modo de asignación */}
              <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6 fluid-mb-6">
                <div className="flex items-start fluid-gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <ArrowRightLeft className="fluid-icon text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 2: Modo de Asignación</h3>
                    <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                      Selecciona qué hacer con candidatos que ya pertenecen a otro grupo.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-3">
                      <label className={`flex items-start fluid-gap-3 fluid-p-3 rounded-fluid-lg border-2 cursor-pointer transition-colors ${
                        uploadMode === 'add' 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="uploadMode"
                          value="add"
                          checked={uploadMode === 'add'}
                          onChange={(e) => setUploadMode(e.target.value as 'add')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900 fluid-text-sm">Agregar a ambos grupos</span>
                          <p className="fluid-text-xs text-gray-600 mt-0.5">
                            Estarán en su grupo actual y en este
                          </p>
                        </div>
                      </label>
                      
                      <label className={`flex items-start fluid-gap-3 fluid-p-3 rounded-fluid-lg border-2 cursor-pointer transition-colors ${
                        uploadMode === 'move' 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="uploadMode"
                          value="move"
                          checked={uploadMode === 'move'}
                          onChange={(e) => setUploadMode(e.target.value as 'move')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900 fluid-text-sm">Mover a este grupo</span>
                          <p className="fluid-text-xs text-gray-600 mt-0.5">
                            Se quitarán de su grupo anterior
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Paso 3: Subir archivo */}
              <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6 fluid-mb-6">
                <div className="flex items-start fluid-gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Upload className="fluid-icon text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 3: Subir Archivo</h3>
                    <p className="fluid-text-sm text-gray-600 fluid-mb-4">
                      Selecciona el archivo Excel completado. La previsualización se carga automáticamente.
                    </p>
                    
                    {/* Selector de archivo */}
                    <div className="flex items-center fluid-gap-4">
                      <label className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-fluid-lg font-medium transition-colors cursor-pointer">
                        <Upload className="fluid-icon-sm" />
                        {uploadFile ? 'Cambiar archivo' : 'Seleccionar archivo'}
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      
                      {uploadFile && (
                        <div className="flex items-center fluid-gap-3">
                          <span className="fluid-text-sm text-gray-600 bg-gray-100 fluid-px-3 py-1.5 rounded-fluid-lg flex items-center fluid-gap-2">
                            <FileSpreadsheet className="fluid-icon-sm text-amber-600" />
                            {uploadFile.name}
                          </span>
                          {uploading && <Loader2 className="fluid-icon-sm animate-spin text-amber-600" />}
                          <button
                            onClick={handleResetUpload}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="fluid-icon-sm" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Paso 4: Preview y confirmar */}
              {previewData && (
                <div ref={previewRef} className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6">
                  <div className="flex items-start fluid-gap-4 fluid-mb-6">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="fluid-icon text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 fluid-mb-1">Paso 4: Confirmar Asignación</h3>
                      <p className="fluid-text-sm text-gray-600">
                        Revisa el resumen antes de confirmar. Solo se asignarán los candidatos marcados como "Listo".
                      </p>
                    </div>
                  </div>
                  
                  {/* Resumen */}
                  <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4 fluid-mb-6">
                    <div className="bg-gray-50 rounded-fluid-lg fluid-p-4 text-center">
                      <p className="fluid-text-2xl font-bold text-gray-900">{previewData.summary.total}</p>
                      <p className="fluid-text-xs text-gray-500">Total filas</p>
                    </div>
                    <div className="bg-green-50 rounded-fluid-lg fluid-p-4 text-center">
                      <p className="fluid-text-2xl font-bold text-green-600">{previewData.summary.ready}</p>
                      <p className="fluid-text-xs text-green-600">Listos</p>
                    </div>
                    <div className="bg-yellow-50 rounded-fluid-lg fluid-p-4 text-center">
                      <p className="fluid-text-2xl font-bold text-yellow-600">{previewData.summary.already_member}</p>
                      <p className="fluid-text-xs text-yellow-600">Ya miembros</p>
                    </div>
                    <div className="bg-red-50 rounded-fluid-lg fluid-p-4 text-center">
                      <p className="fluid-text-2xl font-bold text-red-600">{previewData.summary.not_found}</p>
                      <p className="fluid-text-xs text-red-600">No encontrados</p>
                    </div>
                  </div>
                  
                  {/* Lista de preview */}
                  <div className="border border-gray-200 rounded-fluid-lg overflow-hidden max-h-80 overflow-y-auto fluid-mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="fluid-px-4 fluid-py-2 text-left fluid-text-xs font-semibold text-gray-600">Estado</th>
                          <th className="fluid-px-4 fluid-py-2 text-left fluid-text-xs font-semibold text-gray-600">Identificador</th>
                          <th className="fluid-px-4 fluid-py-2 text-left fluid-text-xs font-semibold text-gray-600">Candidato</th>
                          <th className="fluid-px-4 fluid-py-2 text-left fluid-text-xs font-semibold text-gray-600">Mensaje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {previewData.preview.map((row) => (
                          <tr key={row.row} className={
                            row.status === 'ready' ? 'bg-green-50' :
                            row.status === 'already_member' ? 'bg-yellow-50' : 'bg-red-50'
                          }>
                            <td className="fluid-px-4 fluid-py-2">
                              {row.status === 'ready' && <Check className="fluid-icon-sm text-green-600" />}
                              {row.status === 'already_member' && <AlertTriangle className="fluid-icon-sm text-yellow-600" />}
                              {row.status === 'not_found' && <XCircle className="fluid-icon-sm text-red-600" />}
                            </td>
                            <td className="fluid-px-4 fluid-py-2 fluid-text-sm font-mono">{row.identifier}</td>
                            <td className="fluid-px-4 fluid-py-2 fluid-text-sm">
                              {row.user ? row.user.full_name : '-'}
                            </td>
                            <td className="fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600">
                              {row.status === 'ready' ? 'Listo para asignar' : row.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Botón de confirmación */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleResetUpload}
                      className="fluid-px-4 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    
                    <button
                      onClick={handleProcessExcel}
                      disabled={!previewData.can_proceed || processingUpload}
                      className="inline-flex items-center fluid-gap-2 fluid-px-6 fluid-py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-fluid-lg font-medium transition-colors"
                    >
                      {processingUpload ? (
                        <Loader2 className="fluid-icon-sm animate-spin" />
                      ) : (
                        <UserPlus className="fluid-icon-sm" />
                      )}
                      Asignar {previewData.summary.ready} candidato(s)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: MOVER DESDE OTRO GRUPO ==================== */}
        {activeTab === 'move' && (
          <div className="flex-1 overflow-auto flex flex-col">
            {/* Selector de grupo origen */}
            <div className="bg-white border-b border-gray-200 fluid-px-4 fluid-py-4">
              <div className="flex flex-wrap items-center fluid-gap-4">
                <label className="font-medium text-gray-700">Grupo origen:</label>
                <select
                  value={sourceGroupId || ''}
                  onChange={(e) => handleSourceGroupChange(e.target.value ? Number(e.target.value) : null)}
                  className="fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 min-w-[300px]"
                >
                  <option value="">Selecciona un grupo...</option>
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.current_members} miembros) - {g.partner_name || g.campus_name}
                    </option>
                  ))}
                </select>
                
                {selectedToMove.size > 0 && (
                  <>
                    <div className="h-6 w-px bg-gray-300" />
                    <span className="font-medium text-blue-700">
                      {selectedToMove.size} seleccionado(s)
                    </span>
                    <button
                      onClick={() => setSelectedToMove(new Set())}
                      className="fluid-text-sm text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                    
                    <button
                      onClick={handleMoveSelectedCandidates}
                      disabled={movingMembers}
                      className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-fluid-lg font-medium transition-colors ml-auto"
                    >
                      {movingMembers ? (
                        <Loader2 className="fluid-icon-sm animate-spin" />
                      ) : (
                        <ArrowRightLeft className="fluid-icon-sm" />
                      )}
                      Mover a {group?.name}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Lista de candidatos del grupo origen */}
            <div className="flex-1 overflow-auto">
              {!sourceGroupId ? (
                <div className="flex flex-col items-center justify-center fluid-py-20 text-gray-500">
                  <ArrowRightLeft className="w-16 h-16 text-gray-300 fluid-mb-4" />
                  <p className="fluid-text-lg font-medium">Selecciona un grupo origen</p>
                  <p className="fluid-text-sm">Los candidatos de ese grupo aparecerán aquí para que puedas moverlos</p>
                </div>
              ) : loadingSourceMembers ? (
                <div className="flex items-center justify-center fluid-py-20">
                  <Loader2 className="fluid-icon-lg animate-spin text-blue-500" />
                </div>
              ) : sourceGroupMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center fluid-py-20 text-gray-500">
                  <Users className="w-16 h-16 text-gray-300 fluid-mb-4" />
                  <p className="fluid-text-lg font-medium">El grupo no tiene candidatos</p>
                  <p className="fluid-text-sm">Selecciona otro grupo con miembros para mover</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="w-12 fluid-px-4 fluid-py-3 text-left">
                        <button
                          onClick={() => {
                            const availableMembers = sourceGroupMembers.filter(c => !currentMemberIds.has(c.id));
                            if (selectedToMove.size === availableMembers.length && availableMembers.length > 0) {
                              setSelectedToMove(new Set());
                            } else {
                              setSelectedToMove(new Set(availableMembers.map(c => c.id)));
                            }
                          }}
                          className="fluid-p-1 hover:bg-gray-200 rounded"
                        >
                          {(() => {
                            const availableMembers = sourceGroupMembers.filter(c => !currentMemberIds.has(c.id));
                            return selectedToMove.size === availableMembers.length && availableMembers.length > 0 ? (
                              <CheckSquare className="fluid-icon text-blue-600" />
                            ) : (
                              <Square className="fluid-icon text-gray-400" />
                            );
                          })()}
                        </button>
                      </th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase">Candidato</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Email</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">CURP</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Género</th>
                      <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sourceGroupMembers.map((candidate) => {
                      const isSelected = selectedToMove.has(candidate.id);
                      const isAlreadyMember = currentMemberIds.has(candidate.id);
                      return (
                        <tr
                          key={candidate.id}
                          onClick={() => !isAlreadyMember && handleToggleMoveCandidate(candidate.id)}
                          className={`transition-colors ${
                            isAlreadyMember 
                              ? 'bg-green-50 cursor-not-allowed opacity-70' 
                              : isSelected 
                                ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer' 
                                : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <td className="fluid-px-4 fluid-py-3">
                            {isAlreadyMember ? (
                              <CheckCircle2 className="fluid-icon text-green-600" />
                            ) : isSelected ? (
                              <CheckSquare className="fluid-icon text-blue-600" />
                            ) : (
                              <Square className="fluid-icon text-gray-300" />
                            )}
                          </td>
                          <td className="fluid-px-4 fluid-py-3">
                            <div className="flex items-center fluid-gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold fluid-text-sm ${
                                isAlreadyMember 
                                  ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                                  : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              }`}>
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
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell font-mono">
                            {candidate.curp || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell">
                            {candidate.gender ? (
                              candidate.gender === 'M' ? 'Masculino' : candidate.gender === 'F' ? 'Femenino' : 'Otro'
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="fluid-px-4 fluid-py-3">
                            {isAlreadyMember ? (
                              <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-green-100 text-green-700 rounded-full fluid-text-xs font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                Ya en grupo
                              </span>
                            ) : (
                              <span className="inline-flex items-center fluid-px-2 fluid-py-1 bg-gray-100 text-gray-600 rounded-full fluid-text-xs">
                                Disponible
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
