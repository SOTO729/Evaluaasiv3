/**
 * Página de certificados para el responsable del partner
 * Tabla plana con filtros por estado, plantel, grupo y tipo de certificado
 * Incluye descarga individual y exportación a Excel
 */
import { useState, useEffect, useCallback } from 'react'
import {
  getMiPartnerCertificates,
  exportMiPartnerCertificatesExcel,
  downloadMiPartnerCertificatesZip,
  PartnerCertificate,
  PartnerCertificatesResponse
} from '../../services/partnersService'
import {
  Award, Download, FileSpreadsheet, Search, Filter, X,
  ChevronLeft, ChevronRight, Building2, MapPin,
  RefreshCw, ExternalLink, FolderArchive
} from 'lucide-react'

const CERT_TYPE_COLORS: Record<string, string> = {
  reporte_evaluacion: 'bg-blue-100 text-blue-800',
  certificado_eduit: 'bg-green-100 text-green-800',
  certificado_conocer: 'bg-amber-100 text-amber-800',
  insignia_digital: 'bg-purple-100 text-purple-800',
}

const ResponsablePartnerCertificadosPage = () => {
  const [data, setData] = useState<PartnerCertificatesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [stateFilter, setStateFilter] = useState('')
  const [campusFilter, setCampusFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [certTypeFilter, setCertTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 25

  const loadCertificates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: any = { page, per_page: perPage }
      if (stateFilter) params.state = stateFilter
      if (campusFilter) params.campus_id = campusFilter
      if (groupFilter) params.group_id = groupFilter
      if (certTypeFilter) params.cert_type = certTypeFilter
      if (searchQuery) params.search = searchQuery
      const res = await getMiPartnerCertificates(params)
      setData(res)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar certificados')
    } finally {
      setLoading(false)
    }
  }, [page, stateFilter, campusFilter, groupFilter, certTypeFilter, searchQuery])

  useEffect(() => {
    loadCertificates()
  }, [loadCertificates])

  const handleSearch = () => {
    setPage(1)
    setSearchQuery(searchInput)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const clearFilters = () => {
    setStateFilter('')
    setCampusFilter('')
    setGroupFilter('')
    setCertTypeFilter('')
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params: any = {}
      if (stateFilter) params.state = stateFilter
      if (campusFilter) params.campus_id = campusFilter
      if (groupFilter) params.group_id = groupFilter
      if (certTypeFilter) params.cert_type = certTypeFilter
      if (searchQuery) params.search = searchQuery
      await exportMiPartnerCertificatesExcel(params)
    } catch (err: any) {
      alert('Error al exportar: ' + (err.response?.data?.error || err.message))
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true)
      const params: any = {}
      if (stateFilter) params.state = stateFilter
      if (campusFilter) params.campus_id = campusFilter
      if (groupFilter) params.group_id = groupFilter
      if (certTypeFilter) params.cert_type = certTypeFilter
      if (searchQuery) params.search = searchQuery
      await downloadMiPartnerCertificatesZip(params)
    } catch (err: any) {
      const errorMsg = err.response?.status === 404
        ? 'No se encontraron certificados descargables con los filtros seleccionados'
        : 'Error al descargar ZIP: ' + (err.response?.data?.error || err.message)
      alert(errorMsg)
    } finally {
      setDownloadingZip(false)
    }
  }

  const openDownload = (cert: PartnerCertificate) => {
    if (cert.download_url) {
      window.open(cert.download_url, '_blank')
    }
  }

  const hasActiveFilters = stateFilter || campusFilter || groupFilter || certTypeFilter || searchQuery

  // Filtrar grupos por campus seleccionado
  const filteredGroups = data?.filters?.groups?.filter(g =>
    !campusFilter || g.campus_id === parseInt(campusFilter)
  ) || []

  // Filtrar campuses por estado seleccionado
  const filteredCampuses = data?.filters?.campuses?.filter(c =>
    !stateFilter || c.state === stateFilter
  ) || []

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-4">
        <div>
          <h1 className="fluid-text-2xl font-bold text-gray-900 flex items-center fluid-gap-2">
            <Award className="fluid-icon-lg text-amber-600" />
            Certificados del Partner
          </h1>
          <p className="fluid-text-sm text-gray-500 mt-1">
            Todos los certificados emitidos en los planteles del partner
          </p>
        </div>
        <div className="flex fluid-gap-2">
          <button
            onClick={loadCertificates}
            className="inline-flex items-center fluid-gap-2 fluid-px-3 fluid-py-2 bg-white border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 hover:bg-gray-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-green-600 text-white rounded-fluid-lg fluid-text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className="inline-flex items-center fluid-gap-2 fluid-px-4 fluid-py-2 bg-indigo-600 text-white rounded-fluid-lg fluid-text-sm font-medium hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            <FolderArchive className="w-4 h-4" />
            {downloadingZip ? 'Generando ZIP...' : 'Descargar ZIP'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-4">
        <div className="flex items-center fluid-gap-2 fluid-mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="fluid-text-sm font-semibold text-gray-700">Filtros</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-red-50 text-red-600 rounded-lg fluid-text-xs hover:bg-red-100 transition-all"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 fluid-gap-3">
          {/* Estado */}
          <div>
            <label className="fluid-text-xs text-gray-500 font-medium fluid-mb-1 block">Estado</label>
            <select
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setCampusFilter(''); setGroupFilter(''); setPage(1) }}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {data?.filters?.states?.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          
          {/* Plantel */}
          <div>
            <label className="fluid-text-xs text-gray-500 font-medium fluid-mb-1 block">Plantel</label>
            <select
              value={campusFilter}
              onChange={(e) => { setCampusFilter(e.target.value); setGroupFilter(''); setPage(1) }}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {filteredCampuses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          {/* Grupo */}
          <div>
            <label className="fluid-text-xs text-gray-500 font-medium fluid-mb-1 block">Grupo</label>
            <select
              value={groupFilter}
              onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          
          {/* Tipo de certificado */}
          <div>
            <label className="fluid-text-xs text-gray-500 font-medium fluid-mb-1 block">Tipo</label>
            <select
              value={certTypeFilter}
              onChange={(e) => { setCertTypeFilter(e.target.value); setPage(1) }}
              className="w-full fluid-px-3 fluid-py-2 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {data?.filters?.cert_types?.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
          
          {/* Búsqueda */}
          <div>
            <label className="fluid-text-xs text-gray-500 font-medium fluid-mb-1 block">Buscar</label>
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Nombre o CURP..."
                className="w-full fluid-px-3 fluid-py-2 pr-9 border border-gray-300 rounded-fluid-lg fluid-text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="flex flex-wrap items-center fluid-gap-4 fluid-text-sm text-gray-600">
          <span className="font-medium text-gray-800">
            {data.pagination.total} certificado{data.pagination.total !== 1 ? 's' : ''} encontrado{data.pagination.total !== 1 ? 's' : ''}
          </span>
          {data.pagination.pages > 1 && (
            <span>
              Página {data.pagination.page} de {data.pagination.pages}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-4 border-blue-600"></div>
            <p className="ml-3 text-gray-500">Cargando certificados...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button onClick={loadCertificates} className="mt-2 text-sm text-blue-600 underline">Reintentar</button>
          </div>
        ) : data && data.certificates.length === 0 ? (
          <div className="p-12 text-center">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No se encontraron certificados</p>
            <p className="text-gray-400 text-sm mt-1">Prueba ajustando los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Candidato</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">CURP</th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Calif.</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Grupo</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Plantel</th>
                  <th className="text-left fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="text-center fluid-px-4 fluid-py-3 fluid-text-xs font-semibold text-gray-600 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                    <td className="fluid-px-4 fluid-py-3">
                      <span className={`inline-flex items-center fluid-px-2 fluid-py-1 rounded-full fluid-text-xs font-medium ${CERT_TYPE_COLORS[cert.cert_type] || 'bg-gray-100 text-gray-800'}`}>
                        {cert.cert_type_label}
                      </span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <span className="fluid-text-sm font-medium text-gray-800">{cert.user_name}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <span className="fluid-text-xs font-mono text-gray-600">{cert.user_curp || '—'}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      {cert.score > 0 ? (
                        <span className={`fluid-text-sm font-semibold ${cert.score >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                          {cert.score}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <span className="fluid-text-xs font-mono text-gray-600">{cert.code || '—'}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <span className="fluid-text-sm text-gray-600">{cert.date || '—'}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <span className="fluid-text-sm text-gray-600">{cert.group_name}</span>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <div className="flex items-center fluid-gap-1">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <span className="fluid-text-sm text-gray-600">{cert.campus_name}</span>
                      </div>
                    </td>
                    <td className="fluid-px-4 fluid-py-3">
                      <div className="flex items-center fluid-gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="fluid-text-xs text-gray-500">{cert.state || '—'}</span>
                      </div>
                    </td>
                    <td className="fluid-px-4 fluid-py-3 text-center">
                      {cert.download_url ? (
                        <button
                          onClick={() => openDownload(cert)}
                          className="inline-flex items-center fluid-gap-1 fluid-px-2 fluid-py-1 bg-blue-50 text-blue-600 rounded-lg fluid-text-xs font-medium hover:bg-blue-100 transition-all"
                          title="Descargar certificado"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      ) : cert.cert_type === 'certificado_conocer' ? (
                        <span className="inline-flex items-center fluid-gap-1 fluid-text-xs text-amber-600">
                          <ExternalLink className="w-3 h-3" />
                          CONOCER
                        </span>
                      ) : (
                        <span className="text-gray-400 fluid-text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-center fluid-gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 bg-white border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          
          <div className="flex fluid-gap-1">
            {Array.from({ length: Math.min(5, data.pagination.pages) }, (_, i) => {
              let p: number
              if (data.pagination.pages <= 5) {
                p = i + 1
              } else if (page <= 3) {
                p = i + 1
              } else if (page >= data.pagination.pages - 2) {
                p = data.pagination.pages - 4 + i
              } else {
                p = page - 2 + i
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`fluid-px-3 fluid-py-2 rounded-fluid-lg fluid-text-sm font-medium transition-all ${
                    p === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>
          
          <button
            onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
            disabled={page === data.pagination.pages}
            className="inline-flex items-center fluid-gap-1 fluid-px-3 fluid-py-2 bg-white border border-gray-300 rounded-fluid-lg fluid-text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default ResponsablePartnerCertificadosPage
