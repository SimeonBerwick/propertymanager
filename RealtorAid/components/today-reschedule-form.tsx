"use client";

import { useFormState } from "react-dom";
import { PendingButton } from "@/components/pending-button";

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
      <PendingButton idleLabel="Reschedule" pendingLabel="Saving..." className="secondary" />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
    </form>
  );
}
