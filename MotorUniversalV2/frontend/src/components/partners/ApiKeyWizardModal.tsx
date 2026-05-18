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
import { X, Loader2, AlertCircle, Search, Check } from 'lucide-react'
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
} from '../../services/partnersService'

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
    editingAssignment?.time_limit_minutes != null ? String(editingAssignment.time_limit_minutes) : '',
  )
  const [passingScore, setPassingScore] = useState<string>(
    editingAssignment?.passing_score != null ? String(editingAssignment.passing_score) : '',
  )
  const [maxAttempts, setMaxAttempts] = useState<string>(
    editingAssignment?.max_attempts != null ? String(editingAssignment.max_attempts) : '1',
  )
  const [maxDisconnections, setMaxDisconnections] = useState<string>(
    editingAssignment?.max_disconnections != null ? String(editingAssignment.max_disconnections) : '3',
  )
  const [contentType, setContentType] = useState<SsoExamContentType>(
    (editingAssignment?.exam_content_type as SsoExamContentType) || 'questions_only',
  )
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
    editingAssignment?.validity_months != null ? String(editingAssignment.validity_months) : '',
  )
  const [securityPin, setSecurityPin] = useState<string>(editingAssignment?.security_pin || '')
  const [requireSecurityPin, setRequireSecurityPin] = useState<boolean>(
    editingAssignment?.require_security_pin || false,
  )

  // ── Paso 3: step-up (solo al crear key) ───────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')

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
      security_pin: securityPin.trim() || null,
      require_security_pin: requireSecurityPin,
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Paso {step} de {totalSteps}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* PASO 1: meta (solo create-key) */}
          {step === 1 && isCreateKey && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ej: Integración SSO con el LMS de la Universidad X — cohorte 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Aparecerá en el listado de api keys para identificarla. Recomendado describir
                  el sistema integrado y el propósito.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre corto <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  maxLength={200}
                  placeholder="Ej: LMS-Univ-X"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                En el siguiente paso configurarás el primer examen que se asignará a los candidatos
                que entren por esta api key. Después podrás agregar más exámenes desde la pantalla
                de detalle.
              </div>
            </div>
          )}

          {/* PASO 2 (o 1 en add/edit): asignación */}
          {step === (isCreateKey ? 2 : 1) && (
            <div className="space-y-4">
              {!isEdit && (
                <>
                  {/* Filtro por ECM */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filtrar por ECM (opcional)
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar ECM por código o nombre..."
                        value={ecmSearch}
                        onChange={(e) => setEcmSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded">
                      <button
                        onClick={() => setSelectedEcmId(null)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          selectedEcmId === null ? 'bg-blue-50 text-blue-700 font-medium' : ''
                        }`}
                      >
                        Todos los ECMs del plantel
                      </button>
                      {filteredEcms.map((ecm) => (
                        <button
                          key={ecm.id}
                          onClick={() => setSelectedEcmId(ecm.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-t border-gray-100 ${
                            selectedEcmId === ecm.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Examen <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar examen por nombre..."
                      value={examSearch}
                      onChange={(e) => setExamSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded">
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
                          onClick={() => setSelectedExamId(exam.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 ${
                            selectedExamId === exam.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {selectedExamId === exam.id && (
                              <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{exam.name}</div>
                              {(exam as any).standard && (
                                <div className="text-xs text-gray-500 font-mono">
                                  {(exam as any).standard}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {isEdit && selectedExam && (
                <div className="p-3 bg-gray-50 rounded text-sm">
                  <span className="text-gray-500">Examen:</span>{' '}
                  <span className="font-medium">{selectedExam.name}</span>
                </div>
              )}

              {/* Config */}
              {selectedExamId && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo de contenido
                    </label>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as SsoExamContentType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                      placeholder="Default del examen"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
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
                      placeholder="Default del plantel"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  {contentType !== 'exercises_only' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Preguntas examen
                        </label>
                        <input
                          type="number"
                          value={examQuestionsCount}
                          onChange={(e) => setExamQuestionsCount(e.target.value)}
                          placeholder="Todas"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Preguntas simulador
                        </label>
                        <input
                          type="number"
                          value={simulatorQuestionsCount}
                          onChange={(e) => setSimulatorQuestionsCount(e.target.value)}
                          placeholder="Todas"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </>
                  )}
                  {contentType !== 'questions_only' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Ejercicios examen
                        </label>
                        <input
                          type="number"
                          value={examExercisesCount}
                          onChange={(e) => setExamExercisesCount(e.target.value)}
                          placeholder="Todos"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Ejercicios simulador
                        </label>
                        <input
                          type="number"
                          value={simulatorExercisesCount}
                          onChange={(e) => setSimulatorExercisesCount(e.target.value)}
                          placeholder="Todos"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      PIN seguridad (opcional)
                    </label>
                    <input
                      type="text"
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      maxLength={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={requireSecurityPin}
                        onChange={(e) => setRequireSecurityPin(e.target.checked)}
                      />
                      Requerir PIN
                    </label>
                  </div>
                </div>
              )}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                Esta plantilla se aplicará a <strong>todos</strong> los candidatos que entren por
                la API key. El examen se asignará al grupo destino con la configuración aquí
                definida (find-or-create por grupo + examen).
              </div>
            </div>
          )}

          {/* PASO 3 (solo create-key): step-up */}
          {step === 3 && isCreateKey && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                <strong>Reconfirmación de identidad:</strong> escribe tu contraseña para crear
                esta api key. La acción quedará registrada en la bitácora.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tu contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div className="p-3 bg-gray-50 rounded text-sm space-y-1">
                <div>
                  <span className="text-gray-500">Descripción:</span>{' '}
                  <span className="font-medium">{description}</span>
                </div>
                {keyName && (
                  <div>
                    <span className="text-gray-500">Nombre:</span>{' '}
                    <span className="font-medium">{keyName}</span>
                  </div>
                )}
                {selectedExam && (
                  <div>
                    <span className="text-gray-500">Examen inicial:</span>{' '}
                    <span className="font-medium">{selectedExam.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded"
          >
            {step > 1 ? 'Anterior' : 'Cancelar'}
          </button>
          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
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
