/**
 * Support preview mode utilities.
 * When enabled via localStorage, allows non-support users to preview the support module.
 */

const PREVIEW_KEY = 'support-preview-enabled'

export const isSupportPreviewEnabled = (): boolean => {
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
