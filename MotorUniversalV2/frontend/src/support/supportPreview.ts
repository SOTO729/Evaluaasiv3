/**
 * Support preview mode utilities.
 * Only available in development mode — disabled in production builds.
 */

const PREVIEW_KEY = 'support-preview-enabled'

export const isSupportPreviewEnabled = (): boolean => {
  // Never allow preview bypass in production
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PREVIEW_KEY) === 'true'
  } catch {
    return false
  }
}

export const enableSupportPreview = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PREVIEW_KEY, 'true')
}

export const disableSupportPreview = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PREVIEW_KEY)
}
