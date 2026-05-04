import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Download,
  Loader2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Monitor,
  CalendarDays,
  Info,
  CheckCircle2,
  ListChecks,
} from 'lucide-react'
import {
  getMyOfficeSession,
  MyOfficeSessionResponse,
  MyOfficeSessionApp,
} from '../../services/vmSessionsService'

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programada',
  in_progress: 'En curso',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
}

const APP_LABEL: Record<string, string> = {
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  access: 'Access',
}

function formatHour(h: number | null | undefined): string {
  if (h === null || h === undefined) return '—'
  const hh = h % 24
  return `${hh.toString().padStart(2, '0')}:00`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '¡Ya puedes iniciar!'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function MiSesionOfficePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<MyOfficeSessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getMyOfficeSession()
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Error al cargar tu sesión Office')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const tickInt = setInterval(() => setNow(Date.now()), 1000)
    const refreshInt = setInterval(load, 60_000)
    return () => {
      clearInterval(tickInt)
      clearInterval(refreshInt)
    }
  }, [])

  const remainingSeconds = useMemo(() => {
    if (!data?.session) return null
    const start = new Date(
      data.session.session_date + 'T00:00:00Z',
    )
    start.setUTCHours(data.session.start_hour ?? 0)
    const diff = Math.floor((start.getTime() - now) / 1000)
    return diff
  }, [data, now])

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMsg(`${label} copiado`)
      setTimeout(() => setCopyMsg(null), 2500)
    } catch {
      setCopyMsg('No se pudo copiar')
      setTimeout(() => setCopyMsg(null), 2500)
    }
  }

  // App recomendada según session_type / office_app
  const recommendedApp = useMemo<MyOfficeSessionApp | null>(() => {
    if (!data?.apps_catalog || !data?.session) return null
    const session = data.session
    const targetType = session.session_type
    const officeApp = (session.office_app || '').toLowerCase()
    const candidates = data.apps_catalog.filter(
      (a) => a.is_active && a.app_type === targetType,
    )
    if (officeApp) {
      const matchByApp = candidates.find((a) =>
        a.app_name.toLowerCase().includes(officeApp),
      )
      if (matchByApp) return matchByApp
    }
    return candidates[0] || null
  }, [data])

  // Estados de pantalla
  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error}
          <button onClick={load} className="block mt-2 text-sm underline">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Sin habilitación
  if (!data.enabled) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </button>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            Exámenes Office no habilitados
          </h2>
          <p className="text-sm text-amber-700">
            Tu plantel/grupo no tiene activadas las evaluaciones Office. Contacta a tu
            responsable o coordinador si crees que es un error.
          </p>
        </div>
      </div>
    )
  }

  const session = data.session
  const showCountdown = session && session.status !== 'in_progress'
  const canStart = session && (session.status === 'in_progress' || (remainingSeconds ?? 9999) <= 600)

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Mi sesión Office</h1>
          <p className="text-sm text-gray-500">
            {data.campus?.name && <>Plantel: {data.campus.name} · </>}
            {data.group?.name && <>Grupo: {data.group.name}</>}
          </p>
        </div>
      </div>

      {copyMsg && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
          {copyMsg}
        </div>
      )}

      {!session && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">No tienes sesiones Office programadas</p>
          <p className="text-sm text-gray-500 mt-1">
            Cuando tu responsable agende una sesión, la verás aquí con su PIN, hora de inicio
            e instrucciones.
          </p>
          <Link
            to="/vm-sessions"
            className="inline-block mt-4 text-sm text-primary-600 hover:underline"
          >
            Ver mi agenda completa
          </Link>
        </div>
      )}

      {session && (
        <>
          {/* Tarjeta principal con countdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-gray-900 capitalize">
                    {APP_LABEL[(session.office_app || '').toLowerCase()] || session.office_app || 'Office'}
                  </span>
                  {session.level && (
                    <span className="text-sm text-gray-500">· {session.level}</span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                    {session.session_type}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      session.status === 'in_progress'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {STATUS_LABEL[session.status] || session.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {formatDate(session.session_date)}{' · '}
                  {formatHour(session.start_hour)}
                  {session.end_hour !== null && session.end_hour !== undefined && (
                    <> — {formatHour(session.end_hour)}</>
                  )}
                </div>
                {session.parcial_units && (
                  <div className="text-xs text-purple-700 mt-1">
                    Unidades asignadas: {session.parcial_units}
                  </div>
                )}
              </div>

              {showCountdown && remainingSeconds !== null && (
                <div className="text-right">
                  <div className="text-xs uppercase text-gray-500 font-medium">
                    {remainingSeconds <= 0 ? 'Disponible' : 'Comienza en'}
                  </div>
                  <div
                    className={`text-3xl font-bold tabular-nums mt-1 ${
                      remainingSeconds <= 600 ? 'text-green-600' : 'text-gray-800'
                    }`}
                  >
                    {formatCountdown(remainingSeconds)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Credenciales VDI */}
          {(session.workstation_name || session.ad_username || session.ad_password || session.pin) && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary-600" />
                <h2 className="text-base font-semibold text-gray-900">Acceso al equipo</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {session.workstation_name && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 font-medium">Equipo (VDI)</p>
                    <p className="mt-0.5 flex items-center gap-2">
                      {session.workstation_color && (
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: session.workstation_color }}
                        />
                      )}
                      <span className="font-mono text-gray-800">{session.workstation_name}</span>
                      <button
                        onClick={() => handleCopy('Equipo', session.workstation_name!)}
                        className="text-gray-400 hover:text-primary-600"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </p>
                  </div>
                )}
                {session.ad_username && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 font-medium">Usuario</p>
                    <p className="mt-0.5 font-mono text-gray-800 flex items-center gap-2">
                      {session.ad_username}
                      <button
                        onClick={() => handleCopy('Usuario', session.ad_username!)}
                        className="text-gray-400 hover:text-primary-600"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </p>
                  </div>
                )}
                {session.ad_password && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 font-medium">Contraseña</p>
                    <p className="mt-0.5 font-mono text-gray-800 flex items-center gap-2">
                      <span>{showPassword ? session.ad_password : '••••••••'}</span>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-primary-600"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy('Contraseña', session.ad_password!)}
                        className="text-gray-400 hover:text-primary-600"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </p>
                  </div>
                )}
                {session.pin && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 font-medium">PIN</p>
                    <p className="mt-0.5 font-mono text-2xl font-bold text-primary-600 flex items-center gap-2">
                      {session.pin}
                      <button
                        onClick={() => handleCopy('PIN', session.pin!)}
                        className="text-gray-400 hover:text-primary-600"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </p>
                  </div>
                )}
              </div>

              {session.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mt-2">
                  <strong>Nota: </strong>{session.notes}
                </div>
              )}
            </div>
          )}

          {/* App recomendada / descarga */}
          {recommendedApp && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Download className="h-5 w-5 text-primary-600" />
                <h2 className="text-base font-semibold text-gray-900">App requerida</h2>
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-mono text-sm text-gray-800">{recommendedApp.app_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Versión mínima: <span className="font-mono">{recommendedApp.min_version || '—'}</span>
                    {recommendedApp.latest_version && (
                      <> · Última: <span className="font-mono">{recommendedApp.latest_version}</span></>
                    )}
                  </p>
                </div>
                {recommendedApp.download_url ? (
                  <a
                    href={recommendedApp.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">Sin enlace de descarga</span>
                )}
              </div>
            </div>
          )}

          {/* Pasos / instrucciones */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-semibold text-gray-900">¿Cómo iniciar tu sesión?</h2>
            </div>
            <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
              <li>
                Asegúrate de estar conectado a la red del plantel{' '}
                {session.is_local ? '(modo local)' : '(modo remoto/VDI)'}.
              </li>
              {session.workstation_name && (
                <li>
                  Inicia sesión en el equipo asignado{' '}
                  <span className="font-mono">{session.workstation_name}</span>.
                </li>
              )}
              {recommendedApp && (
                <li>
                  Abre la aplicación{' '}
                  <span className="font-mono">{recommendedApp.app_name}</span>.
                </li>
              )}
              <li>
                Ingresa con tu usuario y contraseña habituales del portal Evaluaasi.
              </li>
              {session.pin && (
                <li>
                  Cuando se solicite, captura tu PIN <strong>{session.pin}</strong>.
                </li>
              )}
              <li>
                Sigue las instrucciones en pantalla. No cierres la aplicación hasta finalizar.
              </li>
              <li>
                Al terminar, podrás ver tu resultado en{' '}
                <Link to="/mis-examenes-office" className="text-primary-600 hover:underline">
                  Mis exámenes Office
                </Link>
                .
              </li>
            </ol>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Si pierdes la conexión, puedes reanudar el examen desde el mismo equipo.
              {' '}Si tienes problemas, contacta a soporte.
            </span>
          </div>
        </>
      )}

      {/* Resultados recientes */}
      {data.recent_results && data.recent_results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-semibold text-gray-900">Resultados recientes</h2>
            </div>
            <Link to="/mis-examenes-office" className="text-xs text-primary-600 hover:underline">
              Ver todos →
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {data.recent_results.slice(0, 5).map((r: any) => (
              <li
                key={r.id}
                className="flex items-center justify-between border-b border-gray-100 pb-1 last:border-0"
              >
                <span className="capitalize text-gray-700">
                  {APP_LABEL[(r.office_app || '').toLowerCase()] || r.office_app || '—'}
                  {' · '}
                  <span className="text-gray-500 text-xs">{r.session_type}</span>
                </span>
                <span
                  className={`text-sm font-semibold ${
                    r.passed ? 'text-green-600' : r.status === 'in_progress' ? 'text-amber-600' : 'text-red-600'
                  }`}
                >
                  {r.score ?? '—'} / {r.passing_score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cuándo recargar */}
      <div className="text-xs text-gray-400 text-center">
        <Clock className="h-3 w-3 inline mr-1" />
        Esta página se actualiza automáticamente cada minuto.
      </div>
    </div>
  )
}
