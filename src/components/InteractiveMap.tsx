import { useEffect, useState } from 'react'
import { MapCanvas } from './map/MapCanvas'
import { MapDetails } from './map/MapDetails'
import { MapFilters } from './map/MapFilters'
import type { MapDataBundle, MapPathOption, MapTomb } from '../types/map'
import { resolveAssetUrl } from '../lib/assetUrls'

type InteractiveMapProps = {
  data: MapDataBundle
}

const DEFAULT_PATH_COLOR = '#7A1145'
const MAP_EDITORIAL_IMAGE = resolveAssetUrl('media/3.jpg', import.meta.env.BASE_URL) ?? 'media/3.jpg'

function findPathOption(paths: MapPathOption[], id: string | null) {
  if (!id) {
    return null
  }

  return paths.find((path) => path.id === id) ?? null
}

function findSymbolOption(path: MapPathOption | null, id: string | null) {
  if (!path || !id) {
    return null
  }

  return path.symbols.find((symbol) => symbol.id === id) ?? null
}

function findTombById(tombs: MapTomb[], id: string | null) {
  if (!id) {
    return null
  }

  return tombs.find((tomb) => tomb.id === id) ?? null
}

export function InteractiveMap({ data }: InteractiveMapProps) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null)
  const [selectedTombId, setSelectedTombId] = useState<string | null>(null)

  const activePath = findPathOption(data.paths, selectedPathId)
  const activeSymbol = findSymbolOption(activePath, selectedSymbolId)
  const activeTombIds = activeSymbol?.targets ?? activePath?.targets ?? []
  const focusedTombIds = activeSymbol?.targets ?? []
  const activePathColor = activePath?.color ?? DEFAULT_PATH_COLOR
  const selectedTomb = findTombById(data.tombs, selectedTombId)
  const featuredTomb = findTombById(data.tombs, data.featuredTombId ?? null) ?? data.tombs[0] ?? null

  useEffect(() => {
    const visibleTombIds = activeSymbol?.targets ?? activePath?.targets ?? []

    if (!selectedTombId || visibleTombIds.includes(selectedTombId)) {
      return
    }

    setSelectedTombId(null)
  }, [activePath, activeSymbol, selectedTombId])

  function handleSelectPath(pathId: string) {
    setSelectedPathId(pathId)
    setSelectedSymbolId(null)
    setSelectedTombId(null)
  }

  function handleSelectSymbol(symbolId: string) {
    setSelectedSymbolId((current) => (current === symbolId ? null : symbolId))
    setSelectedTombId(null)
  }

  function handleResetFilters() {
    setSelectedPathId(null)
    setSelectedSymbolId(null)
    setSelectedTombId(null)
  }

  function handleSelectTomb(tombId: string) {
    setSelectedTombId(tombId)
  }

  return (
    <section className="story-block story-map" id="planimetria">
      <div className="story-map__intro">
        <MapFilters
          mode="paths"
          title="Scegli il tuo filo invisibile"
          ariaLabel={data.pathsTitle}
          paths={data.paths}
          selectedPathId={selectedPathId}
          onSelectPath={handleSelectPath}
        />
      </div>

      <div className="story-map__stage-shell">
        <div className="story-map__viewer">
          <MapCanvas
            svgSrc={data.svg}
            viewBox={data.viewBox}
            tombs={data.tombs}
            activeTombIds={activeTombIds}
            focusedTombIds={focusedTombIds}
            selectedTombId={selectedTombId}
            activePathColor={activePathColor}
            onSelectTomb={handleSelectTomb}
          />
        </div>

        <div className="story-map__selection">
          <MapFilters
            mode="symbols"
            title="Simboli"
            symbols={activePath?.symbols ?? []}
            selectedSymbolId={selectedSymbolId}
            onSelectSymbol={handleSelectSymbol}
            onReset={handleResetFilters}
            emptyState="Seleziona un percorso per vedere la famiglia di simboli associata."
          />

          <MapDetails
            activePath={activePath}
            activeSymbol={activeSymbol}
            selectedTomb={selectedTomb}
            featuredTomb={featuredTomb}
            editorialImageSrc={MAP_EDITORIAL_IMAGE}
          />
        </div>
      </div>
    </section>
  )
}
