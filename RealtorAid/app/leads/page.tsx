import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLeadAgeDays, getLastTouchDays, getLeadExecutionState } from "@/lib/lead-state";
import { listLeads } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const user = await requireUser();
  const leads = await listLeads({ userId: user.id, organizationId: user.organizationId });
  const statusFilter = searchParams?.status?.trim();
  const filteredLeads = statusFilter
    ? leads.filter((lead) => getLeadExecutionState(lead) === statusFilter)
    : leads;

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
        <div className="filterBar">
          <Link href="/leads" className={`filterChip ${!statusFilter ? "activeFilterChip" : ""}`}>All</Link>
          <Link href="/leads?status=overdue" className={`filterChip ${statusFilter === "overdue" ? "activeFilterChip" : ""}`}>Overdue</Link>
          <Link href="/leads?status=due" className={`filterChip ${statusFilter === "due" ? "activeFilterChip" : ""}`}>Due today</Link>
          <Link href="/leads?status=unscheduled" className={`filterChip ${statusFilter === "unscheduled" ? "activeFilterChip" : ""}`}>Unscheduled</Link>
          <Link href="/leads?status=stale" className={`filterChip ${statusFilter === "stale" ? "activeFilterChip" : ""}`}>Stale</Link>
        </div>

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
          {filteredLeads.map((lead) => (
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
          {filteredLeads.length === 0 ? <div className="emptyState">No leads match this execution state.</div> : null}
        </div>
      </section>
    </div>
  );
}
