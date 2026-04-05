"use client";

import { useFormState } from "react-dom";
import { PendingButton } from "@/components/pending-button";

export function LeadForm({ action }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="card stack-lg">
      <div>
        <p className="eyebrow">Lead intake</p>
        <h3>Minimum viable truth</h3>
        <p className="muted">Do not optimize for perfect CRM data. Optimize for enough context to take the next step.</p>
      </div>

      <div className="grid cols-3">
        <input name="name" placeholder="Full name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="phone" placeholder="Phone" required />
      </div>
      <div className="grid cols-3">
        <input name="source" placeholder="Lead source" required />
        <input name="location" placeholder="Target area" required />
        <input name="budget" placeholder="Budget" required />
      </div>
      <div className="grid cols-3">
        <select name="currency" defaultValue="usd" required>
          <option value="usd">US Dollar</option>
          <option value="peso">Peso</option>
          <option value="pound">Pound</option>
          <option value="euro">Euro</option>
        </select>
        <select name="language" defaultValue="english" required>
          <option value="english">English</option>
          <option value="spanish">Spanish</option>
          <option value="french">French</option>
        </select>
        <input name="tags" placeholder="Tags, comma separated" />
      </div>
      <textarea name="notes" placeholder="Critical context: intent, timeline, blockers, deal shape" />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <PendingButton idleLabel="Create lead" pendingLabel="Creating..." />
    </form>
  );
}
