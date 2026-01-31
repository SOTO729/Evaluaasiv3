/**
 * Página de Asignación de Candidatos a Grupo
 * Estructura estilo SAP: Barra de herramientas, Filtros, Tabla con selección, Acciones
 */
import { useState, useEffect, useCallback } from 'react';
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
  Phone,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  Calendar,
  Building2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  searchCandidates,
  addGroupMembersBulk,
  uploadGroupMembersExcel,
  downloadGroupMembersTemplate,
  CandidateGroup,
  CandidateSearchResult,
} from '../../services/partnersService';

// Campos de búsqueda disponibles
const SEARCH_FIELDS = [
  { key: 'all', label: 'Todos los campos' },
  { key: 'name', label: 'Nombre' },
  { key: 'first_surname', label: 'Primer Apellido' },
  { key: 'second_surname', label: 'Segundo Apellido' },
  { key: 'email', label: 'Email' },
  { key: 'curp', label: 'CURP' },
  { key: 'phone', label: 'Teléfono' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function GroupAssignCandidatesPage() {
  const { groupId } = useParams();
  
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
  
  // Estado de selección
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [selectAllOnPage, setSelectAllOnPage] = useState(false);
  
  // Estado de acciones
  const [addingMembers, setAddingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Estado de carga masiva
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    added: string[];
    errors: Array<{ identifier: string; error: string }>;
    total_processed: number;
  } | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadGroupData();
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda de candidatos
  const handleSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setTotalResults(0);
      setTotalPages(1);
      return;
    }
    
    try {
      setSearching(true);
      const results = await searchCandidates({
        search: searchQuery,
        search_field: searchField !== 'all' ? searchField : undefined,
        exclude_group_id: Number(groupId),
        page,
        per_page: perPage,
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
  }, [searchQuery, searchField, groupId, pageSize]);

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => handleSearch(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchField]);

  // Selección de candidatos
  const handleToggleCandidate = (candidateId: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      const remainingCapacity = (group?.max_members || 30) - currentMemberCount;
      if (newSelected.size >= remainingCapacity) {
        setError(`Capacidad máxima del grupo (${group?.max_members}) alcanzada`);
        return;
      }
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
    setError(null);
  };

  const handleToggleSelectAllOnPage = () => {
    const remainingCapacity = (group?.max_members || 30) - currentMemberCount;
    
    if (selectAllOnPage) {
      // Deseleccionar todos en la página
      const newSelected = new Set(selectedCandidates);
      searchResults.forEach(c => newSelected.delete(c.id));
      setSelectedCandidates(newSelected);
      setSelectAllOnPage(false);
    } else {
      // Seleccionar todos en la página (hasta la capacidad)
      const newSelected = new Set(selectedCandidates);
      for (const candidate of searchResults) {
        if (newSelected.size >= remainingCapacity) break;
        newSelected.add(candidate.id);
      }
      setSelectedCandidates(newSelected);
      setSelectAllOnPage(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
    setSelectAllOnPage(false);
  };

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

  // Carga masiva
  const handleDownloadTemplate = async () => {
    try {
      await downloadGroupMembersTemplate();
    } catch (err: any) {
      setError('Error al descargar la plantilla');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setUploadFile(file);
      setUploadResult(null);
    } else if (file) {
      setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
  };

  const handleUploadExcel = async () => {
    if (!uploadFile) return;
    
    try {
      setUploading(true);
      setError(null);
      
      const result = await uploadGroupMembersExcel(Number(groupId), uploadFile);
      setUploadResult(result);
      
      if (result.added.length > 0) {
        setSuccessMessage(`${result.added.length} candidato(s) asignado(s) al grupo`);
        setCurrentMemberCount(prev => prev + result.added.length);
        // Recargar búsqueda
        handleSearch(currentPage, pageSize);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleResetUpload = () => {
    setUploadFile(null);
    setUploadResult(null);
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

  const remainingCapacity = (group?.max_members || 30) - currentMemberCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ===== BARRA DE NAVEGACIÓN / HEADER ===== */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/partners/groups/${groupId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Asignar Candidatos
                </h1>
                <p className="text-sm text-gray-500">
                  {group?.name} • {currentMemberCount}/{group?.max_members} miembros
                  {remainingCapacity > 0 && (
                    <span className="text-green-600 ml-2">({remainingCapacity} disponibles)</span>
                  )}
                </p>
              </div>
            </div>
            
            {/* Acciones principales */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadPanel(!showUploadPanel)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showUploadPanel
                    ? 'bg-amber-100 text-amber-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Carga Masiva</span>
              </button>
              
              <button
                onClick={handleAddSelectedCandidates}
                disabled={selectedCandidates.size === 0 || addingMembers}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {addingMembers ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                <span>
                  Agregar {selectedCandidates.size > 0 ? `(${selectedCandidates.size})` : ''}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===== MENSAJES DE ESTADO ===== */}
      {(error || successMessage) && (
        <div className="px-4 py-2 bg-white border-b">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm flex-1">{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== PANEL DE CARGA MASIVA ===== */}
      {showUploadPanel && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-amber-800">Carga Masiva desde Excel</h3>
                <p className="text-sm text-amber-700">
                  Descarga la plantilla, completa con emails o CURPs, y sube el archivo.
                </p>
              </div>
              <button
                onClick={() => setShowUploadPanel(false)}
                className="p-1 hover:bg-amber-200 rounded"
              >
                <X className="h-4 w-4 text-amber-700" />
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </button>
              
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-600 file:text-white file:font-medium hover:file:bg-amber-700 file:cursor-pointer"
                />
                
                {uploadFile && !uploadResult && (
                  <button
                    onClick={handleUploadExcel}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Procesar
                  </button>
                )}
              </div>
              
              {uploadResult && (
                <div className="flex items-center gap-4 ml-auto">
                  <span className="text-sm">
                    <span className="font-medium text-green-700">{uploadResult.added.length}</span> agregados,{' '}
                    <span className="font-medium text-red-700">{uploadResult.errors.length}</span> errores
                  </span>
                  <button
                    onClick={handleResetUpload}
                    className="text-sm text-amber-700 hover:underline"
                  >
                    Subir otro archivo
                  </button>
                </div>
              )}
            </div>
            
            {uploadResult && uploadResult.errors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-sm font-medium text-red-800 mb-1">Errores:</p>
                {uploadResult.errors.map((err, idx) => (
                  <p key={idx} className="text-xs text-red-700">
                    {err.identifier}: {err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== BARRA DE HERRAMIENTAS (TOOLBAR) ===== */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Campo de búsqueda */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar candidatos (mínimo 2 caracteres)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
            />
          </div>
          
          {/* Selector de campo de búsqueda */}
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          >
            {SEARCH_FIELDS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          
          {/* Botón refrescar */}
          <button
            onClick={() => handleSearch(currentPage, pageSize)}
            disabled={searching}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 ${searching ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Separador */}
          <div className="h-6 w-px bg-gray-300" />
          
          {/* Info de selección */}
          {selectedCandidates.size > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-purple-700">
                {selectedCandidates.size} seleccionado(s)
              </span>
              <button
                onClick={handleClearSelection}
                className="text-gray-500 hover:text-gray-700"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== CONTENIDO PRINCIPAL ===== */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tabla */}
        <div className="flex-1 overflow-auto">
          {searching && searchResults.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Search className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-lg font-medium">Busca candidatos para asignar</p>
              <p className="text-sm">Ingresa al menos 2 caracteres para buscar</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Users className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-lg font-medium">No se encontraron candidatos</p>
              <p className="text-sm">Intenta con otros criterios de búsqueda</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <button
                      onClick={handleToggleSelectAllOnPage}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={selectAllOnPage ? 'Deseleccionar página' : 'Seleccionar página'}
                    >
                      {selectAllOnPage ? (
                        <CheckSquare className="h-5 w-5 text-purple-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Candidato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                    CURP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden xl:table-cell">
                    Teléfono
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden xl:table-cell">
                    Grupo Actual
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden 2xl:table-cell">
                    Registrado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchResults.map((candidate) => {
                  const isSelected = selectedCandidates.has(candidate.id);
                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => handleToggleCandidate(candidate.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-50 hover:bg-purple-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-purple-600" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {candidate.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {candidate.full_name}
                            </p>
                            <p className="text-xs text-gray-500 md:hidden truncate">
                              {candidate.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                          {candidate.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell font-mono">
                        {candidate.curp || (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden xl:table-cell">
                        {candidate.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            {candidate.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm hidden xl:table-cell">
                        {candidate.current_group ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-900 truncate text-xs font-medium">
                                {candidate.current_group.group_name}
                              </p>
                              <p className="text-gray-500 truncate text-xs">
                                {candidate.current_group.campus_name}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Sin grupo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden 2xl:table-cell">
                        {candidate.created_at ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs">
                              {new Date(candidate.created_at).toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== BARRA DE PAGINACIÓN (FOOTER) ===== */}
        {totalResults > 0 && (
          <div className="bg-white border-t border-gray-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Info de resultados */}
              <div className="text-sm text-gray-600">
                Mostrando{' '}
                <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                {' - '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalResults)}
                </span>
                {' de '}
                <span className="font-medium">{totalResults}</span> candidatos
              </div>
              
              {/* Controles de paginación */}
              <div className="flex items-center gap-4">
                {/* Selector de tamaño de página */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Navegación de páginas */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    title="Primera página"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-2" />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    title="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  <span className="px-4 py-2 text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    title="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    title="Última página"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4 -ml-2" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
