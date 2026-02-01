/**
 * Detalle de Grupo con Gestión de Miembros y Exámenes
 */
import { useState, useEffect } from 'react';
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
  X,
  UserPlus,
  Mail,
  ClipboardList,
  BookOpen,
  Clock,
  Target,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  updateGroupMember,
  removeGroupMember,
  getGroupExams,
  unassignExamFromGroup,
  getGroupExamMaterials,
  updateGroupExamMaterials,
  resetGroupExamMaterials,
  CandidateGroup,
  GroupMember,
  GroupExamAssignment,
  GroupExamMaterialItem,
} from '../../services/partnersService';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Exámenes asignados
  const [assignedExams, setAssignedExams] = useState<GroupExamAssignment[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'exams'>('members');
  
  // Modal de materiales personalizados
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [selectedGroupExamId, setSelectedGroupExamId] = useState<number | null>(null);
  const [selectedExamName, setSelectedExamName] = useState<string>('');
  const [materialsList, setMaterialsList] = useState<GroupExamMaterialItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [savingMaterials, setSavingMaterials] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData, examsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
        getGroupExams(Number(groupId)),
      ]);
      setGroup(groupData);
      setMembers(membersData.members);
      setAssignedExams(examsData.assigned_exams);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
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

  const handleUnassignExam = async (examId: number) => {
    if (!confirm('¿Estás seguro de desasignar este examen del grupo?')) return;
    
    try {
      await unassignExamFromGroup(Number(groupId), examId);
      setAssignedExams(assignedExams.filter(e => e.exam_id !== examId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desasignar examen');
    }
  };

  // Funciones para gestionar materiales personalizados
  const handleOpenMaterialsModal = async (groupExamId: number, examName: string) => {
    try {
      setSelectedGroupExamId(groupExamId);
      setSelectedExamName(examName);
      setShowMaterialsModal(true);
      setLoadingMaterials(true);
      
      const data = await getGroupExamMaterials(groupExamId);
      setMaterialsList(data.materials);
    } catch (err: any) {
      console.error('Error loading materials:', err);
      setError('Error al cargar materiales');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleToggleMaterial = (materialId: number) => {
    setMaterialsList(prev => prev.map(m => 
      m.id === materialId ? { ...m, is_included: !m.is_included } : m
    ));
  };

  const handleSaveMaterials = async () => {
    if (!selectedGroupExamId) return;
    
    try {
      setSavingMaterials(true);
      const materialsToSave = materialsList.map(m => ({
        id: m.id,
        is_included: m.is_included
      }));
      
      await updateGroupExamMaterials(selectedGroupExamId, materialsToSave);
      
      // Recargar datos del grupo para actualizar la vista
      await loadData();
      setShowMaterialsModal(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar materiales');
    } finally {
      setSavingMaterials(false);
    }
  };

  const handleResetMaterials = async () => {
    if (!selectedGroupExamId) return;
    if (!confirm('¿Restablecer los materiales a los valores por defecto del examen?')) return;
    
    try {
      setSavingMaterials(true);
      await resetGroupExamMaterials(selectedGroupExamId);
      
      // Recargar materiales
      const data = await getGroupExamMaterials(selectedGroupExamId);
      setMaterialsList(data.materials);
      
      // Recargar datos del grupo
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al resetear materiales');
    } finally {
      setSavingMaterials(false);
    }
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando grupo..." />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700 fluid-text-base">{error || 'Grupo no encontrado'}</p>
          <Link to="/partners" className="ml-auto text-red-700 underline fluid-text-base">
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
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-5 fluid-mb-6">
        <div className="flex items-center fluid-gap-5">
          <Link
            to={`/partners/campuses/${group.campus_id}`}
            className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
          >
            <ArrowLeft className="fluid-icon-lg text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-base text-gray-500 mb-1">
              <Building2 className="fluid-icon-sm" />
              <Link to={`/partners/campuses/${group.campus_id}`} className="hover:text-blue-600 transition-colors">
                {group.campus?.name}
              </Link>
            </div>
            <div className="flex items-center fluid-gap-2">
              <h1 className="fluid-text-3xl font-bold text-gray-800">
                {group.name}
              </h1>
              {group.code && (
                <span className="fluid-px-2 fluid-py-1 bg-gray-100 text-gray-600 rounded-lg fluid-text-base font-mono">
                  {group.code}
                </span>
              )}
              {group.is_active ? (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-green-700 bg-green-50 fluid-px-2 fluid-py-1 rounded-full">
                  <CheckCircle2 className="fluid-icon-xs" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-gray-600 bg-gray-100 fluid-px-2 fluid-py-1 rounded-full">
                  <XCircle className="fluid-icon-xs" />
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap fluid-gap-2">
          {activeTab === 'members' ? (
            <Link
              to={group.is_active ? `/partners/groups/${groupId}/assign-candidates` : '#'}
              onClick={(e) => !group.is_active && e.preventDefault()}
              className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl font-medium fluid-text-base transition-colors ${
                group.is_active
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-gray-300 cursor-not-allowed text-gray-500'
              }`}
            >
              <UserPlus className="fluid-icon-sm" />
              Agregar Candidatos
            </Link>
          ) : (
            <>
              <Link
                to={`/partners/groups/${groupId}/assign-exam`}
                className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl font-medium fluid-text-base transition-colors ${
                  group.is_active
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-gray-300 pointer-events-none text-gray-500'
                }`}
              >
                <Plus className="fluid-icon-sm" />
                Asignar Examen
              </Link>
              <Link
                to={`/partners/groups/${groupId}/assign-materials`}
                className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl font-medium fluid-text-base transition-colors ${
                  group.is_active
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 pointer-events-none text-gray-500'
                }`}
              >
                <BookOpen className="fluid-icon-sm" />
                Asignar Material
              </Link>
            </>
          )}
          <Link
            to={`/partners/groups/${groupId}/edit`}
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 rounded-fluid-xl font-medium fluid-text-base transition-colors"
          >
            <Edit className="fluid-icon-sm" />
            Editar
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 fluid-text-base font-medium transition-colors relative ${
              activeTab === 'members'
                ? 'text-purple-600 bg-purple-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Users className="fluid-icon-sm" />
            <span>Candidatos</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'members' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {members.length}
            </span>
            {activeTab === 'members' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-3 fluid-text-base font-medium transition-colors relative ${
              activeTab === 'exams'
                ? 'text-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <ClipboardList className="fluid-icon-sm" />
            <span>Exámenes</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'exams' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {assignedExams.length}
            </span>
            {activeTab === 'exams' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 fluid-gap-6">
        {/* Información del Grupo */}
        <div className="lg:col-span-1 flex flex-col fluid-gap-5">
          {/* Detalles */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4 flex items-center gap-2">
              <Layers className="fluid-icon-lg text-amber-600" />
              Información
            </h2>
            
            {group.description && (
              <div className="fluid-mb-4">
                <p className="fluid-text-xs text-gray-500 mb-1">Descripción</p>
                <p className="fluid-text-base text-gray-900">{group.description}</p>
              </div>
            )}

          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-800 fluid-mb-4">
              Estadísticas
            </h2>
            
            <div className="flex flex-col fluid-gap-3">
              <div className="flex items-center justify-between">
                <span className="fluid-text-base text-gray-600">Total Miembros</span>
                <span className="fluid-text-lg font-semibold text-gray-900">
                  {members.length}
                </span>
              </div>

              <div className="fluid-pt-3 border-t border-gray-200 flex flex-col fluid-gap-2">
                <div className="flex items-center justify-between">
                  <span className="fluid-text-base text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Activos
                  </span>
                  <span className="font-medium">{membersByStatus.active.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="fluid-text-base text-blue-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Completados
                  </span>
                  <span className="font-medium">{membersByStatus.completed.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="fluid-text-base text-gray-500 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Pendientes
                  </span>
                  <span className="font-medium">{membersByStatus.inactive.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="fluid-text-base text-red-500 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Dados de baja
                  </span>
                  <span className="font-medium">{membersByStatus.withdrawn.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Miembros - Solo visible en tab members */}
        {activeTab === 'members' && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
              <div className="flex items-center justify-between fluid-mb-5">
                <h2 className="fluid-text-xl font-semibold text-gray-800 flex items-center fluid-gap-2">
                  <Users className="fluid-icon-lg text-purple-600" />
                  Candidatos ({members.length})
                </h2>
              </div>

              {members.length === 0 ? (
                <div className="text-center fluid-py-10">
                  <Users className="fluid-icon-2xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 fluid-text-base mb-4">
                    No hay candidatos en este grupo
                  </p>
                  <Link
                    to={group.is_active ? `/partners/groups/${groupId}/assign-candidates` : '#'}
                    onClick={(e) => !group.is_active && e.preventDefault()}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg fluid-text-base font-medium transition-colors ${
                      group.is_active
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-gray-300 cursor-not-allowed text-gray-500'
                    }`}
                  >
                    <UserPlus className="fluid-icon-sm" />
                    Agregar Candidatos
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col fluid-gap-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 fluid-p-3 border border-gray-200 rounded-xl hover:border-purple-200 hover:bg-purple-50/30 transition-all"
                    >
                      <div className="flex items-center fluid-gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold fluid-text-base">
                          {member.user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium fluid-text-base text-gray-900">
                            {member.user?.full_name || 'Usuario desconocido'}
                          </p>
                          {member.user?.email && (
                            <p className="fluid-text-xs text-gray-500 flex items-center gap-1">
                              <Mail className="fluid-icon-xs" />
                              {member.user.email}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">
                            Agregado: {new Date(member.joined_at).toLocaleDateString('es-MX')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center fluid-gap-2">
                        <select
                          value={member.status}
                          onChange={(e) => handleUpdateStatus(member.id, e.target.value as GroupMember['status'])}
                          className={`fluid-px-2 fluid-py-1 border rounded-lg fluid-text-xs font-medium ${
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
                          <Trash2 className="fluid-icon-sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista de Exámenes - Solo visible en tab exams */}
        {activeTab === 'exams' && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
              <div className="flex items-center justify-between fluid-mb-5">
                <h2 className="fluid-text-xl font-semibold text-gray-800 flex items-center fluid-gap-2">
                  <ClipboardList className="fluid-icon-lg text-blue-600" />
                  Exámenes Asignados ({assignedExams.length})
                </h2>
              </div>

              {assignedExams.length === 0 ? (
                <div className="text-center fluid-py-10">
                  <ClipboardList className="fluid-icon-2xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 fluid-text-base mb-4">
                    No hay exámenes asignados a este grupo
                  </p>
                  <Link
                    to={`/partners/groups/${groupId}/assign-exam`}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg fluid-text-base font-medium transition-colors ${
                      group.is_active
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 pointer-events-none text-gray-500'
                    }`}
                  >
                    <Plus className="fluid-icon-sm" />
                    Asignar Examen
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col fluid-gap-4">
                  {assignedExams.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="fluid-p-4 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold fluid-text-base text-gray-900">
                              {assignment.exam?.name || 'Examen'}
                            </h3>
                            {/* Badge de tipo de asignación */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              assignment.assignment_type === 'selected' 
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {assignment.assignment_type === 'selected' ? (
                                <>
                                  <UserPlus className="h-3 w-3" />
                                  {assignment.assigned_members_count || 0} candidatos
                                </>
                              ) : (
                                <>
                                  <Users className="h-3 w-3" />
                                  Todo el grupo
                                </>
                              )}
                            </span>
                            {/* Badge de tipo de contenido */}
                            {assignment.exam_content_type && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                assignment.exam_content_type === 'questions_only'
                                  ? 'bg-cyan-100 text-cyan-700'
                                  : assignment.exam_content_type === 'exercises_only'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {assignment.exam_content_type === 'questions_only' ? 'Preguntas' :
                                 assignment.exam_content_type === 'exercises_only' ? 'Ejercicios' : 'Mixto'}
                              </span>
                            )}
                          </div>
                          {assignment.exam?.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {assignment.exam.description}
                            </p>
                          )}
                          <div className="flex flex-wrap fluid-gap-2 fluid-text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="fluid-icon-xs" />
                              {assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="fluid-icon-xs" />
                              Aprobar: {assignment.passing_score || assignment.exam?.passing_score || 70}%
                            </span>
                            <span className="flex items-center gap-1 text-amber-600">
                              {assignment.max_attempts || 1} intento(s)
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                              {assignment.max_disconnections ?? 3} desconexiones
                            </span>
                            {assignment.exam?.standard && (
                              <span className="px-2 py-0.5 bg-gray-100 rounded-lg">
                                {assignment.exam.standard}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleUnassignExam(assignment.exam_id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors self-start"
                          title="Desasignar examen"
                        >
                          <Trash2 className="fluid-icon-sm" />
                        </button>
                      </div>

                      {/* Materiales de estudio asociados - Siempre visible */}
                      <div className={`mt-4 fluid-pt-4 border-t ${
                        assignment.study_materials && assignment.study_materials.length > 0 
                          ? 'border-green-200 bg-green-50/50' 
                          : 'border-amber-200 bg-amber-50/50'
                      } -mx-5 fluid-px-5 fluid-pb-5 -mb-5 rounded-b-xl`}>
                        {assignment.study_materials && assignment.study_materials.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                                  <BookOpen className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-green-800">
                                    ✓ {assignment.study_materials.length} Material{assignment.study_materials.length > 1 ? 'es' : ''} de estudio incluido{assignment.study_materials.length > 1 ? 's' : ''}
                                  </p>
                                  <p className="text-xs text-green-600">
                                    {(assignment as any).has_custom_materials ? 'Personalizados para este grupo' : 'Cargados automáticamente con el examen'}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                                className="fluid-text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                Editar
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {assignment.study_materials.map((material) => (
                                <span
                                  key={material.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg fluid-text-xs shadow-sm"
                                >
                                  <BookOpen className="h-3.5 w-3.5" />
                                  {material.title}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-full">
                                <BookOpen className="h-4 w-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-amber-800">
                                  Sin materiales de estudio
                                </p>
                                <p className="text-xs text-amber-600">
                                  Este examen no tiene materiales de estudio asociados
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                              className="fluid-text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Agregar
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 text-xs text-gray-400">
                        Asignado: {new Date(assignment.assigned_at).toLocaleDateString('es-MX')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal para gestionar materiales del grupo-examen */}
      {showMaterialsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header del modal */}
            <div className="flex items-center justify-between fluid-p-5 border-b">
              <div>
                <h3 className="fluid-text-lg font-semibold text-gray-800">
                  Materiales de Estudio
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedExamName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMaterialsModal(false);
                  setSelectedGroupExamId(null);
                  setMaterialsList([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto fluid-p-5">
              {loadingMaterials ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : materialsList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay materiales de estudio disponibles
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Materiales vinculados al examen */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Vinculados al examen
                    </h4>
                    {materialsList.filter(m => m.is_linked).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Ningún material vinculado directamente</p>
                    ) : (
                      materialsList.filter(m => m.is_linked).map((material) => (
                        <div
                          key={material.id}
                          className={`flex items-center justify-between p-3 border rounded-xl mb-2 transition-all cursor-pointer ${
                            material.is_included 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-gray-200 bg-gray-50 opacity-60'
                          }`}
                          onClick={() => handleToggleMaterial(material.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              material.is_included 
                                ? 'bg-green-500 border-green-500' 
                                : 'border-gray-300'
                            }`}>
                              {material.is_included && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              )}
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${material.is_included ? 'text-gray-900' : 'text-gray-500'}`}>
                                {material.title}
                              </p>
                              {!material.is_published && (
                                <span className="text-xs text-amber-600">(No publicado)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Otros materiales publicados */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Otros materiales disponibles (publicados)
                    </h4>
                    {materialsList.filter(m => !m.is_linked).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No hay otros materiales publicados</p>
                    ) : (
                      materialsList.filter(m => !m.is_linked).map((material) => (
                        <div
                          key={material.id}
                          className={`flex items-center justify-between p-3 border rounded-xl mb-2 transition-all cursor-pointer ${
                            material.is_included 
                              ? 'border-blue-300 bg-blue-50' 
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          onClick={() => handleToggleMaterial(material.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              material.is_included 
                                ? 'bg-blue-500 border-blue-500' 
                                : 'border-gray-300'
                            }`}>
                              {material.is_included && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                              )}
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${material.is_included ? 'text-gray-900' : 'text-gray-600'}`}>
                                {material.title}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div className="flex items-center justify-between fluid-p-5 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={handleResetMaterials}
                disabled={savingMaterials}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Restablecer valores por defecto
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowMaterialsModal(false);
                    setSelectedGroupExamId(null);
                    setMaterialsList([]);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMaterials}
                  disabled={savingMaterials}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {savingMaterials ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Guardar cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
