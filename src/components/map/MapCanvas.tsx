import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { MapTomb } from '../../types/map'

type MapCanvasProps = {
  svgSrc: string
  viewBox?: string
  tombs: MapTomb[]
  activeTombIds: string[]
  focusedTombIds: string[]
  selectedTombId: string | null
  activePathColor: string
  onSelectTomb: (tombId: string) => void
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

type SvgMarkupParts = {
  staticMarkup: string
  contentMarkup: string
}

const HOVER_TOMB_COLOR = '#FF4BA0'
const MIN_ZOOM_RATIO = 0.08
const ZOOM_EPSILON = 0.0001
const MOBILE_LAYOUT_QUERY = '(max-width: 900px)'
const GRAPHIC_SELECTOR = 'path, polygon, rect, circle, ellipse, line, polyline'
const SVG_STATIC_TAGS = new Set(['defs', 'style', 'metadata', 'title', 'desc'])

function stripSvgNamespacePrefixes(markup: string) {
  return markup.replace(/<(\/?)(?:[A-Za-z_][\w.-]*:)/g, '<$1')
}

function parseViewBox(value: string): Box {
  const [x, y, width, height] = value.split(/\s+/).map(Number)
  return { x, y, width, height }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(color: string) {
  const normalized = color.trim().replace('#', '')
  const expanded =
    normalized.length === 3 ? normalized.split('').map((segment) => `${segment}${segment}`).join('') : normalized

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return null
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  }
}

function withAlpha(color: string, alpha: number) {
  const rgb = hexToRgb(color)

  if (!rgb) {
    return color
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
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

function findTombById(tombs: MapTomb[], id: string | null) {
  if (!id) {
    return null
  }

  return tombs.find((tomb) => tomb.id === id) ?? null
}

function getTombLabel(tomb: MapTomb | null, tombId: string) {
  return tomb?.nome?.trim() || `Tomba ${tombId}`
}

function resolveTombIdFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  const source = target.closest('.tomb')

  if (!(source instanceof SVGElement)) {
    return null
  }

  return source.getAttribute('data-monumap-tomb-id') ?? source.getAttribute('id')
}

function resolveActiveTombFromTarget(tombs: MapTomb[], activeTombIds: string[], target: EventTarget | null) {
  const tombId = resolveTombIdFromTarget(target)

  if (!tombId || !activeTombIds.includes(tombId)) {
    return null
  }

  return findTombById(tombs, tombId)
}

function resolveActiveBounds(sourceBox: Box, isMobileLayout: boolean): Box {
  if (!isMobileLayout) {
    return sourceBox
  }

  return {
    x: 0,
    y: 0,
    width: sourceBox.height,
    height: sourceBox.width,
  }
}

function buildMobileTransform(sourceBox: Box) {
  return `translate(${-sourceBox.y} ${sourceBox.x + sourceBox.width}) rotate(-90)`
}

function splitSvgMarkup(svgElement: Element): SvgMarkupParts {
  const serializer = new XMLSerializer()
  const staticNodes: string[] = []
  const contentNodes: string[] = []

  Array.from(svgElement.childNodes).forEach((node) => {
    const serialized = serializer.serializeToString(node)

    if (!serialized.trim()) {
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element

      if (SVG_STATIC_TAGS.has(element.tagName.toLowerCase())) {
        staticNodes.push(serialized)
        return
      }
    }

    contentNodes.push(serialized)
  })

  return {
    staticMarkup: stripSvgNamespacePrefixes(staticNodes.join('')),
    contentMarkup: stripSvgNamespacePrefixes(contentNodes.join('')),
  }
}

function applyTombBindings(
  svg: SVGSVGElement,
  tombs: MapTomb[],
  activeTombIds: string[],
  focusedTombIds: string[],
  selectedTombId: string | null,
  hoveredTombId: string | null,
  activePathColor: string,
) {
  const activeSet = new Set(activeTombIds)
  const focusedSet = new Set(focusedTombIds)
  const hasFocusedObjects = focusedSet.size > 0
  const pathFillColor = withAlpha(activePathColor, 0.12)
  const pathStrokeColor = withAlpha(activePathColor, 0.5)
  const focusedFillColor = withAlpha(activePathColor, 0.64)
  const selectedFillColor = withAlpha(activePathColor, 0.9)

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
    const isFocused = hasFocusedObjects ? focusedSet.has(tombId) : false
    const isSelected = tombId === selectedTombId
    const tomb = findTombById(tombs, tombId)
    const runtimeAugment =
      isHovered
        ? `cursor:${isActive ? 'pointer' : 'crosshair'};opacity:1;fill:${HOVER_TOMB_COLOR};stroke:${HOVER_TOMB_COLOR};stroke-width:${isActive ? '5px' : '3px'};filter:drop-shadow(0 0 16px ${HOVER_TOMB_COLOR});vector-effect:non-scaling-stroke;`
        : isActive && isSelected
          ? `cursor:pointer;opacity:1;fill:${selectedFillColor};filter:drop-shadow(0 0 20px ${activePathColor});stroke:${activePathColor};stroke-width:5px;vector-effect:non-scaling-stroke;`
          : isActive && isFocused
            ? `cursor:pointer;opacity:1;fill:${focusedFillColor};filter:drop-shadow(0 0 16px ${activePathColor});stroke:${activePathColor};stroke-width:4px;vector-effect:non-scaling-stroke;`
            : isActive
              ? `cursor:pointer;opacity:1;fill:${pathFillColor};filter:none;stroke:${pathStrokeColor};stroke-width:1.8px;vector-effect:non-scaling-stroke;`
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

function useIsMobileLayout(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(query)
    const updateMatch = () => setMatches(mediaQuery.matches)
    updateMatch()

    mediaQuery.addEventListener('change', updateMatch)

    return () => {
      mediaQuery.removeEventListener('change', updateMatch)
    }
  }, [query])

  return matches
}

export function MapCanvas({
  svgSrc,
  viewBox,
  tombs,
  activeTombIds,
  focusedTombIds,
  selectedTombId,
  activePathColor,
  onSelectTomb,
}: MapCanvasProps) {
  const isMobileLayout = useIsMobileLayout(MOBILE_LAYOUT_QUERY)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    box: Box
  } | null>(null)
  const [sourceBox, setSourceBox] = useState<Box | null>(() => (viewBox ? parseViewBox(viewBox) : null))
  const [activeViewBox, setActiveViewBox] = useState<Box | null>(() => (viewBox ? parseViewBox(viewBox) : null))
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 })
  const [hoveredTombId, setHoveredTombId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [svgMarkupParts, setSvgMarkupParts] = useState<SvgMarkupParts | null>(null)
  const [svgError, setSvgError] = useState<string | null>(null)

  const bounds = sourceBox ? resolveActiveBounds(sourceBox, isMobileLayout) : null
  const boundsX = bounds?.x ?? null
  const boundsY = bounds?.y ?? null
  const boundsWidth = bounds?.width ?? null
  const boundsHeight = bounds?.height ?? null
  const svgMarkup =
    svgMarkupParts && sourceBox
      ? isMobileLayout
        ? `${svgMarkupParts.staticMarkup}<g transform="${buildMobileTransform(sourceBox)}">${svgMarkupParts.contentMarkup}</g>`
        : `${svgMarkupParts.staticMarkup}${svgMarkupParts.contentMarkup}`
      : ''

  useEffect(() => {
    setHoveredTombId(null)
    setTooltip(null)
  }, [svgSrc, viewBox])

  useEffect(() => {
    if (boundsX === null || boundsY === null || boundsWidth === null || boundsHeight === null) {
      setActiveViewBox(null)
      return
    }

    setActiveViewBox({
      x: boundsX,
      y: boundsY,
      width: boundsWidth,
      height: boundsHeight,
    })
  }, [boundsHeight, boundsWidth, boundsX, boundsY])

  useEffect(() => {
    let cancelled = false

    async function loadSvg() {
      try {
        const response = await fetch(svgSrc)

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

        const resolvedViewBox = viewBox ?? document.documentElement.getAttribute('viewBox')?.trim()

        if (!resolvedViewBox) {
          throw new Error("L'SVG non definisce un viewBox.")
        }

        if (!cancelled) {
          setSourceBox(parseViewBox(resolvedViewBox))
          setSvgMarkupParts(splitSvgMarkup(document.documentElement))
          setSvgError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setSourceBox(null)
          setSvgMarkupParts(null)
          setSvgError(error instanceof Error ? error.message : "Errore sconosciuto durante il caricamento dell'SVG.")
        }
      }
    }

    void loadSvg()

    return () => {
      cancelled = true
    }
  }, [svgSrc, viewBox])

  useEffect(() => {
    const stage = stageRef.current

    if (!stage || boundsX === null || boundsY === null || boundsWidth === null || boundsHeight === null) {
      return
    }

    const nextBounds = {
      x: boundsX,
      y: boundsY,
      width: boundsWidth,
      height: boundsHeight,
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

      setActiveViewBox((current) => {
        if (!current) {
          return current
        }

        const centerX = current.x + relativeX * current.width
        const centerY = current.y + relativeY * current.height

        return zoomBox(current, nextBounds, factor, centerX, centerY)
      })
    }

    stage.addEventListener('wheel', handleNativeWheel, { passive: false })

    return () => {
      stage.removeEventListener('wheel', handleNativeWheel)
    }
  }, [boundsHeight, boundsWidth, boundsX, boundsY])

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

    applyTombBindings(
      svg,
      tombs,
      activeTombIds,
      focusedTombIds,
      selectedTombId,
      hoveredTombId,
      activePathColor,
    )
  }, [activePathColor, activeTombIds, focusedTombIds, hoveredTombId, selectedTombId, svgMarkup, tombs])

  function resetZoom() {
    if (bounds) {
      setActiveViewBox(bounds)
    }
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!activeViewBox) {
      return
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (resolveActiveTombFromTarget(tombs, activeTombIds, event.target)) {
      return
    }

    event.preventDefault()

    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      box: activeViewBox,
    }

    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current

    if (drag && drag.pointerId === event.pointerId) {
      const svg = svgRef.current

      if (!svg || !bounds) {
        return
      }

      const rect = svg.getBoundingClientRect()
      const deltaX = ((event.clientX - drag.clientX) / rect.width) * drag.box.width
      const deltaY = ((event.clientY - drag.clientY) / rect.height) * drag.box.height

      setActiveViewBox(
        clampBox(
          {
            x: drag.box.x - deltaX,
            y: drag.box.y - deltaY,
            width: drag.box.width,
            height: drag.box.height,
          },
          bounds,
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
    const tomb = resolveActiveTombFromTarget(tombs, activeTombIds, event.target)

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
    const tomb = resolveActiveTombFromTarget(tombs, activeTombIds, event.target)

    if (tomb) {
      onSelectTomb(tomb.id)
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    const tomb = resolveActiveTombFromTarget(tombs, activeTombIds, event.target)

    if (!tomb) {
      return
    }

    event.preventDefault()
    onSelectTomb(tomb.id)
  }

  function zoomTo(factor: number) {
    if (!bounds || !activeViewBox) {
      return
    }

    const centerX = activeViewBox.x + activeViewBox.width / 2
    const centerY = activeViewBox.y + activeViewBox.height / 2
    setActiveViewBox((current) => (current ? zoomBox(current, bounds, factor, centerX, centerY) : current))
  }

  return (
    <>
      <div ref={stageRef} className={isMobileLayout ? 'story-map__stage is-mobile' : 'story-map__stage'}>
        <div className="story-map__controls">
          <button type="button" className="story-map__control" onClick={() => zoomTo(0.84)}>
            +
          </button>
          <button type="button" className="story-map__control" onClick={() => zoomTo(1.16)}>
            -
          </button>
          <button type="button" className="story-map__control story-map__control--wide" onClick={resetZoom}>
            Reset
          </button>
        </div>

        {svgError ? (
          <div className="map-loading">{svgError}</div>
        ) : !svgMarkup || !activeViewBox ? (
          <div className="map-loading">Caricamento della planimetria in corso.</div>
        ) : (
          <svg
            ref={svgRef}
            className={isDragging ? 'map-canvas is-dragging' : 'map-canvas'}
            viewBox={`${activeViewBox.x} ${activeViewBox.y} ${activeViewBox.width} ${activeViewBox.height}`}
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
      </div>

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
    </>
  )
}
