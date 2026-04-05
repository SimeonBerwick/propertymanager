import Link from "next/link";
import { completeFollowUp, setFollowUp, updateExistingFollowUp } from "@/app/actions";
import { QuickCompleteForm } from "@/components/quick-complete-form";
import { TodayRescheduleForm } from "@/components/today-reschedule-form";
import { Lead, TeamUser } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { getLeadAgeDays, getLastTouchDays, getLeadExecutionState, getPrimaryTaskId } from "@/lib/lead-state";

function TodayRow({ lead }: { lead: Lead }) {
  const state = getLeadExecutionState(lead);
  const primaryTask = lead.followUpTasks.find((task) => task.status === "pending") ?? null;
  const taskId = primaryTask?.id ?? null;
  const completeAction = taskId
    ? async (_formData: FormData) => {
        "use server";
        await completeFollowUp(lead.id, taskId);
      }
    : null;
  const rescheduleAction = taskId
    ? updateExistingFollowUp.bind(null, lead.id, taskId)
    : setFollowUp.bind(null, lead.id);
  const defaultDateTime = (lead.nextFollowUpAt ?? new Date().toISOString()).slice(0, 16);
  const defaultTitle = primaryTask?.title ?? `Follow up with ${lead.name}`;

  return (
    <div className="todayRowCard">
      <div className="todayRow">
        <div className="todayLeadCell">
          <div>
            <strong>{lead.name}</strong>
            <div className="muted">{lead.location} · {lead.source}</div>
          </div>
          <span className={`badge ${state}`}>{state}</span>
        </div>
        <div>{formatDate(lead.nextFollowUpAt)}</div>
        <div>{getLastTouchDays(lead)}d ago</div>
        <div>{getLeadAgeDays(lead)}d old</div>
        <div>{lead.ownerName ?? "Unassigned"}</div>
        <div className="todayActions">
          {completeAction ? <QuickCompleteForm action={completeAction} /> : <span className="muted">No open task</span>}
          <Link href={`/leads/${lead.id}`} className="buttonLike secondaryButtonLike smallButtonLike">Open</Link>
        </div>
      </div>
      <TodayRescheduleForm action={rescheduleAction} defaultTitle={defaultTitle} defaultDateTime={defaultDateTime} />
    </div>
  );
}

export function TodayBoard({ overdue, dueToday, unscheduled }: { overdue: Lead[]; dueToday: Lead[]; unscheduled: Lead[]; users?: TeamUser[] }) {
  return (
    <div className="stack-lg">
      <section className="header">
        <div>
          <p className="eyebrow">Today</p>
          <h2>Execution board</h2>
          <p className="muted">This is the actual work surface: finish overdue touches, clear today, and assign next steps to unscheduled leads.</p>
        </div>
      </section>

      <section className="grid metricGrid">
        <div className="card metricCard metricDanger">
          <div className="metricLabel">Overdue</div>
          <div className="metric">{overdue.length}</div>
          <p className="muted">Already missed.</p>
        </div>
        <div className="card metricCard metricWarn">
          <div className="metricLabel">Due today</div>
          <div className="metric">{dueToday.length}</div>
          <p className="muted">Must be finished today.</p>
        </div>
        <div className="card metricCard">
          <div className="metricLabel">Unscheduled</div>
          <div className="metric">{unscheduled.length}</div>
          <p className="muted">No next action exists.</p>
        </div>
        <div className="card metricCard">
          <div className="metricLabel">Total pressure</div>
          <div className="metric">{overdue.length + dueToday.length + unscheduled.length}</div>
          <p className="muted">Items that need operator attention.</p>
        </div>
      </section>

      <section className="card stack">
        <div className="todayHeaderRow">
          <span>Lead</span>
          <span>Next action</span>
          <span>Last touch</span>
          <span>Lead age</span>
          <span>Owner</span>
          <span>Actions</span>
        </div>
        <div className="stack">
          {overdue.map((lead) => <TodayRow key={`overdue-${lead.id}`} lead={lead} />)}
          {dueToday.map((lead) => <TodayRow key={`due-${lead.id}`} lead={lead} />)}
          {unscheduled.map((lead) => <TodayRow key={`unscheduled-${lead.id}`} lead={lead} />)}
          {overdue.length + dueToday.length + unscheduled.length === 0 ? (
            <div className="emptyState">Board is clear. Either the team is disciplined or the data is lying.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
