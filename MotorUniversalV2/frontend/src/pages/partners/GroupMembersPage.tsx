/**
 * Página de Candidatos del Grupo
 * Muestra miembros actuales con la misma tabla del assign-candidates
 * Incluye acción de retirar del grupo con advertencia sobre asignaciones
 * Paginación y búsqueda server-side — optimizado para 100K+ registros
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  UserPlus,
  Search,
  Mail,
  Loader2,
  Download,
  ArrowUpDown,
  Filter,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  UserMinus,
  AlertTriangle,
  FileSpreadsheet,
  BookOpen,
  Shield,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembers,
  removeGroupMember,
  checkMemberAssignments,
  exportGroupMembersToExcel,
  CandidateGroup,
  GroupMember,
  MemberAssignmentCheck,
} from '../../services/partnersService';

export default function GroupMembersPage() {
  const { groupId } = useParams();
  const location = useLocation();

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState<'' | 'yes' | 'no'>('');
  const [filterHasCurp, setFilterHasCurp] = useState<'' | 'yes' | 'no'>('');
  const [filterEligibility, setFilterEligibility] = useState<string>('');

  // Paginación server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(150);
  const [pageSizeInput, setPageSizeInput] = useState('150');
  const [pageInputValue, setPageInputValue] = useState('1');
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Ordenamiento server-side
  const [sortCol, setSortCol] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Retirar miembro
  const [checkingAssignments, setCheckingAssignments] = useState(false);
  const [assignmentCheck, setAssignmentCheck] = useState<MemberAssignmentCheck | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [removing, setRemoving] = useState(false);

  // Ref para cancelar respuestas stale
  const searchRequestRef = useRef(0);

  // Carga inicial del grupo
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const groupData = await getGroup(Number(groupId));
        setGroup(groupData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar el grupo');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, location.key]);

  // Búsqueda server-side con paginación
  const handleSearch = useCallback(async (page: number = 1, perPage: number = pageSize) => {
    const requestId = ++searchRequestRef.current;
    try {
      setSearching(true);

      // Mapear elegibilidad a has_email / has_curp
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

      // Ignorar respuestas de búsquedas anteriores (race condition)
      if (requestId !== searchRequestRef.current) return;

      setMembers(results.members);
      setTotalPages(results.pages);
      setTotalResults(results.total);
      setCurrentPage(page);
    } catch (err: any) {
      if (requestId !== searchRequestRef.current) return;
      setError(err.response?.data?.error || 'Error al cargar los candidatos');
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  }, [groupId, searchQuery, searchField, pageSize, filterHasEmail, filterHasCurp, filterEligibility, sortCol, sortDir]);

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
      // handleSearch will fire via useEffect dependency change
    } else {
      setPageSizeInput(String(pageSize));
    }
  };

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

  // Iniciar retiro: verificar asignaciones antes de confirmar
  const handleInitRemove = async (member: GroupMember) => {
    setMemberToRemove(member);
    setCheckingAssignments(true);
    setAssignmentCheck(null);
    setShowRemoveModal(true);

    try {
      const check = await checkMemberAssignments(Number(groupId), member.id);
      setAssignmentCheck(check);
    } catch {
      // Si falla el check, igual permitir retirar (sin info de asignaciones)
      setAssignmentCheck({ member_id: member.id, user_id: member.user_id, has_assignments: false, exam_assignments: [], material_assignments: [], total_assignments: 0 });
    } finally {
      setCheckingAssignments(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    try {
      setRemoving(true);
      await removeGroupMember(Number(groupId), memberToRemove.id);
      setSuccessMessage(`${memberToRemove.user?.full_name || 'Candidato'} ha sido retirado del grupo`);
      setShowRemoveModal(false);
      setMemberToRemove(null);
      setAssignmentCheck(null);
      // Recargar datos server-side
      handleSearch(currentPage, pageSize);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al retirar el miembro');
    } finally {
      setRemoving(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const blob = await exportGroupMembersToExcel(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Candidatos_${group?.name?.replace(/\s+/g, '_') || 'Grupo'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al exportar');
    } finally {
      setExportingExcel(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando candidatos..." fullScreen />;
  }

  if (error && !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error}</p>
          <Link to={`/partners/groups/${groupId}`} className="ml-auto text-red-700 underline">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-px-6 fluid-py-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb
        items={[
          { label: group?.campus?.partner?.name || 'Partner', path: `/partners/${group?.campus?.partner_id}` },
          { label: group?.campus?.name || 'Plantel', path: `/partners/campuses/${group?.campus_id}` },
          { label: group?.name || 'Grupo', path: `/partners/groups/${groupId}` },
          { label: 'Candidatos' },
        ]}
      />

      {/* ===== HEADER CON GRADIENTE ===== */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white relative overflow-hidden">
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
                  <Users className="fluid-icon-lg" />
                  Candidatos del Grupo
                </h1>
              </div>
            </div>
            <div className="flex items-center fluid-gap-2">
              {members.length > 0 && (
                <button
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 text-white rounded-fluid-xl font-medium fluid-text-sm transition-colors backdrop-blur-sm disabled:opacity-50"
                >
                  {exportingExcel ? (
                    <Loader2 className="fluid-icon-sm animate-spin" />
                  ) : (
                    <Download className="fluid-icon-sm" />
                  )}
                  Exportar Excel
                </button>
              )}
              {group?.is_active && (
                <Link
                  to={`/partners/groups/${groupId}/assign-candidates`}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white hover:bg-gray-100 text-purple-600 rounded-fluid-xl font-medium fluid-text-sm transition-all shadow-lg"
                >
                  <UserPlus className="fluid-icon-sm" />
                  Agregar Candidatos
                </Link>
              )}
            </div>
          </div>

          {/* Stats en header */}
          <div className="grid grid-cols-2 fluid-gap-4 fluid-mt-5">
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{totalResults.toLocaleString()}</p>
              <p className="fluid-text-xs text-white/70">Miembros Totales</p>
            </div>
            <div className="bg-white/10 rounded-fluid-xl fluid-p-3 text-center backdrop-blur-sm">
              <p className="fluid-text-xl font-bold">{members.length}</p>
              <p className="fluid-text-xs text-white/70">En esta página</p>
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

      {/* ===== BARRA DE HERRAMIENTAS ===== */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-5">
        <div className="flex flex-wrap items-center fluid-gap-3">
          {/* Campo de búsqueda */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, email o CURP..."
              className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 fluid-text-sm"
            />
          </div>

          {/* Selector de campo */}
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className="fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Todos los campos</option>
            <option value="name">Nombre</option>
            <option value="email">Email</option>
            <option value="curp">CURP</option>
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
              title="Registros por página (máx 1000)"
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
        </div>

        {/* Filtros avanzados */}
        {showAdvancedFilters && (
          <div className="fluid-mt-3 fluid-pt-3 border-t border-gray-100 flex flex-wrap items-center fluid-gap-4">
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

            {(filterHasEmail || filterHasCurp || filterEligibility) && (
              <button
                onClick={() => {
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
      </div>

      {/* ===== TABLA DE MIEMBROS ===== */}
      {totalResults === 0 && !searching && !(searchQuery || filterHasEmail || filterHasCurp || filterEligibility) ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
            <Users className="w-10 h-10 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Aún no hay candidatos</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Agrega candidatos a este grupo para comenzar
          </p>
          {group?.is_active && (
            <Link
              to={`/partners/groups/${groupId}/assign-candidates`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Agregar Candidatos
            </Link>
          )}
        </div>
      ) : members.length === 0 && !searching ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-8">
          <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No se encontraron candidatos con estas características</p>
          <p className="text-gray-400 text-sm mt-1">Intenta ajustar los filtros o el término de búsqueda</p>
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Paginación arriba de la tabla */}
          <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="fluid-text-sm text-gray-600">
                {searching ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </span>
                ) : (
                  <>
                    Mostrando <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
                    {' - '}
                    <span className="font-medium">{Math.min(currentPage * pageSize, totalResults)}</span>
                    {' de '}
                    <span className="font-medium">{totalResults.toLocaleString()}</span> candidatos
                  </>
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

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th onClick={() => handleSort('name')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">
                    Candidato{renderSortIcon('name')}
                  </th>
                  <th onClick={() => handleSort('email')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden md:table-cell cursor-pointer hover:bg-gray-100 select-none">
                    Email{renderSortIcon('email')}
                  </th>
                  <th onClick={() => handleSort('curp')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell cursor-pointer hover:bg-gray-100 select-none">
                    CURP{renderSortIcon('curp')}
                  </th>
                  <th onClick={() => handleSort('eligibility')} className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell cursor-pointer hover:bg-gray-100 select-none">
                    Elegibilidad{renderSortIcon('eligibility')}
                  </th>
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-600 uppercase w-24">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="fluid-px-4 fluid-py-3">
                      <div className="flex items-center fluid-gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold fluid-text-sm flex-shrink-0">
                          {member.user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.user?.full_name || 'Desconocido'}</p>
                          <p className="fluid-text-xs text-gray-500 md:hidden">{member.user?.email}</p>
                        </div>
                      </div>
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
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      <button
                        onClick={() => handleInitRemove(member)}
                        disabled={removing}
                        className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 text-red-600 hover:bg-red-50 rounded-fluid-lg transition-colors fluid-text-xs font-medium disabled:opacity-50"
                        title="Retirar del grupo"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Retirar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== MODAL DE CONFIRMACIÓN PARA RETIRAR ===== */}
      {showRemoveModal && memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !removing && setShowRemoveModal(false)}>
          <div
            className="bg-white rounded-fluid-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <UserMinus className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Retirar Candidato</h2>
                  <p className="text-sm text-gray-500">{memberToRemove.user?.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => !removing && setShowRemoveModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {checkingAssignments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500 mr-3" />
                  <span className="text-gray-500">Verificando asignaciones...</span>
                </div>
              ) : assignmentCheck?.has_assignments ? (
                <>
                  {/* Advertencia de asignaciones activas */}
                  <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800 mb-1">Este candidato tiene asignaciones activas</p>
                        <p className="text-sm text-amber-700">
                          Al retirar a <strong>{memberToRemove.user?.full_name}</strong> del grupo, las asignaciones existentes
                          <strong> NO se eliminarán</strong>. Las asignaciones son <strong>inmutables e irreversibles</strong>,
                          garantizando que el candidato conserve aquello por lo que se pagó.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lista de asignaciones */}
                  <div className="space-y-2 mb-4">
                    {assignmentCheck.exam_assignments.map((ea: any) => (
                      <div key={ea.group_exam_id} className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <FileSpreadsheet className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-blue-800">{ea.exam_name}</span>
                        <span className="ml-auto text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Examen</span>
                      </div>
                    ))}
                    {assignmentCheck.material_assignments.map((ma: any) => (
                      <div key={ma.group_material_id} className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-100 rounded-lg">
                        <BookOpen className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-sm text-purple-800">{ma.material_name}</span>
                        <span className="ml-auto text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Material</span>
                      </div>
                    ))}
                  </div>

                  {/* Nota de inmutabilidad */}
                  <div className="bg-gray-50 border border-gray-200 rounded-fluid-xl p-3 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-600">
                      <strong>Política de protección:</strong> La asignación es inmutable e irreversible.
                      El candidato conservará el acceso a los exámenes y materiales asignados aunque sea retirado del grupo.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-gray-600 text-sm">
                  ¿Estás seguro de retirar a <strong>{memberToRemove.user?.full_name}</strong> del grupo <strong>"{group?.name}"</strong>?
                  Este candidato no tiene asignaciones activas en este grupo.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => !removing && setShowRemoveModal(false)}
                disabled={removing}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-fluid-xl hover:bg-gray-100 disabled:opacity-50 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={removing || checkingAssignments}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-fluid-xl font-medium text-sm transition-colors"
              >
                {removing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserMinus className="w-4 h-4" />
                )}
                {removing ? 'Retirando...' : 'Confirmar Retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
