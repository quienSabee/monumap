import { useEffect, useState } from 'react'

type SymbolIconProps = {
  className?: string
  src: string
}

const SVG_BACKGROUND_COLORS = new Set(['#7b1245'])
const SVG_FOREGROUND_COLORS = new Set(['#fff', '#ffffff', '#fefafd', '#fdfdfd'])
const svgMarkupCache = new Map<string, Promise<string>>()

function normalizeColor(value: string | null) {
  return value?.trim().toLowerCase() ?? null
}

function getStyleDeclarationValue(style: string, property: string) {
  const pattern = new RegExp(`(^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i')
  return style.match(pattern)?.[2]?.trim() ?? null
}

function replaceStyleDeclaration(style: string, property: string, value: string) {
  const nextStyle = style.replace(new RegExp(`(^|;)\\s*${property}\\s*:\\s*[^;]+;?`, 'gi'), '$1').trim()
  const suffix = nextStyle && !nextStyle.endsWith(';') ? ';' : ''
  return `${nextStyle}${suffix}${property}:${value};`
}

function addClassName(element: Element, className: string) {
  const current = element.getAttribute('class')?.split(/\s+/).filter(Boolean) ?? []

  if (!current.includes(className)) {
    current.push(className)
    element.setAttribute('class', current.join(' '))
  }
}

function mapPaintToCssVariable(element: Element, property: 'fill' | 'stroke') {
  const attributeValue = normalizeColor(element.getAttribute(property))
  const styleValue = normalizeColor(getStyleDeclarationValue(element.getAttribute('style') ?? '', property))
  const sourceValue = styleValue ?? attributeValue

  if (!sourceValue) {
    return
  }

  const cssVariable =
    SVG_BACKGROUND_COLORS.has(sourceValue)
      ? '--symbol-icon-bg'
      : SVG_FOREGROUND_COLORS.has(sourceValue)
        ? '--symbol-icon-fg'
        : null
  const cssClass =
    SVG_BACKGROUND_COLORS.has(sourceValue)
      ? 'monumap-symbol-bg'
      : SVG_FOREGROUND_COLORS.has(sourceValue)
        ? 'monumap-symbol-fg'
        : null

  if (!cssVariable || !cssClass) {
    return
  }

  addClassName(element, cssClass)

  if (styleValue) {
    element.setAttribute('style', replaceStyleDeclaration(element.getAttribute('style') ?? '', property, `var(${cssVariable})`))
  } else {
    element.setAttribute(property, `var(${cssVariable})`)
  }
}

function normalizeSymbolSvg(svgText: string) {
  const parser = new DOMParser()
  const document = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = document.documentElement

  svg.setAttribute('class', 'symbol-icon-svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  svg.querySelectorAll('*').forEach((element) => {
    mapPaintToCssVariable(element, 'fill')
    mapPaintToCssVariable(element, 'stroke')
  })

  return new XMLSerializer().serializeToString(svg)
}

function loadSvgMarkup(src: string) {
  const cached = svgMarkupCache.get(src)

  if (cached) {
    return cached
  }

  const promise = fetch(src)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load SVG: ${src}`)
      }

      return response.text()
    })
    .then(normalizeSymbolSvg)

  svgMarkupCache.set(src, promise)
  return promise
}

export function SymbolIcon({ className, src }: SymbolIconProps) {
  const [markup, setMarkup] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    loadSvgMarkup(src)
      .then((nextMarkup) => {
        if (!cancelled) {
          setMarkup(nextMarkup)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarkup('')
        }
      })

    return () => {
      cancelled = true
    }
  }, [src])

  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
}
