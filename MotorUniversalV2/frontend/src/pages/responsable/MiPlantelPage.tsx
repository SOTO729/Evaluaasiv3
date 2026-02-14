/**
 * Página principal del plantel para el responsable - Hub de gestión
 * Incluye stats, grupos CRUD, edición de campus y navegación
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { 
  getMiPlantel, getMiPlantelStats, getMiPlantelGroups,
  updateMiPlantelCampus, createMiPlantelGroup, updateMiPlantelGroup, deleteMiPlantelGroup,
  MiPlantelStats, Campus, CandidateGroup
} from '../../services/partnersService'
import {
  Building2, Users, GraduationCap, Award, FileText,
  Plus, Pencil, Trash2, Eye, ChevronRight, Save, X, MapPin, Phone,
  Settings, Calendar, BarChart3, Shield
} from 'lucide-react'

const MiPlantelPage = () => {
  const { user } = useAuthStore()
  const [campus, setCampus] = useState<Campus | null>(null)
  const [stats, setStats] = useState<MiPlantelStats['stats'] | null>(null)
  const [groups, setGroups] = useState<CandidateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Edit Campus state
  const [editingCampus, setEditingCampus] = useState(false)
  const [campusForm, setCampusForm] = useState<Record<string, string>>({})
  const [savingCampus, setSavingCampus] = useState(false)
  
  // Create/Edit Group state
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CandidateGroup | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', description: '', start_date: '', end_date: '' })
  const [savingGroup, setSavingGroup] = useState(false)

  const canManage = user?.can_manage_groups || false

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [plantelRes, statsRes, groupsRes] = await Promise.all([
        getMiPlantel(), getMiPlantelStats(), getMiPlantelGroups()
      ])
      setCampus(plantelRes.campus)
      setStats(statsRes.stats)
      setGroups(groupsRes.groups)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos del plantel')
    } finally {
      setLoading(false)
    }
  }

  // Campus edit handlers
  const startEditCampus = () => {
    if (!campus) return
    setCampusForm({
      address: campus.address || '', city: campus.city || '', state_name: campus.state_name || '',
      postal_code: campus.postal_code || '', email: campus.email || '', phone: campus.phone || '',
      website: campus.website || '', director_name: campus.director_name || '',
      director_first_surname: campus.director_first_surname || '',
      director_second_surname: campus.director_second_surname || '',
      director_email: campus.director_email || '', director_phone: campus.director_phone || ''
    })
    setEditingCampus(true)
  }

  const saveCampus = async () => {
    try {
      setSavingCampus(true)
      const res = await updateMiPlantelCampus(campusForm)
      setCampus(res.campus)
      setEditingCampus(false)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSavingCampus(false)
    }
  }

  // Group handlers
  const openGroupModal = (group?: CandidateGroup) => {
    if (group) {
      setEditingGroup(group)
      setGroupForm({ name: group.name, description: group.description || '', start_date: group.start_date || '', end_date: group.end_date || '' })
    } else {
      setEditingGroup(null)
      setGroupForm({ name: '', description: '', start_date: '', end_date: '' })
    }
    setShowGroupModal(true)
  }

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return alert('El nombre es requerido')
    try {
      setSavingGroup(true)
      if (editingGroup) {
        await updateMiPlantelGroup(editingGroup.id, groupForm)
      } else {
        await createMiPlantelGroup(groupForm)
      }
      setShowGroupModal(false)
      await loadData()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar grupo')
    } finally {
      setSavingGroup(false)
    }
  }

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`¿Desactivar el grupo "${groupName}"?`)) return
    try {
      await deleteMiPlantelGroup(groupId)
      await loadData()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al desactivar grupo')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900"></div>
        <p className="mt-4 text-base font-medium text-gray-700">Cargando plantel...</p>
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

  return (
    <div className="fluid-gap-5 flex flex-col">
      {/* Header */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between fluid-gap-4">
          <div className="flex items-center fluid-gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold text-gray-900">{campus?.name || 'Mi Plantel'}</h1>
              <div className="flex items-center fluid-gap-3 fluid-mt-1">
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">{campus?.code}</span>
                {campus?.city && campus?.state_name && (
                  <span className="text-gray-500 text-sm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {campus.city}, {campus.state_name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/mi-plantel/certificados" className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 text-sm font-medium">
              <Award className="w-4 h-4" /> Certificados
            </Link>
            <Link to="/mi-plantel/reportes" className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200 text-sm font-medium">
              <BarChart3 className="w-4 h-4" /> Reportes
            </Link>
            <button onClick={startEditCampus} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 text-sm font-medium">
              <Pencil className="w-4 h-4" /> Editar Plantel
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 fluid-gap-4">
        {[
          { label: 'Candidatos', value: stats?.total_candidates || 0, icon: Users, color: 'blue' },
          { label: 'Grupos', value: stats?.total_groups || 0, icon: GraduationCap, color: 'purple' },
          { label: 'Evaluaciones', value: stats?.total_evaluations || 0, icon: FileText, color: 'green' },
          { label: 'Certificados', value: stats?.candidates_certified || 0, icon: Award, color: 'amber' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-fluid-lg border border-gray-200 fluid-p-5">
            <div className="flex items-center fluid-gap-3">
              <div className={`w-11 h-11 rounded-lg bg-${s.color}-100 flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 text-${s.color}-600`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 fluid-gap-5">
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="font-semibold text-gray-800 fluid-mb-4">Rendimiento de Evaluaciones</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Tasa de Aprobación</span>
                <span className="font-semibold">{stats?.approval_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${stats?.approval_rate || 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Promedio General</span>
                <span className="font-semibold">{stats?.average_score || 0}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${stats?.average_score || 0}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">{stats?.passed_evaluations || 0}</p>
                <p className="text-xs text-gray-500">Aprobadas</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-500">{stats?.failed_evaluations || 0}</p>
                <p className="text-xs text-gray-500">Reprobadas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="font-semibold text-gray-800 fluid-mb-4">Progreso en Materiales</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Avance General</span>
                <span className="font-semibold">{stats?.material_completion_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-purple-500 h-2.5 rounded-full transition-all" style={{ width: `${stats?.material_completion_rate || 0}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t">
              <div className="text-center">
                <p className="text-xl font-bold text-purple-600">{stats?.completed_material_progress || 0}</p>
                <p className="text-xs text-gray-500">Completados</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-400">{(stats?.total_material_progress || 0) - (stats?.completed_material_progress || 0)}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Section */}
      <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
        <div className="flex items-center justify-between fluid-mb-4">
          <h3 className="fluid-text-lg font-semibold text-gray-800">Grupos del Plantel</h3>
          {canManage && (
            <button onClick={() => openGroupModal()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Nuevo Grupo
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-10">
            <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay grupos activos</p>
            {canManage && <p className="text-sm text-gray-400 mt-1">Crea el primer grupo para comenzar</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 fluid-gap-4">
            {groups.map(group => (
              <div key={group.id} className="border border-gray-200 rounded-lg fluid-p-4 hover:border-blue-300 hover:shadow-sm transition-all group/card">
                <div className="flex items-start justify-between fluid-mb-3">
                  <div className="flex items-center fluid-gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{group.name}</h4>
                      <p className="text-sm text-gray-500">{group.member_count || 0} candidatos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <Link to={`/mi-plantel/grupos/${group.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver detalle">
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canManage && (
                      <>
                        <button onClick={() => openGroupModal(group)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteGroup(group.id, group.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Desactivar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {group.description && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{group.description}</p>}
                <Link to={`/mi-plantel/grupos/${group.id}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Ver detalle <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campus Config (read-only) */}
      {campus && (
        <div className="bg-white rounded-fluid-xl border border-gray-200 fluid-p-5">
          <h3 className="font-semibold text-gray-800 fluid-mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" /> Configuración del Plantel
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 fluid-gap-3">
            {[
              { label: 'Constancia Eduit', enabled: campus.enable_tier_basic },
              { label: 'Certificado Eduit', enabled: campus.enable_tier_standard },
              { label: 'Certificado CONOCER', enabled: campus.enable_tier_advanced },
              { label: 'Insignia Digital', enabled: campus.enable_digital_badge },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${t.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">{t.label}</span>
              </div>
            ))}
          </div>
          {campus.assignment_validity_months && (
            <div className="mt-4 pt-3 border-t flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              Vigencia: {campus.assignment_validity_months} {campus.assignment_validity_months === 1 ? 'mes' : 'meses'} tras cada asignación
            </div>
          )}
        </div>
      )}

      {/* Edit Campus Modal */}
      {editingCampus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">Editar Datos del Plantel</h2>
              <button onClick={() => setEditingCampus(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2"><MapPin className="w-4 h-4" /> Dirección</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'address', label: 'Dirección', span: 2 },
                  { key: 'city', label: 'Ciudad' },
                  { key: 'state_name', label: 'Estado' },
                  { key: 'postal_code', label: 'C.P.' },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type="text" value={campusForm[f.key] || ''} onChange={e => setCampusForm({...campusForm, [f.key]: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                ))}
              </div>
              <h3 className="font-semibold text-gray-700 flex items-center gap-2 pt-2"><Phone className="w-4 h-4" /> Contacto</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Teléfono' },
                  { key: 'website', label: 'Sitio web', span: 2 },
                ].map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type="text" value={campusForm[f.key] || ''} onChange={e => setCampusForm({...campusForm, [f.key]: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                ))}
              </div>
              <h3 className="font-semibold text-gray-700 flex items-center gap-2 pt-2"><Shield className="w-4 h-4" /> Director</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'director_name', label: 'Nombre' },
                  { key: 'director_first_surname', label: 'Primer Apellido' },
                  { key: 'director_second_surname', label: 'Segundo Apellido' },
                  { key: 'director_email', label: 'Email' },
                  { key: 'director_phone', label: 'Teléfono' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type="text" value={campusForm[f.key] || ''} onChange={e => setCampusForm({...campusForm, [f.key]: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setEditingCampus(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveCampus} disabled={savingCampus} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
                <Save className="w-4 h-4" /> {savingCampus ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Create/Edit Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}</h2>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo *</label>
                <input type="text" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ej: Grupo A - Turno Matutino" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={groupForm.description} onChange={e => setGroupForm({...groupForm, description: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input type="date" value={groupForm.start_date} onChange={e => setGroupForm({...groupForm, start_date: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input type="date" value={groupForm.end_date} onChange={e => setGroupForm({...groupForm, end_date: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={saveGroup} disabled={savingGroup} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingGroup ? 'Guardando...' : editingGroup ? 'Actualizar' : 'Crear Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MiPlantelPage
