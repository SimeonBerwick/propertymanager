import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, Input, Select, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { requestCategoryOptions, requestUrgencyOptions } from '@/lib/operator-crud';
import { requireTenantSession } from '@/lib/auth';
import { formatDateTime, getStatusClasses, getUrgencyClasses } from '@/lib/operator-data';
import { getRequestStatusLabel } from '@/lib/request-lifecycle';
import { getRecentTenantRequests } from '@/lib/tenant-requests';
import { submitTenantRequest } from './actions';

export default async function TenantSubmitPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const [session, resolvedSearchParams] = await Promise.all([
    requireTenantSession(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const recentRequests = await getRecentTenantRequests(session.tenantId);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageSection
          title="Submit a maintenance request"
          description={`Signed in as ${session.displayName}. Submit a new maintenance issue for your unit and optionally attach photos.`}
        >
          <form action={submitTenantRequest} className="space-y-4" encType="multipart/form-data">
            <ErrorBanner message={resolvedSearchParams?.error} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
                Signed in as <strong>{session.displayName}</strong>. You can only submit and view requests tied to your own tenant record.
              </div>
              <Field label="Best callback number (optional)">
                <Input name="contactPhone" placeholder="555-0101" />
              </Field>
              <Field label="Issue title" >
                <Input name="title" placeholder="Kitchen sink leak" required />
              </Field>
              <Field label="Category">
                <Select name="category" defaultValue="GENERAL" required>
                  {requestCategoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Urgency">
                <Select name="urgency" defaultValue="MEDIUM" required>
                  {requestUrgencyOptions.map((urgency) => (
                    <option key={urgency} value={urgency}>{urgency.replace('_', ' ')}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Entry / access notes (optional)">
                <Input name="entryNotes" placeholder="Dog in unit, call before entry, gate code, etc." />
              </Field>
            </div>
            <Field label="Describe the issue">
              <Textarea
                name="description"
                rows={7}
                placeholder="What happened, when it started, where it is happening, and anything that makes it better or worse."
                required
              />
            </Field>
            <Field label="Photos (optional)">
              <Input name="photos" type="file" accept="image/*" multiple />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">Submit request</button>
              <p className="text-sm text-slate-500">Uploads support JPG, PNG, WebP, and GIF up to 5 MB each.</p>
            </div>
          </form>
        </PageSection>

        <PageSection title="What happens next" description="The tenant portal now links to a real request record and visible timeline.">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Your request is logged immediately in the operator inbox.</li>
            <li>You land on a tenant-facing status page for the request after submitting.</li>
            <li>Tenant-visible updates appear there as the status changes.</li>
          </ul>
          <div className="mt-4 text-sm text-slate-600">
            Seed data includes at least one tenant-visible request already, and new submissions land directly on their own status page.
          </div>
        </PageSection>

        <PageSection title="Your recent requests" description="Use these links to review what you have already submitted.">
          <div className="space-y-3">
            {recentRequests.length === 0 ? (
              <p className="text-sm text-slate-600">No tenant-visible requests yet.</p>
            ) : (
              recentRequests.map((request) => (
                <Link key={request.id} href={`/tenant/request/${request.id}`} className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{request.title}</p>
                      <p className="text-sm text-slate-600">{request.property.name} · Unit {request.unit.label}</p>
                      <p className="mt-1 text-xs text-slate-500">Submitted {formatDateTime(request.createdAt)}</p>
                    </div>
                    <div className="flex gap-2 text-xs font-medium">
                      <span className={`rounded-full px-3 py-1 ${getStatusClasses(request.status)}`}>{getRequestStatusLabel(request.status)}</span>
                      <span className={`rounded-full px-3 py-1 ${getUrgencyClasses(request.urgency)}`}>{request.urgency.replace('_', ' ')}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </PageSection>
      </div>
    </AppShell>
  );
}
