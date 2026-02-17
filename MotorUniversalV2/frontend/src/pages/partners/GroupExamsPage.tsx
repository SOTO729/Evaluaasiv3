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

      {/* Header compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4 fluid-mb-6">
        <div className="flex items-center fluid-gap-3">
          <Link to={`/partners/groups/${groupId}`} className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors">
            <ArrowLeft className="fluid-icon-lg text-gray-600" />
          </Link>
          <div>
            <p className="fluid-text-xs text-gray-500">{group.name}</p>
            <h1 className="fluid-text-xl font-bold text-gray-900 flex items-center fluid-gap-2">
              <ClipboardList className="fluid-icon-base text-blue-600" />
              Certificaciones
            </h1>
          </div>
        </div>
        {memberCount > 0 && (
          <Link to={`/partners/groups/${groupId}/assign-exam`}
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-fluid-xl font-medium fluid-text-sm transition-colors shadow-sm">
            <Plus className="fluid-icon-sm" />Asignar Certificación
          </Link>
        )}
      </div>

      {/* KPI compactos */}
      <div className="grid grid-cols-3 fluid-gap-4 fluid-mb-6">
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2 bg-blue-100 rounded-fluid-lg"><Award className="fluid-icon-sm text-blue-600" /></div>
            <div><p className="fluid-text-xl font-bold text-gray-900">{stats.totalExams}</p><p className="fluid-text-xs text-gray-500">Exámenes</p></div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2 bg-green-100 rounded-fluid-lg"><BookOpen className="fluid-icon-sm text-green-600" /></div>
            <div><p className="fluid-text-xl font-bold text-gray-900">{stats.totalMaterials}</p><p className="fluid-text-xs text-gray-500">Materiales</p></div>
          </div>
        </div>
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4">
          <div className="flex items-center fluid-gap-3">
            <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg"><Layers className="fluid-icon-sm text-purple-600" /></div>
            <div><p className="fluid-text-xl font-bold text-gray-900">{stats.withEcm}</p><p className="fluid-text-xs text-gray-500">Con ECM</p></div>
          </div>
        </div>
      </div>

      {/* Lista de exámenes */}
      {assignedExams.length === 0 ? (
        <div className="bg-white rounded-fluid-xl border border-gray-200 text-center fluid-py-12">
          <Award className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-3" />
          {memberCount === 0 ? (
            <>
              <h4 className="fluid-text-base font-semibold text-gray-700 fluid-mb-1">Sin certificaciones asignadas</h4>
              <p className="fluid-text-sm text-gray-500 fluid-mb-4">Primero agrega miembros al grupo</p>
              <Link to={`/partners/groups/${groupId}/assign-candidates`}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl fluid-text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors">
                <UserPlus className="fluid-icon-sm" />Agregar Miembros
              </Link>
            </>
          ) : (
            <>
              <h4 className="fluid-text-base font-semibold text-gray-700 fluid-mb-1">Sin certificaciones asignadas</h4>
              <p className="fluid-text-sm text-gray-500 fluid-mb-4">Asigna una certificación para que los miembros puedan evaluarse</p>
              <Link to={`/partners/groups/${groupId}/assign-exam`}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-fluid-xl fluid-text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                <Plus className="fluid-icon-sm" />Asignar Certificación
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-fluid-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {assignedExams.map((assignment) => {
            const ecm = assignment.exam?.ecm;
            const hasMaterials = assignment.study_materials && assignment.study_materials.length > 0;
            
            return (
              <div key={assignment.id} className="fluid-p-5 hover:bg-gray-50/50 transition-colors">
                {/* Fila principal */}
                <div className="flex items-start fluid-gap-4">
                  {ecm?.logo_url ? (
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-fluid-lg p-1.5 flex-shrink-0">
                      <img src={ecm.logo_url} alt={ecm.code} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 rounded-fluid-lg flex items-center justify-center flex-shrink-0">
                      <Award className="fluid-icon-base text-blue-600" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center fluid-gap-2 fluid-mb-0.5">
                      <h4 className="font-semibold text-gray-900 truncate">{assignment.exam?.name || 'Examen'}</h4>
                      {ecm?.code && (
                        <span className="fluid-px-2 fluid-py-0.5 bg-purple-100 text-purple-700 fluid-text-xs font-bold rounded-full flex-shrink-0">{ecm.code}</span>
                      )}
                    </div>
                    {ecm?.name && ecm.name !== assignment.exam?.name && (
                      <p className="fluid-text-xs text-gray-500 truncate fluid-mb-2">{ecm.name}</p>
                    )}
                    
                    {/* Config como badges inline */}
                    <div className="flex flex-wrap items-center fluid-gap-2 fluid-mt-1">
                      <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-gray-100 text-gray-700 fluid-text-xs rounded-fluid-lg">
                        <Clock className="fluid-icon-xs text-gray-500" />{assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min
                      </span>
                      <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-gray-100 text-gray-700 fluid-text-xs rounded-fluid-lg">
                        <Target className="fluid-icon-xs text-gray-500" />{assignment.passing_score || assignment.exam?.passing_score || 70}%
                      </span>
                      <span className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-gray-100 text-gray-700 fluid-text-xs rounded-fluid-lg">
                        <Layers className="fluid-icon-xs text-gray-500" />{assignment.max_attempts || 1} intento{(assignment.max_attempts || 1) > 1 ? 's' : ''}
                      </span>
                      <span className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 fluid-text-xs rounded-fluid-lg ${
                        assignment.assignment_type === 'selected' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {assignment.assignment_type === 'selected' 
                          ? <><UserPlus className="fluid-icon-xs" />{assignment.assigned_members_count || 0} miembros</>
                          : <><Users className="fluid-icon-xs" />Todo el grupo</>
                        }
                      </span>
                    </div>

                    {/* Materiales inline */}
                    <div className="flex flex-wrap items-center fluid-gap-2 fluid-mt-2">
                      {hasMaterials ? (
                        <>
                          {assignment.study_materials!.map((material) => (
                            <span key={material.id} className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-green-50 border border-green-200 text-green-800 fluid-text-xs rounded-fluid-lg">
                              <BookOpen className="fluid-icon-xs" />{material.title}
                            </span>
                          ))}
                          <button onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                            className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 text-blue-600 hover:bg-blue-50 fluid-text-xs rounded-fluid-lg transition-colors font-medium">
                            <Edit className="fluid-icon-xs" />Editar
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                          className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 text-amber-700 bg-amber-50 border border-amber-200 fluid-text-xs rounded-fluid-lg hover:bg-amber-100 transition-colors">
                          <AlertTriangle className="fluid-icon-xs" />Sin materiales — Agregar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center fluid-gap-1 flex-shrink-0">
                    <Link to={`/partners/groups/${groupId}/assignments/${assignment.exam_id}/edit-members?type=exam&name=${encodeURIComponent(assignment.exam?.name || 'Examen')}`}
                      className="fluid-p-2 hover:bg-blue-100 rounded-fluid-lg text-gray-400 hover:text-blue-600 transition-colors" title="Editar miembros">
                      <Edit className="fluid-icon-sm" />
                    </Link>
                    <button onClick={() => handleUnassignExam(assignment.exam_id)}
                      className="fluid-p-2 hover:bg-red-100 rounded-fluid-lg text-gray-400 hover:text-red-600 transition-colors" title="Desasignar">
                      <Trash2 className="fluid-icon-sm" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Materiales Adicionales — compacto */}
      <div className="fluid-mt-6 bg-white rounded-fluid-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between fluid-px-5 fluid-py-4 border-b border-gray-100">
          <div className="flex items-center fluid-gap-2">
            <BookOpen className="fluid-icon-base text-green-600" />
            <h3 className="font-semibold text-gray-900">Materiales Adicionales</h3>
            {directMaterials.length > 0 && (
              <span className="fluid-px-2 fluid-py-0.5 bg-green-100 text-green-700 fluid-text-xs font-bold rounded-full">{directMaterials.length}</span>
            )}
          </div>
          {memberCount > 0 && (
            <Link to={`/partners/groups/${groupId}/assign-materials`}
              className="inline-flex items-center fluid-gap-1.5 fluid-px-3 fluid-py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-fluid-lg font-medium fluid-text-xs transition-colors">
              <Plus className="fluid-icon-xs" />Asignar
            </Link>
          )}
        </div>

        {directMaterials.length === 0 ? (
          <div className="fluid-px-5 fluid-py-8 text-center">
            <p className="fluid-text-sm text-gray-400">Sin materiales adicionales independientes</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {directMaterials.map((assignment) => (
              <div key={assignment.id} className="fluid-px-5 fluid-py-3 flex items-center fluid-gap-3 hover:bg-gray-50 transition-colors group">
                <BookOpen className="fluid-icon-sm text-green-600 flex-shrink-0" />
                <span className="font-medium text-gray-900 flex-1 truncate">{assignment.study_material?.title || 'Material'}</span>
                <span className={`inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 rounded-full fluid-text-xs font-medium ${
                  assignment.assignment_type === 'selected' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {assignment.assignment_type === 'selected' ? 'Específicos' : 'Todos'}
                </span>
                <div className="flex items-center fluid-gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/partners/groups/${groupId}/assignments/${assignment.study_material_id}/edit-members?type=material&name=${encodeURIComponent(assignment.study_material?.title || 'Material')}`}
                    className="fluid-p-1.5 hover:bg-blue-100 rounded-fluid-lg text-gray-400 hover:text-blue-600 transition-colors" title="Editar miembros">
                    <Edit className="fluid-icon-xs" />
                  </Link>
                  <button onClick={() => handleUnassignMaterial(assignment.study_material_id)}
                    className="fluid-p-1.5 hover:bg-red-100 rounded-fluid-lg text-gray-400 hover:text-red-600 transition-colors" title="Desasignar">
                    <X className="fluid-icon-xs" />
                  </button>
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
