import { useEffect } from 'react'
import { ImageCarousel } from '../ImageCarousel'
import { resolveSymbolIconUrl } from '../../lib/assetUrls'
import { SymbolIcon } from './SymbolIcon'
import type { MapPathOption, MapSymbolOption, MapTomb } from '../../types/map'

type MapDetailsProps = {
  activePath: MapPathOption | null
  activeSymbol: MapSymbolOption | null
  selectedTomb: MapTomb | null
  onCloseSelectedTomb: () => void
}

function getTombLabel(tomb: MapTomb | null, tombId: string) {
  return tomb?.nome?.trim() || `Tomba ${tombId}`
}

function buildSymbolSummary(pathOption: MapPathOption | null, symbolOption: MapSymbolOption | null) {
  if (!pathOption) {
    return 'Seleziona uno dei fili invisibili per attivare i simboli presenti nella planimetria.'
  }

  if (symbolOption?.description) {
    return symbolOption.description
  }

  if (pathOption.description) {
    return pathOption.description
  }

  if (!symbolOption) {
    return `${pathOption.label} raccoglie ${pathOption.symbols.length} simboli catalogati e ${pathOption.targets.length} sepolture evidenziabili sulla mappa.`
  }

  const tombCount = symbolOption.targets.length
  return `${symbolOption.label} appartiene al percorso ${pathOption.label} ed e presente in ${tombCount} ${tombCount === 1 ? 'tomba' : 'tombe'} catalogate.`
}

function buildTombDateLabel(tomb: MapTomb | null) {
  if (!tomb) {
    return null
  }

  if (tomb.nascita || tomb.morte) {
    if (tomb.nascita && tomb.morte) {
      return `${tomb.nascita}-${tomb.morte}`
    }

    if (tomb.nascita) {
      return `n. ${tomb.nascita}`
    }

    if (tomb.morte) {
      return `m. ${tomb.morte}`
    }
  }

  return tomb.data ?? null
}

function buildTombNarrative(tomb: MapTomb | null) {
  if (!tomb) {
    return 'Seleziona una tomba evidenziata nella planimetria per aprire la sua scheda di dettaglio.'
  }

  if (tomb.descrizione) {
    return tomb.descrizione
  }

  const dateLabel = buildTombDateLabel(tomb)

  if (dateLabel) {
    return `Scheda selezionata per ${getTombLabel(tomb, tomb.id)}, ${dateLabel}.`
  }

  return `Scheda selezionata per ${getTombLabel(tomb, tomb.id)}.`
}

export function MapDetails({
  activePath,
  activeSymbol,
  selectedTomb,
  onCloseSelectedTomb,
}: MapDetailsProps) {
  const renderedSymbols = selectedTomb?.symbols ?? []
  const tombDateLabel = buildTombDateLabel(selectedTomb)
  const modalSlides = (selectedTomb?.images ?? []).map((src, index) => ({
    src,
    alt: `${getTombLabel(selectedTomb, selectedTomb?.id ?? String(index + 1))} - immagine ${index + 1}`,
  }))

  useEffect(() => {
    if (!selectedTomb) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseSelectedTomb()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCloseSelectedTomb, selectedTomb])

  return (
    <>
      <div className="story-map__selection-copy">
        <article className="story-map__info-card">
          <span className="story-map__section-label">Percorso</span>
          <div className="story-map__active-symbol-row">
            {activeSymbol && (
              <div className="story-map__active-symbol" aria-hidden="true">
                <SymbolIcon
                  className="story-map__active-symbol-icon"
                  src={resolveSymbolIconUrl(activeSymbol.id, import.meta.env.BASE_URL)}
                />
              </div>
            )}
            <h3>{activeSymbol?.label ?? activePath?.label ?? 'Percorsi tematici'}</h3>
          </div>
          <p>{buildSymbolSummary(activePath, activeSymbol)}</p>
        </article>
      </div>

      {selectedTomb && (
        <div className="story-map__modal-backdrop" onClick={onCloseSelectedTomb}>
          <div
            className="story-map__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-map-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="story-map__modal-close"
              onClick={onCloseSelectedTomb}
              aria-label="Chiudi scheda tomba"
            >
              &times;
            </button>

            <div className="story-map__modal-header">
              <h3 id="story-map-modal-title">{getTombLabel(selectedTomb, selectedTomb.id)}</h3>
              {tombDateLabel && <p className="story-map__modal-date">{tombDateLabel}</p>}
            </div>

            {renderedSymbols.length > 0 && (
              <div className="story-map__modal-symbol-list" aria-label="Simboli associati alla tomba">
                {renderedSymbols.map((symbol) => (
                  <span
                    className="story-map__modal-symbol"
                    key={`${selectedTomb.id}-${symbol.symbolId}`}
                    title={symbol.symbolLabel}
                    aria-label={symbol.symbolLabel}
                    role="img"
                  >
                    <SymbolIcon
                      className="story-map__modal-symbol-icon"
                      src={resolveSymbolIconUrl(symbol.symbolId, import.meta.env.BASE_URL)}
                    />
                  </span>
                ))}
              </div>
            )}

            <p className="story-map__modal-description">{buildTombNarrative(selectedTomb)}</p>

            {modalSlides.length > 0 && (
              <div className="story-map__modal-carousel">
                <ImageCarousel
                  slides={modalSlides}
                  autoPlayMs={4800}
                  ariaLabel={`Immagini associate a ${getTombLabel(selectedTomb, selectedTomb.id)}`}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
