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

const DEFAULT_PATH_COLOR = '#F9DC5C'

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

function humanizeId(value: string): string {
  return value
    .split(/[_-]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

type ParsedMapSymbol = {
  option: MapFilterOption
  objects: MapObject[]
}

type ParsedMapPath = {
  option: MapFilterOption
  objects: MapObject[]
}

function parseMapObject(
  element: Element,
  pathOption: Pick<MapFilterOption, 'id' | 'label' | 'color'>,
  symbolOption: Pick<MapFilterOption, 'id' | 'label'>,
): MapObject {
  const tombId = requiredAttribute(element, 'id')

  return {
    id: `${pathOption.id}:${symbolOption.id}:${tombId}`,
    tombId,
    title: textFromTag(element, 'title') ?? `Tomba ${tombId}`,
    subtitle: textFromTag(element, 'subtitle'),
    card: textFromTag(element, 'card'),
    pathId: pathOption.id,
    pathLabel: pathOption.label,
    pathColor: pathOption.color ?? DEFAULT_PATH_COLOR,
    symbolId: symbolOption.id,
    symbolLabel: symbolOption.label,
  }
}

function parseMapSymbol(
  element: Element,
  pathOption: Pick<MapFilterOption, 'id' | 'label' | 'color'>,
): ParsedMapSymbol {
  const symbolId = requiredAttribute(element, 'id')
  const symbolLabel = optionalAttribute(element, 'label') ?? humanizeId(symbolId)
  const symbolOption = {
    id: symbolId,
    label: symbolLabel,
  }
  const objects = childrenByTag(element, 'object').map((child) => parseMapObject(child, pathOption, symbolOption))

  return {
    option: {
      ...symbolOption,
      targets: objects.map((object) => object.id),
      children: [],
    },
    objects,
  }
}

function parseMapPath(element: Element): ParsedMapPath {
  const pathId = requiredAttribute(element, 'id')
  const pathLabel = optionalAttribute(element, 'label') ?? humanizeId(pathId)
  const pathColor = optionalAttribute(element, 'color')
  const pathOption = {
    id: pathId,
    label: pathLabel,
    color: pathColor,
  }
  const symbols = childrenByTag(element, 'symbol').map((child) => parseMapSymbol(child, pathOption))

  return {
    option: {
      ...pathOption,
      targets: [],
      children: symbols.map((symbol) => symbol.option),
    },
    objects: symbols.flatMap((symbol) => symbol.objects),
  }
}

function parseMap(element: Element): MapBlock {
  const pathsElement = childrenByTag(element, 'paths')[0]

  if (!pathsElement) {
    throw new Error('Il blocco map richiede un elemento <paths>.')
  }

  const paths = childrenByTag(pathsElement, 'path').map(parseMapPath)

  return {
    type: 'map',
    id: requiredAttribute(element, 'id'),
    title: requiredAttribute(element, 'title'),
    description: optionalAttribute(element, 'description'),
    svg: requiredAttribute(element, 'svg'),
    viewBox: requiredAttribute(element, 'viewBox'),
    defaultTargets: parseTargets(optionalAttribute(element, 'defaultTargets')),
    filters: {
      title: requiredAttribute(pathsElement, 'title'),
      options: paths.map((path) => path.option),
    },
    objects: paths.flatMap((path) => path.objects),
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
