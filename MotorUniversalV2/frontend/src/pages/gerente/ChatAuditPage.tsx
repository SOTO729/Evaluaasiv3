import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquare,
  RefreshCw,
  Search,
  UserRound,
  CircleDot,
  Star,
  Lock,
  Mail,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  supportChatService,
  type SupportChatConversation,
  type SupportChatMessage,
  type SupportConversationStatus,
} from '../../services/supportChatService'

const AUDIT_ROLES = ['gerente', 'soporte', 'admin', 'developer', 'coordinator']
const MESSAGES_PER_PAGE = 120

const statusColor: Record<string, string> = {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  resolved: 'border-blue-200 bg-blue-50 text-blue-700',
  closed: 'border-slate-200 bg-slate-100 text-slate-600',
}
const statusLabel: Record<string, string> = {
  open: 'Abierta',
  resolved: 'Resuelta',
  closed: 'Cerrada',
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function shortName(text: string): string {
  const words = text.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

function candidateLabel(conv: SupportChatConversation): string {
  if (conv.candidate?.full_name) return conv.candidate.full_name
  if (conv.candidate?.username) return conv.candidate.username
  return `Candidato #${conv.candidate_user_id?.slice(0, 8) || conv.id}`
}

function senderName(msg: SupportChatMessage, conv: SupportChatConversation): string {
  if (msg.sender_user_id === conv.candidate_user_id) {
    return conv.candidate?.full_name || conv.candidate?.username || 'Candidato'
  }
  if (msg.sender_user_id === conv.assigned_support_user_id) {
    return conv.assigned_support_user?.full_name || conv.assigned_support_user?.username || 'Soporte'
  }
  if (msg.sender_user_id === conv.assigned_coordinator_user_id) {
    return conv.assigned_coordinator_user?.full_name || conv.assigned_coordinator_user?.username || 'Coordinador'
  }
  return 'Sistema'
}

export default function ChatAuditPage() {
  const { user } = useAuthStore()
  const normalizedRole = String(user?.role || '').toLowerCase()

  // State
  const [conversations, setConversations] = useState<SupportChatConversation[]>([])
  const [messages, setMessages] = useState<SupportChatMessage[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState<SupportConversationStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalConversations, setTotalConversations] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  )

  // Guard
  if (!AUDIT_ROLES.includes(normalizedRole)) {
    return <Navigate to="/dashboard" replace />
  }

  const loadConversations = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true)
        setError(null)

        const response = await supportChatService.listConversations({
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          per_page: 30,
        })

        setConversations(response.conversations)
        setTotalPages(response.pages || 1)
        setTotalConversations(response.total || 0)
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Error al cargar conversaciones')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [statusFilter, page],
  )

  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setMessagesLoading(true)
      const response = await supportChatService.listMessages(conversationId, {
        page: 1,
        per_page: MESSAGES_PER_PAGE,
      })
      setMessages(response.messages)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al cargar mensajes')
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      return
    }
    loadMessages(selectedConversationId)
  }, [selectedConversationId, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedConversationId])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
    setSelectedConversationId(null)
  }, [statusFilter])

  const handleRefresh = () => {
    setRefreshing(true)
    loadConversations(true)
    if (selectedConversationId) loadMessages(selectedConversationId)
  }

  // Filter conversations by search query (client-side)
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(
      (c) =>
        candidateLabel(c).toLowerCase().includes(q) ||
        (c.subject || '').toLowerCase().includes(q) ||
        (c.candidate?.username || '').toLowerCase().includes(q) ||
        (c.candidate?.email || '').toLowerCase().includes(q),
    )
  }, [conversations, searchQuery])

  return (
    <div className="fluid-px-6 fluid-py-6 space-y-5">
      {/* Header */}
      <section className="rounded-fluid-2xl border border-gray-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 fluid-p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/gerente"
              className="inline-flex items-center justify-center rounded-fluid-lg bg-white/15 p-2 hover:bg-white/25 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-200" />
                <p className="fluid-text-xs uppercase tracking-[0.2em] text-blue-100">Auditoría</p>
              </div>
              <h2 className="mt-1 fluid-text-2xl font-semibold">Chat de Soporte</h2>
              <p className="mt-1 fluid-text-sm text-blue-100">
                Vista de solo lectura de todas las conversaciones de soporte.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-fluid-xl bg-white/15 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-wide text-blue-100">Total</p>
              <p className="text-xl font-semibold">{totalConversations}</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-fluid-lg border border-white/30 bg-white/10 px-3 py-2 fluid-text-sm font-medium text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-fluid-xl border border-red-200 bg-red-50 px-3 py-2 fluid-text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <section className="rounded-fluid-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="fluid-text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</label>
            <div className="flex gap-1">
              {(['all', 'open', 'resolved', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-fluid-lg px-3 py-1.5 fluid-text-xs font-medium transition ${
                    statusFilter === s
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'all' ? 'Todas' : statusLabel[s] || s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, usuario, email o asunto..."
                className="w-full rounded-fluid-lg border border-gray-300 pl-9 pr-3 py-2 fluid-text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Conversations list */}
          <section className="lg:col-span-4 overflow-hidden rounded-fluid-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-3">
              <h3 className="fluid-text-sm font-semibold text-gray-800">
                Conversaciones ({filteredConversations.length})
              </h3>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {filteredConversations.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-gray-500">
                  <MessageSquare className="h-8 w-8 text-gray-300" />
                  <p className="fluid-text-sm">No hay conversaciones con este filtro.</p>
                </div>
              )}

              {filteredConversations.map((conv) => {
                const selected = selectedConversationId === conv.id
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full border-b border-gray-100 p-3 text-left transition ${
                      selected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {shortName(candidateLabel(conv))}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate fluid-text-sm font-semibold text-gray-800">
                            {candidateLabel(conv)}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {conv.subject || 'Sin asunto'}
                          </p>
                          <p className="truncate text-xs text-gray-400">
                            {conv.last_message?.content || 'Sin mensajes'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span
                        className={`rounded-full border px-2 py-0.5 ${statusColor[conv.status] || 'bg-gray-100'}`}
                      >
                        {statusLabel[conv.status] || conv.status}
                      </span>
                      <div className="flex items-center gap-2">
                        {conv.satisfaction && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Star className="h-3 w-3 fill-current" />
                            {conv.satisfaction.rating}
                          </span>
                        )}
                        <span>{formatDateTime(conv.last_message_at)}</span>
                      </div>
                    </div>
                    {conv.current_handler_role === 'coordinator' && (
                      <p className="mt-1 text-[10px] text-violet-600">
                        En seguimiento por coordinador
                        {conv.assigned_coordinator_user?.full_name
                          ? `: ${conv.assigned_coordinator_user.full_name}`
                          : ''}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                <span className="text-xs text-gray-500">
                  Pág. {page} de {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Message viewer (read-only) */}
          <section className="lg:col-span-8 overflow-hidden rounded-fluid-2xl border border-gray-200 bg-white shadow-sm">
            {!selectedConversation ? (
              <div className="flex h-[600px] flex-col items-center justify-center gap-3 text-center text-gray-500">
                <Eye className="h-10 w-10 text-gray-300" />
                <p className="fluid-text-sm">Selecciona una conversación para ver su historial.</p>
                <p className="text-xs text-gray-400">Vista de solo lectura</p>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="fluid-text-sm font-semibold text-gray-800">
                          {candidateLabel(selectedConversation)}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          {selectedConversation.subject && (
                            <span>Asunto: {selectedConversation.subject}</span>
                          )}
                          {selectedConversation.candidate?.username && (
                            <span>@{selectedConversation.candidate.username}</span>
                          )}
                          {selectedConversation.candidate?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {selectedConversation.candidate.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        statusColor[selectedConversation.status] || 'bg-gray-100'
                      }`}
                    >
                      {statusLabel[selectedConversation.status] || selectedConversation.status}
                    </span>
                  </div>

                  {/* Metadata bar */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-fluid-lg bg-gray-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">Creada</p>
                      <p className="text-xs text-gray-700">{formatDateTime(selectedConversation.created_at)}</p>
                    </div>
                    <div className="rounded-fluid-lg bg-gray-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">Último msg</p>
                      <p className="text-xs text-gray-700">{formatDateTime(selectedConversation.last_message_at)}</p>
                    </div>
                    <div className="rounded-fluid-lg bg-gray-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">Soporte</p>
                      <p className="text-xs text-gray-700 truncate">
                        {selectedConversation.assigned_support_user?.full_name || 'Sin asignar'}
                      </p>
                    </div>
                    <div className="rounded-fluid-lg bg-gray-50 px-3 py-2 text-center">
                      <p className="text-[10px] font-semibold uppercase text-gray-400">Satisfacción</p>
                      <p className="text-xs text-gray-700">
                        {selectedConversation.satisfaction ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <Star className="h-3 w-3 fill-current" />
                            {selectedConversation.satisfaction.rating}/5
                          </span>
                        ) : (
                          'Pendiente'
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedConversation.satisfaction?.comment && (
                    <div className="mt-2 rounded-fluid-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                      <span className="font-semibold">Comentario del candidato:</span>{' '}
                      "{selectedConversation.satisfaction.comment}"
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="h-[420px] space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="fluid-text-sm text-gray-500 text-center py-12">No hay mensajes en esta conversación.</p>
                  ) : (
                    messages.map((msg) => {
                      if (msg.message_type === 'system') {
                        return (
                          <div key={msg.id} className="flex justify-center">
                            <div className="max-w-[82%] rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-center text-xs text-violet-800 shadow-sm">
                              <p>{msg.content}</p>
                              <p className="mt-1 text-[11px] text-violet-600">
                                {formatDateTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        )
                      }
                      const isCandidate = msg.sender_user_id === selectedConversation.candidate_user_id
                      const sender = senderName(msg, selectedConversation)
                      return (
                        <div key={msg.id} className={`flex ${isCandidate ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[82%] ${isCandidate ? 'items-start' : 'items-end'} flex flex-col`}>
                            <p className="mb-0.5 text-[10px] font-semibold text-gray-500">{sender}</p>
                            <div
                              className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                isCandidate
                                  ? 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                                  : 'bg-indigo-600 text-white rounded-br-md'
                              }`}
                            >
                              {msg.content && (
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              )}
                              {msg.attachment?.url && (
                                <a
                                  href={msg.attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`mt-2 inline-flex items-center gap-1 text-xs underline ${
                                    isCandidate ? 'text-indigo-600' : 'text-indigo-100'
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

                {/* Read-only footer */}
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Lock className="h-3.5 w-3.5" />
                    <span>Vista de solo lectura — Modo auditoría</span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
