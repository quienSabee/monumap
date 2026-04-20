import { useEffect, useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'
import { resolveResponsiveImage } from '../lib/responsiveImages'

type AssetImageProps = ImgHTMLAttributes<HTMLImageElement>

export function AssetImage({ className, src, alt = '', fetchPriority, onLoad, onError, style, ...props }: AssetImageProps) {
  const resolvedImage = resolveResponsiveImage(src, import.meta.env.BASE_URL)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [isLoaded, setIsLoaded] = useState(() => !resolvedImage?.src)

  useEffect(() => {
    if (!resolvedImage?.src) {
      setIsLoaded(true)
      return
    }

    const imageElement = imageRef.current

    if (imageElement?.complete && imageElement.naturalWidth > 0) {
      setIsLoaded(true)
      return
    }

    setIsLoaded(false)
  }, [resolvedImage?.src])

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    setIsLoaded(true)
    onLoad?.(event)
  }

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    setIsLoaded(true)
    onError?.(event)
  }

  const imageClassName = [className, 'asset-image', isLoaded ? 'is-loaded' : 'is-loading']
    .filter(Boolean)
    .join(' ')
  const priorityProps = fetchPriority ? ({ fetchpriority: fetchPriority } as { fetchpriority: string }) : {}
  const placeholderStyle =
    !isLoaded && resolvedImage?.placeholder
      ? {
          backgroundImage: `url("${resolvedImage.placeholder}")`,
        }
      : undefined
  const mergedStyle = placeholderStyle ? { ...placeholderStyle, ...style } : style

  return (
    <img
      {...props}
      {...priorityProps}
      ref={imageRef}
      className={imageClassName}
      src={resolvedImage?.src ?? src}
      srcSet={resolvedImage?.srcSet}
      sizes={props.sizes ?? (resolvedImage?.srcSet ? '100vw' : undefined)}
      width={props.width ?? resolvedImage?.width}
      height={props.height ?? resolvedImage?.height}
      style={mergedStyle}
      alt={alt}
      onLoad={handleLoad}
      onError={handleError}
    />
  )
}
