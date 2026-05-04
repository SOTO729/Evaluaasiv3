import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { downloadsService, OfficeApp } from '../../services/downloadsService'
import { useAuthStore } from '../../store/authStore'

const APP_TYPES = ['examen', 'simulador', 'parcial'] as const

type FormState = {
  id: number | null
  app_name: string
  app_type: string
  min_version: string
  latest_version: string
  download_url: string
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  app_name: '',
  app_type: 'examen',
  min_version: '',
  latest_version: '',
  download_url: '',
  is_active: true,
}

export default function OfficeAppsAdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'developer'

  const [apps, setApps] = useState<OfficeApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploading, setUploading] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<OfficeApp | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const loadApps = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await downloadsService.getOfficeApps()
      setApps(data.apps || [])
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error cargando aplicaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) loadApps()
  }, [isAdmin])

  const grouped = useMemo(() => {
    const groups: Record<string, OfficeApp[]> = {}
    for (const a of apps) {
      const k = a.app_type || 'otros'
      if (!groups[k]) groups[k] = []
      groups[k].push(a)
    }
    return groups
  }, [apps])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setUploadFile(null)
    setUploadPct(0)
    setShowForm(true)
  }

  const openEdit = (app: OfficeApp) => {
    setForm({
      id: app.id,
      app_name: app.app_name,
      app_type: app.app_type,
      min_version: app.min_version || '',
      latest_version: app.latest_version || '',
      download_url: app.download_url || '',
      is_active: app.is_active,
    })
    setUploadFile(null)
    setUploadPct(0)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(EMPTY_FORM)
    setUploadFile(null)
    setUploadPct(0)
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    try {
      setUploading(true)
      setUploadPct(0)
      const res = await downloadsService.uploadOfficeAppFile(uploadFile, (pct) =>
        setUploadPct(pct),
      )
      setForm((prev) => ({ ...prev, download_url: res.url }))
      showToast('success', `Archivo subido (${(res.size_bytes / (1024 * 1024)).toFixed(1)} MB)`)
      setUploadFile(null)
    } catch (e: any) {
      showToast('error', e?.response?.data?.error || 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.app_name.trim()) {
      showToast('error', 'El nombre de la app es requerido')
      return
    }
    if (!form.app_type) {
      showToast('error', 'El tipo es requerido')
      return
    }
    try {
      setSaving(true)
      const payload: Partial<OfficeApp> = {
        app_name: form.app_name.trim(),
        app_type: form.app_type,
        min_version: form.min_version.trim() || null,
        latest_version: form.latest_version.trim() || null,
        download_url: form.download_url.trim() || null,
        is_active: form.is_active,
      }
      if (form.id) {
        await downloadsService.updateOfficeApp(form.id, payload)
        showToast('success', 'Aplicación actualizada')
      } else {
        await downloadsService.createOfficeApp(payload)
        showToast('success', 'Aplicación creada')
      }
      closeForm()
      await loadApps()
    } catch (e: any) {
      showToast('error', e?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      setDeleting(true)
      await downloadsService.deleteOfficeApp(confirmDelete.id)
      showToast('success', 'Aplicación desactivada')
      setConfirmDelete(null)
      await loadApps()
    } catch (e: any) {
      showToast('error', e?.response?.data?.error || 'Error al desactivar')
    } finally {
      setDeleting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
          <AlertCircle className="h-6 w-6 mb-2" />
          Esta sección está restringida a administradores.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Aplicaciones Office (catálogo)</h1>
          <p className="text-sm text-gray-500">
            Gestión de instaladores VB6 que los planteles descargan desde
            <span className="font-mono mx-1">/downloads</span>.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva aplicación
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-xl p-3 text-sm flex items-start gap-2 ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Aviso coexistencia legacy */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium">Coexistencia con app legacy</p>
        <p className="mt-1">
          Estos instaladores son para la nueva plataforma (Motor V2). Los EXEs legacy ya
          desplegados en planteles siguen funcionando y no se ven afectados. Distribuye versiones
          nuevas en paralelo y migra plantel por plantel.
        </p>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          {error}
          <button onClick={loadApps} className="block mt-2 text-sm underline">
            Reintentar
          </button>
        </div>
      ) : apps.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500 font-medium">Aún no hay aplicaciones registradas</p>
          <p className="text-sm text-gray-400 mt-1">
            Sube un instalador para que los planteles puedan descargarlo.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type}>
              <h2 className="text-lg font-semibold text-gray-800 capitalize mb-3">
                {type}{' '}
                <span className="text-xs text-gray-400 font-normal">({list.length})</span>
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Versiones
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        URL
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {list.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {app.app_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>min: {app.min_version || '—'}</div>
                          <div>latest: {app.latest_version || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {app.download_url ? (
                            <a
                              href={app.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary-600 hover:underline truncate max-w-[260px]"
                              title={app.download_url}
                            >
                              <LinkIcon className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{app.download_url}</span>
                            </a>
                          ) : (
                            <span className="text-gray-400">— sin archivo —</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              app.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {app.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button
                            onClick={() => openEdit(app)}
                            className="inline-flex items-center gap-1 text-primary-600 hover:bg-primary-50 px-2 py-1 rounded transition-colors mr-2"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(app)}
                            className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Desactivar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                {form.id ? 'Editar aplicación' : 'Nueva aplicación'}
              </h3>
              <button
                onClick={closeForm}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre interno (único) *
                </label>
                <input
                  type="text"
                  value={form.app_name}
                  onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                  placeholder="EvaluadorExcel2019Basico"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Este nombre identifica el EXE del lado VB6 (incluye versión Office y nivel).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={form.app_type}
                    onChange={(e) => setForm({ ...form, app_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {APP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Activa (visible para candidatos)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Versión mínima requerida
                  </label>
                  <input
                    type="text"
                    value={form.min_version}
                    onChange={(e) => setForm({ ...form, min_version: e.target.value })}
                    placeholder="2.0.0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Última versión
                  </label>
                  <input
                    type="text"
                    value={form.latest_version}
                    onChange={(e) => setForm({ ...form, latest_version: e.target.value })}
                    placeholder="2.0.3"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Upload */}
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subir instalador (EXE / MSI / ZIP / 7Z, máx 200 MB)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".exe,.msi,.zip,.rar,.7z"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="text-sm flex-1"
                  />
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || uploading}
                    className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Subir
                  </button>
                </div>
                {uploading && (
                  <div className="mt-2">
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary-600 h-2 transition-all"
                        style={{ width: `${uploadPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{uploadPct}%</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL de descarga
                </label>
                <input
                  type="url"
                  value={form.download_url}
                  onChange={(e) => setForm({ ...form, download_url: e.target.value })}
                  placeholder="https://...blob.core.windows.net/evaluaasi-files/office-apps/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Se rellena automáticamente al subir un archivo, pero puedes pegar una URL externa.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {form.id ? 'Guardar cambios' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {confirmDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Desactivar aplicación</h3>
              <p className="text-sm text-gray-500 mt-1">{confirmDelete.app_name}</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">
                Los candidatos dejarán de ver esta aplicación en el catálogo de descargas. El
                registro se mantiene para conservar histórico — puedes reactivarlo editándolo.
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
