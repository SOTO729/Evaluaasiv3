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
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import BulkUploadModal from '../../components/users/BulkUploadModal';
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
  
  // Modal de carga masiva
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  
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
            
            {(roleFilter || activeFilter || search) && (
              <button
                onClick={clearFilters}
                className="self-end fluid-px-4 fluid-py-2 fluid-text-sm text-gray-600 hover:text-gray-800"
              >
                Limpiar filtros
              </button>
            )}
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
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
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
    </div>
  );
}
