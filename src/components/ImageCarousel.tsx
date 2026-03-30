import { useEffect, useState } from 'react'
import { AssetImage } from './AssetImage'

export type ImageCarouselSlide = {
  src: string
  alt: string
  subtitle?: string
  description?: string
}

export type ImageCarouselProps = {
  slides: ImageCarouselSlide[]
  autoPlayMs?: number
  ariaLabel?: string
}

export function ImageCarousel({
  slides,
  autoPlayMs = 5000,
  ariaLabel = 'Carousel immagini',
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (activeIndex <= slides.length - 1) {
      return
    }

    setActiveIndex(0)
  }, [activeIndex, slides.length])

  useEffect(() => {
    if (slides.length <= 1) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length)
    }, autoPlayMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeIndex, autoPlayMs, slides.length])

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length)
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % slides.length)
  }

  if (slides.length === 0) {
    return (
      <div className="image-carousel is-placeholder">
        <span>Nessuna immagine</span>
      </div>
    )
  }

  const activeSlide = slides[activeIndex]

  return (
    <section className="image-carousel" aria-label={ariaLabel}>
      <div className="image-carousel__viewport">
        <div className="image-carousel__stage" key={activeIndex}>
          <AssetImage
            className="image-carousel__image"
            src={activeSlide.src}
            alt={activeSlide.alt}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="image-carousel__control image-carousel__control--prev"
              onClick={showPrevious}
              aria-label="Mostra l'immagine precedente"
            >
              &larr;
            </button>
            <button
              type="button"
              className="image-carousel__control image-carousel__control--next"
              onClick={showNext}
              aria-label="Mostra l'immagine successiva"
            >
              &rarr;
            </button>
          </>
        )}
      </div>

      {(activeSlide.subtitle || activeSlide.description) && (
        <div className="image-carousel__caption">
          {activeSlide.subtitle && <p className="image-carousel__subtitle">{activeSlide.subtitle}</p>}
          {activeSlide.description && <p className="image-carousel__description">{activeSlide.description}</p>}
        </div>
      )}
    </section>
  )
}
