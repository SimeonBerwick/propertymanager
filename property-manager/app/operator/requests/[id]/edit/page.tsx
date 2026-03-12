import { notFound } from 'next/navigation';
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
import { updateRequest } from '../../actions';

function formatDateTimeLocal(value: Date | null) {
  if (!value) return '';
  const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export default async function EditRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const [request, properties, units, tenants, vendors] = await Promise.all([
    prisma.maintenanceRequest.findUnique({ where: { id } }),
    prisma.property.findMany({ orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ orderBy: [{ property: { name: 'asc' } }, { label: 'asc' }], include: { property: true } }),
    prisma.tenant.findMany({ orderBy: { name: 'asc' }, include: { unit: { include: { property: true } } } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
  ]);

  if (!request) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const action = updateRequest.bind(null, request.id);

  return (
    <AppShell>
      <PageSection title={`Edit ${request.title}`} description="Update request metadata, routing, and visibility.">
        <form action={action} className="space-y-4">
          <ErrorBanner message={resolvedSearchParams?.error} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Property">
              <Select name="propertyId" defaultValue={request.propertyId} required>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Unit">
              <Select name="unitId" defaultValue={request.unitId} required>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.property.name} / {unit.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tenant (optional)">
              <Select name="tenantId" defaultValue={request.tenantId ?? ''}>
                <option value="">No tenant linked</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name} — {tenant.unit.property.name} / {tenant.unit.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned vendor (optional)">
              <Select name="assignedVendorId" defaultValue={request.assignedVendorId ?? ''}>
                <option value="">Unassigned</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Title">
              <Input name="title" defaultValue={request.title} required />
            </Field>
            <Field label="Created by role">
              <Select name="createdByRole" defaultValue={request.createdByRole} required>
                {userRoleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </Select>
            </Field>
            <Field label="Category">
              <Select name="category" defaultValue={request.category} required>
                {requestCategoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </Field>
            <Field label="Urgency">
              <Select name="urgency" defaultValue={request.urgency} required>
                {requestUrgencyOptions.map((urgency) => (
                  <option key={urgency} value={urgency}>{urgency}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={request.status} required>
                {requestStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Select>
            </Field>
            <Field label="Scheduled for">
              <Input name="scheduledFor" type="datetime-local" defaultValue={formatDateTimeLocal(request.scheduledFor)} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea name="description" rows={6} defaultValue={request.description} required />
          </Field>
          <div className="flex flex-wrap gap-6 text-sm text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" name="isTenantVisible" defaultChecked={request.isTenantVisible} /> Tenant visible</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isVendorVisible" defaultChecked={request.isVendorVisible} /> Vendor visible</label>
          </div>
          <FormActions cancelHref={`/operator/requests/${request.id}`} submitLabel="Save request" />
        </form>
      </PageSection>
    </AppShell>
  );
}
