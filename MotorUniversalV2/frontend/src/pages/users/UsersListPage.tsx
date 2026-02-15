/**
 * Página de listado de usuarios
 * Optimizada para escalar a 100K+ usuarios con cursor pagination
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  BarChart3,
  Upload,
  Download,
  CheckSquare,
  Square,
  UsersRound,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Shield,
  Activity,
  Building2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import BulkUploadModal from '../../components/users/BulkUploadModal';
import StyledSelect from '../../components/StyledSelect';
import DatePickerInput from '../../components/DatePickerInput';
import {
  getUsers,
  getUserStats,
  toggleUserActive,
  getAvailableRoles,
  exportSelectedUsersCredentials,
  getAvailableCampuses,
  ManagedUser,
  UserStats,
  RoleOption,
  AvailableCampus,
  ROLE_LABELS,
  ROLE_COLORS,
} from '../../services/userManagementService';
import { getGroups, addGroupMembersBulk, CandidateGroup } from '../../services/partnersService';
import { useAuthStore } from '../../store/authStore';

// Umbral para usar cursor pagination (más eficiente para grandes datasets)
const CURSOR_PAGINATION_THRESHOLD = 1000;

export default function UsersListPage() {
  const { user: currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros y paginación
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('is_active') || '');
  const [showFilters, setShowFilters] = useState(false);
  
  // Cursor pagination (para datasets grandes)
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextCursorDate, setNextCursorDate] = useState<string | null>(null);
  const [useCursorPagination, setUseCursorPagination] = useState(false);
  
  // Modal de carga masiva
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  
  // Filtros avanzados de fecha
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  
  // Selección de usuarios para exportar (persiste entre páginas)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  
  // Modal de asignar a grupo
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [campuses, setCampuses] = useState<AvailableCampus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [groups, setGroups] = useState<CandidateGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const isAdmin = currentUser?.role === 'admin';
  const isCoordinator = currentUser?.role === 'coordinator';
  const canManageUsers = isAdmin || isCoordinator;
  
  // Animación: primera carga anima todo, recargas solo la tabla
  const isFirstLoad = useRef(true);
  const [tableAnimKey, setTableAnimKey] = useState(0);
  
  // Ordenamiento
  type SortField = 'full_name' | 'email' | 'curp' | 'role' | 'is_active' | 'created_at';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Roles filtrados - mostrar todos los roles disponibles
  const filteredRoles = useMemo(() => {
    return roles;
  }, [roles]);

  // Debounce ref para búsqueda
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadData();
  }, [page, perPage, debouncedSearch, roleFilter, activeFilter, createdFrom, createdTo, sortField, sortDirection]);

  useEffect(() => {
    loadRoles();
    loadStats();
  }, []);

  const loadRoles = async () => {
    try {
      const data = await getAvailableRoles();
      setRoles(data.all_roles || data.roles);
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await getUserStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadData = async (useCursor = false, cursorId?: string, cursorDate?: string) => {
    try {
      setLoading(true);
      
      // Usar cursor pagination si hay más de CURSOR_PAGINATION_THRESHOLD usuarios
      // o si ya estamos en modo cursor
      const shouldUseCursor = useCursor || (total > CURSOR_PAGINATION_THRESHOLD && page > 1);
      
      const params: Parameters<typeof getUsers>[0] = {
        page,
        per_page: perPage,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        is_active: activeFilter || undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
        sort_by: sortField,
        sort_order: sortDirection,
      };
      
      // Agregar cursor si está disponible
      if (shouldUseCursor && cursorId && cursorDate) {
        params.cursor = cursorId;
        params.cursor_date = cursorDate;
      }
      
      const data = await getUsers(params);
      setUsers(data.users);
      setTotalPages(data.pages > 0 ? data.pages : Math.ceil(data.total / perPage));
      setTotal(data.total);
      
      // Animar tabla en recargas (no en primera carga)
      if (!isFirstLoad.current) {
        setTableAnimKey(prev => prev + 1);
      }
      isFirstLoad.current = false;
      
      // Guardar cursor para siguiente página
      if (data.has_more !== undefined) {
        setHasMore(data.has_more);
        setNextCursor(data.next_cursor || null);
        setNextCursorDate(data.next_cursor_date || null);
        setUseCursorPagination(data.total > CURSOR_PAGINATION_THRESHOLD);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };
  
  // Handler para cambiar ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1); // Volver a la primera página al cambiar ordenamiento
  };
  
  // Componente de icono de ordenamiento
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="fluid-icon-xs text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="fluid-icon-xs text-blue-600" />
      : <ChevronDown className="fluid-icon-xs text-blue-600" />;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    // loadData se disparará automáticamente por el useEffect con debouncedSearch
  };

  // Función para toggle de estado (se puede usar desde el detalle del usuario)
  const _handleToggleActive = async (userId: string) => {
    try {
      const result = await toggleUserActive(userId);
      setUsers(users.map(u => u.id === userId ? result.user : u));
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void _handleToggleActive;

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setRoleFilter('');
    setActiveFilter('');
    setCreatedFrom('');
    setCreatedTo('');
    setSelectedUsers(new Set());
    setPage(1);
    setSearchParams(prev => {
      prev.delete('search');
      prev.delete('role');
      prev.delete('is_active');
      prev.delete('created_from');
      prev.delete('created_to');
      // Mantener el tab actual
      return prev;
    });
  };
  
  // Funciones de selección de usuarios
  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };
  
  // IDs de usuarios en la página actual
  const currentPageUserIds = users.map(u => u.id);
  
  // Verificar si todos los de la página actual están seleccionados
  const allCurrentPageSelected = users.length > 0 && currentPageUserIds.every(id => selectedUsers.has(id));
  const someCurrentPageSelected = users.length > 0 && currentPageUserIds.some(id => selectedUsers.has(id)) && !allCurrentPageSelected;
  
  const toggleSelectAll = () => {
    if (allCurrentPageSelected) {
      // Deseleccionar solo los de la página actual
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        currentPageUserIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      // Agregar todos los de la página actual a la selección
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        currentPageUserIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };
  
  // Para compatibilidad con el código existente
  const isAllSelected = allCurrentPageSelected;
  const isSomeSelected = someCurrentPageSelected;
  
  // Limpiar selección
  const clearSelection = () => {
    setSelectedUsers(new Set());
  };
  
  // Exportar usuarios seleccionados
  const handleExportSelected = async () => {
    if (selectedUsers.size === 0) {
      setError('Selecciona al menos un usuario para exportar');
      return;
    }
    
    try {
      setIsExporting(true);
      await exportSelectedUsersCredentials(Array.from(selectedUsers));
    } catch (err: any) {
      setError(err.message || 'Error al exportar usuarios');
    } finally {
      setIsExporting(false);
    }
  };
  
  // ============== FUNCIONES DE ASIGNAR A GRUPO ==============
  
  // Abrir modal de asignar a grupo
  const openAssignModal = async () => {
    if (selectedUsers.size === 0) {
      setError('Selecciona al menos un usuario para asignar a un grupo');
      return;
    }
    
    // Solo candidatos pueden ser asignados a grupos
    const selectedCandidatos = users.filter(u => selectedUsers.has(u.id) && u.role === 'candidato');
    if (selectedCandidatos.length === 0) {
      setError('Solo los candidatos pueden ser asignados a grupos. Ninguno de los usuarios seleccionados es candidato.');
      return;
    }
    
    setShowAssignModal(true);
    setAssignMessage(null);
    setSelectedCampusId(null);
    setSelectedGroupId(null);
    setGroups([]);
    
    // Cargar campus disponibles
    try {
      const data = await getAvailableCampuses();
      setCampuses(data.campuses);
    } catch (err: any) {
      setError('Error al cargar los planteles disponibles');
    }
  };
  
  // Cargar grupos cuando se selecciona un campus
  const loadGroupsForCampus = async (campusId: number) => {
    setSelectedCampusId(campusId);
    setSelectedGroupId(null);
    setGroups([]);
    setIsLoadingGroups(true);
    
    try {
      const data = await getGroups(campusId, { active_only: true });
      setGroups(data.groups);
    } catch (err: any) {
      setError('Error al cargar los grupos del plantel');
    } finally {
      setIsLoadingGroups(false);
    }
  };
  
  // Asignar usuarios seleccionados al grupo
  const handleAssignToGroup = async () => {
    if (!selectedGroupId) {
      setAssignMessage({ type: 'error', text: 'Selecciona un grupo' });
      return;
    }
    
    // Filtrar solo candidatos de los seleccionados
    const candidatoIds = users
      .filter(u => selectedUsers.has(u.id) && u.role === 'candidato')
      .map(u => u.id);
    
    if (candidatoIds.length === 0) {
      setAssignMessage({ type: 'error', text: 'No hay candidatos seleccionados para asignar' });
      return;
    }
    
    setIsAssigning(true);
    setAssignMessage(null);
    
    try {
      const result = await addGroupMembersBulk(selectedGroupId, candidatoIds);
      
      const successMsg = `${result.added.length} usuario(s) agregado(s) al grupo`;
      const errorCount = result.errors.length;
      
      if (errorCount > 0) {
        // Mostrar errores comunes
        const alreadyMembers = result.errors.filter(e => e.error === 'Ya es miembro').length;
        const errorDetails = alreadyMembers > 0 
          ? ` (${alreadyMembers} ya eran miembros)` 
          : ` (${errorCount} error(es))`;
        setAssignMessage({ 
          type: result.added.length > 0 ? 'success' : 'error', 
          text: successMsg + errorDetails 
        });
      } else {
        setAssignMessage({ type: 'success', text: successMsg });
      }
      
      // Limpiar selección si todos fueron exitosos
      if (errorCount === 0) {
        setTimeout(() => {
          setShowAssignModal(false);
          setSelectedUsers(new Set());
        }, 1500);
      }
    } catch (err: any) {
      setAssignMessage({ type: 'error', text: err.message || 'Error al asignar usuarios al grupo' });
    } finally {
      setIsAssigning(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuarios..." />
      </div>
    );
  }

  return (
    <div className={`fluid-p-6 max-w-[1920px] mx-auto ${isFirstLoad.current ? 'animate-fade-in-up' : ''}`}>
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-fluid-xl fluid-p-6 fluid-mb-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
              <Users className="fluid-icon-lg" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold">
                Gestión de Usuarios
              </h1>
              <p className="fluid-text-sm text-blue-100 fluid-mt-1">
                {currentUser?.role === 'coordinator' 
                  ? 'Administra los candidatos del sistema'
                  : 'Administra todos los usuarios del sistema'
                }
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row fluid-gap-3">
            {/* Botón de carga masiva */}
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-fluid-lg font-medium fluid-text-sm transition-colors"
            >
              <Upload className="fluid-icon-sm" />
              Carga Masiva
            </button>
            
            <Link
              to="/user-management/new"
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-fluid-lg font-medium fluid-text-sm transition-colors shadow-sm"
            >
              <Plus className="fluid-icon-sm" />
              Nuevo Usuario
            </Link>
          </div>
        </div>
      </div>

      {/* Modal de carga masiva */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        onSuccess={() => {
          loadData();
          loadStats();
        }}
      />

      {/* Stats Cards mejoradas */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-fluid-xl shadow-sm">
                <Users className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Total Usuarios</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-green-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-fluid-xl shadow-sm">
                <UserCheck className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Activos</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{stats.active_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-red-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-fluid-xl shadow-sm">
                <UserX className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Inactivos</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{stats.inactive_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 hover:border-purple-300 hover:shadow-md transition-all">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-fluid-xl shadow-sm">
                <BarChart3 className="fluid-icon-sm text-white" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500 font-medium">Verificados</p>
                <p className="fluid-text-2xl font-bold text-gray-900">{stats.verified_users}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Búsqueda y Filtros */}
      <div className="bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 fluid-p-4 fluid-mb-6">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row fluid-gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, CURP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border-2 border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-base transition-all"
            />
          </div>
          
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 border rounded-fluid-lg transition-colors ${
              showFilters || roleFilter || activeFilter
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="fluid-icon-sm" />
            Filtros
          </button>
          
          <button
            type="submit"
            className="fluid-px-6 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium transition-colors"
          >
            Buscar
          </button>
        </form>
        
        {showFilters && (
          <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 fluid-gap-4">
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Rol</label>
              <StyledSelect
                value={roleFilter}
                onChange={(value) => { setRoleFilter(value); setPage(1); }}
                options={filteredRoles.map(role => ({ value: role.value, label: role.label }))}
                placeholder="Todos los roles"
                icon={Shield}
                colorScheme="indigo"
              />
            </div>
            
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Estado</label>
              <StyledSelect
                value={activeFilter}
                onChange={(value) => { setActiveFilter(value); setPage(1); }}
                options={[
                  { value: 'true', label: 'Activos' },
                  { value: 'false', label: 'Inactivos' }
                ]}
                placeholder="Todos"
                icon={Activity}
                colorScheme="green"
              />
            </div>
            
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Creación Desde
              </label>
              <DatePickerInput
                value={createdFrom ? new Date(createdFrom) : null}
                onChange={(date) => { setCreatedFrom(date ? date.toISOString().split('T')[0] : ''); setPage(1); }}
                placeholder="Desde..."
                colorScheme="blue"
                maxDate={createdTo ? new Date(createdTo) : new Date()}
              />
            </div>
            
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Creación Hasta
              </label>
              <DatePickerInput
                value={createdTo ? new Date(createdTo) : null}
                onChange={(date) => { setCreatedTo(date ? date.toISOString().split('T')[0] : ''); setPage(1); }}
                placeholder="Hasta..."
                colorScheme="blue"
                minDate={createdFrom ? new Date(createdFrom) : null}
                maxDate={new Date()}
              />
            </div>
            
            {(roleFilter || activeFilter || search || createdFrom || createdTo) && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 text-red-600 hover:bg-red-50 rounded-fluid-lg transition-colors"
                >
                  <X className="fluid-icon-sm" />
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Barra de acciones de selección - Admin y Coordinador */}
        {canManageUsers && (
          <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-3">
              <span className="fluid-text-sm text-gray-600">
                {selectedUsers.size > 0 ? (
                  <>
                    <span className="font-semibold text-blue-600">{selectedUsers.size} usuarios seleccionados</span>
                    <button
                      onClick={clearSelection}
                      className="ml-2 text-red-600 hover:text-red-800 underline fluid-text-xs"
                    >
                      (Limpiar selección)
                    </button>
                  </>
                ) : (
                  'Selecciona usuarios con los checkboxes para exportar o asignar a grupo'
                )}
              </span>
            </div>
            
            <div className="flex items-center fluid-gap-3">
              <button
                onClick={handleExportSelected}
                disabled={selectedUsers.size === 0 || isExporting}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
              >
                {isExporting ? (
                  <>
                    <div className="fluid-w-4 fluid-h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="fluid-icon-sm" />
                    Exportar Seleccionados ({selectedUsers.size})
                  </>
                )}
              </button>
              
              <button
                onClick={openAssignModal}
                disabled={selectedUsers.size === 0 || isExporting}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
                title="Asignar candidatos seleccionados a un grupo"
              >
                <UsersRound className="fluid-icon-sm" />
                Asignar a Grupo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div key={tableAnimKey} className={`bg-white rounded-fluid-xl shadow-sm border-2 border-gray-200 overflow-hidden ${tableAnimKey > 0 ? 'animate-fade-in-up' : ''}`}>
        {/* Paginación Superior */}
        {totalPages >= 1 && (
          <div className="fluid-px-4 fluid-py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-4">
              <p className="fluid-text-sm text-gray-600">
                Mostrando {users.length} de {total} usuarios
              </p>
              {selectedUsers.size > 0 && (
                <span className="fluid-text-sm font-medium text-blue-600">
                  ({selectedUsers.size} seleccionados)
                </span>
              )}
            </div>
            <div className="flex items-center fluid-gap-4">
              {/* Selector de elementos por página */}
              <div className="flex items-center fluid-gap-2">
                <span className="fluid-text-sm text-gray-600">Por página:</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="fluid-px-2 fluid-py-1 border border-gray-300 rounded-fluid fluid-text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              
              {/* Navegación de páginas */}
              <div className="flex items-center fluid-gap-2">
                <button
                  onClick={() => {
                    setPage(p => Math.max(1, p - 1));
                    // Reset cursor when going back
                    if (useCursorPagination && page > 1) {
                      loadData(false);
                    }
                  }}
                  disabled={page === 1}
                  className="fluid-p-2 rounded-fluid-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronLeft className="fluid-icon-sm" />
                </button>
                <span className="fluid-px-3 fluid-py-1 fluid-text-sm text-gray-700">
                  {page} / {totalPages > 0 ? totalPages : '...'}
                  {useCursorPagination && hasMore && <span className="text-gray-400 ml-1">+</span>}
                </span>
                <button
                  onClick={() => {
                    setPage(p => Math.min(totalPages || p + 1, p + 1));
                    // Use cursor for next page if available (more efficient)
                    if (useCursorPagination && nextCursor && nextCursorDate) {
                      loadData(true, nextCursor, nextCursorDate);
                    }
                  }}
                  disabled={!hasMore && page >= totalPages}
                  className="fluid-p-2 rounded-fluid-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronRight className="fluid-icon-sm" />
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Checkbox de selección - Admin y Coordinador */}
                {canManageUsers && (
                  <th className="fluid-px-4 fluid-py-3 text-center fluid-text-xs font-semibold text-gray-600 w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="fluid-p-1 hover:bg-gray-200 rounded transition-colors"
                      title={isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="fluid-icon-sm text-blue-600" />
                      ) : isSomeSelected ? (
                        <div className="fluid-w-4 fluid-h-4 border-2 border-blue-600 bg-blue-100 rounded" />
                      ) : (
                        <Square className="fluid-icon-sm text-gray-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('full_name')}
                    className={`flex items-center fluid-gap-1 hover:text-blue-600 transition-colors ${sortField === 'full_name' ? 'text-blue-600' : ''}`}
                  >
                    Usuario
                    <SortIcon field="full_name" />
                  </button>
                </th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('email')}
                    className={`flex items-center fluid-gap-1 hover:text-blue-600 transition-colors ${sortField === 'email' ? 'text-blue-600' : ''}`}
                  >
                    Email
                    <SortIcon field="email" />
                  </button>
                </th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('curp')}
                    className={`flex items-center fluid-gap-1 hover:text-blue-600 transition-colors ${sortField === 'curp' ? 'text-blue-600' : ''}`}
                  >
                    CURP
                    <SortIcon field="curp" />
                  </button>
                </th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('role')}
                    className={`flex items-center fluid-gap-1 hover:text-blue-600 transition-colors ${sortField === 'role' ? 'text-blue-600' : ''}`}
                  >
                    Rol
                    <SortIcon field="role" />
                  </button>
                </th>

                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('is_active')}
                    className={`flex items-center fluid-gap-1 hover:text-blue-600 transition-colors ${sortField === 'is_active' ? 'text-blue-600' : ''}`}
                  >
                    Estado
                    <SortIcon field="is_active" />
                  </button>
                </th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('created_at')}
                    className={`flex items-center fluid-gap-1 hover:text-blue-600 transition-colors ${sortField === 'created_at' ? 'text-blue-600' : ''}`}
                  >
                    Creado
                    <SortIcon field="created_at" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedUsers.has(user.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => window.location.href = `/user-management/${user.id}`}
                >
                  {/* Checkbox de selección - Admin y Coordinador */}
                  {canManageUsers && (
                    <td className="fluid-px-4 fluid-py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSelectUser(user.id)}
                        className="fluid-p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {selectedUsers.has(user.id) ? (
                          <CheckSquare className="fluid-icon-sm text-blue-600" />
                        ) : (
                          <Square className="fluid-icon-sm text-gray-400" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="fluid-px-4 fluid-py-3">
                    <div>
                      <p className="font-medium text-gray-900 fluid-text-sm">{user.full_name}</p>
                      <p className="fluid-text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </td>
                  <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="fluid-px-4 fluid-py-3 fluid-text-xs text-gray-600 font-mono">
                    {user.curp || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="fluid-px-4 fluid-py-3">
                    <span className={`inline-flex fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>

                  <td className="fluid-px-4 fluid-py-3">
                    {user.is_active ? (
                      <span className="inline-flex items-center fluid-gap-1 text-green-700 fluid-text-xs">
                        <UserCheck className="fluid-icon-sm" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center fluid-gap-1 text-red-600 fluid-text-xs">
                        <UserX className="fluid-icon-sm" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="fluid-px-4 fluid-py-3 fluid-text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && !loading && (
          <div className="fluid-p-8 text-center text-gray-500">
            No se encontraron usuarios
          </div>
        )}
      </div>
      
      {/* Modal de asignar a grupo */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4">
          <div className="bg-white rounded-fluid-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between fluid-px-6 fluid-py-4 border-b border-gray-200">
              <h3 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <UsersRound className="fluid-icon-md text-blue-600" />
                Asignar a Grupo
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="fluid-p-1 hover:bg-gray-100 rounded-fluid transition-colors"
              >
                <X className="fluid-icon-sm text-gray-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="fluid-px-6 fluid-py-4 space-y-4">
              <p className="fluid-text-sm text-gray-600">
                Seleccionaste <strong className="text-blue-600">{selectedUsers.size}</strong> usuario(s).
                Solo los candidatos serán agregados al grupo.
              </p>
              
              {/* Selector de Campus */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                  1. Selecciona un plantel
                </label>
                <StyledSelect
                  value={selectedCampusId?.toString() || ''}
                  onChange={(value) => value && loadGroupsForCampus(Number(value))}
                  options={campuses.map(campus => ({
                    value: campus.id.toString(),
                    label: `${campus.name} (${campus.partner_name})`
                  }))}
                  placeholder="-- Selecciona plantel --"
                  icon={Building2}
                  colorScheme="blue"
                />
              </div>
              
              {/* Selector de Grupo */}
              {selectedCampusId && (
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    2. Selecciona un grupo
                  </label>
                  {isLoadingGroups ? (
                    <div className="flex items-center justify-center fluid-py-4">
                      <div className="fluid-w-6 fluid-h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="fluid-ml-2 fluid-text-sm text-gray-600">Cargando grupos...</span>
                    </div>
                  ) : groups.length === 0 ? (
                    <p className="fluid-text-sm text-gray-500 fluid-py-2">
                      No hay grupos activos en este plantel
                    </p>
                  ) : (
                    <StyledSelect
                      value={selectedGroupId?.toString() || ''}
                      onChange={(value) => setSelectedGroupId(Number(value) || null)}
                      options={groups.map(group => ({
                        value: group.id.toString(),
                        label: `${group.name} ${group.school_cycle?.name ? `(${group.school_cycle.name})` : ''}`
                      }))}
                      placeholder="-- Selecciona grupo --"
                      icon={UsersRound}
                      colorScheme="indigo"
                    />
                  )}
                </div>
              )}
              
              {/* Mensaje de resultado */}
              {assignMessage && (
                <div className={`fluid-p-3 rounded-fluid-lg fluid-text-sm ${
                  assignMessage.type === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {assignMessage.text}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-end fluid-gap-3 fluid-px-6 fluid-py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAssignModal(false)}
                className="fluid-px-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignToGroup}
                disabled={!selectedGroupId || isAssigning}
                className="fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-fluid-lg fluid-text-sm font-medium transition-colors inline-flex items-center fluid-gap-2"
              >
                {isAssigning ? (
                  <>
                    <div className="fluid-w-4 fluid-h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Asignando...
                  </>
                ) : (
                  <>
                    <UsersRound className="fluid-icon-sm" />
                    Asignar al Grupo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
