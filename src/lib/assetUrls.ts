function hasProtocol(value: string) {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//') ||
    value.startsWith('data:') ||
    value.startsWith('#')
  )
}

export function resolveAssetUrl(path: string | undefined, baseUrl: string): string | undefined {
  if (!path) {
    return path
  }

  if (hasProtocol(path)) {
    return path
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  return `${normalizedBase}${normalizedPath}`
}

export function resolveSymbolIconUrl(symbolId: string, baseUrl: string) {
  return resolveAssetUrl(`media/symbols/${symbolId}.svg`, baseUrl) ?? ''
}
