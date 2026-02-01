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
  Save,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  getGroup,
  getGroupMembers,
  getAvailableExams,
  assignExamToGroup,
  getExamMaterialsForAssignment,
  CandidateGroup,
  GroupMember,
  AvailableExam,
  ExamContentType,
  ExamAssignmentConfig,
  ExamMaterialForAssignment,
} from '../../services/partnersService';

type Step = 'select-exam' | 'configure' | 'select-materials' | 'assign-members';

const EXAM_CONTENT_TYPES: { value: ExamContentType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'mixed',
    label: 'Preguntas y Ejercicios',
    description: 'El examen combinará preguntas teóricas con ejercicios prácticos.',
    icon: <Layers className="w-6 h-6" />,
  },
  {
    value: 'questions_only',
    label: 'Solo Preguntas',
    description: 'El examen contendrá únicamente preguntas de opción múltiple, verdadero/falso, etc.',
    icon: <FileQuestion className="w-6 h-6" />,
  },
  {
    value: 'exercises_only',
    label: 'Solo Ejercicios',
    description: 'El examen contendrá únicamente ejercicios prácticos para resolver.',
    icon: <Dumbbell className="w-6 h-6" />,
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
  
  // Paso 3: Selección de materiales
  const [availableMaterials, setAvailableMaterials] = useState<ExamMaterialForAssignment[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  
  // Paso 4: Asignación de miembros
  const [assignmentType, setAssignmentType] = useState<'all' | 'selected'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  
  // Estado de guardado
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        search: examSearchQuery || undefined 
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

  const filteredMembers = members.filter(m => {
    if (!memberSearchQuery.trim()) return true;
    const query = memberSearchQuery.toLowerCase();
    const fullName = m.user?.full_name?.toLowerCase() || '';
    const email = m.user?.email?.toLowerCase() || '';
    return fullName.includes(query) || email.includes(query);
  });

  const filteredMaterials = availableMaterials.filter(m => {
    if (!materialSearchQuery.trim()) return true;
    const query = materialSearchQuery.toLowerCase();
    return m.title.toLowerCase().includes(query) || (m.description?.toLowerCase() || '').includes(query);
  });

  const handleAssignExam = async () => {
    if (!selectedExam) return;
    
    if (assignmentType === 'selected' && selectedMemberIds.length === 0) {
      setError('Debes seleccionar al menos un candidato');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const config: ExamAssignmentConfig = {
        exam_id: selectedExam.id,
        assignment_type: assignmentType,
        member_ids: assignmentType === 'selected' ? selectedMemberIds : undefined,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds : undefined,
        time_limit_minutes: useExamDefaultTime ? null : timeLimitMinutes,
        passing_score: useExamDefaultScore ? null : passingScore,
        max_attempts: maxAttempts,
        max_disconnections: maxDisconnections,
        exam_content_type: examContentType,
      };
      
      const result = await assignExamToGroup(Number(groupId), config);
      setSuccessMessage(result.message);
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        navigate(`/partners/groups/${groupId}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al asignar el examen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!group) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Grupo no encontrado</p>
        </div>
      </div>
    );
  }

  const stepIndicator = (
    <div className="flex items-center justify-center mb-8 overflow-x-auto">
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Paso 1: Seleccionar Examen */}
        <div className={`flex items-center ${currentStep === 'select-exam' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'select-exam' ? 'bg-blue-600 text-white' : 
            selectedExam ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {selectedExam && currentStep !== 'select-exam' ? <CheckCircle2 className="w-5 h-5" /> : '1'}
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Examen</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        
        {/* Paso 2: Configurar */}
        <div className={`flex items-center ${currentStep === 'configure' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'configure' ? 'bg-blue-600 text-white' : 
            ['select-materials', 'assign-members'].includes(currentStep) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {['select-materials', 'assign-members'].includes(currentStep) ? <CheckCircle2 className="w-5 h-5" /> : '2'}
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Configurar</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        
        {/* Paso 3: Materiales */}
        <div className={`flex items-center ${currentStep === 'select-materials' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'select-materials' ? 'bg-blue-600 text-white' : 
            currentStep === 'assign-members' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {currentStep === 'assign-members' ? <CheckCircle2 className="w-5 h-5" /> : '3'}
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Materiales</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300" />
        
        {/* Paso 4: Asignar */}
        <div className={`flex items-center ${currentStep === 'assign-members' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep === 'assign-members' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            4
          </div>
          <span className="ml-2 font-medium hidden sm:inline">Asignar</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/partners/groups/${groupId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al grupo
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Asignar Examen y Materiales de Estudio
        </h1>
        <p className="text-gray-500 mt-1">
          {group.name} • {group.member_count} miembros
        </p>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-700">{successMessage}</p>
            <p className="text-green-600 text-sm mt-1">Redirigiendo al grupo...</p>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      {stepIndicator}

      {/* Paso 1: Selección de Examen */}
      {currentStep === 'select-exam' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <ClipboardList className="w-5 h-5 inline mr-2" />
            Selecciona un Examen Publicado
          </h2>
          
          {/* Dropdown de exámenes */}
          <div className="relative mb-6">
            <button
              type="button"
              onClick={() => setExamDropdownOpen(!examDropdownOpen)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left bg-white hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all flex items-center justify-between"
            >
              {selectedExam ? (
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{selectedExam.name}</span>
                  {selectedExam.standard && (
                    <span className="text-sm text-blue-600 ml-2">({selectedExam.standard})</span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400">Selecciona un examen...</span>
              )}
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${examDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {/* Dropdown panel */}
            {examDropdownOpen && (
              <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                {/* Campo de búsqueda */}
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar examen por nombre o estándar..."
                      value={examSearchQuery}
                      onChange={(e) => handleExamSearchChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de exámenes */}
                {loadingExams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Cargando exámenes...</span>
                  </div>
                ) : availableExams.length > 0 ? (
                  <>
                    <div className="max-h-72 overflow-y-auto">
                      {availableExams.map((exam) => (
                        <div
                          key={exam.id}
                          onClick={() => {
                            setSelectedExam(exam);
                            setExamDropdownOpen(false);
                          }}
                          className={`p-4 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 cursor-pointer transition-all ${
                            selectedExam?.id === exam.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{exam.name}</h3>
                              {exam.standard && (
                                <p className="text-sm text-blue-600 mt-0.5">Estándar: {exam.standard}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
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
                            {selectedExam?.id === exam.id && (
                              <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Paginación */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Mostrando {(examPage - 1) * EXAMS_PER_PAGE + 1}-{Math.min(examPage * EXAMS_PER_PAGE, examTotal)} de {examTotal} exámenes
                        </p>
                        <div className="flex items-center gap-1">
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
                          <span className="px-3 py-1 text-sm font-medium text-gray-700">
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
                    <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p>No hay exámenes publicados</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Examen seleccionado - preview */}
          {selectedExam && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-600 font-medium mb-2">Examen seleccionado:</p>
              <h3 className="font-semibold text-gray-900">{selectedExam.name}</h3>
              {selectedExam.standard && (
                <p className="text-sm text-gray-600 mt-1">Estándar: {selectedExam.standard}</p>
              )}
              {selectedExam.description && (
                <p className="text-sm text-gray-500 mt-2">{selectedExam.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {selectedExam.duration_minutes} minutos
                </span>
                <span className="flex items-center">
                  <Target className="w-4 h-4 mr-1" />
                  {selectedExam.passing_score}% mínimo
                </span>
                <span className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-1" />
                  {selectedExam.study_materials_count} materiales
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
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Continuar
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Paso 2: Configuración del Examen */}
      {currentStep === 'configure' && selectedExam && (
        <div className="space-y-6">
          {/* Examen seleccionado */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Examen seleccionado</p>
                <h3 className="font-semibold text-gray-900 mt-1">{selectedExam.name}</h3>
                {selectedExam.standard && (
                  <p className="text-sm text-gray-600">Estándar: {selectedExam.standard}</p>
                )}
              </div>
              <button
                onClick={handleBackToExamSelection}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Cambiar
              </button>
            </div>
          </div>

          {/* Configuración */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Configuración del Examen
            </h2>

            {/* Tipo de contenido */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Examen
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {EXAM_CONTENT_TYPES.map((type) => (
                  <div
                    key={type.value}
                    onClick={() => setExamContentType(type.value)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      examContentType === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`mb-2 ${examContentType === type.value ? 'text-blue-600' : 'text-gray-400'}`}>
                      {type.icon}
                    </div>
                    <h4 className="font-medium text-gray-900">{type.label}</h4>
                    <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tiempo límite */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Tiempo Límite
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useExamDefaultTime}
                    onChange={(e) => setUseExamDefaultTime(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Usar tiempo del examen ({selectedExam.duration_minutes} min)
                  </span>
                </label>
              </div>
              {!useExamDefaultTime && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    value={timeLimitMinutes || ''}
                    onChange={(e) => setTimeLimitMinutes(e.target.value ? Number(e.target.value) : null)}
                    min={1}
                    max={480}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Min"
                  />
                  <span className="text-gray-500">minutos</span>
                </div>
              )}
            </div>

            {/* Calificación mínima */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Target className="w-4 h-4 inline mr-1" />
                Calificación Mínima para Aprobar
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useExamDefaultScore}
                    onChange={(e) => setUseExamDefaultScore(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Usar calificación del examen ({selectedExam.passing_score}%)
                  </span>
                </label>
              </div>
              {!useExamDefaultScore && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              )}
            </div>

            {/* Reintentos */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Número de Reintentos Permitidos
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))}
                  min={1}
                  max={10}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">intento(s)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                El candidato podrá realizar el examen hasta este número de veces
              </p>
            </div>

            {/* Desconexiones */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <EyeOff className="w-4 h-4 inline mr-1" />
                Oportunidades de Desconexión
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={maxDisconnections}
                  onChange={(e) => setMaxDisconnections(Math.max(0, Number(e.target.value)))}
                  min={0}
                  max={10}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-500">oportunidades</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Veces que el candidato puede salir de pantalla o desconectarse antes de invalidar el examen
              </p>
            </div>

            {/* Botones de navegación */}
            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={handleBackToExamSelection}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Volver
              </button>
              <button
                onClick={handleGoToMaterialSelection}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Examen seleccionado</p>
                <h3 className="font-semibold text-gray-900 mt-1">{selectedExam.name}</h3>
                {selectedExam.standard && (
                  <p className="text-sm text-gray-600">Estándar: {selectedExam.standard}</p>
                )}
              </div>
            </div>
          </div>

          {/* Materiales */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                <BookOpen className="w-5 h-5 inline mr-2" />
                Selecciona los Materiales de Estudio
              </h2>
              <span className="text-sm text-gray-500">
                {selectedMaterialIds.length} seleccionado(s)
              </span>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Los materiales ligados al examen se seleccionan automáticamente. Puedes agregar o quitar materiales según necesites.
            </p>

            {/* Buscador de materiales */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {loadingMaterials ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-500">Cargando materiales...</span>
              </div>
            ) : filteredMaterials.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredMaterials.map((material) => (
                  <div
                    key={material.id}
                    onClick={() => handleToggleMaterial(material.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedMaterialIds.includes(material.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
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
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{material.title}</h3>
                          {material.is_linked && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                              Ligado al examen
                            </span>
                          )}
                        </div>
                        {material.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{material.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
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
                <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No hay materiales de estudio disponibles</p>
              </div>
            )}

            {/* Botones de navegación */}
            <div className="flex justify-between pt-4 border-t mt-6">
              <button
                onClick={handleBackToConfiguration}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Volver
              </button>
              <button
                onClick={handleGoToMemberAssignment}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
          <div className="bg-gray-50 border rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm text-gray-500">Examen</p>
                <p className="font-medium">{selectedExam.name}</p>
              </div>
              <div className="text-center text-sm">
                <p className="text-gray-500">Materiales</p>
                <p className="font-medium text-blue-600">{selectedMaterialIds.length} seleccionados</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>{examContentType === 'questions_only' ? 'Solo preguntas' : 
                   examContentType === 'exercises_only' ? 'Solo ejercicios' : 'Mixto'}</p>
                <p>{maxAttempts} intento(s) • {maxDisconnections} desconexiones</p>
              </div>
            </div>
          </div>

          {/* Tipo de asignación */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              ¿A quién asignar el examen?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div
                onClick={() => setAssignmentType('all')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  assignmentType === 'all'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className={`w-6 h-6 ${assignmentType === 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div>
                    <h4 className="font-medium text-gray-900">Todo el Grupo</h4>
                    <p className="text-sm text-gray-500">
                      Asignar a los {members.length} miembros del grupo
                    </p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setAssignmentType('selected')}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  assignmentType === 'selected'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <UserCheck className={`w-6 h-6 ${assignmentType === 'selected' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div>
                    <h4 className="font-medium text-gray-900">Candidatos Específicos</h4>
                    <p className="text-sm text-gray-500">
                      Seleccionar candidatos manualmente
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selección de miembros */}
            {assignmentType === 'selected' && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Buscar candidato..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSelectAllMembers}
                    className="ml-4 text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedMemberIds.length === members.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        onClick={() => handleToggleMember(member.user_id)}
                        className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${
                          selectedMemberIds.includes(member.user_id) ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selectedMemberIds.includes(member.user_id)
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {selectedMemberIds.includes(member.user_id) && (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{member.user?.full_name}</p>
                          <p className="text-xs text-gray-500">{member.user?.email}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No se encontraron miembros
                    </div>
                  )}
                </div>

                {selectedMemberIds.length > 0 && (
                  <p className="mt-2 text-sm text-purple-600">
                    {selectedMemberIds.length} candidato(s) seleccionado(s)
                  </p>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-between pt-6 mt-6 border-t">
              <button
                onClick={handleBackToMaterialSelection}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Volver
              </button>
              <button
                onClick={handleAssignExam}
                disabled={saving || (assignmentType === 'selected' && selectedMemberIds.length === 0)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Asignando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Asignar Examen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
