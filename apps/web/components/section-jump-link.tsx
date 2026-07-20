'use client'

import type { CSSProperties, ReactNode } from 'react'

export function SectionJumpLink({
  href,
  children,
  className,
  style,
  onActivate,
}: {
  href: `#${string}`
  children: ReactNode
  className?: string
  style?: CSSProperties
  onActivate?: () => void
}) {
  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(event) => {
        onActivate?.()
        const target = document.getElementById(href.slice(1))
        if (!target) return
        event.preventDefault()
        window.history.replaceState(window.history.state, '', href)
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
    >
      {children}
    </a>
  )
}
