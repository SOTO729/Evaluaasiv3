/**
 * Página de Edición de Miembros de Asignación
 * Permite modificar los candidatos asignados a un examen o material de estudio existente
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Save,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  Square,
  Filter,
  X,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  getStudyMaterialMembers,
  updateStudyMaterialMembers,
  getExamMembers,
  updateExamMembers,
  CandidateGroup,
  GroupMember,
} from '../../services/partnersService';

type AssignmentType = 'material' | 'exam';
type SortField = 'name' | 'email' | 'curp' | 'status';
type SortDirection = 'asc' | 'desc';

export default function GroupEditAssignmentMembersPage() {
  const { groupId, assignmentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const type = (searchParams.get('type') || 'material') as AssignmentType;
  const assignmentName = searchParams.get('name') || '';

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'selected' | 'unselected'>('all');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId, assignmentId, type]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [groupData, membersData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
      ]);
      setGroup(groupData);
      setMembers(membersData.members);

      if (type === 'material') {
        const assignmentData = await getStudyMaterialMembers(
          Number(groupId),
          Number(assignmentId)
        );
        const userIds = assignmentData.assigned_user_ids || [];
        setAssignedUserIds(userIds);
        setSelectedMemberIds(userIds);
      } else {
        const assignmentData = await getExamMembers(
          Number(groupId),
          Number(assignmentId)
        );
        const userIds = assignmentData.assigned_user_ids || [];
        setAssignedUserIds(userIds);
        setSelectedMemberIds(userIds);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const processedMembers = useMemo(() => {
    let filtered = members.filter((m) => {
      // Permitir asignar múltiples exámenes al mismo candidato
      // Ya no filtramos por has_exam o has_material
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = m.user?.full_name?.toLowerCase() || '';
        const email = m.user?.email?.toLowerCase() || '';
        const curp = m.user?.curp?.toLowerCase() || '';
        if (!fullName.includes(query) && !email.includes(query) && !curp.includes(query)) {
          return false;
        }
      }
      
      if (filterStatus === 'selected' && !selectedMemberIds.includes(m.user_id)) {
        return false;
      }
      if (filterStatus === 'unselected' && selectedMemberIds.includes(m.user_id)) {
        return false;
      }
      
      return true;
    });

    filtered.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      
      if (sortField === 'name') {
        aVal = a.user?.full_name?.toLowerCase() || '';
        bVal = b.user?.full_name?.toLowerCase() || '';
      } else if (sortField === 'email') {
        aVal = a.user?.email?.toLowerCase() || '';
        bVal = b.user?.email?.toLowerCase() || '';
      } else if (sortField === 'curp') {
        aVal = a.user?.curp?.toLowerCase() || '';
        bVal = b.user?.curp?.toLowerCase() || '';
      } else if (sortField === 'status') {
        aVal = selectedMemberIds.includes(a.user_id) ? '0' : '1';
        bVal = selectedMemberIds.includes(b.user_id) ? '0' : '1';
      }
      
      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      }
      return bVal.localeCompare(aVal);
    });

    return filtered;
  }, [members, searchQuery, filterStatus, sortField, sortDirection, selectedMemberIds, assignedUserIds, type]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    const eligibleIds = processedMembers.map(m => m.user_id);
    const allSelected = eligibleIds.every(id => selectedMemberIds.includes(id));
    
    if (allSelected) {
      setSelectedMemberIds(prev => prev.filter(id => !eligibleIds.includes(id)));
    } else {
      setSelectedMemberIds(prev => [...new Set([...prev, ...eligibleIds])]);
    }
  };

  const handleSave = async () => {
    if (selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (type === 'material') {
        await updateStudyMaterialMembers(
          Number(groupId),
          Number(assignmentId),
          selectedMemberIds
        );
      } else {
        await updateExamMembers(
          Number(groupId),
          Number(assignmentId),
          'selected',
          selectedMemberIds
        );
      }

      navigate(`/partners/groups/${groupId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar los cambios');
      setSaving(false);
    }
  };

  const addedCount = selectedMemberIds.filter(id => !assignedUserIds.includes(id)).length;
  const removedCount = assignedUserIds.filter(id => !selectedMemberIds.includes(id)).length;
  const hasChanges = addedCount > 0 || removedCount > 0;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-4 h-4 text-gray-300" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-600" />
      : <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  if (loading) {
    return <LoadingSpinner message="Cargando candidatos..." fullScreen />;
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-center font-medium">Grupo no encontrado</p>
          <Link 
            to="/partners/groups" 
            className="mt-4 block text-center text-blue-600 hover:underline"
          >
            Volver a grupos
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel = type === 'material' ? 'Material de Estudio' : 'Examen';
  const TypeIcon = type === 'material' ? BookOpen : ClipboardList;
  const allVisibleSelected = processedMembers.length > 0 && 
    processedMembers.every(m => selectedMemberIds.includes(m.user_id));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to={`/partners/groups/${groupId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${type === 'material' ? 'bg-green-100' : 'bg-blue-100'}`}>
                  <TypeIcon className={`w-6 h-6 ${type === 'material' ? 'text-green-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Editar Candidatos</h1>
                  <p className="text-sm text-gray-500">
                    {typeLabel}: <span className="font-medium text-gray-700">{assignmentName || `#${assignmentId}`}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasChanges && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  <span className="text-sm text-amber-700 font-medium">Cambios sin guardar</span>
                </div>
              )}
              <Link
                to={`/partners/groups/${groupId}`}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </Link>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving || selectedMemberIds.length === 0}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all ${
                  hasChanges && selectedMemberIds.length > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm mb-6">
          <div className="p-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email o CURP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos</option>
                <option value="selected">Seleccionados</option>
                <option value="unselected">No seleccionados</option>
              </select>
            </div>

            <div className="flex items-center gap-4 ml-auto text-sm">
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{selectedMemberIds.length}</span> seleccionados
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">
                <span className="font-semibold text-gray-900">{processedMembers.length}</span> visibles
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-12 px-4 py-3">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title={allVisibleSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                  >
                    Nombre
                    <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort('email')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                  >
                    Email
                    <SortIcon field="email" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  <button
                    onClick={() => handleSort('curp')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                  >
                    CURP
                    <SortIcon field="curp" />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                  >
                    Estado
                    <SortIcon field="status" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No se encontraron candidatos</p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Limpiar busqueda
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                processedMembers.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.user_id);
                  const wasOriginallyAssigned = assignedUserIds.includes(member.user_id);
                  const isNewlyAdded = isSelected && !wasOriginallyAssigned;
                  const isBeingRemoved = !isSelected && wasOriginallyAssigned;
                  const hasOtherExams = type === 'exam' && member.has_exam && !wasOriginallyAssigned;

                  return (
                    <tr
                      key={member.id}
                      onClick={() => handleToggleMember(member.user_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? isNewlyAdded
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-blue-50 hover:bg-blue-100'
                          : isBeingRemoved
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? isNewlyAdded
                                ? 'bg-green-500 border-green-500'
                                : 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {member.user?.full_name || 'Sin nombre'}
                          </span>
                          {hasOtherExams && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700" title="Tiene otros exámenes asignados">
                              <ClipboardList className="w-3 h-3 mr-0.5" />
                              +exámenes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-600">{member.user?.email || '-'}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-gray-600 font-mono text-sm">{member.user?.curp || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isNewlyAdded ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Nuevo
                          </span>
                        ) : isBeingRemoved ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Remover
                          </span>
                        ) : wasOriginallyAssigned ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Asignado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Disponible
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Asignado actualmente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Nuevo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>Se removera</span>
            </div>
          </div>
          <p>
            Grupo: <span className="font-medium text-gray-700">{group.name}</span>
          </p>
        </div>
      </div>

      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-900">Guardando cambios...</p>
          </div>
        </div>
      )}
    </div>
  );
}
