import { resolveAssetUrl } from './assetUrls'
import type {
  MapDataBundle,
  MapPathOption,
  MapTaxonomyData,
  MapTomb,
  MapTombSymbolRef,
  RawMapTomb,
} from '../types/map'

type SymbolDefinition = {
  id: string
  label: string
  description?: string
  pathId: string
  pathLabel: string
  pathColor: string
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

function normalizeSymbolIds(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeImageUrls(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => Boolean(entry))
}

export function normalizeMapData(rawTaxonomy: MapTaxonomyData, rawTombs: RawMapTomb[], baseUrl: string): MapDataBundle {
  const symbolDefinitions = new Map<string, SymbolDefinition>()

  rawTaxonomy.paths.forEach((path) => {
    path.symbols.forEach((symbol) => {
      if (symbolDefinitions.has(symbol.id)) {
        throw new Error(`Il simbolo ${symbol.id} e definito piu di una volta nella tassonomia.`)
      }

      symbolDefinitions.set(symbol.id, {
        id: symbol.id,
        label: symbol.label,
        description: normalizeOptionalText(symbol.description),
        pathId: path.id,
        pathLabel: path.label,
        pathColor: path.color,
      })
    })
  })

  const tombs: MapTomb[] = rawTombs.map((rawTomb) => {
    const seen = new Set<string>()
    const symbols: MapTombSymbolRef[] = []

    normalizeSymbolIds(rawTomb.symbols).forEach((symbolId) => {
      const definition = symbolDefinitions.get(symbolId)

      if (!definition || seen.has(symbolId)) {
        return
      }

      seen.add(symbolId)
      symbols.push({
        symbolId: definition.id,
        symbolLabel: definition.label,
        pathId: definition.pathId,
        pathLabel: definition.pathLabel,
        pathColor: definition.pathColor,
      })
    })

    return {
      id: rawTomb.id,
      nome: normalizeOptionalText(rawTomb.nome),
      data: normalizeOptionalText(rawTomb.data),
      nascita: normalizeOptionalText(rawTomb.nascita),
      morte: normalizeOptionalText(rawTomb.morte),
      descrizione: normalizeOptionalText(rawTomb.descrizione),
      images: normalizeImageUrls(rawTomb.images),
      symbols,
    }
  })

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

  const paths: MapPathOption[] = rawTaxonomy.paths.map((path) => ({
    id: path.id,
    label: path.label,
    color: path.color,
    description: normalizeOptionalText(path.description),
    targets: Array.from(pathTargets.get(path.id) ?? []),
    symbols: path.symbols.map((symbol) => ({
      id: symbol.id,
      label: symbol.label,
      description: normalizeOptionalText(symbol.description),
      targets: Array.from(symbolTargets.get(symbol.id) ?? []),
    })),
  }))

  return {
    title: rawTaxonomy.title,
    description: normalizeOptionalText(rawTaxonomy.description),
    svg: resolveAssetUrl(rawTaxonomy.svg, baseUrl) ?? rawTaxonomy.svg,
    viewBox: normalizeOptionalText(rawTaxonomy.viewBox),
    featuredTombId: normalizeOptionalText(rawTaxonomy.featuredTombId),
    pathsTitle: rawTaxonomy.pathsTitle,
    paths,
    tombs,
  }
}
