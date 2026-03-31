export type MapTaxonomySymbol = {
  id: string
  label: string
  description?: string
}

export type MapTaxonomyPath = {
  id: string
  label: string
  color: string
  description?: string
  symbols: MapTaxonomySymbol[]
}

export type MapTaxonomyData = {
  title: string
  description?: string
  svg: string
  viewBox?: string
  featuredTombId?: string
  pathsTitle: string
  paths: MapTaxonomyPath[]
}

export type RawMapTomb = {
  id: string
  nome?: string | null
  data?: string | null
  nascita?: string | null
  morte?: string | null
  descrizione?: string | null
  images?: string[] | null
  symbols?: string[] | null
}

export type MapTombSymbolRef = {
  symbolId: string
  symbolLabel: string
  pathId: string
  pathLabel: string
  pathColor: string
}

export type MapTomb = {
  id: string
  nome?: string
  data?: string
  nascita?: string
  morte?: string
  descrizione?: string
  images: string[]
  symbols: MapTombSymbolRef[]
}

export type MapSymbolOption = {
  id: string
  label: string
  description?: string
  targets: string[]
}

export type MapPathOption = {
  id: string
  label: string
  color: string
  description?: string
  targets: string[]
  symbols: MapSymbolOption[]
}

export type MapDataBundle = {
  title: string
  description?: string
  svg: string
  viewBox?: string
  featuredTombId?: string
  pathsTitle: string
  paths: MapPathOption[]
  tombs: MapTomb[]
}
