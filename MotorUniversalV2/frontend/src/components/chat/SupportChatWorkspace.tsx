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
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
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

const statusColor: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  resolved: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
}

const SupportChatWorkspace = ({ mode }: Props) => {
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [conversations, setConversations] = useState<SupportChatConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<SupportChatMessage[]>([])
  const [messageText, setMessageText] = useState('')

  const [statusFilter, setStatusFilter] = useState<SupportConversationStatus | 'all'>('open')

  const [newSubject, setNewSubject] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidateResults, setCandidateResults] = useState<SupportDirectoryUser[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState('')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  )

  const totalUnread = useMemo(
    () => conversations.reduce((acc, conv) => acc + Number(conv.unread_count || 0), 0),
    [conversations]
  )
  const isSupportLike = ['soporte', 'admin', 'developer'].includes(String(user?.role || '').toLowerCase())
  const canResolve = selectedConversation && selectedConversation.status === 'open'
  const canClose = selectedConversation && isSupportLike && selectedConversation.status !== 'closed'
  const canReopen =
    selectedConversation &&
    ((isSupportLike && selectedConversation.status !== 'open') ||
      (!isSupportLike && selectedConversation.status === 'resolved'))

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
        setSelectedConversationId(response.conversations[0]?.id || null)
        return
      }

      const exists = response.conversations.some((item) => item.id === selectedConversationId)
      if (!exists) setSelectedConversationId(response.conversations[0]?.id || null)
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
    const interval = window.setInterval(async () => {
      await loadConversations(true)
      if (selectedConversationId) await loadMessages(selectedConversationId)
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [selectedConversationId, statusFilter])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedConversationId])

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

  const isSupportMode = mode === 'support'

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

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleCreateConversation} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Asunto</label>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
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
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {creating ? 'Creando...' : 'Nueva conversación'}
            </button>
          </div>
        </form>
      </section>

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
            {loading && conversations.length === 0 && (
              <p className="p-4 text-sm text-gray-500">Cargando conversaciones...</p>
            )}

            {!loading && conversations.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No hay conversaciones en este filtro.</p>
            )}

            {conversations.map((conversation) => {
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
                          {conversation.subject || `Conversación #${conversation.id}`}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {conversation.last_message?.content || 'Sin mensajes todavía'}
                        </p>
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
                    <span>{formatDateTime(conversation.last_message_at)}</span>
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
                        {selectedConversation.subject || `Conversación #${selectedConversation.id}`}
                      </h3>
                      <p className="text-xs text-gray-500">Última actividad: {formatDateTime(selectedConversation.last_message_at)}</p>
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
                </div>
              </div>

              <div className="h-[470px] space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500">Aún no hay mensajes.</p>
                ) : (
                  messages.map((msg) => {
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
                    placeholder={selectedConversation.status === 'closed' ? 'La conversación está cerrada' : 'Escribe tu mensaje...'}
                    rows={2}
                    disabled={selectedConversation.status === 'closed'}
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                  />
                  <button
                    type="submit"
                    disabled={selectedConversation.status === 'closed' || sending || !messageText.trim()}
                    className="inline-flex h-fit items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </button>
                </div>
                {selectedConversation.status === 'closed' && (
                  <p className="mt-2 text-xs text-gray-500">Reabre la conversación para volver a enviar mensajes.</p>
                )}
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default SupportChatWorkspace
