"use client";

import { useFormState, useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="secondary">{pending ? "Saving..." : "Reschedule"}</button>;
}

export function TodayRescheduleForm({
  action,
  defaultTitle,
  defaultDateTime,
}: {
  action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  defaultTitle: string;
  defaultDateTime: string;
}) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="todayRescheduleForm">
      <input type="text" name="title" defaultValue={defaultTitle} required />
      <input type="datetime-local" name="nextFollowUpAt" defaultValue={defaultDateTime} required />
      <input type="hidden" name="notes" value="Updated from Today board." />
      <SubmitButton />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
    </form>
  );
}
