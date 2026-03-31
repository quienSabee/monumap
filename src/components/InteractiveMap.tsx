import { useEffect, useState } from 'react'
import { MapCanvas } from './map/MapCanvas'
import { MapDetails } from './map/MapDetails'
import { MapFilters } from './map/MapFilters'
import type { MapDataBundle, MapPathOption, MapTomb } from '../types/map'

type InteractiveMapProps = {
  data: MapDataBundle
}

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
  const selectedTomb = findTombById(data.tombs, selectedTombId)

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

  function handleClearSymbolSelection() {
    setSelectedSymbolId(null)
    setSelectedTombId(null)
  }

  function handleSelectTomb(tombId: string) {
    setSelectedTombId(tombId)
  }

  function handleCloseTombModal() {
    setSelectedTombId(null)
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
        <MapFilters
          mode="symbols"
          title="Simboli"
          symbols={activePath?.symbols ?? []}
          selectedSymbolId={selectedSymbolId}
          onSelectSymbol={handleSelectSymbol}
          onReset={handleClearSymbolSelection}
          emptyState="Seleziona un percorso per vedere la famiglia di simboli associata."
        />

        <div className="story-map__viewer">
          <MapCanvas
            svgSrc={data.svg}
            viewBox={data.viewBox}
            tombs={data.tombs}
            activeTombIds={activeTombIds}
            focusedTombIds={focusedTombIds}
            selectedTombId={selectedTombId}
            onSelectTomb={handleSelectTomb}
          />
        </div>

        <div className="story-map__details">
          <MapDetails
            activePath={activePath}
            activeSymbol={activeSymbol}
            selectedTomb={selectedTomb}
            onCloseSelectedTomb={handleCloseTombModal}
          />
        </div>
      </div>
    </section>
  )
}
