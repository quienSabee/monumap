import { resolveSymbolIconUrl } from '../../lib/assetUrls'
import type { MapPathOption, MapSymbolOption } from '../../types/map'
import { SymbolIcon } from './SymbolIcon'

type MapFiltersProps =
  | {
      mode: 'paths'
      title: string
      ariaLabel: string
      paths: MapPathOption[]
      selectedPathId: string | null
      onSelectPath: (pathId: string) => void
    }
  | {
      mode: 'symbols'
      title: string
      symbols: MapSymbolOption[]
      selectedSymbolId: string | null
      onSelectSymbol: (symbolId: string) => void
      onReset: () => void
      emptyState: string
    }

export function MapFilters(props: MapFiltersProps) {
  if (props.mode === 'paths') {
    return (
      <div className="story-map__paths-panel">
        <h2>{props.title}</h2>
        <div className="story-map__paths" role="list" aria-label={props.ariaLabel}>
          {props.paths.map((path) => {
            const isSelected = path.id === props.selectedPathId

            return (
              <button
                type="button"
                key={path.id}
                className={isSelected ? 'story-map__path is-selected' : 'story-map__path'}
                onClick={() => props.onSelectPath(path.id)}
              >
                <span>{path.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="story-map__symbol-tray">
      <div className="story-map__selection-header">
        <span className="story-map__section-label">{props.title}</span>
        <button type="button" className="story-map__reset" onClick={props.onReset}>
          Tutti
        </button>
      </div>

      {props.symbols.length > 0 ? (
        <div className="story-map__symbol-grid">
          {props.symbols.map((symbol) => {
            const isSelected = symbol.id === props.selectedSymbolId

            return (
              <button
                type="button"
                key={symbol.id}
                className={isSelected ? 'story-map__symbol is-selected' : 'story-map__symbol'}
                onClick={() => props.onSelectSymbol(symbol.id)}
                aria-label={symbol.label}
              >
                <SymbolIcon
                  className="story-map__symbol-icon"
                  src={resolveSymbolIconUrl(symbol.id, import.meta.env.BASE_URL)}
                />
                <span>{symbol.label}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="story-map__empty">{props.emptyState}</p>
      )}
    </div>
  )
}
