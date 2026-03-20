import { useEffect, useState } from 'react'

type AssetStatus = 'idle' | 'loading' | 'loaded' | 'error'

type AssetEntry = {
  status: AssetStatus
  promise?: Promise<void>
}

const assetCache = new Map<string, AssetEntry>()

function normalizeAssetUrl(url: string | undefined): string {
  return url?.trim() ?? ''
}

function getCachedStatus(url: string | undefined): AssetStatus {
  const normalizedUrl = normalizeAssetUrl(url)

  if (!normalizedUrl) {
    return 'idle'
  }

  return assetCache.get(normalizedUrl)?.status ?? 'idle'
}

export function preloadImageAsset(url: string | undefined): Promise<void> {
  const normalizedUrl = normalizeAssetUrl(url)

  if (!normalizedUrl) {
    return Promise.resolve()
  }

  const cached = assetCache.get(normalizedUrl)

  if (cached?.status === 'loaded') {
    return Promise.resolve()
  }

  if (cached?.promise) {
    return cached.promise
  }

  const image = new Image()
  image.decoding = 'async'

  const promise = new Promise<void>((resolve, reject) => {
    function markLoaded() {
      assetCache.set(normalizedUrl, { status: 'loaded' })
      image.onload = null
      image.onerror = null
      resolve()
    }

    function markError() {
      assetCache.set(normalizedUrl, { status: 'error' })
      image.onload = null
      image.onerror = null
      reject(new Error(`Impossibile caricare l'asset: ${normalizedUrl}`))
    }

    image.onload = markLoaded
    image.onerror = markError
    image.src = normalizedUrl

    if (image.complete && image.naturalWidth > 0) {
      markLoaded()
    }
  })

  assetCache.set(normalizedUrl, { status: 'loading', promise })
  return promise
}

export function preloadImageAssets(urls: string[]): Promise<void> {
  return Promise.allSettled(urls.map((url) => preloadImageAsset(url))).then(() => undefined)
}

export function useImageAsset(url: string | undefined) {
  const normalizedUrl = normalizeAssetUrl(url)
  const [isLoaded, setIsLoaded] = useState(() => {
    if (!normalizedUrl) {
      return true
    }

    const status = getCachedStatus(normalizedUrl)
    return status === 'loaded'
  })

  useEffect(() => {
    if (!normalizedUrl) {
      setIsLoaded(true)
      return
    }

    const status = getCachedStatus(normalizedUrl)

    if (status === 'loaded') {
      setIsLoaded(true)
      return
    }

    let active = true
    setIsLoaded(false)

    preloadImageAsset(normalizedUrl)
      .then(() => {
        if (active) {
          setIsLoaded(true)
        }
      })
      .catch(() => {
        if (active) {
          setIsLoaded(true)
        }
      })

    return () => {
      active = false
    }
  }, [normalizedUrl])

  return { isLoaded }
}
