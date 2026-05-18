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
      <div className="bg-white rounded-lg border p-6 flex items-center justify-center text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando API Keys...
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">API Keys SSO</h3>
            <p className="text-xs text-gray-500">
              {keys.length} {keys.length === 1 ? 'llave' : 'llaves'} ·{' '}
              {meta?.enable_sso_api ? (
                <span className="text-green-700">SSO activo</span>
              ) : (
                <span className="text-gray-500">SSO inactivo</span>
              )}{' '}
              · TTL token: {meta?.token_ttl_minutes ?? 5} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdminLike(role) && meta && (
            <button
              onClick={() => handleToggleEnableSso(!meta.enable_sso_api)}
              disabled={working === 'enable_sso'}
              className={`px-3 py-1.5 text-xs font-medium rounded border flex items-center gap-1.5 ${
                meta.enable_sso_api
                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              {meta.enable_sso_api ? 'Desactivar SSO' : 'Activar SSO'}
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva API Key
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="m-4 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {/* Lista */}
      {keys.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">
          No hay API keys configuradas para este plantel.
          {isManager && ' Crea la primera para habilitar SSO desde sistemas externos.'}
        </div>
      ) : (
        <div className="divide-y">
          {keys.map((k) => {
            const isOpen = expanded.has(k.id)
            const revealedSecret = revealedSecrets[k.id]
            return (
              <div key={k.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleExpand(k.id)}
                    className="mt-1 text-gray-400 hover:text-gray-700"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{k.description}</span>
                      {k.name && (
                        <span className="text-xs text-gray-500">({k.name})</span>
                      )}
                      {k.is_legacy && (
                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                          Legacy
                        </span>
                      )}
                      {!k.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-600 font-mono">
                      <span>{k.api_key_prefix}…</span>
                      {revealedSecret && (
                        <>
                          <span className="text-gray-400">·</span>
                          <code className="bg-blue-50 px-2 py-0.5 rounded text-blue-900">
                            {revealedSecret}
                          </code>
                          <button
                            onClick={() => copyToClipboard(revealedSecret)}
                            className="text-gray-500 hover:text-gray-700"
                            title="Copiar"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-4">
                      <span>Usos: {k.usage_count}</span>
                      <span>Última conexión: {formatDate(k.last_used_at)}</span>
                      {k.last_used_ip && <span>IP: {k.last_used_ip}</span>}
                      <span>Plantillas: {k.assignment_count}</span>
                      <span>Creada: {formatDate(k.created_at)}</span>
                      {k.created_by && (
                        <span>
                          Por:{' '}
                          {k.created_by.full_name || k.created_by.username || k.created_by_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canReveal && (
                      <button
                        onClick={() => handleReveal(k.id)}
                        disabled={working === `reveal_${k.id}`}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        title={revealedSecret ? 'Ocultar' : 'Revelar'}
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
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title={k.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPendingAction({ kind: 'rotate', keyId: k.id })}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded"
                          title="Rotar secreto"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPendingAction({ kind: 'revoke', keyId: k.id })}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
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
                  <div className="mt-3 pl-7 space-y-2">
                    {(k.assignments?.length ?? 0) === 0 && (
                      <div className="text-xs text-gray-500 italic">
                        Sin plantillas configuradas. Al consumir esta api no se asignará ningún
                        examen automáticamente.
                      </div>
                    )}
                    {k.assignments?.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-2 p-2 bg-gray-50 rounded text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">
                            {a.exam?.name || `Examen #${a.exam_id}`}
                          </div>
                          <div className="text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                            <span>Tipo: {a.assignment_type}</span>
                            <span>Contenido: {a.exam_content_type || 'questions_only'}</span>
                            {a.passing_score != null && (
                              <span>Aprobatoria: {a.passing_score}%</span>
                            )}
                            {a.time_limit_minutes != null && (
                              <span>Tiempo: {a.time_limit_minutes} min</span>
                            )}
                            <span>Intentos: {a.max_attempts ?? 1}</span>
                            {a.validity_months && (
                              <span>Vigencia: {a.validity_months} meses</span>
                            )}
                          </div>
                        </div>
                        {isManager && !k.is_legacy && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingAssignment({ keyId: k.id, assignment: a })}
                              className="px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(k.id, a.id)}
                              className="px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {isManager && !k.is_legacy && (
                      <button
                        onClick={() => setAddingToKey(k.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Agregar examen a esta API key
                      </button>
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
