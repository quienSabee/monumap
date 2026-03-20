import { useEffect, useState } from 'react'
import { StoryRenderer } from './components/StoryRenderer'
import { preloadImageAssets } from './lib/imageAssets'
import { parseStoryXml } from './lib/storyParser'
import type {
  GalleryBlock,
  HeroBlock,
  MapBlock,
  MapFilterOption,
  SidecarBlock,
  StoryBlock,
  StoryDocument,
} from './types/story'

function resolveAssetUrl(path: string | undefined, baseUrl: string): string | undefined {
  if (!path) {
    return path
  }

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('//') ||
    path.startsWith('data:') ||
    path.startsWith('#')
  ) {
    return path
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  return `${normalizedBase}${normalizedPath}`
}

function resolveBlockAssets(block: StoryBlock, baseUrl: string): StoryBlock {
  switch (block.type) {
    case 'hero':
      return {
        ...block,
        background: resolveAssetUrl(block.background, baseUrl),
      } satisfies HeroBlock
    case 'sidecar':
      return {
        ...block,
        image: resolveAssetUrl(block.image, baseUrl),
      } satisfies SidecarBlock
    case 'gallery':
      return {
        ...block,
        slides: block.slides.map((slide) => ({
          ...slide,
          image: resolveAssetUrl(slide.image, baseUrl) ?? slide.image,
        })),
      } satisfies GalleryBlock
    case 'map':
      return {
        ...block,
        svg: resolveAssetUrl(block.svg, baseUrl) ?? block.svg,
      } satisfies MapBlock
    default:
      return block
  }
}

function resolveStoryAssets(story: StoryDocument, baseUrl: string): StoryDocument {
  return {
    ...story,
    blocks: story.blocks.map((block) => resolveBlockAssets(block, baseUrl)),
  }
}

function collectSymbolIconUrls(options: MapFilterOption[], baseUrl: string, depth = 0): string[] {
  return options.flatMap((option) => {
    const currentLevelUrls = depth > 0 ? [`${baseUrl}media/symbols/${option.id}.svg`] : []
    return [...currentLevelUrls, ...collectSymbolIconUrls(option.children, baseUrl, depth + 1)]
  })
}

function collectPreloadUrls(story: StoryDocument, baseUrl: string): string[] {
  const urls = new Set<string>()

  story.blocks.forEach((block) => {
    switch (block.type) {
      case 'hero':
        if (block.background) {
          urls.add(block.background)
        }
        break
      case 'sidecar':
        if (block.image) {
          urls.add(block.image)
        }
        break
      case 'gallery':
        block.slides.forEach((slide) => urls.add(slide.image))
        break
      case 'map':
        collectSymbolIconUrls(block.filters.options, baseUrl).forEach((url) => urls.add(url))
        break
      default:
        break
    }
  })

  return Array.from(urls)
}

function App() {
  const [story, setStory] = useState<StoryDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStory() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}content/story.xml`)

        if (!response.ok) {
          throw new Error(`Impossibile caricare il contenuto XML (${response.status}).`)
        }

        const xml = await response.text()
        const parsed = parseStoryXml(xml)
        const resolved = resolveStoryAssets(parsed, import.meta.env.BASE_URL)

        if (!cancelled) {
          setStory(resolved)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Errore sconosciuto.')
        }
      }
    }

    loadStory()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!story) {
      return
    }

    void preloadImageAssets(collectPreloadUrls(story, import.meta.env.BASE_URL))
  }, [story])

  if (error) {
    return (
      <div className="app-status">
        <h1>Errore di caricamento</h1>
        <p>{error}</p>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="app-status">
        <h1>Monumap</h1>
        <p>Caricamento dei contenuti XML in corso.</p>
      </div>
    )
  }

  return <StoryRenderer story={story} />
}

export default App
