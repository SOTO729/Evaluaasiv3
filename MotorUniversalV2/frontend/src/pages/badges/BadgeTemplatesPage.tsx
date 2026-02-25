/**
 * BadgeTemplatesPage — Gestión CRUD de plantillas de insignias digitales
 * Disponible para admin, editor y coordinator.
 * UI consistente con el sistema de diseño fluido de la app.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck, Plus, Search, Edit2, Trash2,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Award,
  Users, Clock, Sparkles, X
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
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [toast, setToast] = useState<string | null>(null)

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

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) return
    try {
      await badgeService.deleteTemplate(id)
      setToast('Plantilla eliminada')
      fetchTemplates()
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleActive = async (t: BadgeTemplate) => {
    try {
      await badgeService.updateTemplate(t.id, { is_active: !t.is_active })
      setToast(t.is_active ? 'Plantilla desactivada' : 'Plantilla activada')
      fetchTemplates()
    } catch (err) {
      console.error(err)
    }
  }

  /* ── stats ── */
  const stats = useMemo(() => {
    const active = templates.filter(t => t.is_active).length
    const inactive = templates.length - active
    const totalIssued = templates.reduce((sum, t) => sum + (t.issued_count || 0), 0)
    return { active, inactive, totalIssued }
  }, [templates])

  /* ── filter ── */
  const filteredTemplates = useMemo(() => {
    if (filterActive === 'all') return templates
    return templates.filter(t => filterActive === 'active' ? t.is_active : !t.is_active)
  }, [templates, filterActive])

  return (
    <div className="max-w-[1600px] mx-auto fluid-px-6 fluid-py-6 animate-fade-in-up">

      {/* ── Toast ── */}
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

      {/* ── Gradient Header Banner ── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 rounded-fluid-2xl fluid-p-6 fluid-mb-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <div className="fluid-p-3 bg-white/20 rounded-fluid-xl">
              <Award className="fluid-icon-lg" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold">Insignias Digitales</h1>
              <p className="fluid-text-sm text-blue-100 fluid-mt-1">
                Plantillas Open Badges 3.0 — {total} plantilla{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/badges/templates/new')}
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-white/20 hover:bg-white/30 rounded-fluid-xl fluid-text-sm font-semibold transition-all"
          >
            <Plus className="fluid-icon-sm" />
            Nueva Plantilla
          </button>
        </div>

        {/* ── Stats bar inside header ── */}
        <div className="grid grid-cols-3 fluid-gap-3 fluid-mt-5">
          <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/10 text-center">
            <p className="fluid-text-xl font-bold">{stats.active}</p>
            <p className="fluid-text-2xs text-blue-200 font-medium">Activas</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/10 text-center">
            <p className="fluid-text-xl font-bold">{stats.inactive}</p>
            <p className="fluid-text-2xs text-blue-200 font-medium">Inactivas</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-fluid-xl fluid-p-3 border border-white/10 text-center">
            <p className="fluid-text-xl font-bold">{stats.totalIssued}</p>
            <p className="fluid-text-2xs text-blue-200 font-medium">Emitidas</p>
          </div>
        </div>
      </div>

      {/* ── Search + Filters bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center fluid-gap-3 fluid-mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 fluid-icon-sm text-gray-400" />
          <input
            type="text"
            placeholder="Buscar plantillas por nombre…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full fluid-pl-10 fluid-pr-4 fluid-py-2.5 border-2 border-gray-200 rounded-fluid-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 fluid-text-sm bg-white hover:border-gray-300 transition-colors placeholder:text-gray-400"
          />
        </div>

        {/* Quick filter pills */}
        <div className="flex items-center fluid-gap-2">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`fluid-px-3 fluid-py-1.5 rounded-full fluid-text-xs font-medium transition-all ${
                filterActive === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center fluid-py-16">
          <div className="animate-spin rounded-full fluid-w-12 fluid-h-12 border-b-4 border-blue-600 fluid-mb-4" />
          <p className="fluid-text-sm text-gray-500">Cargando plantillas…</p>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center fluid-py-16 bg-white rounded-fluid-2xl border-2 border-dashed border-gray-200 shadow-sm">
          <div className="fluid-p-4 bg-blue-50 rounded-full inline-flex fluid-mb-4">
            <BadgeCheck className="fluid-icon-2xl text-blue-300" />
          </div>
          <h3 className="fluid-text-lg font-semibold text-gray-700 fluid-mb-2">
            {search || filterActive !== 'all' ? 'Sin resultados' : 'Sin plantillas'}
          </h3>
          <p className="text-gray-500 fluid-mb-5 fluid-text-sm max-w-sm mx-auto">
            {search || filterActive !== 'all'
              ? 'No se encontraron plantillas con los filtros actuales.'
              : 'Crea tu primera plantilla de insignia digital para comenzar a emitir credenciales verificables.'}
          </p>
          {!search && filterActive === 'all' && (
            <button
              onClick={() => navigate('/badges/templates/new')}
              className="inline-flex items-center fluid-gap-2 fluid-px-5 py-2.5 bg-blue-600 text-white rounded-fluid-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus className="fluid-icon-sm" />
              Crear Plantilla
            </button>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && filteredTemplates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 fluid-gap-5">
          {filteredTemplates.map((t, idx) => (
            <div
              key={t.id}
              className={`bg-white border-2 rounded-fluid-2xl overflow-hidden hover:shadow-xl transition-all group ${
                t.is_active ? 'border-gray-200 hover:border-blue-300' : 'border-gray-200 opacity-60 hover:opacity-80'
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Image */}
              <div
                className="h-44 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center relative cursor-pointer"
                onClick={() => navigate(`/badges/templates/${t.id}/edit`)}
              >
                {t.badge_image_url ? (
                  <img src={t.badge_image_url} alt={t.name} className="h-full w-full object-contain p-5 group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="flex flex-col items-center">
                    <BadgeCheck className="fluid-icon-2xl text-blue-200" />
                    <span className="fluid-text-2xs text-blue-300 font-medium fluid-mt-1">Sin imagen</span>
                  </div>
                )}
                {/* Status badge */}
                <span className={`absolute top-2.5 right-2.5 inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-0.5 fluid-text-2xs font-bold rounded-full shadow-sm ${
                  t.is_active
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                  {t.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Info */}
              <div className="fluid-p-4">
                <h3
                  className="font-bold text-gray-900 truncate fluid-mb-1 group-hover:text-blue-700 transition-colors cursor-pointer fluid-text-sm"
                  onClick={() => navigate(`/badges/templates/${t.id}/edit`)}
                >
                  {t.name}
                </h3>
                {t.description && (
                  <p className="fluid-text-xs text-gray-500 line-clamp-2 fluid-mb-3">{t.description}</p>
                )}

                {/* Meta info */}
                <div className="flex items-center fluid-gap-3 fluid-text-2xs text-gray-400 fluid-mb-3 fluid-pt-2 border-t border-gray-100">
                  <span className="inline-flex items-center fluid-gap-1">
                    <Users className="w-3 h-3" />
                    {t.issued_count || 0} emitida{(t.issued_count || 0) !== 1 ? 's' : ''}
                  </span>
                  {t.expiry_months && t.expiry_months > 0 && (
                    <span className="inline-flex items-center fluid-gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {t.expiry_months}m
                    </span>
                  )}
                </div>

                {/* Tags preview */}
                {typeof t.tags === 'string' && t.tags.trim() && (
                  <div className="flex flex-wrap fluid-gap-1 fluid-mb-3">
                    {t.tags.split(',').slice(0, 3).map((tag, i) => (
                      <span key={i} className="fluid-px-1.5 fluid-py-0.5 bg-gray-50 text-gray-500 rounded fluid-text-2xs border border-gray-100">
                        {tag.trim()}
                      </span>
                    ))}
                    {t.tags.split(',').length > 3 && (
                      <span className="fluid-px-1.5 fluid-py-0.5 text-gray-400 fluid-text-2xs">
                        +{t.tags.split(',').length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex fluid-gap-2">
                  <button
                    onClick={() => navigate(`/badges/templates/${t.id}/edit`)}
                    className="flex-1 inline-flex items-center justify-center fluid-gap-1 fluid-py-2 fluid-text-xs font-medium text-blue-700 bg-blue-50 rounded-fluid-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(t)}
                    className={`fluid-p-2 rounded-fluid-lg transition-colors ${
                      t.is_active
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-blue-600'
                    }`}
                    title={t.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {t.is_active ? <ToggleRight className="fluid-icon-sm" /> : <ToggleLeft className="fluid-icon-sm" />}
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="fluid-p-2 text-gray-300 hover:text-red-600 rounded-fluid-lg hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center fluid-gap-3 fluid-mt-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="fluid-p-2 rounded-fluid-lg border-2 border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="fluid-icon-sm" />
          </button>
          <div className="flex items-center fluid-gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p: number
              if (totalPages <= 5) p = i + 1
              else if (page <= 3) p = i + 1
              else if (page >= totalPages - 2) p = totalPages - 4 + i
              else p = page - 2 + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-fluid-lg fluid-text-sm font-medium transition-all ${
                    p === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="fluid-p-2 rounded-fluid-lg border-2 border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="fluid-icon-sm" />
          </button>
        </div>
      )}
    </div>
  )
}
