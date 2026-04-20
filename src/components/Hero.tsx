import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AssetImage } from './AssetImage'

export type HeroProps = {
  id?: string
  kicker?: string
  title: string
  subtitle?: string
  background?: string
  authorName?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function Hero({ id, kicker, title, subtitle, background, authorName }: HeroProps) {
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const subtitleMeasureRef = useRef<HTMLSpanElement | null>(null)
  const [subtitleFontSize, setSubtitleFontSize] = useState<number | null>(null)

  useEffect(() => {
    if (!subtitle) {
      setSubtitleFontSize(null)
      return
    }

    let frameId = 0

    function updateSubtitleWidth() {
      const titleElement = titleRef.current
      const subtitleMeasureElement = subtitleMeasureRef.current

      if (!titleElement || !subtitleMeasureElement) {
        return
      }

      const titleWidth = titleElement.getBoundingClientRect().width
      const subtitleBaseWidth = subtitleMeasureElement.getBoundingClientRect().width

      if (titleWidth <= 0 || subtitleBaseWidth <= 0) {
        return
      }

      setSubtitleFontSize(clamp(titleWidth / subtitleBaseWidth, 5, 28))
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(updateSubtitleWidth)
    }

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            scheduleUpdate()
          })

    if (titleRef.current) {
      resizeObserver?.observe(titleRef.current)
    }

    if (subtitleMeasureRef.current) {
      resizeObserver?.observe(subtitleMeasureRef.current)
    }

    window.addEventListener('resize', scheduleUpdate)
    scheduleUpdate()

    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => {
        scheduleUpdate()
      })
    }

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      window.cancelAnimationFrame(frameId)
    }
  }, [subtitle, title])

  return (
    <section className="story-block story-hero" id={id}>
      {background && (
        <AssetImage
          className="story-hero__background"
          src={background}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          sizes="100vw"
        />
      )}

      <div className="story-hero__content">
        {kicker && <span className="story-hero__eyebrow">{kicker}</span>}
        <h1 ref={titleRef}>{title}</h1>
        {subtitle && (
          <>
            <p
              className="story-hero__subtitle"
              style={subtitleFontSize ? ({ fontSize: `${subtitleFontSize}px` } as CSSProperties) : undefined}
            >
              {subtitle}
            </p>
            <span ref={subtitleMeasureRef} className="story-hero__subtitle-measure" aria-hidden="true">
              {subtitle}
            </span>
          </>
        )}
      </div>

      <div className="story-hero__band">{authorName && <span className="story-hero__author">{authorName}</span>}</div>
    </section>
  )
}
