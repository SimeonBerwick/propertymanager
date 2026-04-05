import { notFound } from "next/navigation";
import {
  cancelFollowUp,
  completeFollowUp,
  createActivity,
  setFollowUp,
  setLeadOwner,
  setLeadStage,
  updateExistingFollowUp,
} from "@/app/actions";
import { ActivityForm } from "@/components/activity-form";
import { FollowUpForm, FollowUpTaskEditor } from "@/components/follow-up-form";
import { LeadOwnerForm } from "@/components/lead-owner-form";
import { requireUser } from "@/lib/auth";
import { getLeadExecutionState, getLeadAgeDays, getLastTouchDays } from "@/lib/lead-state";
import { getLead, listTeamUsers } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const context = { userId: user.id, organizationId: user.organizationId };
  const [lead, teamUsers] = await Promise.all([
    getLead(params.id, context),
    listTeamUsers(context),
  ]);
  if (!lead) notFound();

  const activityAction = createActivity.bind(null, lead.id);
  const followUpAction = setFollowUp.bind(null, lead.id);
  const ownerAction = async (_state: { error?: string }, formData: FormData) => {
    "use server";
    return setLeadOwner(lead.id, formData);
  };
  const stageAction = setLeadStage.bind(null, lead.id);
  const executionState = getLeadExecutionState(lead);

  return (
    <div className="page">
      <section className="card heroCard detailHeroCard">
        <div className="stack">
          <div>
            <p className="eyebrow">Lead detail</p>
            <div className="detailTopRow">
              <h1>{lead.name}</h1>
              <span className={`badge ${executionState}`}>{executionState}</span>
            </div>
            <p className="muted">
              {lead.source} · {lead.location} · {lead.budget} · {lead.currency} · {lead.language}
            </p>
          </div>

          <div className="grid cols-3">
            <div className="cardInset">
              <div className="metricLabel">Next touch</div>
              <div style={{ marginTop: 10, fontWeight: 700 }}>{formatDate(lead.nextFollowUpAt)}</div>
            </div>
            <div className="cardInset">
              <div className="metricLabel">Last touch</div>
              <div style={{ marginTop: 10, fontWeight: 700 }}>{getLastTouchDays(lead)}d ago</div>
            </div>
            <div className="cardInset">
              <div className="metricLabel">Lead age</div>
              <div style={{ marginTop: 10, fontWeight: 700 }}>{getLeadAgeDays(lead)}d</div>
            </div>
          </div>
        </div>

        <div className="cardInset stack">
          <div>
            <div className="metricLabel">Pipeline control</div>
            <p className="muted">Use stage sparingly. Scheduling and contact discipline matter more than taxonomy.</p>
          </div>
          <form action={stageAction} className="stack compactForm">
            <select name="stage" defaultValue={lead.stage}>
              <option value="new">New</option>
              <option value="active">Active</option>
              <option value="nurture">Nurture</option>
              <option value="under-contract">Under Contract</option>
              <option value="closed">Closed</option>
            </select>
            <button type="submit" className="secondary">Update stage</button>
          </form>
          <LeadOwnerForm action={ownerAction} users={teamUsers} currentOwnerUserId={lead.ownerUserId} />
        </div>
      </section>

      <section className="twoCol">
        <div className="stack">
          <div className="card stack">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Snapshot</p>
                <h3>Decision context</h3>
              </div>
            </div>
            <div className="kv"><strong>Email</strong><span>{lead.email}</span></div>
            <div className="kv"><strong>Phone</strong><span>{lead.phone}</span></div>
            <div className="kv"><strong>Owner</strong><span>{lead.ownerName || "Unassigned"}</span></div>
            <div className="kv"><strong>Tags</strong><span>{lead.tags.join(", ") || "None"}</span></div>
            <div className="kv"><strong>Notes</strong><span>{lead.notes || "No notes yet."}</span></div>
          </div>

          <div className="card stack">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">Execution</p>
                <h3>Follow-up tasks</h3>
              </div>
            </div>
            {lead.followUpTasks.length === 0 ? (
              <div className="emptyState">No follow-up tasks yet. That means the system has no next move.</div>
            ) : (
              lead.followUpTasks.map((task) => {
                const updateAction = updateExistingFollowUp.bind(null, lead.id, task.id);
                const completeAction = completeFollowUp.bind(null, lead.id, task.id);
                const cancelAction = cancelFollowUp.bind(null, lead.id, task.id);

                return (
                  <FollowUpTaskEditor
                    key={task.id}
                    task={task}
                    updateAction={updateAction}
                    completeAction={completeAction}
                    cancelAction={cancelAction}
                  />
                );
              })
            )}
          </div>

          <div className="card stack">
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">History</p>
                <h3>Activity timeline</h3>
              </div>
            </div>
            {lead.activities.map((activity) => (
              <div key={activity.id} className="timelineItem">
                <div className="detailTopRow">
                  <span className={`badge ${lead.stage}`}>{activity.type}</span>
                  <span className="muted">{formatDate(activity.occurredAt)}</span>
                </div>
                <div style={{ marginTop: 8 }}>{activity.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <ActivityForm action={activityAction} />
          <FollowUpForm action={followUpAction} current={lead.nextFollowUpAt} />
        </div>
      </section>
    </div>
  );
}
