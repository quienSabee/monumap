import { useEffect, useState } from 'react'
import { StoryRenderer } from './components/StoryRenderer'
import { getPagePreloadUrls } from './data/pageContent'
import { preloadImageAssets } from './lib/imageAssets'
import { collectMapPreloadUrls, normalizeMapData } from './lib/mapData'
import type { MapDataBundle, MapTaxonomyData, RawMapTomb } from './types/map'

const TOMBS_URL = `${import.meta.env.BASE_URL}content/tombs.json`
const MAP_TAXONOMY_URL = `${import.meta.env.BASE_URL}content/map-taxonomy.json`

function App() {
  const [mapData, setMapData] = useState<MapDataBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void preloadImageAssets(getPagePreloadUrls())
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadMapData() {
      try {
        const [taxonomyResponse, tombsResponse] = await Promise.all([fetch(MAP_TAXONOMY_URL), fetch(TOMBS_URL)])

        if (!taxonomyResponse.ok) {
          throw new Error(`Impossibile caricare la tassonomia della mappa (${taxonomyResponse.status}).`)
        }

        if (!tombsResponse.ok) {
          throw new Error(`Impossibile caricare le tombe (${tombsResponse.status}).`)
        }

        const [taxonomy, tombs] = await Promise.all([
          taxonomyResponse.json() as Promise<MapTaxonomyData>,
          tombsResponse.json() as Promise<RawMapTomb[]>,
        ])

        if (!Array.isArray(tombs)) {
          throw new Error('Il file tombs.json non contiene una lista valida di tombe.')
        }

        const normalized = normalizeMapData(taxonomy, tombs, import.meta.env.BASE_URL)

        if (!cancelled) {
          setMapData(normalized)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Errore sconosciuto.')
        }
      }
    }

    void loadMapData()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mapData) {
      return
    }

    void preloadImageAssets(collectMapPreloadUrls(mapData, import.meta.env.BASE_URL))
  }, [mapData])

  if (error) {
    return (
      <div className="app-status">
        <h1>Errore di caricamento</h1>
        <p>{error}</p>
      </div>
    )
  }

  if (!mapData) {
    return (
      <div className="app-status">
        <h1>Monumap</h1>
        <p>Caricamento dei contenuti in corso.</p>
      </div>
    )
  }

  return <StoryRenderer mapData={mapData} />
}

export default App
