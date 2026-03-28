export interface SupportSettings {
  criticalNotifications: boolean
  autoRefreshEnabled: boolean
  escalationChannel: string
  supportAvailabilityEnabled: boolean
  supportTimezone: string
  supportWeekdays: number[]
  supportStartHour: string
  supportEndHour: string
  supportOfflineMessage: string
}

const STORAGE_KEY = 'support-settings'
const SYNC_EVENT = 'support-settings-updated'

const DEFAULT_SETTINGS: SupportSettings = {
  criticalNotifications: true,
  autoRefreshEnabled: false,
  escalationChannel: '',
  supportAvailabilityEnabled: true,
  supportTimezone: 'America/Mexico_City',
  supportWeekdays: [1, 2, 3, 4, 5],
  supportStartHour: '09:00',
  supportEndHour: '17:00',
  supportOfflineMessage:
    'El chat de soporte solo esta habilitado de lunes a viernes de 9:00 a 17:00 hrs (centro de Mexico).',
}

export const getDefaultSupportSettings = (): SupportSettings => ({ ...DEFAULT_SETTINGS })

export const loadSupportSettings = (): SupportSettings => {
  if (typeof window === 'undefined') return getDefaultSupportSettings()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultSupportSettings()
    const parsed = JSON.parse(raw)
    return {
      criticalNotifications: Boolean(parsed?.criticalNotifications),
      autoRefreshEnabled: Boolean(parsed?.autoRefreshEnabled),
      escalationChannel: String(parsed?.escalationChannel || ''),
      supportAvailabilityEnabled:
        parsed?.supportAvailabilityEnabled === undefined ? true : Boolean(parsed?.supportAvailabilityEnabled),
      supportTimezone: String(parsed?.supportTimezone || 'America/Mexico_City'),
      supportWeekdays: Array.isArray(parsed?.supportWeekdays)
        ? parsed.supportWeekdays.filter((day: unknown) => Number.isInteger(day)).map((day: number) => Number(day))
        : [1, 2, 3, 4, 5],
      supportStartHour: String(parsed?.supportStartHour || '09:00'),
      supportEndHour: String(parsed?.supportEndHour || '17:00'),
      supportOfflineMessage: String(
        parsed?.supportOfflineMessage ||
          'El chat de soporte solo esta habilitado de lunes a viernes de 9:00 a 17:00 hrs (centro de Mexico).'
      ),
    }
  } catch (_error) {
    return getDefaultSupportSettings()
  }
}

export const saveSupportSettings = (next: SupportSettings) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(SYNC_EVENT))
}

export const subscribeSupportSettings = (onChange: (settings: SupportSettings) => void) => {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onChange(loadSupportSettings())
    }
  }

  const handleCustom = () => onChange(loadSupportSettings())

  window.addEventListener('storage', handleStorage)
  window.addEventListener(SYNC_EVENT, handleCustom)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(SYNC_EVENT, handleCustom)
  }
}
