import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Award,
  Copy,
  FileText,
  Filter,
} from 'lucide-react'
import { officeResultsService, OfficeExamResultDto } from '../../services/officeResultsService'

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'En progreso',
  completed: 'Finalizado',
  abandoned: 'Abandonado',
}

const APP_LABEL: Record<string, string> = {
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  access: 'Access',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function MisExamenesOfficePage() {
  const navigate = useNavigate()
  const [results, setResults] = useState<OfficeExamResultDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState({ total: 0, passed: 0, in_progress: 0 })
  const [filters, setFilters] = useState<{ status: string; office_app: string; session_type: string }>(
    { status: '', office_app: '', session_type: '' },
  )
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  const loadResults = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await officeResultsService.listMine({
        status: filters.status || undefined,
        office_app: filters.office_app || undefined,
        session_type: filters.session_type || undefined,
      })
      setResults(data.results || [])
      setSummary({ total: data.total, passed: data.passed, in_progress: data.in_progress })
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al cargar resultados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.office_app, filters.session_type])

  const groupedByApp = useMemo(() => {
    const groups: Record<string, OfficeExamResultDto[]> = {}
    for (const r of results) {
      const key = r.office_app || 'sin app'
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    }
    return groups
  }, [results])

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyMsg(`Código copiado: ${code}`)
      setTimeout(() => setCopyMsg(null), 2500)
    } catch {
      setCopyMsg('No se pudo copiar')
      setTimeout(() => setCopyMsg(null), 2500)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis exámenes de Office</h1>
          <p className="text-sm text-gray-500">
            Resultados de exámenes, simuladores y parciales realizados desde la app local Office.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs uppercase text-gray-500 font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{summary.total}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs uppercase text-green-700 font-medium">Aprobados</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{summary.passed}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs uppercase text-amber-700 font-medium">En progreso</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.in_progress}</p>
        </div>
      </div>

      {copyMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          {copyMsg}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Todos los estados</option>
          <option value="completed">Finalizados</option>
          <option value="in_progress">En progreso</option>
          <option value="abandoned">Abandonados</option>
        </select>
        <select
          value={filters.office_app}
          onChange={(e) => setFilters({ ...filters, office_app: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Todas las apps</option>
          <option value="word">Word</option>
          <option value="excel">Excel</option>
          <option value="powerpoint">PowerPoint</option>
          <option value="access">Access</option>
        </select>
        <select
          value={filters.session_type}
          onChange={(e) => setFilters({ ...filters, session_type: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">Todos los tipos</option>
          <option value="examen">Examen</option>
          <option value="simulador">Simulador</option>
          <option value="parcial">Parcial</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error}
          <button onClick={loadResults} className="block mt-2 text-sm underline">
            Reintentar
          </button>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aún no tienes resultados de Office</p>
          <p className="text-sm text-gray-400 mt-1">
            Los resultados se registran automáticamente cuando termines un examen, simulador o
            parcial desde la app de Office.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByApp).map(([app, list]) => (
            <div key={app}>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                {APP_LABEL[app] || app}{' '}
                <span className="text-xs text-gray-400 font-normal">({list.length})</span>
              </h2>
              <div className="space-y-3">
                {list.map((r) => {
                  const isPassed = r.passed && r.status === 'completed'
                  const isInProgress = r.status === 'in_progress'
                  return (
                    <div
                      key={r.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-base font-semibold text-gray-800">
                              {APP_LABEL[r.office_app || ''] || r.office_app || 'Sin app'}{' '}
                              {r.level && (
                                <span className="text-sm text-gray-500 font-normal">
                                  · {r.level}
                                </span>
                              )}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                              {r.session_type || '—'}
                            </span>
                            {r.parcial_session_number && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                Sesión {r.parcial_session_number}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                isPassed
                                  ? 'bg-green-100 text-green-700'
                                  : isInProgress
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {isPassed && <CheckCircle2 className="h-3 w-3" />}
                              {isInProgress && <Clock className="h-3 w-3" />}
                              {!isPassed && !isInProgress && <XCircle className="h-3 w-3" />}
                              {STATUS_LABEL[r.status] || r.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Iniciado: {formatDate(r.started_at)}{' '}
                            {r.finished_at && <> · Finalizado: {formatDate(r.finished_at)}</>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Duración: {formatDuration(r.duration_seconds)}
                            {r.app_version && <> · App: v{r.app_version}</>}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-500">Puntaje</p>
                          <p
                            className={`text-2xl font-bold ${
                              isPassed
                                ? 'text-green-600'
                                : isInProgress
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {r.score ?? '—'}
                          </p>
                          <p className="text-xs text-gray-400">
                            mín: {r.passing_score} / 1000
                          </p>
                        </div>
                      </div>

                      {/* Certificado */}
                      {isPassed && r.certificate_code && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-sm">
                            <Award className="h-4 w-4 text-green-600" />
                            <span className="text-gray-700">Código de certificado:</span>
                            <code className="font-mono text-sm text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                              {r.certificate_code}
                            </code>
                          </div>
                          <button
                            onClick={() => handleCopyCode(r.certificate_code!)}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:bg-primary-50 px-2 py-1 rounded transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                            Copiar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
