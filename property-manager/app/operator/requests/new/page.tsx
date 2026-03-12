import { AppShell } from '@/components/app-shell';
import { ErrorBanner, Field, FormActions, Input, Select, Textarea } from '@/components/operator-form-ui';
import { PageSection } from '@/components/page-section';
import {
  requestCategoryOptions,
  requestStatusOptions,
  requestUrgencyOptions,
  userRoleOptions,
} from '@/lib/operator-crud';
import { prisma } from '@/lib/prisma';
import { createRequest } from '../actions';

export default async function NewRequestPage({ searchParams }: { searchParams?: Promise<{ error?: string; propertyId?: string; unitId?: string }> }) {
  const [properties, units, tenants, vendors] = await Promise.all([
    prisma.property.findMany({ orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }], include: { property: true } }),
    prisma.tenant.findMany({ orderBy: { name: 'asc' }, include: { unit: { include: { property: true } } } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <AppShell>
      <PageSection title="Add maintenance request" description="Log a new request directly from the operator surface.">
        <form action={createRequest} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property">
              <Select name="propertyId" defaultValue={resolvedSearchParams?.propertyId ?? ''} required>
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Unit">
              <Select name="unitId" defaultValue={resolvedSearchParams?.unitId ?? ''} required>
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.property.name} / {unit.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tenant (optional)">
              <Select name="tenantId" defaultValue="">
                <option value="">No tenant linked</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name} — {tenant.unit.property.name} / {tenant.unit.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned vendor (optional)">
              <Select name="assignedVendorId" defaultValue="">
                <option value="">Unassigned</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Title">
              <Input name="title" placeholder="Kitchen sink leak" required />
            </Field>
            <Field label="Created by role">
              <Select name="createdByRole" defaultValue="TENANT" required>
                {userRoleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </Select>
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
                  <option key={urgency} value={urgency}>{urgency}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="NEW" required>
                {requestStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </Field>
            <Field label="Scheduled for">
              <Input name="scheduledFor" type="datetime-local" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea name="description" rows={6} placeholder="Describe the issue, tenant report, access notes, and any operator context." required />
          </Field>
          <div className="flex flex-wrap gap-6 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" name="isTenantVisible" defaultChecked /> Tenant visible</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isVendorVisible" defaultChecked /> Vendor visible</label>
          </div>
          <FormActions cancelHref="/operator/requests" submitLabel="Create request" />
        </form>
      </PageSection>
    </AppShell>
  );
}
