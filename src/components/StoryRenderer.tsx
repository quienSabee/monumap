import { useState, type CSSProperties } from 'react'
import { InteractiveMap } from './InteractiveMap'
import type { GalleryBlock, SidecarBlock, StoryDocument, StoryBlock } from '../types/story'

type StoryRendererProps = {
  story: StoryDocument
}

function SectionImage({
  image,
  alt,
  className,
}: {
  image?: string
  alt?: string
  className?: string
}) {
  if (!image) {
    return (
      <div className={className ? `${className} is-placeholder` : 'is-placeholder'}>
        <span>Nessuna immagine</span>
      </div>
    )
  }

  return <img className={className} src={image} alt={alt ?? ''} loading="lazy" />
}

function HeroBlockView({
  block,
}: {
  block: Extract<StoryBlock, { type: 'hero' }>
}) {
  return (
    <section
      className="story-block story-hero"
      id={block.id}
      style={
        block.background
          ? ({
              '--hero-background': `url(${block.background})`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="story-hero__content">
        <h1>{block.title}</h1>
        {block.kicker && <span className="story-hero__eyebrow">{block.kicker}</span>}
        {block.subtitle && <p className="story-hero__credit">{block.subtitle}</p>}
      </div>
    </section>
  )
}

function SidecarBlockView({ block }: { block: SidecarBlock }) {
  const mediaFirst = block.align === 'left'

  return (
    <section className="story-block story-sidecar" id={block.id}>
      <div className={mediaFirst ? 'story-sidecar__grid is-reversed' : 'story-sidecar__grid'}>
        <figure className="story-sidecar__media">
          <SectionImage image={block.image} alt={block.imageAlt} className="story-sidecar__image" />
        </figure>

        <div className="story-sidecar__copy">
          {block.eyebrow && <span className="story-kicker">{block.eyebrow}</span>}
          <h2>{block.title}</h2>
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  )
}

function GalleryBlockView({ block }: { block: GalleryBlock }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeSlide = block.slides[activeIndex]

  return (
    <section className="story-block story-gallery" id={block.id}>
      <div className="story-gallery__intro">
        <span className="story-kicker">Galleria</span>
        <h2>{block.title}</h2>
        {block.description && <p>{block.description}</p>}
      </div>

      <div className="story-gallery__layout">
        <figure className="story-gallery__stage">
          <img src={activeSlide.image} alt={activeSlide.alt} loading="lazy" />
        </figure>

        <div className="story-gallery__aside">
          <div className="story-gallery__caption">
            <h3>{activeSlide.title}</h3>
            <p>{activeSlide.caption}</p>
          </div>

          <div className="story-gallery__thumbs">
            {block.slides.map((slide, index) => (
              <button
                type="button"
                key={slide.title}
                className={index === activeIndex ? 'gallery-thumb is-active' : 'gallery-thumb'}
                onClick={() => setActiveIndex(index)}
              >
                <img src={slide.image} alt={slide.alt} loading="lazy" />
                <span>{slide.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function BlockView({ block }: { block: StoryBlock }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlockView block={block} />
    case 'sidecar':
      return <SidecarBlockView block={block} />
    case 'gallery':
      return <GalleryBlockView block={block} />
    case 'map':
      return <InteractiveMap block={block} />
    default:
      return null
  }
}

export function StoryRenderer({ story }: StoryRendererProps) {
  return (
    <main className="story-shell">
      {story.blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </main>
  )
}
