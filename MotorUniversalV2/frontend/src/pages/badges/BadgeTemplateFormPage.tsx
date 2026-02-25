/**
 * BadgeTemplateFormPage — Crear/Editar plantilla de insignia digital
 * Asocia insignias a ECM (Estándares de Competencia) en lugar de exámenes.
 * UI consistente con el sistema de diseño fluido de la app.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  Award, ArrowLeft, Save, Upload, Image as ImageIcon,
  Tag, Clock, Globe, FileText, BookOpen, Sparkles, Search,
  CheckCircle2, AlertCircle, X, Eye, EyeOff, Link2, User,
  ChevronDown, Info
} from 'lucide-react'
import { badgeService } from '../../services/badgeService'
import { getStandards, type CompetencyStandard } from '../../services/standardsService'

/* ═══════════════ tipos ═══════════════ */
interface FormState {
  name: string
  description: string
  criteria_narrative: string
  exam_id: number | null
  competency_standard_id: number | null
  issuer_name: string
  issuer_url: string
  issuer_image_url: string
  tags: string
  expiry_months: number | null
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  criteria_narrative: '',
  exam_id: null,
  competency_standard_id: null,
  issuer_name: '',
  issuer_url: '',
  issuer_image_url: '',
  tags: '',
  expiry_months: null,
  is_active: true,
}

/* ═══════════════ helpers ═══════════════ */
const tagArray = (tags: string) =>
  tags.split(',').map(t => t.trim()).filter(Boolean)

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
    if (!form.tags?.trim()) {
      const tagParts = [std.code]
      if (std.sector) tagParts.push(std.sector)
      if (std.certifying_body) tagParts.push(std.certifying_body)
      updates.tags = tagParts.join(', ')
      prefilled.push('etiquetas')
    }
    if (!form.issuer_name?.trim()) {
      const issuerParts: string[] = []
      if (std.certifying_body) issuerParts.push(std.certifying_body)
      if (std.brand?.name) issuerParts.push(std.brand.name)
      if (issuerParts.length > 0) {
        updates.issuer_name = issuerParts.join(' / ')
        prefilled.push('emisor')
      }
    }
    if (!form.issuer_image_url?.trim() && std.brand?.logo_url) {
      updates.issuer_image_url = std.brand.logo_url
      prefilled.push('logo emisor')
    }
    if (!form.issuer_url?.trim()) {
      const body = (std.certifying_body || '').toLowerCase()
      updates.issuer_url = body.includes('conocer')
        ? 'https://www.conocer.gob.mx'
        : 'https://evaluaasi.com'
      prefilled.push('URL emisor')
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
    }
  }

  /* ═══════════════ validation ═══════════════ */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'El nombre es requerido'
    if (form.issuer_url && !/^https?:\/\/.+/.test(form.issuer_url)) {
      errs.issuer_url = 'Debe ser una URL válida (https://...)'
    }
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
      if (imageFromEcm && selectedStandard?.logo_url && !imageFile) {
        formData.issuer_image_url = selectedStandard.logo_url
      }

      if (isEdit) {
        await badgeService.updateTemplate(templateId, formData)
      } else {
        const result = await badgeService.createTemplate(formData)
        templateId = result.template.id
      }

      if (imageFile && templateId) {
        await badgeService.uploadTemplateImage(templateId, imageFile)
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
    <div className="max-w-4xl mx-auto fluid-px-6 fluid-py-6 animate-fade-in-up">

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

      <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-6">

        {/* ════════════════════════════════════════════
            SECTION 1: ECM Association
        ════════════════════════════════════════════ */}
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
                    {selectedStandard.validity_years && (
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
                          {s.validity_years && (
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

        {/* ════════════════════════════════════════════
            SECTION 2: Basic Info + Image (2 column on lg)
        ════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 fluid-gap-6">

          {/* Left: Basic info (2/3 width) */}
          <section className="lg:col-span-2 bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
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

              {/* Description */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors resize-none"
                  placeholder="Descripción de lo que certifica esta insignia…"
                />
              </div>

              {/* Criteria */}
              <div>
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Criterios de Obtención</label>
                <textarea
                  value={form.criteria_narrative}
                  onChange={e => setForm({ ...form, criteria_narrative: e.target.value })}
                  rows={2}
                  className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors resize-none"
                  placeholder="Aprobó la evaluación con resultado competente…"
                />
              </div>
            </div>
          </section>

          {/* Right: Badge Image (1/3 width) */}
          <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm flex flex-col">
            <div className="flex items-center fluid-gap-3 fluid-mb-5">
              <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
                <ImageIcon className="fluid-icon-sm text-blue-600" />
              </div>
              <h2 className="fluid-text-lg font-semibold text-gray-900">Imagen</h2>
            </div>

            {/* Drop zone */}
            <div
              className={`relative flex-1 min-h-[180px] rounded-fluid-xl flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer ${
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
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-3" />
                  {imageFromEcm && (
                    <span className="absolute bottom-2 right-2 inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full shadow-sm">
                      <Sparkles className="w-3 h-3" /> ECM
                    </span>
                  )}
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
                  <p className="fluid-text-2xs text-gray-400 fluid-mt-1">PNG 600×750px</p>
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
        </div>

        {/* ════════════════════════════════════════════
            SECTION 3: Issuer Info
        ════════════════════════════════════════════ */}
        <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
          <div className="flex items-center fluid-gap-3 fluid-mb-5">
            <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
              <Globe className="fluid-icon-sm text-blue-600" />
            </div>
            <div>
              <h2 className="fluid-text-lg font-semibold text-gray-900">Emisor (Issuer)</h2>
              <p className="fluid-text-xs text-gray-500">Organización que emite las insignias</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
            {/* Issuer Name */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                <User className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                Nombre del Emisor
              </label>
              <input
                type="text"
                value={form.issuer_name}
                onChange={e => setForm({ ...form, issuer_name: e.target.value })}
                className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors"
                placeholder="CONOCER / EIA / EduIT"
              />
            </div>

            {/* Issuer URL */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                <Link2 className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                URL del Emisor
              </label>
              <input
                type="url"
                value={form.issuer_url}
                onChange={e => { setForm({ ...form, issuer_url: e.target.value }); if (errors.issuer_url) setErrors(prev => { const { issuer_url, ...rest } = prev; return rest }) }}
                className={`w-full fluid-px-4 py-2.5 border-2 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm transition-colors ${errors.issuer_url ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}
                placeholder="https://evaluaasi.com"
              />
              {errors.issuer_url && (
                <p className="text-red-600 fluid-text-xs fluid-mt-1 font-medium flex items-center fluid-gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.issuer_url}
                </p>
              )}
            </div>

            {/* Issuer Logo Preview */}
            {form.issuer_image_url && (
              <div className="md:col-span-2">
                <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Logo del Emisor</label>
                <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-lg border border-gray-100">
                  <img
                    src={form.issuer_image_url}
                    alt="Issuer logo"
                    className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-200"
                  />
                  <span className="fluid-text-xs text-gray-500 truncate flex-1">{form.issuer_image_url}</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, issuer_image_url: '' })}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════
            SECTION 4: Additional Config
        ════════════════════════════════════════════ */}
        <section className="bg-white rounded-fluid-2xl border-2 border-gray-200 fluid-p-6 shadow-sm">
          <div className="flex items-center fluid-gap-3 fluid-mb-5">
            <div className="fluid-p-2 bg-blue-50 rounded-fluid-lg">
              <Clock className="fluid-icon-sm text-blue-600" />
            </div>
            <h2 className="fluid-text-lg font-semibold text-gray-900">Configuración</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-5">
            {/* Expiry */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                <Clock className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                Vigencia (meses)
              </label>
              <input
                type="number"
                min={0}
                value={form.expiry_months ?? ''}
                onChange={e => setForm({ ...form, expiry_months: e.target.value ? Number(e.target.value) : null })}
                className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors"
                placeholder="0 = sin expiración"
              />
              {selectedStandard?.validity_years && (
                <p className="fluid-text-xs text-blue-500 fluid-mt-1 flex items-center fluid-gap-1">
                  <Info className="w-3 h-3" />
                  ECM sugiere {selectedStandard.validity_years} año{selectedStandard.validity_years > 1 ? 's' : ''} ({selectedStandard.validity_years * 12} meses)
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                <Tag className="w-3.5 h-3.5 inline-block mr-1.5 text-gray-400" />
                Etiquetas
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full fluid-px-4 py-2.5 border-2 border-gray-200 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fluid-text-sm hover:border-gray-300 transition-colors"
                placeholder="EC0217, administración, CONOCER…"
              />
              {/* Tag pills */}
              {form.tags && (
                <div className="flex flex-wrap fluid-gap-1 fluid-mt-2">
                  {tagArray(form.tags).map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center fluid-px-2 fluid-py-0.5 bg-blue-50 text-blue-700 rounded-full fluid-text-2xs font-medium border border-blue-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active toggle */}
            <div className="md:col-span-2">
              <div className="flex items-center fluid-gap-3 fluid-p-3 bg-gray-50 rounded-fluid-lg">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
                <div>
                  <span className="fluid-text-sm font-medium text-gray-700">
                    {form.is_active ? 'Plantilla activa' : 'Plantilla inactiva'}
                  </span>
                  <p className="fluid-text-xs text-gray-400">
                    {form.is_active
                      ? 'Las insignias se emitirán automáticamente al aprobar el ECM'
                      : 'No se emitirán insignias con esta plantilla'}
                  </p>
                </div>
                {form.is_active ? (
                  <Eye className="fluid-icon-sm text-green-500 ml-auto" />
                ) : (
                  <EyeOff className="fluid-icon-sm text-gray-400 ml-auto" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            FOOTER ACTIONS
        ════════════════════════════════════════════ */}
        <div className="flex items-center justify-end fluid-gap-4 fluid-pt-4 border-t border-gray-200">
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
