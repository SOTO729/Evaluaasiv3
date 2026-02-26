import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  listSupportCalendarSessions,
  listSupportCampuses,
  listSupportPartners,
} from '../../services/supportService'

const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

const toMonthParam = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const monthLabel = (date: Date) =>
  date.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })

const SupportCalendarPage = () => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [partnerIdDraft, setPartnerIdDraft] = useState<string>('')
  const [campusIdDraft, setCampusIdDraft] = useState<string>('')
  const [partnerId, setPartnerId] = useState<string>('')
  const [campusId, setCampusId] = useState<string>('')

  const month = toMonthParam(currentMonth)

  const { data: partners = [] } = useQuery({
    queryKey: ['support', 'partners'],
    queryFn: () => listSupportPartners(),
  })

  const { data: campusesResponse } = useQuery({
    queryKey: ['support', 'campuses', 'calendar', partnerId || 'all'],
    queryFn: () => listSupportCampuses({ activeOnly: 'all' }),
  })

  const campuses = useMemo(() => {
    const all = campusesResponse?.campuses || []
    if (!partnerId) return all
    return all.filter((campus) => String(campus.partner_id || '') === partnerId)
  }, [campusesResponse, partnerId])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['support', 'calendar', month, partnerId, campusId],
    queryFn: () =>
      listSupportCalendarSessions({
        month,
        partner_id: partnerId ? Number(partnerId) : undefined,
        campus_id: campusId ? Number(campusId) : undefined,
      }),
  })

  const eventsByDay = useMemo(() => {
    const map = new Map<number, Array<any>>()
    ;(data?.events || []).forEach((event) => {
      if (!event.start_date) return
      const day = new Date(event.start_date).getDate()
      const current = map.get(day) || []
      current.push(event)
      map.set(day, current)
    })
    return map
  }, [data])

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const monthIndex = currentMonth.getMonth()
    const firstDayWeekIndex = new Date(year, monthIndex, 1).getDay()
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const totalCells = Math.ceil((firstDayWeekIndex + daysInMonth) / 7) * 7

    return Array.from({ length: totalCells }).map((_, index) => {
      const dayNumber = index - firstDayWeekIndex + 1
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return { dayNumber: null, events: [] as any[] }
      }
      return { dayNumber, events: eventsByDay.get(dayNumber) || [] }
    })
  }, [currentMonth, eventsByDay])

  const upcomingEvents = useMemo(() => {
    return [...(data?.events || [])]
      .filter((event) => event.start_date)
      .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime())
      .slice(0, 8)
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Calendario</p>
        <h2 className="text-2xl font-semibold text-gray-900">Calendario de sesiones</h2>
        <p className="text-sm text-gray-600 max-w-2xl">Consulta sesiones reales desde base de datos.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
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

        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button
              className="rounded-full border border-gray-200 px-3 py-1"
              onClick={() => setCurrentMonth(new Date())}
            >
              Hoy
            </button>
            <button
              className="rounded-full border border-gray-200 px-3 py-1"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <button
              className="rounded-full border border-gray-200 px-3 py-1"
              onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="text-sm text-gray-500 capitalize">{monthLabel(currentMonth)}</div>
        </div>

        {isError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            No se pudieron cargar sesiones
            {error instanceof Error ? `: ${error.message}` : ''}
          </div>
        )}

        <div className="grid grid-cols-7 gap-2 text-xs text-gray-500">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="text-center font-semibold text-gray-400">
              {day}
            </div>
          ))}
          {calendarCells.map((cell, index) => (
            <div key={index} className="h-20 rounded-xl border border-gray-100 bg-gray-50/60 p-2 text-[11px] text-gray-400">
              {cell.dayNumber ? <div className="text-gray-500">{cell.dayNumber}</div> : <div>&nbsp;</div>}
              {cell.events.slice(0, 2).map((event) => (
                <div
                  key={event.id}
                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] text-primary-600"
                >
                  <CalendarDays className="h-3 w-3" />
                  Examen
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Próximas sesiones ({data?.total || 0})</p>
            <div className="mt-3 space-y-3 text-sm text-gray-600">
              {isLoading && <p className="text-sm text-gray-500">Cargando sesiones...</p>}
              {!isLoading && upcomingEvents.length === 0 && (
                <p className="text-sm text-gray-500">No hay sesiones para los filtros seleccionados.</p>
              )}
              {upcomingEvents.map((item) => {
                const start = item.start_date ? new Date(item.start_date) : null
                return (
                  <div key={item.id} className="rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400">
                      {start ? start.toLocaleString('es-MX') : 'Sin fecha'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {item.partner_name || 'Sin partner'} · {item.campus_name || 'Sin plantel'} · {item.user_name}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50/50">
            <p className="text-sm font-semibold text-gray-900">Fuente de datos</p>
            <p className="text-xs text-gray-500 mt-2">Origen: {data?.source || 'results'}</p>
            <p className="text-xs text-gray-500 mt-1">{data?.message || 'Consulta directa a BD'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupportCalendarPage
