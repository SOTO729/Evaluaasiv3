import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import {
  officeResultsService,
  OfficeAuditFilters,
  OfficeExamResultDto,
} from '../../services/officeResultsService'
import { useAuthStore } from '../../store/authStore'

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'En progreso',
  completed: 'Finalizado',
  abandoned: 'Abandonado',
}

function formatDate(iso: string | null | undefined): string {
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

export default function OfficeResultsAuditPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [results, setResults] = useState<OfficeExamResultDto[]>([])
  const [summary, setSummary] = useState({ total: 0, passed: 0, in_progress: 0 })
  const [pagination, setPagination] = useState({ page: 1, pages: 1, per_page: 50 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<OfficeAuditFilters>({
    status: '',
    session_type: '',
    office_app: '',
    passed: undefined,
    search: '',
    date_from: '',
    date_to: '',
    page: 1,
    per_page: 50,
  })

  // Solo staff puede ver
  const isAllowed = useMemo(() => {
    const role = user?.role || ''
    return [
      'admin',
      'developer',
      'gerente',
      'financiero',
      'soporte',
      'coordinator',
      'auxiliar',
      'responsable',
      'responsable_partner',
      'responsable_estatal',
    ].includes(role)
  }, [user])

  const loadResults = async (overrides: Partial<OfficeAuditFilters> = {}) => {
    try {
      setLoading(true)
      setError(null)
      const merged = { ...filters, ...overrides }
      const data = await officeResultsService.listAudit(merged)
      setResults(data.results || [])
      setSummary(data.summary)
      setPagination({ page: data.page, pages: data.pages, per_page: data.per_page })
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al cargar resultados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAllowed) loadResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.status,
    filters.session_type,
    filters.office_app,
    filters.passed,
    filters.date_from,
    filters.date_to,
    filters.page,
    isAllowed,
  ])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadResults({ page: 1 })
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const blob = await officeResultsService.exportAuditCsv(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `office-results-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Error al exportar: ' + (e?.response?.data?.error || e.message))
    } finally {
      setExporting(false)
    }
  }

  if (!isAllowed) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          No tienes permiso para ver esta página.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Auditoría de exámenes Office</h1>
          <p className="text-sm text-gray-500">
            Resultados de exámenes, simuladores y parciales registrados desde la app Office.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || results.length === 0}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar CSV
        </button>
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

      {/* Filtros */}
      <form
        onSubmit={handleSearchSubmit}
        className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Usuario, email, nombre, código de certificado..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="completed">Finalizados</option>
            <option value="in_progress">En progreso</option>
            <option value="abandoned">Abandonados</option>
          </select>
          <select
            value={filters.office_app || ''}
            onChange={(e) => setFilters({ ...filters, office_app: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas las apps</option>
            <option value="word">Word</option>
            <option value="excel">Excel</option>
            <option value="powerpoint">PowerPoint</option>
            <option value="access">Access</option>
          </select>
          <select
            value={filters.session_type || ''}
            onChange={(e) => setFilters({ ...filters, session_type: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="examen">Examen</option>
            <option value="simulador">Simulador</option>
            <option value="parcial">Parcial</option>
          </select>
          <select
            value={filters.passed === undefined ? '' : filters.passed}
            onChange={(e) =>
              setFilters({
                ...filters,
                passed: e.target.value === '' ? undefined : (e.target.value as 'true' | 'false'),
                page: 1,
              })
            }
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Aprobados/reprobados</option>
            <option value="true">Solo aprobados</option>
            <option value="false">Solo reprobados</option>
          </select>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            title="Desde"
          />
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            title="Hasta"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            Buscar
          </button>
        </div>
      </form>

      {/* Resultados */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error}
          <button onClick={() => loadResults()} className="block mt-2 text-sm underline">
            Reintentar
          </button>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          Sin resultados con los filtros actuales.
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3">Candidato</th>
                    <th className="text-left px-4 py-3">App / Nivel</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-right px-4 py-3">Puntaje</th>
                    <th className="text-left px-4 py-3">Iniciado</th>
                    <th className="text-left px-4 py-3">Certificado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((r) => {
                    const isPassed = r.passed && r.status === 'completed'
                    const isInProgress = r.status === 'in_progress'
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">
                            {r.user?.name || r.user?.username || r.user_id}
                          </div>
                          <div className="text-xs text-gray-500">{r.user?.email}</div>
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {r.office_app || '—'}
                          {r.level && (
                            <span className="text-xs text-gray-500"> · {r.level}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {r.session_type || '—'}
                          {r.parcial_session_number && (
                            <span className="text-xs text-purple-700 ml-1">
                              S{r.parcial_session_number}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-semibold ${
                              isPassed
                                ? 'text-green-600'
                                : isInProgress
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {r.score ?? '—'}
                          </span>
                          <span className="text-xs text-gray-400"> / {r.passing_score}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {formatDate(r.started_at)}
                        </td>
                        <td className="px-4 py-3">
                          {r.certificate_code ? (
                            <code className="text-xs font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                              {r.certificate_code}
                            </code>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-500">
                Página {pagination.page} de {pagination.pages} · {summary.total} resultados
              </div>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
