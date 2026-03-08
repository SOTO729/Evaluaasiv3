/**
 * Determina si una URL apunta a Azure Blob Storage.
 */
export function isAzureUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url, 'https://placeholder.invalid')
    return parsed.hostname.endsWith('.blob.core.windows.net')
  } catch {
    return false
  }
}
