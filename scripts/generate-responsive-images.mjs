import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const repoRoot = process.cwd()
const sourceRoot = path.join(repoRoot, 'assets', 'media-source', 'media')
const publicRoot = path.join(repoRoot, 'public')
const outputRoot = path.join(publicRoot, 'optimized-media')
const manifestOutputPath = path.join(repoRoot, 'src', 'generated', 'optimizedMediaManifest.ts')
const heroWidths = [768, 1280, 1920, 2560, 3200]
const defaultWidths = [480, 960, 1600]
const rasterExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const placeholderKeys = new Set([
  'media/hero-cemetery.jpg',
  'media/galleria_sinistra.jpg',
  'media/campo_comune.jpg',
  'media/cappella_confraternita.jpg',
])

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

function slugifySegment(value) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

async function walkFiles(rootDirectory) {
  const entries = await readdir(rootDirectory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(rootDirectory, entry.name)

      if (entry.isDirectory()) {
        return walkFiles(absolutePath)
      }

      return [absolutePath]
    }),
  )

  return nested.flat()
}

async function ensureCleanOutputDirectory() {
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })
}

function buildTargetWidths(originalWidth, configuredWidths) {
  const widths = configuredWidths.filter((width) => width < originalWidth)

  if (widths.length === 0) {
    widths.push(originalWidth)
  }

  return Array.from(new Set(widths)).sort((left, right) => left - right)
}

async function generatePlaceholder(sourceImage, originalWidth) {
  const placeholderWidth = Math.min(48, originalWidth)
  const placeholderBuffer = await sourceImage
    .clone()
    .resize({ width: placeholderWidth, withoutEnlargement: true })
    .jpeg({ quality: 40, progressive: true, mozjpeg: true })
    .toBuffer()

  return `data:image/jpeg;base64,${placeholderBuffer.toString('base64')}`
}

async function generateVariantsForFile(filePath) {
  const relativeSourcePath = path.relative(sourceRoot, filePath)
  const logicalKey = `media/${toPosixPath(relativeSourcePath)}`
  const sourceImage = sharp(filePath).rotate()
  const metadata = await sourceImage.metadata()
  const originalWidth = metadata.autoOrient?.width ?? metadata.width
  const originalHeight = metadata.autoOrient?.height ?? metadata.height

  if (!originalWidth || !originalHeight) {
    throw new Error(`Missing dimensions for ${logicalKey}`)
  }

  const outputDirectory = path.join(outputRoot, path.dirname(relativeSourcePath))
  const parsedPath = path.parse(relativeSourcePath)
  const normalizedName = slugifySegment(parsedPath.name)
  const configuredWidths = logicalKey === 'media/hero-cemetery.jpg' ? heroWidths : defaultWidths
  const targetWidths = buildTargetWidths(originalWidth, configuredWidths)

  await mkdir(outputDirectory, { recursive: true })

  const variants = []

  for (const width of targetWidths) {
    const outputFilename = `${normalizedName}-${width}.jpg`
    const outputPath = path.join(outputDirectory, outputFilename)
    const info = await sourceImage
      .clone()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, progressive: true, mozjpeg: true })
      .toFile(outputPath)

    variants.push({
      path: toPosixPath(path.relative(publicRoot, outputPath)),
      width: info.width,
      height: info.height,
    })
  }

  return [
    logicalKey,
    {
      width: originalWidth,
      height: originalHeight,
      variants,
      placeholder: placeholderKeys.has(logicalKey) ? await generatePlaceholder(sourceImage, originalWidth) : undefined,
    },
  ]
}

async function writeManifest(manifest) {
  const manifestSource = `import type { ResponsiveImageManifest } from '../lib/responsiveImages'

export const optimizedMediaManifest: ResponsiveImageManifest = ${JSON.stringify(manifest, null, 2)}
`

  await mkdir(path.dirname(manifestOutputPath), { recursive: true })
  await writeFile(manifestOutputPath, manifestSource)
}

async function main() {
  await ensureCleanOutputDirectory()

  const sourceFiles = (await walkFiles(sourceRoot))
    .filter((filePath) => rasterExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((left, right) => left.localeCompare(right))

  const manifestEntries = await Promise.all(sourceFiles.map((filePath) => generateVariantsForFile(filePath)))
  const manifest = Object.fromEntries(manifestEntries)

  await writeManifest(manifest)
}

await main()
