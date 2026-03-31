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

const ACTIVE_TOMB_FILL = '#7A1145'
const ACTIVE_TOMB_STROKE = '#662345'
const ACTIVE_TOMB_STROKE_HOVER = '#5A1639'
const ACTIVE_TOMB_AURA = '#7A1145'
const TOMB_AURA_FILTER_ID = 'monumap-tomb-aura-blur'
const TOMB_SELECTION_LAYER_ID = 'monumap-selection-overlay'
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

function getTooltipLabel(tomb: MapTomb | null) {
  return tomb?.nome?.trim() || 'Tomba'
}

function getStyleDeclarationValue(style: string, property: string) {
  const pattern = new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i')
  return style.match(pattern)?.[1]?.trim() ?? null
}

function getExplicitPaintValue(node: SVGElement, property: 'fill' | 'stroke', originalStyle: string) {
  const attributeValue = node.getAttribute(property)?.trim()

  if (attributeValue) {
    return attributeValue
  }

  return getStyleDeclarationValue(originalStyle, property)
}

function supportsFillOverride(node: SVGElement, originalStyle: string) {
  const tagName = node.tagName.toLowerCase()

  if (tagName === 'line' || tagName === 'polyline') {
    return false
  }

  const fillValue = getExplicitPaintValue(node, 'fill', originalStyle)
  return fillValue?.toLowerCase() !== 'none'
}

function supportsStrokeOverride(node: SVGElement, originalStyle: string) {
  const strokeValue = getExplicitPaintValue(node, 'stroke', originalStyle)
  return Boolean(strokeValue && strokeValue.toLowerCase() !== 'none')
}

function createInteractionDefs() {
  return [
    `<defs>`,
    `<filter id="${TOMB_AURA_FILTER_ID}" x="-220%" y="-220%" width="540%" height="540%" color-interpolation-filters="sRGB">`,
    `<feGaussianBlur in="SourceGraphic" stdDeviation="4.8" result="blurred" />`,
    `<feComponentTransfer in="blurred" result="softened">`,
    `<feFuncA type="gamma" amplitude="0.9" exponent="0.8" offset="0" />`,
    `</feComponentTransfer>`,
    `<feMerge><feMergeNode in="softened" /></feMerge>`,
    `</filter>`,
    `</defs>`,
  ].join('')
}

function createSelectionOverlayMarkup() {
  return `<g id="${TOMB_SELECTION_LAYER_ID}" pointer-events="none"></g>`
}

function getTombStyledNodes(node: SVGElement) {
  return node.tagName.toLowerCase() === 'g'
    ? Array.from(node.querySelectorAll(GRAPHIC_SELECTOR)).filter(
        (child): child is SVGElement => child instanceof SVGElement && !child.closest('defs'),
      )
    : [node]
}

function clearTombAuraClones(svg: SVGSVGElement) {
  svg.querySelectorAll('[data-monumap-aura-clone="true"]').forEach((clone) => clone.remove())
}

function createTombAuraClone(node: SVGElement) {
  const clone = node.cloneNode(true)

  if (!(clone instanceof SVGElement)) {
    return null
  }

  clone.removeAttribute('class')
  clone.removeAttribute('tabindex')
  clone.removeAttribute('role')
  clone.removeAttribute('aria-label')
  clone.setAttribute('data-monumap-aura-clone', 'true')
  clone.setAttribute(
    'style',
    `pointer-events:none;filter:url(#${TOMB_AURA_FILTER_ID});opacity:1;`,
  )

  getTombStyledNodes(clone).forEach((styledNode) => {
    const originalStyle = styledNode.getAttribute('style') ?? ''
    const separator = originalStyle && !originalStyle.trim().endsWith(';') ? ';' : ''
    const canOverrideFill = supportsFillOverride(styledNode, originalStyle)
    const auraStyle = [
      'pointer-events:none',
      canOverrideFill ? `fill:${ACTIVE_TOMB_AURA}` : null,
      canOverrideFill ? 'fill-opacity:0.42' : null,
      `stroke:${ACTIVE_TOMB_AURA}`,
      'stroke-opacity:0.58',
      'stroke-width:4px',
      'stroke-linejoin:round',
      'stroke-linecap:round',
      'vector-effect:non-scaling-stroke',
    ]
      .filter(Boolean)
      .join(';')

    styledNode.setAttribute('style', `${originalStyle}${separator}${auraStyle};`)
  })

  return clone
}

function createSelectedTombClone(node: SVGElement) {
  const clone = node.cloneNode(true)

  if (!(clone instanceof SVGElement)) {
    return null
  }

  clone.removeAttribute('class')
  clone.removeAttribute('tabindex')
  clone.removeAttribute('role')
  clone.removeAttribute('aria-label')
  clone.setAttribute('data-monumap-aura-clone', 'true')

  const rootStyle = clone.getAttribute('style') ?? ''
  const rootSeparator = rootStyle && !rootStyle.trim().endsWith(';') ? ';' : ''
  clone.setAttribute('style', `${rootStyle}${rootSeparator}pointer-events:none;filter:none;opacity:1;`)

  getTombStyledNodes(clone).forEach((styledNode) => {
    const originalStyle = styledNode.getAttribute('style') ?? ''
    const separator = originalStyle && !originalStyle.trim().endsWith(';') ? ';' : ''
    const canOverrideFill = supportsFillOverride(styledNode, originalStyle)
    const canOverrideStroke = supportsStrokeOverride(styledNode, originalStyle)
    const cloneStyle = [
      'pointer-events:none',
      'transition:none',
      canOverrideFill ? `fill:${ACTIVE_TOMB_FILL}` : null,
      canOverrideStroke
        ? `stroke:${ACTIVE_TOMB_STROKE};stroke-opacity:0.88;vector-effect:non-scaling-stroke`
        : null,
    ]
      .filter(Boolean)
      .join(';')

    styledNode.setAttribute('style', `${originalStyle}${separator}${cloneStyle};`)
  })

  return clone
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
) {
  const activeSet = new Set(activeTombIds)
  void focusedTombIds
  const selectionOverlay = svg.querySelector(`#${TOMB_SELECTION_LAYER_ID}`)
  clearTombAuraClones(svg)

  svg.querySelectorAll('.tomb').forEach((node) => {
    if (!(node instanceof SVGElement) || node.closest('defs')) {
      return
    }

    const tombId = node.getAttribute('data-monumap-tomb-id')?.trim() ?? node.getAttribute('id')?.trim()

    if (!tombId) {
      return
    }

    const styledNodes = getTombStyledNodes(node)

    const isActive = activeSet.has(tombId)
    const isHovered = tombId === hoveredTombId
    const isSelected = tombId === selectedTombId
    const tomb = findTombById(tombs, tombId)
    const nodeOriginalStyle = node.getAttribute('data-monumap-original-style') ?? node.getAttribute('style') ?? ''
    const nodeSeparator = nodeOriginalStyle && !nodeOriginalStyle.trim().endsWith(';') ? ';' : ''
    const nodeRuntimeAugment = `pointer-events:all;cursor:${isActive ? 'pointer' : 'default'};opacity:1;filter:none;transition:opacity 140ms ease;`

    if (!node.hasAttribute('data-monumap-original-style')) {
      node.setAttribute('data-monumap-original-style', nodeOriginalStyle)
    }

    if (node.tagName.toLowerCase() === 'g') {
      node.setAttribute('style', `${nodeOriginalStyle}${nodeSeparator}${nodeRuntimeAugment}`)
    }

    if (isSelected && selectionOverlay instanceof SVGElement) {
      const auraClone = createTombAuraClone(node)
      const selectedClone = createSelectedTombClone(node)

      if (auraClone) {
        selectionOverlay.appendChild(auraClone)
      }

      if (selectedClone) {
        selectionOverlay.appendChild(selectedClone)
      }
    }

    styledNodes.forEach((styledNode) => {
      const originalStyle = styledNode.getAttribute('data-monumap-original-style') ?? styledNode.getAttribute('style') ?? ''
      const canOverrideFill = supportsFillOverride(styledNode, originalStyle)
      const canOverrideStroke = supportsStrokeOverride(styledNode, originalStyle)
      const strokeColor = isHovered ? ACTIVE_TOMB_STROKE_HOVER : ACTIVE_TOMB_STROKE
      const leafRuntimeAugment = [
        node.tagName.toLowerCase() === 'g' ? null : nodeRuntimeAugment,
        isActive && canOverrideFill ? `fill:${ACTIVE_TOMB_FILL};` : null,
        isActive && canOverrideStroke
          ? `stroke:${strokeColor};stroke-opacity:0.88;vector-effect:non-scaling-stroke;`
          : null,
      ]
        .filter(Boolean)
        .join('')

      if (!styledNode.hasAttribute('data-monumap-original-style')) {
        styledNode.setAttribute('data-monumap-original-style', originalStyle)
      }

      const separator = originalStyle && !originalStyle.trim().endsWith(';') ? ';' : ''
      styledNode.setAttribute(
        'style',
        `${originalStyle}${separator}pointer-events:all;transition:fill 140ms ease, stroke 140ms ease, filter 140ms ease, opacity 140ms ease;${leafRuntimeAugment}`,
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
  const interactionDefs = createInteractionDefs()
  const selectionOverlayMarkup = createSelectionOverlayMarkup()
  const svgMarkup =
    svgMarkupParts && sourceBox
      ? isMobileLayout
        ? `${svgMarkupParts.staticMarkup}${interactionDefs}<g transform="${buildMobileTransform(sourceBox)}">${svgMarkupParts.contentMarkup}${selectionOverlayMarkup}</g>`
        : `${svgMarkupParts.staticMarkup}${interactionDefs}${svgMarkupParts.contentMarkup}${selectionOverlayMarkup}`
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
    )
  }, [activeTombIds, focusedTombIds, hoveredTombId, selectedTombId, svgMarkup, tombs])

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
      event.preventDefault()
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

    const tomb = resolveActiveTombFromTarget(tombs, activeTombIds, event.target)

    if (!tomb) {
      setHoveredTombId(null)
      setTooltip(null)
      return
    }

    setHoveredTombId(tombId)

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
          <strong>{getTooltipLabel(tooltip.tomb)}</strong>
        </div>
      )}
    </>
  )
}
