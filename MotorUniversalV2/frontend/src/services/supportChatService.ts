import api from './api'
import { listSupportUsers, type SupportDirectoryUser } from './supportService'

export type SupportConversationStatus = 'open' | 'resolved' | 'closed'

export interface ChatAttachment {
  url: string
  name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
}

export interface SupportChatMessage {
  id: number
  conversation_id: number
  sender_user_id: string
  content?: string | null
  message_type: 'text' | 'attachment'
  attachment?: ChatAttachment | null
  created_at: string
  edited_at?: string | null
}

export interface SupportChatConversation {
  id: number
  candidate_user_id: string
  assigned_support_user_id?: string | null
  subject?: string | null
  status: SupportConversationStatus
  priority: 'low' | 'normal' | 'high'
  created_at: string
  updated_at?: string | null
  last_message_at?: string | null
  unread_count?: number
  last_message?: SupportChatMessage | null
}

export interface SupportChatConversationsResponse {
  conversations: SupportChatConversation[]
  page: number
  per_page: number
  total: number
  pages: number
}

export interface SupportChatMessagesResponse {
  conversation_id: number
  messages: SupportChatMessage[]
  page: number
  per_page: number
  total: number
  pages: number
}

export const supportChatService = {
  async listConversations(params?: {
    status?: SupportConversationStatus
    page?: number
    per_page?: number
    assigned_to_me?: boolean
  }): Promise<SupportChatConversationsResponse> {
    const response = await api.get('/support/chat/conversations', {
      params: {
        status: params?.status,
        page: params?.page || 1,
        per_page: params?.per_page || 20,
        assigned_to_me: params?.assigned_to_me,
      },
    })

    return {
      conversations: Array.isArray(response.data?.conversations) ? response.data.conversations : [],
      page: Number(response.data?.page || 1),
      per_page: Number(response.data?.per_page || 20),
      total: Number(response.data?.total || 0),
      pages: Number(response.data?.pages || 0),
    }
  },

  async createConversation(payload: {
    subject?: string
    candidate_user_id?: string
    assigned_support_user_id?: string
    priority?: 'low' | 'normal' | 'high'
  }): Promise<SupportChatConversation> {
    const response = await api.post('/support/chat/conversations', payload)
    return response.data
  },

  async listMessages(conversationId: number, params?: { page?: number; per_page?: number }): Promise<SupportChatMessagesResponse> {
    const response = await api.get(`/support/chat/conversations/${conversationId}/messages`, {
      params: {
        page: params?.page || 1,
        per_page: params?.per_page || 50,
      },
    })

    return {
      conversation_id: Number(response.data?.conversation_id || conversationId),
      messages: Array.isArray(response.data?.messages) ? response.data.messages : [],
      page: Number(response.data?.page || 1),
      per_page: Number(response.data?.per_page || 50),
      total: Number(response.data?.total || 0),
      pages: Number(response.data?.pages || 0),
    }
  },

  async sendMessage(
    conversationId: number,
    payload: { content?: string; attachment?: ChatAttachment }
  ): Promise<SupportChatMessage> {
    const response = await api.post(`/support/chat/conversations/${conversationId}/messages`, payload)
    return response.data?.message
  },

  async markRead(conversationId: number, last_message_id?: number): Promise<void> {
    await api.post(`/support/chat/conversations/${conversationId}/read`, {
      last_message_id,
    })
  },

  async updateConversationStatus(
    conversationId: number,
    status: SupportConversationStatus
  ): Promise<SupportChatConversation> {
    const response = await api.patch(`/support/chat/conversations/${conversationId}/status`, {
      status,
    })
    return response.data?.conversation
  },

  async searchCandidates(search?: string): Promise<SupportDirectoryUser[]> {
    const response = await listSupportUsers({
      role: 'candidato',
      search: search || undefined,
      page: 1,
      per_page: 20,
    })
    return response.users
  },
}
