import { carouselSlides, heroContent, introBlocks } from '../data/pageContent'
import { Hero } from './Hero'
import { IntroColumnsSection } from './IntroColumnsSection'
import { InteractiveMap } from './InteractiveMap'
import type { MapDataBundle } from '../types/map'

type StoryRendererProps = {
  mapData: MapDataBundle
}

export function StoryRenderer({ mapData }: StoryRendererProps) {
  return (
    <main className="story-shell">
      <Hero {...heroContent} />
      <IntroColumnsSection id="intro-columns" blocks={introBlocks} slides={carouselSlides} />

      <InteractiveMap data={mapData} />
    </main>
  )
}
