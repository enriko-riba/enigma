const baseUrl = import.meta.env.BASE_URL

export function assetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '')
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const resolvedBaseUrl = new URL(normalizedBaseUrl, window.location.href)
  return new URL(normalizedPath, resolvedBaseUrl).href
}