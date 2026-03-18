import type {
  GalleryBlock,
  GallerySlide,
  HeroBlock,
  MapBlock,
  MapFilterOption,
  MapObject,
  SidecarBlock,
  StoryBlock,
  StoryDocument,
} from '../types/story'

function requiredAttribute(element: Element, name: string): string {
  const value = element.getAttribute(name)?.trim()

  if (!value) {
    throw new Error(`Attributo obbligatorio mancante: ${element.tagName}@${name}`)
  }

  return value
}

function optionalAttribute(element: Element, name: string): string | undefined {
  const value = element.getAttribute(name)?.trim()
  return value ? value : undefined
}

function childrenByTag(element: Element, tagName: string): Element[] {
  return Array.from(element.children).filter((child) => child.tagName === tagName)
}

function textFromTag(element: Element, tagName: string): string | undefined {
  const child = childrenByTag(element, tagName)[0]
  const value = child?.textContent?.trim()
  return value ? value : undefined
}

function paragraphsFromTag(element: Element, tagName: string): string[] {
  return childrenByTag(element, tagName)
    .map((child) => child.textContent?.trim() ?? '')
    .filter(Boolean)
}

function parseHero(element: Element): HeroBlock {
  return {
    type: 'hero',
    id: requiredAttribute(element, 'id'),
    kicker: optionalAttribute(element, 'kicker'),
    title: requiredAttribute(element, 'title'),
    subtitle: optionalAttribute(element, 'subtitle'),
    background: optionalAttribute(element, 'background'),
  }
}

function parseSidecar(element: Element): SidecarBlock {
  return {
    type: 'sidecar',
    id: requiredAttribute(element, 'id'),
    align: optionalAttribute(element, 'align') === 'left' ? 'left' : 'right',
    eyebrow: textFromTag(element, 'eyebrow'),
    title: textFromTag(element, 'title') ?? 'Sezione narrativa',
    paragraphs: paragraphsFromTag(element, 'text'),
    image: optionalAttribute(element, 'image'),
    imageAlt: optionalAttribute(element, 'imageAlt'),
  }
}

function parseSlide(element: Element): GallerySlide {
  return {
    image: requiredAttribute(element, 'image'),
    alt: requiredAttribute(element, 'alt'),
    title: requiredAttribute(element, 'title'),
    caption: requiredAttribute(element, 'caption'),
  }
}

function parseGallery(element: Element): GalleryBlock {
  return {
    type: 'gallery',
    id: requiredAttribute(element, 'id'),
    title: requiredAttribute(element, 'title'),
    description: optionalAttribute(element, 'description'),
    slides: childrenByTag(element, 'slide').map(parseSlide),
  }
}

function parseTargets(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function parseFilterOption(element: Element): MapFilterOption {
  return {
    id: requiredAttribute(element, 'id'),
    label: requiredAttribute(element, 'label'),
    color: optionalAttribute(element, 'color'),
    targets: parseTargets(optionalAttribute(element, 'targets')),
    children: childrenByTag(element, 'option').map(parseFilterOption),
  }
}

function parseObject(element: Element): MapObject {
  return {
    id: requiredAttribute(element, 'id'),
    title: textFromTag(element, 'title') ?? requiredAttribute(element, 'id'),
    legend: textFromTag(element, 'legend') ?? '',
    summary: textFromTag(element, 'summary') ?? '',
    details: textFromTag(element, 'details') ?? '',
    svgIds: parseTargets(optionalAttribute(element, 'svgIds')),
  }
}

function parseMap(element: Element): MapBlock {
  const filtersElement = childrenByTag(element, 'filters')[0]
  const objectsElement = childrenByTag(element, 'objects')[0]

  if (!filtersElement || !objectsElement) {
    throw new Error('Il blocco map richiede elementi <filters> e <objects>.')
  }

  return {
    type: 'map',
    id: requiredAttribute(element, 'id'),
    title: requiredAttribute(element, 'title'),
    description: optionalAttribute(element, 'description'),
    svg: requiredAttribute(element, 'svg'),
    viewBox: requiredAttribute(element, 'viewBox'),
    defaultTargets: parseTargets(optionalAttribute(element, 'defaultTargets')),
    filters: {
      title: requiredAttribute(filtersElement, 'title'),
      options: childrenByTag(filtersElement, 'option').map(parseFilterOption),
    },
    objects: childrenByTag(objectsElement, 'object').map(parseObject),
  }
}

function parseBlock(element: Element): StoryBlock {
  switch (element.tagName) {
    case 'hero':
      return parseHero(element)
    case 'sidecar':
      return parseSidecar(element)
    case 'gallery':
      return parseGallery(element)
    case 'map':
      return parseMap(element)
    default:
      throw new Error(`Blocco XML non supportato: <${element.tagName}>`)
  }
}

export function parseStoryXml(xmlText: string): StoryDocument {
  const parser = new DOMParser()
  const document = parser.parseFromString(xmlText, 'application/xml')
  const parserError = document.querySelector('parsererror')

  if (parserError) {
    throw new Error(`XML non valido: ${parserError.textContent ?? 'errore sconosciuto'}`)
  }

  const story = document.documentElement

  if (story.tagName !== 'story') {
    throw new Error('Il documento XML deve avere <story> come radice.')
  }

  return {
    title: optionalAttribute(story, 'title') ?? 'Monumap',
    subtitle: optionalAttribute(story, 'subtitle'),
    blocks: Array.from(story.children).map(parseBlock),
  }
}
