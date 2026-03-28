import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { examService } from '../../services/examService'
import LoadingSpinner from '../../components/LoadingSpinner'
import Breadcrumb from '../../components/Breadcrumb'

const ExamConfigPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Config states
  const [maxAttempts, setMaxAttempts] = useState(2)
  const [maxDisconnections, setMaxDisconnections] = useState(3)
  const [contentType, setContentType] = useState('mixed')
  const [examQuestionsCount, setExamQuestionsCount] = useState<number | null>(null)
  const [examExercisesCount, setExamExercisesCount] = useState<number | null>(null)
  const [simulatorQuestionsCount, setSimulatorQuestionsCount] = useState<number | null>(null)
  const [simulatorExercisesCount, setSimulatorExercisesCount] = useState<number | null>(null)
  const [useAllExamQuestions, setUseAllExamQuestions] = useState(true)
  const [useAllExamExercises, setUseAllExamExercises] = useState(true)
  const [useAllSimulatorQuestions, setUseAllSimulatorQuestions] = useState(true)
  const [useAllSimulatorExercises, setUseAllSimulatorExercises] = useState(true)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examService.getExam(Number(id), true),
    enabled: !!id,
  })

  // Initialize state from exam data
  useEffect(() => {
    if (exam) {
      setMaxAttempts(exam.default_max_attempts ?? 2)
      setMaxDisconnections(exam.default_max_disconnections ?? 3)
      setContentType(exam.default_exam_content_type || 'mixed')

      const eqc = exam.default_exam_questions_count ?? null
      const eec = exam.default_exam_exercises_count ?? null
      const sqc = exam.default_simulator_questions_count ?? null
      const sec = exam.default_simulator_exercises_count ?? null

      setExamQuestionsCount(eqc)
      setExamExercisesCount(eec)
      setSimulatorQuestionsCount(sqc)
      setSimulatorExercisesCount(sec)

      setUseAllExamQuestions(eqc === null)
      setUseAllExamExercises(eec === null)
      setUseAllSimulatorQuestions(sqc === null)
      setUseAllSimulatorExercises(sec === null)
    }
  }, [exam])

  const handleSave = async () => {
    if (!exam) return
    try {
      setSaving(true)
      await examService.updateExam(Number(id), {
        default_max_attempts: maxAttempts,
        default_max_disconnections: maxDisconnections,
        default_exam_content_type: contentType,
        default_exam_questions_count: examQuestionsCount,
        default_exam_exercises_count: examExercisesCount,
        default_simulator_questions_count: simulatorQuestionsCount,
        default_simulator_exercises_count: simulatorExercisesCount,
      } as any)
      await queryClient.invalidateQueries({ queryKey: ['exam', id] })
      setToast({ message: 'Configuración guardada correctamente', type: 'success' })
    } catch (err: any) {
      setToast({ message: `Error: ${err.response?.data?.error || err.message}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  if (isLoading) return <LoadingSpinner message="Cargando configuración..." fullScreen />
  if (error) return <div className="text-center fluid-py-12 text-red-600 fluid-text-base">Error al cargar el examen</div>
  if (!exam) return <div className="text-center fluid-py-12 text-gray-600 fluid-text-base">Examen no encontrado</div>

  const breadcrumbItems = [
    { label: exam.name, path: `/exams/${id}/edit` },
    { label: 'Configuración', isActive: true },
  ]

  return (
    <div className="w-full max-w-[2800px] mx-auto fluid-px-6 animate-fade-in-up">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`flex items-center fluid-gap-3 fluid-px-6 fluid-py-4 rounded-fluid-lg shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success' ? (
              <svg className="fluid-icon-lg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="fluid-icon-lg flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="fluid-ml-2 hover:opacity-80 transition-opacity">
              <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Back button */}
      <button
        onClick={() => navigate(`/exams/${id}/edit`)}
        className="fluid-mb-4 text-primary-600 hover:text-primary-700 flex items-center fluid-text-sm font-medium transition-colors group"
      >
        <svg className="fluid-icon-sm fluid-mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver al examen
      </button>

      {/* Page header */}
      <div className="fluid-mb-8">
        <div className="flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-fluid-xl">
            <svg className="fluid-icon-lg text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="fluid-text-3xl font-bold text-gray-900">Configuración del Examen</h1>
            <p className="fluid-text-sm text-gray-500 fluid-mt-1">
              Estos valores se heredan como predeterminados al asignar este examen a grupos
            </p>
          </div>
        </div>
      </div>

      {/* Exam info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-fluid-xl fluid-p-5 fluid-mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="fluid-text-sm text-blue-600 font-medium">Examen</p>
            <h3 className="font-semibold text-gray-900 mt-1 fluid-text-lg">{exam.name}</h3>
            <div className="flex items-center fluid-gap-4 fluid-mt-1 flex-wrap">
              <span className="fluid-text-sm font-mono text-gray-600">{exam.version}</span>
              {exam.competency_standard?.code && (
                <span className="fluid-text-sm text-gray-500">ECM: {exam.competency_standard.code}</span>
              )}
            </div>
          </div>
          <div className="flex items-center fluid-gap-6 fluid-text-sm text-gray-600">
            <div className="text-center">
              <p className="fluid-text-xl font-bold text-blue-700">{exam.exam_questions_count || 0}</p>
              <p className="fluid-text-xs text-gray-500">Preg. Examen</p>
            </div>
            <div className="text-center">
              <p className="fluid-text-xl font-bold text-purple-700">{exam.simulator_questions_count || 0}</p>
              <p className="fluid-text-xs text-gray-500">Preg. Simulador</p>
            </div>
            <div className="text-center">
              <p className="fluid-text-xl font-bold text-blue-700">{exam.exam_exercises_count || 0}</p>
              <p className="fluid-text-xs text-gray-500">Ejer. Examen</p>
            </div>
            <div className="text-center">
              <p className="fluid-text-xl font-bold text-purple-700">{exam.simulator_exercises_count || 0}</p>
              <p className="fluid-text-xs text-gray-500">Ejer. Simulador</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration form */}
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 fluid-mb-8">

        {/* Reintentos y Desconexiones */}
        <div className="fluid-mb-8">
          <h2 className="fluid-text-lg font-bold text-gray-900 fluid-mb-5 flex items-center fluid-gap-2">
            <svg className="fluid-icon-base text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Intentos y Desconexiones
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-6">
            {/* Reintentos */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Reintentos Permitidos
              </label>
              <div className="flex items-center fluid-gap-3">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(parseInt(e.target.value) || 1)}
                  className="w-24 fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
                />
                <span className="fluid-text-sm text-gray-500">intento(s)</span>
              </div>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                El candidato podrá realizar el examen hasta este número de veces
              </p>
            </div>

            {/* Desconexiones */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                Oportunidades de Desconexión
              </label>
              <div className="flex items-center fluid-gap-3">
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={maxDisconnections}
                  onChange={e => setMaxDisconnections(parseInt(e.target.value) || 0)}
                  className="w-24 fluid-px-4 fluid-py-2.5 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm"
                />
                <span className="fluid-text-sm text-gray-500">oportunidades</span>
              </div>
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                Veces que el candidato puede salir de pantalla o desconectarse antes de invalidar el examen
              </p>
            </div>
          </div>
        </div>

        {/* Tipo de contenido */}
        <div className="fluid-mb-8 border-t border-gray-100 fluid-pt-8">
          <h2 className="fluid-text-lg font-bold text-gray-900 fluid-mb-5 flex items-center fluid-gap-2">
            <svg className="fluid-icon-base text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Tipo de Contenido
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Define qué tipo de reactivos se incluirán cuando se asigne este examen
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 fluid-gap-4">
            {[
              { value: 'mixed', label: 'Mixto', desc: 'Preguntas y ejercicios interactivos', icon: (
                <svg className="fluid-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              )},
              { value: 'questions_only', label: 'Solo Preguntas', desc: 'Únicamente preguntas teóricas', icon: (
                <svg className="fluid-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { value: 'exercises_only', label: 'Solo Ejercicios', desc: 'Únicamente ejercicios interactivos', icon: (
                <svg className="fluid-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              )},
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setContentType(opt.value)}
                className={`fluid-p-5 rounded-fluid-xl border-2 text-left transition-all duration-200 ${
                  contentType === opt.value
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm text-gray-600'
                }`}
              >
                <div className={`fluid-mb-3 ${contentType === opt.value ? 'text-blue-600' : 'text-gray-400'}`}>
                  {opt.icon}
                </div>
                <p className="font-semibold fluid-text-base text-gray-900">{opt.label}</p>
                <p className="fluid-text-xs text-gray-500 fluid-mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Cantidades de contenido */}
        <div className="border-t border-gray-100 fluid-pt-8">
          <h2 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2 flex items-center fluid-gap-2">
            <svg className="fluid-icon-base text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            Cantidad de Contenido
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-6">
            Define cuántas preguntas y/o ejercicios se incluirán por defecto. Si no se especifica, se usan todas las disponibles.
          </p>

          <div className="fluid-space-y-6">
            {/* Examen section */}
            {contentType !== 'exercises_only' && (
              <div className="bg-blue-50 rounded-fluid-xl fluid-p-5 border border-blue-100">
                <h3 className="fluid-text-base font-semibold text-blue-800 fluid-mb-4 flex items-center fluid-gap-2">
                  <svg className="fluid-icon-sm text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cantidades — Examen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
                  {/* Preguntas examen */}
                  {(contentType === 'mixed' || contentType === 'questions_only') && (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Preguntas <span className="text-gray-400 font-normal ml-2">(Disponibles: {exam.exam_questions_count || 0})</span>
                      </label>
                      <label className="flex items-center fluid-gap-2 fluid-mb-2">
                        <input
                          type="checkbox"
                          checked={useAllExamQuestions}
                          onChange={e => {
                            setUseAllExamQuestions(e.target.checked)
                            if (e.target.checked) {
                              setExamQuestionsCount(null)
                            } else {
                              setExamQuestionsCount(exam.exam_questions_count || 0)
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="fluid-text-sm text-gray-700">Usar todas las preguntas ({exam.exam_questions_count || 0})</span>
                      </label>
                      {!useAllExamQuestions && (
                        <div className="flex items-center fluid-gap-2 fluid-mt-2">
                          <input
                            type="number"
                            min={1}
                            max={exam.exam_questions_count || 999}
                            value={examQuestionsCount || ''}
                            onChange={e => setExamQuestionsCount(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 fluid-text-sm"
                            placeholder={`Máx: ${exam.exam_questions_count || 0}`}
                          />
                          <span className="fluid-text-sm text-gray-500">de {exam.exam_questions_count || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Ejercicios examen */}
                  {(contentType === 'mixed' || contentType === 'exercises_only') && (
                    <div>
                      <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                        Ejercicios <span className="text-gray-400 font-normal ml-2">(Disponibles: {exam.exam_exercises_count || 0})</span>
                      </label>
                      <label className="flex items-center fluid-gap-2 fluid-mb-2">
                        <input
                          type="checkbox"
                          checked={useAllExamExercises}
                          onChange={e => {
                            setUseAllExamExercises(e.target.checked)
                            if (e.target.checked) {
                              setExamExercisesCount(null)
                            } else {
                              setExamExercisesCount(exam.exam_exercises_count || 0)
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="fluid-text-sm text-gray-700">Usar todos los ejercicios ({exam.exam_exercises_count || 0})</span>
                      </label>
                      {!useAllExamExercises && (
                        <div className="flex items-center fluid-gap-2 fluid-mt-2">
                          <input
                            type="number"
                            min={1}
                            max={exam.exam_exercises_count || 999}
                            value={examExercisesCount || ''}
                            onChange={e => setExamExercisesCount(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 fluid-text-sm"
                            placeholder={`Máx: ${exam.exam_exercises_count || 0}`}
                          />
                          <span className="fluid-text-sm text-gray-500">de {exam.exam_exercises_count || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Simulador section */}
            <div className="bg-purple-50 rounded-fluid-xl fluid-p-5 border border-purple-100">
              <h3 className="fluid-text-base font-semibold text-purple-800 fluid-mb-4 flex items-center fluid-gap-2">
                <svg className="fluid-icon-sm text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Cantidades — Simulador
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
                {/* Preguntas simulador */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Preguntas <span className="text-gray-400 font-normal ml-2">(Disponibles: {exam.simulator_questions_count || 0})</span>
                  </label>
                  <label className="flex items-center fluid-gap-2 fluid-mb-2">
                    <input
                      type="checkbox"
                      checked={useAllSimulatorQuestions}
                      onChange={e => {
                        setUseAllSimulatorQuestions(e.target.checked)
                        if (e.target.checked) {
                          setSimulatorQuestionsCount(null)
                        } else {
                          setSimulatorQuestionsCount(exam.simulator_questions_count || 0)
                        }
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="fluid-text-sm text-gray-700">Usar todas las preguntas ({exam.simulator_questions_count || 0})</span>
                  </label>
                  {!useAllSimulatorQuestions && (
                    <div className="flex items-center fluid-gap-2 fluid-mt-2">
                      <input
                        type="number"
                        min={1}
                        max={exam.simulator_questions_count || 999}
                        value={simulatorQuestionsCount || ''}
                        onChange={e => setSimulatorQuestionsCount(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 fluid-text-sm"
                        placeholder={`Máx: ${exam.simulator_questions_count || 0}`}
                      />
                      <span className="fluid-text-sm text-gray-500">de {exam.simulator_questions_count || 0}</span>
                    </div>
                  )}
                </div>
                {/* Ejercicios simulador */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    Ejercicios <span className="text-gray-400 font-normal ml-2">(Disponibles: {exam.simulator_exercises_count || 0})</span>
                  </label>
                  <label className="flex items-center fluid-gap-2 fluid-mb-2">
                    <input
                      type="checkbox"
                      checked={useAllSimulatorExercises}
                      onChange={e => {
                        setUseAllSimulatorExercises(e.target.checked)
                        if (e.target.checked) {
                          setSimulatorExercisesCount(null)
                        } else {
                          setSimulatorExercisesCount(exam.simulator_exercises_count || 0)
                        }
                      }}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="fluid-text-sm text-gray-700">Usar todos los ejercicios ({exam.simulator_exercises_count || 0})</span>
                  </label>
                  {!useAllSimulatorExercises && (
                    <div className="flex items-center fluid-gap-2 fluid-mt-2">
                      <input
                        type="number"
                        min={1}
                        max={exam.simulator_exercises_count || 999}
                        value={simulatorExercisesCount || ''}
                        onChange={e => setSimulatorExercisesCount(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-24 fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-purple-500 fluid-text-sm"
                        placeholder={`Máx: ${exam.simulator_exercises_count || 0}`}
                      />
                      <span className="fluid-text-sm text-gray-500">de {exam.simulator_exercises_count || 0}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end fluid-gap-3 fluid-mt-8 border-t border-gray-100 fluid-pt-6">
          <button
            type="button"
            onClick={() => navigate(`/exams/${id}/edit`)}
            className="fluid-px-5 fluid-py-2.5 text-gray-600 hover:text-gray-900 font-medium fluid-text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="fluid-px-6 fluid-py-2.5 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 rounded-fluid-xl font-semibold fluid-text-sm transition-colors flex items-center fluid-gap-2 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
          >
            {saving ? (
              <>
                <div className="animate-spin fluid-icon-sm border-2 border-white border-t-transparent rounded-full" />
                Guardando...
              </>
            ) : (
              <>
                <svg className="fluid-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExamConfigPage
