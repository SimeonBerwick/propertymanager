import Link from 'next/link'
import type { Route } from 'next'
import type { OpsActivityItem } from '@/lib/ops-activity'

const ENTITY_LABELS: Record<string, string> = {
  property: 'Property',
  unit: 'Unit',
  request: 'Request',
  billingDocument: 'Billing',
  tenantIdentity: 'Tenant access',
  vendor: 'Vendor',
}

const ENTITY_ICONS: Record<string, string> = {
  property: '🏠',
  unit: '🚪',
  request: '🛠️',
  billingDocument: '💳',
  tenantIdentity: '🔐',
  vendor: '🧰',
}

function entityHref(item: OpsActivityItem): Route | null {
  if (item.entityType === 'property') return `/properties/${item.entityId}` as Route
  if (item.entityType === 'unit') return `/units/${item.entityId}` as Route
  if (item.entityType === 'request') return `/requests/${item.entityId}` as Route
  if (item.entityType === 'vendor') return `/vendors/${item.entityId}` as Route
  return null
}

export function OpsActivityFeed({ items }: { items: OpsActivityItem[] }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {items.length ? items.map((item) => {
        const href = entityHref(item)
        return (
          <div key={item.id} className="timelineRow">
            <div style={{ fontWeight: 600 }}>
              <span style={{ marginRight: 8 }}>{ENTITY_ICONS[item.entityType] ?? '•'}</span>
              {item.summary}
            </div>
            <div className="muted">
              {ENTITY_LABELS[item.entityType] ?? item.entityType}
              {' · '}
              {item.actorName ?? 'System'}
              {' · '}
              {new Date(item.createdAt).toLocaleString()}
              {href ? <><span>{' · '}</span><Link href={href}>Open</Link></> : null}
            </div>
          </div>
        )
      }) : <div className="muted">No recent activity.</div>}
    </div>
  )
}
