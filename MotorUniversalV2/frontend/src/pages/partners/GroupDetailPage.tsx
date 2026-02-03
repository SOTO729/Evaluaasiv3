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
  UserCheck,
  UserX,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Calendar,
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
} from '../../services/partnersService';

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
  const [activeTab, setActiveTab] = useState<'members' | 'exams'>('members');
  
  // Materiales de estudio independientes (sin examen)
  const [directMaterials, setDirectMaterials] = useState<GroupStudyMaterialAssignment[]>([]);
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'exam_and_material' | 'exam_only' | 'material_only' | 'none'>('all');
  
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
  }, [searchQuery, assignmentFilter]);

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
  }, [members, searchQuery, assignmentFilter, sortField, sortDirection]);
  
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
      {/* Header Compacto */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 fluid-mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          {/* Info del grupo */}
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/campuses/${group.campus_id}`}
              className="fluid-p-2 hover:bg-gray-100 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center fluid-gap-2 fluid-text-sm text-gray-500 mb-1">
                <Building2 className="fluid-icon-xs" />
                <Link to={`/partners/campuses/${group.campus_id}`} className="hover:text-blue-600 transition-colors">
                  {group.campus?.name}
                </Link>
              </div>
              <div className="flex items-center fluid-gap-3">
                <h1 className="fluid-text-2xl font-bold text-gray-800">
                  {group.name}
                </h1>
                {group.is_active ? (
                  <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 fluid-text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    <XCircle className="w-3 h-3" />
                    Inactivo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones rápidas */}
          <div className="flex flex-wrap items-center fluid-gap-2">
            {/* Descargar reporte */}
            {members.length > 0 && (
              <button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium fluid-text-sm transition-colors disabled:opacity-50"
              >
                {exportingExcel ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Descargar Reporte</span>
              </button>
            )}
            
            {/* Editar grupo */}
            <Link
              to={`/partners/groups/${groupId}/edit`}
              className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium fluid-text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurar</span>
            </Link>
          </div>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 fluid-gap-4 fluid-mt-5">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Candidatos</p>
                <p className="text-2xl font-bold text-purple-700">{stats.total}</p>
              </div>
              <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Activos</p>
                <p className="text-2xl font-bold text-green-700">{stats.active}</p>
              </div>
              <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Suspendidos</p>
                <p className="text-2xl font-bold text-red-700">{stats.suspended}</p>
              </div>
              <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Exámenes</p>
                <p className="text-2xl font-bold text-blue-700">{assignedExams.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Materiales</p>
                <p className="text-2xl font-bold text-amber-700">{stats.materials}</p>
              </div>
              <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-t-fluid-2xl shadow-sm border border-gray-200 border-b-0">
        <div className="flex">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-4 font-medium transition-colors relative ${
              activeTab === 'members'
                ? 'text-purple-600 bg-purple-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Candidatos</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
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
            className={`flex-1 flex items-center justify-center fluid-gap-2 fluid-px-5 fluid-py-4 font-medium transition-colors relative ${
              activeTab === 'exams'
                ? 'text-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span>Exámenes y Materiales</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
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

      {/* Contenido de Tabs */}
      <div className="bg-white rounded-b-fluid-2xl shadow-sm border border-gray-200 border-t-0 fluid-p-5">
        {/* Tab: Candidatos */}
        {activeTab === 'members' && (
          <div>
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
            {(searchQuery || assignmentFilter !== 'all') && (
              <div className="flex items-center fluid-gap-2 fluid-mb-4 text-sm">
                <span className="text-gray-500">
                  Mostrando {filteredMembers.length} de {members.length} candidatos
                </span>
                {(searchQuery || assignmentFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setAssignmentFilter('all');
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
          <div>
            {/* Toolbar de exámenes */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3 fluid-mb-5">
              <h3 className="text-lg font-semibold text-gray-800">
                Exámenes y Materiales de Estudio
              </h3>
              <div className="flex items-center fluid-gap-2">
                {members.length === 0 ? (
                  <div className="relative group">
                    <button
                      disabled
                      className="inline-flex items-center fluid-gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-gray-200 cursor-not-allowed text-gray-400"
                    >
                      <Plus className="w-4 h-4" />
                      Asignar Examen
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Primero debes asignar candidatos
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                    </div>
                  </div>
                ) : (
                  <Link
                    to={`/partners/groups/${groupId}/assign-exam`}
                    className="inline-flex items-center fluid-gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Asignar Examen
                  </Link>
                )}
              </div>
            </div>

            {/* Sección de Exámenes */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Exámenes Asignados</h3>
              </div>
              
              {assignedExams.length === 0 ? (
                <div className="text-center fluid-py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  {members.length === 0 ? (
                    <>
                      <h4 className="text-gray-600 font-medium mb-1">No hay exámenes asignados</h4>
                      <p className="text-gray-400 text-sm mb-4 max-w-sm mx-auto">
                        Primero debes asignar candidatos al grupo
                      </p>
                      <Link
                        to={`/partners/groups/${groupId}/assign-candidates`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Agregar Candidatos
                      </Link>
                    </>
                  ) : (
                    <>
                      <h4 className="text-gray-600 font-medium mb-1">No hay exámenes asignados</h4>
                      <p className="text-gray-400 text-sm mb-4">
                        Asigna un examen para que los candidatos puedan certificarse
                      </p>
                      <Link
                        to={`/partners/groups/${groupId}/assign-exam`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Asignar Examen
                      </Link>
                    </>
                  )}
                </div>
              ) : (
              <div className="flex flex-col fluid-gap-4">
                {assignedExams.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
                  >
                    {/* Header del examen */}
                    <div className="fluid-p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900">
                              {assignment.exam?.name || 'Examen'}
                            </h4>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              assignment.assignment_type === 'selected' 
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {assignment.assignment_type === 'selected' ? (
                                <><UserPlus className="h-3 w-3" />{assignment.assigned_members_count || 0} candidatos</>
                              ) : (
                                <><Users className="h-3 w-3" />Todo el grupo</>
                              )}
                            </span>
                          </div>
                          <div className="flex flex-wrap fluid-gap-3 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {assignment.time_limit_minutes || assignment.exam?.duration_minutes || 0} min
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3.5 h-3.5" />
                              Aprobar: {assignment.passing_score || assignment.exam?.passing_score || 70}%
                            </span>
                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                              {assignment.max_attempts || 1} intento(s)
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(assignment.assigned_at).toLocaleDateString('es-MX')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/partners/groups/${groupId}/assignments/${assignment.exam_id}/edit-members?type=exam&name=${encodeURIComponent(assignment.exam?.name || 'Examen')}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-blue-100 rounded-lg text-blue-600 text-xs font-medium transition-colors"
                            title="Editar candidatos asignados al examen"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Editar candidatos</span>
                          </Link>
                          <button
                            onClick={() => handleUnassignExam(assignment.exam_id)}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                            title="Desasignar examen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Materiales */}
                    <div className={`fluid-p-4 ${
                      assignment.study_materials && assignment.study_materials.length > 0 
                        ? 'bg-green-50/50' 
                        : 'bg-amber-50/50'
                    }`}>
                      {assignment.study_materials && assignment.study_materials.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">
                                {assignment.study_materials.length} material{assignment.study_materials.length > 1 ? 'es' : ''} incluido{assignment.study_materials.length > 1 ? 's' : ''}
                              </span>
                            </div>
                            <button
                              onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Modificar los materiales incluidos en este examen"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Editar materiales
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {assignment.study_materials.map((material) => (
                              <span
                                key={material.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg text-xs"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                                {material.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-600" />
                            <span className="text-sm text-amber-800">Sin materiales de estudio</span>
                          </div>
                          <button
                            onClick={() => handleOpenMaterialsModal(assignment.id, assignment.exam?.name || 'Examen')}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Agregar materiales de estudio al examen"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar materiales
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* Sección de Materiales Independientes */}
            <div className="fluid-mt-8 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3 fluid-mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Materiales de Estudio Adicionales</h3>
                    <p className="text-sm text-gray-500">Materiales asignados sin estar vinculados a un examen</p>
                  </div>
                </div>
                {members.length > 0 && (
                  <Link
                    to={`/partners/groups/${groupId}/assign-materials`}
                    className="inline-flex items-center fluid-gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Asignar Material
                  </Link>
                )}
              </div>

              {directMaterials.length === 0 ? (
                <div className="text-center fluid-py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h4 className="text-gray-600 font-medium mb-1">Sin materiales independientes</h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Puedes asignar materiales de estudio sin necesidad de un examen
                  </p>
                  {members.length > 0 && (
                    <Link
                      to={`/partners/groups/${groupId}/assign-materials`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Materiales
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {directMaterials.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-5 h-5 text-green-600 flex-shrink-0" />
                            <h4 className="font-semibold text-gray-900 truncate">
                              {assignment.study_material?.title || 'Material'}
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                              assignment.assignment_type === 'selected' 
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {assignment.assignment_type === 'selected' ? (
                                <><UserPlus className="h-3 w-3" />Específicos</>
                              ) : (
                                <><Users className="h-3 w-3" />Todo el grupo</>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(assignment.assigned_at).toLocaleDateString('es-MX')}
                            </span>
                          </div>
                          {assignment.study_material?.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                              {assignment.study_material.description}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <Link
                            to={`/partners/groups/${groupId}/assignments/${assignment.study_material_id}/edit-members?type=material&name=${encodeURIComponent(assignment.study_material?.title || 'Material')}`}
                            className="inline-flex items-center gap-1 px-2 py-1 hover:bg-blue-100 rounded-lg text-blue-500 hover:text-blue-600 text-xs font-medium transition-colors"
                            title="Editar candidatos asignados a este material"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Candidatos</span>
                          </Link>
                          <button
                            onClick={() => handleUnassignMaterial(assignment.study_material_id)}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                            title="Desasignar material"
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
