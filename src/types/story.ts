export type StoryDocument = {
  title: string
  subtitle?: string
  blocks: StoryBlock[]
}

export type StoryBlock = HeroBlock | SidecarBlock | GalleryBlock | MapBlock

export type HeroBlock = {
  type: 'hero'
  id: string
  kicker?: string
  title: string
  subtitle?: string
  background?: string
}

export type SidecarBlock = {
  type: 'sidecar'
  id: string
  align: 'left' | 'right'
  eyebrow?: string
  title: string
  paragraphs: string[]
  image?: string
  imageAlt?: string
}

export type GalleryBlock = {
  type: 'gallery'
  id: string
  title: string
  description?: string
  slides: GallerySlide[]
}

export type GallerySlide = {
  image: string
  alt: string
  title: string
  caption: string
}

export type MapBlock = {
  type: 'map'
  id: string
  title: string
  description?: string
  svg: string
  viewBox: string
  defaultTargets: string[]
  filters: MapFilterPanel
  objects: MapObject[]
}

export type MapFilterPanel = {
  title: string
  options: MapFilterOption[]
}

export type MapFilterOption = {
  id: string
  label: string
  color?: string
  targets: string[]
  children: MapFilterOption[]
}

export type MapObject = {
  id: string
  title: string
  legend: string
  summary: string
  details: string
  rectIndices: number[]
  svgIds: string[]
}
