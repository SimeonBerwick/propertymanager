interface AuditLogItem {
  id: string
  action: string
  summary: string
  createdAt: string
  actorName?: string
}

export function AuditLogList({ title, items }: { title: string; items: AuditLogItem[] }) {
  return (
    <section className="card stack">
      <div>
        <div className="kicker">Audit</div>
        <h3 style={{ marginTop: 4 }}>{title}</h3>
      </div>
      {items.length ? items.map((item) => (
        <div key={item.id} className="timelineRow">
          <div style={{ fontWeight: 600 }}>{item.summary}</div>
          <div className="muted">{item.actorName ?? 'System'} · {new Date(item.createdAt).toLocaleString()}</div>
        </div>
      )) : <div className="muted">No audit events yet.</div>}
    </section>
  )
}
