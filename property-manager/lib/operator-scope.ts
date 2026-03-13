import { RequestStatus, RequestUrgency } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type OperatorScope = {
  userId: string;
  organizationId: string;
  displayName: string;
  email?: string;
};

export function getOperatorOrganizationWhere(organizationId: string) {
  return { organizationId };
}

export function getOperatorRegionWhere(organizationId: string, regionId: string) {
  return {
    id: regionId,
    organizationId,
  };
}

export function getOperatorPropertyWhere(organizationId: string, propertyId: string) {
  return {
    id: propertyId,
    organizationId,
  };
}

export function getOperatorUnitWhere(organizationId: string, unitId: string) {
  return {
    id: unitId,
    property: {
      organizationId,
    },
  };
}

export function getOperatorRequestWhere(organizationId: string, requestId: string) {
  return {
    id: requestId,
    property: {
      organizationId,
    },
  };
}

export function getOperatorVendorWhere(organizationId: string, vendorId: string) {
  return {
    id: vendorId,
    organizationId,
  };
}

export async function assertRegionInOrganization(organizationId: string, regionId: string) {
  const region = await prisma.region.findFirst({
    where: getOperatorRegionWhere(organizationId, regionId),
    select: { id: true, organizationId: true },
  });

  if (!region) throw new Error('Selected region was not found in your organization.');
  return region;
}

export async function assertPropertyInOrganization(organizationId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: getOperatorPropertyWhere(organizationId, propertyId),
    select: { id: true, organizationId: true },
  });

  if (!property) throw new Error('Selected property was not found in your organization.');
  return property;
}

export async function assertUnitInOrganization(organizationId: string, unitId: string) {
  const unit = await prisma.unit.findFirst({
    where: getOperatorUnitWhere(organizationId, unitId),
    select: { id: true, propertyId: true },
  });

  if (!unit) throw new Error('Selected unit was not found in your organization.');
  return unit;
}

export async function assertTenantInOrganization(organizationId: string, tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      unit: {
        property: {
          organizationId,
        },
      },
    },
    select: { id: true, unitId: true },
  });

  if (!tenant) throw new Error('Selected tenant was not found in your organization.');
  return tenant;
}

export async function assertVendorInOrganization(organizationId: string, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: getOperatorVendorWhere(organizationId, vendorId),
    select: { id: true },
  });

  if (!vendor) throw new Error('Selected vendor was not found in your organization.');
  return vendor;
}

export const OPEN_REQUEST_STATUSES = [RequestStatus.NEW, RequestStatus.SCHEDULED, RequestStatus.IN_PROGRESS];
export const URGENT_REQUEST_URGENCIES = [RequestUrgency.HIGH, RequestUrgency.EMERGENCY];
