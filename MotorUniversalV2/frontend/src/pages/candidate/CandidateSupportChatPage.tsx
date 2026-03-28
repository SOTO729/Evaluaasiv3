import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { MessageSquare, Clock } from 'lucide-react'
import SupportChatWorkspace from '../../components/chat/SupportChatWorkspace'
import { useAuthStore } from '../../store/authStore'

const SUPPORT_TZ = 'America/Mexico_City'
const SUPPORT_START_HOUR = 9
const SUPPORT_END_HOUR = 17
const SUPPORT_WEEKDAYS = [1, 2, 3, 4, 5] // lunes a viernes

function isSupportOpen(): boolean {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SUPPORT_TZ,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }

    const weekday = weekdayMap[parts.find((p) => p.type === 'weekday')?.value || '']
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0)

    return SUPPORT_WEEKDAYS.includes(weekday) && hour >= SUPPORT_START_HOUR && hour < SUPPORT_END_HOUR
  } catch {
    return true
  }
}

function getCurrentMexicoTime(): string {
  try {
    return new Date().toLocaleTimeString('es-MX', {
      timeZone: SUPPORT_TZ,
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const CandidateSupportChatPage = () => {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(() => isSupportOpen())
  const [mexicoTime, setMexicoTime] = useState(() => getCurrentMexicoTime())

  useEffect(() => {
    const interval = setInterval(() => {
      setOpen(isSupportOpen())
      setMexicoTime(getCurrentMexicoTime())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (user?.role !== 'candidato' && user?.role !== 'responsable') {
    return <Navigate to="/dashboard" replace />
  }

  if (!open) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-10 w-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Chat de soporte no disponible</h2>
          <p className="mt-3 text-slate-500">
            El chat de soporte solo esta habilitado y se da respuesta en horario de:
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-3">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            <span className="text-lg font-semibold text-slate-700">
              Lunes a Viernes, 9:00 a 17:00 hrs
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Hora del centro de Mexico</p>
          {mexicoTime && (
            <p className="mt-4 text-sm text-slate-500">
              Hora actual en Mexico: <span className="font-semibold">{mexicoTime}</span>
            </p>
          )}
          <p className="mt-6 text-sm text-slate-400">
            Por favor regresa durante el horario de atencion para comunicarte con soporte.
          </p>
        </div>
      </div>
    )
  }

  return <SupportChatWorkspace mode="candidate" />
}

export default CandidateSupportChatPage
