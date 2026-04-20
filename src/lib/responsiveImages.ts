import { optimizedMediaManifest } from '../generated/optimizedMediaManifest'
import { resolveAssetUrl } from './assetUrls'

export type ResponsiveImageVariant = {
  path: string
  width: number
  height: number
}

export type ResponsiveImageManifestEntry = {
  width: number
  height: number
  variants: ResponsiveImageVariant[]
  placeholder?: string
}

export type ResponsiveImageManifest = Record<string, ResponsiveImageManifestEntry>

export type ResolvedResponsiveImage = {
  src: string
  srcSet?: string
  width?: number
  height?: number
  placeholder?: string
}

const warmedResponsiveImages = new Set<string>()

function normalizeImageKey(path: string | undefined) {
  const normalized = path?.trim()
  return normalized ? normalized : undefined
}

export function resolveResponsiveImage(path: string | undefined, baseUrl: string): ResolvedResponsiveImage | null {
  const normalizedPath = normalizeImageKey(path)

  if (!normalizedPath) {
    return null
  }

  const entry = optimizedMediaManifest[normalizedPath]

  if (!entry || entry.variants.length === 0) {
    const resolvedSrc = resolveAssetUrl(normalizedPath, baseUrl)

    if (!resolvedSrc) {
      return null
    }

    return {
      src: resolvedSrc,
    }
  }

  const variants = entry.variants
    .map((variant) => ({
      src: resolveAssetUrl(variant.path, baseUrl),
      width: variant.width,
      height: variant.height,
    }))
    .filter((variant): variant is { src: string; width: number; height: number } => Boolean(variant.src))

  if (variants.length === 0) {
    return null
  }

  const defaultVariant = variants[variants.length - 1]

  return {
    src: defaultVariant.src,
    srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
    width: entry.width,
    height: entry.height,
    placeholder: entry.placeholder,
  }
}

export function warmResponsiveImage(path: string | undefined, baseUrl: string, sizes = '100vw') {
  const normalizedPath = normalizeImageKey(path)

  if (!normalizedPath) {
    return
  }

  const cacheKey = `${normalizedPath}::${sizes}`

  if (warmedResponsiveImages.has(cacheKey)) {
    return
  }

  const resolved = resolveResponsiveImage(normalizedPath, baseUrl)

  if (!resolved) {
    return
  }

  const image = new Image()
  image.decoding = 'async'

  if (resolved.srcSet) {
    image.srcset = resolved.srcSet
    image.sizes = sizes
  }

  image.src = resolved.src
  warmedResponsiveImages.add(cacheKey)
}
