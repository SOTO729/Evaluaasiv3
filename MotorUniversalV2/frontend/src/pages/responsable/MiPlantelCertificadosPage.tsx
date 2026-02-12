/**
 * Página de certificados por grupo para el responsable
 * Muestra tipos habilitados y certificados emitidos por candidato
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getMiPlantelCertificatesByGroup } from '../../services/partnersService'
import {
  Award, ChevronDown, ChevronRight, Users,
  FileText, Search, ArrowLeft, Shield, BadgeCheck
} from 'lucide-react'

interface Certificate {
  user_id: string; user_name: string; user_curp: string
  exam_name: string; score: number; date: string | null
  certificate_code: string | null; certificate_url: string | null; report_url: string | null
  document_options: {
    evaluation_report: boolean; certificate: boolean
    conocer_certificate: boolean; digital_badge: boolean
  }
}

interface GroupCertData {
  group_id: number; group_name: string; group_code: string
  total_members: number; total_certificates: number
  enabled_tiers: {
    constancia_eduit: boolean; certificado_eduit: boolean
    certificado_conocer: boolean; insignia_digital: boolean
  }
  certificates: Certificate[]
}

const TIER_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  constancia_eduit: { label: 'Constancia Eduit', icon: FileText, color: 'blue' },
  certificado_eduit: { label: 'Certificado Eduit', icon: Award, color: 'green' },
  certificado_conocer: { label: 'Certificado CONOCER', icon: Shield, color: 'purple' },
  insignia_digital: { label: 'Insignia Digital', icon: BadgeCheck, color: 'amber' },
}

const MiPlantelCertificadosPage = () => {
  const [groups, setGroups] = useState<GroupCertData[]>([])
  const [campusTiers, setCampusTiers] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getMiPlantelCertificatesByGroup()
      setGroups(res.groups)
      setCampusTiers(res.campus_tiers)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar certificados')
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const filteredGroups = groups.filter(g =>
    g.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.certificates.some(c => c.user_name.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando certificados...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl">
        <p>{error}</p>
        <button onClick={loadData} className="mt-2 text-sm underline">Reintentar</button>
      </div>
    )
  }

  const totalCerts = groups.reduce((a, g) => a + g.total_certificates, 0)
  const totalMembers = groups.reduce((a, g) => a + g.total_members, 0)

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between fluid-gap-3">
        <div>
          <Link to="/mi-plantel" className="inline-flex items-center fluid-gap-1 text-gray-500 hover:text-gray-700 fluid-text-sm fluid-mb-2">
            <ArrowLeft className="w-4 h-4" /> Mi Plantel
          </Link>
          <h1 className="fluid-text-2xl font-bold text-gray-900">Certificados por Grupo</h1>
          <p className="fluid-text-sm text-gray-500 fluid-mt-1">
            {totalCerts} certificados emitidos — {totalMembers} candidatos en {groups.length} grupos
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar grupo o candidato..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg fluid-text-sm w-full sm:w-72 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Campus Tiers Overview */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
        <h3 className="fluid-text-base font-semibold text-gray-800 fluid-mb-3">Tipos de Certificación Habilitados en el Plantel</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 fluid-gap-3">
          {Object.entries(TIER_LABELS).map(([key, tier]) => {
            const enabled = campusTiers[key]
            const Icon = tier.icon
            return (
              <div key={key} className={`flex items-center fluid-gap-3 fluid-p-3 rounded-lg border ${enabled ? `border-${tier.color}-200 bg-${tier.color}-50` : 'border-gray-200 bg-gray-50 opacity-50'}`}>
                <Icon className={`w-5 h-5 ${enabled ? `text-${tier.color}-600` : 'text-gray-400'}`} />
                <div>
                  <p className={`fluid-text-sm font-medium ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>{tier.label}</p>
                  <p className={`fluid-text-xs ${enabled ? `text-${tier.color}-600` : 'text-gray-400'}`}>
                    {enabled ? 'Habilitado' : 'Deshabilitado'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Groups Accordion */}
      <div className="flex flex-col fluid-gap-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-12 text-center">
            <Award className="w-12 h-12 text-gray-300 mx-auto fluid-mb-3" />
            <p className="text-gray-500">No se encontraron grupos{searchTerm ? ' con ese criterio' : ''}</p>
          </div>
        ) : (
          filteredGroups.map(group => {
            const isExpanded = expandedGroups.has(group.group_id)
            return (
              <div key={group.group_id} className="bg-white rounded-fluid-xl border border-gray-200 overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.group_id)}
                  className="w-full flex items-center justify-between fluid-p-5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center fluid-gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{group.group_name}</h3>
                      <p className="fluid-text-sm text-gray-500">
                        {group.total_members} candidatos — {group.total_certificates} certificados
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center fluid-gap-4">
                    {/* Tier badges */}
                    <div className="hidden sm:flex fluid-gap-1.5">
                      {Object.entries(group.enabled_tiers).map(([key, enabled]) => {
                        if (!enabled) return null
                        const tier = TIER_LABELS[key]
                        const Icon = tier.icon
                        return (
                          <span key={key} className={`inline-flex items-center fluid-gap-1 px-2 py-0.5 rounded-full fluid-text-xs bg-${tier.color}-100 text-${tier.color}-700`}>
                            <Icon className="w-3 h-3" />
                            {tier.label.split(' ')[0]}
                          </span>
                        )
                      })}
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {group.certificates.length === 0 ? (
                      <div className="fluid-p-8 text-center text-gray-400">
                        <FileText className="w-8 h-8 mx-auto fluid-mb-2" />
                        <p>Aún no hay certificados emitidos en este grupo</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left fluid-px-5 fluid-py-3 fluid-text-xs font-medium text-gray-500 uppercase">Candidato</th>
                              <th className="text-left fluid-px-5 fluid-py-3 fluid-text-xs font-medium text-gray-500 uppercase">CURP</th>
                              <th className="text-left fluid-px-5 fluid-py-3 fluid-text-xs font-medium text-gray-500 uppercase">Examen</th>
                              <th className="text-center fluid-px-5 fluid-py-3 fluid-text-xs font-medium text-gray-500 uppercase">Calif.</th>
                              <th className="text-left fluid-px-5 fluid-py-3 fluid-text-xs font-medium text-gray-500 uppercase">Fecha</th>
                              <th className="text-center fluid-px-5 fluid-py-3 fluid-text-xs font-medium text-gray-500 uppercase">Documentos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {group.certificates.map((cert, idx) => (
                              <tr key={`${cert.user_id}-${idx}`} className="hover:bg-gray-50">
                                <td className="fluid-px-5 fluid-py-3">
                                  <p className="font-medium text-gray-800 fluid-text-sm">{cert.user_name}</p>
                                </td>
                                <td className="fluid-px-5 fluid-py-3 fluid-text-sm text-gray-600 font-mono">{cert.user_curp || '—'}</td>
                                <td className="fluid-px-5 fluid-py-3 fluid-text-sm text-gray-600">{cert.exam_name}</td>
                                <td className="fluid-px-5 fluid-py-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full fluid-text-xs font-medium bg-green-100 text-green-800">
                                    {cert.score}%
                                  </span>
                                </td>
                                <td className="fluid-px-5 fluid-py-3 fluid-text-sm text-gray-500">
                                  {cert.date ? new Date(cert.date).toLocaleDateString('es-MX') : '—'}
                                </td>
                                <td className="fluid-px-5 fluid-py-3">
                                  <div className="flex items-center justify-center fluid-gap-1">
                                    {cert.document_options.evaluation_report && (
                                      <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center" title="Constancia">
                                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                                      </span>
                                    )}
                                    {cert.document_options.certificate && (
                                      <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center" title="Certificado">
                                        <Award className="w-3.5 h-3.5 text-green-600" />
                                      </span>
                                    )}
                                    {cert.document_options.conocer_certificate && (
                                      <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center" title="CONOCER">
                                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                                      </span>
                                    )}
                                    {cert.document_options.digital_badge && (
                                      <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center" title="Badge">
                                        <BadgeCheck className="w-3.5 h-3.5 text-amber-600" />
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default MiPlantelCertificadosPage
