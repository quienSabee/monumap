import { useEffect, useState } from 'react'
import { StoryRenderer } from './components/StoryRenderer'
import { parseStoryXml } from './lib/storyParser'
import type { StoryDocument } from './types/story'

function App() {
  const [story, setStory] = useState<StoryDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadStory() {
      try {
        const response = await fetch('/content/story.xml')

        if (!response.ok) {
          throw new Error(`Impossibile caricare il contenuto XML (${response.status}).`)
        }

        const xml = await response.text()
        const parsed = parseStoryXml(xml)

        if (!cancelled) {
          setStory(parsed)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Errore sconosciuto.')
        }
      }
    }

    loadStory()

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="app-status">
        <h1>Errore di caricamento</h1>
        <p>{error}</p>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="app-status">
        <h1>Monumap</h1>
        <p>Caricamento dei contenuti XML in corso.</p>
      </div>
    )
  }

  return <StoryRenderer story={story} />
}

export default App
