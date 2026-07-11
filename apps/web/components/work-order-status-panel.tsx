import Link from 'next/link'
import type { Route } from 'next'
import type { WorkOrderStateSummary } from '@/lib/work-order-state'

export function WorkOrderStatusPanel({ summary }: { summary: WorkOrderStateSummary }) {
  const facts = [
    { label: 'Waiting on', value: summary.waitingOn },
    { label: 'Appointment', value: summary.appointment ?? 'Not set' },
    summary.money ? { label: 'Money', value: summary.money } : null,
    { label: 'Latest', value: summary.latest ?? 'No new message' },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact))

  return (
    <section className={`workOrderStatusPanel workOrderStatus-${summary.tone}`} aria-labelledby="work-order-status-title">
      <div className="workOrderStatusHead">
        <div className="stack" style={{ gap: 6 }}>
          <div className="kicker">Current work order state</div>
          <h2 id="work-order-status-title">{summary.title}</h2>
          <div className="muted">{summary.detail}</div>
        </div>
        {summary.nextHref ? (
          <Link href={summary.nextHref as Route} className="button primary">{summary.nextAction}</Link>
        ) : (
          <span className="badge">{summary.nextAction}</span>
        )}
      </div>
      <div className="workOrderStatusFacts">
        {facts.map((fact) => (
          <div key={fact.label} className={`workOrderStatusFact workOrderStatusFact-${fact.label.toLowerCase().replaceAll(' ', '-')}`}>
            <div className="kicker">{fact.label}</div>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}
