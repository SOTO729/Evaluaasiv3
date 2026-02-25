/**
 * BadgeTemplateFormPage — Crear/Editar plantilla de insignia digital
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Award, ArrowLeft, Save, Upload, Image as ImageIcon,
  Tag, Clock, Globe, FileText, BookOpen
} from 'lucide-react'
import { badgeService } from '../../services/badgeService'
import { examService } from '../../services/examService'

interface ExamOption { id: number; name: string }

export default function BadgeTemplateFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exams, setExams] = useState<ExamOption[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

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
    // Load exams for selector
    examService.getExams(1, 200, '', false).then(data => {
      setExams(data.items?.map((e: any) => ({ id: e.id, name: e.name })) || [])
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return alert('El nombre es requerido')

    setSaving(true)
    try {
      let templateId = isEdit ? Number(id) : 0

      if (isEdit) {
        await badgeService.updateTemplate(templateId, form)
      } else {
        const result = await badgeService.createTemplate(form)
        templateId = result.template.id
      }

      // Upload image if selected
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

  if (loading) {
    return (
      <div className="flex justify-center fluid-py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600" />
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
        <div className="fluid-p-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-fluid-lg shadow">
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
        {/* Basic Info */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <FileText className="fluid-icon-sm text-amber-600" />
            Información Básica
          </h2>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Ej: Competencia en Administración de Proyectos"
              required
            />
          </div>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Descripción</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Descripción de la insignia..."
            />
          </div>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Criterios de Obtención</label>
            <textarea
              value={form.criteria_narrative}
              onChange={e => setForm({ ...form, criteria_narrative: e.target.value })}
              rows={2}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Aprobó la evaluación con puntaje mínimo de..."
            />
          </div>
        </div>

        {/* Association */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <BookOpen className="fluid-icon-sm text-amber-600" />
            Asociación con Examen
          </h2>

          <div>
            <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Examen Asociado</label>
            <select
              value={form.exam_id || ''}
              onChange={e => setForm({ ...form, exam_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">— Sin examen asociado —</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
            <p className="fluid-text-xs text-gray-400 mt-1">
              La insignia se emitirá automáticamente al aprobar este examen.
            </p>
          </div>
        </div>

        {/* Image */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <ImageIcon className="fluid-icon-sm text-amber-600" />
            Imagen de la Insignia
          </h2>

          <div className="flex items-start fluid-gap-5">
            <div className="w-32 h-32 bg-gray-100 rounded-fluid-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <Award className="fluid-icon-xl text-gray-300" />
              )}
            </div>
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-gray-100 text-gray-700 rounded-fluid-lg font-medium hover:bg-gray-200 transition-colors">
                <Upload className="fluid-icon-sm" />
                Subir Imagen
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              <p className="fluid-text-xs text-gray-400 mt-2">
                Recomendado: PNG 600×750px. Si no subes imagen, se generará automáticamente.
              </p>
            </div>
          </div>
        </div>

        {/* Issuer */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <Globe className="fluid-icon-sm text-amber-600" />
            Emisor (Issuer)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 fluid-gap-4">
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Nombre del Emisor</label>
              <input
                type="text"
                value={form.issuer_name}
                onChange={e => setForm({ ...form, issuer_name: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="EIA / EduIT"
              />
            </div>
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">URL del Emisor</label>
              <input
                type="url"
                value={form.issuer_url}
                onChange={e => setForm({ ...form, issuer_url: e.target.value })}
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="https://evaluaasi.com"
              />
            </div>
          </div>
        </div>

        {/* Extra config */}
        <div className="bg-white rounded-fluid-2xl border border-gray-200 fluid-p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center fluid-gap-2">
            <Clock className="fluid-icon-sm text-amber-600" />
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
                className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="0 = sin expiración"
              />
            </div>
            <div>
              <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">Etiquetas</label>
              <div className="flex items-center fluid-gap-2">
                <Tag className="fluid-icon-sm text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="competencia, administración, ..."
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
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
            </label>
            <span className="fluid-text-sm font-medium text-gray-700">Plantilla activa</span>
          </div>
        </div>

        {/* Submit */}
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
            className="inline-flex items-center fluid-gap-2 fluid-px-5 fluid-py-2 bg-amber-600 text-white rounded-fluid-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-md"
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
