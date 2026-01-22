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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getUsers,
  getUserStats,
  toggleUserActive,
  getAvailableRoles,
  ManagedUser,
  UserStats,
  RoleOption,
  ROLE_LABELS,
  ROLE_COLORS,
} from '../../services/userManagementService';
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
    setPage(1);
    setSearchParams(prev => {
      prev.delete('search');
      prev.delete('role');
      prev.delete('is_active');
      // Mantener el tab actual
      return prev;
    });
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
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando usuarios..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-800 flex items-center gap-2 lg:gap-3">
            <Users className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10 text-blue-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm lg:text-base text-gray-600 mt-1">
            {currentUser?.role === 'coordinator' 
              ? 'Administra los candidatos del sistema'
              : 'Administra todos los usuarios del sistema'
            }
          </p>
        </div>
        
        <Link
          to="/user-management/new"
          className="inline-flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-5 xl:px-6 py-2 lg:py-2.5 xl:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base xl:text-lg transition-colors"
        >
          <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
          Nuevo Usuario
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 lg:p-3 bg-blue-100 rounded-lg lg:rounded-xl">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Total</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 lg:p-3 bg-green-100 rounded-lg lg:rounded-xl">
                <UserCheck className="h-5 w-5 lg:h-6 lg:w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Activos</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.active_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 lg:p-3 bg-red-100 rounded-lg lg:rounded-xl">
                <UserX className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Inactivos</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.inactive_users}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 lg:p-3 bg-purple-100 rounded-lg lg:rounded-xl">
                <BarChart3 className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs lg:text-sm text-gray-500">Verificados</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900">{stats.verified_users}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs por tipo de usuario */}
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 mb-6 lg:mb-8">
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
                className={`flex-1 flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-6 py-3 lg:py-4 text-sm lg:text-base font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-blue-600 bg-blue-50/50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                <span>{config.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
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
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6 mb-6 lg:mb-8">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, CURP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 lg:py-3 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm lg:text-base"
            />
          </div>
          
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 lg:py-3 border rounded-lg lg:rounded-xl transition-colors ${
              showFilters || roleFilter || activeFilter
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-5 w-5" />
            Filtros
          </button>
          
          <button
            type="submit"
            className="px-6 py-2.5 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg lg:rounded-xl font-medium transition-colors"
          >
            Buscar
          </button>
        </form>
        
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4">
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos los roles</option>
                {filteredRoles.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={activeFilter}
                onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
                className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
            
            {(roleFilter || activeFilter || search) && (
              <button
                onClick={clearFilters}
                className="self-end px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-gray-600">Usuario</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-gray-600">Email</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-gray-600">Rol</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-gray-600">Estado</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-gray-600">Creado</th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-right text-xs lg:text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm lg:text-base">{user.full_name}</p>
                      <p className="text-xs lg:text-sm text-gray-500">@{user.username}</p>
                    </div>
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm lg:text-base text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <span className={`inline-flex px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    {user.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs lg:text-sm">
                        <UserCheck className="h-4 w-4" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs lg:text-sm">
                        <UserX className="h-4 w-4" />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 lg:px-6 py-3 lg:py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/user-management/${user.id}`}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4 lg:h-5 lg:w-5" />
                      </Link>
                      <Link
                        to={`/user-management/${user.id}/edit`}
                        className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4 lg:h-5 lg:w-5" />
                      </Link>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleActive(user.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.is_active
                              ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={user.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Power className="h-4 w-4 lg:h-5 lg:w-5" />
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
          <div className="p-8 text-center text-gray-500">
            No se encontraron usuarios
          </div>
        )}
        
        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 lg:px-6 py-3 lg:py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando {users.length} de {total} usuarios
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="px-3 py-1 text-sm text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
