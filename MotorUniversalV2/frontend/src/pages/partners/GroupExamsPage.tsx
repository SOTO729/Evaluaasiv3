/**
 * Página de Certificaciones del Grupo
 * Gestión de exámenes y materiales de estudio
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  Plus,
  UserPlus,
  ClipboardList,
  BookOpen,
  Clock,
  Target,
  Layers,
  AlertTriangle,
  Award,
  Edit,
  Trash2,
  X,
  CheckCircle2,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembers,
  getGroupExams,
  getGroupStudyMaterials,
  unassignExamFromGroup,
  unassignStudyMaterialFromGroup,
  getGroupExamMaterials,
  updateGroupExamMaterials,
  resetGroupExamMaterials,
  CandidateGroup,
  GroupExamAssignment,
  GroupStudyMaterialAssignment,
  GroupExamMaterialItem,
} from '../../services/partnersService';

export default function GroupExamsPage() {
  const { groupId } = useParams();
  const location = useLocation();
  
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [assignedExams, setAssignedExams] = useState<GroupExamAssignment[]>([]);
  const [directMaterials, setDirectMaterials] = useState<GroupStudyMaterialAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal de materiales
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [selectedGroupExamId, setSelectedGroupExamId] = useState<number | null>(null);
  const [selectedExamName, setSelectedExamName] = useState<string>('');
  const [materialsList, setMaterialsList] = useState<GroupExamMaterialItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [savingMaterials, setSavingMaterials] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId, location.key]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, membersData, examsData, materialsData] = await Promise.all([
        getGroup(Number(groupId)),
        getGroupMembers(Number(groupId)),
        getGroupExams(Number(groupId)),
        getGroupStudyMaterials(Number(groupId)).catch(() => ({ assigned_materials: [] })),
      ]);
      setGroup(groupData);
      setMemberCount(membersData.members?.length || 0);
      setAssignedExams(examsData.assigned_exams);
      setDirectMaterials(materialsData.assigned_materials || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar las certificaciones');
    } finally {
      setLoading(false);
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

  const handleUnassignMaterial = async (materialId: number) => {
    if (!confirm('¿Estás seguro de desasignar este material del grupo?')) return;
    
    try {
      await unassignStudyMaterialFromGroup(Number(groupId), materialId);
      setDirectMaterials(directMaterials.filter(m => m.study_material_id !== materialId));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al desasignar material');
    }
  };

  const handleOpenMaterialsModal = async (groupExamId: number, examName: string) => {
    try {
      setSelectedGroupExamId(groupExamId);
      setSelectedExamName(examName);
      setShowMaterialsModal(true);
      setLoadingMaterials(true);
      
      const data = await getGroupExamMaterials(groupExamId);
      setMaterialsList(data.materials);
    } catch (err: any) {
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
    if (!confirm('¿Restablecer los materiales a los valores por defecto?')) return;
    
    try {
      setSavingMaterials(true);
      await resetGroupExamMaterials(selectedGroupExamId);
      const data = await getGroupExamMaterials(selectedGroupExamId);
      setMaterialsList(data.materials);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al resetear materiales');
    } finally {
      setSavingMaterials(false);
    }
  };

  const stats = {
    totalExams: assignedExams.length,
    totalMaterials: directMaterials.length + assignedExams.reduce((acc, e) => acc + (e.study_materials?.length || 0), 0),
    withEcm: assignedExams.filter(e => e.exam?.ecm).length,
  };

  if (loading) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <LoadingSpinner message="Cargando certificaciones..." />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="fluid-p-6 max-w-[2800px] mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-center fluid-gap-3">
          <AlertCircle className="fluid-icon-lg text-red-600" />
          <p className="text-red-700">{error || 'Error al cargar'}</p>
          <Link to={`/partners/groups/${groupId}`} className="ml-auto text-red-700 underline">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
          { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
          { label: group.name, path: `/partners/groups/${groupId}` },
          { label: 'Certificaciones' }
        ]} 
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/groups/${groupId}`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <p className="fluid-text-sm text-white/80 fluid-mb-1">
                {group.name}
              </p>
              <h1 className="fluid-text-2xl font-bold flex items-center fluid-gap-3">
                <ClipboardList className="fluid-icon-lg" />
                Certificaciones
              </h1>
            </div>
          </div>
          
          <div className="flex items-center fluid-gap-2">
            {memberCount === 0 ? (
              <div className="relative group">
                <button
                  disabled
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/10 text-white/50 rounded-fluid-xl font-medium fluid-text-sm cursor-not-allowed border border-white/10"
                >
                  <Plus className="fluid-icon-sm" />
                  Asignar Certificación
                </button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Primero agrega candidatos
                </div>
              </div>
            ) : (
              <Link
                to={`/partners/groups/${groupId}/assign-exam`}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white hover:bg-gray-100 text-blue-600 rounded-fluid-xl font-medium fluid-text-sm transition-all shadow-lg"
              >
                <Plus className="fluid-icon-sm" />
                Asignar Certificación
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 fluid-gap-4 fluid-mt-6">
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{stats.totalExams}</p>
            <p className="fluid-text-xs text-white/70">Exámenes</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{stats.totalMaterials}</p>
            <p className="fluid-text-xs text-white/70">Materiales</p>
          </div>
          <div className="bg-white/10 rounded-fluid-xl fluid-p-4 text-center">
            <p className="fluid-text-2xl font-bold">{stats.withEcm}</p>
            <p className="fluid-text-xs text-white/70">Con ECM</p>
          </div>
        </div>
      </div>

      {/* Lista de exámenes */}
      {assignedExams.length === 0 ? (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 text-center fluid-py-16">
          <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Award className="w-10 h-10 text-blue-500" />
          </div>
          {memberCount === 0 ? (
            <>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Sin certificaciones asignadas</h4>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Para asignar certificaciones, primero debes agregar candidatos al grupo
              </p>
              <Link
                to={`/partners/groups/${groupId}/assign-candidates`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Agregar Candidatos
              </Link>
            </>
          ) : (
            <>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Sin certificaciones asignadas</h4>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Asigna una certificación para que los candidatos puedan evaluarse
              </p>
              <Link
                to={`/partners/groups/${groupId}/assign-exam`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Asignar Primera Certificación
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="fluid-space-y-6">
          {assignedExams.map((assignment) => {
            const ecm = assignment.exam?.ecm;
            const hasMaterials = assignment.study_materials && assignment.study_materials.length > 0;
            
            return (
              <div
                key={assignment.id}
                className="bg-white rounded-fluid-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Header con ECM */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 fluid-p-5">
                  <div className="flex items-start fluid-gap-4">
                    {ecm?.logo_url ? (
                      <div className="w-16 h-16 bg-white rounded-fluid-xl p-2 flex-shrink-0 shadow-lg">
                        <img
                          src={ecm.logo_url}
                          alt={ecm.code}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-fluid-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Award className="fluid-icon-xl text-white" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {ecm?.code && (
                        <div className="flex items-center fluid-gap-2 fluid-mb-1">
                          <span className="fluid-px-2 fluid-py-0.5 bg-blue-500/20 text-blue-300 fluid-text-xs font-bold rounded-fluid-lg tracking-wide">
                            {ecm.code}
                          </span>
                          {ecm.brand_name && (
                            <span className="text-slate-400 fluid-text-xs">{ecm.brand_name}</span>
                          )}
                        </div>
                      )}
                      <h4 className="fluid-text-lg font-bold text-white truncate">
                        {assignment.exam?.name || 'Examen'}
                      </h4>
                      {ecm?.name && ecm.name !== assignment.exam?.name && (
                        <p className="text-slate-300 fluid-text-sm fluid-mt-0.5 line-clamp-1">
                          {ecm.name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center fluid-gap-1 flex-shrink-0">
                      <Link
                        to={`/partners/groups/${groupId}/assignments/${assignment.exam_id}/edit-members?type=exam&name=${encodeURIComponent(assignment.exam?.name || 'Examen')}`}
                        className="fluid-p-2 hover:bg-white/10 rounded-fluid-lg text-slate-300 hover:text-white transition-colors"
                        title="Editar candidatos"
                      >
                        <Edit className="fluid-icon-sm" />
                      </Link>
                      <button
                        onClick={() => handleUnassignExam(assignment.exam_id)}
                        className="fluid-p-2 hover:bg-red-500/20 rounded-fluid-lg text-slate-300 hover:text-red-400 transition-colors"
                        title="Desasignar examen"
                      >
                        <Trash2 className="fluid-icon-sm" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Configuración */}
                <div className="fluid-px-5 fluid-py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center fluid-gap-2 fluid-text-sm">
                      <div className="w-8 h-8 rounded-fluid-lg bg-blue-100 flex items-center justify-center">
                        <Clock className="fluid-icon-sm text-blue-600" />
                      </div>
                      <div>
                        <span className="text-gray-500 fluid-text-xs">Duración</span>
                        <p className="font-semibold text-gray-900">{assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center fluid-gap-2 fluid-text-sm">
                      <div className="w-8 h-8 rounded-fluid-lg bg-green-100 flex items-center justify-center">
                        <Target className="fluid-icon-sm text-green-600" />
                      </div>
                      <div>
                        <span className="text-gray-500 fluid-text-xs">Aprobar</span>
                        <p className="font-semibold text-gray-900">{assignment.passing_score || assignment.exam?.passing_score || 70}%</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center fluid-gap-2 fluid-text-sm">
                      <div className="w-8 h-8 rounded-fluid-lg bg-amber-100 flex items-center justify-center">
                        <Layers className="fluid-icon-sm text-amber-600" />
                      </div>
                      <div>
                        <span className="text-gray-500 fluid-text-xs">Intentos</span>
                        <p className="font-semibold text-gray-900">{assignment.max_attempts || 1}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center fluid-gap-2 fluid-text-sm">
                      <div className={`w-8 h-8 rounded-fluid-lg flex items-center justify-center ${
                        assignment.assignment_type === 'selected' ? 'bg-purple-100' : 'bg-indigo-100'
                      }`}>
                        {assignment.assignment_type === 'selected' ? (
                          <UserPlus className="fluid-icon-sm text-purple-600" />
                        ) : (
                          <Users className="fluid-icon-sm text-indigo-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500 fluid-text-xs">Asignado a</span>
                        <p className="font-semibold text-gray-900">
                          {assignment.assignment_type === 'selected' 
                            ? `${assignment.assigned_members_count || 0} candidatos`
                            : 'Todo el grupo'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Materiales */}
                <div className="fluid-p-5">
                  <div className="flex items-center justify-between fluid-mb-3">
                    <div className="flex items-center fluid-gap-2">
                      <BookOpen className={`fluid-icon-base ${hasMaterials ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={`font-medium ${hasMaterials ? 'text-gray-900' : 'text-gray-500'}`}>
                        Materiales de Estudio
                      </span>
                      {hasMaterials && (
                        <span className="fluid-px-2 fluid-py-0.5 bg-green-100 text-green-700 fluid-text-xs font-medium rounded-full">
                          {assignment.study_materials!.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                      className="fluid-text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center fluid-gap-1 fluid-px-3 fluid-py-1.5 hover:bg-blue-50 rounded-fluid-lg transition-colors"
                    >
                      {hasMaterials ? <><Edit className="fluid-icon-sm" /> Editar</> : <><Plus className="fluid-icon-sm" /> Agregar</>}
                    </button>
                  </div>
                  
                  {hasMaterials ? (
                    <div className="flex flex-wrap fluid-gap-2">
                      {assignment.study_materials!.map((material) => (
                        <div
                          key={material.id}
                          className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-fluid-xl fluid-text-sm"
                        >
                          <BookOpen className="fluid-icon-sm text-green-600" />
                          <span className="text-gray-800 font-medium">{material.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center fluid-gap-3 fluid-p-4 bg-amber-50 rounded-fluid-xl border border-amber-100">
                      <AlertTriangle className="fluid-icon-base text-amber-500 flex-shrink-0" />
                      <p className="fluid-text-sm text-amber-800">
                        Sin materiales de estudio. Los candidatos no tendrán acceso a contenido preparatorio.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Materiales Adicionales */}
      <div className="fluid-mt-8 bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4 fluid-mb-6">
          <div className="flex items-center fluid-gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-fluid-xl flex items-center justify-center shadow-lg">
              <BookOpen className="fluid-icon-lg text-white" />
            </div>
            <div>
              <h3 className="fluid-text-lg font-bold text-gray-900">Materiales Adicionales</h3>
              <p className="fluid-text-sm text-gray-500">Contenido independiente de certificaciones</p>
            </div>
          </div>
          {memberCount > 0 && (
            <Link
              to={`/partners/groups/${groupId}/assign-materials`}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 rounded-fluid-xl font-semibold fluid-text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg transition-all"
            >
              <Plus className="fluid-icon-sm" />
              Asignar Material
            </Link>
          )}
        </div>

        {directMaterials.length === 0 ? (
          <div className="text-center fluid-py-12 bg-gradient-to-br from-gray-50 to-green-50 rounded-fluid-2xl border-2 border-dashed border-gray-200">
            <BookOpen className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
            <h4 className="text-gray-600 font-medium fluid-mb-1">Sin materiales adicionales</h4>
            <p className="text-gray-400 fluid-text-sm max-w-sm mx-auto">
              Puedes asignar materiales de estudio sin vincularlos a una certificación
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 fluid-gap-4">
            {directMaterials.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white border border-gray-200 rounded-fluid-xl fluid-p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-start fluid-gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                    <BookOpen className="fluid-icon-lg text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                      {assignment.study_material?.title || 'Material'}
                    </h4>
                    <div className="flex items-center fluid-gap-2 fluid-mt-1">
                      <span className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium ${
                        assignment.assignment_type === 'selected' 
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {assignment.assignment_type === 'selected' ? (
                          <><UserPlus className="h-3 w-3" />Específicos</>
                        ) : (
                          <><Users className="h-3 w-3" />Todos</>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col fluid-gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to={`/partners/groups/${groupId}/assignments/${assignment.study_material_id}/edit-members?type=material&name=${encodeURIComponent(assignment.study_material?.title || 'Material')}`}
                      className="fluid-p-1.5 hover:bg-blue-100 rounded-fluid-lg text-blue-500 transition-colors"
                      title="Editar candidatos"
                    >
                      <Edit className="fluid-icon-sm" />
                    </Link>
                    <button
                      onClick={() => handleUnassignMaterial(assignment.study_material_id)}
                      className="fluid-p-1.5 hover:bg-red-100 rounded-fluid-lg text-red-400 transition-colors"
                      title="Desasignar"
                    >
                      <X className="fluid-icon-sm" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de materiales */}
      {showMaterialsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between fluid-p-5 border-b">
              <div>
                <h3 className="fluid-text-lg font-semibold text-gray-800">Materiales de Estudio</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedExamName}</p>
              </div>
              <button
                onClick={() => { setShowMaterialsModal(false); setSelectedGroupExamId(null); setMaterialsList([]); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto fluid-p-5">
              {loadingMaterials ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full" />
                </div>
              ) : materialsList.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No hay materiales disponibles</div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Vinculados al examen
                    </h4>
                    {materialsList.filter(m => m.is_linked).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Ningún material vinculado</p>
                    ) : (
                      materialsList.filter(m => m.is_linked).map((material) => (
                        <div
                          key={material.id}
                          className={`flex items-center justify-between p-3 border rounded-xl mb-2 transition-all cursor-pointer ${
                            material.is_included ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'
                          }`}
                          onClick={() => handleToggleMaterial(material.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              material.is_included ? 'bg-green-500 border-green-500' : 'border-gray-300'
                            }`}>
                              {material.is_included && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <p className={`font-medium text-sm ${material.is_included ? 'text-gray-900' : 'text-gray-500'}`}>
                              {material.title}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Otros materiales
                    </h4>
                    {materialsList.filter(m => !m.is_linked).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No hay otros materiales</p>
                    ) : (
                      materialsList.filter(m => !m.is_linked).map((material) => (
                        <div
                          key={material.id}
                          className={`flex items-center justify-between p-3 border rounded-xl mb-2 transition-all cursor-pointer ${
                            material.is_included ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          onClick={() => handleToggleMaterial(material.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              material.is_included ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                            }`}>
                              {material.is_included && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <p className={`font-medium text-sm ${material.is_included ? 'text-gray-900' : 'text-gray-600'}`}>
                              {material.title}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between fluid-p-5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={handleResetMaterials} disabled={savingMaterials} className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                Restablecer
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowMaterialsModal(false); setSelectedGroupExamId(null); setMaterialsList([]); }}
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
                    <><CheckCircle2 className="h-4 w-4" />Guardar</>
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
