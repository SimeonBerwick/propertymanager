import Link from "next/link";
import { DashboardQueues, Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function formatRelativeUrgency(date: string | null) {
  if (!date) return "Unscheduled";

  const target = new Date(date);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 0) return `${Math.abs(diffHours)}h late`;
  if (diffHours === 0) return "Due now";
  if (diffHours < 24) return `Due in ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  return `Due in ${diffDays}d`;
}

function getLeadHealth(lead: Lead) {
  if (!lead.nextFollowUpAt) return "unscheduled";
  const next = new Date(lead.nextFollowUpAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (next < today) return "overdue";

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (next < tomorrow) return "due";

  return "stable";
}

export function DashboardOverview({
  leads,
  queues,
}: {
  leads: Lead[];
  queues: DashboardQueues;
}) {
  const unscheduled = leads.filter((lead) => !lead.nextFollowUpAt && lead.stage !== "closed");
  const activePipeline = leads.filter((lead) => !["closed"].includes(lead.stage));
  const recentlyTouched = [...leads]
    .sort((a, b) => +new Date(b.lastContactAt) - +new Date(a.lastContactAt))
    .slice(0, 5);

  const nextFive = [...activePipeline]
    .filter((lead) => lead.nextFollowUpAt)
    .sort((a, b) => +new Date(a.nextFollowUpAt!) - +new Date(b.nextFollowUpAt!))
    .slice(0, 5);

  const focusNow = [...queues.overdue, ...queues.dueToday]
    .sort((a, b) => {
      const aTime = a.nextFollowUpAt ? +new Date(a.nextFollowUpAt) : Number.POSITIVE_INFINITY;
      const bTime = b.nextFollowUpAt ? +new Date(b.nextFollowUpAt) : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    })
    .slice(0, 6);

  return (
    <div className="stack-lg">
      <section className="hero card heroCard">
        <div className="stack heroCopy">
          <div>
            <p className="eyebrow">Command center</p>
            <h1>Work the leads that matter before they rot.</h1>
            <p className="muted heroText">
              This should feel like an operating console: what is on fire, what needs a decision, and what to do next.
            </p>
          </div>

          <div className="heroActions">
            <Link href="/leads/new" className="buttonLike">
              Quick add lead
            </Link>
            <Link href="/leads" className="buttonLike secondaryButtonLike">
              View all leads
            </Link>
          </div>
        </div>

        <div className="heroSignal cardInset">
          <div className="signalHeader">
            <span className="signalLabel">Immediate pressure</span>
            <strong>{focusNow.length} leads</strong>
          </div>
          <div className="signalValue">{queues.overdue.length}</div>
          <div className="signalCaption">overdue follow-ups need action now</div>
          <div className="signalBreakdown">
            <div>
              <span>Due today</span>
              <strong>{queues.dueToday.length}</strong>
            </div>
            <div>
              <span>Unscheduled</span>
              <strong>{unscheduled.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid metricGrid">
        <div className="card metricCard metricDanger">
          <div className="metricLabel">Overdue</div>
          <div className="metric">{queues.overdue.length}</div>
          <p className="muted">Broken promises to the pipeline.</p>
        </div>
        <div className="card metricCard metricWarn">
          <div className="metricLabel">Due today</div>
          <div className="metric">{queues.dueToday.length}</div>
          <p className="muted">Needs same-day execution.</p>
        </div>
        <div className="card metricCard">
          <div className="metricLabel">Active pipeline</div>
          <div className="metric">{activePipeline.length}</div>
          <p className="muted">Open leads still worth attention.</p>
        </div>
        <div className="card metricCard">
          <div className="metricLabel">Unscheduled</div>
          <div className="metric">{unscheduled.length}</div>
          <p className="muted">Leads with no next step defined.</p>
        </div>
      </section>

      <section className="grid commandGrid">
        <div className="card stack">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Focus now</p>
              <h2>Priority queue</h2>
            </div>
            <span className="muted">Top 6 items blocking execution</span>
          </div>

          <div className="focusList">
            {focusNow.length === 0 ? (
              <div className="emptyState">Nothing urgent. That is how this should look.</div>
            ) : (
              focusNow.map((lead, index) => {
                const health = getLeadHealth(lead);
                return (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="focusItem">
                    <div className="focusIndex">{String(index + 1).padStart(2, "0")}</div>
                    <div className="focusBody">
                      <div className="focusTitleRow">
                        <strong>{lead.name}</strong>
                        <span className={`badge ${health}`}>{formatRelativeUrgency(lead.nextFollowUpAt)}</span>
                      </div>
                      <div className="muted">{lead.location} · {lead.source} · {lead.ownerName ?? "Unassigned"}</div>
                      <div className="focusMeta">
                        <span>Stage: {lead.stage}</span>
                        <span>Next touch: {formatDate(lead.nextFollowUpAt)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Upcoming</p>
                <h2>Next scheduled touches</h2>
              </div>
            </div>
            <div className="miniList">
              {nextFive.length === 0 ? (
                <div className="emptyState">No follow-ups scheduled.</div>
              ) : (
                nextFive.map((lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="miniItem">
                    <div>
                      <strong>{lead.name}</strong>
                      <div className="muted">{lead.source} · {lead.location}</div>
                    </div>
                    <div className="miniMeta">{formatDate(lead.nextFollowUpAt)}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="card stack">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Recent motion</p>
                <h2>Latest contact activity</h2>
              </div>
            </div>
            <div className="miniList">
              {recentlyTouched.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="miniItem">
                  <div>
                    <strong>{lead.name}</strong>
                    <div className="muted">{lead.stage} · {lead.ownerName ?? "Unassigned"}</div>
                  </div>
                  <div className="miniMeta">{formatDate(lead.lastContactAt)}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
