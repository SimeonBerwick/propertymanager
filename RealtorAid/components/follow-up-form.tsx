"use client";

import { useFormState, useFormStatus } from "react-dom";
import { FollowUpTask } from "@/lib/types";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button type="submit">{pending ? pendingLabel : label}</button>;
}

export function FollowUpForm({
  action,
  current,
}: {
  action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  current: string | null;
}) {
  const [state, formAction] = useFormState(action, {});
  const defaultValue = current ? current.slice(0, 16) : "";

  return (
    <form action={formAction} className="card stack">
      <div>
        <p className="eyebrow">Next action</p>
        <h3>Schedule the next touch</h3>
      </div>
      <input type="text" name="title" placeholder="Follow up with client" required />
      <input type="datetime-local" name="nextFollowUpAt" defaultValue={defaultValue} required />
      <textarea name="notes" placeholder="Context for the next touch." />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <SubmitButton label="Schedule follow-up" pendingLabel="Scheduling..." />
    </form>
  );
}

export function FollowUpTaskEditor({
  task,
  updateAction,
  completeAction,
  cancelAction,
}: {
  task: FollowUpTask;
  updateAction: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  completeAction: () => Promise<{ error?: string }>;
  cancelAction: () => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useFormState(updateAction, {});
  const defaultValue = task.dueAt.slice(0, 16);
  const completeFormAction = async () => {
    await completeAction();
  };
  const cancelFormAction = async () => {
    await cancelAction();
  };

  return (
    <div className="timelineItem stack">
      <div className="detailTopRow">
        <div>
          <strong>{task.title}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            Due {new Date(task.dueAt).toLocaleString()}
          </div>
        </div>
        <span className={`badge ${task.status === "pending" ? "due" : "active"}`}>{task.status}</span>
      </div>

      <div className="muted">{task.notes || "No notes yet."}</div>

      {task.status === "pending" ? (
        <>
          <form action={formAction} className="stack compactForm">
            <input type="text" name="title" defaultValue={task.title} required />
            <input type="datetime-local" name="nextFollowUpAt" defaultValue={defaultValue} required />
            <textarea name="notes" defaultValue={task.notes} placeholder="Add context for the next touch." />
            {state.error ? <div className="badge overdue">{state.error}</div> : null}
            <div className="inline">
              <SubmitButton label="Update" pendingLabel="Updating..." />
            </div>
          </form>
          <div className="inline">
            <form action={completeFormAction}>
              <button type="submit">Complete</button>
            </form>
            <form action={cancelFormAction}>
              <button type="submit" className="secondary">Cancel</button>
            </form>
          </div>
        </>
      ) : (
        <div className="muted">
          {task.status === "completed" && task.completedAt
            ? `Completed ${new Date(task.completedAt).toLocaleString()}`
            : "Canceled"}
        </div>
      )}
    </div>
  );
}
