"use client";

import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit">{pending ? "Logging..." : "Log activity"}</button>;
}

export function ActivityForm({ action }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="card">
      <h3>Log activity</h3>
      <select name="type" defaultValue="call">
        <option value="call">Call</option>
        <option value="text">Text</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
        <option value="showing">Showing</option>
        <option value="note">Note</option>
      </select>
      <textarea name="summary" placeholder="What happened, what matters, what is next" required />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <SubmitButton />
    </form>
  );
}
