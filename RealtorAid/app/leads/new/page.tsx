import { createLead } from "@/app/actions";
import { LeadForm } from "@/components/lead-form";

export default function NewLeadPage() {
  return (
    <div className="page">
      <div className="header">
        <div>
          <p className="eyebrow">Capture</p>
          <h2>Create a lead without ceremony</h2>
          <p className="muted">Capture the minimum real data, then move the lead into action fast.</p>
        </div>
      </div>
      <LeadForm action={createLead} />
    </div>
  );
}
