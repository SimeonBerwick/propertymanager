export function QuickCompleteForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <button type="submit">Complete</button>
    </form>
  );
}
