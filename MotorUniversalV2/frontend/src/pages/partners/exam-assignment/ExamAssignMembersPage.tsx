/**
 * Página 3/4: Asignación de Miembros
 * Recibe SelectMaterialsState de la página anterior
 * Para 'all' y 'selected': Navega a → /assign-exam/review con AssignMembersState
 * Para 'bulk': Proceso completo se maneja aquí (carga masiva por ECM)
 */
import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Users, UserCheck, ClipboardList,
  CheckCircle2, AlertCircle, X, Loader2, Search,
  FileSpreadsheet, Upload, Download, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown,
  Filter, RefreshCw, ChevronLeft, ChevronRight, Mail,
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup, getGroupMembers,
  downloadBulkExamAssignTemplate, bulkAssignExamsByECM,
  CandidateGroup, GroupMember, BulkExamAssignResult,
} from '../../../services/partnersService';
// balance service not needed here - cost preview is on review page
import type { SelectMaterialsState, AssignMembersState } from './types';

export default function ExamAssignMembersPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const prevState = location.state as SelectMaterialsState | undefined;

  // Scroll to top on mount
  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment type
  const [assignmentType, setAssignmentType] = useState<'all' | 'selected' | 'bulk'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Server-side search & pagination for "candidatos específicos"
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState<'' | 'yes' | 'no'>('');
  const [filterHasCurp, setFilterHasCurp] = useState<'' | 'yes' | 'no'>('');
  const [filterEligibility, setFilterEligibility] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(150);
  const [pageSizeInput, setPageSizeInput] = useState('150');
  const [pageInputValue, setPageInputValue] = useState('1');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [sortCol, setSortCol] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searching, setSearching] = useState(false);
  const searchRequestRef = useRef(0);

  // Bulk
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<BulkExamAssignResult | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Result table controls
  const [resultSearch, setResultSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<Record<string, { key: string; dir: 'asc' | 'desc' }>>({
    assigned: { key: 'row', dir: 'asc' },
    skipped: { key: 'row', dir: 'asc' },
    errors: { key: 'row', dir: 'asc' },
  });

  // Cost preview loading
  const [loadingCostPreview] = useState(false);

  // Redirect if no state
  useEffect(() => {
    if (!prevState?.selectedExam) {
      navigate(`/partners/groups/${groupId}/assign-exam`, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!prevState?.selectedExam) return;
    (async () => {
      try {
        setLoading(true);
        const groupData = await getGroup(Number(groupId));
        setGroup(groupData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  // Server-side search for members table
  const handleMemberSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    const requestId = ++searchRequestRef.current;
    try {
      setSearching(true);
      let effectiveHasEmail: string | undefined = filterHasEmail || undefined;
      let effectiveHasCurp: string | undefined = filterHasCurp || undefined;
      if (filterEligibility === 'CC') effectiveHasCurp = 'yes';
      if (filterEligibility === 'ID') effectiveHasEmail = 'yes';
      if (filterEligibility === 'no_CC') effectiveHasCurp = 'no';
      if (filterEligibility === 'no_ID') effectiveHasEmail = 'no';

      const results = await getGroupMembers(Number(groupId), {
        page,
        per_page: perPage,
        search: searchQuery || undefined,
        search_field: searchField !== 'all' ? searchField : undefined,
        has_email: effectiveHasEmail,
        has_curp: effectiveHasCurp,
        sort_by: sortCol,
        sort_dir: sortDir,
      });
      if (requestId !== searchRequestRef.current) return;
      setMembers(results.members);
      setTotalPages(results.pages);
      setTotalResults(results.total);
      setCurrentPage(page);
    } catch (err: any) {
      if (requestId !== searchRequestRef.current) return;
      setError(err.response?.data?.error || 'Error al cargar los miembros');
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  }, [groupId, searchQuery, searchField, pageSize, filterHasEmail, filterHasCurp, filterEligibility, sortCol, sortDir]);

  // Debounce search (400ms)
  useEffect(() => {
    if (!group) return;
    const timer = setTimeout(() => handleMemberSearch(1, pageSize), 400);
    return () => clearTimeout(timer);
  }, [handleMemberSearch, pageSize, group]);

  // Sync page input
  useEffect(() => { setPageInputValue(String(currentPage)); }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) handleMemberSearch(newPage, pageSize);
  };
  const handlePageInputSubmit = () => {
    const val = parseInt(pageInputValue, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) handlePageChange(val);
    else setPageInputValue(String(currentPage));
  };
  const handlePageSizeInputSubmit = () => {
    const val = parseInt(pageSizeInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 1000) { setPageSize(val); setPageSizeInput(String(val)); }
    else setPageSizeInput(String(pageSize));
  };
  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const renderSortIcon = (col: string) => {
    if (sortCol === col) return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
  };
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
          <span key={b.label} title={b.eligible ? `${b.title}: Elegible` : `${b.title}: No elegible — ${b.requirement}`}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold leading-none ${b.eligible ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-50 text-red-400 border border-red-200 line-through'}`}>{b.label}</span>
        ))}
      </div>
    );
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  // Select/deselect all members on the CURRENT page
  const currentPageUserIds = members.map(m => m.user_id);
  const allPageSelected = currentPageUserIds.length > 0 && currentPageUserIds.every(id => selectedMemberIds.includes(id));

  const handleTogglePageSelection = () => {
    if (allPageSelected) {
      setSelectedMemberIds(prev => prev.filter(id => !currentPageUserIds.includes(id)));
    } else {
      setSelectedMemberIds(prev => {
        const newSet = new Set(prev);
        currentPageUserIds.forEach(id => newSet.add(id));
        return Array.from(newSet);
      });
    }
  };

  const handleGoToReview = async () => {
    if (!prevState) return;
    if (assignmentType === 'selected' && selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }
    if (assignmentType === 'bulk') {
      if (!bulkPreview || bulkPreview.summary.assigned === 0) {
        setError('Debes subir un archivo con al menos un candidato válido');
        return;
      }
      const ecmCode = prevState.selectedExam.ecm_code || prevState.selectedExam.standard;
      const state: AssignMembersState = {
        ...prevState,
        assignmentType: 'bulk',
        bulkFile: bulkFile!,
        bulkEcmCode: ecmCode || '',
        bulkPreview,
      };
      navigate(`/partners/groups/${groupId}/assign-exam/review`, { state });
      return;
    }
    const state: AssignMembersState = {
      ...prevState,
      assignmentType: assignmentType as 'all' | 'selected',
      selectedMemberIds: assignmentType === 'selected' ? selectedMemberIds : undefined,
    };
    navigate(`/partners/groups/${groupId}/assign-exam/review`, { state });
  };

  // Bulk functions
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadBulkExamAssignTemplate(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_asignacion_examenes_${group?.name || groupId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar la plantilla');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkFile(file);
      setBulkPreview(null);
      // Previsualizar al seleccionar archivo (dry_run)
      previewFile(file);
    }
  };

  const previewFile = async (file: File) => {
    if (!prevState?.selectedExam) return;
    const ecmCode = prevState.selectedExam.ecm_code || prevState.selectedExam.standard;
    if (!ecmCode) { setError('El examen seleccionado no tiene código ECM'); return; }
    setBulkUploading(true);
    setBulkPreview(null);
    try {
      const { config } = prevState;
      const result = await bulkAssignExamsByECM(Number(groupId), file, ecmCode, {
        time_limit_minutes: config.useExamDefaultTime ? undefined : (config.timeLimitMinutes || undefined),
        passing_score: config.useExamDefaultScore ? undefined : config.passingScore,
        max_attempts: config.maxAttempts,
        max_disconnections: config.maxDisconnections,
        exam_content_type: config.examContentType,
      }, true); // dry_run = true
      setBulkPreview(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setBulkUploading(false);
    }
  };

  const handleClearFile = () => {
    setBulkFile(null);
    setBulkPreview(null);
    setResultSearch('');
  };

  const toggleSort = (table: string, key: string) => {
    setSortConfig(prev => ({
      ...prev,
      [table]: prev[table]?.key === key && prev[table]?.dir === 'asc'
        ? { key, dir: 'desc' as const }
        : { key, dir: 'asc' as const },
    }));
  };

  const sortItems = <T extends Record<string, any>>(items: T[], table: string): T[] => {
    const cfg = sortConfig[table];
    if (!cfg) return items;
    return [...items].sort((a, b) => {
      const aVal = a[cfg.key] ?? '';
      const bVal = b[cfg.key] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') return cfg.dir === 'asc' ? aVal - bVal : bVal - aVal;
      return cfg.dir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  };

  const SortIcon = ({ table, column }: { table: string; column: string }) => {
    const cfg = sortConfig[table];
    if (cfg?.key !== column) return <ArrowUpDown className="inline fluid-icon-xs ml-1 text-gray-400" />;
    return cfg.dir === 'asc' ? <ArrowUp className="inline fluid-icon-xs ml-1" /> : <ArrowDown className="inline fluid-icon-xs ml-1" />;
  };

  const filteredAssigned = useMemo(() => {
    if (!bulkPreview) return [];
    const q = resultSearch.toLowerCase();
    const filtered = q ? bulkPreview.results.assigned.filter(item =>
      (item.user_name || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.curp || '').toLowerCase().includes(q) ||
      (item.exam_name || '').toLowerCase().includes(q)
    ) : bulkPreview.results.assigned;
    return sortItems(filtered, 'assigned');
  }, [bulkPreview, resultSearch, sortConfig]);

  const filteredSkipped = useMemo(() => {
    if (!bulkPreview) return [];
    const q = resultSearch.toLowerCase();
    const filtered = q ? bulkPreview.results.skipped.filter(item =>
      (item.user_name || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q) ||
      (item.reason || '').toLowerCase().includes(q)
    ) : bulkPreview.results.skipped;
    return sortItems(filtered, 'skipped');
  }, [bulkPreview, resultSearch, sortConfig]);

  const filteredErrors = useMemo(() => {
    if (!bulkPreview) return [];
    const q = resultSearch.toLowerCase();
    const filtered = q ? bulkPreview.results.errors.filter(item =>
      (item.user_name || item.identifier || '').toLowerCase().includes(q) ||
      (item.error || '').toLowerCase().includes(q)
    ) : bulkPreview.results.errors;
    return sortItems(filtered, 'errors');
  }, [bulkPreview, resultSearch, sortConfig]);

  if (!prevState?.selectedExam) return null;
  if (loading) return <LoadingSpinner message="Cargando miembros..." fullScreen />;
  if (!group) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4"><p className="text-red-600">Grupo no encontrado</p></div></div>;

  const { selectedExam, config, selectedMaterialIds } = prevState;
  const stepLabels = ['ECM', 'Examen', 'Materiales', 'Miembros', 'Confirmar'];

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
        { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
        { label: group.name, path: `/partners/groups/${groupId}` },
        { label: 'Asignar Candidatos' },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <button onClick={() => navigate(-1)} className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"><ArrowLeft className="fluid-icon-lg" /></button>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
              <ClipboardList className="fluid-icon-sm" /><span>{group.name}</span><span>•</span><span>{selectedExam.name}</span>
            </div>
            <h1 className="fluid-text-2xl font-bold">Paso 4: Asignar Miembros</h1>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center fluid-mb-6">
        <div className="flex items-center">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
                i < 3 ? 'bg-green-500 text-white' : i === 3 ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 'bg-gray-200 text-gray-600'
              }`}>{i < 3 ? <CheckCircle2 className="fluid-icon-base" /> : i + 1}</div>
              <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${i === 3 ? 'text-blue-600' : i < 3 ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${i < 3 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 fluid-text-base flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="fluid-icon-base" /></button>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-p-5 fluid-mb-6">
        <div className="flex items-center justify-between flex-wrap fluid-gap-2">
          <div>
            <p className="fluid-text-sm text-gray-500">Examen</p>
            <p className="font-medium fluid-text-base">{selectedExam.name}</p>
          </div>
          <div className="text-center fluid-text-sm">
            <p className="text-gray-500">Materiales</p>
            <p className="font-medium text-blue-600">{selectedMaterialIds.length} seleccionados</p>
          </div>
          <div className="text-right fluid-text-sm text-gray-500">
            <p>{config.examContentType === 'questions_only' ? 'Solo preguntas' : config.examContentType === 'exercises_only' ? 'Solo ejercicios' : 'Mixto'}</p>
            <p>{config.maxAttempts} intento(s) • {config.maxDisconnections} desconexiones</p>
          </div>
        </div>
      </div>

      {/* Assignment type cards */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
        <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4">¿A quién asignar el examen?</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
          <div onClick={() => setAssignmentType('all')}
            className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${assignmentType === 'all' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center fluid-gap-3">
              <Users className={`fluid-icon-lg ${assignmentType === 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div><h4 className="font-medium text-gray-900 fluid-text-base">Todo el Grupo</h4><p className="fluid-text-sm text-gray-500">Asignar a todos los miembros ({totalResults.toLocaleString()})</p></div>
            </div>
          </div>
          <div onClick={() => setAssignmentType('selected')}
            className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${assignmentType === 'selected' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center fluid-gap-3">
              <UserCheck className={`fluid-icon-lg ${assignmentType === 'selected' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div><h4 className="font-medium text-gray-900 fluid-text-base">Candidatos Específicos</h4><p className="fluid-text-sm text-gray-500">Seleccionar manualmente</p></div>
            </div>
          </div>
          <div onClick={() => setAssignmentType('bulk')}
            className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${assignmentType === 'bulk' ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <div className="flex items-center fluid-gap-3">
              <FileSpreadsheet className={`fluid-icon-lg ${assignmentType === 'bulk' ? 'text-green-600' : 'text-gray-400'}`} />
              <div><h4 className="font-medium text-gray-900 fluid-text-base">Carga Masiva</h4><p className="fluid-text-sm text-gray-500">Asignar por código ECM</p></div>
            </div>
          </div>
        </div>

        {/* Selected members — server-side paginated table */}
        {assignmentType === 'selected' && (
          <div className="border-t pt-4">
            {/* Selection counter */}
            {selectedMemberIds.length > 0 && (
              <div className="fluid-mb-4 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-fluid-xl fluid-px-4 fluid-py-3">
                <span className="fluid-text-sm font-medium text-purple-700">
                  <UserCheck className="inline fluid-icon-sm mr-1" />
                  {selectedMemberIds.length} miembro(s) seleccionado(s)
                </span>
                <button onClick={() => setSelectedMemberIds([])} className="fluid-text-sm text-purple-600 hover:text-purple-800 font-medium">
                  Limpiar selección
                </button>
              </div>
            )}

            {/* Toolbar */}
            <div className="bg-blue-50/50 rounded-fluid-xl fluid-p-4 fluid-mb-4 border border-blue-200">
              <div className="flex flex-wrap items-center fluid-gap-3">
                <div className="flex-1 min-w-[280px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, email o CURP..."
                    className="w-full fluid-pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 fluid-text-sm" />
                </div>
                <select value={searchField} onChange={(e) => setSearchField(e.target.value)}
                  className="fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="all">Todos los campos</option>
                  <option value="name">Nombre</option>
                  <option value="first_surname">Primer Apellido</option>
                  <option value="second_surname">Segundo Apellido</option>
                  <option value="username">Usuario</option>
                  <option value="email">Email</option>
                  <option value="curp">CURP</option>
                </select>
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 border rounded-fluid-lg fluid-text-sm transition-colors ${showAdvancedFilters ? 'bg-purple-100 border-purple-300 text-purple-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  <Filter className="fluid-icon-sm" />Filtros
                </button>
                <div className="flex items-center fluid-gap-1.5">
                  <span className="fluid-text-xs text-gray-500">Mostrar</span>
                  <input type="text" inputMode="numeric" value={pageSizeInput}
                    onChange={(e) => setPageSizeInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePageSizeInputSubmit(); }}
                    onBlur={handlePageSizeInputSubmit}
                    className="w-16 text-center py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500" title="Registros por página (máx 1000)" />
                </div>
                <button onClick={() => handleMemberSearch(currentPage, pageSize)} disabled={searching}
                  className="fluid-p-2 border border-gray-300 rounded-fluid-lg hover:bg-gray-50 transition-colors" title="Refrescar">
                  <RefreshCw className={`fluid-icon-sm text-gray-600 ${searching ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Advanced filters */}
              {showAdvancedFilters && (
                <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-200 flex flex-wrap items-center fluid-gap-4">
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">Email:</label>
                    <select value={filterHasEmail} onChange={(e) => setFilterHasEmail(e.target.value as '' | 'yes' | 'no')}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm">
                      <option value="">Todos</option><option value="yes">Con email</option><option value="no">Sin email</option>
                    </select>
                  </div>
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">CURP:</label>
                    <select value={filterHasCurp} onChange={(e) => setFilterHasCurp(e.target.value as '' | 'yes' | 'no')}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm">
                      <option value="">Todos</option><option value="yes">Con CURP</option><option value="no">Sin CURP</option>
                    </select>
                  </div>
                  <div className="flex items-center fluid-gap-2">
                    <label className="fluid-text-sm text-gray-600">Elegibilidad:</label>
                    <select value={filterEligibility} onChange={(e) => setFilterEligibility(e.target.value)}
                      className="fluid-px-3 py-1.5 border border-gray-300 rounded-fluid-lg fluid-text-sm">
                      <option value="">Todos</option>
                      <option value="CC">Elegible CC (con CURP)</option>
                      <option value="no_CC">No elegible CC (sin CURP)</option>
                      <option value="ID">Elegible ID (con email)</option>
                      <option value="no_ID">No elegible ID (sin email)</option>
                    </select>
                  </div>
                  {(filterHasEmail || filterHasCurp || filterEligibility) && (
                    <button onClick={() => { setFilterHasEmail(''); setFilterHasCurp(''); setFilterEligibility(''); }}
                      className="fluid-text-sm text-purple-600 hover:text-purple-700">Limpiar filtros</button>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-fluid-xl shadow-sm border border-blue-200 overflow-hidden">
              {/* Pagination top */}
              <div className="bg-blue-50/40 border-b border-blue-200 px-6 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center fluid-gap-3">
                    <button onClick={handleTogglePageSelection}
                      className={`fluid-px-3 fluid-py-1.5 rounded-fluid-lg fluid-text-xs font-medium transition-colors ${allPageSelected ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'}`}>
                      {allPageSelected ? 'Deseleccionar página' : 'Seleccionar página'}
                    </button>
                    <div className="fluid-text-sm text-gray-600">
                      {searching ? (
                        <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Buscando...</span>
                      ) : (
                        <>Mostrando <span className="font-medium">{totalResults > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span>
                        {' - '}<span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
                        {' de '}<span className="font-medium">{totalResults.toLocaleString()}</span> miembros</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handlePageChange(1)} disabled={currentPage === 1}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600" title="Primera página">1</button>
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"><ChevronLeft className="fluid-icon-sm" /></button>
                    <input type="text" inputMode="numeric" value={pageInputValue}
                      onChange={(e) => setPageInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePageInputSubmit(); }}
                      onBlur={handlePageInputSubmit}
                      className="w-14 text-center py-1 border border-gray-300 rounded fluid-text-sm focus:ring-2 focus:ring-purple-500" />
                    <span className="fluid-text-sm text-gray-400">/ {totalPages}</span>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"><ChevronRight className="fluid-icon-sm" /></button>
                    <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}
                      className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 fluid-text-xs font-medium text-gray-600" title="Última página">{totalPages}</button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-50 sticky top-0 z-10 border-b border-blue-200">
                    <tr>
                      <th className="fluid-px-4 fluid-py-3 text-center w-12">
                        <input type="checkbox" checked={allPageSelected} onChange={handleTogglePageSelection}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                      </th>
                      <th onClick={() => handleSort('name')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-blue-700 uppercase cursor-pointer hover:bg-blue-100 select-none">
                        Miembro{renderSortIcon('name')}
                      </th>
                      <th onClick={() => handleSort('username')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-blue-700 uppercase hidden md:table-cell cursor-pointer hover:bg-blue-100 select-none">
                        Usuario{renderSortIcon('username')}
                      </th>
                      <th onClick={() => handleSort('email')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-blue-700 uppercase hidden md:table-cell cursor-pointer hover:bg-blue-100 select-none">
                        Email{renderSortIcon('email')}
                      </th>
                      <th onClick={() => handleSort('curp')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-blue-700 uppercase hidden lg:table-cell cursor-pointer hover:bg-blue-100 select-none">
                        CURP{renderSortIcon('curp')}
                      </th>
                      <th onClick={() => handleSort('eligibility')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-blue-700 uppercase hidden lg:table-cell cursor-pointer hover:bg-blue-100 select-none">
                        Elegibilidad{renderSortIcon('eligibility')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-100">
                    {members.length > 0 ? members.map((member) => {
                      const isSelected = selectedMemberIds.includes(member.user_id);
                      return (
                        <tr key={member.id} onClick={() => handleToggleMember(member.user_id)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-blue-50/50'}`}>
                          <td className="fluid-px-4 fluid-py-3 text-center">
                            <input type="checkbox" checked={isSelected} readOnly
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 pointer-events-none" />
                          </td>
                          <td className="fluid-px-4 fluid-py-3">
                            <div className="flex items-center fluid-gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold fluid-text-sm flex-shrink-0 ${isSelected ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                                {member.user?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{member.user?.full_name || 'Desconocido'}</p>
                                <p className="fluid-text-xs text-gray-500 md:hidden">{member.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden md:table-cell font-mono">
                            {member.user?.username || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5 text-gray-400" />
                              {member.user?.email || '-'}
                            </div>
                          </td>
                          <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600 hidden lg:table-cell font-mono">
                            {member.user?.curp || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="fluid-px-4 fluid-py-3 hidden lg:table-cell">
                            {renderEligibilityBadges(member.user?.email, member.user?.curp)}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={6} className="fluid-px-4 fluid-py-8 text-center text-gray-500">
                          {searching ? (
                            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Buscando...</span>
                          ) : (
                            <span>No se encontraron miembros</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedMemberIds.length > 0 && (
              <p className="mt-3 fluid-text-sm text-purple-600 font-medium">
                <UserCheck className="inline fluid-icon-sm mr-1" />
                {selectedMemberIds.length} miembro(s) seleccionado(s) en total (puede incluir selecciones de otras páginas)
              </p>
            )}
          </div>
        )}

        {/* Bulk upload */}
        {assignmentType === 'bulk' && (
          <div className="border-t pt-4">
            <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
              <h4 className="font-medium text-green-800 fluid-mb-2 flex items-center fluid-gap-2"><FileSpreadsheet className="fluid-icon-base" />Asignación Masiva por Código ECM</h4>
              <p className="fluid-text-sm text-green-700">Con esta opción puedes asignar diferentes exámenes a diferentes candidatos usando un archivo Excel. Cada candidato puede tener un código ECM distinto.</p>
            </div>

            {/* Step 1: Download template */}
            <div className="fluid-mb-4">
              <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">1. Descarga la plantilla</h5>
              <button onClick={handleDownloadTemplate} disabled={downloadingTemplate}
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white border border-green-600 text-green-600 rounded-fluid-xl hover:bg-green-50 disabled:opacity-50 transition-all fluid-text-sm">
                {downloadingTemplate ? <><Loader2 className="fluid-icon-sm animate-spin" />Descargando...</> : <><Download className="fluid-icon-sm" />Descargar Plantilla Excel</>}
              </button>
              <p className="fluid-text-xs text-gray-500 mt-1">La plantilla incluye los miembros del grupo y un catálogo de códigos ECM disponibles.</p>
            </div>

            {/* Step 2: Upload file - auto-processes on selection */}
            <div className="fluid-mb-4">
              <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">2. Completa y sube el archivo</h5>
              <div className="flex items-center fluid-gap-3">
                <label className={`flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl transition-all fluid-text-sm ${bulkUploading ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700 cursor-pointer'} text-white`}>
                  {bulkUploading ? <><Loader2 className="fluid-icon-sm animate-spin" />Procesando...</> : <><Upload className="fluid-icon-sm" />Seleccionar Archivo</>}
                  <input type="file" accept=".xlsx,.xls" onChange={handleBulkFileChange} className="hidden" disabled={bulkUploading} />
                </label>
                {bulkFile && !bulkUploading && (
                  <div className="flex items-center fluid-gap-2 bg-gray-100 rounded-fluid-lg fluid-px-3 fluid-py-1.5">
                    <FileSpreadsheet className="fluid-icon-sm text-green-600" />
                    <span className="fluid-text-sm text-gray-700">{bulkFile.name}</span>
                    <button onClick={handleClearFile} className="ml-1 text-gray-400 hover:text-red-500 transition-colors" title="Quitar archivo">
                      <X className="fluid-icon-sm" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {bulkPreview && (() => {
              const source = bulkPreview;
              return (
              <div className="mt-4 space-y-4">
                {/* Preview banner */}
                <div className="bg-blue-50 border-2 border-blue-300 rounded-fluid-xl fluid-p-4 flex items-start fluid-gap-3">
                  <AlertCircle className="fluid-icon-base text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-semibold text-blue-800 fluid-text-base">Vista Previa — Aún no se han creado asignaciones</h5>
                    <p className="fluid-text-sm text-blue-700 mt-1">Revisa el resumen a continuación. Cuando estés conforme, presiona <strong>"Revisar Costo y Confirmar"</strong> para continuar.</p>
                  </div>
                </div>

                <div className={`fluid-p-4 rounded-fluid-xl ${source.summary.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <h5 className={`font-medium fluid-mb-2 fluid-text-base ${source.summary.errors > 0 ? 'text-yellow-800' : 'text-blue-800'}`}>
                    {`Vista previa: ${source.summary.assigned} asignaciones pendientes`}
                  </h5>
                  <div className="grid grid-cols-4 fluid-gap-4 fluid-text-sm">
                    <div><p className="text-gray-500">Procesados</p><p className="font-semibold fluid-text-lg">{source.summary.total_processed}</p></div>
                    <div><p className="text-blue-600">Se asignarán</p><p className="font-semibold fluid-text-lg text-blue-700">{source.summary.assigned}</p></div>
                    <div><p className="text-yellow-600">Omitidos</p><p className="font-semibold fluid-text-lg text-yellow-700">{source.summary.skipped}</p></div>
                    <div><p className="text-red-600">Errores</p><p className="font-semibold fluid-text-lg text-red-700">{source.summary.errors}</p></div>
                  </div>
                </div>

                {/* Barra de búsqueda global para tablas */}
                {(source.results.assigned.length > 0 || source.results.skipped.length > 0 || source.results.errors.length > 0) && (
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                    <input type="text" placeholder="Buscar en resultados..." value={resultSearch} onChange={(e) => setResultSearch(e.target.value)}
                      className="w-full fluid-pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                    {resultSearch && (
                      <button onClick={() => setResultSearch('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="fluid-icon-sm" />
                      </button>
                    )}
                  </div>
                )}

                {/* Tabla de asignaciones exitosas */}
                {source.results.assigned.length > 0 && (
                  <div className="bg-white border border-green-200 rounded-fluid-xl overflow-hidden">
                    <div className="bg-green-50 fluid-px-4 fluid-py-3 border-b border-green-200 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-2">
                        <CheckCircle2 className="fluid-icon-base text-green-600" />
                        <h5 className="font-medium text-green-800 fluid-text-sm">Candidatos que se Asignarán ({filteredAssigned.length}{resultSearch ? ` de ${source.results.assigned.length}` : ''})</h5>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full fluid-text-sm min-w-[600px]">
                          <thead className="bg-green-50/50 sticky top-0 z-10">
                            <tr>
                              <th onClick={() => toggleSort('assigned', 'row')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Fila<SortIcon table="assigned" column="row" /></th>
                              <th onClick={() => toggleSort('assigned', 'user_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Nombre<SortIcon table="assigned" column="user_name" /></th>
                              <th onClick={() => toggleSort('assigned', 'email')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Email<SortIcon table="assigned" column="email" /></th>
                              <th onClick={() => toggleSort('assigned', 'curp')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">CURP<SortIcon table="assigned" column="curp" /></th>
                              <th onClick={() => toggleSort('assigned', 'exam_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Examen<SortIcon table="assigned" column="exam_name" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-100">
                            {filteredAssigned.map((item, i) => (
                              <tr key={i} className="hover:bg-green-50/30">
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono">{item.row}</td>
                                <td className="fluid-px-4 fluid-py-2 font-medium text-gray-900 whitespace-nowrap">{item.user_name || item.username || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-gray-600">{item.email || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono text-xs">{item.curp || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-green-700">{item.exam_name}</td>
                              </tr>
                            ))}
                            {filteredAssigned.length === 0 && resultSearch && (
                              <tr><td colSpan={5} className="fluid-px-4 fluid-py-3 text-center text-gray-400 fluid-text-sm">Sin coincidencias</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de omitidos */}
                {source.results.skipped.length > 0 && (
                  <div className="bg-white border border-yellow-200 rounded-fluid-xl overflow-hidden">
                    <div className="bg-yellow-50 fluid-px-4 fluid-py-3 border-b border-yellow-200 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-2">
                        <AlertCircle className="fluid-icon-base text-yellow-600" />
                        <h5 className="font-medium text-yellow-800 fluid-text-sm">Candidatos Omitidos ({filteredSkipped.length}{resultSearch ? ` de ${source.results.skipped.length}` : ''})</h5>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full fluid-text-sm min-w-[500px]">
                          <thead className="bg-yellow-50/50 sticky top-0 z-10">
                            <tr>
                              <th onClick={() => toggleSort('skipped', 'row')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Fila<SortIcon table="skipped" column="row" /></th>
                              <th onClick={() => toggleSort('skipped', 'user_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Nombre<SortIcon table="skipped" column="user_name" /></th>
                              <th onClick={() => toggleSort('skipped', 'email')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Email<SortIcon table="skipped" column="email" /></th>
                              <th onClick={() => toggleSort('skipped', 'reason')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Motivo<SortIcon table="skipped" column="reason" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-yellow-100">
                            {filteredSkipped.map((item, i) => (
                              <tr key={i} className="hover:bg-yellow-50/30">
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono">{item.row}</td>
                                <td className="fluid-px-4 fluid-py-2 font-medium text-gray-900 whitespace-nowrap">{item.user_name || item.username || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-gray-600">{item.email || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-yellow-700">{item.reason}</td>
                              </tr>
                            ))}
                            {filteredSkipped.length === 0 && resultSearch && (
                              <tr><td colSpan={4} className="fluid-px-4 fluid-py-3 text-center text-gray-400 fluid-text-sm">Sin coincidencias</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de errores */}
                {source.results.errors.length > 0 && (
                  <div className="bg-white border border-red-200 rounded-fluid-xl overflow-hidden">
                    <div className="bg-red-50 fluid-px-4 fluid-py-3 border-b border-red-200 flex items-center justify-between">
                      <div className="flex items-center fluid-gap-2">
                        <AlertCircle className="fluid-icon-base text-red-600" />
                        <h5 className="font-medium text-red-800 fluid-text-sm">Candidatos No Encontrados ({filteredErrors.length}{resultSearch ? ` de ${source.results.errors.length}` : ''})</h5>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full fluid-text-sm min-w-[400px]">
                          <thead className="bg-red-50/50 sticky top-0 z-10">
                            <tr>
                              <th onClick={() => toggleSort('errors', 'row')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Fila<SortIcon table="errors" column="row" /></th>
                              <th onClick={() => toggleSort('errors', 'user_name')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Candidato<SortIcon table="errors" column="user_name" /></th>
                              <th onClick={() => toggleSort('errors', 'error')} className="text-left fluid-px-4 fluid-py-2 text-gray-600 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">Error<SortIcon table="errors" column="error" /></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {filteredErrors.map((item, i) => (
                              <tr key={i} className="hover:bg-red-50/30">
                                <td className="fluid-px-4 fluid-py-2 text-gray-500 font-mono">{item.row}</td>
                                <td className="fluid-px-4 fluid-py-2 font-medium text-gray-900 whitespace-nowrap">{item.user_name || item.identifier || '-'}</td>
                                <td className="fluid-px-4 fluid-py-2 text-red-600">{item.error}</td>
                              </tr>
                            ))}
                            {filteredErrors.length === 0 && resultSearch && (
                              <tr><td colSpan={3} className="fluid-px-4 fluid-py-3 text-center text-gray-400 fluid-text-sm">Sin coincidencias</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botón para cambiar archivo */}
                {source.summary.assigned > 0 && (
                  <div className="flex items-center justify-center mt-4">
                    <button onClick={handleClearFile} className="fluid-px-5 fluid-py-3 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-50 fluid-text-sm font-medium transition-all">
                      Cancelar y Cambiar Archivo
                    </button>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 mt-6 border-t">
          <button onClick={() => navigate(-1)} className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors">← Volver</button>
          <button onClick={handleGoToReview} disabled={loadingCostPreview || (assignmentType === 'selected' && selectedMemberIds.length === 0) || (assignmentType === 'bulk' && (!bulkPreview || bulkPreview.summary.assigned === 0))}
            className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 fluid-text-sm font-medium shadow-lg transition-all">
            {loadingCostPreview ? <><Loader2 className="fluid-icon-sm animate-spin" />Calculando costo...</> : <><DollarSign className="fluid-icon-sm" />Revisar Costo y Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
