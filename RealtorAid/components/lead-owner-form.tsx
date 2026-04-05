"use client";

import { useFormState, useFormStatus } from "react-dom";
import { TeamUser } from "@/lib/types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="secondary">{pending ? "Saving..." : "Assign owner"}</button>;
}

export function LeadOwnerForm({
  action,
  users,
  currentOwnerUserId,
}: {
  action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  users: TeamUser[];
  currentOwnerUserId: string | null;
}) {
  const [state, formAction] = useFormState(action, {});

  return (
    <form action={formAction} className="stack compactForm">
      <select name="ownerUserId" defaultValue={currentOwnerUserId ?? ""}>
        <option value="">Unassigned</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>{user.name} · {user.role}</option>
        ))}
      </select>
      {state.error ? <div className="badge overdue">{state.error}</div> : null}
      <SubmitButton />
    </form>
  );
}
