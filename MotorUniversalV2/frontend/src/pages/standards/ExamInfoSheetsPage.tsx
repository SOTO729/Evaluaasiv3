/**
 * Gestión de Fichas Informativas (PDF "Conoce más") para exámenes del catálogo Modelo Directo.
 * Roles: admin, developer, editor, editor_invitado, coordinator.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, Eye, Search, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { examService } from '../../services/examService'
import { directService } from '../../services/directService'
import InfoSheetModal from '../../components/catalog/InfoSheetModal'
import { useAuthStore } from '../../store/authStore'
import type { Exam } from '../../types'

type ExamWithSheet = Exam & {
  info_sheet_url?: string | null
  is_public_catalog?: boolean
  direct_price_mxn?: number | null
}

export default function ExamInfoSheetsPage() {
  const { user } = useAuthStore()
  const [exams, setExams] = useState<ExamWithSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyCatalog, setOnlyCatalog] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  const allowed = useMemo(() => {
    const role = user?.role || ''
    return ['admin', 'developer', 'editor', 'editor_invitado', 'coordinator'].includes(role)
  }, [user])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await examService.getExams(1, 200, search)
      const list = (res.exams || res.items || []) as ExamWithSheet[]
      setExams(list)
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudieron cargar los exámenes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (allowed) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  const filtered = useMemo(() => {
    let list = exams
    if (onlyCatalog) list = list.filter(e => e.is_public_catalog === true)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter(e => (e.name || '').toLowerCase().includes(s))
    }
    return list
  }, [exams, onlyCatalog, search])

  const handleUpload = async (exam: ExamWithSheet, file: File) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Sólo se admiten archivos PDF')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('El archivo excede 20 MB')
      return
    }
    setError(null)
    setOkMsg(null)
    setBusyId(exam.id)
    try {
      const res = await directService.uploadInfoSheet(exam.id, file)
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, info_sheet_url: res.info_sheet_url } : e))
      setOkMsg(`Ficha actualizada para "${exam.name}"`)
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Error subiendo el PDF')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (exam: ExamWithSheet) => {
    if (!confirm(`¿Eliminar la ficha informativa de "${exam.name}"?`)) return
    setBusyId(exam.id)
    setError(null)
    setOkMsg(null)
    try {
      await directService.deleteInfoSheet(exam.id)
      setExams(prev => prev.map(e => e.id === exam.id ? { ...e, info_sheet_url: null } : e))
      setOkMsg('Ficha eliminada')
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Error eliminando el PDF')
    } finally {
      setBusyId(null)
    }
  }

  if (!allowed) {
    return (
      <div className="p-6 text-center text-red-600">
        No tienes permisos para acceder a esta sección.
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Link to="/standards" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-700">
          <ArrowLeft size={16} /> Volver a Estándares
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Fichas Informativas</h1>
        <p className="text-gray-600">
          PDF "Conoce más" que se muestra en el catálogo público. Una ficha por examen.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
          <input
            type="checkbox"
            checked={onlyCatalog}
            onChange={(e) => setOnlyCatalog(e.target.checked)}
            className="rounded"
          />
          Sólo exámenes del catálogo público
        </label>
        <button
          onClick={load}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refrescar
        </button>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {okMsg && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={18} /> {okMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500"><Loader2 className="animate-spin inline mr-2" />Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No hay exámenes que coincidan.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Examen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Catálogo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ficha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((exam) => {
                const hasSheet = !!exam.info_sheet_url
                const busy = busyId === exam.id
                return (
                  <tr key={exam.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{exam.name}</div>
                      <div className="text-xs text-gray-500">ID #{exam.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      {exam.is_public_catalog ? (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Público</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Interno</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasSheet ? (
                        <span className="inline-flex items-center gap-1 text-green-700 text-sm">
                          <FileText size={14} /> Cargada
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Sin ficha</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {hasSheet && (
                          <button
                            onClick={() => setPreview({ url: exam.info_sheet_url!, title: exam.name })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                            title="Vista previa"
                          >
                            <Eye size={14} /> Ver
                          </button>
                        )}
                        <label className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg cursor-pointer ${
                          busy ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}>
                          {busy ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                          {hasSheet ? 'Reemplazar' : 'Subir PDF'}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            disabled={busy}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleUpload(exam, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                        {hasSheet && (
                          <button
                            onClick={() => handleDelete(exam)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                            title="Eliminar ficha"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <InfoSheetModal
        open={!!preview}
        pdfUrl={preview?.url || null}
        title={preview?.title}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}
