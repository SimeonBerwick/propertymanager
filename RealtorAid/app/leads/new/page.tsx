import { createLead } from "@/app/actions";
import { LeadForm } from "@/components/lead-form";

export default function NewLeadPage() {
  return (
    <div className="page">
      <div className="header">
        <div>
          <p className="eyebrow">Capture</p>
          <h2>Quick add lead</h2>
          <p className="muted">Fast intake first. Perfect data later.</p>
        </div>
      </div>
      <LeadForm action={createLead} />
    </div>
  );
}
