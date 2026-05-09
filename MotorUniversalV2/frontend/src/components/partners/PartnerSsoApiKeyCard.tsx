/**
 * Tarjeta de gestión de la API key SSO de un partner.
 *
 * Visible para administradores y para el coordinador dueño del partner
 * (la verificación final la hace el backend; aquí solo controlamos visibilidad
 * de la UI).
 *
 * Flujo:
 *  - GET inicial → muestra prefijo y estado.
 *  - Generar / Regenerar → muestra el secreto en claro UNA SOLA VEZ con
 *    botón de copiar; al cerrar el modal el secreto deja de ser accesible.
 *  - Revocar → desactiva la key actual.
 */
import { useEffect, useState } from 'react'
import {
  KeyRound,
  Copy,
  Check,
  RefreshCcw,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react'
import { ssoService, type SsoApiKeyInfo, type SsoApiKeyCreated } from '../../services/ssoService'

interface PartnerSsoApiKeyCardProps {
  partnerId: number
  /** Si es false, se renderiza pero deshabilitado (modo lectura). */
  canManage?: boolean
}

export default function PartnerSsoApiKeyCard({ partnerId, canManage = true }: PartnerSsoApiKeyCardProps) {
  const [info, setInfo] = useState<SsoApiKeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<SsoApiKeyCreated | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ssoService.getApiKeyInfo(partnerId)
      setInfo(data)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No fue posible cargar la información de la API key.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [partnerId])

  const handleGenerate = async () => {
    if (info?.has_key) {
      const ok = window.confirm(
        '⚠ Al regenerar invalidarás la API key actual. Cualquier sistema que la use dejará de funcionar hasta que se actualice.\n\n¿Deseas continuar?'
      )
      if (!ok) return
    }
    try {
      setBusy(true)
      setError(null)
      const data = await ssoService.generateApiKey(partnerId)
      setCreated(data)
      setShowSecret(true)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No fue posible generar la API key.')
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async () => {
    if (!window.confirm('¿Desactivar la API key actual? Los sistemas conectados dejarán de poder iniciar sesiones SSO.')) return
    try {
      setBusy(true)
      setError(null)
      await ssoService.revokeApiKey(partnerId)
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No fue posible revocar la API key.')
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!created?.api_key) return
    try {
      await navigator.clipboard.writeText(created.api_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard puede fallar en http; el usuario puede seleccionar manual */
    }
  }

  const handleCloseCreated = () => {
    setCreated(null)
    setShowSecret(false)
    setCopied(false)
  }

  return (
    <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-200 fluid-p-6 hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
      <h2 className="fluid-text-lg font-bold text-gray-800 fluid-mb-4 flex items-center fluid-gap-3">
        <div className="fluid-p-2 bg-indigo-100 rounded-fluid-lg">
          <KeyRound className="fluid-icon-base text-indigo-600" />
        </div>
        API Tokenización SSO
      </h2>

      <div className="flex items-start fluid-gap-2 fluid-mb-4 fluid-p-3 bg-blue-50 rounded-fluid-xl border border-blue-100">
        <Info className="fluid-icon-sm text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="fluid-text-xs text-blue-700">
          Permite a esta institución generar tokens SSO desde su sistema y enviar a sus alumnos
          a <span className="font-mono">/sso?token=…</span> sin pedir contraseña.
        </p>
      </div>

      {loading ? (
        <p className="fluid-text-sm text-gray-500">Cargando…</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-3 flex items-start fluid-gap-2 fluid-mb-3">
          <AlertCircle className="fluid-icon-sm text-red-600 flex-shrink-0 mt-0.5" />
          <p className="fluid-text-sm text-red-700">{error}</p>
        </div>
      ) : info?.has_key ? (
        <div className="fluid-space-y-3">
          <div className="fluid-p-3 bg-gray-50 rounded-fluid-xl border border-gray-200">
            <p className="fluid-text-xs text-gray-500 uppercase tracking-wide font-medium">Prefijo</p>
            <p className="fluid-text-base font-mono font-semibold text-gray-900">
              {info.api_key_prefix}…
            </p>
            <p className="fluid-text-xs text-gray-500 fluid-mt-2">
              Estado:{' '}
              <span className={info.api_key_active ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                {info.api_key_active ? 'Activa' : 'Revocada'}
              </span>
            </p>
            {info.api_key_created_at && (
              <p className="fluid-text-xs text-gray-500 fluid-mt-1">
                Creada: {new Date(info.api_key_created_at).toLocaleString('es-MX')}
              </p>
            )}
            <p className="fluid-text-xs text-gray-500 fluid-mt-1">
              Vigencia del token emitido: {info.token_ttl_minutes} min (single-use).
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap fluid-gap-2">
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-xl fluid-text-sm font-medium disabled:opacity-50"
              >
                <RefreshCcw className="fluid-icon-sm" /> Regenerar
              </button>
              {info.api_key_active && (
                <button
                  onClick={handleRevoke}
                  disabled={busy}
                  className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-fluid-xl fluid-text-sm font-medium disabled:opacity-50"
                >
                  <Trash2 className="fluid-icon-sm" /> Revocar
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="fluid-space-y-3">
          <p className="fluid-text-sm text-gray-600">
            Este partner aún no tiene API key. Genérala para habilitar el SSO.
          </p>
          {canManage && (
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-xl fluid-text-sm font-medium disabled:opacity-50"
            >
              <KeyRound className="fluid-icon-sm" /> Generar API key
            </button>
          )}
        </div>
      )}

      {/* Modal con el secreto recién creado */}
      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 fluid-p-4">
          <div className="bg-white rounded-fluid-2xl shadow-2xl max-w-lg w-full fluid-p-6">
            <h3 className="fluid-text-lg font-bold text-gray-900 fluid-mb-2 flex items-center fluid-gap-2">
              <KeyRound className="fluid-icon-base text-indigo-600" /> Tu nueva API key
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-fluid-xl fluid-p-3 fluid-mb-4">
              <p className="fluid-text-sm text-amber-800">
                ⚠ Cópiala y guárdala ahora. Por seguridad <strong>no podremos volver a mostrártela</strong>.
              </p>
            </div>

            <div className="bg-gray-900 text-gray-100 rounded-fluid-xl fluid-p-3 font-mono fluid-text-sm break-all flex items-center fluid-gap-2">
              <span className="flex-1">
                {showSecret ? created.api_key : '•'.repeat(Math.min(48, created.api_key.length))}
              </span>
              <button
                onClick={() => setShowSecret((v) => !v)}
                className="fluid-p-2 hover:bg-gray-800 rounded-fluid-lg"
                title={showSecret ? 'Ocultar' : 'Mostrar'}
              >
                {showSecret ? <EyeOff className="fluid-icon-sm" /> : <Eye className="fluid-icon-sm" />}
              </button>
              <button
                onClick={handleCopy}
                className="fluid-p-2 hover:bg-gray-800 rounded-fluid-lg"
                title="Copiar"
              >
                {copied ? <Check className="fluid-icon-sm text-green-400" /> : <Copy className="fluid-icon-sm" />}
              </button>
            </div>

            <div className="fluid-mt-4 fluid-text-xs text-gray-600 fluid-space-y-1">
              <p>
                <strong>Endpoint público:</strong>{' '}
                <span className="font-mono">POST /api/sso/generar_token</span>
              </p>
              <p>
                <strong>Campos obligatorios:</strong>{' '}
                <span className="font-mono">apikey, matricula, nombre, primer_apellido, segundo_apellido, email</span>
              </p>
              <p>
                <strong>Campos opcionales:</strong>{' '}
                <span className="font-mono">programa</span>
              </p>
              <p>
                <strong>URL de redirección:</strong>{' '}
                <span className="font-mono">/sso?token=&lt;token&gt;</span>
              </p>
            </div>

            <div className="fluid-mt-5 flex justify-end fluid-gap-2">
              <button
                onClick={handleCloseCreated}
                className="fluid-px-4 fluid-py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-fluid-xl fluid-text-sm font-medium"
              >
                Ya la guardé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
