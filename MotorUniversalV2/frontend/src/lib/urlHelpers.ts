export const isAzureUrl = (value?: string | null): boolean => {
  if (!value) return false

  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return (
      host.includes('azureedge.net') ||
      host.includes('azurefd.net') ||
      host.includes('azurecontainerapps.io') ||
      host.includes('blob.core.windows.net')
    )
  } catch {
    return false
  }
}
