import type { ReactNode } from 'react'

export type TextBlockProps = {
  title: string
  children: ReactNode
  id?: string
  className?: string
}

export function TextBlock({ title, children, id, className }: TextBlockProps) {
  const blockClassName = ['text-block', className].filter(Boolean).join(' ')

  return (
    <article className={blockClassName} id={id}>
      <h2>{title}</h2>
      <div className="text-block__body">{children}</div>
    </article>
  )
}
