import { AssetImage } from '../AssetImage'
import type { MapPathOption, MapSymbolOption, MapTomb, MapTombSymbolRef } from '../../types/map'

type MapDetailsProps = {
  activePath: MapPathOption | null
  activeSymbol: MapSymbolOption | null
  selectedTomb: MapTomb | null
  featuredTomb: MapTomb | null
  editorialImageSrc: string
}

function getTombLabel(tomb: MapTomb | null, tombId: string) {
  return tomb?.nome?.trim() || `Tomba ${tombId}`
}

function buildSymbolSummary(pathOption: MapPathOption | null, symbolOption: MapSymbolOption | null) {
  if (!pathOption) {
    return 'Seleziona uno dei fili invisibili per attivare i simboli presenti nella planimetria.'
  }

  if (!symbolOption) {
    return `${pathOption.label} raccoglie ${pathOption.symbols.length} simboli catalogati e ${pathOption.targets.length} sepolture evidenziabili sulla mappa.`
  }

  const tombCount = symbolOption.targets.length
  return `${symbolOption.label} appartiene al percorso ${pathOption.label} ed e presente in ${tombCount} ${tombCount === 1 ? 'tomba' : 'tombe'} catalogate.`
}

function buildTombNarrative(tomb: MapTomb | null, visibleSymbols: MapTombSymbolRef[], isFallback: boolean) {
  if (!tomb) {
    return 'Seleziona una tomba evidenziata nella planimetria per aprire la sua scheda di dettaglio.'
  }

  const facts = [tomb.data ? `datata ${tomb.data}` : null, tomb.morte ? `legata alla memoria del ${tomb.morte}` : null]
    .filter(Boolean)
    .join(', ')

  if (tomb.descrizione) {
    return tomb.descrizione
  }

  if (visibleSymbols.length > 0) {
    return `${isFallback ? 'Scheda di riferimento' : 'Scheda selezionata'} per ${getTombLabel(tomb, tomb.id)}${facts ? `, ${facts}` : ''}. Simboli collegati: ${visibleSymbols
      .map((symbol) => symbol.symbolLabel)
      .join(', ')}.`
  }

  return `${isFallback ? 'Scheda di riferimento' : 'Scheda selezionata'} per ${getTombLabel(tomb, tomb.id)}${facts ? `, ${facts}` : ''}.`
}

export function MapDetails({
  activePath,
  activeSymbol,
  selectedTomb,
  featuredTomb,
  editorialImageSrc,
}: MapDetailsProps) {
  const displayedTomb = selectedTomb ?? featuredTomb
  const visibleSymbols = displayedTomb
    ? displayedTomb.symbols.filter((symbol) => {
        if (activeSymbol) {
          return symbol.symbolId === activeSymbol.id
        }

        if (activePath) {
          return symbol.pathId === activePath.id
        }

        return true
      })
    : []
  const renderedSymbols = visibleSymbols.length > 0 ? visibleSymbols : displayedTomb?.symbols ?? []
  const isFallback = displayedTomb !== null && displayedTomb.id !== selectedTomb?.id

  return (
    <>
      <div className="story-map__selection-copy">
        <article className="story-map__info-card">
          <span className="story-map__section-label">Percorso attivo</span>
          <h3>{activeSymbol?.label ?? activePath?.label ?? 'Percorsi tematici'}</h3>
          <p>{buildSymbolSummary(activePath, activeSymbol)}</p>
        </article>

        <article className="story-map__info-card story-map__info-card--tomb">
          <span className="story-map__section-label">
            {selectedTomb ? 'Tomba selezionata' : 'Scheda in evidenza'}
          </span>
          <h3>{displayedTomb ? getTombLabel(displayedTomb, displayedTomb.id) : 'Nessuna tomba selezionata'}</h3>
          {displayedTomb && <p className="story-map__tomb-id">Tomba {displayedTomb.id}</p>}
          <p>{buildTombNarrative(displayedTomb, renderedSymbols, isFallback)}</p>

          {displayedTomb && (
            <div className="story-map__facts">
              {displayedTomb.data && <span>Data {displayedTomb.data}</span>}
              {displayedTomb.nascita && <span>Nascita {displayedTomb.nascita}</span>}
              {displayedTomb.morte && <span>Morte {displayedTomb.morte}</span>}
            </div>
          )}

          {renderedSymbols.length > 0 && (
            <div className="story-map__tag-list">
              {renderedSymbols.map((symbol) => (
                <span className="story-map__tag" key={`${displayedTomb?.id}-${symbol.symbolId}`}>
                  {symbol.symbolLabel}
                </span>
              ))}
            </div>
          )}
        </article>
      </div>

      <figure className="story-map__editorial">
        <AssetImage
          className="story-map__editorial-image"
          src={editorialImageSrc}
          alt="Dettaglio monumentale del Cimitero Monumentale di Perugia"
          loading="lazy"
          decoding="async"
        />
      </figure>
    </>
  )
}
