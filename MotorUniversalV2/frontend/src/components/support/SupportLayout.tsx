import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
  Building2,
  CalendarClock,
  UserCog,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Layout from '../layout/Layout'
import { isSupportPreviewEnabled } from '../../support/supportPreview'
import { loadSupportSettings, subscribeSupportSettings } from '../../support/supportSettings'
import { supportChatService } from '../../services/supportChatService'
import { useAuthStore } from '../../store/authStore'

type SupportNavItem = {
  path: string
  label: string
  icon: LucideIcon
  badge?: number
}

const navItems: SupportNavItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'campuses', label: 'Planteles a cargo', icon: Building2 },
  { path: 'users', label: 'Administración', icon: Users },
  { path: 'communication', label: 'Chat', icon: MessageCircle },
  { path: 'calendar', label: 'Calendario de sesiones', icon: CalendarDays },
  { path: 'sessions', label: 'Total sesiones', icon: CalendarClock },
  { path: 'settings', label: 'Settings', icon: Settings },
]

const SupportLayout = () => {
  const { user } = useAuthStore()
  const previewEnabled = isSupportPreviewEnabled()
  const location = useLocation()
  const queryClient = useQueryClient()
  const basePath = location.pathname.startsWith('/dev/support') ? '/dev/support' : '/support'
  const [settings, setSettings] = useState(loadSupportSettings())
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const isCoordinatorView = String(user?.role || '').toLowerCase() === 'coordinator'
  const visibleNavItems = isCoordinatorView
    ? navItems.filter((item) => item.path === 'communication')
    : navItems

  useEffect(() => subscribeSupportSettings(setSettings), [])

  useEffect(() => {
    if (!settings.autoRefreshEnabled) return
    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['support'] })
    }, 5 * 60 * 1000)

    return () => window.clearInterval(intervalId)
  }, [queryClient, settings.autoRefreshEnabled])

  useEffect(() => {
    let cancelled = false

    const loadUnread = async () => {
      try {
        const response = await supportChatService.listConversations({
          page: 1,
          per_page: 50,
          status: 'open',
        })
        if (cancelled) return
        const total = response.conversations.reduce((sum, item) => {
          if (!isCoordinatorView && item.current_handler_role === 'coordinator') return sum
          return sum + Number(item.unread_count || 0)
        }, 0)
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
  }, [isCoordinatorView, location.pathname])

  return (
    <Layout>
      <div className="space-y-6 lg:space-y-8 animate-fade-in-up">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Soporte</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-1">
                {isCoordinatorView ? 'Canal de coordinacion de chat' : 'Centro de soporte Evaluassi'}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-2xl">
                {isCoordinatorView
                  ? 'Atiende conversaciones derivadas por soporte y regresa los casos cuando corresponda.'
                  : 'Panel operativo para gestionar tickets, usuarios y comunicación del ecosistema.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {previewEnabled && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  DEV PREVIEW
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {visibleNavItems.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={`${basePath}/${path}`}>
                {({ isActive }) => {
                  const hasUnread = path === 'communication' && chatUnreadCount > 0

                  return (
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? hasUnread
                            ? 'bg-gradient-to-r from-primary-600 to-blue-600 text-white shadow-lg shadow-primary-200'
                            : 'bg-primary-50 text-primary-700'
                          : hasUnread
                            ? 'border border-primary-200 bg-gradient-to-r from-primary-50 to-blue-50 text-primary-700 shadow-sm hover:border-primary-300 hover:shadow-md'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="relative inline-flex items-center">
                        <Icon className="h-4 w-4" />
                        {hasUnread && (
                          <>
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-400 animate-ping" />
                          </>
                        )}
                      </span>
                      {label}
                      {hasUnread ? (
                        <span
                          className={`ml-1 inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-rose-500 text-white shadow-sm'
                          }`}
                        >
                          {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                      ) : null}
                    </span>
                  )
                }}
              </NavLink>
            ))}
            {!isCoordinatorView && (
              <NavLink to="/user-management">
                {({ isActive }) => (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <UserCog className="h-4 w-4" />
                    Gestión de Usuarios
                  </span>
                )}
              </NavLink>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </Layout>
  )
}

export default SupportLayout
