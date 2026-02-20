import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  listSupportCalendarSessions,
  listSupportCampuses,
  listSupportPartners,
} from '../../services/supportService'

type SessionFilter = 'active' | 'inactive' | 'all'

const SupportSessionsPage = () => {
  const [partnerIdDraft, setPartnerIdDraft] = useState<string>('')
  const [campusIdDraft, setCampusIdDraft] = useState<string>('')
  const [partnerId, setPartnerId] = useState<string>('')
  const [campusId, setCampusId] = useState<string>('')
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('active')

  const { data: partners = [] } = useQuery({
    queryKey: ['support', 'partners'],
    queryFn: () => listSupportPartners(),
  })

  const { data: campusesResponse } = useQuery({
    queryKey: ['support', 'campuses', 'sessions', partnerId || 'all'],
    queryFn: () => listSupportCampuses({ activeOnly: 'all' }),
  })

  const campuses = useMemo(() => {
    const all = campusesResponse?.campuses || []
    if (!partnerId) return all
    return all.filter((campus) => String(campus.partner_id || '') === partnerId)
  }, [campusesResponse, partnerId])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['support', 'sessions', partnerId, campusId],
    queryFn: () =>
      listSupportCalendarSessions({
        partner_id: partnerId ? Number(partnerId) : undefined,
        campus_id: campusId ? Number(campusId) : undefined,
      }),
  })

  const filteredEvents = useMemo(() => {
    const events = data?.events || []
    if (sessionFilter === 'all') return events
    if (sessionFilter === 'active') return events.filter((event) => event.status === 0)
    return events.filter((event) => event.status !== 0)
  }, [data, sessionFilter])

  const activeByExam = useMemo(() => {
    const activeEvents = (data?.events || []).filter((event) => event.status === 0)
    const map = new Map<number, number>()
    activeEvents.forEach((event) => {
      const count = map.get(event.exam_id) || 0
      map.set(event.exam_id, count + 1)
    })
    const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]
    return top ? { examId: top[0], count: top[1] } : { examId: null, count: 0 }
  }, [data])

  const availabilityPercent = useMemo(() => {
    const total = data?.events?.length || 0
    if (total === 0) return 0
    const active = data?.events?.filter((event) => event.status === 0).length || 0
    return Math.round((active / total) * 100)
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Total sesiones</p>
        <h2 className="text-2xl font-semibold text-gray-900">Sesiones</h2>
        <p className="text-sm text-gray-600 max-w-2xl">Consulta disponibilidad real desde base de datos.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <select
            value={partnerIdDraft}
            onChange={(event) => setPartnerIdDraft(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600"
          >
            <option value="">Todos los partners</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
          <select
            value={campusIdDraft}
            onChange={(event) => setCampusIdDraft(event.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600"
          >
            <option value="">Todos los planteles</option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setPartnerId(partnerIdDraft)
              setCampusId(campusIdDraft)
            }}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Aplicar
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Sesiones agendadas</p>
            <p className="text-xs text-gray-500">
              Última actualización:{' '}
              {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sessions"
                checked={sessionFilter === 'active'}
                onChange={() => setSessionFilter('active')}
              />
              Sesiones activas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sessions"
                checked={sessionFilter === 'inactive'}
                onChange={() => setSessionFilter('inactive')}
              />
              Sesiones inactivas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="sessions"
                checked={sessionFilter === 'all'}
                onChange={() => setSessionFilter('all')}
              />
              Todas
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-slate-900 text-white p-6 shadow-sm">
            <p className="text-xs text-white/70">Total agendadas ({sessionFilter})</p>
            <p className="text-4xl font-semibold mt-4">{isLoading ? '...' : filteredEvents.length}</p>
            <button
              onClick={() => refetch()}
              className="mt-6 inline-flex items-center gap-2 text-xs text-white/70"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs text-gray-500">Evaluación activa</p>
            <p className="text-3xl font-semibold text-gray-900 mt-4">{activeByExam.count}</p>
            <p className="text-xs text-gray-500 mt-2">
              {activeByExam.examId ? `Examen ${activeByExam.examId}` : 'Sin sesiones activas'}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs text-gray-500">Disponibilidad por día</p>
            <p className="text-3xl font-semibold text-gray-900 mt-4">{availabilityPercent}%</p>
            <p className="text-xs text-gray-500 mt-2">Sesiones activas / total</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupportSessionsPage
