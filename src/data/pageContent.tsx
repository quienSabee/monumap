import type { ReactNode } from 'react'

export type IntroBlockContent = {
  id: string
  title: string
  content: ReactNode
}

export type CarouselSlideContent = {
  src: string
  alt: string
  subtitle?: string
  description?: string
}

export const heroContent = {
  id: 'hero',
  title: 'FILI INVISIBILI',
  subtitle: 'cinque itinerari per riscoprire il cimitero monumentale di perugia',
  authorName: 'Sara Forgione',
  background: 'media/hero-cemetery.jpg',
}

export const introBlocks: IntroBlockContent[] = [
  {
    id: 'intro',
    title: 'Fili Invisibili',
    content: (
      <p>
        Il progetto Fili Invisibili trasforma lo spazio del cimitero in un luogo di esplorazione
        emotiva e connessione attiva. L&apos;idea centrale si sviluppa attraverso cinque percorsi
        tematici che guidano il visitatore a interagire con i simboli scolpiti sulle tombe del
        Cimitero Monumentale di Perugia che sorge a nord-est della citta, in un&apos;area
        storicamente utilizzata come necropoli fin dall&apos;epoca antica. La sua origine risale ai
        primi dell&apos;Ottocento, quando le norme napoleoniche impongono di spostare i luoghi di
        sepoltura fuori dai centri abitati per ragioni igieniche.
      </p>
    ),
  },
  {
    id: 'storia',
    title: 'La storia del Cimitero Monumentale di Perugia',
    content: (
      <>
        <p>
          Il progetto iniziale del complesso cimiteriale avviene nel 1837 con la trasformazione di
          una casa colonica preesistente nell&apos;ingresso principale e con l&apos;adattamento del
          recinto murato alla pendenza naturale del terreno collinare. L&apos;inaugurazione avviene nel
          1849 ma ben presto l&apos;edificio originale si rivela insufficiente.
        </p>
        <p>
          Nel 1874 inizia un importante ampliamento che espande il cimitero in lunghezza attraverso
          terrazzamenti, introducendo un nuovo ingresso monumentale in stile neo-gotico e due
          imponenti gallerie porticate. Questi spazi ospitano i monumenti delle famiglie facoltose
          e si arricchiscono di opere di scultori locali, mentre nei sotterranei trovano posto le
          sepolture dei ceti meno abbienti.
        </p>
        <p>
          Nel corso del tempo la planimetria include sezioni dedicate ad altre fedi, come il
          cimitero ebraico e quello islamico. Oggi il complesso si estende inglobando l&apos;area di
          Monterone ed e oggetto di interventi di riqualificazione per preservarne l&apos;identita
          architettonica e migliorarne l&apos;accessibilita come parco cimiteriale moderno.
        </p>
      </>
    ),
  },
  {
    id: 'itinerari',
    title: 'I Cinque Itinerari',
    content: (
      <>
        <p>
          L&apos;obiettivo di questo progetto e scardinare la visione tradizionale e dolorosa della
          morte, restituendole un significato di continuita. Il progetto da una forma concreta e
          spaziale ai legami affettivi, rendendo tangibile quel filo che unisce ogni persona ai
          propri antenati.
        </p>
        <ul>
          <li>
            <strong>Decorazioni fitomorfe</strong> legate agli elementi vegetali.
          </li>
          <li>
            <strong>Decorazioni zoomorfe</strong> e ruolo simbolico degli animali.
          </li>
          <li>
            <strong>Decorazioni allegoriche</strong> e traduzione di idee astratte.
          </li>
          <li>
            <strong>Simboli religiosi</strong> legati alla fede e alla spiritualita.
          </li>
          <li>
            <strong>Strumenti musicali</strong> tra armonia e consolazione.
          </li>
        </ul>
        <p>
          Percorrendo questi tracciati, il cittadino impara a vivere il recinto sacro come uno
          spazio culturale sereno e integrato nella vita della citta, in cui il simbolo funerario
          diventa un filo che lega memoria, lutto e presenza.
        </p>
      </>
    ),
  },
]

export const carouselSlides: CarouselSlideContent[] = [
  {
    src: 'media/galleria_sinistra.jpg',
    alt: 'Galleria a sinistra',
    subtitle: 'Galleria a sinistra',
    description: '',
  },
  {
    src: 'media/campo_comune.jpg',
    alt: 'Campo comune',
    subtitle: 'Campo comune',
    description: '',
  },
  {
    src: 'media/cappella_confraternita.jpg',
    alt: 'Cappella della Confraternita della Misericordia',
    subtitle: 'Cappella della Confraternita della Misericordia',
    description: '',
  },
]
