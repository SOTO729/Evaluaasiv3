/**
 * Detalle de Grupo con Gestión de Miembros y Exámenes
 * Rediseño con filtrado, búsqueda y mejor UX
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Plus,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building2,
  X,
  UserPlus,
  UserMinus,
  ClipboardList,
  BookOpen,
  Clock,
  Target,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Settings,
  Trash2,
  FileText,
  Layers,
  AlertTriangle,
  Award,
  HelpCircle,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  removeGroupMember,
  getGroupExams,
  unassignExamFromGroup,
  getGroupExamMaterials,
  updateGroupExamMaterials,
  resetGroupExamMaterials,
  exportGroupMembersToExcel,
  getGroupStudyMaterials,
  unassignStudyMaterialFromGroup,
  CandidateGroup,
  GroupMember,
  GroupExamAssignment,
  GroupExamMaterialItem,
  GroupStudyMaterialAssignment,
  EligibilitySummary,
} from '../../services/partnersService';
import GroupCertificatesTab from './GroupCertificatesTab';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const justCreated = searchParams.get('created') === 'true';
  
  const [showSuccessModal, setShowSuccessModal] = useState(justCreated);
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Exámenes asignados
  const [assignedExams, setAssignedExams] = useState<GroupExamAssignment[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'exams' | 'certificates'>('members');
  
  // Materiales de estudio independientes (sin examen)
  const [directMaterials, setDirectMaterials] = useState<GroupStudyMaterialAssignment[]>([]);
  
  // Resumen de elegibilidad
  const [eligibilitySummary, setEligibilitySummary] = useState<EligibilitySummary | null>(null);
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'exam_and_material' | 'exam_only' | 'material_only' | 'none'>('all');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'missing_curp' | 'missing_email' | 'fully_eligible'>('all');
  
  // Selección múltiple
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  
  // Ordenamiento
  type SortField = 'name' | 'email' | 'curp' | 'joined_at' | 'status' | 'certification';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Modal de materiales personalizados
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [selectedGroupExamId, setSelectedGroupExamId] = useState<number | null>(null);
  const [selectedExamName, setSelectedExamName] = useState<string>('');
  const [materialsList, setMaterialsList] = useState<GroupExamMaterialItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [savingMaterials, setSavingMaterials] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Recargar datos cuando cambia el groupId o cuando regresamos de otra página
  // location.key cambia con cada navegación, forzando una recarga
  useEffect(() => {
    loadData();
  }, [groupId, location.key]);

  // Limpiar selección cuando cambian los filtros
  useEffect(() => {
    setSelectedMembers(new Set());
  }, [searchQuery, assignmentFilter, eligibilityFilter]);

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
      setMembers(membersData.members);
      setEligibilitySummary(membersData.eligibility_summary || null);
      setAssignedExams(examsData.assigned_exams);
      setDirectMaterials(materialsData.assigned_materials || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo');
    } finally {
      setLoading(false);
    }
  };

  // Miembros filtrados y ordenados
  const filteredMembers = useMemo(() => {
    let filtered = members.filter(member => {
      // Filtro por tipo de asignación
      if (assignmentFilter !== 'all' && member.assignment_status !== assignmentFilter) {
        return false;
      }
      
      // Filtro por elegibilidad
      if (eligibilityFilter !== 'all') {
        const hasCurp = member.eligibility?.has_curp ?? !!member.user?.curp;
        const hasEmail = member.eligibility?.has_email ?? !!member.user?.email;
        
        if (eligibilityFilter === 'missing_curp' && hasCurp) return false;
        if (eligibilityFilter === 'missing_email' && hasEmail) return false;
        if (eligibilityFilter === 'fully_eligible' && (!hasCurp || !hasEmail)) return false;
      }
      
      // Filtro por búsqueda
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = member.user?.full_name?.toLowerCase() || '';
        const email = member.user?.email?.toLowerCase() || '';
        const name = member.user?.name?.toLowerCase() || '';
        const surname = member.user?.first_surname?.toLowerCase() || '';
        const curp = member.user?.curp?.toLowerCase() || '';
        
        return fullName.includes(query) || 
               email.includes(query) || 
               name.includes(query) || 
               surname.includes(query) ||
               curp.includes(query);
      }
      
      return true;
    });
    
    // Ordenamiento
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          const nameA = a.user?.full_name?.toLowerCase() || '';
          const nameB = b.user?.full_name?.toLowerCase() || '';
          comparison = nameA.localeCompare(nameB, 'es');
          break;
        case 'email':
          const emailA = a.user?.email?.toLowerCase() || '';
          const emailB = b.user?.email?.toLowerCase() || '';
          comparison = emailA.localeCompare(emailB, 'es');
          break;
        case 'curp':
          const curpA = a.user?.curp?.toLowerCase() || '';
          const curpB = b.user?.curp?.toLowerCase() || '';
          comparison = curpA.localeCompare(curpB, 'es');
          break;
        case 'joined_at':
          const dateA = new Date(a.joined_at).getTime();
          const dateB = new Date(b.joined_at).getTime();
          comparison = dateA - dateB;
          break;
        case 'status':
          // Ordenar por estado de asignación: exam_and_material > exam_only > material_only > none
          const statusOrder: Record<string, number> = {
            'exam_and_material': 1,
            'exam_only': 2,
            'material_only': 3,
            'none': 4
          };
          const orderA = statusOrder[a.assignment_status || 'none'] || 4;
          const orderB = statusOrder[b.assignment_status || 'none'] || 4;
          comparison = orderA - orderB;
          break;
        case 'certification':
          // Ordenar por estado de certificación: certified > in_progress > failed > pending
          const certOrder: Record<string, number> = {
            'certified': 1,
            'in_progress': 2,
            'failed': 3,
            'pending': 4
          };
          const certA = certOrder[a.certification_status || 'pending'] || 4;
          const certB = certOrder[b.certification_status || 'pending'] || 4;
          comparison = certA - certB;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [members, searchQuery, assignmentFilter, eligibilityFilter, sortField, sortDirection]);
  
  // Handler para cambiar ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Componente de icono de ordenamiento
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-purple-600" />
      : <ChevronDown className="w-3.5 h-3.5 text-purple-600" />;
  };

  // Estadísticas
  const stats = useMemo(() => {
    // Contar materiales únicos de todos los exámenes + materiales directos
    const allMaterialIds = new Set<number>();
    assignedExams.forEach(exam => {
      exam.study_materials?.forEach(mat => allMaterialIds.add(mat.id));
    });
    // Agregar materiales directos (no asociados a exámenes)
    directMaterials.forEach(dm => {
      if (dm.study_material_id) allMaterialIds.add(dm.study_material_id);
    });
    
    return {
      total: members.length,
      active: members.filter(m => m.status === 'active').length,
      suspended: members.filter(m => m.status === 'suspended').length,
      filtered: filteredMembers.length,
      materials: allMaterialIds.size,
      directMaterials: directMaterials.length,
    };
  }, [members, filteredMembers, assignedExams, directMaterials]);

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('¿Estás seguro de remover este candidato del grupo?')) return;
    
    try {
      await removeGroupMember(Number(groupId), memberId);
      setMembers(members.filter(m => m.id !== memberId));
      setSelectedMembers(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      if (group) {
        setGroup({ ...group, member_count: Math.max(0, (group.member_count || 0) - 1) });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al remover candidato');
    }
  };

  const handleSelectAll = () => {
    if (selectedMembers.size === filteredMembers.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(filteredMembers.map(m => m.id)));
    }
  };

  const handleToggleSelect = (memberId: number) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
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
      const data = await getGroupExamMaterials(selectedGroupExamId);
      setMaterialsList(data.materials);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al resetear materiales');
    } finally {
      setSavingMaterials(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const blob = await exportGroupMembersToExcel(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_${group?.name?.replace(/\s+/g, '_') || 'Grupo'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al exportar Excel');
    } finally {
      setExportingExcel(false);
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

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Header simple */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 fluid-p-5 fluid-mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/partners/campuses/${group.campus_id}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Building2 className="w-4 h-4" />
                <Link to={`/partners/campuses/${group.campus_id}`} className="hover:text-gray-700">
                  {group.campus?.name}
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="fluid-text-xl font-bold text-gray-900">{group.name}</h1>
                {group.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <XCircle className="w-3 h-3" />
                    Inactivo
                  </span>
                )}
              </div>
              {group.description && (
                <p className="text-gray-500 text-sm mt-1">{group.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {members.length > 0 && (
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                {exportingExcel ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            <Link
              to={`/partners/groups/${groupId}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs - Rediseñados */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'members'
                ? 'text-purple-600 bg-purple-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="hidden sm:inline">Candidatos</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'members' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {members.length}
            </span>
            {activeTab === 'members' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-purple-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'exams'
                ? 'text-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="hidden sm:inline">Certificaciones</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'exams' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {assignedExams.length}
            </span>
            {activeTab === 'exams' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('certificates')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-4 font-medium transition-all relative ${
              activeTab === 'certificates'
                ? 'text-emerald-600 bg-emerald-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Award className="w-5 h-5" />
            <span className="hidden sm:inline">Documentos</span>
            {activeTab === 'certificates' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Estadísticas dinámicas según pestaña */}
        <div className="px-6 pt-4 pb-2">
          {activeTab === 'members' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                <Users className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-emerald-50 rounded-lg px-4 py-3">
                <Award className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-emerald-700">{members.filter(m => m.certification_status === 'certified').length}</p>
                  <p className="text-xs text-gray-500">Certificados</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-blue-700">{members.filter(m => m.certification_status === 'in_progress').length}</p>
                  <p className="text-xs text-gray-500">En proceso</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-amber-50 rounded-lg px-4 py-3">
                <HelpCircle className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold text-amber-700">{members.filter(m => !m.certification_status || m.certification_status === 'pending').length}</p>
                  <p className="text-xs text-gray-500">Pendientes</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'exams' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3">
                <ClipboardList className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-blue-700">{assignedExams.length}</p>
                  <p className="text-xs text-gray-500">Certificaciones</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-pink-50 rounded-lg px-4 py-3">
                <BookOpen className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-lg font-bold text-pink-700">{stats.materials}</p>
                  <p className="text-xs text-gray-500">Materiales</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-purple-50 rounded-lg px-4 py-3">
                <Target className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-lg font-bold text-purple-700">{assignedExams.filter(e => e.exam?.ecm).length}</p>
                  <p className="text-xs text-gray-500">Con ECM</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'certificates' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 bg-emerald-50 rounded-lg px-4 py-3">
                <Award className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold text-emerald-700">{members.filter(m => m.certification_status === 'certified').length}</p>
                  <p className="text-xs text-gray-500">Certificados</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-blue-700">{members.filter(m => m.certification_status === 'certified').length}</p>
                  <p className="text-xs text-gray-500">Certificados generables</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-amber-50 rounded-lg px-4 py-3">
                <Layers className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold text-amber-700">{assignedExams.length}</p>
                  <p className="text-xs text-gray-500">Certificaciones</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-purple-50 rounded-lg px-4 py-3">
                <Users className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-lg font-bold text-purple-700">{stats.total}</p>
                  <p className="text-xs text-gray-500">Candidatos</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contenido de Tabs */}
        <div className="p-6 pt-4">
        {/* Tab: Candidatos */}
        {activeTab === 'members' && (
          <div>
            {/* Panel de Elegibilidad del Grupo */}
            {eligibilitySummary && eligibilitySummary.warnings.length > 0 && (
              <div className="fluid-mb-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-800 mb-2">
                      Elegibilidad de Documentos
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <div className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm text-gray-700">
                          <strong className="text-emerald-700">{eligibilitySummary.fully_eligible}</strong> con datos completos
                        </span>
                      </div>
                      {eligibilitySummary.members_without_curp > 0 && (
                        <button
                          onClick={() => setEligibilityFilter('missing_curp')}
                          className="flex items-center gap-2 p-2 bg-white/60 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer text-left"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-sm text-gray-700">
                            <strong className="text-amber-700">{eligibilitySummary.members_without_curp}</strong> sin CURP
                          </span>
                        </button>
                      )}
                      {eligibilitySummary.members_without_email > 0 && (
                        <button
                          onClick={() => setEligibilityFilter('missing_email')}
                          className="flex items-center gap-2 p-2 bg-white/60 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer text-left"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-sm text-gray-700">
                            <strong className="text-amber-700">{eligibilitySummary.members_without_email}</strong> sin Email
                          </span>
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-amber-700 space-y-1">
                      {eligibilitySummary.conocer_enabled && eligibilitySummary.members_without_curp > 0 && (
                        <p>• Candidatos sin CURP no podrán recibir <strong>Certificado CONOCER</strong></p>
                      )}
                      {eligibilitySummary.badge_enabled && eligibilitySummary.members_without_email > 0 && (
                        <p>• Candidatos sin Email no podrán recibir <strong>Insignia Digital</strong></p>
                      )}
                      <p className="text-gray-600">El Certificado Eduit y Reporte de Evaluación siempre están disponibles.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Toolbar: Búsqueda, Filtros, Acciones */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4 fluid-mb-5">
              {/* Búsqueda y Filtros */}
              <div className="flex flex-col sm:flex-row fluid-gap-3 flex-1">
                {/* Barra de búsqueda */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, email o CURP..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Filtro por asignación */}
                <div className="relative">
                  <select
                    value={assignmentFilter}
                    onChange={(e) => setAssignmentFilter(e.target.value as 'all' | 'exam_and_material' | 'exam_only' | 'material_only' | 'none')}
                    className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white cursor-pointer"
                  >
                    <option value="all">Todas las asignaciones</option>
                    <option value="exam_and_material">✓ Examen y Material</option>
                    <option value="exam_only">✓ Solo Examen</option>
                    <option value="material_only">✓ Solo Material</option>
                    <option value="none">⚠ Sin asignación</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                
                {/* Filtro por elegibilidad */}
                <div className="relative">
                  <select
                    value={eligibilityFilter}
                    onChange={(e) => setEligibilityFilter(e.target.value as 'all' | 'missing_curp' | 'missing_email' | 'fully_eligible')}
                    className="appearance-none pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white cursor-pointer"
                  >
                    <option value="all">Elegibilidad</option>
                    <option value="fully_eligible">✓ Datos completos</option>
                    <option value="missing_curp">⚠ Sin CURP</option>
                    <option value="missing_email">⚠ Sin Email</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center fluid-gap-2">
                {/* Acciones masivas */}
                {selectedMembers.size > 0 && (
                  <div className="flex items-center fluid-gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200">
                    <span className="text-sm font-medium text-purple-700">
                      {selectedMembers.size} seleccionado{selectedMembers.size > 1 ? 's' : ''}
                    </span>
                    <div className="w-px h-4 bg-purple-300" />
                    <button
                      onClick={() => setSelectedMembers(new Set())}
                      className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                
                {/* Agregar candidatos */}
                <Link
                  to={group.is_active ? `/partners/groups/${groupId}/assign-candidates` : '#'}
                  onClick={(e) => !group.is_active && e.preventDefault()}
                  className={`inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 rounded-lg font-medium text-sm transition-colors ${
                    group.is_active
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-200 cursor-not-allowed text-gray-500'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar Candidatos
                </Link>
              </div>
            </div>

            {/* Indicador de filtros activos */}
            {(searchQuery || assignmentFilter !== 'all' || eligibilityFilter !== 'all') && (
              <div className="flex items-center fluid-gap-2 fluid-mb-4 text-sm">
                <span className="text-gray-500">
                  Mostrando {filteredMembers.length} de {members.length} candidatos
                </span>
                {(searchQuery || assignmentFilter !== 'all' || eligibilityFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setAssignmentFilter('all');
                      setEligibilityFilter('all');
                    }}
                    className="text-purple-600 hover:text-purple-800 font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}

            {/* Lista de miembros */}
            {members.length === 0 ? (
              <div className="text-center fluid-py-12">
                <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Aún no hay candidatos
                </h3>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                  Agrega candidatos a este grupo para poder asignarles exámenes y material de estudio
                </p>
                <Link
                  to={group.is_active ? `/partners/groups/${groupId}/assign-candidates` : '#'}
                  onClick={(e) => !group.is_active && e.preventDefault()}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    group.is_active
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-300 cursor-not-allowed text-gray-500'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                  Agregar Candidatos
                </Link>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center fluid-py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No se encontraron candidatos con los filtros aplicados</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Header de tabla con ordenamiento */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 hidden md:flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedMembers.size === filteredMembers.length && filteredMembers.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <button 
                    onClick={() => handleSort('name')}
                    className={`flex-1 flex items-center gap-1.5 hover:text-purple-600 transition-colors ${sortField === 'name' ? 'text-purple-600' : ''}`}
                  >
                    Candidato
                    <SortIcon field="name" />
                  </button>
                  <button 
                    onClick={() => handleSort('email')}
                    className={`w-40 flex items-center gap-1.5 hover:text-purple-600 transition-colors ${sortField === 'email' ? 'text-purple-600' : ''}`}
                  >
                    Email
                    <SortIcon field="email" />
                  </button>
                  <button 
                    onClick={() => handleSort('curp')}
                    className={`w-36 hidden lg:flex items-center gap-1.5 hover:text-purple-600 transition-colors ${sortField === 'curp' ? 'text-purple-600' : ''}`}
                  >
                    CURP
                    <SortIcon field="curp" />
                  </button>
                  <button 
                    onClick={() => handleSort('joined_at')}
                    className={`w-32 flex items-center gap-1.5 hover:text-purple-600 transition-colors ${sortField === 'joined_at' ? 'text-purple-600' : ''}`}
                  >
                    Fecha
                    <SortIcon field="joined_at" />
                  </button>
                  <button 
                    onClick={() => handleSort('status')}
                    className={`w-36 hidden xl:flex items-center gap-1.5 hover:text-purple-600 transition-colors ${sortField === 'status' ? 'text-purple-600' : ''}`}
                  >
                    Asignación
                    <SortIcon field="status" />
                  </button>
                  <button 
                    onClick={() => handleSort('certification')}
                    className={`w-32 hidden xl:flex items-center gap-1.5 hover:text-purple-600 transition-colors ${sortField === 'certification' ? 'text-purple-600' : ''}`}
                  >
                    Certificación
                    <SortIcon field="certification" />
                  </button>
                  <div className="w-28 hidden xl:flex items-center gap-1.5 text-center">
                    Elegibilidad
                  </div>
                  <div className="w-16 text-center">Acciones</div>
                </div>
                
                {/* Filas */}
                <div className="divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className={`flex flex-col md:flex-row md:items-center px-4 py-3 hover:bg-purple-50/50 transition-colors ${
                        selectedMembers.has(member.id) ? 'bg-purple-50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="w-10 hidden md:block">
                        <input
                          type="checkbox"
                          checked={selectedMembers.has(member.id)}
                          onChange={() => handleToggleSelect(member.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                      </div>
                      
                      {/* Info del candidato */}
                      <div className="flex-1 flex items-center fluid-gap-3 mb-2 md:mb-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {member.user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {member.user?.full_name || 'Usuario desconocido'}
                          </p>
                          <p className="text-xs text-gray-500 md:hidden truncate">
                            {member.user?.email}
                          </p>
                        </div>
                      </div>
                      
                      {/* Email (desktop) */}
                      <div className="w-40 hidden md:block">
                        <p className="text-sm text-gray-600 truncate" title={member.user?.email}>
                          {member.user?.email}
                        </p>
                      </div>
                      
                      {/* CURP (desktop lg+) */}
                      <div className="w-36 hidden lg:block">
                        <p className="text-sm text-gray-600 truncate font-mono" title={member.user?.curp}>
                          {member.user?.curp || <span className="text-gray-400">-</span>}
                        </p>
                      </div>
                      
                      {/* Fecha */}
                      <div className="w-32 hidden md:block">
                        <p className="text-sm text-gray-500">
                          {new Date(member.joined_at).toLocaleDateString('es-MX', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      
                      {/* Asignación y Acciones */}
                      <div className="flex items-center justify-between md:justify-start fluid-gap-2">
                        {/* Checkbox móvil */}
                        <input
                          type="checkbox"
                          checked={selectedMembers.has(member.id)}
                          onChange={() => handleToggleSelect(member.id)}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 md:hidden"
                        />
                        
                        {/* Estado de Asignación */}
                        <div className="w-36 hidden xl:block">
                          {member.assignment_status === 'exam_and_material' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <Layers className="w-3 h-3" />
                              Examen+Material
                            </span>
                          )}
                          {member.assignment_status === 'exam_only' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <FileText className="w-3 h-3" />
                              Examen
                            </span>
                          )}
                          {member.assignment_status === 'material_only' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <BookOpen className="w-3 h-3" />
                              Material
                            </span>
                          )}
                          {(!member.assignment_status || member.assignment_status === 'none') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              <AlertTriangle className="w-3 h-3" />
                              Sin asignar
                            </span>
                          )}
                        </div>
                        
                        {/* Estado de Certificación */}
                        <div className="w-32 hidden xl:block">
                          {member.certification_status === 'certified' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              <Award className="w-3 h-3" />
                              Certificado
                            </span>
                          )}
                          {member.certification_status === 'in_progress' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                              <Clock className="w-3 h-3" />
                              En proceso
                            </span>
                          )}
                          {member.certification_status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                              <XCircle className="w-3 h-3" />
                              No aprobado
                            </span>
                          )}
                          {(!member.certification_status || member.certification_status === 'pending') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              <HelpCircle className="w-3 h-3" />
                              Pendiente
                            </span>
                          )}
                        </div>
                        
                        {/* Elegibilidad de documentos */}
                        <div className="w-28 hidden xl:flex items-center justify-center gap-1">
                          {/* Eduit - siempre disponible */}
                          <span 
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600"
                            title="Certificado Eduit: Disponible"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                          {/* CONOCER - requiere CURP */}
                          <span 
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              member.eligibility?.can_receive_conocer || member.user?.curp
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}
                            title={member.eligibility?.can_receive_conocer || member.user?.curp
                              ? 'Certificado CONOCER: Disponible'
                              : 'Certificado CONOCER: Requiere CURP'}
                          >
                            {member.eligibility?.can_receive_conocer || member.user?.curp
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <AlertTriangle className="w-3.5 h-3.5" />}
                          </span>
                          {/* Badge - requiere email */}
                          <span 
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              member.eligibility?.can_receive_badge || member.user?.email
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}
                            title={member.eligibility?.can_receive_badge || member.user?.email
                              ? 'Insignia Digital: Disponible'
                              : 'Insignia Digital: Requiere Email'}
                          >
                            {member.eligibility?.can_receive_badge || member.user?.email
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <AlertTriangle className="w-3.5 h-3.5" />}
                          </span>
                        </div>
                        
                        {/* Botón remover del grupo */}
                        <div className="w-16 flex justify-center">
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 hover:bg-orange-100 rounded-lg text-orange-500 hover:text-orange-600 transition-colors"
                            title="Remover del grupo"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Exámenes */}
        {activeTab === 'exams' && (
          <div className="space-y-8">
            {/* Header con acciones */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Certificaciones del Grupo</h3>
                <p className="text-sm text-gray-500 mt-1">Gestiona los exámenes y materiales de estudio asignados</p>
              </div>
              <div className="flex items-center gap-2">
                {members.length === 0 ? (
                  <div className="relative group">
                    <button
                      disabled
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-gray-100 cursor-not-allowed text-gray-400"
                    >
                      <Plus className="w-4 h-4" />
                      Asignar Certificación
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Primero debes asignar candidatos
                    </div>
                  </div>
                ) : (
                  <Link
                    to={`/partners/groups/${groupId}/assign-exam`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Asignar Certificación
                  </Link>
                )}
              </div>
            </div>

            {/* Estado vacío - sin exámenes */}
            {assignedExams.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Award className="w-10 h-10 text-blue-500" />
                </div>
                {members.length === 0 ? (
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
              /* Lista de exámenes agrupados por ECM */
              <div className="space-y-6">
                {assignedExams.map((assignment) => {
                  const ecm = assignment.exam?.ecm;
                  const hasMaterials = assignment.study_materials && assignment.study_materials.length > 0;
                  
                  return (
                    <div
                      key={assignment.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      {/* Header con ECM */}
                      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
                        <div className="flex items-start gap-4">
                          {/* Logo ECM */}
                          {ecm?.logo_url ? (
                            <div className="w-16 h-16 bg-white rounded-xl p-2 flex-shrink-0 shadow-lg">
                              <img
                                src={ecm.logo_url}
                                alt={ecm.code}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden w-full h-full flex items-center justify-center">
                                <Award className="w-8 h-8 text-slate-400" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                              <Award className="w-8 h-8 text-white" />
                            </div>
                          )}
                          
                          {/* Info principal */}
                          <div className="flex-1 min-w-0">
                            {ecm?.code && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-lg tracking-wide">
                                  {ecm.code}
                                </span>
                                {ecm.brand_name && (
                                  <span className="text-slate-400 text-xs">
                                    {ecm.brand_name}
                                  </span>
                                )}
                              </div>
                            )}
                            <h4 className="text-lg font-bold text-white truncate">
                              {assignment.exam?.name || 'Examen'}
                            </h4>
                            {ecm?.name && ecm.name !== assignment.exam?.name && (
                              <p className="text-slate-300 text-sm mt-0.5 line-clamp-1">
                                {ecm.name}
                              </p>
                            )}
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Link
                              to={`/partners/groups/${groupId}/assignments/${assignment.exam_id}/edit-members?type=exam&name=${encodeURIComponent(assignment.exam?.name || 'Examen')}`}
                              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                              title="Editar candidatos"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleUnassignExam(assignment.exam_id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg text-slate-300 hover:text-red-400 transition-colors"
                              title="Desasignar examen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Configuración y stats */}
                      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Clock className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Duración</span>
                              <p className="font-semibold text-gray-900">{assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                              <Target className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Aprobar</span>
                              <p className="font-semibold text-gray-900">{assignment.passing_score || assignment.exam?.passing_score || 70}%</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                              <Layers className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Intentos</span>
                              <p className="font-semibold text-gray-900">{assignment.max_attempts || 1}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              assignment.assignment_type === 'selected' ? 'bg-purple-100' : 'bg-indigo-100'
                            }`}>
                              {assignment.assignment_type === 'selected' ? (
                                <UserPlus className="w-4 h-4 text-purple-600" />
                              ) : (
                                <Users className="w-4 h-4 text-indigo-600" />
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Asignado a</span>
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

                      {/* Materiales de estudio */}
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <BookOpen className={`w-5 h-5 ${hasMaterials ? 'text-green-600' : 'text-gray-400'}`} />
                            <span className={`font-medium ${hasMaterials ? 'text-gray-900' : 'text-gray-500'}`}>
                              Materiales de Estudio
                            </span>
                            {hasMaterials && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                {assignment.study_materials!.length}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            {hasMaterials ? (
                              <><Edit className="w-4 h-4" /> Editar</>
                            ) : (
                              <><Plus className="w-4 h-4" /> Agregar</>
                            )}
                          </button>
                        </div>
                        
                        {hasMaterials ? (
                          <div className="flex flex-wrap gap-2">
                            {assignment.study_materials!.map((material) => (
                              <div
                                key={material.id}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl text-sm"
                              >
                                <BookOpen className="w-4 h-4 text-green-600" />
                                <span className="text-gray-800 font-medium">{material.title}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            <p className="text-sm text-amber-800">
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

            {/* Sección de Materiales Independientes */}
            <div className="pt-8 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Materiales Adicionales</h3>
                    <p className="text-sm text-gray-500">Contenido de estudio independiente de certificaciones</p>
                  </div>
                </div>
                {members.length > 0 && (
                  <Link
                    to={`/partners/groups/${groupId}/assign-materials`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Asignar Material
                  </Link>
                )}
              </div>

              {directMaterials.length === 0 ? (
                <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-green-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h4 className="text-gray-600 font-medium mb-1">Sin materiales adicionales</h4>
                  <p className="text-gray-400 text-sm max-w-sm mx-auto">
                    Puedes asignar materiales de estudio sin vincularlos a una certificación
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {directMaterials.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                            {assignment.study_material?.title || 'Material'}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
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
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/partners/groups/${groupId}/assignments/${assignment.study_material_id}/edit-members?type=material&name=${encodeURIComponent(assignment.study_material?.title || 'Material')}`}
                            className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-500 transition-colors"
                            title="Editar candidatos"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleUnassignMaterial(assignment.study_material_id)}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 transition-colors"
                            title="Desasignar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Certificados */}
        {activeTab === 'certificates' && group && (
          <GroupCertificatesTab groupId={group.id} groupName={group.name} />
        )}
        </div>
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
                  {/* Vinculados al examen */}
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
                            <div>
                              <p className={`font-medium text-sm ${material.is_included ? 'text-gray-900' : 'text-gray-500'}`}>
                                {material.title}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Otros materiales */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Otros materiales disponibles
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
                Restablecer valores por defecto
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

      {/* Modal de éxito */}
      {showSuccessModal && group && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4 cursor-pointer"
          onClick={() => {
            setShowSuccessModal(false);
            searchParams.delete('created');
            setSearchParams(searchParams, { replace: true });
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-green-200 animate-[bounceIn_0.6s_ease-out] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-[scaleIn_0.4s_ease-out_0.2s_both]">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-green-800 mb-3">¡Grupo creado exitosamente!</h3>
              <p className="text-green-700 mb-8">
                El grupo <span className="font-semibold">{group.name}</span> ha sido creado.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  searchParams.delete('created');
                  setSearchParams(searchParams, { replace: true });
                }}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes scaleIn {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
