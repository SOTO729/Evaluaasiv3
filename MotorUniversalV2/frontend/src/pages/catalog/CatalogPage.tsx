/**
 * Catálogo de exámenes (modelo Directo / B2C).
 *
 * Dos modos:
 *  - Público (sin Layout): visible sin auth, con header/hero/footer propios.
 *  - Embebido (dentro de Layout): renderizado por la ruta `/mi/catalogo` para
 *    candidatos del sistema directo. No replica el chrome de la app.
 *
 * Soporta multi-selección + checkout en bundle (`/checkout/bundle?ids=...`).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, ShoppingCart, Clock, FileText, Gift, Check, X, BookOpen,
  Sparkles, GraduationCap, Award,
} from 'lucide-react'
import { directService, DirectExamCard } from '../../services/directService'
import { useAuthStore } from '../../store/authStore'
import InfoSheetModal from '../../components/catalog/InfoSheetModal'

interface CatalogPageProps {
  embedded?: boolean
}

export default function CatalogPage({ embedded = false }: CatalogPageProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [exams, setExams] = useState<DirectExamCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [infoSheet, setInfoSheet] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    directService.listCatalog(q || undefined)
      .then(data => { if (alive) setExams(data) })
      .catch(err => { if (alive) setError(err?.message || 'No se pudo cargar el catálogo') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    directService.listCatalog(q || undefined)
      .then(setExams)
      .catch(err => setError(err?.message || 'Error'))
      .finally(() => setLoading(false))
  }

  const toggleSelect = (e: React.MouseEvent, exam: DirectExamCard) => {
    e.preventDefault()
    e.stopPropagation()
    // Muestras gratuitas se toman directo (no entran al bundle de pago)
    if (exam.is_free_sample) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(exam.id)) next.delete(exam.id)
      else next.add(exam.id)
      return next
    })
  }

  const openInfoSheet = (exam: DirectExamCard) => {
    if (exam.info_sheet_url) {
      setInfoSheet({ url: exam.info_sheet_url, title: exam.title })
    } else {
      navigate(`/catalogo/${exam.id}`)
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectedExams = useMemo(
    () => exams.filter(e => selectedIds.has(e.id)),
    [exams, selectedIds],
  )

  const goToBundleCheckout = () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    navigate(`/checkout/bundle?ids=${ids.join(',')}`)
  }

  // Contenido principal compartido (búsqueda + grid + barra inferior)
  const mainContent = (
    <>
      {/* Búsqueda */}
      <section className={embedded ? 'mb-6' : 'max-w-3xl mx-auto px-4 mb-8'}>
        <form
          onSubmit={handleSearch}
          className="flex gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-2"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar certificación..."
              className="w-full pl-10 pr-4 py-2.5 border-0 bg-transparent focus:outline-none focus:ring-0 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm shadow-sm"
          >
            Buscar
          </button>
        </form>
      </section>

      {/* Grid */}
      <section className={embedded ? '' : 'max-w-6xl mx-auto px-4'}>
        {loading && (
          <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
            Cargando catálogo...
          </div>
        )}
        {error && (
          <div className="text-center py-12 px-4 text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}
        {!loading && !error && exams.length === 0 && (
          <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
            No hay exámenes disponibles en este momento.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {exams.map((exam) => {
            const selected = selectedIds.has(exam.id)
            // Cualquier examen público no-muestra-gratuita se puede agregar al bundle.
            // El precio se calcula al elegir productos (add-ons) en el checkout.
            const purchasable = !exam.is_free_sample
            return (
              <div
                key={exam.id}
                className={`group relative bg-white border rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col ${
                  selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 hover:border-primary-200'
                }`}
              >
                {selected && (
                  <div className="absolute top-3 right-3 z-10 bg-primary-600 text-white rounded-full p-1.5 shadow-lg">
                    <Check size={16} />
                  </div>
                )}
                {exam.image_url ? (
                  <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                    <img
                      src={exam.image_url}
                      alt={exam.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="h-40 w-full bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 flex items-center justify-center text-white">
                    <GraduationCap size={56} className="opacity-80" />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug">
                    {exam.title}
                  </h3>
                  {exam.direct_sale_description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {exam.direct_sale_description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 flex-wrap">
                    {exam.time_limit_minutes != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
                        <Clock size={13} />{exam.time_limit_minutes} min
                      </span>
                    )}
                    {exam.total_questions != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-md">
                        <FileText size={13} />{exam.total_questions} reactivos
                      </span>
                    )}
                  </div>
                  <div className="mt-auto">
                    <div className="mb-3 flex items-baseline gap-1">
                      {exam.is_free_sample ? (
                        <span className="text-green-700 font-bold flex items-center gap-1.5 text-lg">
                          <Gift size={20} /> Gratis
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-gray-600">
                          Precio definido al elegir productos
                        </span>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openInfoSheet(exam)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 hover:border-primary-300 transition"
                        title={exam.info_sheet_url ? 'Ver ficha informativa' : 'Ver detalles'}
                      >
                        <BookOpen size={15} /> Conoce más
                      </button>

                      {exam.is_free_sample ? (
                        <Link
                          to={`/catalogo/${exam.id}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
                        >
                          <Gift size={15} /> Tomar
                        </Link>
                      ) : purchasable ? (
                        <button
                          onClick={(e) => toggleSelect(e, exam)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition shadow-sm ${
                            selected
                              ? 'bg-primary-700 text-white hover:bg-primary-800'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                        >
                          {selected ? <><Check size={15} /> Elegida</> : <><ShoppingCart size={15} /> Comprar</>}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
                        >
                          No disponible
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Modal ficha informativa */}
      <InfoSheetModal
        open={!!infoSheet}
        pdfUrl={infoSheet?.url || null}
        title={infoSheet?.title}
        onClose={() => setInfoSheet(null)}
      />

      {/* Barra inferior fija con resumen de selección */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t-2 border-primary-500 shadow-2xl z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                {selectedIds.size} certificación{selectedIds.size === 1 ? '' : 'es'} seleccionada{selectedIds.size === 1 ? '' : 's'}
              </div>
              <div className="text-sm text-gray-700">
                Elige los productos (examen, certificados, material) en el siguiente paso para calcular el total.
              </div>
            </div>
            <button
              onClick={clearSelection}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1 transition"
            >
              <X size={16} /> Limpiar
            </button>
            <button
              onClick={goToBundleCheckout}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-lg transition flex items-center gap-2 font-semibold shadow-md"
            >
              <ShoppingCart size={18} /> Elegir productos
            </button>
          </div>
        </div>
      )}
    </>
  )

  // ----------- Modo embebido (dentro de Layout autenticado) -----------
  // UI alineada con la pantalla /exams: header simple con icono, tarjeta blanca
  // de búsqueda y grid de cards con imagen tipo gradient + contenido fluid.
  if (embedded) {
    return (
      <div className="fluid-p-8 animate-fade-in-up pb-32">
        {/* Header estilo /exams */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center fluid-gap-4 fluid-mb-6">
          <div>
            <h1 className="fluid-text-3xl font-bold text-gray-800 flex items-center fluid-gap-3">
              <Award className="fluid-icon-xl text-primary-600" />
              Catálogo de certificaciones
            </h1>
            <p className="fluid-text-base text-gray-600 fluid-mt-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-primary-500" />
              Selecciona una o más certificaciones y págalas en un solo paso.
            </p>
          </div>
        </div>

        {/* Search estilo /exams */}
        <div className="bg-white rounded-fluid-lg shadow fluid-p-5 fluid-mb-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row fluid-gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 fluid-icon-lg text-gray-400" />
              <input
                type="text"
                placeholder="Buscar certificación..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-10 pr-4 fluid-py-3 border border-gray-300 rounded-fluid-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent fluid-text-base"
              />
            </div>
            <button
              type="submit"
              className="bg-primary-600 hover:bg-primary-700 text-white fluid-px-8 fluid-py-3 rounded-fluid-lg transition-colors w-full sm:w-auto flex items-center justify-center fluid-gap-2 font-medium fluid-text-base"
            >
              <Search className="fluid-icon" />
              Buscar
            </button>
          </form>
        </div>

        {/* Grid estilo /exams */}
        {loading ? (
          <div className="bg-white rounded-fluid-lg shadow fluid-p-8 text-center text-gray-500">
            Cargando catálogo...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-fluid-lg fluid-p-6 text-center text-red-700">
            {error}
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-fluid-lg shadow fluid-p-8 text-center">
            <FileText className="fluid-icon-xl text-gray-300 mx-auto fluid-mb-4" />
            <h3 className="fluid-text-lg font-medium text-gray-700 fluid-mb-2">No hay certificaciones disponibles</h3>
            <p className="text-gray-500">Vuelve más tarde para ver nuevas certificaciones.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 fluid-gap-6 fluid-mb-8">
            {exams.map((exam, index) => {
              const selected = selectedIds.has(exam.id)
              const purchasable = !exam.is_free_sample && !!exam.direct_price_mxn && exam.direct_price_mxn > 0
              return (
                <div
                  key={exam.id}
                  className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group animate-stagger-in flex flex-col ${
                    selected ? 'border-2 border-primary-500 ring-1 ring-primary-100' : 'border border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Card image — protagonista de la tarjeta */}
                  <div className="relative h-52 bg-gradient-to-br from-primary-600 to-primary-800 overflow-hidden">
                    {exam.image_url ? (
                      <img
                        src={exam.image_url}
                        alt={exam.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GraduationCap className="w-16 h-16 text-white/70" />
                      </div>
                    )}

                    {/* Sutil overlay inferior para legibilidad de badges */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

                    {/* Badge gratis */}
                    {exam.is_free_sample && (
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500 text-white shadow">
                        <Gift className="w-3 h-3" /> Gratis
                      </span>
                    )}

                    {/* Badge seleccionada */}
                    {selected && (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-600 text-white shadow">
                        <Check className="w-3 h-3" /> Elegida
                      </span>
                    )}

                    {/* Duración como meta-info sobre la imagen */}
                    {exam.time_limit_minutes != null && (
                      <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-black/55 text-white backdrop-blur-sm">
                        <Clock className="w-3 h-3" /> {exam.time_limit_minutes} min
                      </span>
                    )}
                  </div>

                  {/* Card content — más limpio */}
                  <div className="p-3.5 flex flex-col flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 min-h-[2.5rem] leading-snug">
                      {exam.title}
                    </h3>

                    {/* Precio + reactivos en una sola línea compacta */}
                    <div className="flex items-baseline justify-between mt-2 mb-3">
                      {exam.is_free_sample ? (
                        <span className="text-green-700 font-bold text-base inline-flex items-center gap-1">
                          <Gift size={14} /> Gratis
                        </span>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-gray-900">
                            ${exam.direct_price_mxn?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400">MXN</span>
                        </div>
                      )}
                      {exam.total_questions != null && (
                        <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {exam.total_questions}
                        </span>
                      )}
                    </div>

                    {/* Acciones compactas */}
                    <div className="grid grid-cols-2 gap-1.5 mt-auto">
                      <button
                        onClick={() => openInfoSheet(exam)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition"
                        title={exam.info_sheet_url ? 'Ver ficha informativa' : 'Ver detalles'}
                      >
                        <BookOpen size={12} /> Detalles
                      </button>
                      {exam.is_free_sample ? (
                        <Link
                          to={`/catalogo/${exam.id}`}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        >
                          Tomar
                        </Link>
                      ) : purchasable ? (
                        <button
                          onClick={(e) => toggleSelect(e, exam)}
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition ${
                            selected
                              ? 'bg-primary-700 text-white hover:bg-primary-800'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                        >
                          {selected ? <><Check size={12} /> Elegida</> : <><ShoppingCart size={12} /> Comprar</>}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="inline-flex items-center justify-center px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-400 rounded-md cursor-not-allowed"
                        >
                          No disponible
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal ficha informativa */}
        <InfoSheetModal
          open={!!infoSheet}
          pdfUrl={infoSheet?.url || null}
          title={infoSheet?.title}
          onClose={() => setInfoSheet(null)}
        />

        {/* Barra inferior fija con resumen de selección */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t-2 border-primary-500 shadow-2xl z-40">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {selectedIds.size} certificación{selectedIds.size === 1 ? '' : 'es'} seleccionada{selectedIds.size === 1 ? '' : 's'}
                </div>
                <div className="text-sm text-gray-600">
                  Elige los productos (examen, certificados, material) en el siguiente paso para calcular el total.
                </div>
              </div>
              <button
                onClick={clearSelection}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1 transition"
              >
                <X size={16} /> Limpiar
              </button>
              <button
                onClick={goToBundleCheckout}
                className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:shadow-lg transition flex items-center gap-2 font-semibold shadow-md"
              >
                <ShoppingCart size={18} /> Elegir productos
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ----------- Modo público (sin Layout) -----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white pb-32">
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary-700">Evaluaasi</Link>
          <nav className="flex items-center gap-4">
            <Link to="/catalogo" className="text-primary-700 font-medium">Catálogo</Link>
            {user ? (
              <Link to="/dashboard" className="text-gray-700 hover:text-primary-700">Mi cuenta</Link>
            ) : (
              <Link to="/login" className="text-gray-700 hover:text-primary-700">Iniciar sesión</Link>
            )}
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-6 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
          Certifica tus competencias
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Compra las certificaciones que necesitas, preséntalas en línea y obtén tu certificado digital al instante.
        </p>
        <p className="mt-3 text-sm text-primary-700 inline-flex items-center gap-1.5">
          <Sparkles size={14} /> Puedes <strong>seleccionar varias</strong> y pagarlas en una sola transacción.
        </p>
      </section>

      {mainContent}

      <footer className="bg-white border-t mt-12 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} Evaluaasi · <Link to="/privacidad" className="hover:underline">Privacidad</Link> · <Link to="/terminos" className="hover:underline">Términos</Link>
      </footer>
    </div>
  )
}
