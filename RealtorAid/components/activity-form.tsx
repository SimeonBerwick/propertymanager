"use client";

import { useFormState } from "react-dom";
import { PendingButton } from "@/components/pending-button";

export function ActivityForm({ action }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="card stack">
      <div>
        <p className="eyebrow">Contact log</p>
        <h3>Capture what changed</h3>
      </div>
      <select name="type" defaultValue="call">
        <option value="call">Call</option>
        <option value="text">Text</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
        <option value="showing">Showing</option>
        <option value="note">Note</option>
      </select>
      <textarea name="summary" placeholder="What happened, what matters now, and what should happen next" required />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <PendingButton idleLabel="Log activity" pendingLabel="Logging..." />
    </form>
  );
}
