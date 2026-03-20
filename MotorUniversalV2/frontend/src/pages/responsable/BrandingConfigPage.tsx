/**
 * Página de configuración de branding del plantel
 * Permite al responsable personalizar logo y colores de su portal
 */
import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMiPlantel, updateMiPlantelBranding, uploadMiPlantelLogo, deleteMiPlantelLogo } from '../../services/partnersService'
import { useAuthStore } from '../../store/authStore'
import { Palette, Upload, Trash2, RotateCcw, Check, Eye, Building2, Image } from 'lucide-react'
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
    <div className="max-w-4xl mx-auto fluid-py-6 fluid-px-4">
      {/* Header */}
      <div className="fluid-mb-6">
        <div className="flex items-center fluid-gap-3 fluid-mb-2">
          <div className="fluid-p-2 rounded-lg" style={{ backgroundColor: previewPalette['100'] }}>
            <Palette className="fluid-icon" style={{ color: primaryColor }}  />
          </div>
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-900">Personalizar Portal</h1>
            <p className="fluid-text-sm text-gray-500">{campus?.name}</p>
          </div>
        </div>
        <p className="fluid-text-base text-gray-600">
          Personaliza la apariencia de tu portal con el logo y los colores de tu plantel.
        </p>
      </div>

      {/* Mensajes */}
      {successMsg && (
        <div className="flex items-center fluid-gap-2 fluid-p-4 fluid-mb-4 bg-green-50 border border-green-200 fluid-rounded-lg">
          <Check className="fluid-icon-sm text-green-600 flex-shrink-0" />
          <span className="fluid-text-sm text-green-700">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center fluid-gap-2 fluid-p-4 fluid-mb-4 bg-red-50 border border-red-200 fluid-rounded-lg">
          <span className="fluid-text-sm text-red-700">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-6">
        {/* ── Logo ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <Image className="fluid-icon-sm text-gray-500" />
            Logo del Plantel
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Sube el logo de tu plantel. Se mostrará en la barra de navegación. Formatos: PNG, JPG, WebP, SVG. Máximo 2MB.
          </p>

          <div className="flex flex-col items-center fluid-gap-4">
            {/* Preview del logo */}
            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo del plantel" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center">
                  <Building2 className="w-8 h-8 text-gray-400 mx-auto" />
                  <span className="fluid-text-xs text-gray-400 mt-1">Sin logo</span>
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
                className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 fluid-text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                <Upload className="w-4 h-4" />
                {logoUploadMutation.isPending ? 'Subiendo...' : 'Subir logo'}
              </button>
              {logoPreview && (
                <button
                  onClick={() => logoDeleteMutation.mutate()}
                  disabled={logoDeleteMutation.isPending}
                  className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 fluid-text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Colores ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <Palette className="fluid-icon-sm text-gray-500" />
            Colores del Portal
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Elige los colores que representan a tu plantel. Se aplicarán en botones, enlaces y elementos destacados.
          </p>

          {/* Color pickers */}
          <div className="grid grid-cols-2 fluid-gap-4 fluid-mb-4">
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Color primario</label>
              <div className="flex items-center fluid-gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setPrimaryColor(v)
                  }}
                  maxLength={7}
                  className="flex-1 fluid-px-3 fluid-py-2 fluid-text-sm border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Color secundario</label>
              <div className="flex items-center fluid-gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setSecondaryColor(v)
                  }}
                  maxLength={7}
                  className="flex-1 fluid-px-3 fluid-py-2 fluid-text-sm border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex fluid-gap-2 fluid-mb-4">
            <button
              onClick={handleSaveBranding}
              disabled={!hasChanges || brandingMutation.isPending}
              className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 fluid-text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: hasChanges ? primaryColor : '#9ca3af' }}
            >
              <Check className="w-4 h-4" />
              {brandingMutation.isPending ? 'Guardando...' : 'Guardar colores'}
            </button>
            <button
              onClick={handleResetColors}
              className="flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 fluid-text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar
            </button>
          </div>

          {/* Paleta generada */}
          <div className="fluid-mb-2">
            <span className="fluid-text-xs font-medium text-gray-500 uppercase">Paleta generada</span>
          </div>
          <div className="flex rounded-lg overflow-hidden fluid-mb-4">
            {Object.entries(previewPalette).map(([shade, color]) => (
              <div
                key={shade}
                className="flex-1 h-8"
                style={{ backgroundColor: color }}
                title={`${shade}: ${color}`}
              />
            ))}
          </div>
        </div>

        {/* ── Paletas predefinidas ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6 lg:col-span-2">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4">Paletas predefinidas</h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Selecciona una paleta como punto de partida, o personaliza los colores manualmente arriba.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 fluid-gap-3">
            {PRESET_PALETTES.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(preset)}
                className={`flex flex-col items-center fluid-p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                  primaryColor === preset.primary && secondaryColor === preset.secondary
                    ? 'border-gray-900 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex rounded-full overflow-hidden w-10 h-10 fluid-mb-2">
                  <div className="flex-1" style={{ backgroundColor: preset.primary }} />
                  <div className="flex-1" style={{ backgroundColor: preset.secondary }} />
                </div>
                <span className="fluid-text-xs text-gray-600 text-center">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Preview en vivo ── */}
        <div className="bg-white fluid-rounded-xl shadow-sm border border-gray-200 fluid-p-6 lg:col-span-2">
          <h2 className="fluid-text-lg font-semibold text-gray-900 fluid-mb-4 flex items-center fluid-gap-2">
            <Eye className="fluid-icon-sm text-gray-500" />
            Vista previa
          </h2>
          <p className="fluid-text-sm text-gray-500 fluid-mb-4">
            Así se verá tu portal con la configuración actual.
          </p>

          {/* Mini navbar preview */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
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
