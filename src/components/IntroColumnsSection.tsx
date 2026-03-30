import type { CarouselSlideContent, IntroBlockContent } from '../data/pageContent'
import { ImageCarousel } from './ImageCarousel'
import { StickyBox } from './StickyBox'
import { TextBlock } from './TextBlock'

type IntroColumnsSectionProps = {
  id?: string
  blocks: IntroBlockContent[]
  slides: CarouselSlideContent[]
}

export function IntroColumnsSection({ id, blocks, slides }: IntroColumnsSectionProps) {
  return (
    <section className="story-block story-lead" id={id}>
      <div className="story-lead__grid">
        <div className="story-lead__copy">
          {blocks.map((block) => (
            <TextBlock key={block.id} id={block.id} title={block.title}>
              {block.content}
            </TextBlock>
          ))}
        </div>

        <StickyBox className="story-lead__sticky" top="clamp(1.25rem, 3vw, 2.5rem)">
          <ImageCarousel slides={slides} ariaLabel="Vedute del Cimitero Monumentale di Perugia" />
        </StickyBox>
      </div>
    </section>
  )
}
