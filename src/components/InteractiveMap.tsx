import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { MapBlock, MapFilterOption, MapTomb } from '../types/story'

type InteractiveMapProps = {
  block: MapBlock
}

type Box = {
  x: number
  y: number
  width: number
  height: number
}

type TooltipState = {
  tombId: string
  tomb: MapTomb | null
  x: number
  y: number
}

const DEFAULT_PATH_COLOR = '#F9DC5C'
const HOVER_TOMB_COLOR = '#FF00A8'
const MIN_ZOOM_RATIO = 0.08
const ZOOM_EPSILON = 0.0001
const SYMBOL_ICON_BASE = `${import.meta.env.BASE_URL}media/symbols/`
const GRAPHIC_SELECTOR = 'path, polygon, rect, circle, ellipse, line, polyline'

function parseViewBox(value: string): Box {
  const [x, y, width, height] = value.split(/\s+/).map(Number)
  return { x, y, width, height }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampBox(box: Box, bounds: Box): Box {
  const width = clamp(box.width, bounds.width * MIN_ZOOM_RATIO, bounds.width)
  const height = clamp(box.height, bounds.height * MIN_ZOOM_RATIO, bounds.height)
  const maxX = bounds.x + bounds.width - width
  const maxY = bounds.y + bounds.height - height

  return {
    x: clamp(box.x, bounds.x, maxX),
    y: clamp(box.y, bounds.y, maxY),
    width,
    height,
  }
}

function zoomBox(box: Box, bounds: Box, factor: number, centerX: number, centerY: number): Box {
  const minWidth = bounds.width * MIN_ZOOM_RATIO
  const minHeight = bounds.height * MIN_ZOOM_RATIO
  const width = clamp(box.width * factor, minWidth, bounds.width)
  const height = clamp(box.height * factor, minHeight, bounds.height)

  if (Math.abs(width - box.width) < ZOOM_EPSILON && Math.abs(height - box.height) < ZOOM_EPSILON) {
    return box
  }

  const nextX = centerX - ((centerX - box.x) / box.width) * width
  const nextY = centerY - ((centerY - box.y) / box.height) * height

  return clampBox(
    {
      x: nextX,
      y: nextY,
      width,
      height,
    },
    bounds,
  )
}

function findOptionByPath(options: MapFilterOption[], path: string[]): MapFilterOption | null {
  let currentOptions = options
  let currentNode: MapFilterOption | null = null

  for (const id of path) {
    currentNode = currentOptions.find((option) => option.id === id) ?? null

    if (!currentNode) {
      return null
    }

    currentOptions = currentNode.children
  }

  return currentNode
}

function buildLevels(options: MapFilterOption[], path: string[]): MapFilterOption[][] {
  const levels: MapFilterOption[][] = [options]
  let currentOptions = options

  for (const id of path) {
    const currentNode = currentOptions.find((option) => option.id === id)

    if (!currentNode || currentNode.children.length === 0) {
      break
    }

    levels.push(currentNode.children)
    currentOptions = currentNode.children
  }

  return levels
}

function collectTargets(option: MapFilterOption): string[] {
  const targets = new Set(option.targets)

  option.children.forEach((child) => {
    collectTargets(child).forEach((target) => targets.add(target))
  })

  return Array.from(targets)
}

function resolveFocusedTombIds(option: MapFilterOption | null): string[] {
  return option && option.children.length === 0 ? collectTargets(option) : []
}

function resolveActiveTombIds(block: MapBlock, path: string[]): string[] {
  if (path.length === 0) {
    return block.defaultTargets
  }

  const selectedNode = block.filters.options.find((option) => option.id === path[0]) ?? null

  if (!selectedNode) {
    return block.defaultTargets
  }

  const targets = collectTargets(selectedNode)
  return targets.length > 0 ? targets : block.defaultTargets
}

function findTombById(tombs: MapTomb[], id: string | null): MapTomb | null {
  if (!id) {
    return null
  }

  return tombs.find((tomb) => tomb.id === id) ?? null
}

function getTombLabel(tomb: MapTomb | null, tombId: string): string {
  return tomb?.nome?.trim() || `Tomba ${tombId}`
}

function findTopLevelOption(options: MapFilterOption[], id: string | null): MapFilterOption | null {
  if (!id) {
    return null
  }

  return options.find((option) => option.id === id) ?? null
}

function resolveTombIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null
  }

  const source = target.closest('.tomb')

  if (!(source instanceof SVGElement)) {
    return null
  }

  return source.getAttribute('data-monumap-tomb-id') ?? source.getAttribute('id')
}

function resolveActiveTombFromTarget(
  tombs: MapTomb[],
  activeTombIds: string[],
  target: EventTarget | null,
): MapTomb | null {
  const tombId = resolveTombIdFromTarget(target)

  if (!tombId || !activeTombIds.includes(tombId)) {
    return null
  }

  return findTombById(tombs, tombId)
}

function applyTombBindings(
  svg: SVGSVGElement,
  block: MapBlock,
  activeTombIds: string[],
  focusedTombIds: string[],
  hoveredTombId: string | null,
  activePathColor: string,
) {
  const activeSet = new Set(activeTombIds)
  const focusedSet = new Set(focusedTombIds)
  const hasFocusedObjects = focusedSet.size > 0

  svg.querySelectorAll('.tomb').forEach((node) => {
    if (!(node instanceof SVGElement) || node.closest('defs')) {
      return
    }

    const tombId = node.getAttribute('data-monumap-tomb-id')?.trim() ?? node.getAttribute('id')?.trim()

    if (!tombId) {
      return
    }

    const styledNodes =
      node.tagName.toLowerCase() === 'g'
        ? Array.from(node.querySelectorAll(GRAPHIC_SELECTOR)).filter(
            (child): child is SVGElement => child instanceof SVGElement && !child.closest('defs'),
          )
        : [node]

    const isActive = activeSet.has(tombId)
    const isHovered = tombId === hoveredTombId
    const isFocused = hasFocusedObjects ? focusedSet.has(tombId) : true
    const tomb = findTombById(block.tombs, tombId)
    const runtimeAugment =
      isHovered
        ? `cursor:${isActive ? 'pointer' : 'crosshair'};opacity:1;fill:${HOVER_TOMB_COLOR};stroke:${HOVER_TOMB_COLOR};stroke-width:${isActive ? '5px' : '3px'};filter:drop-shadow(0 0 16px ${HOVER_TOMB_COLOR});vector-effect:non-scaling-stroke;`
        : isActive
          ? `cursor:pointer;opacity:${isFocused ? '1' : '0.76'};filter:drop-shadow(0 0 ${isFocused ? '16px' : '9px'} ${activePathColor});stroke:${activePathColor};stroke-width:${isFocused ? '5px' : '3px'};vector-effect:non-scaling-stroke;`
          : 'cursor:crosshair;opacity:1;filter:none;'

    styledNodes.forEach((styledNode) => {
      const originalStyle = styledNode.getAttribute('data-monumap-original-style') ?? styledNode.getAttribute('style') ?? ''

      if (!styledNode.hasAttribute('data-monumap-original-style')) {
        styledNode.setAttribute('data-monumap-original-style', originalStyle)
      }

      const separator = originalStyle && !originalStyle.trim().endsWith(';') ? ';' : ''
      styledNode.setAttribute(
        'style',
        `${originalStyle}${separator}pointer-events:all;transition:fill 120ms ease, stroke 120ms ease, filter 120ms ease, opacity 120ms ease;${runtimeAugment}`,
      )
    })

    if (isActive) {
      node.setAttribute('tabindex', '0')
      node.setAttribute('role', 'button')
      node.setAttribute('aria-label', getTombLabel(tomb, tombId))
    } else {
      node.removeAttribute('tabindex')
      node.removeAttribute('role')
      node.setAttribute('aria-label', `Tomba ${tombId}`)
    }
  })
}

export function InteractiveMap({ block }: InteractiveMapProps) {
  const originalBox = parseViewBox(block.viewBox)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    box: Box
  } | null>(null)
  const [selectedPath, setSelectedPath] = useState<string[]>([])
  const [viewBox, setViewBox] = useState<Box>(originalBox)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 })
  const [openTomb, setOpenTomb] = useState<MapTomb | null>(null)
  const [hoveredTombId, setHoveredTombId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [svgMarkup, setSvgMarkup] = useState('')
  const [svgError, setSvgError] = useState<string | null>(null)

  useEffect(() => {
    setViewBox(parseViewBox(block.viewBox))
    setSelectedPath([])
  }, [block.viewBox])

  useEffect(() => {
    let cancelled = false

    async function loadSvg() {
      try {
        const response = await fetch(block.svg)

        if (!response.ok) {
          throw new Error(`Impossibile caricare l'SVG (${response.status}).`)
        }

        const source = await response.text()
        const parser = new DOMParser()
        const document = parser.parseFromString(source, 'image/svg+xml')
        const parserError = document.querySelector('parsererror')

        if (parserError) {
          throw new Error('Il file SVG non e valido.')
        }

        if (!cancelled) {
          setSvgMarkup(document.documentElement.innerHTML)
          setSvgError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setSvgMarkup('')
          setSvgError(error instanceof Error ? error.message : 'Errore sconosciuto durante il caricamento dell\'SVG.')
        }
      }
    }

    loadSvg()

    return () => {
      cancelled = true
    }
  }, [block.svg])

  useEffect(() => {
    const stage = stageRef.current
    const bounds = parseViewBox(block.viewBox)

    if (!stage) {
      return
    }

    function handleNativeWheel(event: WheelEvent) {
      const svg = svgRef.current

      if (!svg) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const rect = svg.getBoundingClientRect()
      const relativeX = (event.clientX - rect.left) / rect.width
      const relativeY = (event.clientY - rect.top) / rect.height
      const factor = event.deltaY < 0 ? 0.86 : 1.14

      setViewBox((current) => {
        const centerX = current.x + relativeX * current.width
        const centerY = current.y + relativeY * current.height

        return zoomBox(current, bounds, factor, centerX, centerY)
      })
    }

    stage.addEventListener('wheel', handleNativeWheel, { passive: false })

    return () => {
      stage.removeEventListener('wheel', handleNativeWheel)
    }
  }, [block.viewBox])

  const levels = buildLevels(block.filters.options, selectedPath)
  const activeTombIds = resolveActiveTombIds(block, selectedPath)
  const activePathOption = findTopLevelOption(block.filters.options, selectedPath[0] ?? null)
  const activeSymbolOption =
    selectedPath.length > 1 ? findOptionByPath(block.filters.options, selectedPath) : null
  const focusedTombIds = resolveFocusedTombIds(activeSymbolOption)
  const activePathColor = activePathOption?.color ?? DEFAULT_PATH_COLOR
  const activeTombCount = new Set(activeTombIds).size
  const openTombContextSymbols = openTomb
    ? openTomb.symbols.filter((symbol) => {
        if (activeSymbolOption) {
          return symbol.symbolId === activeSymbolOption.id
        }

        if (activePathOption) {
          return symbol.pathId === activePathOption.id
        }

        return true
      })
    : []
  const openTombVisibleSymbols = openTombContextSymbols.length > 0 ? openTombContextSymbols : openTomb?.symbols ?? []
  const openTombKicker =
    activeSymbolOption && activePathOption
      ? `${activePathOption.label} · ${activeSymbolOption.label}`
      : activePathOption?.label ?? openTombVisibleSymbols[0]?.pathLabel ?? 'Tomba catalogata'

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      return
    }

    const margin = 12
    const gap = 18
    const rect = tooltipRef.current.getBoundingClientRect()
    let left = tooltip.x + gap
    let top = tooltip.y + gap

    if (left + rect.width > window.innerWidth - margin) {
      left = tooltip.x - rect.width - gap
    }

    if (top + rect.height > window.innerHeight - margin) {
      top = tooltip.y - rect.height - gap
    }

    left = clamp(left, margin, Math.max(margin, window.innerWidth - rect.width - margin))
    top = clamp(top, margin, Math.max(margin, window.innerHeight - rect.height - margin))

    setTooltipPosition({ left, top })
  }, [tooltip])

  useEffect(() => {
    const svg = svgRef.current

    if (!svg || !svgMarkup) {
      return
    }

    applyTombBindings(svg, block, activeTombIds, focusedTombIds, hoveredTombId, activePathColor)
  }, [activePathColor, activeTombIds, block, focusedTombIds, hoveredTombId, svgMarkup])

  function updatePath(depth: number, optionId: string) {
    setSelectedPath((current) => [...current.slice(0, depth), optionId])
  }

  function resetPath() {
    setSelectedPath([])
  }

  function resetZoom() {
    setViewBox(originalBox)
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (resolveActiveTombFromTarget(block.tombs, activeTombIds, event.target)) {
      return
    }

    event.preventDefault()

    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      box: viewBox,
    }

    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current

    if (drag && drag.pointerId === event.pointerId) {
      const svg = svgRef.current

      if (!svg) {
        return
      }

      const rect = svg.getBoundingClientRect()
      const deltaX = ((event.clientX - drag.clientX) / rect.width) * drag.box.width
      const deltaY = ((event.clientY - drag.clientY) / rect.height) * drag.box.height

      setViewBox(
        clampBox(
          {
            x: drag.box.x - deltaX,
            y: drag.box.y - deltaY,
            width: drag.box.width,
            height: drag.box.height,
          },
          originalBox,
        ),
      )

      setHoveredTombId(null)
      setTooltip(null)
      return
    }

    const tombId = resolveTombIdFromTarget(event.target)

    if (!tombId) {
      setHoveredTombId(null)
      setTooltip(null)
      return
    }

    setHoveredTombId(tombId)
    const tomb = resolveActiveTombFromTarget(block.tombs, activeTombIds, event.target)

    setTooltip({
      tombId,
      tomb,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function releaseDrag(pointerId: number, element: SVGSVGElement | null) {
    if (dragRef.current?.pointerId !== pointerId) {
      return
    }

    dragRef.current = null
    setIsDragging(false)

    if (element?.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId)
    }
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    releaseDrag(event.pointerId, event.currentTarget)
  }

  function handleClick(event: ReactPointerEvent<SVGSVGElement>) {
    const tomb = resolveActiveTombFromTarget(block.tombs, activeTombIds, event.target)

    if (tomb) {
      setOpenTomb(tomb)
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const tomb = resolveActiveTombFromTarget(block.tombs, activeTombIds, event.target)

    if (!tomb) {
      return
    }

    event.preventDefault()
    setOpenTomb(tomb)
  }

  function zoomTo(factor: number) {
    const centerX = viewBox.x + viewBox.width / 2
    const centerY = viewBox.y + viewBox.height / 2
    setViewBox((current) => zoomBox(current, originalBox, factor, centerX, centerY))
  }

  return (
    <section className="story-block story-map" id={block.id}>
      <div className="story-map__panel">
        <span className="story-kicker">Mappa interattiva</span>
        <h2>{block.title}</h2>
        {block.description && <p>{block.description}</p>}

        <div className="story-map__filters">
          <div className="story-map__filters-header">
            <h3>{block.filters.title}</h3>
            <button type="button" className="ghost-button" onClick={resetPath}>
              Reset
            </button>
          </div>

          {levels.map((options, depth) => (
            <div
              className={depth === 0 ? 'filter-group filter-group--primary' : 'filter-group filter-group--secondary'}
              key={`level-${depth}`}
            >
              {depth === 0 ? (
                <span className="filter-group__label">Percorsi</span>
              ) : (
                <>
                  <div className="filter-separator" aria-hidden="true" />
                  <span className="filter-group__label filter-group__label--secondary">Simboli</span>
                </>
              )}

              <div className={depth === 0 ? 'filter-level filter-level--primary' : 'filter-level filter-level--secondary'}>
                {options.map((option) => {
                  const isSelected = selectedPath[depth] === option.id
                  const optionColor =
                    depth === 0
                      ? option.color ?? DEFAULT_PATH_COLOR
                      : activePathOption?.color ?? DEFAULT_PATH_COLOR
                  const symbolIcon = depth > 0 ? `${SYMBOL_ICON_BASE}${option.id}.svg` : null

                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={isSelected ? 'filter-chip is-selected' : 'filter-chip'}
                      onClick={() => updatePath(depth, option.id)}
                      style={
                        {
                          '--filter-color': optionColor,
                        } as CSSProperties
                      }
                    >
                      {symbolIcon && (
                        <img
                          className="filter-chip__icon"
                          src={symbolIcon}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <span className="filter-chip__label">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div
          className="story-map__legend"
          style={
            {
              '--legend-color': activePathColor,
            } as CSSProperties
          }
        >
          <span className="legend-dot" aria-hidden="true" />
          <p>
            {activePathOption
              ? `${activePathOption.label}: ${activeTombCount} tombe attive. Passa il cursore su una tomba per leggere il suo id e clicca solo su quelle evidenziate per aprire la scheda.`
              : "Passa il cursore su una tomba per leggere il suo id. Seleziona un percorso per attivare le schede di catalogazione."}
          </p>
        </div>
      </div>

      <div ref={stageRef} className="story-map__stage">
        <div className="story-map__controls">
          <button type="button" className="icon-button" onClick={() => zoomTo(0.84)}>
            +
          </button>
          <button type="button" className="icon-button" onClick={() => zoomTo(1.16)}>
            -
          </button>
          <button type="button" className="icon-button icon-button--wide" onClick={resetZoom}>
            Reset view
          </button>
        </div>

        {svgError ? (
          <div className="map-loading">{svgError}</div>
        ) : !svgMarkup ? (
          <div className="map-loading">Caricamento della planimetria in corso.</div>
        ) : (
          <svg
            ref={svgRef}
            className={isDragging ? 'map-canvas is-dragging' : 'map-canvas'}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={(event) => {
              releaseDrag(event.pointerId, event.currentTarget)
              setHoveredTombId(null)
              setTooltip(null)
            }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        )}

        {tooltip && (
          <div
            ref={tooltipRef}
            className="map-tooltip"
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
            }}
          >
            <strong>Tomba {tooltip.tombId}</strong>
            {tooltip.tomb && <span>{getTombLabel(tooltip.tomb, tooltip.tombId)}</span>}
          </div>
        )}
      </div>

      {openTomb && (
        <div className="map-modal" onClick={() => setOpenTomb(null)}>
          <article className="map-modal__card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="ghost-button map-modal__close"
              onClick={() => setOpenTomb(null)}
            >
              Chiudi
            </button>
            <span className="story-kicker">{openTombKicker}</span>
            <h3>{getTombLabel(openTomb, openTomb.id)}</h3>
            <p className="map-modal__legend">Tomba {openTomb.id}</p>
            {openTomb.data && <p>{`Data: ${openTomb.data}`}</p>}
            {openTomb.nascita && <p>{`Nascita: ${openTomb.nascita}`}</p>}
            {openTomb.morte && <p>{`Morte: ${openTomb.morte}`}</p>}
            {openTombVisibleSymbols.length > 0 && (
              <p>{`Simboli: ${openTombVisibleSymbols.map((symbol) => symbol.symbolLabel).join(', ')}`}</p>
            )}
            {openTomb.descrizione && <p>{openTomb.descrizione}</p>}
          </article>
        </div>
      )}
    </section>
  )
}
