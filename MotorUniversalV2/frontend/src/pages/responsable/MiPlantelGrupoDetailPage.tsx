/**
 * Detalle de grupo para el responsable del plantel
 * Muestra miembros, exámenes asignados y permite gestión si tiene permisos
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  getMiPlantelGroupDetail, getMiPlantelGroupMembers, getMiPlantelGroupExams,
  addMiPlantelGroupMember, removeMiPlantelGroupMember, searchMiPlantelCandidates
} from '../../services/partnersService'
import {
  Users, ArrowLeft, GraduationCap, FileText, Plus, Trash2,
  Search, BookOpen, Calendar, CheckCircle2, XCircle
} from 'lucide-react'

interface Member {
  id: number; user_id: string; user_name: string; user_email: string
  user_curp: string; status: string; notes: string | null; joined_at: string | null
}

interface GroupExam {
  id: number; exam_id: number; exam?: { id: number; name: string; version: string }
  assigned_at: string | null; assignment_type: string; is_active: boolean
}

interface SearchCandidate {
  id: string; full_name: string; email: string; curp: string
}

const MiPlantelGrupoDetailPage = () => {
  const { groupId } = useParams<{ groupId: string }>()
  const { user } = useAuthStore()
  const [group, setGroup] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [exams, setExams] = useState<GroupExam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'members' | 'exams'>('members')
  
  // Add member state
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [addingMember, setAddingMember] = useState(false)

  const canManage = user?.can_manage_groups || false
  const gid = parseInt(groupId || '0')

  useEffect(() => { if (gid) loadData() }, [gid])

  const loadData = async () => {
    try {
      setLoading(true)
      const [groupRes, membersRes, examsRes] = await Promise.all([
        getMiPlantelGroupDetail(gid),
        getMiPlantelGroupMembers(gid),
        getMiPlantelGroupExams(gid)
      ])
      setGroup(groupRes.group)
      setMembers(membersRes.members)
      setExams(examsRes.assigned_exams || [])
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar el grupo')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) return
    try {
      setSearching(true)
      const res = await searchMiPlantelCandidates(searchTerm, gid)
      setSearchResults(res.candidates)
    } catch (err: any) {
      console.error('Error searching:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleAddMember = async (userId: string) => {
    try {
      setAddingMember(true)
      await addMiPlantelGroupMember(gid, userId)
      setSearchResults(prev => prev.filter(c => c.id !== userId))
      const membersRes = await getMiPlantelGroupMembers(gid)
      setMembers(membersRes.members)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al agregar candidato')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: number, name: string) => {
    if (!confirm(`¿Eliminar a "${name}" del grupo?`)) return
    try {
      await removeMiPlantelGroupMember(gid, memberId)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando grupo...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-xl">
        <p>{error}</p>
        <Link to="/mi-plantel" className="mt-2 text-sm underline">Volver al plantel</Link>
      </div>
    )
  }

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Header */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6">
        <Link to="/mi-plantel" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a Mi Plantel
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="fluid-text-2xl font-bold text-gray-900">{group?.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {members.length} candidatos — {exams.length} exámenes asignados
              {group?.description && ` — ${group.description}`}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
              activeTab === 'members' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" /> Candidatos ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
              activeTab === 'exams' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4" /> Exámenes Asignados ({exams.length})
          </button>
        </div>

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="fluid-p-5">
            {canManage && (
              <div className="fluid-mb-4">
                {!showSearch ? (
                  <button onClick={() => setShowSearch(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Agregar Candidato
                  </button>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                          placeholder="Buscar por nombre, email o CURP..."
                          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <button onClick={handleSearch} disabled={searching} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                        {searching ? 'Buscando...' : 'Buscar'}
                      </button>
                      <button onClick={() => { setShowSearch(false); setSearchResults([]) }} className="px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-100 text-sm">
                        Cerrar
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-200 border rounded-lg bg-white">
                        {searchResults.map(c => (
                          <div key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{c.full_name}</p>
                              <p className="text-xs text-gray-500">{c.email} {c.curp && `— ${c.curp}`}</p>
                            </div>
                            <button onClick={() => handleAddMember(c.id)} disabled={addingMember}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm hover:bg-green-200 disabled:opacity-50">
                              <Plus className="w-3.5 h-3.5 inline mr-1" />Agregar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay candidatos en este grupo</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Candidato</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">CURP</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ingreso</th>
                      {canManage && <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.user_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.user_email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">{m.user_curp || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {m.status === 'active' ? 'Activo' : m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {m.joined_at ? new Date(m.joined_at).toLocaleDateString('es-MX') : '—'}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleRemoveMember(m.id, m.user_name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Exams Tab */}
        {activeTab === 'exams' && (
          <div className="fluid-p-5">
            {exams.length === 0 ? (
              <div className="text-center py-10">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay exámenes asignados a este grupo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 fluid-gap-4">
                {exams.map((ge: any) => (
                  <div key={ge.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 truncate">{ge.exam?.name || `Examen #${ge.exam_id}`}</h4>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {ge.assignment_type === 'all' ? 'Todos los candidatos' : 'Candidatos seleccionados'}
                        </p>
                        {ge.assigned_at && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Asignado: {new Date(ge.assigned_at).toLocaleDateString('es-MX')}
                          </p>
                        )}
                      </div>
                    </div>
                    {ge.materials && ge.materials.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {ge.materials.length} materiales vinculados
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MiPlantelGrupoDetailPage
