import Link from "next/link";
import { listLeads } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export default function LeadsPage() {
  const leads = listLeads();

  return (
    <div className="page">
      <section className="header">
        <div>
          <p className="eyebrow">Pipeline</p>
          <h2>Lead list</h2>
          <p className="muted">Every live lead, with next action visible.</p>
        </div>
        <Link href="/leads/new"><button>Quick add</button></Link>
      </section>

      <div className="list">
        {leads.map((lead) => (
          <Link className="leadRow" key={lead.id} href={`/leads/${lead.id}`}>
            <div>
              <strong>{lead.name}</strong>
              <div className="muted">{lead.email} · {lead.phone}</div>
            </div>
            <div>{lead.location}</div>
            <div>{lead.source}</div>
            <div>{formatDate(lead.nextFollowUpAt)}</div>
            <div><span className={`badge ${lead.stage}`}>{lead.stage}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
