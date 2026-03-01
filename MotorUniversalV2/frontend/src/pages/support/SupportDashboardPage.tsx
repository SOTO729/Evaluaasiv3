import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  UserCircle2,
  Users2,
  MessageCircle,
  Building2,
  Plus,
  BellRing,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { supportChatService } from '../../services/supportChatService'

type TodoItem = {
  id: string
  text: string
  completed: boolean
  completedAt?: string
}

const TODO_STORAGE_PREFIX = 'support-dashboard-todo'

const buildTodayTodoKey = (userId?: string) => {
  const today = new Date().toISOString().slice(0, 10)
  return `${TODO_STORAGE_PREFIX}:${userId || 'anon'}:${today}`
}

const SupportDashboardPage = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const basePath = location.pathname.startsWith('/dev/support') ? '/dev/support' : '/support'

  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  const [todoInput, setTodoInput] = useState('')
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])

  const todoStorageKey = useMemo(() => buildTodayTodoKey(user?.id), [user?.id])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todoStorageKey)
      if (!raw) {
        setTodoItems([])
        return
      }
      const parsed = JSON.parse(raw)
      setTodoItems(Array.isArray(parsed) ? parsed : [])
    } catch {
      setTodoItems([])
    }
  }, [todoStorageKey])

  useEffect(() => {
    localStorage.setItem(todoStorageKey, JSON.stringify(todoItems))
  }, [todoItems, todoStorageKey])

  useEffect(() => {
    let cancelled = false

    const loadUnread = async () => {
      try {
        const response = await supportChatService.listConversations({
          page: 1,
          per_page: 50,
        })
        if (cancelled) return
        const total = response.conversations.reduce(
          (sum, conversation) => sum + Number(conversation.unread_count || 0),
          0
        )
        setChatUnreadCount(total)
      } catch {
        if (!cancelled) setChatUnreadCount(0)
      }
    }

    loadUnread()
    const intervalId = window.setInterval(loadUnread, 7000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const completedCount = useMemo(
    () => todoItems.filter((item) => item.completed).length,
    [todoItems]
  )

  const handleAddTodo = (event: FormEvent) => {
    event.preventDefault()
    const value = todoInput.trim()
    if (!value) return

    const newItem: TodoItem = {
      id: `${Date.now()}`,
      text: value,
      completed: false,
    }

    setTodoItems((prev) => [newItem, ...prev])
    setTodoInput('')
  }

  const handleToggleTodo = (id: string) => {
    setTodoItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : undefined,
            }
          : item
      )
    )
  }

  const displayName = user?.full_name || [user?.name, user?.first_surname].filter(Boolean).join(' ') || 'Usuario de soporte'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Dashboard</p>
        <h2 className="text-2xl font-semibold text-gray-900">Bienvenido</h2>
        <p className="text-sm text-gray-600 max-w-2xl">
          Vista general de tu operación de soporte y prioridades del día.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm md:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Equipo de soporte</p>
                <h3 className="text-xl font-semibold text-gray-900">{displayName}</h3>
                <p className="text-xs text-gray-500">
                  {user?.email || user?.username || 'sin correo'} · {user?.role || 'soporte'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                <BadgeCheck className="h-3.5 w-3.5" />
                Disponible
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Acciones rápidas</p>
          <h3 className="text-lg font-semibold text-gray-900">Atajos operativos</h3>
          <div className="mt-4 space-y-3">
            {[
              {
                label: 'Abrir canal de comunicación',
                path: `${basePath}/communication`,
                icon: MessageCircle,
                helper: 'Responder conversaciones activas',
              },
              {
                label: 'Revisar usuarios',
                path: `${basePath}/users`,
                icon: Users2,
                helper: 'Bloqueos, accesos y actividad',
              },
              {
                label: 'Gestionar planteles',
                path: `${basePath}/campuses`,
                icon: Building2,
                helper: 'Altas, cambios y solicitudes',
              },
            ].map(({ label, path, icon: Icon, helper }) => (
              <Link
                key={label}
                to={path}
                className="flex items-center gap-4 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 transition hover:border-primary-200 hover:bg-primary-50/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{helper}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Checklist</p>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Lo resuelto hoy</h3>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
              {completedCount} completadas
            </span>
          </div>

          <form onSubmit={handleAddTodo} className="mt-4 flex gap-2">
            <input
              value={todoInput}
              onChange={(event) => setTodoInput(event.target.value)}
              placeholder="Agregar actividad resuelta de hoy"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </form>

          <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
            {todoItems.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no hay actividades registradas hoy.</p>
            ) : (
              todoItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggleTodo(item.id)}
                  className="w-full flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="mt-0.5 text-primary-600">
                    {item.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className={`text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-800 font-medium'}`}>
                      {item.text}
                    </p>
                    {item.completedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Completada: {new Date(item.completedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Alertas de chat</p>
          <h3 className="text-lg font-semibold text-gray-900">Mensajes entrantes</h3>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Nuevos mensajes en chat</p>
                <p className="text-xs text-gray-500">Total de mensajes no leídos en conversaciones activas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-rose-500 px-3 py-1 text-sm font-semibold text-white">
                {chatUnreadCount}
              </span>
              <Link
                to={`${basePath}/communication`}
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Ir al chat
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupportDashboardPage
