import {
  Prisma,
  RequestCategory,
  RequestStatus,
  RequestUrgency,
  UserRole,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  assertPropertyInOrganization,
  assertRegionInOrganization,
  assertTenantInOrganization,
  assertUnitInOrganization,
  assertVendorInOrganization,
} from '@/lib/operator-scope';

export type ActionState = {
  error?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function parseOptionalInt(value: string, label: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a whole number or blank.`);
  }
  return parsed;
}

function parseOptionalFloat(value: string, label: string) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${label} must be a positive number or blank.`);
  }
  return parsed;
}

export function parseRegionInput(formData: FormData, organizationId: string): Prisma.RegionUncheckedCreateInput {
  const name = getString(formData, 'name');
  const slugInput = getOptionalString(formData, 'slug');

  if (!organizationId) throw new Error('Organization is required.');
  if (!name) throw new Error('Region name is required.');

  const slug = slugInput
    ? slugInput
        .toLowerCase()
        .replace(/[^a-z0-9-\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
    : null;

  if (slugInput && !slug) throw new Error('Region slug must contain letters or numbers.');

  return {
    organizationId,
    name,
    slug,
    notes: getOptionalString(formData, 'notes'),
  };
}

export async function parsePropertyInput(formData: FormData, organizationId: string): Promise<Prisma.PropertyUncheckedCreateInput> {
  const name = getString(formData, 'name');
  const addressLine1 = getString(formData, 'addressLine1');
  const city = getString(formData, 'city');
  const state = getString(formData, 'state');
  const postalCode = getString(formData, 'postalCode');
  const regionId = getOptionalString(formData, 'regionId');

  if (!organizationId) throw new Error('Organization is required.');
  if (!name) throw new Error('Property name is required.');
  if (!addressLine1) throw new Error('Address line 1 is required.');
  if (!city) throw new Error('City is required.');
  if (!state) throw new Error('State is required.');
  if (!postalCode) throw new Error('Postal code is required.');

  if (regionId) {
    await assertRegionInOrganization(organizationId, regionId);
  }

  return {
    organizationId,
    regionId,
    name,
    addressLine1,
    addressLine2: getOptionalString(formData, 'addressLine2'),
    city,
    state: state.toUpperCase(),
    postalCode,
    notes: getOptionalString(formData, 'notes'),
  };
}

export async function parseUnitInput(formData: FormData, organizationId: string): Promise<Prisma.UnitUncheckedCreateInput> {
  const propertyId = getString(formData, 'propertyId');
  const label = getString(formData, 'label');
  const bedroomCount = getString(formData, 'bedroomCount');
  const bathroomCount = getString(formData, 'bathroomCount');

  if (!propertyId) throw new Error('Property is required.');
  if (!label) throw new Error('Unit label is required.');

  await assertPropertyInOrganization(organizationId, propertyId);

  return {
    propertyId,
    label,
    bedroomCount: parseOptionalInt(bedroomCount, 'Bedroom count'),
    bathroomCount: parseOptionalFloat(bathroomCount, 'Bathroom count'),
    occupancyStatus: getOptionalString(formData, 'occupancyStatus'),
  };
}

export async function parseRequestInput(formData: FormData, organizationId: string): Promise<Prisma.MaintenanceRequestUncheckedCreateInput> {
  const propertyId = getString(formData, 'propertyId');
  const unitId = getString(formData, 'unitId');
  const tenantId = getOptionalString(formData, 'tenantId');
  const assignedVendorId = getOptionalString(formData, 'assignedVendorId');
  const title = getString(formData, 'title');
  const description = getString(formData, 'description');
  const category = getString(formData, 'category');
  const urgency = getString(formData, 'urgency');
  const status = getString(formData, 'status');
  const createdByRole = getString(formData, 'createdByRole');
  const scheduledFor = getString(formData, 'scheduledFor');

  if (!propertyId) throw new Error('Property is required.');
  if (!unitId) throw new Error('Unit is required.');
  if (!title) throw new Error('Title is required.');
  if (!description) throw new Error('Description is required.');
  if (!Object.values(RequestCategory).includes(category as RequestCategory)) throw new Error('Category is invalid.');
  if (!Object.values(RequestUrgency).includes(urgency as RequestUrgency)) throw new Error('Urgency is invalid.');
  if (!Object.values(RequestStatus).includes(status as RequestStatus)) throw new Error('Status is invalid.');
  if (!Object.values(UserRole).includes(createdByRole as UserRole)) throw new Error('Created-by role is invalid.');

  await assertPropertyInOrganization(organizationId, propertyId);

  const unit = await assertUnitInOrganization(organizationId, unitId);
  if (unit.propertyId !== propertyId) throw new Error('Selected unit does not belong to the selected property.');

  if (tenantId) {
    const tenant = await assertTenantInOrganization(organizationId, tenantId);
    if (tenant.unitId !== unitId) throw new Error('Selected tenant does not belong to the selected unit.');
  }

  if (assignedVendorId) {
    await assertVendorInOrganization(organizationId, assignedVendorId);
  }

  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
  if (scheduledFor && Number.isNaN(scheduledDate?.getTime())) {
    throw new Error('Scheduled date is invalid.');
  }

  return {
    propertyId,
    unitId,
    tenantId,
    assignedVendorId,
    title,
    description,
    category: category as RequestCategory,
    urgency: urgency as RequestUrgency,
    status: status as RequestStatus,
    createdByRole: createdByRole as UserRole,
    isTenantVisible: formData.get('isTenantVisible') === 'on',
    isVendorVisible: formData.get('isVendorVisible') === 'on',
    scheduledFor: scheduledDate,
    closedAt: status === RequestStatus.DONE ? new Date() : null,
  };
}

export const requestCategoryOptions = Object.values(RequestCategory);
export const requestUrgencyOptions = Object.values(RequestUrgency);
export const requestStatusOptions = Object.values(RequestStatus);
export const userRoleOptions = Object.values(UserRole);
