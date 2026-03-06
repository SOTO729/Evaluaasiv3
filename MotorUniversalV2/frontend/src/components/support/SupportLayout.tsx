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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Layout from '../layout/Layout'
import { isSupportPreviewEnabled } from '../../support/supportPreview'
import { loadSupportSettings, subscribeSupportSettings } from '../../support/supportSettings'
import { supportChatService } from '../../services/supportChatService'

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
  const previewEnabled = isSupportPreviewEnabled()
  const location = useLocation()
  const queryClient = useQueryClient()
  const basePath = location.pathname.startsWith('/dev/support') ? '/dev/support' : '/support'
  const [settings, setSettings] = useState(loadSupportSettings())
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

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
        const total = response.conversations.reduce(
          (sum, item) => sum + Number(item.unread_count || 0),
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
  }, [location.pathname])

  return (
    <Layout>
      <div className="space-y-6 lg:space-y-8 animate-fade-in-up">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Soporte</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-1">
                Centro de soporte Evaluassi
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-2xl">
                Panel operativo para gestionar tickets, usuarios y comunicación del ecosistema.
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
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={`${basePath}/${path}`}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
                {path === 'communication' && chatUnreadCount > 0 ? (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                    {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
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
