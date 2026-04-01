import Link from "next/link";
import { Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function DashboardQueue({ title, subtitle, leads, tone }: { title: string; subtitle: string; leads: Lead[]; tone?: "default" | "due" | "overdue"; }) {
  return (
    <section className="card stack">
      <div>
        <h3>{title}</h3>
        <p className="muted">{subtitle}</p>
      </div>
      <div className="list">
        {leads.length === 0 ? (
          <div className="muted">Nothing in this queue.</div>
        ) : (
          leads.map((lead) => (
            <Link key={lead.id} href={`/leads/${lead.id}`} className="timelineItem">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{lead.name}</strong>
                <span className={`badge ${tone === "overdue" ? "overdue" : tone === "due" ? "due" : lead.stage}`}>{lead.stage}</span>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>{lead.location} · {lead.source}</div>
              <div style={{ marginTop: 8, fontSize: 14 }}>Next: {formatDate(lead.nextFollowUpAt)}</div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
