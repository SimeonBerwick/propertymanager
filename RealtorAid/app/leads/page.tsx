import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLeadAgeDays, getLastTouchDays, getLeadExecutionState } from "@/lib/lead-state";
import { listLeads } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await requireUser();
  const leads = await listLeads({ userId: user.id, organizationId: user.organizationId });

  return (
    <div className="page">
      <section className="header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h2>All live leads</h2>
          <p className="muted">Each row should expose urgency, ownership, contact decay, and the next decision.</p>
        </div>
        <div className="heroActions">
          <Link href="/today" className="buttonLike secondaryButtonLike">Open Today board</Link>
          <Link href="/leads/new" className="buttonLike">Capture lead</Link>
        </div>
      </section>

      <section className="card stack">
        <div className="listHeader leadListHeaderWide">
          <span>Lead</span>
          <span>Source</span>
          <span>Owner</span>
          <span>Next action</span>
          <span>Last touch</span>
          <span>Lead age</span>
          <span>Status</span>
        </div>

        <div className="leadList">
          {leads.map((lead) => (
            <Link className="leadListRow leadListRowWide" key={lead.id} href={`/leads/${lead.id}`}>
              <div className="listRowMeta">
                <strong>{lead.name}</strong>
                <span className="muted">{lead.location} · {lead.email}</span>
              </div>
              <div>{lead.source}</div>
              <div>{lead.ownerName || "Unassigned"}</div>
              <div>{formatDate(lead.nextFollowUpAt)}</div>
              <div>{getLastTouchDays(lead)}d ago</div>
              <div>{getLeadAgeDays(lead)}d</div>
              <div><span className={`badge ${getLeadExecutionState(lead)}`}>{getLeadExecutionState(lead)}</span></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
