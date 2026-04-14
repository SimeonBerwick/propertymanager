'use server';

import {
  EventVisibility,
  PaymentStatus,
  RequestEventType,
  RequestStatus,
  RequestTenderStatus,
  UserRole,
  VendorOfferStatus,
  VendorResponseStatus,
} from '@prisma/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { canTransition } from '@/lib/request-lifecycle';
import { requireOperatorSession } from '@/lib/auth';
import { getOperatorRequestWhere, getOperatorVendorWhere } from '@/lib/operator-scope';
import { isVendorEligibleForPreferredSelection } from '@/lib/vendor-management';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function getVendorIds(formData: FormData, key: string) {
  return Array.from(new Set(formData.getAll(key).filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)));
}

async function revalidateRequestPaths(requestId: string, propertyId?: string, unitId?: string) {
  revalidatePath('/operator');
  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath('/operator/vendors');
  revalidatePath('/operator/regions');
  revalidatePath('/vendor/queue');
  revalidatePath(`/vendor/requests/${requestId}`);
  revalidatePath(`/tenant/request/${requestId}`);
  if (propertyId) revalidatePath(`/operator/properties/${propertyId}`);
  if (unitId) revalidatePath(`/operator/units/${unitId}`);
}

const paymentStatuses = new Set<PaymentStatus>([
  PaymentStatus.UNPAID,
  PaymentStatus.HALF_DOWN,
  PaymentStatus.PAID_IN_FULL,
]);

export async function updateRequestStatus(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const nextStatus = formData.get('status');
  if (typeof nextStatus !== 'string') return;

  const request = await prisma.maintenanceRequest.findFirst({ where: getOperatorRequestWhere(session.organizationId, requestId) });
  if (!request) return;

  if (!Object.values(RequestStatus).includes(nextStatus as RequestStatus)) return;

  const status = nextStatus as RequestStatus;
  if (!canTransition(request.status, status)) return;

  const updated = await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      status,
      closedAt: status === RequestStatus.DONE || status === RequestStatus.CANCELED ? new Date() : null,
      events: {
        create: {
          type: RequestEventType.STATUS_CHANGED,
          actorRole: UserRole.OPERATOR,
          actorName: session.displayName,
          body: `Status updated to ${status.replace('_', ' ')}.`,
          visibility: EventVisibility.ALL,
        },
      },
    },
  });

  await revalidateRequestPaths(requestId, updated.propertyId, updated.unitId);
}

export async function cancelRequest(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const body = getString(formData, 'body');
  if (!body) return;

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    select: { id: true, propertyId: true, unitId: true, status: true },
  });
  if (!request || request.status === RequestStatus.CANCELED) return;

  await prisma.$transaction([
    prisma.requestTender.updateMany({
      where: { requestId, status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED] } },
      data: { status: RequestTenderStatus.CANCELED, decidedAt: new Date() },
    }),
    prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: RequestStatus.CANCELED,
        closedAt: new Date(),
        events: {
          create: {
            type: RequestEventType.STATUS_CHANGED,
            actorRole: UserRole.OPERATOR,
            actorName: session.displayName,
            body: `Request canceled by operator. Reason: ${body}`,
            visibility: EventVisibility.ALL,
          },
        },
      },
    }),
  ]);

  await revalidateRequestPaths(requestId, request.propertyId, request.unitId);
}

export async function updateTenantComments(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const tenantCommentsOpen = getBoolean(formData, 'tenantCommentsOpen');

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    select: { id: true, tenantCommentsOpen: true },
  });
  if (!request || request.tenantCommentsOpen === tenantCommentsOpen) return;

  await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      tenantCommentsOpen,
      events: {
        create: {
          type: RequestEventType.COMMENT,
          actorRole: UserRole.OPERATOR,
          actorName: session.displayName,
          body: tenantCommentsOpen ? 'Tenant comments reopened on this ticket.' : 'Tenant comments closed on this ticket.',
          visibility: EventVisibility.INTERNAL,
        },
      },
    },
  });

  await revalidateRequestPaths(requestId);
}

export async function updatePaymentStatus(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const nextPaymentStatus = getString(formData, 'paymentStatus');
  if (!paymentStatuses.has(nextPaymentStatus as PaymentStatus)) return;

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    select: { id: true, paymentStatus: true },
  });
  if (!request || request.paymentStatus === nextPaymentStatus) return;

  await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: {
      paymentStatus: nextPaymentStatus as PaymentStatus,
      events: {
        create: {
          type: RequestEventType.COMMENT,
          actorRole: UserRole.OPERATOR,
          actorName: session.displayName,
          body: `Payment status updated to ${(nextPaymentStatus as string).replaceAll('_', ' ').toLowerCase()}.`,
          visibility: EventVisibility.INTERNAL,
        },
      },
    },
  });

  await revalidateRequestPaths(requestId);
}

export async function addInternalNote(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const body = formData.get('body');
  if (typeof body !== 'string' || !body.trim()) return;

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    select: { id: true },
  });
  if (!request) return;

  await prisma.requestEvent.create({
    data: {
      requestId,
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: body.trim(),
      visibility: EventVisibility.INTERNAL,
    },
  });

  await revalidateRequestPaths(requestId);
}

export async function acceptVendorOffer(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const tenderId = getString(formData, 'tenderId');
  const body = getString(formData, 'body');

  const tender = await prisma.requestTender.findFirst({
    where: {
      id: tenderId,
      requestId,
      request: { property: { organizationId: session.organizationId } },
    },
    include: { vendor: true, request: true },
  });

  if (!tender) redirect(`/operator/requests/${requestId}`);

  await prisma.$transaction([
    prisma.requestTender.updateMany({
      where: { requestId, id: { not: tender.id }, status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED] } },
      data: { status: RequestTenderStatus.NOT_AWARDED, decidedAt: new Date() },
    }),
    prisma.requestTender.update({
      where: { id: tender.id },
      data: {
        status: RequestTenderStatus.AWARDED,
        decidedAt: new Date(),
        awardedAt: new Date(),
        operatorNote: body || tender.operatorNote,
      },
    }),
    prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        assignedVendorId: tender.vendorId,
        vendorOfferStatus: VendorOfferStatus.ACCEPTED,
        vendorResponseStatus: VendorResponseStatus.ACCEPTED,
        vendorPricingType: tender.pricingType,
        vendorPriceCents: tender.priceCents,
        vendorPlannedStartDate: tender.plannedStartDate,
        vendorExpectedCompletionDate: tender.expectedCompletionDate,
        events: {
          create: [
            {
              type: RequestEventType.VENDOR_ASSIGNED,
              actorRole: UserRole.OPERATOR,
              actorName: session.displayName,
              body: `Awarded vendor tender to ${tender.vendor.name}.`,
              visibility: EventVisibility.ALL,
            },
            {
              type: RequestEventType.COMMENT,
              actorRole: UserRole.OPERATOR,
              actorName: session.displayName,
              body: body ? `Vendor offer accepted. ${body}` : 'Vendor offer accepted.',
              visibility: EventVisibility.VENDOR,
            },
          ],
        },
      },
    }),
  ]);

  await revalidateRequestPaths(requestId, tender.request.propertyId, tender.request.unitId);
  redirect(`/operator/requests/${requestId}`);
}

export async function respondToVendorOffer(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const tenderId = getString(formData, 'tenderId');
  const action = getString(formData, 'vendorOfferAction');
  const body = getString(formData, 'body');
  if (!body) redirect(`/operator/requests/${requestId}`);

  const tender = await prisma.requestTender.findFirst({
    where: {
      id: tenderId,
      requestId,
      request: { property: { organizationId: session.organizationId } },
    },
    include: { vendor: true, request: { include: { property: true } } },
  });
  if (!tender) redirect(`/operator/requests/${requestId}`);

  if (action === 'send_back') {
    await prisma.$transaction([
      prisma.requestTender.update({
        where: { id: tender.id },
        data: {
          status: RequestTenderStatus.REQUESTED,
          operatorNote: body,
          vendorNote: null,
          pricingType: tender.pricingType,
          priceCents: tender.priceCents,
          plannedStartDate: tender.plannedStartDate,
          expectedCompletionDate: tender.expectedCompletionDate,
        },
      }),
      prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          vendorOfferStatus: VendorOfferStatus.REVISION_REQUESTED,
          events: {
            create: {
              type: RequestEventType.COMMENT,
              actorRole: UserRole.OPERATOR,
              actorName: session.displayName,
              body: `Tender from ${tender.vendor.name} sent back for revision: ${body}`,
              visibility: EventVisibility.VENDOR,
            },
          },
        },
      }),
    ]);
  } else if (action === 'reject') {
    await prisma.$transaction([
      prisma.requestTender.update({
        where: { id: tender.id },
        data: {
          status: RequestTenderStatus.NOT_AWARDED,
          decidedAt: new Date(),
          operatorNote: body,
        },
      }),
      prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          vendorOfferStatus: VendorOfferStatus.REJECTED,
          events: {
            create: {
              type: RequestEventType.COMMENT,
              actorRole: UserRole.OPERATOR,
              actorName: session.displayName,
              body: `Tender from ${tender.vendor.name} rejected: ${body}`,
              visibility: EventVisibility.VENDOR,
            },
          },
        },
      }),
    ]);
  } else {
    redirect(`/operator/requests/${requestId}`);
  }

  await revalidateRequestPaths(requestId, tender.request.propertyId, tender.request.unitId);
  redirect(`/operator/requests/${requestId}`);
}

export async function dispatchRequest(requestId: string, formData: FormData) {
  const session = await requireOperatorSession();
  const assignedVendorId = getString(formData, 'assignedVendorId');
  const dispatchMode = getString(formData, 'dispatchMode') || 'assign';
  const scheduledForInput = getString(formData, 'scheduledFor');
  const scopeOfWork = getString(formData, 'scopeOfWork');
  const isVendorVisible = getBoolean(formData, 'isVendorVisible');
  const vendorIds = dispatchMode === 'request_bid' ? getVendorIds(formData, 'vendorIds') : [];

  const request = await prisma.maintenanceRequest.findFirst({
    where: getOperatorRequestWhere(session.organizationId, requestId),
    include: { assignedVendor: true, property: true, tenders: true },
  });
  if (!request) redirect('/operator/requests');

  const region = request.property.regionId
    ? await prisma.region.findFirst({
        where: { id: request.property.regionId, organizationId: session.organizationId },
      })
    : null;

  const selectedIds = dispatchMode === 'request_bid' ? vendorIds : assignedVendorId ? [assignedVendorId] : [];
  const vendors = selectedIds.length > 0
    ? await prisma.vendor.findMany({
        where: { organizationId: session.organizationId, id: { in: selectedIds } },
        include: { serviceAreaAssignments: true },
      })
    : [];

  if (vendors.length !== selectedIds.length) redirect(`/operator/requests/${requestId}`);
  for (const vendor of vendors) {
    if (!isVendorEligibleForPreferredSelection(vendor)) redirect(`/operator/requests/${requestId}`);
    if (region && !vendor.serviceAreaAssignments.some((assignment) => assignment.regionId === region.id)) {
      redirect(`/operator/requests/${requestId}`);
    }
  }

  const scheduledFor = scheduledForInput ? new Date(scheduledForInput) : null;
  if (scheduledForInput && Number.isNaN(scheduledFor?.getTime())) redirect(`/operator/requests/${requestId}`);

  if (dispatchMode === 'request_bid') {
    if (vendorIds.length === 0) redirect(`/operator/requests/${requestId}`);
    const existingTenders = new Map(request.tenders.map((tender) => [tender.vendorId, tender]));
    const events = vendors.map((vendor) => ({
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: `Tender request sent to ${vendor.name}.${scopeOfWork ? ` Scope: ${scopeOfWork}` : ''}`,
      visibility: EventVisibility.VENDOR,
    }));

    await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        isVendorVisible,
        vendorOfferStatus: VendorOfferStatus.PENDING_REVIEW,
        tenders: {
          upsert: vendors.map((vendor) => ({
            where: { requestId_vendorId: { requestId, vendorId: vendor.id } },
            update: {
              status: RequestTenderStatus.REQUESTED,
              scopeOfWork: scopeOfWork || null,
              operatorNote: scopeOfWork || null,
              decidedAt: null,
              respondedAt: existingTenders.get(vendor.id)?.status === RequestTenderStatus.SUBMITTED ? existingTenders.get(vendor.id)?.respondedAt ?? null : null,
            },
            create: {
              vendorId: vendor.id,
              invitedByUserId: session.userId,
              status: RequestTenderStatus.REQUESTED,
              scopeOfWork: scopeOfWork || null,
              operatorNote: scopeOfWork || null,
            },
          })),
        },
        events: events.length > 0 ? { create: events } : undefined,
      },
    });

    await revalidateRequestPaths(requestId, request.propertyId, request.unitId);
    redirect(`/operator/requests/${requestId}`);
  }

  const nextVendor = vendors[0] ?? null;
  const vendorShouldSeeRequest = Boolean(nextVendor) && isVendorVisible;
  const nextStatus = nextVendor && scheduledFor && request.status === RequestStatus.NEW ? RequestStatus.SCHEDULED : request.status;
  const events = [] as Array<{ type: RequestEventType; actorRole: UserRole; actorName: string; body: string; visibility: EventVisibility }>;

  if (request.assignedVendorId !== (nextVendor?.id ?? '')) {
    events.push({
      type: RequestEventType.VENDOR_ASSIGNED,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: nextVendor ? `Vendor assigned: ${nextVendor.name}.` : 'Vendor assignment cleared.',
      visibility: EventVisibility.ALL,
    });
  }
  if (scopeOfWork) {
    events.push({
      type: RequestEventType.COMMENT,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: scopeOfWork,
      visibility: vendorShouldSeeRequest ? EventVisibility.VENDOR : EventVisibility.INTERNAL,
    });
  }
  if (scheduledFor) {
    events.push({
      type: RequestEventType.SCHEDULE_SET,
      actorRole: UserRole.OPERATOR,
      actorName: session.displayName,
      body: `Dispatch scheduled for ${scheduledFor.toLocaleString('en-US')}.`,
      visibility: EventVisibility.ALL,
    });
  }

  await prisma.$transaction([
    prisma.requestTender.updateMany({
      where: { requestId, status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED] }, ...(nextVendor ? { vendorId: { not: nextVendor.id } } : {}) },
      data: { status: RequestTenderStatus.NOT_AWARDED, decidedAt: new Date() },
    }),
    prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        assignedVendorId: nextVendor?.id ?? null,
        scheduledFor,
        isVendorVisible: vendorShouldSeeRequest,
        status: nextStatus,
        vendorResponseStatus: nextVendor ? VendorResponseStatus.ACCEPTED : request.vendorResponseStatus,
        vendorOfferStatus: nextVendor ? VendorOfferStatus.ACCEPTED : request.vendorOfferStatus,
        events: events.length > 0 ? { create: events } : undefined,
      },
    }),
  ]);

  await revalidateRequestPaths(requestId, request.propertyId, request.unitId);
  redirect(`/operator/requests/${requestId}`);
}
