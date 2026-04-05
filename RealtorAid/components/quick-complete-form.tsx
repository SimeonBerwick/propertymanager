import { PendingButton } from "@/components/pending-button";

export function QuickCompleteForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <PendingButton idleLabel="Complete" pendingLabel="Completing..." />
    </form>
  );
}
