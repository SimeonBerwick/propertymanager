import { AppShell } from '@/components/app-shell';
import { PageSection } from '@/components/page-section';

export default function TenantSubmitPage() {
  return (
    <AppShell>
      <PageSection title="Submit a maintenance request" description="Placeholder tenant intake screen for description, category, urgency, contact details, and photo uploads.">
        <form className="grid gap-4 md:grid-cols-2">
          <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Unit" />
          <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Contact phone" />
          <input className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Issue title" />
          <textarea className="min-h-32 rounded-md border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Describe the issue" />
          <select className="rounded-md border border-slate-300 px-3 py-2">
            <option>Category</option>
            <option>Plumbing</option>
            <option>Electrical</option>
            <option>HVAC</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2">
            <option>Urgency</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Emergency</option>
          </select>
          <input className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" type="file" />
          <button className="w-fit rounded-md bg-brand-700 px-4 py-2 text-white" type="button">Submit request</button>
        </form>
      </PageSection>
    </AppShell>
  );
}
