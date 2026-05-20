/**
 * Modal autocontenido para crear / editar una plantilla de asignación
 * de una API Key SSO multi-key. Captura los mismos campos que el wizard
 * `/groups/:id/assign-exam` pero sin grupo destino (se resuelve al consumir
 * la api). v1: assignment_type='all'. La selección de miembros fijos
 * (`assignment_type='selected'` + member_ids) y materiales personalizados
 * se gestionará en un paso posterior — el wizard arranca con cobertura del
 * caso institucional típico (TODO candidato que entre por la key recibe
 * los exámenes configurados).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Loader2,
  AlertCircle,
  Search,
  Check,
  Key,
  ClipboardList,
  ShieldCheck,
  Sparkles,
  RefreshCcw,
  Award,
  FileQuestion,
  Dumbbell,
} from 'lucide-react'
import {
  ssoApiKeysService,
  ApiKeyAssignmentPayload,
  CampusApiKeyWithSecret,
  ApiKeyAssignment,
  SsoExamContentType,
} from '../../services/ssoApiKeysService'
import {
  getAvailableExams,
  AvailableExam,
  getAvailableEcms,
  AvailableEcm,
  getCampus,
} from '../../services/partnersService'

/**
 * Valores estándar del flujo /assign-exam cuando el editor no definió defaults.
 * Mantener sincronizado con ExamSelectConfigPage.
 */
const STANDARD_DEFAULTS = {
  maxAttempts: 2,
  maxDisconnections: 3,
  contentType: 'mixed' as SsoExamContentType,
  timeLimitMinutes: 60,
  validityMonths: 12,
}

/**
 * Campo de conteo (preguntas/ejercicios) con toggle entre "Todas" y un número específico.
 * Cuando está en modo "Todas", el valor enviado al backend es null/'' (= sin límite).
 */
function CountField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const isAll = value === ''
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg border transition ${
            isAll
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        <input
          type="number"
          min={1}
          value={isAll ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isAll ? 'Todas' : 'Número'}
          disabled={isAll}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
        />
      </div>
    </div>
  )
}

type Mode =
  | { kind: 'create-key'; campusId: number }
  | { kind: 'add-assignment'; apiKeyId: number }
  | { kind: 'edit-assignment'; apiKeyId: number; assignment: ApiKeyAssignment }

interface Props {
  mode: Mode
  campusId: number
  onClose: () => void
  onSuccess: (result: CampusApiKeyWithSecret | ApiKeyAssignment) => void
}

const CONTENT_TYPES: { value: SsoExamContentType; label: string }[] = [
  { value: 'questions_only', label: 'Solo preguntas' },
  { value: 'exercises_only', label: 'Solo ejercicios' },
  { value: 'mixed', label: 'Preguntas y ejercicios' },
]

export default function ApiKeyWizardModal({ mode, campusId, onClose, onSuccess }: Props) {
  const isCreateKey = mode.kind === 'create-key'
  const isEdit = mode.kind === 'edit-assignment'
  const editingAssignment = isEdit ? mode.assignment : null

  // ── Paso 1: meta de la api key ────────────────────────────────────
  const [description, setDescription] = useState('')
  const [keyName, setKeyName] = useState('')

  // ── Paso 2: asignación ────────────────────────────────────────────
  const [ecmSearch, setEcmSearch] = useState('')
  const [ecms, setEcms] = useState<AvailableEcm[]>([])
  const [selectedEcmId, setSelectedEcmId] = useState<number | null>(null)
  const [exams, setExams] = useState<AvailableExam[]>([])
  const [selectedExamId, setSelectedExamId] = useState<number | null>(
    editingAssignment?.exam_id ?? null,
  )
  const [loadingLists, setLoadingLists] = useState(false)
  const [examSearch, setExamSearch] = useState('')

  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>(
    editingAssignment?.time_limit_minutes != null
      ? String(editingAssignment.time_limit_minutes)
      : String(STANDARD_DEFAULTS.timeLimitMinutes),
  )
  const [passingScore, setPassingScore] = useState<string>(
    editingAssignment?.passing_score != null ? String(editingAssignment.passing_score) : '',
  )
  const [maxAttempts, setMaxAttempts] = useState<string>(
    editingAssignment?.max_attempts != null
      ? String(editingAssignment.max_attempts)
      : String(STANDARD_DEFAULTS.maxAttempts),
  )
  const [maxDisconnections, setMaxDisconnections] = useState<string>(
    editingAssignment?.max_disconnections != null
      ? String(editingAssignment.max_disconnections)
      : String(STANDARD_DEFAULTS.maxDisconnections),
  )
  const [contentType, setContentType] = useState<SsoExamContentType>(
    (editingAssignment?.exam_content_type as SsoExamContentType) || STANDARD_DEFAULTS.contentType,
  )
  /** Indica si la configuración actual fue tomada del editor / estándar (vs editada por el usuario). */
  const [defaultsSource, setDefaultsSource] = useState<'editor' | 'standard' | 'custom' | null>(null)
  const [examQuestionsCount, setExamQuestionsCount] = useState<string>(
    editingAssignment?.exam_questions_count != null ? String(editingAssignment.exam_questions_count) : '',
  )
  const [examExercisesCount, setExamExercisesCount] = useState<string>(
    editingAssignment?.exam_exercises_count != null ? String(editingAssignment.exam_exercises_count) : '',
  )
  const [simulatorQuestionsCount, setSimulatorQuestionsCount] = useState<string>(
    editingAssignment?.simulator_questions_count != null ? String(editingAssignment.simulator_questions_count) : '',
  )
  const [simulatorExercisesCount, setSimulatorExercisesCount] = useState<string>(
    editingAssignment?.simulator_exercises_count != null ? String(editingAssignment.simulator_exercises_count) : '',
  )
  const [validityMonths, setValidityMonths] = useState<string>(
    editingAssignment?.validity_months != null
      ? String(editingAssignment.validity_months)
      : String(STANDARD_DEFAULTS.validityMonths),
  )
  // PIN diario lo emite el plantel automáticamente; aquí solo se decide
  // si la api key DEBE pedirlo. No se captura un valor manual.
  const [requireSecurityPin, setRequireSecurityPin] = useState<boolean>(
    editingAssignment?.require_security_pin || false,
  )

  // Tipo de certificado que se emite cuando el candidato aprueba el examen.
  // Solo 'conocer' obliga al candidato (SSO) a validar su CURP en sitio.
  const [certificateType, setCertificateType] = useState<
    'conocer' | 'eduit' | 'badge' | 'none'
  >((editingAssignment?.certificate_type as any) || 'eduit')

  // ── Paso 3: step-up (solo al crear key) ───────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')

  // ── Configuración del plantel ─────────────────────────────────────
  /** Si el plantel requiere PIN diario de examen, habilitamos los campos de PIN en el wizard. */
  const [campusRequiresPin, setCampusRequiresPin] = useState<boolean>(false)

  // ── Wizard control ────────────────────────────────────────────────
  const totalSteps = isCreateKey ? 3 : 2
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Cargar ECMs y exámenes del campus ─────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const campus = await getCampus(campusId)
        if (!cancelled) setCampusRequiresPin(Boolean(campus?.require_exam_pin))
      } catch {
        // si falla, dejamos PIN deshabilitado
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [campusId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoadingLists(true)
        const ecmsResp = await getAvailableEcms({ group_id: 0, search: '' } as any).catch(async () => {
          // fallback: usar campus_id (necesita backend con soporte campus_id)
          const res = await (
            await import('../../services/api')
          ).api.get('/partners/ecms/available', { params: { campus_id: campusId } })
          return res.data as any
        })
        if (!cancelled) setEcms(ecmsResp.ecms || [])
      } catch (e) {
        // si falla, dejamos vacío — el usuario podrá usar el buscador de exams
      } finally {
        if (!cancelled) setLoadingLists(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [campusId])

  // Cargar exámenes cuando cambia ECM o búsqueda
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const params: any = { campus_id: campusId, per_page: 100, search: examSearch }
        if (selectedEcmId) params.ecm_id = selectedEcmId
        const resp = await getAvailableExams(params)
        if (!cancelled) setExams(resp.exams || [])
      } catch (e) {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [campusId, selectedEcmId, examSearch])

  const filteredEcms = useMemo(() => {
    const q = ecmSearch.trim().toLowerCase()
    if (!q) return ecms
    return ecms.filter(
      (e) =>
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.sector || '').toLowerCase().includes(q),
    )
  }, [ecms, ecmSearch])

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId],
  )

  /**
   * Aplica la configuraci\u00f3n por defecto del editor al examen seleccionado.
   * Si el editor no defini\u00f3 un campo, usa el est\u00e1ndar del flujo /assign-exam.
   * No se ejecuta en modo edici\u00f3n para preservar los valores guardados.
   */
  const applyEditorDefaults = (exam: AvailableExam) => {
    if (isEdit) return
    const hasEditorConfig =
      exam.default_duration_minutes != null ||
      exam.default_passing_score != null ||
      exam.default_max_attempts != null ||
      exam.default_max_disconnections != null ||
      exam.default_exam_content_type != null ||
      exam.default_exam_questions_count != null ||
      exam.default_exam_exercises_count != null ||
      exam.default_simulator_questions_count != null ||
      exam.default_simulator_exercises_count != null

    setTimeLimitMinutes(
      exam.default_duration_minutes != null
        ? String(exam.default_duration_minutes)
        : String(STANDARD_DEFAULTS.timeLimitMinutes),
    )
    setPassingScore(
      exam.default_passing_score != null
        ? String(exam.default_passing_score)
        : exam.passing_score
        ? String(exam.passing_score)
        : '',
    )
    setMaxAttempts(String(exam.default_max_attempts ?? STANDARD_DEFAULTS.maxAttempts))
    setMaxDisconnections(
      String(exam.default_max_disconnections ?? STANDARD_DEFAULTS.maxDisconnections),
    )
    setContentType(
      (exam.default_exam_content_type as SsoExamContentType) || STANDARD_DEFAULTS.contentType,
    )
    setExamQuestionsCount(
      exam.default_exam_questions_count != null ? String(exam.default_exam_questions_count) : '',
    )
    setExamExercisesCount(
      exam.default_exam_exercises_count != null ? String(exam.default_exam_exercises_count) : '',
    )
    setSimulatorQuestionsCount(
      exam.default_simulator_questions_count != null
        ? String(exam.default_simulator_questions_count)
        : '',
    )
    setSimulatorExercisesCount(
      exam.default_simulator_exercises_count != null
        ? String(exam.default_simulator_exercises_count)
        : '',
    )
    setDefaultsSource(hasEditorConfig ? 'editor' : 'standard')
  }

  const handleSelectExam = (exam: AvailableExam) => {
    setSelectedExamId(exam.id)
    applyEditorDefaults(exam)
  }

  const resetToStandardDefaults = () => {
    setTimeLimitMinutes(String(STANDARD_DEFAULTS.timeLimitMinutes))
    setPassingScore(selectedExam?.passing_score ? String(selectedExam.passing_score) : '')
    setMaxAttempts(String(STANDARD_DEFAULTS.maxAttempts))
    setMaxDisconnections(String(STANDARD_DEFAULTS.maxDisconnections))
    setContentType(STANDARD_DEFAULTS.contentType)
    setExamQuestionsCount('')
    setExamExercisesCount('')
    setSimulatorQuestionsCount('')
    setSimulatorExercisesCount('')
    setValidityMonths(String(STANDARD_DEFAULTS.validityMonths))
    setDefaultsSource('standard')
  }

  // ── Validación paso a paso ────────────────────────────────────────
  const canAdvance = (() => {
    if (step === 1 && isCreateKey) {
      return description.trim().length > 0
    }
    if (step === (isCreateKey ? 2 : 1)) {
      return selectedExamId !== null
    }
    if (step === (isCreateKey ? 3 : 2) && isCreateKey) {
      return currentPassword.length > 0
    }
    return true
  })()

  const buildPayload = (): ApiKeyAssignmentPayload => {
    const toOptInt = (s: string) => {
      const t = s.trim()
      if (!t) return null
      const n = parseInt(t, 10)
      return Number.isFinite(n) ? n : null
    }
    return {
      exam_id: selectedExamId!,
      assignment_type: 'all', // v1: solo all en wizard
      time_limit_minutes: toOptInt(timeLimitMinutes),
      passing_score: toOptInt(passingScore),
      max_attempts: toOptInt(maxAttempts) ?? 1,
      max_disconnections: toOptInt(maxDisconnections) ?? 3,
      exam_content_type: contentType,
      exam_questions_count: toOptInt(examQuestionsCount),
      exam_exercises_count: toOptInt(examExercisesCount),
      simulator_questions_count: toOptInt(simulatorQuestionsCount),
      simulator_exercises_count: toOptInt(simulatorExercisesCount),
      validity_months: toOptInt(validityMonths),
      security_pin: null,
      require_security_pin: requireSecurityPin,
      certificate_type: certificateType,
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const payload = buildPayload()
      if (mode.kind === 'create-key') {
        const result = await ssoApiKeysService.create(mode.campusId, {
          description: description.trim(),
          name: keyName.trim() || null,
          assignment: payload,
          current_password: currentPassword,
        })
        onSuccess(result)
      } else if (mode.kind === 'add-assignment') {
        const result = await ssoApiKeysService.addAssignment(mode.apiKeyId, payload)
        onSuccess(result)
      } else {
        const result = await ssoApiKeysService.updateAssignment(
          mode.apiKeyId,
          mode.assignment.id,
          payload,
        )
        onSuccess(result)
      }
    } catch (e: any) {
      const data = e?.response?.data
      const msg = data?.detail || data?.error || e?.message || 'Error en la operación'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    mode.kind === 'create-key'
      ? 'Nueva API Key SSO'
      : mode.kind === 'add-assignment'
      ? 'Agregar examen a la API Key'
      : 'Editar plantilla de asignación'

  const subtitle =
    mode.kind === 'create-key'
      ? 'Configura la integración SSO y el primer examen que se asignará a los candidatos.'
      : mode.kind === 'add-assignment'
      ? 'Suma un examen más a esta integración SSO.'
      : 'Ajusta los parámetros de esta plantilla de asignación.'

  const stepLabels = isCreateKey
    ? ['Identificación', 'Examen y configuración', 'Confirmación']
    : ['Examen y configuración', 'Confirmación']

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/15 rounded-lg transition"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Stepper */}
          <div className="flex items-center gap-2 mt-5">
            {stepLabels.map((label, idx) => {
              const n = idx + 1
              const isDone = n < step
              const isCurrent = n === step
              return (
                <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold flex-shrink-0 transition ${
                      isDone
                        ? 'bg-emerald-400 text-white'
                        : isCurrent
                        ? 'bg-white text-indigo-700 ring-4 ring-white/30'
                        : 'bg-white/20 text-white/70'
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : n}
                  </div>
                  <span
                    className={`text-xs font-medium truncate ${
                      isCurrent ? 'text-white' : 'text-white/70'
                    }`}
                  >
                    {label}
                  </span>
                  {idx < stepLabels.length - 1 && (
                    <div className="flex-1 h-px bg-white/30 mx-1" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* PASO 1: meta (solo create-key) */}
          {step === 1 && isCreateKey && (
            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Identificación de la API Key
                  </h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Ej: Integración SSO con el LMS de la Universidad X — cohorte 2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Aparecerá en el listado de api keys. Describe el sistema integrado y el propósito.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nombre corto <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    maxLength={200}
                    placeholder="Ej: LMS-Univ-X"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  En el siguiente paso configurarás el primer examen. La configuración del editor se
                  aplicará automáticamente; si el editor no definió parámetros, usaremos los valores
                  estándar (intentos, desconexiones, etc.).
                </div>
              </div>
            </div>
          )}

          {/* PASO 2 (o 1 en add/edit): asignación */}
          {step === (isCreateKey ? 2 : 1) && (
            <div className="space-y-5">
              {!isEdit && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <Award className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Elegir examen</h3>
                  </div>
                  {/* Filtro por ECM */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Filtrar por ECM <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar ECM por código o nombre..."
                        value={ecmSearch}
                        onChange={(e) => setEcmSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                      <button
                        onClick={() => setSelectedEcmId(null)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          selectedEcmId === null ? 'bg-indigo-50 text-indigo-700 font-medium' : ''
                        }`}
                      >
                        Todos los ECMs del plantel
                      </button>
                      {filteredEcms.map((ecm) => (
                        <button
                          key={ecm.id}
                          onClick={() => setSelectedEcmId(ecm.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-t border-gray-100 ${
                            selectedEcmId === ecm.id ? 'bg-indigo-50 text-indigo-700 font-medium' : ''
                          }`}
                        >
                          <span className="font-mono text-xs text-gray-500">{ecm.code}</span>{' '}
                          {ecm.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selector de examen */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Examen <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar examen por nombre..."
                        value={examSearch}
                        onChange={(e) => setExamSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg">
                      {loadingLists && (
                        <div className="p-4 text-center text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Cargando...
                        </div>
                      )}
                      {!loadingLists && exams.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No hay exámenes disponibles
                        </div>
                      )}
                      {exams.map((exam) => (
                        <button
                          key={exam.id}
                          onClick={() => handleSelectExam(exam)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 transition ${
                            selectedExamId === exam.id ? 'bg-indigo-50 text-indigo-700 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {selectedExamId === exam.id ? (
                              <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-4 h-4 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{exam.name}</div>
                              {exam.standard && (
                                <div className="text-xs text-gray-500 font-mono">
                                  {exam.standard}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isEdit && selectedExam && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-900">
                  <Award className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <span className="text-indigo-600">Examen:</span>{' '}
                    <span className="font-medium">{selectedExam.name}</span>
                  </span>
                </div>
              )}

              {/* Config */}
              {selectedExamId && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Configuración del examen
                      </h3>
                    </div>
                    {defaultsSource && !isEdit && (
                      <button
                        type="button"
                        onClick={resetToStandardDefaults}
                        className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        Restablecer estándar
                      </button>
                    )}
                  </div>

                  {defaultsSource === 'editor' && !isEdit && (
                    <div className="mb-4 p-3 rounded-lg flex gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Configuración del editor aplicada.</strong> Estos valores los
                        definió el editor al crear el examen; ajusta lo que necesites para esta
                        integración.
                      </div>
                    </div>
                  )}
                  {defaultsSource === 'standard' && !isEdit && (
                    <div className="mb-4 p-3 rounded-lg flex gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-900">
                      <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>Configuración estándar aplicada.</strong> Este examen no tiene
                        configuración predeterminada del editor, por lo que se usaron los valores
                        típicos del flujo de asignación a grupos (2 intentos, 3 desconexiones,
                        contenido mixto).
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de contenido
                    </label>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as SsoExamContentType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    >
                      {CONTENT_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tiempo límite (min)
                    </label>
                    <input
                      type="number"
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(e.target.value)}
                      placeholder="60"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Calificación aprobatoria (%)
                    </label>
                    <input
                      type="number"
                      value={passingScore}
                      onChange={(e) => setPassingScore(e.target.value)}
                      placeholder="Default del examen"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Intentos máximos
                    </label>
                    <input
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Desconexiones máximas
                    </label>
                    <input
                      type="number"
                      value={maxDisconnections}
                      onChange={(e) => setMaxDisconnections(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Vigencia (meses)
                    </label>
                    <input
                      type="number"
                      value={validityMonths}
                      onChange={(e) => setValidityMonths(e.target.value)}
                      placeholder="12"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  {contentType !== 'exercises_only' && (
                    <>
                      <CountField
                        label="Preguntas examen"
                        value={examQuestionsCount}
                        onChange={setExamQuestionsCount}
                      />
                      <CountField
                        label="Preguntas simulador"
                        value={simulatorQuestionsCount}
                        onChange={setSimulatorQuestionsCount}
                      />
                    </>
                  )}
                  {contentType !== 'questions_only' && (
                    <>
                      <CountField
                        label="Ejercicios examen"
                        value={examExercisesCount}
                        onChange={setExamExercisesCount}
                      />
                      <CountField
                        label="Ejercicios simulador"
                        value={simulatorExercisesCount}
                        onChange={setSimulatorExercisesCount}
                      />
                    </>
                  )}
                  {campusRequiresPin && (
                    <div className="md:col-span-2 flex items-start gap-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50/40">
                      <input
                        id="require-security-pin"
                        type="checkbox"
                        checked={requireSecurityPin}
                        onChange={(e) => setRequireSecurityPin(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="require-security-pin" className="text-sm text-gray-700 leading-snug cursor-pointer">
                        <span className="font-medium text-gray-900">Solicitar PIN del plantel al iniciar examen</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          El PIN diario lo genera el plantel automáticamente. El candidato deberá ingresarlo para comenzar el examen.
                        </span>
                      </label>
                    </div>
                  )}
                  <div className="md:col-span-2 p-3 rounded-lg border border-emerald-100 bg-emerald-50/40">
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Tipo de certificado a emitir
                    </label>
                    <select
                      value={certificateType}
                      onChange={(e) => setCertificateType(e.target.value as any)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="eduit">EDUIT (sin CURP)</option>
                      <option value="conocer">CONOCER (exige CURP del candidato)</option>
                      <option value="badge">Insignia digital (sin CURP)</option>
                      <option value="none">Sin certificado</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-600">
                      Solo el tipo <strong>CONOCER</strong> obliga al candidato (creado vía SSO) a
                      validar su CURP en sitio. Los demás tipos omiten ese paso.
                    </p>
                  </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                <div>
                  Esta plantilla se aplicará a <strong>todos</strong> los candidatos que entren por
                  la API key. El examen se asignará al grupo destino con la configuración aquí
                  definida (find-or-create por grupo + examen).
                </div>
              </div>
            </div>
          )}

          {/* PASO 3 (solo create-key): step-up */}
          {step === 3 && isCreateKey && (
            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Confirma tu identidad
                  </h3>
                </div>
                <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    Esta es una acción sensible. Escribe tu contraseña para crear la API Key. La
                    operación quedará registrada en la bitácora.
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tu contraseña <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Resumen
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 min-w-[110px]">Descripción:</span>
                  <span className="font-medium text-gray-900">{description}</span>
                </div>
                {keyName && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 min-w-[110px]">Nombre:</span>
                    <span className="font-medium text-gray-900">{keyName}</span>
                  </div>
                )}
                {selectedExam && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 min-w-[110px]">Examen inicial:</span>
                    <span className="font-medium text-gray-900">{selectedExam.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-white">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            {step > 1 ? 'Anterior' : 'Cancelar'}
          </button>
          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance || submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance || submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-sm disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode.kind === 'create-key'
                ? 'Crear API Key'
                : mode.kind === 'add-assignment'
                ? 'Agregar examen'
                : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
