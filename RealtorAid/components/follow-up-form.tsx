"use client";

import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit">{pending ? "Scheduling..." : "Schedule follow-up"}</button>;
}

export function FollowUpForm({ action, current }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> ; current: string | null }) {
  const [state, formAction] = useFormState(action, {});
  const defaultValue = current ? current.slice(0, 16) : "";

  return (
    <form action={formAction} className="card">
      <h3>Next follow-up</h3>
      <input type="datetime-local" name="nextFollowUpAt" defaultValue={defaultValue} required />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <SubmitButton />
    </form>
  );
}
