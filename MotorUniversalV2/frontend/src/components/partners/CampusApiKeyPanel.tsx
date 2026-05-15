/**
 * Panel para gestionar la API Key SSO de un plantel.
 *
 * - admin / developer: ver, generar/rotar, revelar, revocar, togglear share.
 *   La rotación y revocación exigen reconfirmar la contraseña (step-up auth).
 * - coordinador del plantel: ver, revelar, togglear share. NO puede rotar ni
 *   revocar (debe pedirle al admin).
 * - auxiliar del coordinador: ver y revelar (mismos permisos que el coord
 *   salvo rotar/revocar y togglear share).
 * - responsable del plantel: solo ver/copiar (si share_api_key_with_responsable
 *   está en true).
 *
 * El secreto NUNCA se queda guardado en estado más de lo estrictamente
 * necesario: aparece al generar o al revelar y desaparece cuando el panel
 * pierde foco.
 */
import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff, Key, RefreshCw, Trash2, AlertTriangle, Check, Share2, ShieldAlert } from 'lucide-react'
import { ssoService, SsoApiKeyInfo } from '../../services/ssoService'
import { useAuthStore } from '../../store/authStore'

interface Props {
  campusId: number
  campusName?: string
  /** Si es true, oculta los botones de admin/coord */
  responsableMode?: boolean
}

type Role = string | undefined

function isAdminLike(role: Role): boolean {
  return role === 'admin' || role === 'developer'
}

function canConfigureShare(role: Role): boolean {
  return isAdminLike(role) || role === 'coordinator'
}

export default function CampusApiKeyPanel({ campusId, campusName, responsableMode }: Props) {
  const { user } = useAuthStore()
  const role = user?.role
  const [info, setInfo] = useState<SsoApiKeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [copiedAt, setCopiedAt] = useState<number | null>(null)

  // Step-up auth: modal de contraseña para rotar / revocar.
  type PendingAction = 'generate' | 'revoke' | 'reveal' | null
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const isAdmin = isAdminLike(role) && !responsableMode
  const showShareToggle = !responsableMode && canConfigureShare(role)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const data = await ssoService.getApiKeyInfo(campusId)
        if (!cancelled) {
          setInfo(data)
          setError(null)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'No se pudo cargar la información')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [campusId])

  const refresh = async () => {
    const data = await ssoService.getApiKeyInfo(campusId)
    setInfo(data)
  }

  const handleGenerate = async (currentPassword: string) => {
    setWorking('generate')
    setError(null)
    setPasswordError(null)
    try {
      const data = await ssoService.generateApiKey(campusId, currentPassword)
      setInfo({
        campus_id: data.campus_id,
        has_key: data.has_key,
        api_key_prefix: data.api_key_prefix,
        api_key_active: data.api_key_active,
        api_key_created_at: data.api_key_created_at,
        api_key_created_by: data.api_key_created_by,
        share_api_key_with_responsable: data.share_api_key_with_responsable,
        enable_sso_api: data.enable_sso_api,
        token_ttl_minutes: data.token_ttl_minutes,
      })
      setRevealed(data.api_key ?? null)
      setPendingAction(null)
      setPasswordInput('')
    } catch (e: any) {
      const code = e?.response?.data?.error
      const detail = e?.response?.data?.detail || e?.response?.data?.error
      if (code === 'password_required' || code === 'password_incorrect') {
        setPasswordError(detail || 'Contraseña incorrecta.')
      } else {
        setError(detail || 'Error al generar API key')
        setPendingAction(null)
      }
    } finally {
      setWorking(null)
    }
  }

  const handleReveal = async (currentPassword: string) => {
    setWorking('reveal')
    setError(null)
    setPasswordError(null)
    try {
      const data = await ssoService.revealApiKey(campusId, currentPassword)
      setRevealed(data.api_key ?? null)
      setPendingAction(null)
      setPasswordInput('')
    } catch (e: any) {
      const code = e?.response?.data?.error
      const detail = e?.response?.data?.detail || e?.response?.data?.error
      if (code === 'password_required' || code === 'password_incorrect') {
        setPasswordError(detail || 'Contraseña incorrecta.')
      } else {
        setError(detail || 'No autorizado o sin API key activa')
        setPendingAction(null)
      }
    } finally {
      setWorking(null)
    }
  }

  const handleToggleRevealClick = () => {
    if (revealed) {
      setRevealed(null)
      return
    }
    setPendingAction('reveal')
  }

  const handleRevoke = async (currentPassword: string) => {
    setWorking('revoke')
    setError(null)
    setPasswordError(null)
    try {
      await ssoService.revokeApiKey(campusId, currentPassword)
      setRevealed(null)
      setPendingAction(null)
      setPasswordInput('')
      await refresh()
    } catch (e: any) {
      const code = e?.response?.data?.error
      const detail = e?.response?.data?.detail || e?.response?.data?.error
      if (code === 'password_required' || code === 'password_incorrect') {
        setPasswordError(detail || 'Contraseña incorrecta.')
      } else {
        setError(detail || 'Error al revocar')
        setPendingAction(null)
      }
    } finally {
      setWorking(null)
    }
  }

  const handleToggleShare = async (next: boolean) => {
    setWorking('share')
    setError(null)
    try {
      const data = await ssoService.setShareWithResponsable(campusId, next)
      setInfo(data)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'No se pudo actualizar')
    } finally {
      setWorking(null)
    }
  }

  const handleToggleModule = async (next: boolean) => {
    setWorking('module')
    setError(null)
    try {
      const data = await ssoService.setEnableSsoApi(campusId, next)
      setInfo({
        campus_id: data.campus_id,
        has_key: data.has_key,
        api_key_prefix: data.api_key_prefix,
        api_key_active: data.api_key_active,
        api_key_created_at: data.api_key_created_at,
        api_key_created_by: data.api_key_created_by,
        share_api_key_with_responsable: data.share_api_key_with_responsable,
        enable_sso_api: data.enable_sso_api,
        token_ttl_minutes: data.token_ttl_minutes,
      })
      // Si el backend acaba de auto-generar la llave, mostrarla una vez.
      if (data.api_key) setRevealed(data.api_key)
      else if (!next) setRevealed(null)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.response?.data?.error || 'No se pudo cambiar el estado del módulo')
    } finally {
      setWorking(null)
    }
  }

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedAt(Date.now())
      setTimeout(() => setCopiedAt(null), 2000)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-3"></div>
        <div className="h-12 w-full bg-gray-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-5 hover:shadow-lg hover:border-purple-200 transition-all duration-300">
      <h3 className="fluid-text-sm font-bold text-gray-700 uppercase tracking-wide fluid-mb-4 flex items-center fluid-gap-2">
        <div className="fluid-p-2 bg-purple-100 rounded-fluid-lg">
          <Key className="fluid-icon-sm text-purple-600" />
        </div>
        API Key del Plantel (SSO)
      </h3>

      <p className="text-xs text-gray-500 mb-3">
        Permite a sistemas externos del plantel <strong>{campusName || ''}</strong> registrar y loguear
        candidatos automáticamente vía <code className="bg-gray-100 px-1 rounded">POST /api/sso/generar_token</code>.
        El responsable y sus candidatos pueden usarla {info?.share_api_key_with_responsable ? 'según la política activa' : 'cuando el coordinador la comparta'}.
      </p>

      {/* Toggle del MÓDULO SSO. Disponible para admin/coord/aux/responsable.
          Si está apagado, el plantel no acepta llamadas a /generar_token,
          aunque la llave exista. Al encenderlo, si no había llave se
          auto-genera y se muestra una sola vez. */}
      <div
        className={`mb-4 flex items-start gap-3 rounded-lg p-3 border ${
          info?.enable_sso_api
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <Key className={`w-4 h-4 mt-0.5 flex-shrink-0 ${info?.enable_sso_api ? 'text-emerald-600' : 'text-gray-400'}`} />
        <div className="flex-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!info?.enable_sso_api}
              onChange={(e) => handleToggleModule(e.target.checked)}
              disabled={working === 'module'}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold text-gray-800">
              Módulo SSO API {info?.enable_sso_api ? 'activo' : 'inactivo'}
            </span>
          </label>
          <p className="text-xs text-gray-600 mt-1">
            {info?.enable_sso_api
              ? 'El plantel acepta llamadas externas a /api/sso/generar_token con su API key.'
              : 'Las llamadas externas están bloqueadas. Al activar el módulo, se generará automáticamente una API key si aún no existe.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      {/* Estado actual */}
      {info?.has_key ? (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-fluid-xl p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-700 uppercase">API key activa</span>
            <span className="text-[10px] text-purple-500">
              {info.api_key_created_at && new Date(info.api_key_created_at).toLocaleString('es-MX')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-purple-200 rounded-lg px-3 py-2 text-sm font-mono break-all">
              {revealed ?? `${info.api_key_prefix ?? ''}${'•'.repeat(32)}`}
            </code>
            <button
              onClick={handleToggleRevealClick}
              disabled={working === 'reveal'}
              title={revealed ? 'Ocultar' : 'Revelar'}
              className="p-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-50"
            >
              {revealed ? <EyeOff className="w-4 h-4 text-purple-600" /> : <Eye className="w-4 h-4 text-purple-600" />}
            </button>
            {revealed && (
              <button
                onClick={() => copyToClipboard(revealed)}
                title="Copiar"
                className="p-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-50"
              >
                {copiedAt ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-purple-600" />}
              </button>
            )}
          </div>
          {revealed && (
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Trata esta llave como contraseña. No la pegues en código fuente público.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-fluid-xl p-4 text-center">
          <p className="text-sm text-gray-600">Este plantel aún no tiene API key.</p>
        </div>
      )}

      {/* Acciones de rotación / revocación: SOLO admin / developer */}
      {isAdmin && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => {
              setPasswordInput('')
              setPasswordError(null)
              setPendingAction('generate')
            }}
            disabled={working === 'generate'}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${working === 'generate' ? 'animate-spin' : ''}`} />
            {info?.has_key ? 'Rotar API key' : 'Generar API key'}
          </button>
          {info?.has_key && (
            <button
              onClick={() => {
                setPasswordInput('')
                setPasswordError(null)
                setPendingAction('revoke')
              }}
              disabled={working === 'revoke'}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Revocar
            </button>
          )}
        </div>
      )}

      {/* Aviso a coord/responsable: la rotación queda reservada al admin */}
      {!responsableMode && !isAdmin && canConfigureShare(role) && (
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Por seguridad, solo un administrador de Evaluaasi puede generar, rotar o revocar la API key del plantel.
            Si necesitas una llave nueva, contacta a soporte.
          </p>
        </div>
      )}

      {/* Toggle compartir con responsable (admin + coordinador) */}
      {showShareToggle && info?.has_key && (
        <div className="mt-4 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <Share2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!info.share_api_key_with_responsable}
                onChange={(e) => handleToggleShare(e.target.checked)}
                disabled={working === 'share'}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold text-gray-800">
                Permitir que el responsable del plantel vea la API key
              </span>
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Cuando está activo, el responsable puede revelarla y compartirla con sus candidatos. Solo un administrador puede rotarla o revocarla.
            </p>
          </div>
        </div>
      )}

      {/* Modal de confirmación con password (rotar / revocar) */}
      {pendingAction && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-semibold mb-1 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            {pendingAction === 'generate'
              ? info?.has_key
                ? '¿Rotar la API key?'
                : '¿Generar una API key?'
              : pendingAction === 'revoke'
                ? '¿Revocar la API key?'
                : '¿Revelar la API key?'}
          </p>
          <p className="text-xs text-red-600 mb-3">
            {pendingAction === 'generate'
              ? 'Al rotarla, la API key actual dejará de funcionar inmediatamente y deberás entregar la nueva a las integraciones del plantel.'
              : pendingAction === 'revoke'
                ? 'Las integraciones que usen esta llave dejarán de funcionar inmediatamente. Esta acción no se puede deshacer.'
                : 'Vas a mostrar el secreto SSO de este plantel. Confirma tu contraseña para registrar la acción en la bitácora.'}
          </p>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Confirma tu contraseña de administrador
          </label>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            autoFocus
            placeholder="••••••••"
            className="w-full px-3 py-2 mb-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && passwordInput.trim() && working === null) {
                if (pendingAction === 'generate') handleGenerate(passwordInput)
                else if (pendingAction === 'revoke') handleRevoke(passwordInput)
                else handleReveal(passwordInput)
              }
            }}
          />
          {passwordError && (
            <p className="text-xs text-red-600 mb-2">{passwordError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (pendingAction === 'generate') handleGenerate(passwordInput)
                else if (pendingAction === 'revoke') handleRevoke(passwordInput)
                else handleReveal(passwordInput)
              }}
              disabled={!passwordInput.trim() || working !== null}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-50"
            >
              {pendingAction === 'generate' ? 'Sí, generar' : pendingAction === 'revoke' ? 'Sí, revocar' : 'Sí, revelar'}
            </button>
            <button
              onClick={() => {
                setPendingAction(null)
                setPasswordInput('')
                setPasswordError(null)
              }}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
