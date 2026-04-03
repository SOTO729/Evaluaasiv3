/**
 * BadgeTemplateFormPage — Crear/Editar plantilla de insignia digital
 * Asocia insignias a ECM (Estándares de Competencia) en lugar de exámenes.
 * UI consistente con el sistema de diseño fluido de la app.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Award, ArrowLeft, Save, Upload, Image as ImageIcon,
  Clock, Globe, FileText, BookOpen, Sparkles, Search,
  CheckCircle2, AlertCircle, X, Eye, EyeOff,
    ChevronDown, Info, Zap, ExternalLink
} from 'lucide-react'
import { badgeService } from '../../services/badgeService'
import { getStandards, type CompetencyStandard } from '../../services/standardsService'

/* ═══════════════ tipos ═══════════════ */
interface FormState {
  name: string
  description: string
  criteria_narrative: string
  criteria_url: string
  exam_id: number | null
  competency_standard_id: number | null
  skills: string
  expiry_months: number | null
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  criteria_narrative: '',
  criteria_url: '',
  exam_id: null,
  competency_standard_id: null,
  skills: '',
  expiry_months: null,
  is_active: true,
}

/* ═══════════════ helpers ═══════════════ */
const tagArray = (tags: unknown) =>
  (typeof tags === 'string' ? tags : '').split(',').map(t => t.trim()).filter(Boolean)

export default function BadgeTemplateFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = id && id !== 'new'

  /* ── state ── */
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [standards, setStandards] = useState<CompetencyStandard[]>([])
  const [standardSearch, setStandardSearch] = useState('')
  const [showStandardDropdown, setShowStandardDropdown] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFromEcm, setImageFromEcm] = useState(false)
  const [selectedStandard, setSelectedStandard] = useState<CompetencyStandard | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageRemoved, setImageRemoved] = useState(false)
  const [issuerLogoFile, setIssuerLogoFile] = useState<File | null>(null)
  const [issuerLogoPreview, setIssuerLogoPreview] = useState<string | null>(null)
  const [issuerLogoRemoved, setIssuerLogoRemoved] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  /* ── load data ── */
  useEffect(() => {
    getStandards({ active_only: true, include_stats: false }).then(data => {
      setStandards(data.standards || [])
    }).catch(() => {})

    if (isEdit) {
      setLoading(true)
      badgeService.getTemplate(Number(id)).then(t => {
        setForm({
          name: t.name || '',
          description: t.description || '',
          criteria_narrative: t.criteria_narrative || '',            criteria_url: (t as any).criteria_url || '',          exam_id: t.exam_id,
          competency_standard_id: t.competency_standard_id,
          skills: Array.isArray((t as any).skills) ? (t as any).skills.join(', ') : ((t as any).skills || ''),
          expiry_months: t.expiry_months || null,
          is_active: t.is_active,
        })
        const previewUrl = t.display_image_url || t.badge_image_url
        if (previewUrl) setImagePreview(previewUrl)
        if (t.issuer_logo_url) setIssuerLogoPreview(t.issuer_logo_url)
      }).catch(err => {
        console.error(err)
        navigate('/badges/templates')
      }).finally(() => setLoading(false))
    } else {
      // Nueva plantilla: pre-rellenar logo del emisor desde plantillas existentes
      badgeService.getTemplates(1, 100).then(data => {
        const withLogo = (data.templates || []).find(t => t.issuer_logo_url)
        if (withLogo?.issuer_logo_url && !issuerLogoPreview) {
          setIssuerLogoPreview(withLogo.issuer_logo_url)
        }
      }).catch(() => {})
    }
  }, [id, isEdit, navigate])

  /* ── match selected standard on load ── */
  useEffect(() => {
    if (form.competency_standard_id && standards.length > 0) {
      const s = standards.find(s => s.id === form.competency_standard_id)
      if (s) setSelectedStandard(s)
    }
  }, [form.competency_standard_id, standards])

  /* ── close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStandardDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── toast timer ── */
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  /* ═══════════════ ECM selection + prefill ═══════════════ */
  const handleStandardSelect = useCallback((std: CompetencyStandard) => {
    setSelectedStandard(std)
    setShowStandardDropdown(false)
    setStandardSearch('')

    const updates: Partial<FormState> = { competency_standard_id: std.id }
    const prefilled: string[] = []

    if (!form.name.trim()) {
      updates.name = `${std.code} — ${std.name}`
      prefilled.push('nombre')
    }
    if (!form.description?.trim() && std.description) {
      updates.description = std.description
      prefilled.push('descripción')
    }
    if (!form.criteria_narrative?.trim()) {
      updates.criteria_narrative = `Aprobó la evaluación del estándar de competencia ${std.code} "${std.name}" con resultado competente.`
      prefilled.push('criterios')
    }
    if (form.expiry_months === null && std.validity_years) {
      updates.expiry_months = std.validity_years * 12
      prefilled.push('vigencia')
    }
    if (!form.skills?.trim()) {
      const skillParts: string[] = []
      if (std.name) skillParts.push(std.name)
      if (std.sector) skillParts.push(std.sector)
      if (skillParts.length > 0) {
        updates.skills = skillParts.join(', ')
        prefilled.push('aptitudes')
      }
    }

    setForm(prev => ({ ...prev, ...updates }))

    if (!imageFile && std.logo_url) {
      setImagePreview(std.logo_url)
      setImageFromEcm(true)
    }

    if (prefilled.length > 0) {
      setToast(`Prellenados: ${prefilled.join(', ')}`)
    }
  }, [form, imageFile])

  const handleClearStandard = () => {
    setSelectedStandard(null)
    setForm(prev => ({ ...prev, competency_standard_id: null }))
  }

  /* ═══════════════ image handling ═══════════════ */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setImageRemoved(false)
      setImageFromEcm(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setImageFromEcm(false)
      setImageRemoved(false)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageFromEcm(false)
    setImageRemoved(true)
  }

  /* ═══════════════ validation ═══════════════ */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'El nombre es requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  /* ═══════════════ submit ═══════════════ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      let templateId = isEdit ? Number(id) : 0

      const formData = { ...form }

      if (isEdit) {
        await badgeService.updateTemplate(templateId, formData)
      } else {
        const result = await badgeService.createTemplate(formData)
        templateId = result.template.id
      }

      if (imageFile && templateId) {
        await badgeService.uploadTemplateImage(templateId, imageFile)
      } else if (imageRemoved && isEdit && templateId) {
        await badgeService.deleteTemplateImage(templateId)
      }

      if (issuerLogoFile && templateId) {
        await badgeService.uploadIssuerLogo(templateId, issuerLogoFile)
      } else if (issuerLogoRemoved && isEdit && templateId) {
        await badgeService.deleteIssuerLogo(templateId)
      }

      navigate('/badges/templates')
    } catch (err: any) {
      console.error(err)
      const msg = err?.response?.data?.error || 'Error al guardar la plantilla'
      setErrors({ submit: msg })
    } finally {
      setSaving(false)
    }
  }

  /* ── filtered standards ── */
  const filteredStandards = standards.filter(s =>
    !standardSearch ||
    s.code.toLowerCase().includes(standardSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(standardSearch.toLowerCase()) ||
    (s.sector || '').toLowerCase().includes(standardSearch.toLowerCase())
  )

  /* ═══════════════ loading state ═══════════════ */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center fluid-py-20 animate-fade-in-up">
        <div className="animate-spin rounded-full fluid-w-12 fluid-h-12 border-b-4 border-blue-600 fluid-mb-4" />
        <p className="fluid-text-sm text-gray-500">Cargando plantilla…</p>
      </div>
    )
  }

  /* ═══════════════ render ═══════════════ */
  return (
    <div className="max-w-[1600px] mx-auto fluid-px-6 fluid-py-6 animate-fade-in-up">

      {/* ── Toast notification ── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="flex items-center fluid-gap-3 fluid-px-5 fluid-py-3 rounded-fluid-lg shadow-lg bg-blue-600 text-white">
            <Sparkles className="fluid-icon-sm flex-shrink-0" />
            <span className="fluid-text-sm font-medium">{toast}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Back link ── */}
      <Link
        to="/badges/templates"
        className="inline-flex items-center fluid-gap-2 text-gray-600 hover:text-gray-900 fluid-mb-4 group fluid-text-sm font-medium transition-colors"
      >
        <ArrowLeft className="fluid-icon-sm group-hover:-translate-x-1 transition-transform" />
        Volver a Insignias
      </Link>

      {/* ── Gradient Header Banner ── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex items-center fluid-gap-4">
          <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
            <Award className="fluid-icon-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="fluid-text-2xl font-bold">
              {isEdit ? 'Editar Plantilla' : 'Nueva Plantilla de Insignia'}
            </h1>
            <p className="fluid-text-sm text-blue-100 fluid-mt-1">
              {isEdit
                ? 'Modifica los datos de la plantilla de insignia digital'
                : 'Configura una nueva plantilla Open Badges 3.0 asociada a un ECM'}
            </p>
          </div>
          {/* Preview badge in header */}
          {imagePreview && (
            <div className="hidden sm:block w-16 h-16 bg-white/10 rounded-fluid-xl overflow-hidden border-2 border-white/20 flex-shrink-0">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* ── Error alert ── */}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-fluid-xl fluid-p-4 fluid-mb-6 flex items-start fluid-gap-3 animate-fadeIn">
          <AlertCircle className="fluid-icon-sm text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-700 fluid-text-sm">Error al guardar</p>
            <p className="fluid-text-xs text-red-600">{errors.submit}</p>
          </div>
          <button onClick={() => setErrors(prev => { const { submit, ...rest } = prev; return rest })} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ════════════════════════════════════════════
            MAIN 2-COL LAYOUT: Left (content) + Right (sidebar)
        ════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 fluid-gap-6">

          {/* ━━━━━━━━━━━━━━ LEFT COLUMN (8/12) ━━━━━━━━━━━━━━ */}
          <div className="xl:col-span-8 flex flex-col fluid-gap-6">

            {/* ── SECTION: ECM Association ── */}
            <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
          <div className="flex items-center fluid-gap-3 fluid-mb-4">
            <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
              <BookOpen className="fluid-icon-sm text-blue-600" />
            </div>
            <div>
              <h2 className="fluid-text-lg font-semibold text-gray-900">Estándar de Competencia</h2>
              <p className="fluid-text-xs text-gray-500">Vincula esta insignia a un ECM para pre-llenar datos automáticamente</p>
            </div>
          </div>

          {/* Custom searchable dropdown */}
          <div className="relative" ref={dropdownRef}>
            {selectedStandard ? (
              /* ── Selected standard card ── */
              <div className="flex items-center fluid-gap-4 fluid-p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-fluid-xl border border-blue-200 transition-all">
                {selectedStandard.logo_url ? (
                  <img
                    src={selectedStandard.logo_url}
                    alt={selectedStandard.code}
                    className="w-14 h-14 rounded-fluid-lg object-contain bg-white border border-gray-200 flex-shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-fluid-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="fluid-icon-sm text-blue-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center fluid-gap-2">
                    <span className="inline-flex items-center fluid-px-2 fluid-py-0.5 bg-blue-100 text-blue-700 rounded-full fluid-text-2xs font-bold tracking-wide">
                      {selectedStandard.code}
                    </span>
                    {selectedStandard.validity_years != null && selectedStandard.validity_years > 0 && (
                      <span className="inline-flex items-center fluid-gap-1 fluid-text-2xs text-gray-500">
                        <Clock className="w-3 h-3" /> {selectedStandard.validity_years} año{selectedStandard.validity_years > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 fluid-text-sm truncate fluid-mt-1">{selectedStandard.name}</p>
                  {selectedStandard.sector && (
                    <p className="fluid-text-xs text-gray-500 truncate">Sector: {selectedStandard.sector}</p>
                  )}
                </div>
                <div className="flex flex-col items-end fluid-gap-2">
                  <div className="flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-green-50 text-green-700 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="fluid-text-2xs font-medium">Vinculado</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearStandard}
                    className="fluid-text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              /* ── Search input ── */
              <div>
                <div
                  className="relative cursor-pointer"
                  onClick={() => {
                    setShowStandardDropdown(true)
                    setTimeout(() => searchInputRef.current?.focus(), 100)
                  }}
                >
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar ECM por código, nombre o sector…"
                    value={standardSearch}
                    onChange={e => {
                      setStandardSearch(e.target.value)
                      setShowStandardDropdown(true)
                    }}
                    onFocus={() => setShowStandardDropdown(true)}
                    className="w-full fluid-pl-10 fluid-pr-4 fluid-py-3 border-2 border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 fluid-text-sm bg-gray-50 hover:bg-white transition-colors placeholder:text-gray-400"
                  />
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>

                {/* ── Dropdown list ── */}
                {showStandardDropdown && (
                  <div className="absolute z-20 w-full fluid-mt-1 bg-white rounded-fluid-xl shadow-xl border border-gray-200 max-h-72 overflow-y-auto">
                    {filteredStandards.length === 0 ? (
                      <div className="fluid-p-4 text-center">
                        <Search className="fluid-icon-sm text-gray-300 mx-auto fluid-mb-2" />
                        <p className="fluid-text-sm text-gray-500">No se encontraron ECM</p>
                      </div>
                    ) : (
                      filteredStandards.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleStandardSelect(s)}
                          className="w-full text-left fluid-px-4 fluid-py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 flex items-center fluid-gap-3 group"
                        >
                          {s.logo_url ? (
                            <img src={s.logo_url} alt="" className="w-9 h-9 rounded-lg object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center fluid-gap-2">
                              <span className="fluid-text-xs font-bold text-blue-600">{s.code}</span>
                              {s.sector && <span className="fluid-text-2xs text-gray-400">• {s.sector}</span>}
                            </div>
                            <p className="fluid-text-sm text-gray-700 truncate group-hover:text-blue-700">{s.name}</p>
                          </div>
                          {s.validity_years != null && s.validity_years > 0 && (
                            <span className="fluid-text-2xs text-gray-400 flex-shrink-0">{s.validity_years}a</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Helper */}
          <div className="flex items-start fluid-gap-2 fluid-mt-3 fluid-p-3 bg-gray-50 rounded-fluid-lg">
            <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="fluid-text-xs text-gray-500">
              Al seleccionar un ECM se pre-llenarán automáticamente los campos vacíos. Puedes modificarlos libremente después.
            </p>
          </div>
        </section>

            {/* ── SECTION: Basic Info ── */}
            <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
            <div className="flex items-center fluid-gap-3 fluid-mb-5">
              <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
                <FileText className="fluid-icon-sm text-blue-600" />
              </div>
              <h2 className="fluid-text-lg font-semibold text-gray-900">Información Básica</h2>
            </div>

            <div className="flex flex-col fluid-gap-4">
              {/* Name */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  Nombre de la Insignia <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors(prev => { const { name, ...rest } = prev; return rest }) }}
                  className={`w-full fluid-px-4 py-2.5 border-2 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm transition-colors ${errors.name ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 hover:border-gray-300'}`}
                  placeholder="Ej: EC0217 — Impartición de cursos de formación"
                />
                {errors.name && (
                  <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium flex items-center fluid-gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.name}
                  </p>
                )}
              </div>

              {/* Description + Criteria side by side on large */}
              <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-4">
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors resize-none"
                    placeholder="Descripción de lo que certifica esta insignia…"
                  />
                </div>

                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Criterios de Obtención</label>
                  <textarea
                    value={form.criteria_narrative}
                    onChange={e => setForm({ ...form, criteria_narrative: e.target.value })}
                    rows={4}
                    className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors resize-none"
                    placeholder="Aprobó la evaluación con resultado competente…"
                  />
                </div>
              </div>

              {/* URL Criterios de Obtención */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  <ExternalLink className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                  URL de Criterios de Obtención <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="url"
                  value={form.criteria_url}
                  onChange={e => setForm({ ...form, criteria_url: e.target.value })}
                  className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors"
                  placeholder="https://ejemplo.com/criterios-de-obtencion"
                />
                <p className="fluid-text-xs text-gray-400 mt-1">Si se proporciona, se mostrará un enlace en la página de verificación de la insignia</p>
              </div>

              {/* Aptitudes (Skills) */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                  <Zap className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                  Aptitudes
                </label>
                <input
                  type="text"
                  value={form.skills}
                  onChange={e => setForm({ ...form, skills: e.target.value })}
                  className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors"
                  placeholder="Ej: Liderazgo, Gestión de proyectos, Comunicación…"
                />
                {form.skills && (
                  <div className="flex flex-wrap fluid-gap-1 fluid-mt-2">
                    {tagArray(form.skills).map((skill, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center fluid-px-2.5 fluid-py-0.5 bg-emerald-50 text-emerald-700 rounded-full fluid-text-2xs font-medium border border-emerald-100"
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <p className="fluid-text-2xs text-gray-400 fluid-mt-1">Separadas por coma. Aparecerán en la insignia digital emitida.</p>
              </div>
            </div>
          </section>

            {/* ── SECTION: Emisor (read-only) ── */}
            <section className="bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-fluid-2xl border border-gray-200 fluid-px-6 fluid-py-4 shadow-sm">
              <div className="flex items-center fluid-gap-4">
                <div className="fluid-p-2.5 bg-blue-100 rounded-fluid-xl flex-shrink-0">
                  <Globe className="fluid-icon-sm text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wide">Emisor</p>
                  <p className="fluid-text-base font-semibold text-gray-900">Grupo Eduit</p>
                  <a href="https://www.grupoeduit.com" target="_blank" rel="noopener noreferrer" className="fluid-text-xs text-blue-500 hover:text-blue-700 transition-colors">
                    www.grupoeduit.com
                  </a>
                </div>
                <div className="flex items-center fluid-gap-1 fluid-px-2.5 fluid-py-1 bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="fluid-text-2xs font-medium">Fijo</span>
                </div>
              </div>

              {/* Logo del emisor */}
              <div className="fluid-mt-4 fluid-pt-4 border-t border-gray-200">
                <p className="fluid-text-xs text-gray-500 font-medium uppercase tracking-wide fluid-mb-2">Logo del Emisor</p>
                <p className="fluid-text-2xs text-gray-400 fluid-mb-3">Se mostrará en la página de verificación de la insignia en lugar del ícono por defecto.</p>
                <div className="flex items-center fluid-gap-3">
                  {issuerLogoPreview ? (
                    <div className="relative w-16 h-16 rounded-fluid-lg border-2 border-gray-200 overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                      <img src={issuerLogoPreview} alt="Logo emisor" className="w-full h-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setIssuerLogoFile(null)
                          setIssuerLogoPreview(null)
                          setIssuerLogoRemoved(true)
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-fluid-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <label className="cursor-pointer fluid-px-3 fluid-py-1.5 bg-blue-50 text-blue-700 rounded-fluid-lg hover:bg-blue-100 transition-colors fluid-text-xs font-medium inline-flex items-center fluid-gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {issuerLogoPreview ? 'Cambiar' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setIssuerLogoFile(file)
                          setIssuerLogoPreview(URL.createObjectURL(file))
                          setIssuerLogoRemoved(false)
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </section>
          </div>

          {/* ━━━━━━━━━━━━━━ RIGHT COLUMN / SIDEBAR (4/12) ━━━━━━━━━━━━━━ */}
          <div className="xl:col-span-4 flex flex-col fluid-gap-6">

            {/* ── Badge Image ── */}
            <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
              <div className="flex items-center fluid-gap-3 fluid-mb-4">
                <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
                  <ImageIcon className="fluid-icon-sm text-blue-600" />
                </div>
                <h2 className="fluid-text-lg font-semibold text-gray-900">Imagen de la Insignia</h2>
              </div>

              {/* Drop zone */}
              <div
                className={`relative min-h-[220px] rounded-fluid-xl flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer ${
                  dragActive
                    ? 'border-2 border-blue-500 bg-blue-50 scale-[1.02]'
                    : imagePreview
                      ? 'border-2 border-gray-200 bg-gray-50'
                      : 'border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                }`}
                onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('badge-image-input')?.click()}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-4" />
                    {imageFromEcm && (
                      <span className="absolute bottom-2 right-2 inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full shadow-sm">
                        <Sparkles className="w-3 h-3" /> ECM
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveImage() }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
                      title="Eliminar imagen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <span className="fluid-px-3 fluid-py-1.5 bg-white/90 rounded-fluid-lg fluid-text-xs font-medium text-gray-700 shadow">
                        Cambiar imagen
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center fluid-p-4">
                    <Upload className="fluid-icon-lg text-gray-300 mx-auto fluid-mb-2" />
                    <p className="fluid-text-xs text-gray-500 font-medium">
                      {dragActive ? 'Suelta aquí' : 'Arrastra o haz clic'}
                    </p>
                    <p className="fluid-text-2xs text-gray-400 fluid-mt-1">Cualquier formato de imagen (se convierte a WebP)</p>
                  </div>
                )}
                <input
                  id="badge-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {imageFromEcm && (
                <p className="fluid-text-xs text-blue-500 fluid-mt-2 flex items-center fluid-gap-1">
                  <Sparkles className="w-3 h-3" />
                  Usando logo del ECM. Sube otra para reemplazar.
                </p>
              )}
              {!imagePreview && (
                <p className="fluid-text-2xs text-gray-400 fluid-mt-2 text-center">
                  Si no subes imagen, se generará automáticamente
                </p>
              )}
            </section>

            {/* ── Configuration ── */}
            <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
              <div className="flex items-center fluid-gap-3 fluid-mb-4">
                <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
                  <Clock className="fluid-icon-sm text-blue-600" />
                </div>
                <h2 className="fluid-text-lg font-semibold text-gray-900">Configuración</h2>
              </div>

              <div className="flex flex-col fluid-gap-4">
                {/* Expiry — toggle indefinida + meses */}
                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-2">
                    <Clock className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                    Vigencia
                  </label>

                  {/* Toggle indefinida */}
                  <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-lg fluid-mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyIndefinite = form.expiry_months === null || form.expiry_months === 0
                        if (isCurrentlyIndefinite) {
                          // Switch to definite — suggest ECM value or 12 months
                          const suggested = selectedStandard?.validity_years ? selectedStandard.validity_years * 12 : 12
                          setForm({ ...form, expiry_months: suggested })
                        } else {
                          setForm({ ...form, expiry_months: null })
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex-shrink-0 ${
                        form.expiry_months === null || form.expiry_months === 0 ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        form.expiry_months === null || form.expiry_months === 0 ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="fluid-text-sm font-medium text-gray-700">
                        {form.expiry_months === null || form.expiry_months === 0 ? 'Vigencia indefinida' : 'Vigencia definida'}
                      </span>
                      <p className="fluid-text-2xs text-gray-400">
                        {form.expiry_months === null || form.expiry_months === 0
                          ? 'La insignia no expira'
                          : 'La insignia expira después del tiempo indicado'}
                      </p>
                    </div>
                  </div>

                  {/* Months input — only if not indefinite */}
                  {form.expiry_months !== null && form.expiry_months !== 0 && (
                    <div className="fluid-mt-1">
                      <label className="block fluid-text-xs font-medium text-gray-500 fluid-mb-1">Meses de vigencia</label>
                      <input
                        type="number"
                        min={1}
                        value={form.expiry_months}
                        onChange={e => setForm({ ...form, expiry_months: e.target.value ? Math.max(1, Number(e.target.value)) : 1 })}
                        className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors"
                        placeholder="Número de meses"
                      />
                      {/* Helper: translate to years + months */}
                      {form.expiry_months >= 12 && (
                        <p className="fluid-text-2xs text-gray-400 fluid-mt-1">
                          = {Math.floor(form.expiry_months / 12)} año{Math.floor(form.expiry_months / 12) > 1 ? 's' : ''}
                          {form.expiry_months % 12 > 0 && ` y ${form.expiry_months % 12} mes${form.expiry_months % 12 > 1 ? 'es' : ''}`}
                        </p>
                      )}
                      {selectedStandard?.validity_years != null && selectedStandard.validity_years > 0 && form.expiry_months !== selectedStandard.validity_years * 12 && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, expiry_months: selectedStandard.validity_years! * 12 })}
                          className="fluid-text-xs text-blue-500 hover:text-blue-700 fluid-mt-1 flex items-center fluid-gap-1 underline"
                        >
                          <Info className="w-3 h-3" />
                          Usar vigencia del ECM ({selectedStandard.validity_years} año{selectedStandard.validity_years > 1 ? 's' : ''})
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Active toggle */}
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-lg">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex-shrink-0 ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="fluid-text-sm font-medium text-gray-700">
                      {form.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <p className="fluid-text-xs text-gray-400">
                      {form.is_active
                        ? 'Se emitirán insignias al aprobar'
                        : 'No se emitirán insignias'}
                    </p>
                  </div>
                  {form.is_active ? (
                    <Eye className="fluid-icon-sm text-green-500 flex-shrink-0" />
                  ) : (
                    <EyeOff className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                  )}
                </div>
              </div>
            </section>

            {/* ── Actions (sidebar, sticky on xl) ── */}
            <div className="hidden xl:block sticky top-6">
              <div className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-5 shadow-sm">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center fluid-gap-2 fluid-px-6 py-3 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg fluid-text-sm active:scale-[0.98]"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="fluid-icon-sm" />
                  )}
                  {saving ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Plantilla'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/badges/templates')}
                  className="w-full fluid-mt-3 fluid-px-6 py-2.5 border-2 border-gray-200 text-gray-700 rounded-fluid-lg font-medium hover:bg-gray-50 transition-colors fluid-text-sm text-center"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            FOOTER ACTIONS (visible on mobile / smaller screens)
        ════════════════════════════════════════════ */}
        <div className="flex xl:hidden items-center justify-end fluid-gap-4 fluid-pt-6 fluid-mt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/badges/templates')}
            className="fluid-px-6 py-2.5 border-2 border-gray-200 text-gray-700 rounded-fluid-lg font-medium hover:bg-gray-50 transition-colors fluid-text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center fluid-gap-2 fluid-px-6 py-2.5 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg fluid-text-sm active:scale-[0.98]"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="fluid-icon-sm" />
            )}
            {saving ? 'Guardando…' : isEdit ? 'Guardar Cambios' : 'Crear Plantilla'}
          </button>
        </div>
      </form>
    </div>
  )
}
