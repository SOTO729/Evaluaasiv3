import { useState } from 'react'
import {
  loadSupportSettings,
  saveSupportSettings,
  type SupportSettings,
} from '../../support/supportSettings'

const SupportSettingsPage = () => {
  const [settings, setSettings] = useState<SupportSettings>(() => loadSupportSettings())
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const weekdayOptions = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miercoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sabado' },
    { value: 0, label: 'Domingo' },
  ]

  const persistSettings = (next: SupportSettings) => {
    setSettings(next)
    saveSupportSettings(next)
    setSavedMessage('Preferencias guardadas')
    window.setTimeout(() => setSavedMessage(null), 1800)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Configuración</p>
        <h2 className="text-2xl font-semibold text-gray-900">Preferencias del módulo</h2>
        <p className="text-sm text-gray-600">Ajustes de alertas y canales internos.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Notificaciones críticas</p>
            <p className="text-xs text-gray-500">Recibir alertas de incidentes</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={settings.criticalNotifications}
            onChange={(event) =>
              persistSettings({
                ...settings,
                criticalNotifications: event.target.checked,
              })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Actualización automática del chat</p>
            <p className="text-xs text-gray-500">Refrescar conversaciones y mensajes en tiempo real (cada 7s)</p>
          </div>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={settings.autoRefreshEnabled}
            onChange={(event) =>
              persistSettings({
                ...settings,
                autoRefreshEnabled: event.target.checked,
              })
            }
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">Canal de escalamiento</label>
          <input
            value={settings.escalationChannel}
            onChange={(event) =>
              setSettings({
                ...settings,
                escalationChannel: event.target.value,
              })
            }
            onBlur={() => persistSettings(settings)}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder="soporte@evaluaasi.com"
          />
        </div>
        <div className="border-t border-gray-100 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Horario de atencion para candidato</p>
              <p className="text-xs text-gray-500">Bloquear envio de mensajes fuera del horario laboral</p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={settings.supportAvailabilityEnabled}
              onChange={(event) =>
                persistSettings({
                  ...settings,
                  supportAvailabilityEnabled: event.target.checked,
                })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Zona horaria</label>
              <input
                value={settings.supportTimezone}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    supportTimezone: event.target.value,
                  })
                }
                onBlur={() => persistSettings(settings)}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="America/Mexico_City"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Inicio</label>
              <input
                type="time"
                value={settings.supportStartHour}
                onChange={(event) =>
                  persistSettings({
                    ...settings,
                    supportStartHour: event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Fin</label>
              <input
                type="time"
                value={settings.supportEndHour}
                onChange={(event) =>
                  persistSettings({
                    ...settings,
                    supportEndHour: event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Dias habilitados</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekdayOptions.map((option) => {
                const active = settings.supportWeekdays.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const nextDays = active
                        ? settings.supportWeekdays.filter((day) => day !== option.value)
                        : [...settings.supportWeekdays, option.value].sort((a, b) => a - b)
                      persistSettings({
                        ...settings,
                        supportWeekdays: nextDays,
                      })
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500">Leyenda fuera de horario</label>
            <textarea
              value={settings.supportOfflineMessage}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  supportOfflineMessage: event.target.value,
                })
              }
              onBlur={() => persistSettings(settings)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="Horario de atencion de soporte..."
            />
          </div>
        </div>
        {savedMessage && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {savedMessage}
          </p>
        )}
      </div>
    </div>
  )
}

export default SupportSettingsPage
