import type { ImgHTMLAttributes } from 'react'
import { useImageAsset } from '../lib/imageAssets'

type AssetImageProps = ImgHTMLAttributes<HTMLImageElement>

export function AssetImage({ className, src, alt = '', fetchPriority, ...props }: AssetImageProps) {
  const { isLoaded } = useImageAsset(src)
  const imageClassName = [className, 'asset-image', isLoaded ? 'is-loaded' : 'is-loading']
    .filter(Boolean)
    .join(' ')
  const priorityProps = fetchPriority ? ({ fetchpriority: fetchPriority } as { fetchpriority: string }) : {}

  return <img {...props} {...priorityProps} className={imageClassName} src={src} alt={alt} />
}
