"use client";

import { useFormState, useFormStatus } from "react-dom";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit">{pending ? "Saving..." : label}</button>;
}

export function LeadForm({ action }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="card">
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
        <div />
      </div>
      <input name="tags" placeholder="Tags, comma separated" />
      <textarea name="notes" placeholder="Anything the agent needs to know right now" />
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <SubmitButton label="Create lead" />
    </form>
  );
}
