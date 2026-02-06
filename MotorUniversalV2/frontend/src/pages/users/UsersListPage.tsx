/**
 * Página de listado de usuarios - Optimizada con tabs por tipo
 */
import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Power,
  UserCheck,
  UserX,
  BarChart3,
  Briefcase,
  GraduationCap,
  Upload,
  Download,
  Calendar,
  CheckSquare,
  Square,
  FileSpreadsheet,
  UsersRound,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import BulkUploadModal from '../../components/users/BulkUploadModal';
import {
  getUsers,
  getUserStats,
  toggleUserActive,
  getAvailableRoles,
  exportSelectedUsersCredentials,
  exportFilteredUsersCredentials,
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

// Categorías de roles para los tabs
const STAFF_ROLES = ['admin', 'editor', 'soporte', 'coordinator', 'auxiliar'];
const CANDIDATE_ROLES = ['candidato'];

type TabType = 'all' | 'staff' | 'candidates';

const TAB_CONFIG: Record<TabType, { label: string; icon: typeof Users; roles: string[] | null }> = {
  all: { label: 'Todos', icon: Users, roles: null },
  staff: { label: 'Personal', icon: Briefcase, roles: STAFF_ROLES },
  candidates: { label: 'Candidatos', icon: GraduationCap, roles: CANDIDATE_ROLES },
};

export default function UsersListPage() {
  const { user: currentUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab activo
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tabParam = searchParams.get('tab');
    return (tabParam as TabType) || 'all';
  });
  
  // Filtros y paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || '');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('is_active') || '');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal de carga masiva
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  
  // Filtros avanzados de fecha
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  
  // Selección de usuarios para exportar
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
  
  // Roles filtrados según el tab activo
  const filteredRoles = useMemo(() => {
    const tabConfig = TAB_CONFIG[activeTab];
    if (!tabConfig.roles) return roles;
    return roles.filter(r => tabConfig.roles!.includes(r.value));
  }, [roles, activeTab]);

  useEffect(() => {
    loadData();
  }, [page, roleFilter, activeFilter, activeTab]);

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

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Determinar qué roles cargar según el tab
      const tabConfig = TAB_CONFIG[activeTab];
      const rolesToFilter = roleFilter || (tabConfig.roles ? tabConfig.roles.join(',') : undefined);
      
      const data = await getUsers({
        page,
        per_page: 20,
        search: search || undefined,
        role: rolesToFilter,
        is_active: activeFilter || undefined,
      });
      setUsers(data.users);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setRoleFilter('');
    setSearchParams(prev => {
      prev.set('tab', tab);
      prev.delete('role');
      return prev;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleToggleActive = async (userId: string) => {
    try {
      const result = await toggleUserActive(userId);
      setUsers(users.map(u => u.id === userId ? result.user : u));
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const clearFilters = () => {
    setSearch('');
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
  
  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };
  
  const isAllSelected = users.length > 0 && selectedUsers.size === users.length;
  const isSomeSelected = selectedUsers.size > 0 && selectedUsers.size < users.length;
  
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
  
  // Exportar usuarios con filtros actuales
  const handleExportFiltered = async () => {
    try {
      setIsExporting(true);
      
      const tabConfig = TAB_CONFIG[activeTab];
      const rolesToFilter = roleFilter || (tabConfig.roles ? tabConfig.roles.join(',') : undefined);
      
      await exportFilteredUsersCredentials({
        search: search || undefined,
        role: rolesToFilter,
        is_active: activeFilter ? activeFilter === 'true' : undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
      });
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
  
  // Conteo de usuarios por categoría (desde stats)
  const staffCount = useMemo(() => {
    if (!stats?.users_by_role) return 0;
    return stats.users_by_role
      .filter(r => STAFF_ROLES.includes(r.role))
      .reduce((acc, r) => acc + r.count, 0);
  }, [stats]);
  
  const candidatesCount = useMemo(() => {
    if (!stats?.users_by_role) return 0;
    return stats.users_by_role
      .filter(r => CANDIDATE_ROLES.includes(r.role))
      .reduce((acc, r) => acc + r.count, 0);
  }, [stats]);

  if (loading && users.length === 0) {
    return (
      <div className="fluid-p-6 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuarios..." />
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4 fluid-mb-6">
        <div>
          <h1 className="fluid-text-2xl font-bold text-gray-800 flex items-center fluid-gap-3">
            <Users className="fluid-icon-lg text-blue-600" />
            Gestión de Usuarios
          </h1>
          <p className="fluid-text-sm text-gray-600 fluid-mt-1">
            {currentUser?.role === 'coordinator' 
              ? 'Administra los candidatos del sistema'
              : 'Administra todos los usuarios del sistema'
            }
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row fluid-gap-3">
          {/* Botón de carga masiva - solo visible en tab de candidatos o todos */}
          {(activeTab === 'candidates' || activeTab === 'all') && (
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-green-600 hover:bg-green-700 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
            >
              <Upload className="fluid-icon-sm" />
              Carga Masiva
            </button>
          )}
          
          <Link
            to="/user-management/new"
            className="inline-flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
          >
            <Plus className="fluid-icon-sm" />
            Nuevo Usuario
          </Link>
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4 fluid-mb-6">
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg">
                <Users className="fluid-icon-sm text-blue-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Total</p>
                <p className="fluid-text-xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-green-100 rounded-fluid-lg">
                <UserCheck className="fluid-icon-sm text-green-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Activos</p>
                <p className="fluid-text-xl font-bold text-gray-900">{stats.active_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-red-100 rounded-fluid-lg">
                <UserX className="fluid-icon-sm text-red-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Inactivos</p>
                <p className="fluid-text-xl font-bold text-gray-900">{stats.inactive_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4">
            <div className="flex items-center fluid-gap-3">
              <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
                <BarChart3 className="fluid-icon-sm text-purple-600" />
              </div>
              <div>
                <p className="fluid-text-xs text-gray-500">Verificados</p>
                <p className="fluid-text-xl font-bold text-gray-900">{stats.verified_users}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs por tipo de usuario */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-mb-6">
        <div className="flex border-b border-gray-200">
          {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => {
            const config = TAB_CONFIG[tab];
            const Icon = config.icon;
            const count = tab === 'all' 
              ? stats?.total_users || 0
              : tab === 'staff' 
                ? staffCount 
                : candidatesCount;
            
            // Coordinador solo ve candidatos
            if (currentUser?.role === 'coordinator' && tab === 'staff') {
              return null;
            }
            
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-3 fluid-text-sm font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-blue-600 bg-blue-50/50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className="fluid-icon-sm" />
                <span>{config.label}</span>
                <span className={`fluid-px-2 py-0.5 rounded-full fluid-text-xs font-semibold ${
                  activeTab === tab 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 fluid-p-4 fluid-mb-6">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row fluid-gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, CURP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full fluid-pl-10 fluid-pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
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
          <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-200 flex flex-wrap fluid-gap-4">
            <div className="w-full sm:w-auto">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Rol</label>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-48 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos los roles</option>
                {filteredRoles.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full sm:w-auto">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Estado</label>
              <select
                value={activeFilter}
                onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-48 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
            
            <div className="w-full sm:w-auto">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                <Calendar className="fluid-icon-xs inline fluid-mr-1" />
                Fecha Creación Desde
              </label>
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => { setCreatedFrom(e.target.value); setPage(1); }}
                className="w-full sm:w-44 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="w-full sm:w-auto">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                <Calendar className="fluid-icon-xs inline fluid-mr-1" />
                Fecha Creación Hasta
              </label>
              <input
                type="date"
                value={createdTo}
                onChange={(e) => { setCreatedTo(e.target.value); setPage(1); }}
                className="w-full sm:w-44 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {(roleFilter || activeFilter || search || createdFrom || createdTo) && (
              <button
                onClick={clearFilters}
                className="self-end fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
        
        {/* Barra de acciones de selección - Solo Admin */}
        {isAdmin && (
          <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between fluid-gap-4">
            <div className="flex items-center fluid-gap-3">
              <span className="fluid-text-sm text-gray-600">
                {selectedUsers.size > 0 ? (
                  <span className="font-semibold text-blue-600">{selectedUsers.size} usuarios seleccionados</span>
                ) : (
                  'Selecciona usuarios para exportar'
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
                onClick={handleExportFiltered}
                disabled={isExporting}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-fluid-lg font-medium fluid-text-sm transition-colors"
                title="Exporta todos los usuarios que cumplan con los filtros actuales"
              >
                <FileSpreadsheet className="fluid-icon-sm" />
                Exportar Filtrados
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
      <div className="bg-white rounded-fluid-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Checkbox de selección - Solo Admin */}
                {isAdmin && (
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
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">Usuario</th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">Email</th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">Rol</th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">Estado</th>
                <th className="fluid-px-4 fluid-py-3 text-left fluid-text-xs font-semibold text-gray-600">Creado</th>
                <th className="fluid-px-4 fluid-py-3 text-right fluid-text-xs font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${selectedUsers.has(user.id) ? 'bg-blue-50' : ''}`}>
                  {/* Checkbox de selección - Solo Admin */}
                  {isAdmin && (
                    <td className="fluid-px-4 fluid-py-3 text-center">
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
                  <td className="fluid-px-4 fluid-py-3">
                    <div className="flex items-center justify-end fluid-gap-2">
                      <Link
                        to={`/user-management/${user.id}`}
                        className="fluid-p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-fluid-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="fluid-icon-sm" />
                      </Link>
                      <Link
                        to={`/user-management/${user.id}/edit`}
                        className="fluid-p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-fluid-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="fluid-icon-sm" />
                      </Link>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleActive(user.id)}
                          className={`fluid-p-2 rounded-fluid-lg transition-colors ${
                            user.is_active
                              ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={user.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Power className="fluid-icon-sm" />
                        </button>
                      )}
                    </div>
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
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="fluid-px-4 fluid-py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="fluid-text-sm text-gray-600">
              Mostrando {users.length} de {total} usuarios
            </p>
            <div className="flex items-center fluid-gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="fluid-p-2 rounded-fluid-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="fluid-icon-sm" />
              </button>
              <span className="fluid-px-3 fluid-py-1 fluid-text-sm text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="fluid-p-2 rounded-fluid-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="fluid-icon-sm" />
              </button>
            </div>
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
                <select
                  value={selectedCampusId || ''}
                  onChange={(e) => e.target.value && loadGroupsForCampus(Number(e.target.value))}
                  className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Selecciona plantel --</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name} ({campus.partner_name})
                    </option>
                  ))}
                </select>
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
                    <select
                      value={selectedGroupId || ''}
                      onChange={(e) => setSelectedGroupId(Number(e.target.value) || null)}
                      className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Selecciona grupo --</option>
                      {groups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} {group.school_cycle?.name ? `(${group.school_cycle.name})` : ''}
                        </option>
                      ))}
                    </select>
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
