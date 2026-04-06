import type { ReactNode } from 'react'

export function SectionCard({
  kicker,
  title,
  subtitle,
  action,
  children,
}: {
  kicker?: string
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card stack sectionCard">
      <div className="sectionHead">
        <div>
          {kicker ? <div className="kicker">{kicker}</div> : null}
          <h2 className="sectionTitle">{title}</h2>
          {subtitle ? <div className="muted sectionSubtitle">{subtitle}</div> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  )
}
