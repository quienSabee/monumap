import type { ImgHTMLAttributes } from 'react'
import { useImageAsset } from '../lib/imageAssets'

type AssetImageProps = ImgHTMLAttributes<HTMLImageElement>

export function AssetImage({ className, src, alt = '', ...props }: AssetImageProps) {
  const { isLoaded } = useImageAsset(src)
  const imageClassName = [className, 'asset-image', isLoaded ? 'is-loaded' : 'is-loading']
    .filter(Boolean)
    .join(' ')

  return <img {...props} className={imageClassName} src={src} alt={alt} />
}
