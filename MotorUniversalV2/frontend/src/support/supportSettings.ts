export interface SupportSettings {
  criticalNotifications: boolean
  autoRefreshEnabled: boolean
  escalationChannel: string
}

const STORAGE_KEY = 'support-settings'
const SYNC_EVENT = 'support-settings-updated'

const DEFAULT_SETTINGS: SupportSettings = {
  criticalNotifications: true,
  autoRefreshEnabled: false,
  escalationChannel: '',
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

