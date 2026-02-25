/**
 * BadgeTemplatesPage — Gestión CRUD de plantillas de insignias digitales
 * Disponible para admin, editor y coordinator.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck, Plus, Search, Edit2, Trash2,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Award
} from 'lucide-react'
import { badgeService, type BadgeTemplate } from '../../services/badgeService'

export default function BadgeTemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<BadgeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const data = await badgeService.getTemplates(page, 12, search)
      setTemplates(data.templates)
      setTotalPages(data.pages)
      setTotal(data.total)
    } catch (err) {
      console.error('Error loading badge templates:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Desactivar esta plantilla?')) return
    try {
      await badgeService.deleteTemplate(id)
      fetchTemplates()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleActive = async (t: BadgeTemplate) => {
    try {
      await badgeService.updateTemplate(t.id, { is_active: !t.is_active })
      fetchTemplates()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="fluid-p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-mb-6">
        <div className="flex items-center fluid-gap-3">
          <div className="fluid-p-3 bg-gradient-to-br from-blue-500 to-blue-700 rounded-fluid-xl shadow-lg">
            <Award className="fluid-icon-lg text-white" />
          </div>
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-900">Insignias Digitales</h1>
            <p className="fluid-text-sm text-gray-500">Plantillas Open Badges 3.0 — {total} plantilla{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/badges/templates/new')}
          className="mt-3 sm:mt-0 inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="fluid-icon-sm" />
          Nueva Plantilla
        </button>
      </div>

      {/* Search */}
      <div className="relative fluid-mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
        <input
          type="text"
          placeholder="Buscar plantillas..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full fluid-pl-10 fluid-pr-4 fluid-py-2 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center fluid-py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && templates.length === 0 && (
        <div className="text-center fluid-py-16 bg-white rounded-fluid-2xl border-2 border-dashed border-gray-300">
          <BadgeCheck className="fluid-icon-2xl text-gray-300 mx-auto fluid-mb-4" />
          <h3 className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">Sin plantillas</h3>
          <p className="text-gray-500 fluid-mb-4">Crea tu primera plantilla de insignia digital.</p>
          <button
            onClick={() => navigate('/badges/templates/new')}
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700"
          >
            <Plus className="fluid-icon-sm" />
            Crear Plantilla
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 fluid-gap-5">
          {templates.map(t => (
            <div
              key={t.id}
              className={`bg-white border-2 rounded-fluid-2xl overflow-hidden hover:shadow-xl transition-all group ${t.is_active ? 'border-gray-200 hover:border-blue-300' : 'border-red-200 opacity-70'}`}
            >
              {/* Image */}
              <div className="h-40 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative">
                {t.badge_image_url ? (
                  <img src={t.badge_image_url} alt={t.name} className="h-full w-full object-contain p-4" />
                ) : (
                  <BadgeCheck className="fluid-icon-2xl text-blue-300" />
                )}
                {!t.is_active && (
                  <span className="absolute top-2 right-2 fluid-px-2 fluid-py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                    Inactiva
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="fluid-p-4">
                <h3 className="font-bold text-gray-900 truncate fluid-mb-1 group-hover:text-blue-700 transition-colors">
                  {t.name}
                </h3>
                {t.description && (
                  <p className="fluid-text-sm text-gray-500 line-clamp-2 fluid-mb-2">{t.description}</p>
                )}

                <div className="flex items-center fluid-gap-2 fluid-text-xs text-gray-400 fluid-mb-3">
                  <Award className="fluid-icon-xs" />
                  <span>{t.issued_count || 0} emitida{(t.issued_count || 0) !== 1 ? 's' : ''}</span>
                  {t.expiry_months && (
                    <span className="ml-auto">Vigencia: {t.expiry_months}m</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex fluid-gap-2">
                  <button
                    onClick={() => navigate(`/badges/templates/${t.id}/edit`)}
                    className="flex-1 inline-flex items-center justify-center fluid-gap-1 fluid-py-1.5 fluid-text-sm font-medium text-blue-700 bg-blue-50 rounded-fluid-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="fluid-icon-xs" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(t)}
                    className="fluid-p-1.5 text-gray-500 hover:text-blue-600 rounded-fluid-lg hover:bg-gray-100 transition-colors"
                    title={t.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {t.is_active ? <ToggleRight className="fluid-icon-sm text-green-500" /> : <ToggleLeft className="fluid-icon-sm" />}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="fluid-p-1.5 text-gray-400 hover:text-red-600 rounded-fluid-lg hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="fluid-icon-xs" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center fluid-gap-3 fluid-mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="fluid-p-2 rounded-fluid-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft className="fluid-icon-sm" />
          </button>
          <span className="fluid-text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="fluid-p-2 rounded-fluid-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronRight className="fluid-icon-sm" />
          </button>
        </div>
      )}
    </div>
  )
}
