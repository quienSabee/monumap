import type {
  GalleryBlock,
  GallerySlide,
  HeroBlock,
  MapBlock,
  MapFilterOption,
  MapTomb,
  MapTombSymbolRef,
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

type ParsedSymbolDefinition = {
  id: string
  label: string
  pathId: string
  pathLabel: string
  pathColor: string
}

type ParsedPathDefinition = {
  option: MapFilterOption
  symbols: ParsedSymbolDefinition[]
}

function parsePathSymbol(
  element: Element,
  pathOption: Pick<MapFilterOption, 'id' | 'label' | 'color'>,
): ParsedSymbolDefinition {
  const symbolId = requiredAttribute(element, 'id')

  return {
    id: symbolId,
    label: optionalAttribute(element, 'label') ?? humanizeId(symbolId),
    pathId: pathOption.id,
    pathLabel: pathOption.label,
    pathColor: pathOption.color ?? DEFAULT_PATH_COLOR,
  }
}

function parsePathDefinition(element: Element): ParsedPathDefinition {
  const pathId = requiredAttribute(element, 'id')
  const pathLabel = optionalAttribute(element, 'label') ?? humanizeId(pathId)
  const pathColor = optionalAttribute(element, 'color')
  const pathOption: MapFilterOption = {
    id: pathId,
    label: pathLabel,
    color: pathColor,
    targets: [],
    children: [],
  }
  const symbols = childrenByTag(element, 'symbol').map((child) => parsePathSymbol(child, pathOption))

  return {
    option: pathOption,
    symbols,
  }
}

function symbolReferenceElements(element: Element): Element[] {
  return Array.from(element.children).filter(
    (child) => child.tagName === 'symbolRef' || child.tagName === 'symbol',
  )
}

function parseSymbolReferenceId(element: Element): string {
  const value = optionalAttribute(element, 'symbol') ?? optionalAttribute(element, 'id')

  if (!value) {
    throw new Error(`Riferimento simbolo non valido in <${element.tagName}>: atteso @symbol oppure @id.`)
  }

  return value
}

function parseTomb(
  element: Element,
  symbolsById: Map<string, ParsedSymbolDefinition>,
): MapTomb {
  const tombId = requiredAttribute(element, 'id')
  const symbols: MapTombSymbolRef[] = []
  const seenSymbolIds = new Set<string>()

  symbolReferenceElements(element).forEach((child) => {
    const symbolId = parseSymbolReferenceId(child)
    const definition = symbolsById.get(symbolId)

    if (!definition) {
      throw new Error(`La tomba ${tombId} referenzia un simbolo non definito: ${symbolId}`)
    }

    if (seenSymbolIds.has(symbolId)) {
      return
    }

    seenSymbolIds.add(symbolId)
    symbols.push({
      symbolId: definition.id,
      symbolLabel: definition.label,
      pathId: definition.pathId,
      pathLabel: definition.pathLabel,
      pathColor: definition.pathColor,
    })
  })

  return {
    id: tombId,
    nome: textFromTag(element, 'nome') ?? textFromTag(element, 'title'),
    data: textFromTag(element, 'data'),
    nascita: textFromTag(element, 'nascita') ?? textFromTag(element, 'nato'),
    morte: textFromTag(element, 'morte') ?? textFromTag(element, 'morto'),
    descrizione: textFromTag(element, 'descrizione') ?? textFromTag(element, 'card'),
    symbols,
  }
}

function buildTargetSets(tombs: MapTomb[]) {
  const pathTargets = new Map<string, Set<string>>()
  const symbolTargets = new Map<string, Set<string>>()

  tombs.forEach((tomb) => {
    tomb.symbols.forEach((symbol) => {
      const pathSet = pathTargets.get(symbol.pathId) ?? new Set<string>()
      pathSet.add(tomb.id)
      pathTargets.set(symbol.pathId, pathSet)

      const symbolSet = symbolTargets.get(symbol.symbolId) ?? new Set<string>()
      symbolSet.add(tomb.id)
      symbolTargets.set(symbol.symbolId, symbolSet)
    })
  })

  return { pathTargets, symbolTargets }
}

function hydrateFilterOptions(
  paths: ParsedPathDefinition[],
  tombs: MapTomb[],
): MapFilterOption[] {
  const { pathTargets, symbolTargets } = buildTargetSets(tombs)

  return paths.map((path) => ({
    ...path.option,
    targets: Array.from(pathTargets.get(path.option.id) ?? []),
    children: path.symbols.map((symbol) => ({
      id: symbol.id,
      label: symbol.label,
      targets: Array.from(symbolTargets.get(symbol.id) ?? []),
      children: [],
    })),
  }))
}

function parseMap(element: Element): MapBlock {
  const pathsElement = childrenByTag(element, 'paths')[0]
  const tombsElement = childrenByTag(element, 'tombs')[0]

  if (!pathsElement) {
    throw new Error('Il blocco map richiede un elemento <paths>.')
  }

  if (!tombsElement) {
    throw new Error('Il blocco map richiede un elemento <tombs>.')
  }

  const pathDefinitions = childrenByTag(pathsElement, 'path').map(parsePathDefinition)
  const symbolsById = new Map<string, ParsedSymbolDefinition>()

  pathDefinitions.forEach((path) => {
    path.symbols.forEach((symbol) => {
      if (symbolsById.has(symbol.id)) {
        throw new Error(`Il simbolo ${symbol.id} e definito piu di una volta nei percorsi.`)
      }

      symbolsById.set(symbol.id, symbol)
    })
  })

  const tombs = childrenByTag(tombsElement, 'tomb').map((child) => parseTomb(child, symbolsById))

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
      options: hydrateFilterOptions(pathDefinitions, tombs),
    },
    tombs,
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
