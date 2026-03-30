import type { CSSProperties, PropsWithChildren } from 'react'

type StickyOffset = CSSProperties['top']

type StickyBoxProps = PropsWithChildren<{
  className?: string
  style?: CSSProperties
  top?: StickyOffset
  right?: StickyOffset
  bottom?: StickyOffset
  left?: StickyOffset
}>

export function StickyBox({ className, style, top, right, bottom, left, children }: StickyBoxProps) {
  const rootClassName = ['sticky-box', className].filter(Boolean).join(' ')
  const stickyStyle: CSSProperties = {
    top,
    right,
    bottom,
    left,
    ...style,
  }

  return (
    <div className={rootClassName} style={stickyStyle}>
      {children}
    </div>
  )
}
