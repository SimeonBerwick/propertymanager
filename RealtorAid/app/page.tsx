import Link from "next/link";
import { DashboardQueue } from "@/components/dashboard-queue";
import { getDashboardQueues, listLeads } from "@/lib/store";

export default function DashboardPage() {
  const leads = listLeads();
  const queues = getDashboardQueues();

  return (
    <div className="page">
      <section className="header">
        <div>
          <p className="eyebrow">Ops cockpit</p>
          <h2>Lead dashboard</h2>
          <p className="muted">Work the queue. Don’t let hot leads decay into stale leads.</p>
        </div>
        <Link href="/leads/new"><button>Quick add lead</button></Link>
      </section>

      <section className="grid cols-4">
        <div className="card"><div className="muted">Total Leads</div><div className="metric">{leads.length}</div></div>
        <div className="card"><div className="muted">New</div><div className="metric">{queues.newLeads.length}</div></div>
        <div className="card"><div className="muted">Due Today</div><div className="metric">{queues.dueToday.length}</div></div>
        <div className="card"><div className="muted">Overdue</div><div className="metric">{queues.overdue.length}</div></div>
      </section>

      <section className="grid cols-4">
        <DashboardQueue title="New" subtitle="Fresh leads needing first action." leads={queues.newLeads} />
        <DashboardQueue title="Due Today" subtitle="Follow-ups scheduled for today." leads={queues.dueToday} tone="due" />
        <DashboardQueue title="Overdue" subtitle="These slipped. Fix it now." leads={queues.overdue} tone="overdue" />
        <DashboardQueue title="Stale" subtitle="No contact in 7+ days." leads={queues.stale} />
      </section>
    </div>
  );
}
