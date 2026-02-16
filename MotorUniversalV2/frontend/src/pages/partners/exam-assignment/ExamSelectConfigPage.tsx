/**
 * Página 1/4: Selección y Configuración de Examen
 * Seleccionar un examen publicado + configurar parámetros
 * Navega a → /assign-exam/materials con el state
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Target, RefreshCw, Users,
  BookOpen, ClipboardList, FileQuestion, Dumbbell, Layers,
  CheckCircle2, AlertCircle, X, Loader2,
  ChevronRight, EyeOff,
  Search, Hash, Lock,
  ChevronDown, FolderOpen,
} from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PartnersBreadcrumb from '../../../components/PartnersBreadcrumb';
import {
  getGroup, getAvailableExams,
  CandidateGroup, AvailableExam, ExamContentType,
} from '../../../services/partnersService';
import { EXAM_CONTENT_TYPES, type ExamConfig, type SelectExamState, type SelectMaterialsState } from './types';

const EXAMS_PER_PAGE = 500;

/** Grupo de exámenes bajo un ECM */
interface EcmGroup {
  ecmCode: string;
  ecmName: string;
  exams: AvailableExam[];
}

export default function ExamSelectConfigPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState<CandidateGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exam selection
  const [availableExams, setAvailableExams] = useState<AvailableExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedExam, setSelectedExam] = useState<AvailableExam | null>(null);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const [examPage, setExamPage] = useState(1);
  const [examTotal, setExamTotal] = useState(0);
  const [examSearchQuery, setExamSearchQuery] = useState('');

  // Expanded ECM groups in dropdown
  const [expandedEcms, setExpandedEcms] = useState<Set<string>>(new Set());

  // Configuration
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(null);
  const [useExamDefaultTime, setUseExamDefaultTime] = useState(true);
  const [passingScore, setPassingScore] = useState(70);
  const [useExamDefaultScore, setUseExamDefaultScore] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [maxDisconnections, setMaxDisconnections] = useState(3);
  const [examContentType, setExamContentType] = useState<ExamContentType>('mixed');

  // Content counts - Exam
  const [examQuestionsCount, setExamQuestionsCount] = useState<number | null>(null);
  const [examExercisesCount, setExamExercisesCount] = useState<number | null>(null);
  const [useAllExamQuestions, setUseAllExamQuestions] = useState(true);
  const [useAllExamExercises, setUseAllExamExercises] = useState(true);

  // Content counts - Simulator
  const [simulatorQuestionsCount, setSimulatorQuestionsCount] = useState<number | null>(null);
  const [simulatorExercisesCount, setSimulatorExercisesCount] = useState<number | null>(null);
  const [useAllSimulatorQuestions, setUseAllSimulatorQuestions] = useState(true);
  const [useAllSimulatorExercises, setUseAllSimulatorExercises] = useState(true);

  // Step within this page
  const [step, setStep] = useState<'select' | 'accept-or-customize' | 'configure'>('select');

  // Already assigned modal
  const [showAlreadyAssignedModal, setShowAlreadyAssignedModal] = useState(false);
  const [attemptedExam, setAttemptedExam] = useState<AvailableExam | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const groupData = await getGroup(Number(groupId));
        setGroup(groupData);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar el grupo');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  useEffect(() => {
    const timer = setTimeout(() => loadExams(), examSearchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [examPage, examSearchQuery]);

  const loadExams = async () => {
    try {
      setLoadingExams(true);
      const data = await getAvailableExams({
        page: examPage, per_page: EXAMS_PER_PAGE,
        search: examSearchQuery || undefined, group_id: Number(groupId),
      });
      setAvailableExams(data.exams);
      setExamTotal(data.total);
    } catch { /* ignore */ } finally { setLoadingExams(false); }
  };

  const handleExamSearchChange = (q: string) => { setExamSearchQuery(q); setExamPage(1); };

  /** Agrupar exámenes por ECM */
  const groupedByEcm = useMemo<EcmGroup[]>(() => {
    const ecmMap = new Map<string, EcmGroup>();
    for (const exam of availableExams) {
      const key = exam.ecm_code || exam.standard || '__sin_ecm__';
      if (!ecmMap.has(key)) {
        ecmMap.set(key, {
          ecmCode: exam.ecm_code || exam.standard || '',
          ecmName: exam.ecm_name || exam.standard || 'Sin ECM',
          exams: [],
        });
      }
      ecmMap.get(key)!.exams.push(exam);
    }
    const groups = Array.from(ecmMap.values());
    groups.sort((a, b) => a.ecmCode.localeCompare(b.ecmCode));
    return groups;
  }, [availableExams]);

  /** Auto-expandir todos los ECMs cuando se cargan o cambia búsqueda */
  useEffect(() => {
    if (groupedByEcm.length > 0) {
      setExpandedEcms(new Set(groupedByEcm.map(g => g.ecmCode || '__sin_ecm__')));
    }
  }, [groupedByEcm]);

  const toggleEcmGroup = (ecmCode: string) => {
    setExpandedEcms(prev => {
      const next = new Set(prev);
      const key = ecmCode || '__sin_ecm__';
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleContinueToConfig = () => {
    if (!selectedExam) return;
    if (selectedExam.duration_minutes) setTimeLimitMinutes(selectedExam.duration_minutes);
    if (selectedExam.passing_score) setPassingScore(selectedExam.passing_score);
    setStep('accept-or-customize');
  };

  /** Aceptar configuración del editor: usar defaults del examen + materiales ligados → saltar a candidatos (paso 3) */
  const handleAcceptEditorConfig = () => {
    if (!selectedExam) return;
    const config: ExamConfig = {
      timeLimitMinutes: null, // usar default del examen
      useExamDefaultTime: true,
      passingScore: selectedExam.passing_score,
      useExamDefaultScore: true,
      maxAttempts: selectedExam.default_max_attempts ?? 2,
      maxDisconnections: selectedExam.default_max_disconnections ?? 3,
      examContentType: (selectedExam.default_exam_content_type || 'mixed') as ExamContentType,
      examQuestionsCount: selectedExam.default_exam_questions_count ?? null,
      examExercisesCount: selectedExam.default_exam_exercises_count ?? null,
      useAllExamQuestions: selectedExam.default_exam_questions_count == null,
      useAllExamExercises: selectedExam.default_exam_exercises_count == null,
      simulatorQuestionsCount: selectedExam.default_simulator_questions_count ?? null,
      simulatorExercisesCount: selectedExam.default_simulator_exercises_count ?? null,
      useAllSimulatorQuestions: selectedExam.default_simulator_questions_count == null,
      useAllSimulatorExercises: selectedExam.default_simulator_exercises_count == null,
    };
    const materialIds = selectedExam.linked_material_ids || [];
    const state: SelectMaterialsState = { selectedExam, config, selectedMaterialIds: materialIds };
    // Saltar directamente al paso 3 (candidatos)
    navigate(`/partners/groups/${groupId}/assign-exam/members`, { state });
  };

  /** Ir a la sub-página de configuración manual */
  const handleCustomize = () => {
    if (!selectedExam) return;
    // Pre-cargar defaults del editor en los controles
    setMaxAttempts(selectedExam.default_max_attempts ?? 2);
    setMaxDisconnections(selectedExam.default_max_disconnections ?? 3);
    setExamContentType((selectedExam.default_exam_content_type || 'mixed') as ExamContentType);
    if (selectedExam.default_exam_questions_count != null) {
      setUseAllExamQuestions(false);
      setExamQuestionsCount(selectedExam.default_exam_questions_count);
    }
    if (selectedExam.default_exam_exercises_count != null) {
      setUseAllExamExercises(false);
      setExamExercisesCount(selectedExam.default_exam_exercises_count);
    }
    if (selectedExam.default_simulator_questions_count != null) {
      setUseAllSimulatorQuestions(false);
      setSimulatorQuestionsCount(selectedExam.default_simulator_questions_count);
    }
    if (selectedExam.default_simulator_exercises_count != null) {
      setUseAllSimulatorExercises(false);
      setSimulatorExercisesCount(selectedExam.default_simulator_exercises_count);
    }
    setStep('configure');
  };

  const handleGoToMaterials = () => {
    if (!selectedExam) return;
    const config: ExamConfig = {
      timeLimitMinutes: useExamDefaultTime ? null : timeLimitMinutes,
      useExamDefaultTime, passingScore: useExamDefaultScore ? selectedExam.passing_score : passingScore,
      useExamDefaultScore, maxAttempts, maxDisconnections, examContentType,
      examQuestionsCount: useAllExamQuestions ? null : examQuestionsCount,
      examExercisesCount: useAllExamExercises ? null : examExercisesCount,
      useAllExamQuestions, useAllExamExercises,
      simulatorQuestionsCount: useAllSimulatorQuestions ? null : simulatorQuestionsCount,
      simulatorExercisesCount: useAllSimulatorExercises ? null : simulatorExercisesCount,
      useAllSimulatorQuestions, useAllSimulatorExercises,
    };
    const state: SelectExamState = { selectedExam, config };
    navigate(`/partners/groups/${groupId}/assign-exam/materials`, { state });
  };

  if (loading) return <LoadingSpinner message="Cargando..." fullScreen />;
  if (!group) return <div className="p-6"><div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4"><p className="text-red-600">Grupo no encontrado</p></div></div>;

  // Step indicator
  const stepLabels = ['Examen', 'Materiales', 'Candidatos', 'Confirmar'];
  return (
    <div className="fluid-p-6 max-w-[2800px] mx-auto animate-fade-in-up">
      <PartnersBreadcrumb items={[
        { label: group.campus?.partner?.name || 'Partner', path: `/partners/${group.campus?.partner_id}` },
        { label: group.campus?.name || 'Plantel', path: `/partners/campuses/${group.campus_id}` },
        { label: group.name, path: `/partners/groups/${groupId}` },
        { label: 'Asignar Examen' },
      ]} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <Link to={`/partners/groups/${groupId}`} className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors">
            <ArrowLeft className="fluid-icon-lg" />
          </Link>
          <div>
            <div className="flex items-center fluid-gap-2 fluid-text-sm text-white/80 fluid-mb-1">
              <ClipboardList className="fluid-icon-sm" /><span>{group.name}</span><span>•</span><span>{group.member_count} miembros</span>
            </div>
            <h1 className="fluid-text-2xl font-bold">Paso 1: Seleccionar y Configurar Examen</h1>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center fluid-mb-6">
        <div className="flex items-center">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center fluid-text-sm font-semibold transition-all ${
                  i === 0 ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-lg' : 'bg-gray-200 text-gray-600'
                }`}>{i < 0 ? <CheckCircle2 className="fluid-icon-base" /> : i + 1}</div>
                <span className={`ml-2 font-medium hidden sm:inline fluid-text-sm ${i === 0 ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && <div className={`w-8 md:w-12 h-1 rounded-full mx-2 transition-all ${i < 0 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="fluid-mb-6 bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-5 flex items-start fluid-gap-3">
          <AlertCircle className="fluid-icon-base text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 fluid-text-base flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="fluid-icon-base" /></button>
        </div>
      )}

      {/* === SUB-STEP: SELECT EXAM === */}
      {step === 'select' && (
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <ClipboardList className="fluid-icon-base text-indigo-600" />
            Selecciona un Examen Publicado
          </h2>

          {/* Dropdown */}
          <div className="relative fluid-mb-6">
            <button type="button" onClick={() => setExamDropdownOpen(!examDropdownOpen)}
              className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl text-left bg-white hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all flex items-center justify-between">
              {selectedExam ? (
                <div className="flex-1">
                  <span className="font-medium text-gray-900 fluid-text-base">{selectedExam.name}</span>
                  {(selectedExam.ecm_code || selectedExam.standard) && <span className="fluid-text-sm text-blue-600 ml-2">({selectedExam.ecm_code || selectedExam.standard})</span>}
                </div>
              ) : <span className="text-gray-400 fluid-text-base">Selecciona un examen...</span>}
              <ChevronRight className={`fluid-icon-base text-gray-400 transition-transform ${examDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {examDropdownOpen && (
              <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-fluid-xl shadow-lg">
                <div className="p-3 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 fluid-icon-sm" />
                    <input type="text" placeholder="Buscar examen por nombre o código ECM..."
                      value={examSearchQuery} onChange={(e) => handleExamSearchChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-9 pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" autoFocus />
                    {examSearchQuery && (
                      <button onClick={(e) => { e.stopPropagation(); handleExamSearchChange(''); }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="fluid-icon-sm" /></button>
                    )}
                  </div>
                </div>

                {loadingExams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="fluid-icon-lg animate-spin text-blue-600" /><span className="ml-2 text-gray-500 fluid-text-sm">Cargando exámenes...</span>
                  </div>
                ) : groupedByEcm.length > 0 ? (
                  <>
                    <div className="max-h-[28rem] overflow-y-auto">
                      {groupedByEcm.map((ecmGroup) => {
                        const ecmKey = ecmGroup.ecmCode || '__sin_ecm__';
                        const isExpanded = expandedEcms.has(ecmKey);
                        const assignedCount = ecmGroup.exams.filter(e => e.is_assigned_to_group).length;
                        return (
                          <div key={ecmKey}>
                            {/* ECM Header */}
                            <div
                              onClick={(e) => { e.stopPropagation(); toggleEcmGroup(ecmGroup.ecmCode); }}
                              className="flex items-center justify-between fluid-px-4 fluid-py-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-200 cursor-pointer hover:from-indigo-100 hover:to-blue-100 transition-all sticky top-0 z-10"
                            >
                              <div className="flex items-center fluid-gap-2 min-w-0">
                                <ChevronDown className={`w-4 h-4 text-indigo-500 transition-transform flex-shrink-0 ${isExpanded ? '' : '-rotate-90'}`} />
                                <FolderOpen className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-semibold text-indigo-800 fluid-text-sm">{ecmGroup.ecmCode || 'Sin código'}</span>
                                  {ecmGroup.ecmName && ecmGroup.ecmName !== ecmGroup.ecmCode && (
                                    <span className="text-indigo-600 fluid-text-xs ml-2 truncate">— {ecmGroup.ecmName}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center fluid-gap-2 flex-shrink-0">
                                <span className="inline-flex items-center fluid-px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-indigo-100 text-indigo-700">
                                  {ecmGroup.exams.length} {ecmGroup.exams.length === 1 ? 'examen' : 'exámenes'}
                                </span>
                                {assignedCount > 0 && (
                                  <span className="inline-flex items-center fluid-px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-orange-100 text-orange-700">
                                    <Lock className="w-3 h-3 mr-0.5" />{assignedCount}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Exams under this ECM */}
                            {isExpanded && ecmGroup.exams.map((exam) => (
                              <div key={exam.id}
                                onClick={() => {
                                  if (exam.is_assigned_to_group) { setAttemptedExam(exam); setShowAlreadyAssignedModal(true); return; }
                                  setSelectedExam(exam); setExamDropdownOpen(false);
                                }}
                                className={`fluid-p-4 border-b border-gray-100 last:border-b-0 transition-all pl-10 ${
                                  exam.is_assigned_to_group ? 'bg-gray-50 cursor-not-allowed opacity-70'
                                  : selectedExam?.id === exam.id ? 'bg-blue-50 border-l-4 border-l-blue-500 cursor-pointer'
                                  : 'hover:bg-blue-50 cursor-pointer'
                                }`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center fluid-gap-2">
                                      <h3 className={`font-medium fluid-text-base ${exam.is_assigned_to_group ? 'text-gray-500' : 'text-gray-900'}`}>{exam.name}</h3>
                                      {exam.version && <span className="fluid-text-xs text-gray-400">v{exam.version}</span>}
                                      {exam.is_assigned_to_group && (
                                        <span className="inline-flex items-center fluid-px-2 py-0.5 rounded fluid-text-xs font-medium bg-orange-100 text-orange-800"><Lock className="w-3 h-3 mr-1" />Ya asignado</span>
                                      )}
                                    </div>
                                    <div className={`flex items-center fluid-gap-4 mt-2 fluid-text-sm ${exam.is_assigned_to_group ? 'text-gray-400' : 'text-gray-500'}`}>
                                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" />{exam.duration_minutes} min</span>
                                      <span className="flex items-center"><Target className="w-3.5 h-3.5 mr-1" />{exam.passing_score}%</span>
                                      <span className="flex items-center"><FileQuestion className="w-3.5 h-3.5 mr-1" />{exam.total_questions} preg</span>
                                      <span className="flex items-center"><Dumbbell className="w-3.5 h-3.5 mr-1" />{exam.total_exercises} ejer</span>
                                      <span className="flex items-center"><BookOpen className="w-3.5 h-3.5 mr-1" />{exam.study_materials_count} mat</span>
                                    </div>
                                  </div>
                                  {exam.is_assigned_to_group ? <Lock className="fluid-icon-base text-orange-500 flex-shrink-0" />
                                  : selectedExam?.id === exam.id ? <CheckCircle2 className="fluid-icon-base text-blue-600 flex-shrink-0" /> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary footer */}
                    <div className="fluid-px-4 fluid-py-3 bg-gray-50 border-t border-gray-200 rounded-b-fluid-xl">
                      <p className="fluid-text-sm text-gray-500">
                        {examTotal} {examTotal === 1 ? 'examen' : 'exámenes'} en {groupedByEcm.length} {groupedByEcm.length === 1 ? 'ECM' : 'ECMs'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto text-gray-300 fluid-mb-3" />
                    <p className="fluid-text-base">{examSearchQuery ? 'No se encontraron exámenes con esa búsqueda' : 'No hay exámenes publicados'}</p>
                    {examSearchQuery && (
                      <button onClick={() => handleExamSearchChange('')} className="mt-2 fluid-text-sm text-blue-600 hover:text-blue-800 font-medium">
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected exam preview */}
          {selectedExam && (
            <div className="mt-6 fluid-p-5 bg-blue-50 border border-blue-200 rounded-fluid-xl">
              <p className="fluid-text-sm text-blue-600 font-medium fluid-mb-2">Examen seleccionado:</p>
              <h3 className="font-semibold text-gray-900 fluid-text-base">{selectedExam.name}</h3>
              {(selectedExam.ecm_code || selectedExam.standard) && <p className="fluid-text-sm text-gray-600 mt-1">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>}
              {selectedExam.description && <p className="fluid-text-sm text-gray-500 mt-2">{selectedExam.description}</p>}
              <div className="flex flex-wrap items-center fluid-gap-4 mt-3 fluid-text-sm text-gray-600">
                <span className="flex items-center"><Clock className="fluid-icon-sm mr-1" />{selectedExam.duration_minutes} min</span>
                <span className="flex items-center"><Target className="fluid-icon-sm mr-1" />{selectedExam.passing_score}% mín</span>
                <span className="flex items-center text-blue-600" title="Preguntas: Examen / Simulador"><FileQuestion className="fluid-icon-sm mr-1" />{selectedExam.exam_questions_count || 0}/{selectedExam.simulator_questions_count || 0} preg</span>
                <span className="flex items-center text-purple-600" title="Ejercicios: Examen / Simulador"><Dumbbell className="fluid-icon-sm mr-1" />{selectedExam.exam_exercises_count || 0}/{selectedExam.simulator_exercises_count || 0} ejer</span>
                <span className="flex items-center"><BookOpen className="fluid-icon-sm mr-1" />{selectedExam.study_materials_count} mat</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button onClick={handleContinueToConfig} disabled={!selectedExam}
              className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center fluid-gap-2 shadow-lg transition-all fluid-text-sm">
              Continuar <ChevronRight className="fluid-icon-base" />
            </button>
          </div>
        </div>
      )}

      {/* === SUB-STEP: ACCEPT OR CUSTOMIZE === */}
      {step === 'accept-or-customize' && selectedExam && (
        <div className="space-y-6">
          {/* Exam banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="fluid-text-sm text-blue-600 font-medium">Examen seleccionado</p>
                <h3 className="font-semibold text-gray-900 mt-1 fluid-text-base">{selectedExam.name}</h3>
                {(selectedExam.ecm_code || selectedExam.standard) && <p className="fluid-text-sm text-gray-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>}
              </div>
              <button onClick={() => setStep('select')} className="text-blue-600 hover:text-blue-800 fluid-text-sm font-medium">Cambiar</button>
            </div>
          </div>

          {/* Resumen de configuración del editor */}
          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 fluid-p-5">
              <div className="flex items-center fluid-gap-3">
                <div className="fluid-p-2.5 bg-white/20 rounded-fluid-xl">
                  <CheckCircle2 className="fluid-icon-lg text-white" />
                </div>
                <div>
                  <h2 className="fluid-text-lg font-bold text-white">Configuración del Editor</h2>
                  <p className="fluid-text-sm text-white/80">Esta configuración fue definida por el editor del examen</p>
                </div>
              </div>
            </div>

            <div className="fluid-p-5 fluid-space-y-5">
              {/* Config summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-4">
                <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
                  <Clock className="fluid-icon-base text-blue-500 mx-auto fluid-mb-2" />
                  <p className="fluid-text-xl font-bold text-gray-800">{selectedExam.duration_minutes || 0}</p>
                  <p className="fluid-text-xs text-gray-500">Minutos</p>
                </div>
                <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
                  <Target className="fluid-icon-base text-green-500 mx-auto fluid-mb-2" />
                  <p className="fluid-text-xl font-bold text-gray-800">{selectedExam.passing_score}%</p>
                  <p className="fluid-text-xs text-gray-500">Puntaje Mín.</p>
                </div>
                <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
                  <RefreshCw className="fluid-icon-base text-orange-500 mx-auto fluid-mb-2" />
                  <p className="fluid-text-xl font-bold text-gray-800">{selectedExam.default_max_attempts ?? 2}</p>
                  <p className="fluid-text-xs text-gray-500">Reintentos</p>
                </div>
                <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 text-center border border-gray-100">
                  <EyeOff className="fluid-icon-base text-red-500 mx-auto fluid-mb-2" />
                  <p className="fluid-text-xl font-bold text-gray-800">{selectedExam.default_max_disconnections ?? 3}</p>
                  <p className="fluid-text-xs text-gray-500">Desconexiones</p>
                </div>
              </div>

              {/* Tipo de contenido + cantidades */}
              <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
                <div className="bg-blue-50 rounded-fluid-xl fluid-p-4 border border-blue-100">
                  <p className="fluid-text-xs font-semibold text-blue-700 uppercase tracking-wide fluid-mb-2">Tipo de Contenido</p>
                  <p className="fluid-text-base font-bold text-blue-900">
                    {(selectedExam.default_exam_content_type || 'mixed') === 'mixed' ? 'Preguntas y Ejercicios' : 
                     (selectedExam.default_exam_content_type || 'mixed') === 'questions_only' ? 'Solo Preguntas' : 'Solo Ejercicios'}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-fluid-xl fluid-p-4 border border-purple-100">
                  <p className="fluid-text-xs font-semibold text-purple-700 uppercase tracking-wide fluid-mb-2">Materiales Ligados</p>
                  <p className="fluid-text-base font-bold text-purple-900">{selectedExam.linked_material_ids?.length || 0} materiales</p>
                  <p className="fluid-text-xs text-purple-600 fluid-mt-1">Se asignarán automáticamente</p>
                </div>
              </div>

              {/* Cantidades de contenido */}
              <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-3">
                <div className="fluid-p-3 bg-gray-50 rounded-fluid-lg border border-gray-100 text-center">
                  <p className="fluid-text-lg font-bold text-gray-700">{selectedExam.default_exam_questions_count ?? `${selectedExam.exam_questions_count || 0}`}</p>
                  <p className="fluid-text-xs text-gray-500">{selectedExam.default_exam_questions_count == null ? 'Todas las' : ''} Preg. Examen</p>
                </div>
                <div className="fluid-p-3 bg-gray-50 rounded-fluid-lg border border-gray-100 text-center">
                  <p className="fluid-text-lg font-bold text-gray-700">{selectedExam.default_exam_exercises_count ?? `${selectedExam.exam_exercises_count || 0}`}</p>
                  <p className="fluid-text-xs text-gray-500">{selectedExam.default_exam_exercises_count == null ? 'Todos los' : ''} Ejer. Examen</p>
                </div>
                <div className="fluid-p-3 bg-gray-50 rounded-fluid-lg border border-gray-100 text-center">
                  <p className="fluid-text-lg font-bold text-gray-700">{selectedExam.default_simulator_questions_count ?? `${selectedExam.simulator_questions_count || 0}`}</p>
                  <p className="fluid-text-xs text-gray-500">{selectedExam.default_simulator_questions_count == null ? 'Todas las' : ''} Preg. Simulador</p>
                </div>
                <div className="fluid-p-3 bg-gray-50 rounded-fluid-lg border border-gray-100 text-center">
                  <p className="fluid-text-lg font-bold text-gray-700">{selectedExam.default_simulator_exercises_count ?? `${selectedExam.simulator_exercises_count || 0}`}</p>
                  <p className="fluid-text-xs text-gray-500">{selectedExam.default_simulator_exercises_count == null ? 'Todos los' : ''} Ejer. Simulador</p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row fluid-gap-4 pt-4 border-t border-gray-100">
                <button onClick={handleAcceptEditorConfig}
                  className="flex-1 fluid-px-6 fluid-py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-fluid-xl font-semibold hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center fluid-gap-3 fluid-text-base">
                  <CheckCircle2 className="fluid-icon-lg" />
                  Aceptar Configuración del Editor
                </button>
                <button onClick={handleCustomize}
                  className="flex-1 fluid-px-6 fluid-py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-fluid-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center fluid-gap-3 fluid-text-base">
                  <svg className="fluid-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Personalizar Configuración
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SUB-STEP: CONFIGURE === */}
      {step === 'configure' && selectedExam && (
        <div className="space-y-6">
          {/* Selected exam banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="fluid-text-sm text-blue-600 font-medium">Examen seleccionado</p>
                <h3 className="font-semibold text-gray-900 mt-1 fluid-text-base">{selectedExam.name}</h3>
                {(selectedExam.ecm_code || selectedExam.standard) && <p className="fluid-text-sm text-gray-600">ECM: {selectedExam.ecm_code || selectedExam.standard}</p>}
              </div>
              <button onClick={() => setStep('accept-or-customize')} className="text-blue-600 hover:text-blue-800 fluid-text-sm font-medium">← Volver</button>
            </div>
          </div>

          <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5">
            <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-6">Configuración del Examen</h2>

            {/* Content type */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-3">Tipo de Contenido</label>
              <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4">
                {EXAM_CONTENT_TYPES.map((type) => (
                  <div key={type.value} onClick={() => setExamContentType(type.value)}
                    className={`fluid-p-4 border-2 rounded-fluid-xl cursor-pointer transition-all ${
                      examContentType === type.value ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}>
                    <div className={`fluid-mb-2 ${examContentType === type.value ? 'text-blue-600' : 'text-gray-400'}`}>
                      {type.value === 'mixed' ? <Layers className="fluid-icon-lg" /> : type.value === 'questions_only' ? <FileQuestion className="fluid-icon-lg" /> : <Dumbbell className="fluid-icon-lg" />}
                    </div>
                    <h4 className="font-medium text-gray-900 fluid-text-base">{type.label}</h4>
                    <p className="fluid-text-xs text-gray-500 mt-1">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Time limit */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2"><Clock className="fluid-icon-sm inline mr-1" />Tiempo Límite</label>
              <label className="flex items-center">
                <input type="checkbox" checked={useExamDefaultTime} onChange={(e) => setUseExamDefaultTime(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-2 fluid-text-sm text-gray-600">Usar tiempo del examen ({selectedExam.duration_minutes} min)</span>
              </label>
              {!useExamDefaultTime && (
                <div className="mt-3 flex items-center fluid-gap-2">
                  <input type="number" value={timeLimitMinutes || ''} onChange={(e) => setTimeLimitMinutes(e.target.value ? Number(e.target.value) : null)}
                    min={1} max={480} className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500" placeholder="Min" />
                  <span className="text-gray-500 fluid-text-sm">minutos</span>
                </div>
              )}
            </div>

            {/* Passing score */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2"><Target className="fluid-icon-sm inline mr-1" />Calificación Mínima para Aprobar</label>
              <label className="flex items-center">
                <input type="checkbox" checked={useExamDefaultScore} onChange={(e) => setUseExamDefaultScore(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-2 fluid-text-sm text-gray-600">Usar calificación del examen ({selectedExam.passing_score}%)</span>
              </label>
              {!useExamDefaultScore && (
                <div className="mt-3 flex items-center fluid-gap-2">
                  <input type="number" value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} min={0} max={100}
                    className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500" /><span className="text-gray-500 fluid-text-sm">%</span>
                </div>
              )}
            </div>

            {/* Attempts */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2"><RefreshCw className="fluid-icon-sm inline mr-1" />Número de Reintentos Permitidos</label>
              <div className="flex items-center fluid-gap-2">
                <input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value)))} min={1} max={10}
                  className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-500 fluid-text-sm">intento(s)</span>
              </div>
              <p className="fluid-text-xs text-gray-500 mt-1">El candidato podrá realizar el examen hasta este número de veces</p>
            </div>

            {/* Disconnections */}
            <div className="fluid-mb-6">
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2"><EyeOff className="fluid-icon-sm inline mr-1" />Oportunidades de Desconexión</label>
              <div className="flex items-center fluid-gap-2">
                <input type="number" value={maxDisconnections} onChange={(e) => setMaxDisconnections(Math.max(0, Number(e.target.value)))} min={0} max={10}
                  className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-500 fluid-text-sm">oportunidades</span>
              </div>
              <p className="fluid-text-xs text-gray-500 mt-1">Veces que el candidato puede salir de pantalla o desconectarse antes de invalidar el examen</p>
            </div>

            {/* Content counts */}
            <div className="border-t pt-6 fluid-mb-6">
              <h3 className="fluid-text-base font-medium text-gray-900 fluid-mb-4 flex items-center fluid-gap-2"><Hash className="fluid-icon-base text-purple-500" />Cantidad de Contenido</h3>
              <p className="fluid-text-sm text-gray-500 fluid-mb-4">Define cuántas preguntas y/o ejercicios incluir para cada modo.</p>

              {/* Exam section */}
              {((selectedExam.exam_questions_count || 0) > 0 || (selectedExam.exam_exercises_count || 0) > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                  <h4 className="font-medium text-blue-800 fluid-mb-3 flex items-center fluid-gap-2"><FileQuestion className="fluid-icon-sm" />Examen</h4>
                  {(examContentType === 'mixed' || examContentType === 'questions_only') && (selectedExam.exam_questions_count || 0) > 0 && (
                    <div className="fluid-mb-3">
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Preguntas <span className="text-gray-400 font-normal ml-2">(Disponibles: {selectedExam.exam_questions_count})</span></label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={useAllExamQuestions} onChange={(e) => { setUseAllExamQuestions(e.target.checked); if (e.target.checked) setExamQuestionsCount(null); else setExamQuestionsCount(selectedExam.exam_questions_count || 0); }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-2 fluid-text-sm text-gray-600">Usar todas ({selectedExam.exam_questions_count})</span>
                      </label>
                      {!useAllExamQuestions && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input type="number" value={examQuestionsCount || ''} onChange={(e) => setExamQuestionsCount(e.target.value ? Number(e.target.value) : null)}
                            min={1} max={selectedExam.exam_questions_count || 0} className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 fluid-text-sm" />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.exam_questions_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {(examContentType === 'mixed' || examContentType === 'exercises_only') && (selectedExam.exam_exercises_count || 0) > 0 && (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Ejercicios <span className="text-gray-400 font-normal ml-2">(Disponibles: {selectedExam.exam_exercises_count})</span></label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={useAllExamExercises} onChange={(e) => { setUseAllExamExercises(e.target.checked); if (e.target.checked) setExamExercisesCount(null); else setExamExercisesCount(selectedExam.exam_exercises_count || 0); }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-2 fluid-text-sm text-gray-600">Usar todos ({selectedExam.exam_exercises_count})</span>
                      </label>
                      {!useAllExamExercises && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input type="number" value={examExercisesCount || ''} onChange={(e) => setExamExercisesCount(e.target.value ? Number(e.target.value) : null)}
                            min={1} max={selectedExam.exam_exercises_count || 0} className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 fluid-text-sm" />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.exam_exercises_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Simulator section */}
              {((selectedExam.simulator_questions_count || 0) > 0 || (selectedExam.simulator_exercises_count || 0) > 0) && (
                <div className="bg-purple-50 border border-purple-200 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                  <h4 className="font-medium text-purple-800 fluid-mb-3 flex items-center fluid-gap-2"><Layers className="fluid-icon-sm" />Simulador</h4>
                  {(examContentType === 'mixed' || examContentType === 'questions_only') && (selectedExam.simulator_questions_count || 0) > 0 && (
                    <div className="fluid-mb-3">
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Preguntas <span className="text-gray-400 font-normal ml-2">(Disponibles: {selectedExam.simulator_questions_count})</span></label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={useAllSimulatorQuestions} onChange={(e) => { setUseAllSimulatorQuestions(e.target.checked); if (e.target.checked) setSimulatorQuestionsCount(null); else setSimulatorQuestionsCount(selectedExam.simulator_questions_count || 0); }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                        <span className="ml-2 fluid-text-sm text-gray-600">Usar todas ({selectedExam.simulator_questions_count})</span>
                      </label>
                      {!useAllSimulatorQuestions && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input type="number" value={simulatorQuestionsCount || ''} onChange={(e) => setSimulatorQuestionsCount(e.target.value ? Number(e.target.value) : null)}
                            min={1} max={selectedExam.simulator_questions_count || 0} className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 fluid-text-sm" />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.simulator_questions_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {(examContentType === 'mixed' || examContentType === 'exercises_only') && (selectedExam.simulator_exercises_count || 0) > 0 && (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Ejercicios <span className="text-gray-400 font-normal ml-2">(Disponibles: {selectedExam.simulator_exercises_count})</span></label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={useAllSimulatorExercises} onChange={(e) => { setUseAllSimulatorExercises(e.target.checked); if (e.target.checked) setSimulatorExercisesCount(null); else setSimulatorExercisesCount(selectedExam.simulator_exercises_count || 0); }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                        <span className="ml-2 fluid-text-sm text-gray-600">Usar todos ({selectedExam.simulator_exercises_count})</span>
                      </label>
                      {!useAllSimulatorExercises && (
                        <div className="mt-2 flex items-center fluid-gap-2">
                          <input type="number" value={simulatorExercisesCount || ''} onChange={(e) => setSimulatorExercisesCount(e.target.value ? Number(e.target.value) : null)}
                            min={1} max={selectedExam.simulator_exercises_count || 0} className="w-20 px-2 py-1 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 fluid-text-sm" />
                          <span className="fluid-text-sm text-gray-500">de {selectedExam.simulator_exercises_count}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(selectedExam.exam_questions_count || 0) === 0 && (selectedExam.exam_exercises_count || 0) === 0 &&
               (selectedExam.simulator_questions_count || 0) === 0 && (selectedExam.simulator_exercises_count || 0) === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-fluid-xl fluid-p-4">
                  <p className="text-yellow-700 fluid-text-sm">Este examen no tiene contenido de preguntas ni ejercicios configurado.</p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <button onClick={() => setStep('accept-or-customize')} className="fluid-px-4 fluid-py-2 text-gray-600 hover:text-gray-900 fluid-text-sm font-medium transition-colors">← Volver</button>
              <button onClick={handleGoToMaterials} className="fluid-px-6 fluid-py-3 bg-blue-600 text-white rounded-fluid-xl hover:bg-blue-700 fluid-text-sm font-medium shadow-lg transition-all">
                Continuar: Materiales →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Already assigned */}
      {showAlreadyAssignedModal && attemptedExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fluid-p-4 animate-fade-in" onClick={() => setShowAlreadyAssignedModal(false)}>
          <div className="bg-white rounded-fluid-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 fluid-p-5 text-white">
              <div className="flex items-center fluid-gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center animate-bounce"><Lock className="fluid-icon-lg" /></div>
                <div><h3 className="fluid-text-lg font-bold">Examen ya asignado</h3><p className="text-orange-100 fluid-text-sm">Este examen ya pertenece al grupo</p></div>
              </div>
            </div>
            <div className="fluid-p-5">
              <div className="flex items-start fluid-gap-3 fluid-mb-4">
                <AlertCircle className="fluid-icon-lg text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-700 font-medium fluid-text-base">El examen <span className="text-orange-600">"{attemptedExam.name}"</span> ya está asignado a este grupo.</p>
                  <p className="text-gray-500 fluid-text-sm mt-2">Si deseas modificar los candidatos asignados a este examen, puedes hacerlo con el botón de editar candidatos.</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-fluid-xl fluid-p-4 fluid-mb-4">
                <p className="fluid-text-sm font-medium text-gray-700 fluid-mb-2">Detalles del examen:</p>
                <div className="flex items-center fluid-gap-4 fluid-text-sm text-gray-600">
                  <span className="flex items-center"><Clock className="fluid-icon-sm mr-1 text-gray-400" />{attemptedExam.duration_minutes} min</span>
                  <span className="flex items-center"><Target className="fluid-icon-sm mr-1 text-gray-400" />{attemptedExam.passing_score}%</span>
                  {(attemptedExam.ecm_code || attemptedExam.standard) && <span className="text-blue-600">ECM: {attemptedExam.ecm_code || attemptedExam.standard}</span>}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 fluid-px-5 fluid-py-3 flex flex-wrap justify-end fluid-gap-3">
              <button onClick={() => setShowAlreadyAssignedModal(false)} className="fluid-px-4 fluid-py-2 bg-gray-200 text-gray-700 rounded-fluid-xl hover:bg-gray-300 transition-all font-medium fluid-text-sm">Entendido</button>
              <Link to={`/partners/groups/${groupId}/assignments/${attemptedExam.id}/edit-members?type=exam&name=${encodeURIComponent(attemptedExam.name)}`}
                className="fluid-px-4 fluid-py-2 bg-orange-500 text-white rounded-fluid-xl hover:bg-orange-600 transition-all font-medium flex items-center fluid-gap-2 fluid-text-sm shadow-lg">
                <Users className="fluid-icon-sm" />Editar candidatos
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
