import { notFound } from "next/navigation";
import {
  cancelFollowUp,
  completeFollowUp,
  createActivity,
  setFollowUp,
  setLeadStage,
  updateExistingFollowUp,
} from "@/app/actions";
import { ActivityForm } from "@/components/activity-form";
import { FollowUpForm, FollowUpTaskEditor } from "@/components/follow-up-form";
import { requireUser } from "@/lib/auth";
import { getLead } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const lead = await getLead(params.id, { userId: user.id, organizationId: user.organizationId });
  if (!lead) notFound();

  const activityAction = createActivity.bind(null, lead.id);
  const followUpAction = setFollowUp.bind(null, lead.id);
  const stageAction = setLeadStage.bind(null, lead.id);

  return (
    <div className="page">
      <section className="header">
        <div>
          <p className="eyebrow">Lead detail</p>
          <h1>{lead.name}</h1>
          <p className="muted">
            {lead.source} · {lead.location} · {lead.budget} · {lead.currency} · {lead.language}
          </p>
        </div>
        <form action={stageAction}>
          <div className="inline">
            <select name="stage" defaultValue={lead.stage}>
              <option value="new">New</option>
              <option value="active">Active</option>
              <option value="nurture">Nurture</option>
              <option value="under-contract">Under Contract</option>
              <option value="closed">Closed</option>
            </select>
            <button type="submit" className="secondary">
              Update stage
            </button>
          </div>
        </form>
      </section>

      <section className="twoCol">
        <div className="stack">
          <div className="card stack">
            <h3>Lead snapshot</h3>
            <div className="kv">
              <strong>Email</strong>
              <span>{lead.email}</span>
            </div>
            <div className="kv">
              <strong>Phone</strong>
              <span>{lead.phone}</span>
            </div>
            <div className="kv">
              <strong>Owner</strong>
              <span>{lead.ownerName || "Unassigned"}</span>
            </div>
            <div className="kv">
              <strong>Last contact</strong>
              <span>{formatDate(lead.lastContactAt)}</span>
            </div>
            <div className="kv">
              <strong>Next follow-up</strong>
              <span>{formatDate(lead.nextFollowUpAt)}</span>
            </div>
            <div className="kv">
              <strong>Currency</strong>
              <span>{lead.currency}</span>
            </div>
            <div className="kv">
              <strong>Language</strong>
              <span>{lead.language}</span>
            </div>
            <div className="kv">
              <strong>Tags</strong>
              <span>{lead.tags.join(", ") || "None"}</span>
            </div>
            <div className="kv">
              <strong>Notes</strong>
              <span>{lead.notes || "No notes yet."}</span>
            </div>
          </div>

          <div className="card stack">
            <h3>Follow-up tasks</h3>
            {lead.followUpTasks.length === 0 ? (
              <div className="muted">No follow-up tasks yet.</div>
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
            <h3>Activity timeline</h3>
            {lead.activities.map((activity) => (
              <div key={activity.id} className="timelineItem">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
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
