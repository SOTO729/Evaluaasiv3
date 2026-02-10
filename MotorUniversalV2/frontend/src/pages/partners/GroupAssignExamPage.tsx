/**
 * Página de Asignación de Examen a Grupo
 * Permite configurar completamente el examen antes de asignarlo:
 * - Selección del examen
 * - Configuración de tiempo, calificación mínima, reintentos
 * - Tipo de contenido (preguntas, ejercicios, mixto)
 * - Asignación a todo el grupo o candidatos específicos
 */
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Target,
  RefreshCw,
  Users,
  UserCheck,
  BookOpen,
  ClipboardList,
  FileQuestion,
  Dumbbell,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  EyeOff,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Lock,
  Hash,
  Edit3,
  Upload,
  Download,
  FileSpreadsheet,
  DollarSign,
  Wallet,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../components/PartnersBreadcrumb';
import {
  getGroup,
  getGroupMembers,
  getAvailableExams,
  assignExamToGroup,
  getExamMaterialsForAssignment,
  downloadBulkExamAssignTemplate,
  bulkAssignExamsByECM,
  BulkExamAssignResult,
  CandidateGroup,
  GroupMember,
  AvailableExam,
  ExamContentType,
  ExamAssignmentConfig,
  ExamMaterialForAssignment,
} from '../../services/partnersService';
import {
  getAssignmentCostPreview,
  CostPreviewData,
  formatCurrency,
} from '../../services/balanceService';

type Step = 'select-exam' | 'configure' | 'select-materials' | 'assign-members' | 'cost-preview';

const EXAM_CONTENT_TYPES: { value: ExamContentType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'mixed',
    label: 'Preguntas y Ejercicios',
    description: 'El examen combinará preguntas teóricas con ejercicios prácticos.',
    icon: <Layers className="fluid-icon-lg" />,
  },
  {
    value: 'questions_only',
    label: 'Solo Preguntas',
    description: 'El examen contendrá únicamente preguntas de opción múltiple, verdadero/falso, etc.',
    icon: <FileQuestion className="fluid-icon-lg" />,
  },
  {
    value: 'exercises_only',
    label: 'Solo Ejercicios',
    description: 'El examen contendrá únicamente ejercicios prácticos para resolver.',
    icon: <Dumbbell className="fluid-icon-lg" />,
  },
];

export default function GroupAssignExamPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  
  // Estado del grupo y miembros
  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado del wizard
  const [currentStep, setCurrentStep] = useState<Step>('select-exam');
  
  // Paso 1: Selección de examen
  const [availableExams, setAvailableExams] = useState<AvailableExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExam, setSelectedExam] = useState<AvailableExam | null>(null);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [examPage, setExamPage] = useState(1);
  const [examTotalPages, setExamTotalPages] = useState(1);
  const [examTotal, setExamTotal] = useState(0);
  const [examSearchQuery, setExamSearchQuery] = useState('');
  const EXAMS_PER_PAGE = 10;
  
  // Paso 2: Configuración del examen
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(null);
  const [useExamDefaultTime, setUseExamDefaultTime] = useState(true);
  const [passingScore, setPassingScore] = useState<number>(70);
  const [useExamDefaultScore, setUseExamDefaultScore] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState<number>(2);
  const [maxDisconnections, setMaxDisconnections] = useState<number>(3);
  const [examContentType, setExamContentType] = useState<ExamContentType>('mixed');
  
  // Cantidad de preguntas/ejercicios - EXAMEN
  const [examQuestionsCount, setExamQuestionsCount] = useState<number | null>(null);
  const [examExercisesCount, setExamExercisesCount] = useState<number | null>(null);
  const [useAllExamQuestions, setUseAllExamQuestions] = useState(true);
  const [useAllExamExercises, setUseAllExamExercises] = useState(true);
  
  // Cantidad de preguntas/ejercicios - SIMULADOR
  const [simulatorQuestionsCount, setSimulatorQuestionsCount] = useState<number | null>(null);
  const [simulatorExercisesCount, setSimulatorExercisesCount] = useState<number | null>(null);
  const [useAllSimulatorQuestions, setUseAllSimulatorQuestions] = useState(true);
  const [useAllSimulatorExercises, setUseAllSimulatorExercises] = useState(true);
  
  // PIN de seguridad (solo para examen)
  const [requireSecurityPin, setRequireSecurityPin] = useState(false);
  const [securityPin, setSecurityPin] = useState<string>('');
  
  // Paso 3: Selección de materiales
  const [availableMaterials, setAvailableMaterials] = useState<ExamMaterialForAssignment[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  
  // Paso 4: Asignación de miembros
  const [assignmentType, setAssignmentType] = useState<'all' | 'selected' | 'bulk'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  // Carga masiva por ECM
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkExamAssignResult | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  
  // Estado de guardado
  const [saving, setSaving] = useState(false);
  
  // Cost preview (paso 5)
  const [costPreview, setCostPreview] = useState<CostPreviewData | null>(null);
  const [loadingCostPreview, setLoadingCostPreview] = useState(false);
  
  // Modal de examen ya asignado
  const [showAlreadyAssignedModal, setShowAlreadyAssignedModal] = useState(false);
  const [attemptedExam, setAttemptedExam] = useState<AvailableExam | null>(null);

  useEffect(() => {
    loadData();
  }, [groupId]);

  // Cargar exámenes cuando cambia la página o búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      loadExams();
    }, examSearchQuery ? 300 : 0); // Debounce solo cuando hay búsqueda
    return () => clearTimeout(timer);
  }, [examPage, examSearchQuery]);

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

  // Cargar exámenes paginados
  const loadExams = async () => {
    try {
      setLoadingExams(true);
      const data = await getAvailableExams({ 
        page: examPage, 
        per_page: EXAMS_PER_PAGE,
        search: examSearchQuery || undefined,
        group_id: Number(groupId) 
      });
      setAvailableExams(data.exams);
      setExamTotalPages(data.pages);
      setExamTotal(data.total);
    } catch (err) {
      console.error('Error cargando exámenes:', err);
    } finally {
      setLoadingExams(false);
    }
  };

  // Cargar materiales del examen seleccionado
  const loadExamMaterials = async (examId: number) => {
    try {
      setLoadingMaterials(true);
      console.log('[loadExamMaterials] Cargando materiales para examen:', examId);
      const data = await getExamMaterialsForAssignment(examId);
      console.log('[loadExamMaterials] Respuesta:', data);
      console.log('[loadExamMaterials] Materiales recibidos:', data.materials?.length || 0);
      setAvailableMaterials(data.materials || []);
      // Seleccionar por defecto los materiales ligados
      const linkedIds = (data.materials || []).filter(m => m.is_linked).map(m => m.id);
      console.log('[loadExamMaterials] IDs ligados:', linkedIds);
      setSelectedMaterialIds(linkedIds);
    } catch (err) {
      console.error('[loadExamMaterials] Error cargando materiales:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Resetear página cuando cambia la búsqueda
  const handleExamSearchChange = (query: string) => {
    setExamSearchQuery(query);
    setExamPage(1); // Resetear a primera página
  };

  const handleBackToExamSelection = () => {
    setCurrentStep('select-exam');
  };

  const handleGoToMaterialSelection = () => {
    if (selectedExam) {
      loadExamMaterials(selectedExam.id);
      setCurrentStep('select-materials');
    }
  };

  const handleBackToConfiguration = () => {
    setCurrentStep('configure');
  };

  const handleGoToMemberAssignment = () => {
    setCurrentStep('assign-members');
  };

  const handleBackToMaterialSelection = () => {
    setCurrentStep('select-materials');
  };

  // Ir al paso de cost preview antes de asignar
  const handleGoToCostPreview = async () => {
    if (!selectedExam || assignmentType === 'bulk') return;
    if (assignmentType === 'selected' && selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }
    
    try {
      setLoadingCostPreview(true);
      setError(null);
      const preview = await getAssignmentCostPreview(Number(groupId), {
        assignment_type: assignmentType as 'all' | 'selected',
        member_ids: assignmentType === 'selected' ? selectedMemberIds : undefined,
      });
      setCostPreview(preview);
      setCurrentStep('cost-preview');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al calcular el desglose de costo');
    } finally {
      setLoadingCostPreview(false);
    }
  };

  const handleBackToMemberAssignment = () => {
    setCurrentStep('assign-members');
  };

  const handleToggleMaterial = (materialId: number) => {
    setSelectedMaterialIds(prev => 
      prev.includes(materialId) 
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllMembers = () => {
    if (selectedMemberIds.length === members.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(members.map(m => m.user_id));
    }
  };

  // Funciones de carga masiva
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadBulkExamAssignTemplate(Number(groupId));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_asignacion_examenes_${group?.name || groupId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al descargar la plantilla');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBulkFile(file);
      setBulkResult(null);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile || !selectedExam) return;
    
    const ecmCode = selectedExam.ecm_code || selectedExam.standard;
    if (!ecmCode) {
      setError('El examen seleccionado no tiene código ECM');
      return;
    }
    
    setBulkUploading(true);
    setBulkResult(null);
    
    try {
      const result = await bulkAssignExamsByECM(Number(groupId), bulkFile, ecmCode, {
        time_limit_minutes: useExamDefaultTime ? undefined : (timeLimitMinutes || undefined),
        passing_score: useExamDefaultScore ? undefined : passingScore,
        max_attempts: maxAttempts,
        max_disconnections: maxDisconnections,
        exam_content_type: examContentType
      });
      setBulkResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setBulkUploading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    if (!memberSearchQuery.trim()) return true;
    const query = memberSearchQuery.toLowerCase();
    const fullName = m.user?.full_name?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    const curp = m.user?.curp?.toLowerCase() || '';
    return fullName.includes(query) || email.includes(query) || curp.includes(query);
  });

  const filteredMaterials = availableMaterials.filter(m => {
    if (!materialSearchQuery.trim()) return true;
    const query = materialSearchQuery.toLowerCase();
    return m.title.toLowerCase().includes(query) || (m.description?.toLowerCase() || '').includes(query);
  });

  const handleAssignExam = async () => {
    if (!selectedExam) return;
    
    // No aplicar para carga masiva
    if (assignmentType === 'bulk') return;
    
    if (assignmentType === 'selected' && selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const config: ExamAssignmentConfig = {
        exam_id: selectedExam.id,
        assignment_type: assignmentType as 'all' | 'selected',
        member_ids: assignmentType === 'selected' ? selectedMemberIds : undefined,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        time_limit_minutes: useExamDefaultTime ? null : timeLimitMinutes,
        passing_score: useExamDefaultScore ? null : passingScore,
        max_attempts: maxAttempts,
        max_disconnections: maxDisconnections,
        exam_content_type: examContentType,
        // Configuración de cantidad - Examen
        exam_questions_count: useAllExamQuestions ? null : examQuestionsCount,
        exam_exercises_count: useAllExamExercises ? null : examExercisesCount,
        // Configuración de cantidad - Simulador
        simulator_questions_count: useAllSimulatorQuestions ? null : simulatorQuestionsCount,
        simulator_exercises_count: useAllSimulatorExercises ? null : simulatorExercisesCount,
        // PIN solo para examen
        security_pin: requireSecurityPin ? securityPin : null,
        require_security_pin: requireSecurityPin,
      };
      
      await assignExamToGroup(Number(groupId), config);
      
      // Redirigir directamente
      navigate(`/partners/groups/${groupId}`);
    } catch (err: any) {
      const errorType = err.response?.data?.error_type;
      if (errorType === 'insufficient_balance') {
        setError(`Saldo insuficiente. Necesitas ${formatCurrency(err.response?.data?.required || 0)} pero solo tienes ${formatCurrency(err.response?.data?.current_balance || 0)}.`);
        setCurrentStep('cost-preview');
      } else {
        setError(err.response?.data?.error || 'Error al asignar el examen');
      }
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando..." fullScreen />;
  }

  if (saving) {
    return <LoadingSpinner message="Asignando examen al grupo..." fullScreen />;
  }

  if (!group) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4">
          <p className="text-red-600">Grupo no encontrado</p>
        </div>
      </div>
    );
  }

  const stepIndicator = (
    <div className="flex items-center justify-center fluid-mb-6 overflow-x-auto">
      <div className="flex items-center">
        {/* Paso 1: Seleccionar Examen */}
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
            currentStep === 'select-exam' ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 
            selectedExam ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-600'
          }`}>
            {selectedExam && currentStep !== 'select-exam' ? <CheckCircle2 className="fluid-icon-base" /> : '1'}
          </div>
          <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${currentStep === 'select-exam' ? 'text-blue-600' : 'text-gray-400'}`}>Examen</span>
        </div>
        <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${selectedExam ? 'bg-green-400' : 'bg-gray-200'}`} />
        
        {/* Paso 2: Configurar */}
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
            currentStep === 'configure' ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 
            ['select-materials', 'assign-members', 'cost-preview'].includes(currentStep) ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-600'
          }`}>
            {['select-materials', 'assign-members', 'cost-preview'].includes(currentStep) ? <CheckCircle2 className="fluid-icon-base" /> : '2'}
          </div>
          <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${currentStep === 'configure' ? 'text-blue-600' : 'text-gray-400'}`}>Configurar</span>
        </div>
        <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${['select-materials', 'assign-members', 'cost-preview'].includes(currentStep) ? 'bg-green-400' : 'bg-gray-200'}`} />
        
        {/* Paso 3: Materiales */}
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
            currentStep === 'select-materials' ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 
            ['assign-members', 'cost-preview'].includes(currentStep) ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-600'
          }`}>
            {['assign-members', 'cost-preview'].includes(currentStep) ? <CheckCircle2 className="fluid-icon-base" /> : '3'}
          </div>
          <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${currentStep === 'select-materials' ? 'text-blue-600' : 'text-gray-400'}`}>Materiales</span>
        </div>
        <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${['assign-members', 'cost-preview'].includes(currentStep) ? 'bg-green-400' : 'bg-gray-200'}`} />
        
        {/* Paso 4: Asignar */}
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
            currentStep === 'assign-members' ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 
            currentStep === 'cost-preview' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 text-gray-600'
          }`}>
            {currentStep === 'cost-preview' ? <CheckCircle2 className="fluid-icon-base" /> : '4'}
          </div>
          <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${currentStep === 'assign-members' ? 'text-blue-600' : 'text-gray-400'}`}>Candidatos</span>
        </div>
        <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${currentStep === 'cost-preview' ? 'bg-green-400' : 'bg-gray-200'}`} />
        
        {/* Paso 5: Confirmar Costo */}
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
            currentStep === 'cost-preview' ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 'bg-gray-200 text-gray-600'
          }`}>
            5
          </div>
          <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${currentStep === 'cost-preview' ? 'text-blue-600' : 'text-gray-400'}`}>Confirmar</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <PartnersBreadcrumb 
        items={[
          { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
          { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
          { label: group.name, path: `/partners/groups/${groupId}` },
          { label: 'Asignar Examen' }
        ]} 
      />
      
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <Link
              to={`/partners/groups/${groupId}`}
              className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors"
            >
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div>
              <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
                <ClipboardList className="fluid-icon-sm" />
                <span>{group.name}</span>
                <span>•</span>
                <span>{group.member_count} miembros</span>
              </div>
              <h1 className="fluid-text-2xl font-bold">
                Asignar Examen y Materiales de Estudio
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 fluid-text-base">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="fluid-icon-base" />
          </button>
        </div>
      )}

      {/* Step Indicator */}
      {stepIndicator}

      {/* Paso 1: Selección de Examen */}
      {currentStep === 'select-exam' && (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <ClipboardList className="fluid-icon-base text-indigo-600" />
            Selecciona un Examen Publicado
          </h2>
          
          {/* Dropdown de exámenes */}
          <div className="relative fluid-mb-6">
            <button
              type="button"
              onClick={() => setExamDropdownOpen(!examDropdownOpen)}
              className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl text-left bg-white hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all flex items-center justify-between"
            >
              {selectedExam ? (
                <div className="flex-1">
                  <span className="font-medium text-gray-900 fluid-text-base">{selectedExam.name}</span>
                  {(selectedExam.ecm_code || selectedExam.standard) && (
                    <span className="fluid-text-sm text-blue-600 ml-2">({selectedExam.ecm_code || selectedExam.standard})</span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400 fluid-text-base">Selecciona un examen...</span>
              )}
              <ChevronRight className={`fluid-icon-base text-gray-400 transition-transform ${examDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {examDropdownOpen && (
              <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-fluid-xl shadow-lg">
                {/* Campo de búsqueda */}
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                    <input
                      type="text"
                      placeholder="Buscar examen por nombre o código ECM..."
                      value={examSearchQuery}
                      onChange={(e) => handleExamSearchChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-9 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    {examSearchQuery && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExamSearchChange('');
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="fluid-icon-sm" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de exámenes */}
                {loadingExams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="fluid-icon-lg animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500 fluid-text-sm">Cargando exámenes...</span>
                  </div>
                ) : availableExams.length > 0 ? (
                  <>
                    <div className="max-h-72 overflow-y-auto">
                      {availableExams.map((exam) => (
                        <div
                          key={exam.id}
                          onClick={() => {
                            if (exam.is_assigned_to_group) {
                              // Mostrar modal de ya asignado
                              setAttemptedExam(exam);
                              setShowAlreadyAssignedModal(true);
                              return;
                            }
                            setSelectedExam(exam);
                            setExamDropdownOpen(false);
                          }}
                          className={`fluid-p-4 border-b border-gray-100 last:border-b-0 transition-all ${
                            exam.is_assigned_to_group 
                              ? 'bg-gray-50 cursor-not-allowed opacity-70' 
                              : selectedExam?.id === exam.id 
                                ? 'bg-blue-50 border-l-4 border-l-blue-500 cursor-pointer' 
                                : 'hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center fluid-gap-2">
                                <h3 className={`font-medium fluid-text-base ${exam.is_assigned_to_group ? 'text-gray-500' : 'text-gray-900'}`}>
                                  {exam.name}
                                </h3>
                                {exam.is_assigned_to_group && (
                                  <span className="inline-flex items-center fluid-px-2 py-0.5 rounded fluid-text-xs font-medium bg-orange-100 text-orange-800">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Ya asignado
                                  </span>
                                )}
                              </div>
                              {(exam.ecm_code || exam.standard) && (
                                <p className={`fluid-text-sm mt-0.5 ${exam.is_assigned_to_group ? 'text-gray-400' : 'text-blue-600'}`}>
                                  ECM: {exam.ecm_code || exam.standard}
                                </p>
                              )}
                              <div className={`flex items-center fluid-gap-4 mt-2 fluid-text-sm ${exam.is_assigned_to_group ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span className="flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1" />
                                  {exam.duration_minutes} min
                                </span>
                                <span className="flex items-center">
                                  <Target className="w-3.5 h-3.5 mr-1" />
                                  {exam.passing_score}%
                                </span>
                                <span className="flex items-center">
                                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                                  {exam.study_materials_count} materiales
                                </span>
                              </div>
                            </div>
                            {exam.is_assigned_to_group ? (
                              <Lock className="fluid-icon-base text-orange-500 flex-shrink-0" />
                            ) : selectedExam?.id === exam.id ? (
                              <CheckCircle2 className="fluid-icon-base text-blue-600 flex-shrink-0" />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Paginación */}
                    <div className="fluid-px-4 fluid-py-3 bg-gray-50 border-t border-gray-200 rounded-b-fluid-xl">
                      <div className="flex items-center justify-between">
                        <p className="fluid-text-sm text-gray-500">
                          Mostrando {(examPage - 1) * EXAMS_PER_PAGE + 1}-{Math.min(examPage * EXAMS_PER_PAGE, examTotal)} de {examTotal} exámenes
                        </p>
                        <div className="flex items-center fluid-gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExamPage(1);
                            }}
                            disabled={examPage === 1}
                            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Primera página"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExamPage(p => Math.max(1, p - 1));
                            }}
                            disabled={examPage === 1}
                            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Página anterior"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="fluid-px-3 fluid-py-1 fluid-text-sm font-medium text-gray-700">
                            {examPage} / {examTotalPages}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExamPage(p => Math.min(examTotalPages, p + 1));
                            }}
                            disabled={examPage === examTotalPages}
                            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Página siguiente"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExamPage(examTotalPages);
                            }}
                            disabled={examPage === examTotalPages}
                            className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Última página"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto text-gray-300 fluid-mb-3" />
                    <p className="fluid-text-base">No hay exámenes publicados</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Examen seleccionado - preview */}
          {selectedExam && (
            <div className="mt-6 fluid-p-5 bg-blue-50 border border-blue-200 rounded-fluid-xl">
              <p className="fluid-text-sm text-blue-600 font-medium fluid-mb-2">Examen seleccionado:</p>
              <h3 className="font-semibold text-gray-900 fluid-text-base">{selectedExam.name}</h3>
              {(selectedExam.ecm_code || selectedExam.standard) && (
                <p className="fluid-text-sm text-gray-600 mt-1">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>
              )}
              {selectedExam.description && (
                <p className="fluid-text-sm text-gray-500 mt-2">{selectedExam.description}</p>
              )}
              <div className="flex flex-wrap items-center fluid-gap-4 mt-3 fluid-text-sm text-gray-600">
                <span className="flex items-center">
                  <Clock className="fluid-icon-sm mr-1" />
                  {selectedExam.duration_minutes} min
                </span>
                <span className="flex items-center">
                  <Target className="fluid-icon-sm mr-1" />
                  {selectedExam.passing_score}% mín
                </span>
                <span className="flex items-center text-blue-600" title="Preguntas: Examen / Simulador">
                  <FileQuestion className="fluid-icon-sm mr-1" />
                  {selectedExam.exam_questions_count || 0}/{selectedExam.simulator_questions_count || 0} preg
                </span>
                <span className="flex items-center text-purple-600" title="Ejercicios: Examen / Simulador">
                  <Dumbbell className="fluid-icon-sm mr-1" />
                  {selectedExam.exam_exercises_count || 0}/{selectedExam.simulator_exercises_count || 0} ejer
                </span>
                <span className="flex items-center">
                  <BookOpen className="fluid-icon-sm mr-1" />
                  {selectedExam.study_materials_count} mat
                </span>
              </div>
            </div>
          )}

          {/* Botón continuar */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                if (selectedExam) {
                  // Prellenar valores por defecto del examen
                  if (selectedExam.duration_minutes) {
                    setTimeLimitMinutes(selectedExam.duration_minutes);
                  }
                  if (selectedExam.passing_score) {
                    setPassingScore(selectedExam.passing_score);
                  }
                  setCurrentStep('configure');
                }
              }}
              disabled={!selectedExam}
              className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 shadow-lg transition-all fluid-text-sm"
            >
              Continuar
              <ChevronRight className="fluid-icon-base" />
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: Configuración del Examen */}
      {currentStep === 'configure' && selectedExam && (
        <div className="space-y-6">
          {/* Examen seleccionado */}
          <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="fluid-text-sm text-blue-600 font-medium">Examen seleccionado</p>
                <h3 className="font-semibold text-gray-900 mt-1 fluid-text-base">{selectedExam.name}</h3>
                {(selectedExam.ecm_code || selectedExam.standard) && (
                  <p className="fluid-text-sm text-gray-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>
                )}
              </div>
              <button
                onClick={handleBackToExamSelection}
                className="text-blue-600 hover:text-blue-800 fluid-text-sm font-medium"
              >
                Cambiar
              </button>
            </div>
          </div>

          {/* Configuración */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-6">
              Configuración del Examen
            </h2>

            {/* Tipo de contenido */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-3">
                Tipo de Contenido
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4">
                {EXAM_CONTENT_TYPES.map((type) => (
                  <div
                    key={type.value}
                    onClick={() => setExamContentType(type.value)}
                    className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${
                      examContentType === type.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className={`fluid-mb-2 ${examContentType === type.value ? 'text-blue-600' : 'text-gray-400'}`}>
                      {type.icon}
                    </div>
                    <h4 className="font-medium text-gray-900 fluid-text-base">{type.label}</h4>
                    <p className="fluid-text-xs text-gray-500 mt-1">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tiempo límite */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Clock className="fluid-icon-sm inline mr-1" />
                Tiempo Límite
              </label>
              <div className="flex items-center fluid-gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useExamDefaultTime}
                    onChange={(e) => setUseExamDefaultTime(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 fluid-text-sm text-gray-600">
                    Usar tiempo del examen ({selectedExam.duration_minutes} min)
                  </span>
                </label>
              </div>
              {!useExamDefaultTime && (
                <div className="mt-3 flex items-center fluid-gap-2">
                  <input
                    type="number"
                    value={timeLimitMinutes || ''}
                    onChange={(e) => setTimeLimitMinutes(e.target.value ? Number(e.target.value) : null)}
                    min={1}
                    max={480}
                    className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Min"
                  />
                  <span className="text-gray-500 fluid-text-sm">minutos</span>
                </div>
              )}
            </div>

            {/* Calificación mínima */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <Target className="fluid-icon-sm inline mr-1" />
                Calificación Mínima para Aprobar
              </label>
              <div className="flex items-center fluid-gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useExamDefaultScore}
                    onChange={(e) => setUseExamDefaultScore(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 fluid-text-sm text-gray-600">
                    Usar calificación del examen ({selectedExam.passing_score}%)
                  </span>
                </label>
              </div>
              {!useExamDefaultScore && (
                <div className="mt-3 flex items-center fluid-gap-2">
                  <input
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500 fluid-text-sm">%</span>
                </div>
              )}
            </div>

            {/* Reintentos */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <RefreshCw className="fluid-icon-sm inline mr-1" />
                Número de Reintentos Permitidos
              </label>
              <div className="flex items-center fluid-gap-2">
                <input
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={10}
                  className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500 fluid-text-sm">intento(s)</span>
              </div>
              <p className="fluid-text-xs text-gray-500 mt-1">
                El candidato podrá realizar el examen hasta este número de veces
              </p>
            </div>

            {/* Desconexiones */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                <EyeOff className="fluid-icon-sm inline mr-1" />
                Oportunidades de Desconexión
              </label>
              <div className="flex items-center fluid-gap-2">
                <input
                  type="number"
                  value={maxDisconnections}
                  onChange={(e) => setMaxDisconnections(Math.max(0, Number(e.target.value)))}
                  min={0}
                  max={10}
                  className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500 fluid-text-sm">oportunidades</span>
              </div>
              <p className="fluid-text-xs text-gray-500 mt-1">
                Veces que el candidato puede salir de pantalla o desconectarse antes de invalidar el examen
              </p>
            </div>

            {/* Separador - Cantidad de contenido */}
            <div className="border-t pt-6 fluid-mb-6">
              <h3 className="fluid-text-base font-medium text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
                <Hash className="fluid-icon-base text-purple-500" />
                Cantidad de Contenido
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mb-4">
                Define cuántas preguntas y/o ejercicios incluir para cada modo. La configuración general (tiempo, puntaje, reintentos) aplica para ambos.
              </p>
              
              {/* Sección EXAMEN - Solo si hay contenido de examen */}
              {((selectedExam.exam_questions_count || 0) > 0 || (selectedExam.exam_exercises_count || 0) > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                  <h4 className="font-medium text-blue-800 fluid-mb-3 flex items-center fluid-gap-2">
                    <FileQuestion className="fluid-icon-sm" />
                    Examen
                  </h4>
                  
                  {/* Preguntas de Examen */}
                  {(examContentType === 'mixed' || examContentType === 'questions_only') && (selectedExam.exam_questions_count || 0) > 0 && (
                    <div className="fluid-mb-3">
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Preguntas
                        <span className="text-gray-400 font-normal ml-2">
                          (Disponibles: {selectedExam.exam_questions_count})
                        </span>
                      </label>
                      <div className="flex items-center fluid-gap-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={useAllExamQuestions}
                            onChange={(e) => {
                              setUseAllExamQuestions(e.target.checked);
                              if (e.target.checked) {
                                setExamQuestionsCount(null);
                              } else {
                                setExamQuestionsCount(selectedExam.exam_questions_count || 0);
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 fluid-text-sm text-gray-600">
                            Usar todas ({selectedExam.exam_questions_count})
                          </span>
                        </label>
                      </div>
                      {!useAllExamQuestions && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input
                            type="number"
                            value={examQuestionsCount || ''}
                            onChange={(e) => setExamQuestionsCount(e.target.value ? Number(e.target.value) : null)}
                            min={1}
                            max={selectedExam.exam_questions_count || 0}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 fluid-text-sm"
                          />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.exam_questions_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Ejercicios de Examen */}
                  {(examContentType === 'mixed' || examContentType === 'exercises_only') && (selectedExam.exam_exercises_count || 0) > 0 && (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Ejercicios
                        <span className="text-gray-400 font-normal ml-2">
                          (Disponibles: {selectedExam.exam_exercises_count})
                        </span>
                      </label>
                      <div className="flex items-center fluid-gap-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={useAllExamExercises}
                            onChange={(e) => {
                              setUseAllExamExercises(e.target.checked);
                              if (e.target.checked) {
                                setExamExercisesCount(null);
                              } else {
                                setExamExercisesCount(selectedExam.exam_exercises_count || 0);
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 fluid-text-sm text-gray-600">
                            Usar todos ({selectedExam.exam_exercises_count})
                          </span>
                        </label>
                      </div>
                      {!useAllExamExercises && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input
                            type="number"
                            value={examExercisesCount || ''}
                            onChange={(e) => setExamExercisesCount(e.target.value ? Number(e.target.value) : null)}
                            min={1}
                            max={selectedExam.exam_exercises_count || 0}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 fluid-text-sm"
                          />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.exam_exercises_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Sección SIMULADOR - Solo si hay contenido de simulador */}
              {((selectedExam.simulator_questions_count || 0) > 0 || (selectedExam.simulator_exercises_count || 0) > 0) && (
                <div className="bg-purple-50 border border-purple-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                  <h4 className="font-medium text-purple-800 fluid-mb-3 flex items-center fluid-gap-2">
                    <Layers className="fluid-icon-sm" />
                    Simulador
                  </h4>
                  
                  {/* Preguntas de Simulador */}
                  {(examContentType === 'mixed' || examContentType === 'questions_only') && (selectedExam.simulator_questions_count || 0) > 0 && (
                    <div className="fluid-mb-3">
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Preguntas
                        <span className="text-gray-400 font-normal ml-2">
                          (Disponibles: {selectedExam.simulator_questions_count})
                        </span>
                      </label>
                      <div className="flex items-center fluid-gap-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={useAllSimulatorQuestions}
                            onChange={(e) => {
                              setUseAllSimulatorQuestions(e.target.checked);
                              if (e.target.checked) {
                                setSimulatorQuestionsCount(null);
                              } else {
                                setSimulatorQuestionsCount(selectedExam.simulator_questions_count || 0);
                              }
                            }}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 fluid-text-sm text-gray-600">
                            Usar todas ({selectedExam.simulator_questions_count})
                          </span>
                        </label>
                      </div>
                      {!useAllSimulatorQuestions && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input
                            type="number"
                            value={simulatorQuestionsCount || ''}
                            onChange={(e) => setSimulatorQuestionsCount(e.target.value ? Number(e.target.value) : null)}
                            min={1}
                            max={selectedExam.simulator_questions_count || 0}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 fluid-text-sm"
                          />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.simulator_questions_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Ejercicios de Simulador */}
                  {(examContentType === 'mixed' || examContentType === 'exercises_only') && (selectedExam.simulator_exercises_count || 0) > 0 && (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Ejercicios
                        <span className="text-gray-400 font-normal ml-2">
                          (Disponibles: {selectedExam.simulator_exercises_count})
                        </span>
                      </label>
                      <div className="flex items-center fluid-gap-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={useAllSimulatorExercises}
                            onChange={(e) => {
                              setUseAllSimulatorExercises(e.target.checked);
                              if (e.target.checked) {
                                setSimulatorExercisesCount(null);
                              } else {
                                setSimulatorExercisesCount(selectedExam.simulator_exercises_count || 0);
                              }
                            }}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="ml-2 fluid-text-sm text-gray-600">
                            Usar todos ({selectedExam.simulator_exercises_count})
                          </span>
                        </label>
                      </div>
                      {!useAllSimulatorExercises && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input
                            type="number"
                            value={simulatorExercisesCount || ''}
                            onChange={(e) => setSimulatorExercisesCount(e.target.value ? Number(e.target.value) : null)}
                            min={1}
                            max={selectedExam.simulator_exercises_count || 0}
                            className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 fluid-text-sm"
                          />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.simulator_exercises_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Mensaje si no hay contenido */}
              {(selectedExam.exam_questions_count || 0) === 0 && 
               (selectedExam.exam_exercises_count || 0) === 0 && 
               (selectedExam.simulator_questions_count || 0) === 0 && 
               (selectedExam.simulator_exercises_count || 0) === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-fluid-xl fluid-p-4">
                  <p className="text-yellow-700 fluid-text-sm">
                    Este examen no tiene contenido de preguntas ni ejercicios configurado.
                  </p>
                </div>
              )}
            </div>

            {/* Separador - PIN de Seguridad (solo para examen) */}
            {((selectedExam.exam_questions_count || 0) > 0 || (selectedExam.exam_exercises_count || 0) > 0) && (
            <div className="border-t pt-6 fluid-mb-6">
              <h3 className="fluid-text-base font-medium text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
                <Lock className="fluid-icon-base text-red-500" />
                PIN de Seguridad
                <span className="fluid-text-xs font-normal text-gray-400">(solo para Examen)</span>
              </h3>
              <p className="fluid-text-sm text-gray-500 fluid-mb-4">
                Si se activa, el candidato deberá introducir un PIN para poder iniciar el examen.
              </p>
              
              <div className="flex items-center fluid-gap-4 fluid-mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={requireSecurityPin}
                    onChange={(e) => {
                      setRequireSecurityPin(e.target.checked);
                      if (!e.target.checked) {
                        setSecurityPin('');
                      }
                    }}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-2 fluid-text-sm text-gray-600">
                    Requerir PIN de seguridad para iniciar el examen
                  </span>
                </label>
              </div>
              
              {requireSecurityPin && (
                <div className="flex items-center fluid-gap-2">
                  <input
                    type="text"
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    maxLength={6}
                    placeholder="Ej: 1234"
                    className="w-32 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-red-500 text-center fluid-text-lg tracking-widest font-mono"
                  />
                  <span className="text-gray-500 fluid-text-sm">PIN de 4-6 dígitos</span>
                </div>
              )}
            </div>
            )}

            {/* Botones de navegación */}
            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={handleBackToExamSelection}
                className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={handleGoToMaterialSelection}
                className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all"
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 3: Selección de Materiales */}
      {currentStep === 'select-materials' && selectedExam && (
        <div className="space-y-6">
          {/* Resumen del examen */}
          <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="fluid-text-sm text-blue-600 font-medium">Examen seleccionado</p>
                <h3 className="font-semibold text-gray-900 mt-1 fluid-text-base">{selectedExam.name}</h3>
                {(selectedExam.ecm_code || selectedExam.standard) && (
                  <p className="fluid-text-sm text-gray-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>
                )}
              </div>
            </div>
          </div>

          {/* Materiales */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <div className="flex items-center justify-between fluid-mb-4">
              <h2 className="fluid-text-lg font-semibold text-gray-900 flex items-center fluid-gap-2">
                <BookOpen className="fluid-icon-base text-indigo-600" />
                Selecciona los Materiales de Estudio
              </h2>
              <span className="fluid-text-sm text-gray-500">
                {selectedMaterialIds.length} seleccionado(s)
              </span>
            </div>

            <p className="fluid-text-sm text-gray-500 fluid-mb-4">
              Los materiales ligados al examen se seleccionan automáticamente. Puedes agregar o quitar materiales según necesites.
            </p>

            {/* Buscador de materiales */}
            <div className="relative fluid-mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {loadingMaterials ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="fluid-icon-lg animate-spin text-blue-600" />
                <span className="ml-2 text-gray-500 fluid-text-sm">Cargando materiales...</span>
              </div>
            ) : filteredMaterials.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredMaterials.map((material) => (
                  <div
                    key={material.id}
                    onClick={() => handleToggleMaterial(material.id)}
                    className={`fluid-p-4 border rounded-fluid-xl cursor-pointer transition-all ${
                      selectedMaterialIds.includes(material.id)
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start fluid-gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        selectedMaterialIds.includes(material.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedMaterialIds.includes(material.id) && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center fluid-gap-2">
                          <h3 className="font-medium text-gray-900 fluid-text-base">{material.title}</h3>
                          {material.is_linked && (
                            <span className="fluid-px-2 py-0.5 fluid-text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              Ligado al examen
                            </span>
                          )}
                        </div>
                        {material.description && (
                          <p className="fluid-text-sm text-gray-500 mt-1 line-clamp-2">{material.description}</p>
                        )}
                        <div className="flex items-center fluid-gap-4 mt-2 fluid-text-xs text-gray-400">
                          <span>{material.sessions_count} sesiones</span>
                          <span>{material.topics_count} temas</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 fluid-mb-3" />
                <p className="fluid-text-base">No hay materiales de estudio disponibles</p>
              </div>
            )}

            {/* Botones de navegación */}
            <div className="flex justify-between pt-4 border-t mt-6">
              <button
                onClick={handleBackToConfiguration}
                className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={handleGoToMemberAssignment}
                className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all"
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 4: Asignación de Miembros */}
      {currentStep === 'assign-members' && selectedExam && (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="bg-gray-50 border border-gray-200 rounded-fluid-xl fluid-p-5">
            <div className="flex items-center justify-between flex-wrap fluid-gap-2">
              <div>
                <p className="fluid-text-sm text-gray-500">Examen</p>
                <p className="font-medium fluid-text-base">{selectedExam.name}</p>
              </div>
              <div className="text-center fluid-text-sm">
                <p className="text-gray-500">Materiales</p>
                <p className="font-medium text-blue-600">{selectedMaterialIds.length} seleccionados</p>
              </div>
              <div className="text-right fluid-text-sm text-gray-500">
                <p>{examContentType === 'questions_only' ? 'Solo preguntas' : 
                   examContentType === 'exercises_only' ? 'Solo ejercicios' : 'Mixto'}</p>
                <p>{maxAttempts} intento(s) • {maxDisconnections} desconexiones</p>
              </div>
            </div>
          </div>

          {/* Tipo de asignación */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4">
              ¿A quién asignar el examen?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
              <div
                onClick={() => setAssignmentType('all')}
                className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${
                  assignmentType === 'all'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center fluid-gap-3">
                  <Users className={`fluid-icon-lg ${assignmentType === 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div>
                    <h4 className="font-medium text-gray-900 fluid-text-base">Todo el Grupo</h4>
                    <p className="fluid-text-sm text-gray-500">
                      Asignar a los {members.length} miembros
                    </p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setAssignmentType('selected')}
                className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${
                  assignmentType === 'selected'
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center fluid-gap-3">
                  <UserCheck className={`fluid-icon-lg ${assignmentType === 'selected' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div>
                    <h4 className="font-medium text-gray-900 fluid-text-base">Candidatos Específicos</h4>
                    <p className="fluid-text-sm text-gray-500">
                      Seleccionar manualmente
                    </p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setAssignmentType('bulk')}
                className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${
                  assignmentType === 'bulk'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center fluid-gap-3">
                  <FileSpreadsheet className={`fluid-icon-lg ${assignmentType === 'bulk' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <h4 className="font-medium text-gray-900 fluid-text-base">Carga Masiva</h4>
                    <p className="fluid-text-sm text-gray-500">
                      Asignar por código ECM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selección de miembros */}
            {assignmentType === 'selected' && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between fluid-mb-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, email o CURP..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSelectAllMembers}
                    className="ml-4 fluid-text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectedMemberIds.length === members.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-fluid-xl">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => handleToggleMember(member.user_id)}
                        className={`fluid-p-3 flex items-center fluid-gap-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          selectedMemberIds.includes(member.user_id) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selectedMemberIds.includes(member.user_id)
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {selectedMemberIds.includes(member.user_id) && (
                            <CheckCircle2 className="fluid-icon-sm" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium fluid-text-sm">{member.user?.full_name}</p>
                          <p className="fluid-text-xs text-gray-500">{member.user?.email}</p>
                          {member.user?.curp && (
                            <p className="fluid-text-xs text-gray-400 font-mono">{member.user.curp}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="fluid-p-4 text-center text-gray-500 fluid-text-sm">
                      No se encontraron miembros
                    </div>
                  )}
                </div>

                {selectedMemberIds.length > 0 && (
                  <p className="mt-2 fluid-text-sm text-purple-600">
                    {selectedMemberIds.length} candidato(s) seleccionado(s)
                  </p>
                )}
              </div>
            )}

            {/* Carga masiva por ECM */}
            {assignmentType === 'bulk' && (
              <div className="border-t pt-4">
                <div className="bg-green-50 border border-green-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                  <h4 className="font-medium text-green-800 fluid-mb-2 flex items-center fluid-gap-2">
                    <FileSpreadsheet className="fluid-icon-base" />
                    Asignación Masiva por Código ECM
                  </h4>
                  <p className="fluid-text-sm text-green-700">
                    Con esta opción puedes asignar diferentes exámenes a diferentes candidatos 
                    usando un archivo Excel. Cada candidato puede tener un código ECM distinto.
                  </p>
                </div>

                {/* Paso 1: Descargar plantilla */}
                <div className="fluid-mb-4">
                  <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">1. Descarga la plantilla</h5>
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                    className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white border border-green-600 text-green-600 rounded-fluid-xl hover:bg-green-50 disabled:opacity-50 transition-all fluid-text-sm"
                  >
                    {downloadingTemplate ? (
                      <>
                        <Loader2 className="fluid-icon-sm animate-spin" />
                        Descargando...
                      </>
                    ) : (
                      <>
                        <Download className="fluid-icon-sm" />
                        Descargar Plantilla Excel
                      </>
                    )}
                  </button>
                  <p className="fluid-text-xs text-gray-500 mt-1">
                    La plantilla incluye los miembros del grupo y un catálogo de códigos ECM disponibles.
                  </p>
                </div>

                {/* Paso 2: Subir archivo */}
                <div className="fluid-mb-4">
                  <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">2. Completa y sube el archivo</h5>
                  <div className="flex items-center fluid-gap-4">
                    <label className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-green-600 text-white rounded-fluid-xl hover:bg-green-700 cursor-pointer transition-all fluid-text-sm">
                      <Upload className="fluid-icon-sm" />
                      Seleccionar Archivo
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleBulkFileChange}
                        className="hidden"
                      />
                    </label>
                    {bulkFile && (
                      <span className="fluid-text-sm text-gray-600">
                        {bulkFile.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Paso 3: Procesar */}
                {bulkFile && !bulkResult && (
                  <div className="fluid-mb-4">
                    <h5 className="font-medium text-gray-700 fluid-mb-2 fluid-text-base">3. Procesar asignaciones</h5>
                    <button
                      onClick={handleBulkUpload}
                      disabled={bulkUploading}
                      className="flex items-center fluid-gap-2 fluid-px-6 fluid-py-2 bg-green-600 text-white rounded-fluid-xl hover:bg-green-700 disabled:opacity-50 transition-all fluid-text-sm shadow-lg"
                    >
                      {bulkUploading ? (
                        <>
                          <Loader2 className="fluid-icon-sm animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="fluid-icon-sm" />
                          Procesar Asignaciones
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Resultados */}
                {bulkResult && (
                  <div className="mt-4 space-y-3">
                    <div className={`fluid-p-4 rounded-fluid-xl ${bulkResult.summary.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                      <h5 className={`font-medium fluid-mb-2 fluid-text-base ${bulkResult.summary.errors > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                        {bulkResult.message}
                      </h5>
                      <div className="grid grid-cols-4 fluid-gap-4 fluid-text-sm">
                        <div>
                          <p className="text-gray-500">Procesados</p>
                          <p className="font-semibold fluid-text-lg">{bulkResult.summary.total_processed}</p>
                        </div>
                        <div>
                          <p className="text-green-600">Asignados</p>
                          <p className="font-semibold fluid-text-lg text-green-700">{bulkResult.summary.assigned}</p>
                        </div>
                        <div>
                          <p className="text-yellow-600">Omitidos</p>
                          <p className="font-semibold fluid-text-lg text-yellow-700">{bulkResult.summary.skipped}</p>
                        </div>
                        <div>
                          <p className="text-red-600">Errores</p>
                          <p className="font-semibold fluid-text-lg text-red-700">{bulkResult.summary.errors}</p>
                        </div>
                      </div>
                    </div>

                    {/* Detalles de asignados */}
                    {bulkResult.results.assigned.length > 0 && (
                      <details className="bg-green-50 rounded-fluid-xl p-2">
                        <summary className="cursor-pointer fluid-text-sm text-green-700 font-medium px-2">
                          Ver asignaciones exitosas ({bulkResult.results.assigned.length})
                        </summary>
                        <div className="max-h-40 overflow-y-auto mt-2">
                          {bulkResult.results.assigned.map((item, i) => (
                            <div key={i} className="fluid-text-xs px-2 py-1 border-b border-green-100 last:border-0">
                              <span className="text-gray-500">Fila {item.row}:</span> {item.ecm} → {item.exam_name}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Detalles de errores */}
                    {bulkResult.results.errors.length > 0 && (
                      <details className="bg-red-50 rounded-fluid-xl p-2">
                        <summary className="cursor-pointer fluid-text-sm text-red-700 font-medium px-2">
                          Ver errores ({bulkResult.results.errors.length})
                        </summary>
                        <div className="max-h-40 overflow-y-auto mt-2">
                          {bulkResult.results.errors.map((item, i) => (
                            <div key={i} className="fluid-text-xs px-2 py-1 border-b border-red-100 last:border-0">
                              <span className="text-gray-500">Fila {item.row}:</span> {item.ecm} - <span className="text-red-600">{item.error}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Botón para volver al grupo */}
                    {bulkResult.summary.assigned > 0 && (
                      <div className="flex justify-center mt-4">
                        <Link
                          to={`/partners/groups/${groupId}`}
                          className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all"
                        >
                          Volver al Detalle del Grupo
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-between pt-6 mt-6 border-t">
              <button
                onClick={handleBackToMaterialSelection}
                className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors"
              >
                ← Volver
              </button>
              {assignmentType !== 'bulk' && (
                <button
                  onClick={handleGoToCostPreview}
                  disabled={loadingCostPreview || (assignmentType === 'selected' && selectedMemberIds.length === 0)}
                  className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 fluid-text-sm font-medium shadow-lg transition-all"
                >
                  {loadingCostPreview ? (
                    <>
                      <Loader2 className="fluid-icon-sm animate-spin" />
                      Calculando costo...
                    </>
                  ) : (
                    <>
                      <DollarSign className="fluid-icon-sm" />
                      Revisar Costo y Confirmar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== PASO 5: DESGLOSE DE COSTO Y CONFIRMACIÓN ===== */}
      {currentStep === 'cost-preview' && selectedExam && costPreview && (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <div className="flex items-center fluid-gap-3 fluid-mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-fluid-xl flex items-center justify-center">
              <Wallet className="fluid-icon-base text-emerald-600" />
            </div>
            <div>
              <h2 className="fluid-text-lg font-semibold text-gray-900">Desglose de Costo</h2>
              <p className="fluid-text-sm text-gray-500">Revisa el consumo de saldo antes de confirmar la asignación</p>
            </div>
          </div>

          {/* Resumen del examen */}
          <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 fluid-mb-6">
            <h3 className="fluid-text-sm font-medium text-gray-500 fluid-mb-2">Resumen de la asignación</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 fluid-gap-4">
              <div>
                <p className="fluid-text-xs text-gray-400">Examen</p>
                <p className="font-medium text-gray-900 fluid-text-base">{selectedExam.name}</p>
                {(selectedExam.ecm_code || selectedExam.standard) && (
                  <p className="fluid-text-xs text-blue-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>
                )}
              </div>
              <div>
                <p className="fluid-text-xs text-gray-400">Grupo</p>
                <p className="font-medium text-gray-900 fluid-text-base">{costPreview.group_name}</p>
                <p className="fluid-text-xs text-gray-500">{costPreview.campus_name}</p>
              </div>
              <div>
                <p className="fluid-text-xs text-gray-400">Tipo de asignación</p>
                <p className="font-medium text-gray-900 fluid-text-base">
                  {assignmentType === 'all' ? 'Todo el grupo' : `${selectedMemberIds.length} candidato(s) seleccionado(s)`}
                </p>
              </div>
            </div>
          </div>

          {/* Desglose de costo - Estilo factura */}
          <div className="border border-gray-200 rounded-fluid-xl overflow-hidden fluid-mb-6">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Concepto</th>
                  <th className="text-center py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Unidades</th>
                  <th className="text-right py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Precio unitario</th>
                  <th className="text-right py-3 px-4 fluid-text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900 fluid-text-base">Certificación</p>
                    <p className="fluid-text-xs text-gray-500">Origen del costo: {costPreview.cost_source}</p>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center fluid-gap-1 text-gray-900 font-medium fluid-text-base">
                      <Users className="fluid-icon-sm text-gray-400" />
                      {costPreview.units}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900 fluid-text-base">
                    {formatCurrency(costPreview.unit_cost)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900 fluid-text-base">
                    {formatCurrency(costPreview.total_cost)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="py-3 px-4 text-right font-semibold text-gray-700 fluid-text-base">
                    Total a descontar
                  </td>
                  <td className="py-3 px-4 text-right font-bold fluid-text-lg text-gray-900">
                    {formatCurrency(costPreview.total_cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Estado del saldo - Estilo bancario */}
          <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4 fluid-mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-4">
              <div className="flex items-center fluid-gap-2 mb-1">
                <Wallet className="fluid-icon-sm text-blue-500" />
                <p className="fluid-text-xs font-medium text-blue-600">Saldo actual</p>
              </div>
              <p className="fluid-text-2xl font-bold text-blue-700">{formatCurrency(costPreview.current_balance)}</p>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-fluid-xl fluid-p-4">
              <div className="flex items-center fluid-gap-2 mb-1">
                <TrendingDown className="fluid-icon-sm text-orange-500" />
                <p className="fluid-text-xs font-medium text-orange-600">Descuento</p>
              </div>
              <p className="fluid-text-2xl font-bold text-orange-700">- {formatCurrency(costPreview.total_cost)}</p>
            </div>
            
            <div className={`border rounded-fluid-xl fluid-p-4 ${
              costPreview.has_sufficient_balance 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center fluid-gap-2 mb-1">
                {costPreview.has_sufficient_balance 
                  ? <ShieldCheck className="fluid-icon-sm text-green-500" />
                  : <ShieldAlert className="fluid-icon-sm text-red-500" />
                }
                <p className={`fluid-text-xs font-medium ${
                  costPreview.has_sufficient_balance ? 'text-green-600' : 'text-red-600'
                }`}>
                  Saldo restante
                </p>
              </div>
              <p className={`fluid-text-2xl font-bold ${
                costPreview.has_sufficient_balance ? 'text-green-700' : 'text-red-700'
              }`}>
                {formatCurrency(costPreview.remaining_balance)}
              </p>
            </div>
          </div>

          {/* Alerta si no hay saldo suficiente */}
          {!costPreview.has_sufficient_balance && (
            <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
              <ShieldAlert className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 fluid-text-base">Saldo insuficiente</p>
                <p className="fluid-text-sm text-red-600 mt-1">
                  Necesitas <strong>{formatCurrency(costPreview.total_cost)}</strong> pero tu saldo actual es de{' '}
                  <strong>{formatCurrency(costPreview.current_balance)}</strong>. 
                  Te faltan <strong>{formatCurrency(Math.abs(costPreview.remaining_balance))}</strong> para completar esta asignación.
                </p>
                <Link
                  to="/solicitar-saldo"
                  className="inline-flex items-center fluid-gap-1 fluid-text-sm text-red-700 hover:text-red-900 font-medium mt-2 underline"
                >
                  Solicitar más saldo →
                </Link>
              </div>
            </div>
          )}

          {/* Alerta si el costo es $0 */}
          {costPreview.total_cost === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3">
              <AlertCircle className="fluid-icon-base text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700 fluid-text-base">Sin costo configurado</p>
                <p className="fluid-text-sm text-yellow-600 mt-1">
                  No se ha definido un costo de certificación para este grupo ni su campus.
                  La asignación se realizará sin consumir saldo.
                </p>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between pt-6 mt-2 border-t">
            <button
              onClick={handleBackToMemberAssignment}
              className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={handleAssignExam}
              disabled={saving || (!costPreview.has_sufficient_balance && costPreview.total_cost > 0)}
              className="fluid-px-6 fluid-py-3 bg-green-600 text-white rounded-fluid-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 font-medium shadow-lg transition-all fluid-text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="fluid-icon-base animate-spin" />
                  Asignando y descontando saldo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="fluid-icon-base" />
                  {costPreview.total_cost > 0 
                    ? `Confirmar Asignación (${formatCurrency(costPreview.total_cost)})` 
                    : 'Confirmar Asignación'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Examen ya asignado */}
      {showAlreadyAssignedModal && attemptedExam && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4 animate-fade-in"
          onClick={() => setShowAlreadyAssignedModal(false)}
        >
          <div 
            className="bg-white rounded-fluid-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 fluid-p-5 text-white">
              <div className="flex items-center fluid-gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                  <Lock className="fluid-icon-lg" />
                </div>
                <div>
                  <h3 className="fluid-text-lg font-bold">Examen ya asignado</h3>
                  <p className="text-orange-100 fluid-text-sm">Este examen ya pertenece al grupo</p>
                </div>
              </div>
            </div>
            
            {/* Contenido */}
            <div className="fluid-p-5">
              <div className="flex items-start fluid-gap-3 fluid-mb-4">
                <AlertCircle className="fluid-icon-lg text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-700 font-medium fluid-text-base">
                    El examen <span className="text-orange-600">"{attemptedExam.name}"</span> ya está asignado a este grupo.
                  </p>
                  <p className="text-gray-500 fluid-text-sm mt-2">
                    Si deseas modificar los candidatos asignados a este examen, 
                    puedes hacerlo con el botón de editar candidatos.
                  </p>
                </div>
              </div>
              
              {/* Info del examen */}
              <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <p className="fluid-text-sm font-medium text-gray-700 fluid-mb-2">Detalles del examen:</p>
                <div className="flex items-center fluid-gap-4 fluid-text-sm text-gray-600">
                  <span className="flex items-center">
                    <Clock className="fluid-icon-sm mr-1 text-gray-400" />
                    {attemptedExam.duration_minutes} min
                  </span>
                  <span className="flex items-center">
                    <Target className="fluid-icon-sm mr-1 text-gray-400" />
                    {attemptedExam.passing_score}%
                  </span>
                  {(attemptedExam.ecm_code || attemptedExam.standard) && (
                    <span className="text-blue-600">
                      ECM: {attemptedExam.ecm_code || attemptedExam.standard}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer con botones de acción */}
            <div className="bg-gray-50 fluid-px-5 fluid-py-3 flex flex-wrap justify-end fluid-gap-3">
              <button
                onClick={() => setShowAlreadyAssignedModal(false)}
                className="fluid-px-4 fluid-py-2 bg-gray-200 text-gray-700 rounded-fluid-xl hover:bg-gray-300 transition-all font-medium fluid-text-sm"
              >
                Entendido
              </button>
              <Link
                to={`/partners/groups/${groupId}/assignments/${attemptedExam.id}/edit-members?type=exam&name=${encodeURIComponent(attemptedExam.name)}`}
                className="fluid-px-4 fluid-py-2 bg-orange-500 text-white rounded-fluid-xl hover:bg-orange-600 transition-all font-medium flex items-center fluid-gap-2 fluid-text-sm shadow-lg"
              >
                <Edit3 className="fluid-icon-sm" />
                Editar candidatos
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
