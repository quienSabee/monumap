import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { MapBlock, MapFilterOption, MapObject } from '../types/story'

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
  object: MapObject
  x: number
  y: number
}

type ObjectTheme = {
  pathId: string
  pathLabel: string
  pathColor: string
}

const DEFAULT_PATH_COLOR = '#F9DC5C'

function parseViewBox(value: string): Box {
  const [x, y, width, height] = value.split(/\s+/).map(Number)
  return { x, y, width, height }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampBox(box: Box, bounds: Box): Box {
  const width = clamp(box.width, bounds.width * 0.18, bounds.width)
  const height = clamp(box.height, bounds.height * 0.18, bounds.height)
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
  const width = box.width * factor
  const height = box.height * factor
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

function buildObjectThemes(options: MapFilterOption[]): Record<string, ObjectTheme> {
  const themes: Record<string, ObjectTheme> = {}

  function visit(option: MapFilterOption, topLevel: MapFilterOption) {
    option.targets.forEach((target) => {
      themes[target] = {
        pathId: topLevel.id,
        pathLabel: topLevel.label,
        pathColor: topLevel.color ?? DEFAULT_PATH_COLOR,
      }
    })

    option.children.forEach((child) => visit(child, topLevel))
  }

  options.forEach((option) => {
    visit(option, option)
  })

  return themes
}

function collectTargets(option: MapFilterOption): string[] {
  const targets = new Set(option.targets)

  option.children.forEach((child) => {
    collectTargets(child).forEach((target) => targets.add(target))
  })

  return Array.from(targets)
}

function resolveActiveObjectIds(block: MapBlock, path: string[]): string[] {
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

function findObjectById(objects: MapObject[], id: string | null): MapObject | null {
  if (!id) {
    return null
  }

  return objects.find((object) => object.id === id) ?? null
}

function findTopLevelOption(options: MapFilterOption[], id: string | null): MapFilterOption | null {
  if (!id) {
    return null
  }

  return options.find((option) => option.id === id) ?? null
}

function resolveObjectFromTarget(objects: MapObject[], target: EventTarget | null): MapObject | null {
  if (!(target instanceof Element)) {
    return null
  }

  const source = target.closest('[data-monumap-object-id]')
  const objectId = source?.getAttribute('data-monumap-object-id') ?? null

  return findObjectById(objects, objectId)
}

function applyObjectBindings(
  svg: SVGSVGElement,
  block: MapBlock,
  activeObjectIds: string[],
  objectThemes: Record<string, ObjectTheme>,
  focusedObjectIds: string[],
) {
  const activeSet = new Set(activeObjectIds)
  const focusedSet = new Set(focusedObjectIds)
  const hasFocusedObjects = focusedSet.size > 0

  svg.querySelectorAll('[data-monumap-object-id]').forEach((node) => {
    if (!(node instanceof SVGElement)) {
      return
    }

    const originalStyle = node.getAttribute('data-monumap-original-style')

    if (originalStyle === null || originalStyle === '') {
      node.removeAttribute('style')
    } else {
      node.setAttribute('style', originalStyle)
    }

    node.removeAttribute('data-monumap-object-id')
    node.removeAttribute('data-monumap-original-style')
    node.removeAttribute('tabindex')
    node.removeAttribute('role')
    node.removeAttribute('aria-label')
  })

  block.objects.forEach((object) => {
    const isActive = activeSet.has(object.id)
    const theme = objectThemes[object.id]
    const color = theme?.pathColor ?? DEFAULT_PATH_COLOR
    const isFocused = hasFocusedObjects ? focusedSet.has(object.id) : true

    object.svgIds.forEach((svgId) => {
      const element = svg.querySelector(`[id="${svgId}"]`)

      if (!(element instanceof SVGElement)) {
        return
      }

      const originalStyle = element.getAttribute('style') ?? ''

      element.setAttribute('data-monumap-object-id', object.id)
      element.setAttribute('data-monumap-original-style', originalStyle)

      const separator = originalStyle && !originalStyle.trim().endsWith(';') ? ';' : ''
      const runtimeStyle = isActive
        ? `${originalStyle}${separator}pointer-events:auto;cursor:pointer;opacity:${isFocused ? '1' : '0.76'};filter:drop-shadow(0 0 ${isFocused ? '16px' : '9px'} ${color});stroke:${color};stroke-width:${isFocused ? '5px' : '3px'};vector-effect:non-scaling-stroke;`
        : `${originalStyle}${separator}pointer-events:none;`

      element.setAttribute('style', runtimeStyle)

      if (isActive) {
        element.setAttribute('tabindex', '0')
        element.setAttribute('role', 'button')
        element.setAttribute('aria-label', object.title)
      } else {
        element.removeAttribute('tabindex')
        element.removeAttribute('role')
        element.removeAttribute('aria-label')
      }
    })
  })
}

export function InteractiveMap({ block }: InteractiveMapProps) {
  const originalBox = parseViewBox(block.viewBox)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    box: Box
  } | null>(null)
  const [selectedPath, setSelectedPath] = useState<string[]>([])
  const [viewBox, setViewBox] = useState<Box>(originalBox)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [openObject, setOpenObject] = useState<MapObject | null>(null)
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
  const activeObjectIds = resolveActiveObjectIds(block, selectedPath)
  const activePathOption = findTopLevelOption(block.filters.options, selectedPath[0] ?? null)
  const activeSymbolOption =
    selectedPath.length > 1 ? findOptionByPath(block.filters.options, selectedPath) : null
  const activePathColor = activePathOption?.color ?? DEFAULT_PATH_COLOR

  useEffect(() => {
    const svg = svgRef.current
    const objectThemes = buildObjectThemes(block.filters.options)
    const focusedObjectIds =
      activeSymbolOption && activeSymbolOption.children.length === 0
        ? collectTargets(activeSymbolOption)
        : []

    if (!svg || !svgMarkup) {
      return
    }

    applyObjectBindings(svg, block, activeObjectIds, objectThemes, focusedObjectIds)
  }, [activeObjectIds, activeSymbolOption, block, svgMarkup])

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

    if (resolveObjectFromTarget(block.objects, event.target)) {
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

      return
    }

    const object = resolveObjectFromTarget(block.objects, event.target)
    const frame = svgRef.current?.getBoundingClientRect()

    if (!object || !frame) {
      setTooltip(null)
      return
    }

    setTooltip({
      object,
      x: event.clientX - frame.left + 18,
      y: event.clientY - frame.top + 18,
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
    const object = resolveObjectFromTarget(block.objects, event.target)

    if (object) {
      setOpenObject(object)
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const object = resolveObjectFromTarget(block.objects, event.target)

    if (!object) {
      return
    }

    event.preventDefault()
    setOpenObject(object)
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

          {activePathOption ? (
            <div
              className="filter-status"
              style={
                {
                  '--status-color': activePathColor,
                } as CSSProperties
              }
            >
              <div className="filter-status__item">
                <span className="filter-status__swatch" />
                <div>
                  <span className="filter-status__label">Percorso attivo</span>
                  <strong className="filter-status__value">{activePathOption.label}</strong>
                </div>
              </div>
              <div className="filter-status__item">
                <span className="filter-status__label">
                  {activeSymbolOption ? 'Simbolo attivo' : 'Simboli selezionabili'}
                </span>
                <strong className="filter-status__value">
                  {activeSymbolOption ? activeSymbolOption.label : `${activeObjectIds.length} simboli del percorso`}
                </strong>
              </div>
            </div>
          ) : (
            <div className="filter-status filter-status--idle">
              Seleziona un percorso per attivare tutti i simboli associati nella planimetria.
            </div>
          )}

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
                      {option.label}
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
          <span className="legend-dot" />
          <p>
            {activePathOption
              ? activeSymbolOption
                ? `Il percorso ${activePathOption.label} resta attivo; ${activeSymbolOption.label} e il simbolo in evidenza.`
                : `Tutti gli elementi del percorso ${activePathOption.label} sono ora selezionabili nella mappa.`
              : 'Gli oggetti restano inattivi finche non selezioni un percorso tematico.'}
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
              setTooltip(null)
            }}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        )}

        {tooltip && (
          <div
            className="map-tooltip"
            style={{
              left: tooltip.x,
              top: tooltip.y,
            }}
          >
            <strong>{tooltip.object.title}</strong>
            <span>{tooltip.object.legend}</span>
          </div>
        )}
      </div>

      {openObject && (
        <div className="map-modal" onClick={() => setOpenObject(null)}>
          <article className="map-modal__card" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="ghost-button map-modal__close"
              onClick={() => setOpenObject(null)}
            >
              Chiudi
            </button>
            <span className="story-kicker">Approfondimento</span>
            <h3>{openObject.title}</h3>
            {openObject.legend && <p className="map-modal__legend">{openObject.legend}</p>}
            {openObject.summary && <p>{openObject.summary}</p>}
            {openObject.details && <p>{openObject.details}</p>}
          </article>
        </div>
      )}
    </section>
  )
}
