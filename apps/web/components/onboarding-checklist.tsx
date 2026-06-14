import Link from 'next/link'
import type { Route } from 'next'

type Item = { label: string, detail: string, done: boolean, href: string }

export function OnboardingChecklist({ items }: { items: Item[] }) {
  const completed = items.filter((item) => item.done).length
  if (completed === items.length) return null

  return <section className="card onboardingChecklist">
    <div className="onboardingHead"><div><div className="kicker">Getting started</div><h2 className="sectionTitle">Set up your workspace</h2><div className="muted">{completed} of {items.length} complete</div></div><div className="onboardingProgress"><span style={{ width: `${(completed / items.length) * 100}%` }} /></div></div>
    <div className="onboardingSteps">{items.map((item, index) => <Link href={item.href as Route} className={item.done ? 'isDone' : ''} key={item.label}><span>{item.done ? '✓' : index + 1}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></Link>)}</div>
  </section>
}
