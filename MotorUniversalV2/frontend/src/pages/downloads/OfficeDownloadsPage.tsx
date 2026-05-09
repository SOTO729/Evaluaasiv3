import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Download, 
  ArrowLeft, 
  Monitor, 
  FileSpreadsheet, 
  FileText, 
  Presentation,
  CheckCircle2,
  Clock,
  Shield,
  AlertCircle,
  Loader2,
  X,
  FolderOpen,
  ShieldAlert,
  PlayCircle,
  Archive
} from 'lucide-react'
import { downloadsService, OfficeApp } from '../../services/downloadsService'

/** Mapeo de app_type a etiqueta e icono */
const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  examen:    { label: 'Examen',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  simulador: { label: 'Simulador', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  parcial:   { label: 'Parcial',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
}

/** Inferir ícono de Office por nombre de app */
function getOfficeIcon(appName: string) {
  const lower = appName.toLowerCase()
  if (lower.includes('excel'))       return FileSpreadsheet
  if (lower.includes('word'))        return FileText
  if (lower.includes('powerpoint'))  return Presentation
  return Monitor
}

/** Inferir la aplicación Office del nombre */
function getOfficeLabel(appName: string): string {
  const lower = appName.toLowerCase()
  if (lower.includes('excel'))       return 'Excel'
  if (lower.includes('word'))        return 'Word'
  if (lower.includes('powerpoint'))  return 'PowerPoint'
  return 'Office'
}

/** Inferir nivel del nombre */
function getLevelLabel(appName: string): string | null {
  const lower = appName.toLowerCase()
  if (lower.includes('basico'))    return 'Básico'
  if (lower.includes('avanzado'))  return 'Avanzado'
  return null
}

/** Inferir versión de Office del nombre */
function getOfficeVersion(appName: string): string | null {
  const match = appName.match(/(2016|2019|2021|365)/)
  return match ? (match[1] === '365' ? 'Office 365' : `Office ${match[1]}`) : null
}

/** Agrupar apps por aplicación Office */
function groupApps(apps: OfficeApp[]): Record<string, OfficeApp[]> {
  const groups: Record<string, OfficeApp[]> = {}
  for (const app of apps) {
    const office = getOfficeLabel(app.app_name)
    const version = getOfficeVersion(app.app_name) || ''
    const key = `${office} ${version}`.trim()
    if (!groups[key]) groups[key] = []
    groups[key].push(app)
  }
  return groups
}

export default function OfficeDownloadsPage() {
  const navigate = useNavigate()
  const [apps, setApps] = useState<OfficeApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [instructionsApp, setInstructionsApp] = useState<OfficeApp | null>(null)

  useEffect(() => {
    loadApps()
  }, [])

  const loadApps = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await downloadsService.getOfficeApps()
      setApps(response.apps)
    } catch (err: any) {
      console.error('Error loading office apps:', err)
      setError(err.response?.data?.error || 'Error al cargar las aplicaciones')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (app: OfficeApp) => {
    if (!app.download_url) return
    // Mostrar modal con instrucciones antes de iniciar la descarga.
    setInstructionsApp(app)
  }

  const startDownload = (app: OfficeApp) => {
    if (!app.download_url) return
    setDownloadingId(app.id)
    window.open(app.download_url, '_blank', 'noopener,noreferrer')
    setInstructionsApp(null)
    setTimeout(() => setDownloadingId(null), 2000)
  }

  const grouped = groupApps(apps)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
        <p className="mt-4 text-base font-medium text-gray-700">Cargando aplicaciones...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={loadApps} className="mt-3 text-sm text-red-600 underline hover:no-underline">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Descargas</h1>
          <p className="text-sm text-gray-500">Aplicaciones necesarias para tus evaluaciones de Office</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Instrucciones de instalación</p>
          <ol className="mt-1 ml-4 list-decimal space-y-1 text-blue-700">
            <li>Descarga el instalador de la aplicación que necesites</li>
            <li>Ejecuta el archivo descargado como administrador</li>
            <li>Sigue las instrucciones del instalador</li>
            <li>Al abrir la aplicación, inicia sesión con tus credenciales de Evaluaasi</li>
          </ol>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <Download className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay aplicaciones disponibles</p>
          <p className="text-sm text-gray-400 mt-1">Tu coordinador aún no ha habilitado descargas para tu plantel</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([groupName, groupApps]) => {
            const Icon = getOfficeIcon(groupApps[0].app_name)
            return (
              <div key={groupName}>
                {/* Group header */}
                <div className="flex items-center gap-2 mb-4">
                  <Icon className="h-5 w-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-gray-800">{groupName}</h2>
                  <span className="text-xs text-gray-400">({groupApps.length} {groupApps.length === 1 ? 'aplicación' : 'aplicaciones'})</span>
                </div>

                {/* App cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupApps.map(app => {
                    const AppIcon = getOfficeIcon(app.app_name)
                    const typeInfo = typeConfig[app.app_type] || typeConfig.examen
                    const level = getLevelLabel(app.app_name)
                    const isDownloading = downloadingId === app.id

                    return (
                      <div
                        key={app.id}
                        className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col"
                      >
                        {/* Top: Icon + info */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                            <AppIcon className="h-5 w-5 text-primary-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                              {app.app_name.replace(/([A-Z])/g, ' $1').replace(/(\d{4})/g, ' $1').trim()}
                            </h3>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeInfo.bg} ${typeInfo.color}`}>
                                {typeInfo.label}
                              </span>
                              {level && (
                                <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600 font-medium">
                                  {level}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Version info */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                          {app.latest_version && (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              <span>v{app.latest_version}</span>
                            </div>
                          )}
                          {app.updated_at && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{new Date(app.updated_at).toLocaleDateString('es-MX')}</span>
                            </div>
                          )}
                        </div>

                        {/* Download button */}
                        <button
                          onClick={() => handleDownload(app)}
                          disabled={!app.download_url || isDownloading}
                          className={`mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                            app.download_url
                              ? isDownloading
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isDownloading ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Descargando...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              Descargar
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {instructionsApp && (
        <DownloadInstructionsModal
          app={instructionsApp}
          onClose={() => setInstructionsApp(null)}
          onConfirm={() => startDownload(instructionsApp)}
        />
      )}
    </div>
  )
}

// =================== Modal de instrucciones ===================

function DownloadInstructionsModal({
  app,
  onClose,
  onConfirm,
}: {
  app: OfficeApp
  onClose: () => void
  onConfirm: () => void
}) {
  const fileName = app.download_url
    ? decodeURIComponent(app.download_url.split('/').pop()?.split('?')[0] || 'aplicacion.zip')
    : 'aplicacion.zip'
  const isZip = fileName.toLowerCase().endsWith('.zip')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                Antes de descargar
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Sigue estas instrucciones para que la aplicación funcione correctamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-sm text-gray-700">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Importante</p>
              <p className="text-amber-800 mt-0.5">
                NO ejecutes el archivo <code className="bg-amber-100 px-1 rounded text-xs">.exe</code>{' '}
                directamente desde la carpeta comprimida. Si lo haces, la aplicación se abrirá en
                blanco o se cerrará sin mostrar nada.
              </p>
            </div>
          </div>

          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
                1
              </span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <Archive className="h-4 w-4 text-gray-500" /> Descarga el archivo
                </p>
                <p className="text-gray-600 mt-0.5">
                  Se descargará{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{fileName}</code>
                  {isZip
                    ? ' que es un archivo comprimido con la aplicación, su configuración y librerías necesarias.'
                    : ' con la aplicación y sus archivos de soporte.'}
                </p>
              </div>
            </li>

            {isZip && (
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
                  2
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-gray-500" /> Descomprime la carpeta
                  </p>
                  <p className="text-gray-600 mt-0.5">
                    Haz clic derecho sobre el ZIP descargado y selecciona{' '}
                    <strong>“Extraer todo…”</strong>. Te recomendamos extraerlo en{' '}
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                      C:\EvaluaasiOffice
                    </code>{' '}
                    o en tu Escritorio. <strong>NO</strong> ejecutes el .exe desde dentro del ZIP.
                  </p>
                </div>
              </li>
            )}

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
                {isZip ? 3 : 2}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-gray-500" /> Aprueba el aviso de Windows
                </p>
                <p className="text-gray-600 mt-0.5">
                  Windows SmartScreen puede mostrar el mensaje{' '}
                  <em>“Windows protegió su PC”</em>. Haz clic en{' '}
                  <strong>“Más información”</strong> y luego en{' '}
                  <strong>“Ejecutar de todas formas”</strong>. La aplicación está firmada por
                  Evaluaasi.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
                {isZip ? 4 : 3}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-gray-500" /> Ejecuta la aplicación
                </p>
                <p className="text-gray-600 mt-0.5">
                  Dentro de la carpeta extraída haz doble clic en{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                    EvaluaasiOfficeV2.exe
                  </code>{' '}
                  (o el .exe correspondiente). Mantén juntos todos los archivos: el{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">.exe</code>, su{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">.exe.config</code> y todas las{' '}
                  <code className="bg-gray-100 px-1 rounded text-xs">.dll</code> deben estar en la
                  misma carpeta.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm flex items-center justify-center">
                {isZip ? 5 : 4}
              </span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" /> Inicia sesión
                </p>
                <p className="text-gray-600 mt-0.5">
                  Cuando se abra la aplicación, ingresa con tus credenciales de Evaluaasi (las
                  mismas que usas en la web).
                </p>
              </div>
            </li>
          </ol>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            <p>
              <strong>¿Tienes problemas?</strong> Verifica que tengas instalado{' '}
              <strong>.NET Framework 4.8</strong> y{' '}
              <strong>Microsoft Office</strong> (Excel/Word/PowerPoint) en tu PC. Si la app abre y
              se cierra sola, contacta a soporte indicando el modelo de tu equipo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm"
          >
            <Download className="h-4 w-4" />
            Entendido, descargar
          </button>
        </div>
      </div>
    </div>
  )
}
