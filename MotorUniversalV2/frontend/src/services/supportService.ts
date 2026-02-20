import api from './api'
import { isSupportPreviewEnabled } from '../support/supportPreview'
import { mockCompanies, mockTickets } from '../support/mockSupportData'

export type SupportTicketStatus = 'open' | 'pending' | 'solved'
export type SupportPriority = 'low' | 'medium' | 'high'
export type SupportChannel = 'web' | 'email' | 'whatsapp' | 'instagram'

export interface SupportTicketAttachment {
  name: string
  url: string
  size: string
}

export interface SupportTicket {
  id: string
  folio: string
  subject: string
  message: string
  userName: string
  userEmail: string
  companyId: string
  companyName: string
  status: SupportTicketStatus
  priority: SupportPriority
  createdAt: string
  updatedAt: string
  tags: string[]
  lastAgentResponseAt?: string
  channel: SupportChannel
  attachments: SupportTicketAttachment[]
}

export interface SupportTicketNote {
  id: string
  ticketId: string
  author: string
  message: string
  createdAt: string
}

export interface SupportCompany {
  id: string
  name: string
  industry?: string
  contactEmail?: string
  activeTickets?: number
}

export interface SupportPartnerOption {
  id: number
  name: string
}

export interface SupportCalendarEvent {
  id: string
  result_id: string
  title: string
  session_type: string
  start_date: string | null
  end_date: string | null
  status: number
  score: number
  exam_id: number
  user_id: string
  user_name: string
  campus_id?: number | null
  campus_name?: string | null
  partner_id?: number | null
  partner_name?: string | null
}

export interface SupportCalendarResponse {
  message: string
  source: string
  month?: string
  total: number
  events: SupportCalendarEvent[]
}

export interface SupportDirectoryUser {
  id: string
  username: string
  full_name: string
  email?: string | null
  curp?: string | null
  role: string
  is_active: boolean
  created_at?: string | null
  last_login?: string | null
}

export interface SupportCampus {
  id: string | number
  name: string
  partner_id?: number | null
  partner_name?: string | null
  state_name?: string | null
  city?: string | null
  country?: string | null
  address?: string | null
  location?: string | null
  is_active?: boolean
  activation_status?: string | null
}

export interface SupportCampusStateGroup {
  state_name: string
  total: number
  campuses: SupportCampus[]
}

export interface SupportCampusesResponse {
  message: string
  source: string
  total: number
  campuses: SupportCampus[]
  states: SupportCampusStateGroup[]
}

export interface SupportCampusesFilters {
  state?: string
  activeOnly?: boolean | 'all'
}

export interface CreateSupportCampusPayload {
  partner_id: number
  name: string
  country?: string
  state_name: string
  city?: string
  address?: string
  contact_name?: string
  email: string
  phone: string
}

const normalizeSupportCampus = (campus: any): SupportCampus => ({
  id: campus?.id,
  name: campus?.name,
  partner_id: campus?.partner_id ?? campus?.partner?.id ?? null,
  partner_name: campus?.partner_name ?? campus?.partner?.name ?? null,
  state_name: campus?.state_name ?? null,
  city: campus?.city ?? null,
  country: campus?.country ?? null,
  address: campus?.address ?? null,
  location:
    campus?.location ??
    ([campus?.city, campus?.state_name, campus?.country].filter(Boolean).join(', ') || null),
  is_active: campus?.is_active,
  activation_status: campus?.activation_status ?? null,
})

const groupCampusesByState = (campuses: SupportCampus[]): SupportCampusStateGroup[] => {
  const grouped = new Map<string, SupportCampus[]>()
  campuses.forEach((campus) => {
    const state = (campus.state_name || 'Sin estado').trim() || 'Sin estado'
    const list = grouped.get(state) || []
    list.push(campus)
    grouped.set(state, list)
  })

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state_name, campusesInState]) => ({
      state_name,
      total: campusesInState.length,
      campuses: campusesInState,
    }))
}

export interface SupportTicketFilters {
  status?: SupportTicketStatus | ''
  priority?: SupportPriority | ''
  companyId?: string
  channel?: SupportChannel | ''
  search?: string
  dateFrom?: string
  dateTo?: string
}

const previewCampusesByState: SupportCampusStateGroup[] = [
  {
    state_name: 'Aguascalientes',
    total: 2,
    campuses: [
      { id: 'ag-1', name: 'Edut Centro', state_name: 'Aguascalientes', city: 'Aguascalientes', country: 'México', is_active: true },
      { id: 'ag-2', name: 'Edut Norte', state_name: 'Aguascalientes', city: 'Aguascalientes', country: 'México', is_active: true },
    ],
  },
  {
    state_name: 'Chiapas',
    total: 2,
    campuses: [
      { id: 'ch-1', name: 'Campus Tuxtla', state_name: 'Chiapas', city: 'Tuxtla Gutiérrez', country: 'México', is_active: true },
      { id: 'ch-2', name: 'Campus San Cristóbal', state_name: 'Chiapas', city: 'San Cristóbal', country: 'México', is_active: true },
    ],
  },
  {
    state_name: 'Ciudad de México',
    total: 2,
    campuses: [
      { id: 'cdmx-1', name: 'Plantel Roma', state_name: 'Ciudad de México', city: 'Ciudad de México', country: 'México', is_active: true },
      { id: 'cdmx-2', name: 'Plantel Reforma', state_name: 'Ciudad de México', city: 'Ciudad de México', country: 'México', is_active: true },
    ],
  },
]

const buildPreviewCampusesResponse = (filters?: SupportCampusesFilters): SupportCampusesResponse => {
  const activeOnly = filters?.activeOnly ?? true
  const filteredStates = previewCampusesByState
    .map((stateItem) => {
      const campuses = stateItem.campuses.filter((campus) => {
        const matchesState = filters?.state ? campus.state_name === filters.state : true
        const matchesActive =
          activeOnly === 'all' ? true : activeOnly ? campus.is_active !== false : campus.is_active === false
        return matchesState && matchesActive
      })
      return { ...stateItem, campuses, total: campuses.length }
    })
    .filter((stateItem) => stateItem.total > 0)

  const campuses = filteredStates.flatMap((stateItem) => stateItem.campuses)
  return {
    message: campuses.length ? 'Campus obtenidos correctamente' : 'No hay campus disponibles',
    source: 'preview',
    total: campuses.length,
    campuses,
    states: filteredStates,
  }
}

const filterPreviewTickets = (tickets: SupportTicket[], filters?: SupportTicketFilters) => {
  if (!filters) return tickets
  return tickets.filter((ticket) => {
    const matchesStatus = filters.status ? ticket.status === filters.status : true
    const matchesPriority = filters.priority ? ticket.priority === filters.priority : true
    const matchesCompany = filters.companyId ? ticket.companyId === filters.companyId : true
    const matchesChannel = filters.channel ? ticket.channel === filters.channel : true
    const query = filters.search?.trim().toLowerCase() || ''
    const matchesSearch = query
      ? [
          ticket.subject,
          ticket.message,
          ticket.userName,
          ticket.userEmail,
          ticket.folio,
          ticket.companyName,
        ].some((value) => value.toLowerCase().includes(query))
      : true

    const createdAt = new Date(ticket.createdAt)
    const matchesFrom = filters.dateFrom ? createdAt >= new Date(filters.dateFrom) : true
    const matchesTo = filters.dateTo ? createdAt <= new Date(filters.dateTo) : true

    return (
      matchesStatus &&
      matchesPriority &&
      matchesCompany &&
      matchesChannel &&
      matchesSearch &&
      matchesFrom &&
      matchesTo
    )
  })
}

export const listTickets = async (filters?: SupportTicketFilters): Promise<SupportTicket[]> => {
  if (isSupportPreviewEnabled()) {
    return filterPreviewTickets(mockTickets, filters)
  }

  const response = await api.get('/support/tickets', { params: filters })
  return response.data?.tickets || response.data
}

export const getTicketById = async (ticketId: string): Promise<SupportTicket | null> => {
  if (isSupportPreviewEnabled()) {
    return mockTickets.find((ticket) => ticket.id === ticketId) || null
  }

  const response = await api.get(`/support/tickets/${ticketId}`)
  return response.data?.ticket || response.data
}

export const updateTicketStatus = async (
  ticketId: string,
  status: SupportTicketStatus,
): Promise<SupportTicket | null> => {
  if (isSupportPreviewEnabled()) {
    const ticket = mockTickets.find((item) => item.id === ticketId)
    return ticket ? { ...ticket, status, updatedAt: new Date().toISOString() } : null
  }

  const response = await api.patch(`/support/tickets/${ticketId}`, { status })
  return response.data?.ticket || response.data
}

export const addInternalNote = async (
  ticketId: string,
  message: string,
  author = 'Equipo Soporte',
): Promise<SupportTicketNote> => {
  if (isSupportPreviewEnabled()) {
    return {
      id: `note-${Math.random().toString(36).slice(2, 8)}`,
      ticketId,
      author,
      message,
      createdAt: new Date().toISOString(),
    }
  }

  const response = await api.post(`/support/tickets/${ticketId}/notes`, { message })
  return response.data?.note || response.data
}

export const listCompanies = async (): Promise<SupportCompany[]> => {
  if (isSupportPreviewEnabled()) {
    return mockCompanies
  }

  const response = await api.get('/partners', { params: { per_page: 100 } })
  if (response.data?.partners) {
    return response.data.partners.map((partner: any) => ({
      id: String(partner.id),
      name: partner.name,
      industry: partner.legal_name,
      contactEmail: partner.email,
      activeTickets: 0,
    }))
  }

  return response.data || []
}

export const listSupportCampuses = async (
  filters?: SupportCampusesFilters,
): Promise<SupportCampusesResponse> => {
  if (isSupportPreviewEnabled()) {
    return buildPreviewCampusesResponse(filters)
  }

  try {
    const response = await api.get('/support/campuses', {
      params: {
        state: filters?.state || undefined,
        active_only:
          filters?.activeOnly === 'all'
            ? 'all'
            : typeof filters?.activeOnly === 'boolean'
            ? String(filters.activeOnly)
            : undefined,
      },
    })

    const data = response.data || {}
    return {
      message: data.message || 'Campus obtenidos correctamente',
      source: data.source || 'campuses',
      total: Number(data.total || 0),
      campuses: Array.isArray(data.campuses) ? data.campuses.map(normalizeSupportCampus) : [],
      states: Array.isArray(data.states) ? data.states : [],
    }
  } catch (_error: any) {
    const partners = await listSupportPartners()
    const partnerCampusResponses = await Promise.allSettled(
      partners.map((partner) =>
        api.get(`/partners/${partner.id}/campuses`, {
          params: {
            active_only: false,
            state: filters?.state || undefined,
          },
        }),
      ),
    )

    let allCampuses: SupportCampus[] = []
    partnerCampusResponses.forEach((result, index) => {
      if (result.status !== 'fulfilled') return
      const partnerName = partners[index]?.name || null
      const rawCampuses = Array.isArray(result.value?.data?.campuses) ? result.value.data.campuses : []
      const normalized = rawCampuses.map((campus: any) => ({
        ...normalizeSupportCampus(campus),
        partner_name: campus?.partner_name || partnerName,
      }))
      allCampuses = allCampuses.concat(normalized)
    })

    if (filters?.activeOnly === true) {
      allCampuses = allCampuses.filter((campus) => campus.is_active === true)
    } else if (filters?.activeOnly === false) {
      allCampuses = allCampuses.filter((campus) => campus.is_active === false)
    }

    return {
      message: allCampuses.length ? 'Campus obtenidos correctamente' : 'No hay campus disponibles',
      source: 'partners',
      total: allCampuses.length,
      campuses: allCampuses,
      states: groupCampusesByState(allCampuses),
    }
  }
}

export const createSupportCampus = async (
  payload: CreateSupportCampusPayload,
): Promise<{ message: string; campus: SupportCampus }> => {
  try {
    const response = await api.post('/support/campuses', payload)
    return {
      message: response.data?.message || 'Campus creado correctamente',
      campus: normalizeSupportCampus(response.data?.campus),
    }
  } catch (error: any) {
    if (error?.response?.status !== 404) {
      throw error
    }

    const contactParts = (payload.contact_name || payload.name).trim().split(/\s+/).filter(Boolean)
    const director_name = contactParts[0] || 'Soporte'
    const director_first_surname = contactParts[1] || 'Operativo'
    const director_second_surname = contactParts.slice(2).join(' ') || 'Evaluaasi'

    const partnerPayload = {
      name: payload.name,
      country: payload.country || 'México',
      state_name: payload.state_name,
      city: payload.city || null,
      address: payload.address || null,
      email: payload.email,
      phone: payload.phone,
      director_name,
      director_first_surname,
      director_second_surname,
      director_email: payload.email,
      director_phone: payload.phone,
      director_curp: 'XEXX010101HNEXXXA4',
      director_gender: 'O',
      director_date_of_birth: '1990-01-01',
    }

    const response = await api.post(`/partners/${payload.partner_id}/campuses`, partnerPayload)
    return {
      message: response.data?.message || 'Campus creado correctamente',
      campus: normalizeSupportCampus(response.data?.campus),
    }
  }
}

export const listSupportPartners = async (): Promise<SupportPartnerOption[]> => {
  try {
    const response = await api.get('/support/partners')
    return Array.isArray(response.data?.partners) ? response.data.partners : []
  } catch (_error: any) {
    const response = await api.get('/partners', {
      params: { active_only: false, per_page: 300 },
    })
    const partners = Array.isArray(response.data?.partners) ? response.data.partners : []
    return partners.map((partner: any) => ({
      id: Number(partner.id),
      name: partner.name,
    }))
  }
}

export const listSupportUsers = async (params?: {
  search?: string
  role?: string
  page?: number
  per_page?: number
}): Promise<{
  users: SupportDirectoryUser[]
  total: number
  pages: number
  current_page: number
}> => {
  const response = await api.get('/support/users', {
    params: {
      search: params?.search || undefined,
      role: params?.role || undefined,
      page: params?.page || 1,
      per_page: params?.per_page || 20,
    },
  })

  return {
    users: Array.isArray(response.data?.users) ? response.data.users : [],
    total: Number(response.data?.total || 0),
    pages: Number(response.data?.pages || 0),
    current_page: Number(response.data?.current_page || 1),
  }
}

export const sendSupportUserEmail = async (params: {
  target: string
  template: 'nuevo' | 'registro' | 'reenvio' | 'confirmacion'
}): Promise<{
  message: string
  target: string
  recipient_email: string
  template: string
  subject: string
}> => {
  const response = await api.post('/support/users/send-email', {
    target: params.target,
    template: params.template,
  })

  return {
    message: response.data?.message || 'Correo enviado correctamente',
    target: response.data?.target || params.target,
    recipient_email: response.data?.recipient_email || params.target,
    template: response.data?.template || params.template,
    subject: response.data?.subject || '',
  }
}

export const listSupportCalendarSessions = async (params?: {
  month?: string
  partner_id?: number
  campus_id?: number
}): Promise<SupportCalendarResponse> => {
  const response = await api.get('/support/calendar/sessions', {
    params: {
      month: params?.month || undefined,
      partner_id: params?.partner_id || undefined,
      campus_id: params?.campus_id || undefined,
    },
  })

  return {
    message: response.data?.message || 'Sesiones obtenidas correctamente',
    source: response.data?.source || 'results',
    month: response.data?.month,
    total: Number(response.data?.total || 0),
    events: Array.isArray(response.data?.events) ? response.data.events : [],
  }
}
