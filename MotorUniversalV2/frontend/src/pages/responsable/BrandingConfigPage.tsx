/**
 * Página de configuración de branding del plantel
 * Permite al responsable personalizar logo y colores de su portal
 */
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMiPlantel, updateMiPlantelBranding, uploadMiPlantelLogo, deleteMiPlantelLogo } from '../../services/partnersService'
import { useAuthStore } from '../../store/authStore'
import { Palette, Upload, Trash2, RotateCcw, Check, Eye, Building2, Image, ArrowLeft, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoadingSpinner from '../../components/LoadingSpinner'

const DEFAULT_PRIMARY = '#3b82f6'
const DEFAULT_SECONDARY = '#2563eb'

// Paletas predefinidas para facilitar la selección
const PRESET_PALETTES = [
  { name: 'Azul (predeterminado)', primary: '#3b82f6', secondary: '#2563eb' },
  { name: 'Índigo', primary: '#6366f1', secondary: '#4f46e5' },
  { name: 'Violeta', primary: '#8b5cf6', secondary: '#7c3aed' },
  { name: 'Verde', primary: '#10b981', secondary: '#059669' },
  { name: 'Esmeralda', primary: '#34d399', secondary: '#10b981' },
  { name: 'Rojo', primary: '#ef4444', secondary: '#dc2626' },
  { name: 'Naranja', primary: '#f97316', secondary: '#ea580c' },
  { name: 'Ámbar', primary: '#f59e0b', secondary: '#d97706' },
  { name: 'Rosa', primary: '#ec4899', secondary: '#db2777' },
  { name: 'Cian', primary: '#06b6d4', secondary: '#0891b2' },
  { name: 'Gris', primary: '#6b7280', secondary: '#4b5563' },
  { name: 'Slate', primary: '#475569', secondary: '#334155' },
]

/**
 * Genera una paleta de 10 tonos (50-900) a partir de un color HEX base
 */
function generatePalette(hex: string): Record<string, string> {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const lighten = (val: number, amount: number) => Math.min(255, Math.round(val + (255 - val) * amount))
  const darken = (val: number, amount: number) => Math.max(0, Math.round(val * (1 - amount)))
  const toHex = (rv: number, gv: number, bv: number) =>
    `#${rv.toString(16).padStart(2, '0')}${gv.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`

  return {
    '50': toHex(lighten(r, 0.93), lighten(g, 0.93), lighten(b, 0.93)),
    '100': toHex(lighten(r, 0.82), lighten(g, 0.82), lighten(b, 0.82)),
    '200': toHex(lighten(r, 0.65), lighten(g, 0.65), lighten(b, 0.65)),
    '300': toHex(lighten(r, 0.42), lighten(g, 0.42), lighten(b, 0.42)),
    '400': toHex(lighten(r, 0.2), lighten(g, 0.2), lighten(b, 0.2)),
    '500': hex,
    '600': toHex(darken(r, 0.15), darken(g, 0.15), darken(b, 0.15)),
    '700': toHex(darken(r, 0.3), darken(g, 0.3), darken(b, 0.3)),
    '800': toHex(darken(r, 0.45), darken(g, 0.45), darken(b, 0.45)),
    '900': toHex(darken(r, 0.6), darken(g, 0.6), darken(b, 0.6)),
  }
}

const BrandingConfigPage = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: plantelData, isLoading } = useQuery({
    queryKey: ['mi-plantel'],
    queryFn: getMiPlantel,
    enabled: user?.role === 'responsable',
  })

  const campus = plantelData?.campus

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY)
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Sync state from server data
  useEffect(() => {
    if (campus) {
      setPrimaryColor(campus.primary_color || DEFAULT_PRIMARY)
      setSecondaryColor(campus.secondary_color || DEFAULT_SECONDARY)
      setLogoPreview(campus.logo_url || null)
    }
  }, [campus])

  const hasChanges = campus && (
    (primaryColor !== (campus.primary_color || DEFAULT_PRIMARY)) ||
    (secondaryColor !== (campus.secondary_color || DEFAULT_SECONDARY))
  )

  // Mutations
  const brandingMutation = useMutation({
    mutationFn: updateMiPlantelBranding,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mi-plantel'] })
      setSuccessMsg(data.message)
      setErrorMsg(null)
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Error al actualizar branding')
    },
  })

  const logoUploadMutation = useMutation({
    mutationFn: uploadMiPlantelLogo,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mi-plantel'] })
      setLogoPreview(data.logo_url)
      setSuccessMsg('Logo actualizado exitosamente')
      setErrorMsg(null)
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Error al subir el logo')
    },
  })

  const logoDeleteMutation = useMutation({
    mutationFn: deleteMiPlantelLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-plantel'] })
      setLogoPreview(null)
      setSuccessMsg('Logo eliminado')
      setErrorMsg(null)
      setTimeout(() => setSuccessMsg(null), 3000)
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || 'Error al eliminar el logo')
    },
  })

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    logoUploadMutation.mutate(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleSaveBranding = () => {
    brandingMutation.mutate({
      primary_color: primaryColor === DEFAULT_PRIMARY ? null : primaryColor,
      secondary_color: secondaryColor === DEFAULT_SECONDARY ? null : secondaryColor,
    })
  }

  const handleResetColors = () => {
    setPrimaryColor(DEFAULT_PRIMARY)
    setSecondaryColor(DEFAULT_SECONDARY)
  }

  const handleSelectPreset = (preset: typeof PRESET_PALETTES[0]) => {
    setPrimaryColor(preset.primary)
    setSecondaryColor(preset.secondary)
  }

  const previewPalette = generatePalette(primaryColor)

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="max-w-5xl mx-auto fluid-py-6 fluid-px-4">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-600 to-primary-500 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center fluid-gap-4">
            <Link to="/mi-plantel" className="fluid-p-2 hover:bg-white/20 rounded-fluid-xl transition-colors">
              <ArrowLeft className="fluid-icon-lg" />
            </Link>
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl backdrop-blur-sm">
              <Palette className="fluid-icon-lg" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold">Personalizar Portal</h1>
              <p className="fluid-text-sm text-white/80">{campus?.name || 'Mi Plantel'}</p>
            </div>
          </div>
          {logoPreview && (
            <div className="hidden sm:flex items-center fluid-gap-3 bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-px-4 fluid-py-2">
              <img src={logoPreview} alt="Logo" className="h-10 w-10 object-contain" />
              <span className="fluid-text-sm font-medium">Logo activo</span>
            </div>
          )}
        </div>
      </div>

      {/* Mensajes */}
      {successMsg && (
        <div className="flex items-center fluid-gap-2 fluid-p-4 fluid-mb-4 bg-green-50 border border-green-200 fluid-rounded-xl animate-fade-in-up">
          <Check className="fluid-icon-sm text-green-600 flex-shrink-0" />
          <span className="fluid-text-sm text-green-700 font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center fluid-gap-2 fluid-p-4 fluid-mb-4 bg-red-50 border border-red-200 fluid-rounded-xl">
          <span className="fluid-text-sm text-red-700">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
        {/* ── Logo ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6 flex flex-col">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-1 flex items-center fluid-gap-2">
            <Image className="fluid-icon-sm text-primary-500" />
            Logo del Plantel
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-5">
            Se mostrará en la barra de navegación y en los certificados.
            <span className="text-gray-600 font-medium"> PNG con fondo transparente recomendado.</span>
          </p>

          <div className="flex-1 flex flex-col items-center justify-center fluid-gap-4">
            {/* Preview del logo */}
            <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden transition-all hover:border-primary-300 hover:shadow-md group">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo del plantel" className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform" />
              ) : (
                <div className="text-center fluid-p-4">
                  <div className="w-14 h-14 mx-auto mb-2 rounded-xl bg-gray-200/60 flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-gray-400" />
                  </div>
                  <span className="fluid-text-xs text-gray-400 block">Sin logo configurado</span>
                  <span className="fluid-text-xs text-gray-300">PNG, JPG, WebP, SVG — Máx 2MB</span>
                </div>
              )}
            </div>

            <div className="flex fluid-gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploadMutation.isPending}
                className="flex items-center fluid-gap-2 fluid-px-5 fluid-py-2.5 fluid-text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-fluid-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                {logoUploadMutation.isPending ? 'Subiendo...' : logoPreview ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoPreview && (
                <button
                  onClick={() => logoDeleteMutation.mutate()}
                  disabled={logoDeleteMutation.isPending}
                  className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 fluid-text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-fluid-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Colores ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6 flex flex-col">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-1 flex items-center fluid-gap-2">
            <Palette className="fluid-icon-sm text-primary-500" />
            Colores del Portal
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-5">
            Se aplicarán en botones, enlaces y elementos destacados de tu portal.
          </p>

          {/* Color pickers */}
          <div className="grid grid-cols-2 fluid-gap-4 fluid-mb-5">
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Color primario</label>
              <div className="flex items-center fluid-gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v)
                  }}
                  maxLength={7}
                  className="flex-1 fluid-px-3 fluid-py-2.5 fluid-text-sm border border-gray-200 rounded-fluid-lg font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">Color secundario</label>
              <div className="flex items-center fluid-gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setSecondaryColor(v)
                  }}
                  maxLength={7}
                  className="flex-1 fluid-px-3 fluid-py-2.5 fluid-text-sm border border-gray-200 rounded-fluid-lg font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Paleta generada */}
          <div className="fluid-mb-5">
            <span className="fluid-text-xs font-semibold text-gray-400 uppercase tracking-wider">Paleta generada</span>
            <div className="flex rounded-xl overflow-hidden mt-2 shadow-inner">
              {Object.entries(previewPalette).map(([shade, color]) => (
                <div
                  key={shade}
                  className="flex-1 h-10 relative group cursor-default"
                  style={{ backgroundColor: color }}
                  title={`${shade}: ${color}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center fluid-text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity text-white mix-blend-difference">
                    {shade}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex fluid-gap-2 mt-auto">
            <button
              onClick={handleSaveBranding}
              disabled={!hasChanges || brandingMutation.isPending}
              className="flex-1 flex items-center justify-center fluid-gap-2 fluid-px-4 fluid-py-2.5 fluid-text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-fluid-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Check className="w-4 h-4" />
              {brandingMutation.isPending ? 'Guardando...' : 'Guardar colores'}
            </button>
            <button
              onClick={handleResetColors}
              className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2.5 fluid-text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-fluid-lg transition-colors"
              title="Restaurar colores predeterminados"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Paletas predefinidas ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6 lg:col-span-2">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-1 flex items-center fluid-gap-2">
            <Sparkles className="fluid-icon-sm text-primary-500" />
            Paletas predefinidas
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Selecciona una paleta como punto de partida, o personaliza los colores manualmente.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 fluid-gap-3">
            {PRESET_PALETTES.map((preset) => {
              const isActive = primaryColor === preset.primary && secondaryColor === preset.secondary
              return (
                <button
                  key={preset.name}
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex flex-col items-center fluid-p-3 rounded-xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isActive
                      ? 'border-gray-900 shadow-md bg-gray-50'
                      : 'border-gray-100 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex rounded-full overflow-hidden w-10 h-10 fluid-mb-2 shadow-sm ring-2 ring-white">
                    <div className="flex-1" style={{ backgroundColor: preset.primary }} />
                    <div className="flex-1" style={{ backgroundColor: preset.secondary }} />
                  </div>
                  <span className="fluid-text-xs text-gray-600 text-center leading-tight">{preset.name}</span>
                  {isActive && <Check className="w-3 h-3 text-gray-900 mt-1" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Preview en vivo ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6 lg:col-span-2">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-1 flex items-center fluid-gap-2">
            <Eye className="fluid-icon-sm text-primary-500" />
            Vista previa
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Así se verá tu portal con la configuración actual.
          </p>

          {/* Mini portal preview */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner">
            {/* Navbar mock */}
            <div className="bg-white border-b fluid-px-4 fluid-py-3 flex items-center fluid-gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-8 w-8 object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: previewPalette['100'] }}>
                  <Building2 className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
              )}
              <span className="font-bold fluid-text-base" style={{ color: primaryColor }}>
                {campus?.name || 'Mi Plantel'}
              </span>
              <div className="ml-auto flex items-center fluid-gap-2">
                <span className="fluid-px-3 fluid-py-1 fluid-text-xs rounded-full text-white font-medium" style={{ backgroundColor: primaryColor }}>
                  Mi Plantel
                </span>
                <span className="fluid-px-3 fluid-py-1 fluid-text-xs rounded-full text-gray-500 bg-gray-100">
                  Grupos
                </span>
                <span className="fluid-px-3 fluid-py-1 fluid-text-xs rounded-full text-gray-500 bg-gray-100">
                  Reportes
                </span>
              </div>
            </div>

            {/* Content area preview */}
            <div className="fluid-p-6 bg-gray-50">
              <div className="flex fluid-gap-4">
                <div className="flex-1 bg-white rounded-xl fluid-p-4 border border-gray-100">
                  <div className="flex items-center fluid-gap-2 fluid-mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: previewPalette['100'] }}>
                      <Building2 className="w-4 h-4" style={{ color: primaryColor }} />
                    </div>
                    <span className="fluid-text-sm font-semibold text-gray-900">Resumen</span>
                  </div>
                  <div className="flex fluid-gap-2">
                    <button className="fluid-px-3 fluid-py-1.5 fluid-text-xs font-medium text-white rounded-lg" style={{ backgroundColor: primaryColor }}>
                      Acción primaria
                    </button>
                    <button className="fluid-px-3 fluid-py-1.5 fluid-text-xs font-medium rounded-lg border" style={{ color: primaryColor, borderColor: primaryColor }}>
                      Secundaria
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl fluid-p-4 border border-gray-100">
                  <div className="flex items-center fluid-gap-2 fluid-mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: previewPalette['100'] }}>
                      <Eye className="w-4 h-4" style={{ color: primaryColor }} />
                    </div>
                    <span className="fluid-text-sm font-semibold text-gray-900">Estadísticas</span>
                  </div>
                  <div className="flex fluid-gap-2 items-center">
                    <span className="fluid-text-2xl font-bold" style={{ color: primaryColor }}>95%</span>
                    <span className="fluid-text-xs text-gray-500">aprobación</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BrandingConfigPage
