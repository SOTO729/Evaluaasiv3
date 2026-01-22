/**
 * Detalle de Grupo con Gestión de Miembros
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Plus,
  Trash2,
  Users,
  Layers,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Search,
  X,
  UserPlus,
  Mail,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  searchCandidates,
  addGroupMember,
  updateGroupMember,
  removeGroupMember,
  CandidateGroup,
  GroupMember,
  CandidateSearchResult,
} from '../../services/partnersService';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search candidates modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CandidateSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
      ]);
      setGroup(groupData);
      setMembers(membersData.members);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setSearching(true);
      const results = await searchCandidates({ search: searchQuery, exclude_group_id: Number(groupId) });
      setSearchResults(results.candidates);
    } catch (err: any) {
      console.error('Error searching candidates:', err);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, groupId]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleAddMember = async (userId: string) => {
    try {
      setAddingMember(userId);
      const newMember = await addGroupMember(Number(groupId), { user_id: userId });
      setMembers([...members, newMember]);
      setSearchResults(searchResults.filter(c => c.id !== userId));
      if (group) {
        setGroup({ ...group, member_count: (group.member_count || 0) + 1 });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al agregar candidato');
    } finally {
      setAddingMember(null);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('¿Estás seguro de remover este candidato del grupo?')) return;
    
    try {
      await removeGroupMember(Number(groupId), memberId);
      setMembers(members.filter(m => m.id !== memberId));
      if (group) {
        setGroup({ ...group, member_count: Math.max(0, (group.member_count || 0) - 1) });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al remover candidato');
    }
  };

  const handleUpdateStatus = async (memberId: number, status: GroupMember['status']) => {
    try {
      await updateGroupMember(Number(groupId), memberId, { status });
      setMembers(members.map(m => 
        m.id === memberId ? { ...m, status } : m
      ));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar estado');
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <LoadingSpinner message="Cargando grupo..." />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg lg:rounded-xl p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
          <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
          <p className="text-red-700 text-sm lg:text-base">{error || 'Grupo no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline text-sm lg:text-base">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  const membersByStatus = {
    active: members.filter(m => m.status === 'active'),
    completed: members.filter(m => m.status === 'completed'),
    withdrawn: members.filter(m => m.status === 'withdrawn'),
    inactive: members.filter(m => m.status === 'inactive'),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 2xl:p-14 max-w-[1920px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="flex items-center gap-4 lg:gap-6">
          <Link
            to={`/partners/campuses/${group.campus_id}`}
            className="p-2 lg:p-3 hover:bg-gray-100 rounded-lg lg:rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5 lg:h-6 lg:w-6 xl:h-7 xl:w-7 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2 lg:gap-3 text-sm lg:text-base text-gray-500 mb-1">
              <Building2 className="h-4 w-4 lg:h-5 lg:w-5" />
              <Link to={`/partners/campuses/${group.campus_id}`} className="hover:text-blue-600 transition-colors">
                {group.campus?.name}
              </Link>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-800">
                {group.name}
              </h1>
              {group.code && (
                <span className="px-2 lg:px-3 py-0.5 lg:py-1 bg-gray-100 text-gray-600 rounded-lg text-sm lg:text-base font-mono">
                  {group.code}
                </span>
              )}
              {group.is_active ? (
                <span className="inline-flex items-center gap-1 text-xs lg:text-sm font-medium text-green-700 bg-green-50 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full">
                  <CheckCircle2 className="h-3 w-3 lg:h-4 lg:w-4" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs lg:text-sm font-medium text-gray-600 bg-gray-100 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full">
                  <XCircle className="h-3 w-3 lg:h-4 lg:w-4" />
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 lg:gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!group.is_active || members.length >= (group.max_members || 30)}
            className="inline-flex items-center gap-2 lg:gap-3 px-4 lg:px-5 py-2 lg:py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg lg:rounded-xl font-medium text-sm lg:text-base transition-colors"
          >
            <UserPlus className="h-4 w-4 lg:h-5 lg:w-5" />
            Agregar Candidato
          </button>
          <Link
            to={`/partners/groups/${groupId}/edit`}
            className="inline-flex items-center gap-2 lg:gap-3 px-4 lg:px-5 py-2 lg:py-2.5 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg lg:rounded-xl font-medium text-sm lg:text-base transition-colors"
          >
            <Edit className="h-4 w-4 lg:h-5 lg:w-5" />
            Editar
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Información del Grupo */}
        <div className="lg:col-span-1 space-y-4 lg:space-y-6">
          {/* Detalles */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5 flex items-center gap-2">
              <Layers className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
              Información
            </h2>
            
            {group.description && (
              <div className="mb-4 lg:mb-5">
                <p className="text-xs lg:text-sm text-gray-500 mb-1">Descripción</p>
                <p className="text-sm lg:text-base text-gray-900">{group.description}</p>
              </div>
            )}

            <div className="space-y-3 lg:space-y-4">
              {group.start_date && (
                <div className="flex items-center gap-2 lg:gap-3">
                  <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-gray-400" />
                  <div>
                    <p className="text-xs lg:text-sm text-gray-500">Período</p>
                    <p className="text-sm lg:text-base text-gray-900">
                      {new Date(group.start_date).toLocaleDateString('es-MX')}
                      {group.end_date && ` - ${new Date(group.end_date).toLocaleDateString('es-MX')}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800 mb-4 lg:mb-5">
              Estadísticas
            </h2>
            
            <div className="space-y-3 lg:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm lg:text-base text-gray-600">Capacidad</span>
                <span className="text-lg lg:text-xl font-semibold text-gray-900">
                  {members.length} / {group.max_members}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2.5 lg:h-3">
                <div
                  className={`h-2.5 lg:h-3 rounded-full transition-all ${
                    members.length >= (group.max_members || 30) 
                      ? 'bg-red-500' 
                      : members.length >= (group.max_members || 30) * 0.8 
                        ? 'bg-amber-500' 
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (members.length / (group.max_members || 30)) * 100)}%` }}
                />
              </div>

              <div className="pt-3 lg:pt-4 border-t border-gray-200 space-y-2 lg:space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm lg:text-base text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Activos
                  </span>
                  <span className="font-medium">{membersByStatus.active.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm lg:text-base text-blue-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Completados
                  </span>
                  <span className="font-medium">{membersByStatus.completed.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm lg:text-base text-gray-500 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Pendientes
                  </span>
                  <span className="font-medium">{membersByStatus.inactive.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm lg:text-base text-red-500 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Dados de baja
                  </span>
                  <span className="font-medium">{membersByStatus.withdrawn.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Miembros */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-800 flex items-center gap-2 lg:gap-3">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
                Candidatos ({members.length})
              </h2>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <Users className="h-12 w-12 lg:h-16 lg:w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm lg:text-base mb-4">
                  No hay candidatos en este grupo
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  disabled={!group.is_active}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white rounded-lg text-sm lg:text-base font-medium transition-colors"
                >
                  <UserPlus className="h-4 w-4 lg:h-5 lg:w-5" />
                  Agregar Candidato
                </button>
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 lg:p-4 border border-gray-200 rounded-xl hover:border-purple-200 hover:bg-purple-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3 lg:gap-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm lg:text-base">
                        {member.user?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-sm lg:text-base text-gray-900">
                          {member.user?.full_name || 'Usuario desconocido'}
                        </p>
                        {member.user?.email && (
                          <p className="text-xs lg:text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3 lg:h-4 lg:w-4" />
                            {member.user.email}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Agregado: {new Date(member.joined_at).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-3">
                      <select
                        value={member.status}
                        onChange={(e) => handleUpdateStatus(member.id, e.target.value as GroupMember['status'])}
                        className={`px-2 lg:px-3 py-1 lg:py-1.5 border rounded-lg text-xs lg:text-sm font-medium ${
                          member.status === 'active' 
                            ? 'border-green-300 bg-green-50 text-green-700' 
                            : member.status === 'completed'
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : member.status === 'withdrawn'
                                ? 'border-red-300 bg-red-50 text-red-700'
                                : 'border-gray-300 bg-gray-50 text-gray-700'
                        }`}
                      >
                        <option value="inactive">Pendiente</option>
                        <option value="active">Activo</option>
                        <option value="completed">Completado</option>
                        <option value="withdrawn">Dado de baja</option>
                      </select>
                      
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                        title="Remover del grupo"
                      >
                        <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para agregar candidatos */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header del modal */}
            <div className="flex items-center justify-between p-4 lg:p-6 border-b">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-800">
                Agregar Candidato
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Buscador */}
            <div className="p-4 lg:p-6 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o email..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Escribe al menos 2 caracteres para buscar
              </p>
            </div>

            {/* Resultados */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-3 border-amber-500 border-t-transparent rounded-full" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery.length < 2 
                    ? 'Ingresa al menos 2 caracteres para buscar' 
                    : 'No se encontraron candidatos'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-amber-300 hover:bg-amber-50/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold">
                          {candidate.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{candidate.full_name}</p>
                          <p className="text-sm text-gray-500">{candidate.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddMember(candidate.id)}
                        disabled={addingMember === candidate.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {addingMember === candidate.id ? (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Agregar
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
