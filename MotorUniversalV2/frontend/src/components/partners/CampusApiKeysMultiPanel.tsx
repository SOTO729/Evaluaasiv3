/**
 * Panel multi-API-keys SSO para un plantel.
 *
 * Reemplaza al panel 1:1 (`CampusApiKeyPanel`). Soporta múltiples api keys
 * por plantel; cada una con su descripción, contadores de uso y una lista
 * de plantillas de asignación (exámenes que se materializan en el grupo
 * destino al consumir la api).
 *
 * Permisos:
 * - admin / developer / coordinator-of-campus / auxiliar: gestionar todo.
 * - responsable: solo ver. Puede revelar el secreto si `can_manage_groups`.
 */
import { useEffect, useState } from 'react'
import {
  Key,
  Plus,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Power,
  Clock,
  Target,
  FileText,
  Activity,
  ShieldCheck,
  BookOpen,
  Pencil,
  CalendarDays,
} from 'lucide-react'
import {
  ssoApiKeysService,
  CampusApiKeyRow,
  CampusApiKeyWithSecret,
  ApiKeyAssignment,
} from '../../services/ssoApiKeysService'
import { ssoService, SsoApiKeyInfo } from '../../services/ssoService'
import { useAuthStore } from '../../store/authStore'
import ApiKeyWizardModal from './ApiKeyWizardModal'

interface Props {
  campusId: number
  campusName?: string
  /** Si true, oculta acciones de gestión. */
  responsableMode?: boolean
  /** Solo aplica a responsable: permite revelar si `true`. */
  canManageGroups?: boolean
}

type Role = string | undefined
const isAdminLike = (r: Role) => r === 'admin' || r === 'developer'

export default function CampusApiKeysMultiPanel({
  campusId,
  responsableMode,
  canManageGroups,
}: Props) {
  const { user } = useAuthStore()
  const role = user?.role
  const isManager =
    !responsableMode &&
    (isAdminLike(role) || role === 'coordinator' || role === 'auxiliar')
  const canReveal =
    isManager ||
    (role === 'responsable' && canManageGroups === true) ||
    isAdminLike(role)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keys, setKeys] = useState<CampusApiKeyRow[]>([])
  const [meta, setMeta] = useState<{ enable_sso_api: boolean; token_ttl_minutes: number } | null>(
    null,
  )

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [revealedSecrets, setRevealedSecrets] = useState<Record<number, string>>({})
  const [working, setWorking] = useState<string | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<{
    keyId: number
    assignment: ApiKeyAssignment
  } | null>(null)
  const [addingToKey, setAddingToKey] = useState<number | null>(null)

  // Step-up para rotate/revoke/reveal
  const [pendingAction, setPendingAction] = useState<{
    kind: 'rotate' | 'revoke' | 'reveal'
    keyId: number
  } | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Nuevo secreto recién creado / rotado
  const [newSecret, setNewSecret] = useState<CampusApiKeyWithSecret | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const resp = await ssoApiKeysService.list(campusId)
      setKeys(resp.api_keys)
      setMeta({ enable_sso_api: resp.enable_sso_api, token_ttl_minutes: resp.token_ttl_minutes })
      setError(null)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cargar la información')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusId])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  const handleToggleEnableSso = async (enabled: boolean) => {
    if (!isAdminLike(role)) return
    setWorking('enable_sso')
    try {
      const result = await ssoService.setEnableSsoApi(campusId, enabled)
      setMeta((prev) =>
        prev ? { ...prev, enable_sso_api: result.enable_sso_api } : prev,
      )
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cambiar el estado')
    } finally {
      setWorking(null)
    }
  }

  const handleReveal = async (keyId: number) => {
    if (revealedSecrets[keyId]) {
      setRevealedSecrets((prev) => {
        const { [keyId]: _, ...rest } = prev
        return rest
      })
      return
    }
    setWorking(`reveal_${keyId}`)
    try {
      const resp = await ssoApiKeysService.reveal(keyId)
      if (resp.api_key) {
        setRevealedSecrets((prev) => ({ ...prev, [keyId]: resp.api_key! }))
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo revelar el secreto')
    } finally {
      setWorking(null)
    }
  }

  const runStepUpAction = async () => {
    if (!pendingAction) return
    setPasswordError(null)
    setWorking(`${pendingAction.kind}_${pendingAction.keyId}`)
    try {
      if (pendingAction.kind === 'rotate') {
        const resp = await ssoApiKeysService.rotate(pendingAction.keyId, passwordInput)
        setNewSecret(resp)
        await load()
      } else if (pendingAction.kind === 'revoke') {
        await ssoApiKeysService.revoke(pendingAction.keyId, passwordInput)
        await load()
      }
      setPendingAction(null)
      setPasswordInput('')
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Operación rechazada'
      setPasswordError(msg)
    } finally {
      setWorking(null)
    }
  }

  const handleToggleActive = async (key: CampusApiKeyRow) => {
    setWorking(`toggle_${key.id}`)
    try {
      await ssoApiKeysService.update(key.id, { is_active: !key.is_active })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo cambiar el estado')
    } finally {
      setWorking(null)
    }
  }

  const handleDeleteAssignment = async (keyId: number, assignmentId: number) => {
    if (!confirm('¿Eliminar esta plantilla de la api key?')) return
    setWorking(`del_assign_${assignmentId}`)
    try {
      await ssoApiKeysService.deleteAssignment(keyId, assignmentId)
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo eliminar')
    } finally {
      setWorking(null)
    }
  }

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex items-center justify-center text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando API Keys SSO...
      </div>
    )
  }

  const totalAssignments = keys.reduce((acc, k) => acc + (k.assignment_count || 0), 0)
  const activeKeys = keys.filter((k) => k.is_active).length
  const legacyKeys = keys.filter((k) => k.is_legacy).length

  const contentTypeLabel = (t?: string | null) => {
    switch (t) {
      case 'questions_only':
        return 'Reactivos'
      case 'exercises_only':
        return 'Ejercicios'
      case 'mixed':
        return 'Mixto'
      default:
        return t || 'Reactivos'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header con gradiente */}
      <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 via-white to-blue-50 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">API Keys SSO</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Acceso de sistemas externos a este plantel mediante llaves seguras.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdminLike(role) && meta && (
              <button
                onClick={() => handleToggleEnableSso(!meta.enable_sso_api)}
                disabled={working === 'enable_sso'}
                className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition ${
                  meta.enable_sso_api
                    ? 'border-red-200 text-red-700 bg-white hover:bg-red-50'
                    : 'border-green-200 text-green-700 bg-white hover:bg-green-50'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {meta.enable_sso_api ? 'Desactivar SSO' : 'Activar SSO'}
              </button>
            )}
            {isManager && meta?.enable_sso_api && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Nueva API Key
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="px-3 py-2.5 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-medium text-gray-500">
              <Activity className="w-3.5 h-3.5" />
              Estado
            </div>
            <div className="mt-1 text-sm font-semibold">
              {meta?.enable_sso_api ? (
                <span className="text-green-700 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Activo
                </span>
              ) : (
                <span className="text-gray-500 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactivo
                </span>
              )}
            </div>
          </div>
          <div className="px-3 py-2.5 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-medium text-gray-500">
              <Key className="w-3.5 h-3.5" />
              Llaves
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {activeKeys}
              <span className="text-gray-400 font-normal"> / {keys.length}</span>
              {legacyKeys > 0 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                  {legacyKeys} legacy
                </span>
              )}
            </div>
          </div>
          <div className="px-3 py-2.5 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-medium text-gray-500">
              <FileText className="w-3.5 h-3.5" />
              Plantillas
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{totalAssignments}</div>
          </div>
          <div className="px-3 py-2.5 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide font-medium text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              TTL token
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {meta?.token_ttl_minutes ?? 5} min
            </div>
          </div>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Aviso: módulo SSO deshabilitado */}
      {meta && !meta.enable_sso_api && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-medium">Módulo SSO API desactivado.</span> No se pueden
            crear ni usar API keys hasta activarlo.{' '}
            {isAdminLike(role)
              ? 'Usa el botón "Activar SSO" o el toggle en la edición del plantel.'
              : 'Solicita a un administrador que active el módulo SSO del plantel.'}
          </div>
        </div>
      )}

      {/* Lista */}
      {keys.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Key className="w-6 h-6 text-gray-400" />
          </div>
          <div className="text-sm font-medium text-gray-700">
            No hay API keys configuradas
          </div>
          {isManager && meta?.enable_sso_api && (
            <div className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Crea la primera para habilitar SSO desde sistemas externos. Cada llave puede tener
              su propio conjunto de exámenes y configuración.
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {keys.map((k) => {
            const isOpen = expanded.has(k.id)
            const revealedSecret = revealedSecrets[k.id]
            const stateColor = !k.is_active
              ? 'border-l-gray-300'
              : k.is_legacy
              ? 'border-l-amber-400'
              : 'border-l-emerald-500'
            return (
              <div
                key={k.id}
                className={`bg-white rounded-lg border border-gray-200 border-l-4 ${stateColor} hover:shadow-sm transition`}
              >
                {/* Encabezado de la llave */}
                <div className="px-4 py-3 flex items-start gap-3">
                  <button
                    onClick={() => toggleExpand(k.id)}
                    className="mt-0.5 p-1 -ml-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition"
                    aria-label={isOpen ? 'Colapsar' : 'Expandir'}
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{k.description}</span>
                      {k.name && (
                        <span className="text-xs text-gray-500">· {k.name}</span>
                      )}
                      {k.is_legacy && (
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-amber-100 text-amber-800 rounded">
                          Legacy
                        </span>
                      )}
                      {k.assignment_mode === 'api' && (
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-indigo-100 text-indigo-800 rounded">
                          Vía API · estándar
                        </span>
                      )}
                      {!k.is_active ? (
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-gray-200 text-gray-700 rounded">
                          Inactiva
                        </span>
                      ) : !k.is_legacy ? (
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-emerald-100 text-emerald-800 rounded inline-flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-600" />
                          Activa
                        </span>
                      ) : null}
                    </div>

                    {/* Secreto / prefijo */}
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                        {k.api_key_prefix}…
                      </code>
                      {revealedSecret && (
                        <>
                          <code className="font-mono text-xs px-2 py-0.5 bg-indigo-50 rounded text-indigo-900 border border-indigo-100 break-all">
                            {revealedSecret}
                          </code>
                          <button
                            onClick={() => copyToClipboard(revealedSecret)}
                            className="text-gray-500 hover:text-indigo-600 p-1 rounded hover:bg-gray-100"
                            title="Copiar"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {k.usage_count} usos
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {k.last_used_at ? `Última: ${formatDate(k.last_used_at)}` : 'Nunca usada'}
                      </span>
                      {k.last_used_ip && (
                        <span className="font-mono">IP: {k.last_used_ip}</span>
                      )}
                      {k.assignment_mode === 'api' ? (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Estándar vía API
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {k.assignment_count} plantillas
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> Creada {formatDate(k.created_at)}
                      </span>
                      {k.created_by && (
                        <span>
                          por {k.created_by.full_name || k.created_by.username || k.created_by_id}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canReveal && (
                      <button
                        onClick={() => handleReveal(k.id)}
                        disabled={working === `reveal_${k.id}`}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                        title={revealedSecret ? 'Ocultar secreto' : 'Revelar secreto'}
                      >
                        {revealedSecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {isManager && (
                      <>
                        <button
                          onClick={() => handleToggleActive(k)}
                          disabled={working === `toggle_${k.id}`}
                          className={`p-1.5 rounded transition ${
                            k.is_active
                              ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                          }`}
                          title={k.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPendingAction({ kind: 'rotate', keyId: k.id })}
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                          title="Rotar secreto"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPendingAction({ kind: 'revoke', keyId: k.id })}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition"
                          title="Revocar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Asignaciones */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/40">
                    {k.assignment_mode === 'api' ? (
                      <div className="mt-3 px-3 py-3 text-xs text-indigo-900 bg-indigo-50 rounded-lg border border-indigo-200 flex gap-2">
                        <BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-600" />
                        <div>
                          Esta API key asigna el examen <strong>según el estándar</strong> que envíe
                          el sistema externo (parámetro <code className="font-mono">estandar</code> en{' '}
                          <code className="font-mono">/generar_token</code>). No se configuran
                          plantillas desde la plataforma.
                        </div>
                      </div>
                    ) : (
                    <>
                    <div className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mt-3 mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3" />
                      Plantillas de examen ({k.assignments?.length ?? 0})
                    </div>
                    {(k.assignments?.length ?? 0) === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-500 italic bg-white rounded-lg border border-dashed border-gray-200">
                        Sin plantillas configuradas. Al consumir esta API no se asignará ningún
                        examen automáticamente.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {k.assignments?.map((a) => (
                          <div
                            key={a.id}
                            className="p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                  {a.exam?.name || `Examen #${a.exam_id}`}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    <BookOpen className="w-3 h-3" />
                                    {contentTypeLabel(a.exam_content_type)}
                                  </span>
                                  {a.time_limit_minutes != null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                                      <Clock className="w-3 h-3" />
                                      {a.time_limit_minutes} min
                                    </span>
                                  )}
                                  {a.passing_score != null && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                      <Target className="w-3 h-3" />
                                      {a.passing_score}% aprob.
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                    <RefreshCw className="w-3 h-3" />
                                    {a.max_attempts ?? 1} intento{(a.max_attempts ?? 1) === 1 ? '' : 's'}
                                  </span>
                                  {a.validity_months && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                      <CalendarDays className="w-3 h-3" />
                                      Vigencia {a.validity_months} {a.validity_months === 1 ? 'mes' : 'meses'}
                                    </span>
                                  )}
                                  {a.require_security_pin && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                      <ShieldCheck className="w-3 h-3" />
                                      PIN requerido
                                    </span>
                                  )}
                                  {(() => {
                                    const ct = (a as any).certificate_type || 'eduit'
                                    const map: Record<string, { label: string; cls: string }> = {
                                      conocer: { label: 'Cert. CONOCER', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                      eduit: { label: 'Cert. EDUIT', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                                      badge: { label: 'Insignia digital', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                                      none: { label: 'Sin certificado', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
                                    }
                                    const m = map[ct] || map.eduit
                                    return (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border ${m.cls}`}>
                                        {m.label}
                                      </span>
                                    )
                                  })()}
                                </div>
                              </div>
                              {isManager && !k.is_legacy && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => setEditingAssignment({ keyId: k.id, assignment: a })}
                                    className="px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 rounded inline-flex items-center gap-1"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAssignment(k.id, a.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isManager && !k.is_legacy && k.assignment_mode !== 'api' && (
                      <button
                        onClick={() => setAddingToKey(k.id)}
                        className="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-indigo-50 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar examen a esta API key
                      </button>
                    )}
                    </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal step-up */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-semibold text-gray-900">
                {pendingAction.kind === 'rotate'
                  ? 'Rotar secreto'
                  : pendingAction.kind === 'revoke'
                  ? 'Revocar API Key'
                  : 'Revelar secreto'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {pendingAction.kind === 'rotate'
                ? 'Se generará un secreto nuevo y el actual quedará inválido. Tendrás que actualizar el sistema externo.'
                : pendingAction.kind === 'revoke'
                ? 'La api key dejará de funcionar inmediatamente. Esta acción no se puede deshacer.'
                : 'Confirma tu contraseña para revelar el secreto.'}
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2"
            />
            {passwordError && (
              <div className="text-sm text-red-700 mb-2">{passwordError}</div>
            )}
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  setPendingAction(null)
                  setPasswordInput('')
                  setPasswordError(null)
                }}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={runStepUpAction}
                disabled={!passwordInput || !!working}
                className={`px-3 py-1.5 text-sm text-white rounded ${
                  pendingAction.kind === 'revoke'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                } disabled:bg-gray-300`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: secreto nuevo */}
      {newSecret && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-5 h-5 text-green-600" />
              <h3 className="text-base font-semibold text-gray-900">
                API Key {newSecret.warning ? 'rotada' : 'creada'}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 mb-3">
              <strong>Guarda este secreto ahora.</strong> No volverás a verlo después de cerrar.
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-100 rounded font-mono text-sm break-all">
              <span className="flex-1">{newSecret.api_key}</span>
              <button
                onClick={() => copyToClipboard(newSecret.api_key || '')}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                onClick={() => setNewSecret(null)}
                className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wizard modal */}
      {showCreateModal && (
        <ApiKeyWizardModal
          mode={{ kind: 'create-key', campusId }}
          campusId={campusId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(result) => {
            setShowCreateModal(false)
            if ((result as CampusApiKeyWithSecret).api_key) {
              setNewSecret(result as CampusApiKeyWithSecret)
            }
            load()
          }}
        />
      )}
      {addingToKey !== null && (
        <ApiKeyWizardModal
          mode={{ kind: 'add-assignment', apiKeyId: addingToKey }}
          campusId={campusId}
          onClose={() => setAddingToKey(null)}
          onSuccess={() => {
            setAddingToKey(null)
            load()
          }}
        />
      )}
      {editingAssignment && (
        <ApiKeyWizardModal
          mode={{
            kind: 'edit-assignment',
            apiKeyId: editingAssignment.keyId,
            assignment: editingAssignment.assignment,
          }}
          campusId={campusId}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            setEditingAssignment(null)
            load()
          }}
        />
      )}
    </div>
  )
}
