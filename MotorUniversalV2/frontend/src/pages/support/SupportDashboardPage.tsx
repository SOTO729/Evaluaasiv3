import { Link, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  ClipboardCheck,
  ShieldCheck,
  UserCircle2,
  Users2,
  MessageCircle,
  Building2,
} from 'lucide-react'

const SupportDashboardPage = () => {
  const location = useLocation()
  const basePath = location.pathname.startsWith('/dev/support') ? '/dev/support' : '/support'
  const supportAlerts = [
    {
      key: 'whatsapp',
      title: 'Mensaje por WhatsApp',
      helper: 'Canal crítico para incidencias urgentes',
      tone: 'bg-emerald-50 text-emerald-600',
      status: 'Disponible',
    },
    {
      key: 'instagram',
      title: 'Mensaje por Instagram',
      helper: 'Interacciones sociales en seguimiento',
      tone: 'bg-fuchsia-50 text-fuchsia-600',
      status: 'En monitoreo',
    },
    {
      key: 'platform-chat',
      title: 'Chat de plataforma',
      helper: 'Atención en tiempo real',
      tone: 'bg-sky-50 text-sky-600',
      status: 'Activo',
    },
  ]

  const resolvedChecklist = [
    {
      title: 'Incidencias urgentes confirmadas',
      helper: 'Verificar folios críticos',
    },
    {
      title: 'Seguimientos de usuarios clave',
      helper: 'Reportes y soluciones enviadas',
    },
    {
      title: 'Actualizaciones internas compartidas',
      helper: 'Notas para coordinación de equipo',
    },
  ]

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
                <p className="text-sm text-gray-500">Grupo Edut</p>
                <h3 className="text-xl font-semibold text-gray-900">Juan Salvador López Luna</h3>
                <p className="text-xs text-gray-500">Soporte · Z00015SO000002</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                <BadgeCheck className="h-3.5 w-3.5" />
                Disponible
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Nivel 2
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
          <h3 className="text-lg font-semibold text-gray-900">Lo resuelto hoy</h3>
          <div className="mt-4 space-y-3">
            {resolvedChecklist.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-gray-200 px-4 py-3"
              >
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <ClipboardCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.helper}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Alertas de canales</p>
          <h3 className="text-lg font-semibold text-gray-900">Mensajes entrantes</h3>
          <div className="mt-4 space-y-3">
            {supportAlerts.map((alert) => (
              <div
                key={alert.key}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                  <p className="text-xs text-gray-500">{alert.helper}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${alert.tone}`}
                >
                  {alert.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-primary-50 via-white to-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Disponibilidad</p>
          <h3 className="text-lg font-semibold text-gray-900">Canales activos</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {['WhatsApp', 'Instagram', 'Chat plataforma'].map((channel) => (
              <span
                key={channel}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {channel}
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-primary-100 bg-white px-4 py-3 text-sm text-gray-600">
            Monitoreo activo de incidencias críticas y mensajes entrantes.
          </div>
        </div>

      </div>
    </div>
  )
}

export default SupportDashboardPage
