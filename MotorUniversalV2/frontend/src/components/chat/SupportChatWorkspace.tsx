import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Send,
  MessageSquare,
  UserPlus,
  RefreshCcw,
  CircleDot,
  Search,
  UserRound,
  Mail,
  CheckCheck,
  Lock,
  RotateCcw,
  Star,
  ExternalLink,
  X,
  Phone,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { loadSupportSettings, subscribeSupportSettings } from '../../support/supportSettings'
import {
  supportChatService,
  type SupportChatConversation,
  type SupportChatMessage,
  type SupportConversationStatus,
} from '../../services/supportChatService'
import type { SupportDirectoryUser } from '../../services/supportService'

type ChatMode = 'candidate' | 'support'

interface Props {
  mode: ChatMode
}

const POLL_INTERVAL_MS = 7000
const MESSAGE_MAX_LENGTH = 4000

const getSupportAvailabilityStatus = (settings: ReturnType<typeof loadSupportSettings>) => {
  if (!settings.supportAvailabilityEnabled) {
    return {
      isAvailable: true,
      dayOfWeek: null as number | null,
      currentMinutes: null as number | null,
    }
  }

  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: settings.supportTimezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }

    const weekday = weekdayMap[parts.find((part) => part.type === 'weekday')?.value || '']
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
    const currentMinutes = hour * 60 + minute

    const [startHour, startMinute] = settings.supportStartHour.split(':').map((value) => Number(value || 0))
    const [endHour, endMinute] = settings.supportEndHour.split(':').map((value) => Number(value || 0))
    const startTotal = startHour * 60 + startMinute
    const endTotal = endHour * 60 + endMinute

    const isWorkingDay = settings.supportWeekdays.includes(weekday)
    const isAvailable = isWorkingDay && currentMinutes >= startTotal && currentMinutes < endTotal

    return {
      isAvailable,
      dayOfWeek: weekday,
      currentMinutes,
    }
  } catch {
    return {
      isAvailable: true,
      dayOfWeek: null as number | null,
      currentMinutes: null as number | null,
    }
  }
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const shortName = (name?: string | null) => {
  if (!name) return 'U'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return 'U'
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase()
}

const candidateLabel = (conversation: SupportChatConversation, isSupportMode: boolean) => {
  if (!isSupportMode) return conversation.subject || `Conversación #${conversation.id}`
  return conversation.candidate?.full_name || conversation.candidate?.username || `Candidato #${conversation.id}`
}

const statusColor: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  resolved: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
}

const satisfactionLabel: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
}

const SupportChatWorkspace = ({ mode }: Props) => {
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [conversations, setConversations] = useState<SupportChatConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<SupportChatMessage[]>([])
  const [messageText, setMessageText] = useState('')

  const [statusFilter, setStatusFilter] = useState<SupportConversationStatus | 'all'>(
    mode === 'support' ? 'open' : 'all'
  )

  const [newSubject, setNewSubject] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidateResults, setCandidateResults] = useState<SupportDirectoryUser[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [coordinatorResults, setCoordinatorResults] = useState<SupportDirectoryUser[]>([])
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('')
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [surveyRating, setSurveyRating] = useState<number>(5)
  const [surveyComment, setSurveyComment] = useState('')
  const [submittingSurvey, setSubmittingSurvey] = useState(false)
  const [dismissedSurveyConversationIds, setDismissedSurveyConversationIds] = useState<number[]>([])
  const [surveyInitializedForConversationId, setSurveyInitializedForConversationId] = useState<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [supportSettings, setSupportSettings] = useState(() => loadSupportSettings())
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  )
  const isSupportMode = mode === 'support'
  const normalizedRole = String(user?.role || '').toLowerCase()
  const isSupportLike = ['soporte', 'admin', 'developer'].includes(normalizedRole)
  const isCoordinatorMode = normalizedRole === 'coordinator'
  const totalUnread = useMemo(
    () =>
      conversations.reduce((acc, conv) => {
        if (isSupportLike && conv.current_handler_role === 'coordinator') return acc
        return acc + Number(conv.unread_count || 0)
      }, 0),
    [conversations, isSupportLike]
  )
  const visibleConversations = useMemo(() => {
    if (!isSupportLike) return conversations
    if (statusFilter !== 'open') return conversations
    return conversations.filter((conversation) => conversation.current_handler_role !== 'coordinator')
  }, [conversations, isSupportLike, statusFilter])
  const canResolve = selectedConversation && selectedConversation.status === 'open'
  const canClose = selectedConversation && isSupportLike && selectedConversation.status !== 'closed'
  const canReopen =
    selectedConversation &&
    ((isSupportLike && selectedConversation.status !== 'open') ||
      (!isSupportLike && selectedConversation.status === 'resolved'))
  const surveyPendingForCandidate =
    !isSupportMode &&
    Boolean(selectedConversation?.survey_pending) &&
    !selectedConversation?.satisfaction

  const ratingSummary = selectedConversation?.satisfaction
    ? `${selectedConversation.satisfaction.rating}/5 ${satisfactionLabel[selectedConversation.satisfaction.rating]}`
    : null
  const selectedCandidateName = selectedConversation
    ? candidateLabel(selectedConversation, isSupportMode)
    : ''
  const remainingMessageCharacters = MESSAGE_MAX_LENGTH - messageText.length
  const supportAvailability = getSupportAvailabilityStatus(supportSettings)
  const candidateChatBlocked = !isSupportMode && !supportAvailability.isAvailable
  const candidateTransferredToCoordinator =
    !isSupportMode && selectedConversation?.current_handler_role === 'coordinator'
  const supportConversationTransferred =
    isSupportLike && selectedConversation?.current_handler_role === 'coordinator'

  useEffect(() => subscribeSupportSettings(setSupportSettings), [])

  useEffect(() => {
    if (!isSupportLike) return

    const loadCoordinators = async () => {
      try {
        const users = await supportChatService.searchCoordinators('')
        setCoordinatorResults(users)
      } catch {
        setCoordinatorResults([])
      }
    }

    loadCoordinators()
  }, [isSupportLike])
  const loadConversations = async (keepSelection = true) => {
    try {
      setLoading(true)
      setError(null)

      const response = await supportChatService.listConversations({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        per_page: 50,
      })

      setConversations(response.conversations)

      if (!keepSelection || !selectedConversationId) {
        const nextConversations =
          isSupportLike && statusFilter === 'open'
            ? response.conversations.filter((conversation) => conversation.current_handler_role !== 'coordinator')
            : response.conversations
        setSelectedConversationId(nextConversations[0]?.id || null)
        return
      }

      const nextConversations =
        isSupportLike && statusFilter === 'open'
          ? response.conversations.filter((conversation) => conversation.current_handler_role !== 'coordinator')
          : response.conversations
      const exists = nextConversations.some((item) => item.id === selectedConversationId)
      if (!exists) setSelectedConversationId(nextConversations[0]?.id || null)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron cargar las conversaciones')
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: number) => {
    try {
      const response = await supportChatService.listMessages(conversationId, { page: 1, per_page: 120 })
      setMessages(response.messages)
      const lastMessageId = response.messages[response.messages.length - 1]?.id
      if (lastMessageId) await supportChatService.markRead(conversationId, lastMessageId)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo cargar el historial')
    }
  }

  useEffect(() => {
    loadConversations(false)
  }, [statusFilter])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }
    loadMessages(selectedConversationId)
  }, [selectedConversationId])

  useEffect(() => {
    setStatusFilter(mode === 'support' ? 'open' : 'all')
  }, [mode])

  useEffect(() => {
    const interval = window.setInterval(async () => {
      await loadConversations(true)
      if (selectedConversationId) await loadMessages(selectedConversationId)
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [selectedConversationId, statusFilter])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedConversationId])

  useEffect(() => {
    if (!selectedConversation || isSupportMode || !surveyPendingForCandidate) {
      setSurveyOpen(false)
      setSurveyInitializedForConversationId(null)
      return
    }

    if (dismissedSurveyConversationIds.includes(selectedConversation.id)) return

    if (surveyInitializedForConversationId !== selectedConversation.id) {
      setSurveyRating(selectedConversation.satisfaction?.rating || 5)
      setSurveyComment(selectedConversation.satisfaction?.comment || '')
      setSurveyInitializedForConversationId(selectedConversation.id)
    }

    setSurveyOpen(true)
  }, [
    dismissedSurveyConversationIds,
    isSupportMode,
    selectedConversation,
    surveyInitializedForConversationId,
    surveyPendingForCandidate,
  ])

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedConversationId || !messageText.trim()) return

    try {
      setSending(true)
      setError(null)

      await supportChatService.sendMessage(selectedConversationId, {
        content: messageText.trim(),
      })

      setMessageText('')
      await loadMessages(selectedConversationId)
      await loadConversations(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  const handleCreateConversation = async (event: FormEvent) => {
    event.preventDefault()

    try {
      setCreating(true)
      setError(null)

      const payload: any = { subject: newSubject.trim() || undefined }

      if (mode === 'support') {
        if (!selectedCandidateId) {
          setError('Selecciona un candidato para crear la conversación')
          return
        }
        payload.candidate_user_id = selectedCandidateId
      }

      const conversation = await supportChatService.createConversation(payload)
      setNewSubject('')
      setCandidateSearch('')
      setCandidateResults([])
      setSelectedCandidateId('')

      await loadConversations(true)
      setSelectedConversationId(conversation.id)
      await loadMessages(conversation.id)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo crear la conversación')
    } finally {
      setCreating(false)
    }
  }

  const handleCandidateSearch = async () => {
    if (mode !== 'support') return
    try {
      const users = await supportChatService.searchCandidates(candidateSearch.trim())
      setCandidateResults(users)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron consultar candidatos')
    }
  }

  const handleStatusChange = async (status: SupportConversationStatus) => {
    if (!selectedConversationId) return
    try {
      setUpdatingStatus(true)
      setError(null)
      await supportChatService.updateConversationStatus(selectedConversationId, status)
      await loadConversations(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo actualizar el estado')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleTransferToCoordinator = async () => {
    if (!selectedConversationId || !selectedCoordinatorId) return
    try {
      setTransferring(true)
      setError(null)
      await supportChatService.transferConversation(selectedConversationId, {
        target_role: 'coordinator',
        target_user_id: selectedCoordinatorId,
      })
      setSelectedCoordinatorId('')
      await loadConversations(true)
      await loadMessages(selectedConversationId)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo derivar la conversación')
    } finally {
      setTransferring(false)
    }
  }

  const handleReturnToSupport = async () => {
    if (!selectedConversationId) return
    try {
      setTransferring(true)
      setError(null)
      await supportChatService.transferConversation(selectedConversationId, {
        target_role: 'support',
        target_user_id: selectedConversation?.assigned_support_user_id || undefined,
      })
      await loadConversations(true)
      await loadMessages(selectedConversationId)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo regresar la conversación a soporte')
    } finally {
      setTransferring(false)
    }
  }

  const handleSubmitSurvey = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedConversationId) return

    try {
      setSubmittingSurvey(true)
      setError(null)
      await supportChatService.submitConversationSatisfaction(selectedConversationId, {
        rating: surveyRating,
        comment: surveyComment.trim() || undefined,
      })
      setSurveyOpen(false)
      setSurveyInitializedForConversationId(null)
      setDismissedSurveyConversationIds((prev) =>
        selectedConversationId ? prev.filter((item) => item !== selectedConversationId) : prev,
      )
      await loadConversations(true)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar la encuesta')
    } finally {
      setSubmittingSurvey(false)
    }
  }

  const handleOpenProfile = async () => {
    setProfileOpen(true)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-gradient-to-r from-primary-600 to-blue-600 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary-100">Mensajería</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {isSupportMode ? 'Centro de chat de soporte' : 'Chat con soporte'}
            </h2>
            <p className="mt-1 text-sm text-primary-100">
              {isSupportMode
                ? 'Gestiona conversaciones activas y responde con seguimiento continuo.'
                : 'Comunícate con el equipo de soporte y revisa respuestas en el mismo hilo.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-primary-100">No leídos</p>
              <p className="text-xl font-semibold">{totalUnread}</p>
            </div>
            <button
              type="button"
              onClick={() => loadConversations(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {!isCoordinatorMode && (
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleCreateConversation} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Asunto</label>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              disabled={creating || candidateChatBlocked}
              placeholder="Ej. Duda con evaluación"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {isSupportMode && (
            <>
              <div className="md:col-span-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Buscar candidato</label>
                <div className="flex gap-2">
                  <input
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Nombre, email o CURP"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCandidateSearch}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Search className="h-4 w-4" />
                    Buscar
                  </button>
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Candidato</label>
                <select
                  value={selectedCandidateId}
                  onChange={(e) => setSelectedCandidateId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Selecciona</option>
                  {candidateResults.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.full_name} ({candidate.username})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="md:col-span-12 flex justify-end">
            <button
              type="submit"
              disabled={creating || candidateChatBlocked}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {creating ? 'Creando...' : 'Nueva conversación'}
            </button>
          </div>
        </form>
        {candidateChatBlocked && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {supportSettings.supportOfflineMessage}
          </div>
        )}
      </section>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="lg:col-span-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Conversaciones</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SupportConversationStatus | 'all')}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="all">Todas</option>
                <option value="open">Abiertas</option>
                <option value="resolved">Resueltas</option>
                <option value="closed">Cerradas</option>
              </select>
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {loading && visibleConversations.length === 0 && (
              <p className="p-4 text-sm text-gray-500">Cargando conversaciones...</p>
            )}

            {!loading && visibleConversations.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No hay conversaciones en este filtro.</p>
            )}

            {visibleConversations.map((conversation) => {
              const selected = selectedConversationId === conversation.id
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full border-b border-gray-100 p-3 text-left transition ${
                    selected ? 'bg-primary-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {shortName(conversation.subject || `C ${conversation.id}`)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-800">
                          {candidateLabel(conversation, isSupportMode)}
                        </p>
                        <div className="space-y-0.5">
                          {isSupportMode && (
                            <p className="truncate text-xs text-gray-500">
                              {conversation.subject || 'Sin asunto'}
                            </p>
                          )}
                          <p className="truncate text-xs text-gray-500">
                            {conversation.last_message?.content || 'Sin mensajes todavía'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {Boolean(conversation.unread_count) && (
                      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                    <span className={`rounded-full border px-2 py-0.5 ${statusColor[conversation.status] || 'bg-gray-100'}`}>
                      {conversation.status}
                    </span>
                    <div className="flex items-center gap-2">
                      {conversation.satisfaction && (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Star className="h-3 w-3 fill-current" />
                          {conversation.satisfaction.rating}
                        </span>
                      )}
                      <span>{formatDateTime(conversation.last_message_at)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="lg:col-span-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {!selectedConversation ? (
            <div className="flex h-[600px] flex-col items-center justify-center gap-3 text-center text-gray-500">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">Selecciona una conversación para iniciar.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">
                        {selectedCandidateName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {isSupportMode && selectedConversation.subject && <span>Asunto: {selectedConversation.subject}</span>}
                        <span>Última actividad: {formatDateTime(selectedConversation.last_message_at)}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColor[selectedConversation.status] || 'bg-gray-100'}`}>
                    {selectedConversation.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canResolve && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('resolved')}
                      disabled={updatingStatus}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar resuelta
                    </button>
                  )}
                  {canClose && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('closed')}
                      disabled={updatingStatus}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Cerrar conversación
                    </button>
                  )}
                  {canReopen && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('open')}
                      disabled={updatingStatus}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reabrir
                    </button>
                  )}
                  {isSupportMode && (
                    <button
                      type="button"
                      onClick={handleOpenProfile}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver perfil
                    </button>
                  )}
                  {isSupportLike && (
                    <>
                      <select
                        value={selectedCoordinatorId}
                        onChange={(e) => setSelectedCoordinatorId(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700"
                      >
                        <option value="">Selecciona coordinador</option>
                        {coordinatorResults.map((coordinator) => (
                          <option key={coordinator.id} value={coordinator.id}>
                            {coordinator.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleTransferToCoordinator}
                        disabled={transferring || !selectedCoordinatorId || supportConversationTransferred}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                      >
                        Derivar a coordinador
                      </button>
                    </>
                  )}
                  {isCoordinatorMode && selectedConversation.current_handler_role === 'coordinator' && (
                    <button
                      type="button"
                      onClick={handleReturnToSupport}
                      disabled={transferring}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                    >
                      Regresar a soporte
                    </button>
                  )}
                </div>
                {isSupportLike &&
                  selectedConversation.current_handler_role === 'coordinator' &&
                  selectedConversation.assigned_coordinator_user && (
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                    Conversación en seguimiento con el coordinador {selectedConversation.assigned_coordinator_user.full_name}. En soporte dejará de verse en `Abiertas` y pasará a `Todas`.
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {selectedConversation.satisfaction ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {ratingSummary}
                      </span>
                      <span>Encuesta respondida el {formatDateTime(selectedConversation.satisfaction.submitted_at)}</span>
                      {selectedConversation.satisfaction.comment && (
                        <span className="text-gray-700">"{selectedConversation.satisfaction.comment}"</span>
                      )}
                    </div>
                  ) : selectedConversation.survey_pending ? (
                    <p>Encuesta pendiente de respuesta del cliente.</p>
                  ) : (
                    <p>Sin encuesta de satisfacción todavía.</p>
                  )}
                </div>
              </div>

              <div className="h-[470px] space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4">
                {candidateTransferredToCoordinator && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 shadow-sm">
                    Se te dirigio a un coordinador. Tu conversación seguirá en este mismo chat.
                  </div>
                )}
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500">Aún no hay mensajes.</p>
                ) : (
                  messages.map((msg) => {
                    if (msg.message_type === 'system') {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="max-w-[82%] rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-center text-xs text-violet-800 shadow-sm">
                            <p>{msg.content}</p>
                            <p className="mt-1 text-[11px] text-violet-600">{formatDateTime(msg.created_at)}</p>
                          </div>
                        </div>
                      )
                    }
                    const mine = msg.sender_user_id === user?.id
                    return (
                      <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                              mine
                                ? 'bg-primary-600 text-white rounded-br-md'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                            }`}
                          >
                            {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                            {msg.attachment?.url && (
                              <a
                                href={msg.attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-2 inline-flex items-center gap-1 text-xs underline ${
                                  mine ? 'text-primary-100' : 'text-primary-600'
                                }`}
                              >
                                <Mail className="h-3 w-3" />
                                Ver adjunto
                              </a>
                            )}
                          </div>
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <CircleDot className="h-2.5 w-2.5" />
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="border-t border-gray-100 bg-white p-4">
                <div className="flex gap-2">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    maxLength={MESSAGE_MAX_LENGTH}
                    placeholder={
                      selectedConversation.status === 'closed'
                        ? 'La conversación está cerrada'
                        : supportConversationTransferred
                          ? 'La conversación fue derivada a coordinador'
                        : candidateChatBlocked
                          ? 'El soporte no se encuentra disponible en este horario'
                          : 'Escribe tu mensaje...'
                    }
                    rows={2}
                    disabled={selectedConversation.status === 'closed' || candidateChatBlocked || supportConversationTransferred}
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                  <button
                    type="submit"
                    disabled={selectedConversation.status === 'closed' || candidateChatBlocked || supportConversationTransferred || sending || !messageText.trim()}
                    className="inline-flex h-fit items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-start text-xs">
                  <p
                    className={
                      remainingMessageCharacters <= 0
                        ? 'font-semibold text-amber-600'
                        : remainingMessageCharacters <= MESSAGE_MAX_LENGTH * 0.15
                          ? 'font-medium text-gray-700'
                          : 'text-gray-400'
                    }
                  >
                    ({remainingMessageCharacters.toLocaleString('es-MX')})
                  </p>
                </div>
                {selectedConversation.status === 'closed' && (
                  <p className="mt-2 text-xs text-gray-500">Reabre la conversación para volver a enviar mensajes.</p>
                )}
                {supportConversationTransferred && (
                  <p className="mt-2 text-xs text-violet-700">
                    Esta conversación está en manos del coordinador. Si necesitas revisar el historial, cámbiala al filtro `Todas`.
                  </p>
                )}
                {candidateChatBlocked && (
                  <p className="mt-2 text-xs text-amber-700">{supportSettings.supportOfflineMessage}</p>
                )}
              </form>
            </>
          )}
        </section>
      </div>

      {surveyOpen && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">Encuesta</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">Califica la atención recibida</h3>
                <p className="mt-1 text-sm text-gray-600">
                  La conversación ya fue {selectedConversation.status === 'closed' ? 'cerrada' : 'resuelta'}.
                  Cuéntanos cómo fue tu experiencia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSurveyOpen(false)
                  setSurveyInitializedForConversationId(null)
                  setDismissedSurveyConversationIds((prev) =>
                    selectedConversationId && !prev.includes(selectedConversationId)
                      ? [...prev, selectedConversationId]
                      : prev,
                  )
                }}
                className="text-sm font-medium text-gray-400 hover:text-gray-600"
              >
                Después
              </button>
            </div>

            <form onSubmit={handleSubmitSurvey} className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Nivel de satisfacción</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const active = value <= surveyRating
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSurveyRating(value)}
                        className={`flex flex-1 flex-col items-center rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                          active
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <Star className={`mb-1 h-5 w-5 ${active ? 'fill-current' : ''}`} />
                        {value}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">{satisfactionLabel[surveyRating]}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Comentario opcional</label>
                <textarea
                  value={surveyComment}
                  onChange={(e) => setSurveyComment(e.target.value)}
                  rows={4}
                  placeholder="¿Qué salió bien o qué podríamos mejorar?"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingSurvey}
                className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {submittingSurvey ? 'Guardando...' : 'Enviar encuesta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 p-3 sm:p-5">
          <div className="flex h-full w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="flex items-start justify-between border-b border-gray-100/80 bg-white/90 px-5 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Perfil</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">
                  {selectedConversation?.candidate?.full_name || selectedCandidateName || 'Candidato'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/90 via-white to-white px-5 py-5">
              <div className="space-y-5">
                <div className="rounded-[24px] border border-primary-400/30 bg-gradient-to-br from-primary-600 via-blue-600 to-sky-500 px-4 py-5 text-white shadow-lg shadow-primary-900/10">
                  <p className="text-lg font-semibold">
                    {selectedConversation?.candidate?.full_name || selectedCandidateName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-primary-50">
                    <span className="rounded-full bg-white/15 px-2.5 py-1">
                      {selectedConversation?.candidate?.role || 'candidato'}
                    </span>
                    <span className="rounded-full bg-white/15 px-2.5 py-1">
                      @{selectedConversation?.candidate?.username || 'sin-usuario'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos de contacto</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {selectedConversation?.candidate?.email || 'Sin email'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {selectedConversation?.candidate?.phone || 'Sin teléfono'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Identidad</p>
                  <div className="grid gap-3 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-gray-900">Nombre completo:</span>{' '}
                      {selectedConversation?.candidate?.full_name || selectedCandidateName}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">CURP:</span>{' '}
                      {selectedConversation?.candidate?.curp || 'Sin CURP'}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-900">ID de usuario:</span>{' '}
                      {selectedConversation?.candidate?.id || selectedConversation?.candidate_user_id || 'Sin ID'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupportChatWorkspace
