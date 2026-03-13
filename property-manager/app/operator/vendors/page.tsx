import { AppShell } from '@/components/app-shell';
import { ErrorBanner } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import { requireOperatorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/operator-data';
import { createVendorInviteAction } from '@/app/operator/invites/actions';

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; inviteLink?: string; inviteType?: string }>;
}) {
  const session = await requireOperatorSession();
  const resolvedSearchParams = await searchParams;
  const vendors = await prisma.vendor.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ trade: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          requests: true,
        },
      },
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <ErrorBanner message={resolvedSearchParams.error} />
        <PageSection title="Vendors" description="Generate vendor join links from your real org-scoped vendor roster.">
          <div className="grid gap-4 md:grid-cols-2">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{vendor.name}</p>
                <p className="mt-1 text-sm text-slate-600">{vendor.trade}</p>
                <p className="mt-1 text-xs text-slate-500">{vendor.email || 'No email saved'} · Added {formatDate(vendor.createdAt)} · {vendor._count.requests} assigned requests</p>
                <p className="mt-3 text-sm text-slate-500">Creating a new invite revokes any older active vendor invite for this vendor.</p>
                <form action={createVendorInviteAction} className="mt-4">
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <input type="hidden" name="returnTo" value="/operator/vendors" />
                  <button className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white" type="submit">
                    Generate vendor invite link
                  </button>
                </form>
              </div>
            ))}
            {vendors.length === 0 ? <p className="text-sm text-slate-600">No vendors exist in this organization yet.</p> : null}
          </div>
          {resolvedSearchParams.inviteLink && resolvedSearchParams.inviteType === 'vendor' ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-medium">Vendor invite ready</p>
              <p className="mt-2 break-all font-mono text-xs">{resolvedSearchParams.inviteLink}</p>
              <p className="mt-2 text-xs text-emerald-800">Share this link with the vendor. It expires in 7 days and is scoped to that vendor record inside this organization.</p>
            </div>
          ) : null}
        </PageSection>
      </div>
    </AppShell>
  );
}
