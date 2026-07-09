import Link from 'next/link'
import type { Route } from 'next'
import type { WorkOrderStateSummary } from '@/lib/work-order-state'

export function WorkOrderStatusPanel({ summary }: { summary: WorkOrderStateSummary }) {
  const facts = [
    { label: 'Waiting on', value: summary.waitingOn },
    { label: 'Appointment', value: summary.appointment ?? 'Not set' },
    { label: 'Money', value: summary.money ?? 'No open amount shown' },
    { label: 'Latest', value: summary.latest ?? 'No new message' },
  ]

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
          <div key={fact.label} className="workOrderStatusFact">
            <div className="kicker">{fact.label}</div>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}
