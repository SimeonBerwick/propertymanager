import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getLeadState(lead: Awaited<ReturnType<typeof listLeads>>[number]) {
  if (!lead.nextFollowUpAt) return "unscheduled";
  const next = new Date(lead.nextFollowUpAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (next < today) return "overdue";

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (next < tomorrow) return "due";

  return lead.stage;
}

export default async function LeadsPage() {
  const user = await requireUser();
  const leads = await listLeads({ userId: user.id, organizationId: user.organizationId });

  return (
    <div className="page">
      <section className="header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h2>All live leads</h2>
          <p className="muted">One row should tell you whether this lead is healthy, drifting, or already missed.</p>
        </div>
        <Link href="/leads/new" className="buttonLike">Capture lead</Link>
      </section>

      <section className="card stack">
        <div className="listHeader">
          <span>Lead</span>
          <span>Market</span>
          <span>Source</span>
          <span>Owner</span>
          <span>Next action</span>
          <span>Status</span>
        </div>

        <div className="leadList">
          {leads.map((lead) => (
            <Link className="leadListRow" key={lead.id} href={`/leads/${lead.id}`}>
              <div className="listRowMeta">
                <strong>{lead.name}</strong>
                <span className="muted">{lead.email} · {lead.phone}</span>
              </div>
              <div>{lead.location}</div>
              <div>{lead.source}</div>
              <div>{lead.ownerName || "Unassigned"}</div>
              <div>{formatDate(lead.nextFollowUpAt)}</div>
              <div><span className={`badge ${getLeadState(lead)}`}>{getLeadState(lead)}</span></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
