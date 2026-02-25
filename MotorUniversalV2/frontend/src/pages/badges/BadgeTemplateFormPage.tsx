/**
 * BadgeTemplateFormPage — Crear/Editar plantilla de insignia digital
 * Asocia insignias a ECM (Estándares de Competencia) en lugar de exámenes.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Award, ArrowLeft, Save, Upload, Image as ImageIcon,
  Tag, Clock, Globe, FileText, BookOpen, Sparkles, Search
} from 'lucide-react'
import { badgeService } from '../../services/badgeService'
import { getStandards, type CompetencyStandard } from '../../services/standardsService'

export default function BadgeTemplateFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [standards, setStandards] = useState<CompetencyStandard[]>([])
  const [standardSearch, setStandardSearch] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFromEcm, setImageFromEcm] = useState(false)
  const [selectedStandard, setSelectedStandard] = useState<CompetencyStandard | null>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    criteria_narrative: '',
    exam_id: null as number | null,
    competency_standard_id: null as number | null,
    issuer_name: '',
    issuer_url: '',
    issuer_image_url: '',
    tags: '',
    expiry_months: null as number | null,
    is_active: true,
  })

  useEffect(() => {
    // Load ECM standards
    getStandards({ active_only: true, include_stats: false }).then(data => {
      setStandards(data.standards || [])
    }).catch(() => {})

    // Load template if editing
    if (isEdit) {
      setLoading(true)
      badgeService.getTemplate(Number(id)).then(t => {
        setForm({
          name: t.name || '',
          description: t.description || '',
          criteria_narrative: t.criteria_narrative || '',
          exam_id: t.exam_id,
          competency_standard_id: t.competency_standard_id,
          issuer_name: t.issuer_name || '',
          issuer_url: t.issuer_url || '',
          issuer_image_url: t.issuer_image_url || '',
          tags: t.tags || '',
          expiry_months: t.expiry_months,
          is_active: t.is_active,
        })
        if (t.badge_image_url) setImagePreview(t.badge_image_url)
      }).catch(err => {
        console.error(err)
        navigate('/badges/templates')
      }).finally(() => setLoading(false))
    }
  }, [id, isEdit, navigate])

  // When standards load + we're editing, find the selected standard
  useEffect(() => {
    if (form.competency_standard_id && standards.length > 0) {
      const s = standards.find(s => s.id === form.competency_standard_id)
      if (s) setSelectedStandard(s)
    }
  }, [form.competency_standard_id, standards])

  const handleStandardSelect = (standardId: number | null) => {
    if (!standardId) {
      setSelectedStandard(null)
      setForm(prev => ({ ...prev, competency_standard_id: null }))
      return
    }

    const std = standards.find(s => s.id === standardId)
    if (!std) return

    setSelectedStandard(std)

    // Pre-fill fields from ECM data
    const updates: Partial<typeof form> = {
      competency_standard_id: std.id,
    }

    // Only pre-fill empty fields (don't overwrite user edits)
    if (!form.name.trim()) {
      updates.name = `${std.code} — ${std.name}`
    }
    if (!form.description?.trim() && std.description) {
      updates.description = std.description
    }
    if (!form.criteria_narrative?.trim()) {
      updates.criteria_narrative = `Aprobó la evaluación del estándar de competencia ${std.code} "${std.name}" con resultado competente.`
    }
    if (form.expiry_months === null && std.validity_years) {
      updates.expiry_months = std.validity_years * 12
    }
    if (!form.tags?.trim()) {
      const tagParts = [std.code]
      if (std.sector) tagParts.push(std.sector)
      if (std.certifying_body) tagParts.push(std.certifying_body)
      updates.tags = tagParts.join(', ')
    }
    // Pre-fill issuer from ECM certifying body + brand
    if (!form.issuer_name?.trim()) {
      const issuerParts: string[] = []
      if (std.certifying_body) issuerParts.push(std.certifying_body)
      if (std.brand?.name) issuerParts.push(std.brand.name)
      if (issuerParts.length > 0) {
        updates.issuer_name = issuerParts.join(' / ')
      }
    }
    if (!form.issuer_image_url?.trim() && std.brand?.logo_url) {
      updates.issuer_image_url = std.brand.logo_url
    }

    setForm(prev => ({ ...prev, ...updates }))

    // Set ECM logo as default image if no custom image uploaded
    if (!imageFile && std.logo_url) {
      setImagePreview(std.logo_url)
      setImageFromEcm(true)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setImageFromEcm(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('El nombre es requerido')

    setSaving(true)
    try {
      let templateId = isEdit ? Number(id) : 0

      // If using ECM image as default, pass the logo_url
      const formData = { ...form }
      if (imageFromEcm && selectedStandard?.logo_url && !imageFile) {
        formData.issuer_image_url = selectedStandard.logo_url
      }

      if (isEdit) {
        await badgeService.updateTemplate(templateId, formData)
      } else {
        const result = await badgeService.createTemplate(formData)
        templateId = result.template.id
      }

      // Upload image if selected (custom file overrides ECM logo)
      if (imageFile && templateId) {
        await badgeService.uploadTemplateImage(templateId, imageFile)
      }

      navigate('/badges/templates')
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Filter standards by search
  const filteredStandards = standards.filter(s =>
    !standardSearch ||
    s.code.toLowerCase().includes(standardSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(standardSearch.toLowerCase()) ||
    (s.sector || '').toLowerCase().includes(standardSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center fluid-py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="fluid-p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center fluid-gap-3 fluid-mb-6">
        <button
          onClick={() => navigate('/badges/templates')}
          className="fluid-p-2 rounded-fluid-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="fluid-icon-sm text-gray-600" />
        </button>
        <div className="fluid-p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-fluid-lg shadow">
          <Award className="fluid-icon-md text-white" />
        </div>
        <div>
          <h1 className="fluid-text-xl font-bold text-gray-900">
            {isEdit ? 'Editar Plantilla' : 'Nueva Plantilla de Insignia'}
          </h1>
          <p className="fluid-text-sm text-gray-500">Open Badges 3.0</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── ECM Association (first, so it can pre-fill) ── */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <BookOpen className="fluid-icon-sm text-blue-600" />
            Estándar de Competencia (ECM)
          </h2>

          {/* Search box for standards */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
            <input
              type="text"
              placeholder="Buscar ECM por código, nombre o sector..."
              value={standardSearch}
              onChange={e => setStandardSearch(e.target.value)}
              className="w-full fluid-pl-10 fluid-pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 fluid-text-sm"
            />
          </div>

          <select
            value={form.competency_standard_id || ''}
            onChange={e => handleStandardSelect(e.target.value ? Number(e.target.value) : null)}
            className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">— Seleccionar ECM —</option>
            {filteredStandards.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
                {s.sector ? ` (${s.sector})` : ''}
              </option>
            ))}
          </select>

          {/* Selected ECM summary */}
          {selectedStandard && (
            <div className="flex items-start fluid-gap-3 fluid-p-3 bg-blue-50 rounded-fluid-lg border border-blue-100">
              {selectedStandard.logo_url ? (
                <img
                  src={selectedStandard.logo_url}
                  alt={selectedStandard.code}
                  className="w-12 h-12 rounded-fluid-lg object-contain bg-white border border-gray-200 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-fluid-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="fluid-icon-sm text-blue-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-blue-900 fluid-text-sm">{selectedStandard.code}</p>
                <p className="text-blue-700 fluid-text-xs truncate">{selectedStandard.name}</p>
                {selectedStandard.sector && (
                  <p className="text-blue-500 fluid-text-xs">Sector: {selectedStandard.sector}</p>
                )}
                {selectedStandard.validity_years && (
                  <p className="text-blue-500 fluid-text-xs">Vigencia: {selectedStandard.validity_years} años</p>
                )}
              </div>
              <div className="flex items-center fluid-gap-1">
                <Sparkles className="fluid-icon-xs text-blue-400" />
                <span className="fluid-text-xs text-blue-500">Datos prellenados</span>
              </div>
            </div>
          )}

          <p className="fluid-text-xs text-gray-400">
            Al seleccionar un ECM, se prellenarán los campos con sus datos. Puedes modificarlos libremente.
          </p>
        </div>

        {/* ── Basic Info ── */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <FileText className="fluid-icon-sm text-blue-600" />
            Información Básica
          </h2>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: EC0217 — Impartición de cursos de formación del capital humano"
              required
            />
          </div>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Descripción de la insignia..."
            />
          </div>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Criterios de Obtención</label>
            <textarea
              value={form.criteria_narrative}
              onChange={e => setForm({ ...form, criteria_narrative: e.target.value })}
              rows={2}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Aprobó la evaluación con resultado competente..."
            />
          </div>
        </div>

        {/* ── Badge Image ── */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <ImageIcon className="fluid-icon-sm text-blue-600" />
            Imagen de la Insignia
          </h2>

          <div className="flex items-start fluid-gap-5">
            <div className="w-32 h-32 bg-gray-50 rounded-fluid-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 relative">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                  {imageFromEcm && (
                    <span className="absolute bottom-1 right-1 fluid-px-1 fluid-py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600 rounded">
                      ECM
                    </span>
                  )}
                </>
              ) : (
                <Award className="fluid-icon-xl text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-50 text-blue-700 rounded-fluid-lg font-medium hover:bg-blue-100 transition-colors">
                <Upload className="fluid-icon-sm" />
                Subir Imagen
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <p className="fluid-text-xs text-gray-400 mt-2">
                Recomendado: PNG 600×750px. Si no subes imagen, se generará automáticamente.
              </p>
              {imageFromEcm && (
                <p className="fluid-text-xs text-blue-500 mt-1 flex items-center fluid-gap-1">
                  <Sparkles className="fluid-icon-xs" />
                  Usando logo del ECM como predefinido. Sube otra para reemplazarla.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Issuer ── */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <Globe className="fluid-icon-sm text-blue-600" />
            Emisor (Issuer)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4">
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Nombre del Emisor</label>
              <input
                type="text"
                value={form.issuer_name}
                onChange={e => setForm({ ...form, issuer_name: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="EIA / EduIT"
              />
            </div>
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">URL del Emisor</label>
              <input
                type="url"
                value={form.issuer_url}
                onChange={e => setForm({ ...form, issuer_url: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://evaluaasi.com"
              />
            </div>
          </div>
        </div>

        {/* ── Extra Config ── */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <Clock className="fluid-icon-sm text-blue-600" />
            Configuración Adicional
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4">
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Vigencia (meses)</label>
              <input
                type="number"
                min={0}
                value={form.expiry_months ?? ''}
                onChange={e => setForm({ ...form, expiry_months: e.target.value ? Number(e.target.value) : null })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0 = sin expiración"
              />
              {selectedStandard?.validity_years && (
                <p className="fluid-text-xs text-blue-500 mt-1">
                  ECM sugiere {selectedStandard.validity_years} año{selectedStandard.validity_years > 1 ? 's' : ''} ({selectedStandard.validity_years * 12} meses)
                </p>
              )}
            </div>
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Etiquetas</label>
              <div className="flex items-center fluid-gap-2">
                <Tag className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="EC0217, administración, CONOCER, ..."
                />
              </div>
            </div>
          </div>

          <div className="flex items-center fluid-gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <span className="fluid-text-sm font-medium text-gray-700">Plantilla activa</span>
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="flex justify-end fluid-gap-3">
          <button
            type="button"
            onClick={() => navigate('/badges/templates')}
            className="fluid-px-5 fluid-py-2 border border-gray-300 text-gray-700 rounded-fluid-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Save className="fluid-icon-sm" />
            )}
            {isEdit ? 'Guardar Cambios' : 'Crear Plantilla'}
          </button>
        </div>
      </form>
    </div>
  )
}
