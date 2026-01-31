/**
 * Modal mejorado para asignación de candidatos a grupos
 * - Búsqueda avanzada con tabla y múltiples campos
 * - Selección múltiple de candidatos
 * - Carga masiva mediante Excel
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Mail,
  Phone,
  IdCard,
  Check,
  Loader2,
  UserPlus,
  Table,
  Filter,
} from 'lucide-react';
import {
  searchCandidates,
  addGroupMembersBulk,
  CandidateSearchResult,
  uploadGroupMembersExcel,
  downloadGroupMembersTemplate,
} from '../../services/partnersService';

interface CandidateAssignmentModalProps {
  isOpen: boolean;
  groupId: number;
  groupName: string;
  maxMembers: number;
  currentMemberCount: number;
  onClose: () => void;
  onMembersAdded: (count: number) => void;
}

type TabType = 'search' | 'bulk';

// Campos de búsqueda disponibles
const SEARCH_FIELDS = [
  { key: 'all', label: 'Todos los campos', icon: Search },
  { key: 'name', label: 'Nombre', icon: Users },
  { key: 'first_surname', label: 'Primer Apellido', icon: Users },
  { key: 'second_surname', label: 'Segundo Apellido', icon: Users },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'curp', label: 'CURP', icon: IdCard },
  { key: 'phone', label: 'Teléfono', icon: Phone },
];

export default function CandidateAssignmentModal({
  isOpen,
  groupId,
  groupName,
  maxMembers,
  currentMemberCount,
  onClose,
  onMembersAdded,
}: CandidateAssignmentModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  
  // Estado para búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [searchResults, setSearchResults] = useState<CandidateSearchResult[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  
  // Estado para carga masiva
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    added: string[];
    errors: Array<{ identifier: string; error: string }>;
    total_processed: number;
  } | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Búsqueda con debounce
  const handleSearch = useCallback(async (page: number = 1) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setTotalResults(0);
      return;
    }
    
    try {
      setSearching(true);
      const results = await searchCandidates({
        search: searchQuery,
        search_field: searchField !== 'all' ? searchField : undefined,
        exclude_group_id: groupId,
        page,
        per_page: 10,
      });
      setSearchResults(results.candidates);
      setTotalPages(results.pages);
      setTotalResults(results.total);
      setCurrentPage(page);
    } catch (err: any) {
      console.error('Error searching candidates:', err);
      setError('Error al buscar candidatos');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, searchField, groupId]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(1), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchField, handleSearch]);

  // Manejar selección de candidatos
  const handleToggleCandidate = (candidateId: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      // Verificar capacidad
      const remainingCapacity = maxMembers - currentMemberCount;
      if (newSelected.size >= remainingCapacity) {
        setError(`Capacidad máxima del grupo (${maxMembers}) alcanzada`);
        return;
      }
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
    setError(null);
  };

  const handleSelectAll = () => {
    const remainingCapacity = maxMembers - currentMemberCount;
    const newSelected = new Set(selectedCandidates);
    
    searchResults.forEach((candidate) => {
      if (newSelected.size < remainingCapacity && !newSelected.has(candidate.id)) {
        newSelected.add(candidate.id);
      }
    });
    
    setSelectedCandidates(newSelected);
  };

  const handleDeselectAll = () => {
    setSelectedCandidates(new Set());
  };

  // Agregar candidatos seleccionados
  const handleAddSelectedCandidates = async () => {
    if (selectedCandidates.size === 0) return;
    
    try {
      setAddingMembers(true);
      setError(null);
      
      const userIds = Array.from(selectedCandidates);
      const result = await addGroupMembersBulk(groupId, userIds);
      
      if (result.added.length > 0) {
        setSuccessMessage(`${result.added.length} candidato(s) agregado(s) al grupo`);
        onMembersAdded(result.added.length);
        
        // Limpiar selección y recargar búsqueda
        setSelectedCandidates(new Set());
        handleSearch(currentPage);
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

  // Manejar carga de archivo Excel
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setError(null);
      setUploadResult(null);
    } else {
      setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setError(null);
        setUploadResult(null);
      } else {
        setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
      }
    }
  };

  const handleUploadExcel = async () => {
    if (!file) return;
    
    try {
      setUploading(true);
      setError(null);
      
      const result = await uploadGroupMembersExcel(groupId, file);
      setUploadResult(result);
      
      if (result.added.length > 0) {
        setSuccessMessage(`${result.added.length} candidato(s) asignado(s) al grupo`);
        onMembersAdded(result.added.length);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadGroupMembersTemplate();
    } catch (err: any) {
      setError('Error al descargar la plantilla');
    }
  };

  const handleResetUpload = () => {
    setFile(null);
    setUploadResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCandidates(new Set());
    setFile(null);
    setUploadResult(null);
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  const remainingCapacity = maxMembers - currentMemberCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between fluid-p-5 border-b bg-gradient-to-r from-purple-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <UserPlus className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="fluid-text-lg font-bold text-gray-800">
                Asignar Candidatos
              </h2>
              <p className="fluid-text-sm text-gray-600">
                {groupName} • Capacidad: {currentMemberCount}/{maxMembers} 
                {remainingCapacity > 0 && (
                  <span className="text-green-600 ml-2">({remainingCapacity} disponibles)</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 font-medium transition-colors relative ${
              activeTab === 'search'
                ? 'text-purple-600 bg-purple-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Table className="h-4 w-4" />
            <span>Búsqueda y Selección</span>
            {selectedCandidates.size > 0 && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
                {selectedCandidates.size}
              </span>
            )}
            {activeTab === 'search' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 font-medium transition-colors relative ${
              activeTab === 'bulk'
                ? 'text-amber-600 bg-amber-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Carga Masiva (Excel)</span>
            {activeTab === 'bulk' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
            )}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {successMessage && (
          <div className="mx-5 mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Tab: Búsqueda y Selección */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* Barra de búsqueda avanzada */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar candidatos..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    className="pl-9 pr-8 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none bg-white min-w-[180px]"
                  >
                    {SEARCH_FIELDS.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Escribe al menos 2 caracteres. Puedes buscar por nombre, apellidos, email, CURP o teléfono.
              </p>

              {/* Tabla de resultados */}
              {searching ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery.length < 2 
                    ? (
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-12 w-12 text-gray-300" />
                        <p>Ingresa al menos 2 caracteres para buscar candidatos</p>
                      </div>
                    )
                    : (
                      <div className="flex flex-col items-center gap-3">
                        <Search className="h-12 w-12 text-gray-300" />
                        <p>No se encontraron candidatos con ese criterio</p>
                      </div>
                    )
                  }
                </div>
              ) : (
                <>
                  {/* Controles de selección */}
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">
                        {totalResults} resultado{totalResults !== 1 ? 's' : ''} encontrado{totalResults !== 1 ? 's' : ''}
                      </span>
                      {selectedCandidates.size > 0 && (
                        <span className="text-sm font-medium text-purple-600">
                          • {selectedCandidates.size} seleccionado{selectedCandidates.size !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-xs px-3 py-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                        disabled={remainingCapacity === 0}
                      >
                        Seleccionar todos
                      </button>
                      <button
                        onClick={handleDeselectAll}
                        className="text-xs px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={selectedCandidates.size === 0}
                      >
                        Deseleccionar
                      </button>
                    </div>
                  </div>

                  {/* Tabla */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-10 px-4 py-3"></th>
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
                          <th className="w-24 px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {searchResults.map((candidate) => {
                          const isSelected = selectedCandidates.has(candidate.id);
                          return (
                            <tr
                              key={candidate.id}
                              className={`hover:bg-gray-50 transition-colors ${
                                isSelected ? 'bg-purple-50' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleCandidate(candidate.id)}
                                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                                    {candidate.name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 text-sm">
                                      {candidate.full_name}
                                    </p>
                                    <p className="text-xs text-gray-500 md:hidden">
                                      {candidate.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                                {candidate.email}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell font-mono">
                                {candidate.curp || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 hidden xl:table-cell">
                                {candidate.phone || '-'}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleToggleCandidate(candidate.id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {isSelected ? (
                                    <span className="flex items-center gap-1">
                                      <Check className="h-3.5 w-3.5" />
                                      Seleccionado
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Plus className="h-3.5 w-3.5" />
                                      Seleccionar
                                    </span>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        onClick={() => handleSearch(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-gray-600">
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        onClick={() => handleSearch(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab: Carga Masiva */}
          {activeTab === 'bulk' && (
            <div className="space-y-6">
              {/* Paso 1: Descargar plantilla */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">1</span>
                  Descargar Plantilla
                </h3>
                <p className="text-sm text-blue-700 mb-3">
                  Descarga la plantilla Excel para asignar candidatos. Solo necesitas incluir el email o CURP de cada candidato.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Descargar Plantilla
                </button>
              </div>

              {/* Paso 2: Subir archivo */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-sm flex items-center justify-center">2</span>
                  Subir Archivo Excel
                </h3>
                
                {!uploadResult && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-amber-500 bg-amber-50'
                        : file
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <FileSpreadsheet className="h-12 w-12 text-amber-600" />
                        <div>
                          <p className="font-medium text-gray-800">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetUpload();
                          }}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="h-12 w-12 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-700">
                            Arrastra tu archivo aquí o haz clic para seleccionar
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Archivos permitidos: .xlsx, .xls
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Resultado de la carga */}
                {uploadResult && (
                  <div className="space-y-4">
                    {/* Resumen */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-semibold text-gray-800 mb-3">Resumen de la carga</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-white rounded-lg">
                          <p className="text-2xl font-bold text-gray-800">{uploadResult.total_processed}</p>
                          <p className="text-xs text-gray-600">Procesados</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{uploadResult.added.length}</p>
                          <p className="text-xs text-green-700">Asignados</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{uploadResult.errors.length}</p>
                          <p className="text-xs text-red-700">Con error</p>
                        </div>
                      </div>
                    </div>

                    {/* Errores */}
                    {uploadResult.errors.length > 0 && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Candidatos no asignados
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {uploadResult.errors.map((err, idx) => (
                            <p key={idx} className="text-sm text-red-700">
                              <span className="font-mono">{err.identifier}</span>: {err.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleResetUpload}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      ← Subir otro archivo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl font-medium transition-colors"
          >
            Cerrar
          </button>
          
          {activeTab === 'search' && selectedCandidates.size > 0 && (
            <button
              onClick={handleAddSelectedCandidates}
              disabled={addingMembers}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-xl font-medium transition-colors"
            >
              {addingMembers ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Agregar {selectedCandidates.size} candidato{selectedCandidates.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          )}
          
          {activeTab === 'bulk' && file && !uploadResult && (
            <button
              onClick={handleUploadExcel}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-xl font-medium transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Procesar Archivo
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
