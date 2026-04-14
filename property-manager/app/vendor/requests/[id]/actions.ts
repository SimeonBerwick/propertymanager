'use server';

import {
  EventVisibility,
  PaymentStatus,
  RequestEventType,
  RequestStatus,
  RequestTenderStatus,
  UserRole,
  VendorOfferStatus,
  VendorPricingType,
  VendorResponseStatus,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireVendorSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { persistVendorBidPdfs } from '@/lib/request-attachments';
import { canTransition } from '@/lib/request-lifecycle';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

function parsePriceCents(value: string) {
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'invalid';
  return Math.round(Number(value) * 100);
}

const vendorAllowedStatuses = new Set<RequestStatus>([
  RequestStatus.SCHEDULED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.DONE,
]);

const vendorResponseStatuses = new Set<VendorResponseStatus>([
  VendorResponseStatus.PENDING,
  VendorResponseStatus.ACCEPTED,
  VendorResponseStatus.DECLINED,
]);

const vendorPricingTypes = new Set<VendorPricingType>([
  VendorPricingType.NONE,
  VendorPricingType.ESTIMATE,
  VendorPricingType.SERVICE_CALL_ONLY,
  VendorPricingType.FIRM_BID,
  VendorPricingType.LABOR_ONLY_COST,
]);

export async function submitVendorUpdate(requestId: string, formData: FormData) {
  const session = await requireVendorSession();
  const nextStatus = getString(formData, 'status');
  const body = getString(formData, 'body');
  const shareWithTenant = getBoolean(formData, 'shareWithTenant');
  const responseStatusValue = getString(formData, 'vendorResponseStatus');
  const plannedStartValue = getString(formData, 'vendorPlannedStartDate');
  const expectedCompletionValue = getString(formData, 'vendorExpectedCompletionDate');
  const pricingTypeValue = getString(formData, 'vendorPricingType');
  const priceValue = getString(formData, 'vendorPrice');
  const finalBillValue = getString(formData, 'vendorFinalBill');
  const finalTaxValue = getString(formData, 'vendorFinalTax');
  const additionalCostsValue = getString(formData, 'vendorAdditionalCosts');
  const additionalTaxValue = getString(formData, 'vendorAdditionalTax');
  const bidFiles = formData.getAll('bidPdf').filter((value): value is File => value instanceof File && value.size > 0);

  if (!vendorResponseStatuses.has(responseStatusValue as VendorResponseStatus)) {
    redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20vendor%20response.`);
  }
  if (!vendorPricingTypes.has(pricingTypeValue as VendorPricingType)) {
    redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20pricing%20type.`);
  }

  const plannedStartDate = parseOptionalDate(plannedStartValue);
  if (plannedStartDate === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20planned%20start%20date.`);
  const expectedCompletionDate = parseOptionalDate(expectedCompletionValue);
  if (expectedCompletionDate === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20expected%20completion%20date.`);

  const vendorPriceCents = parsePriceCents(priceValue);
  if (vendorPriceCents === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20price%20using%20numbers%20only.`);
  const vendorFinalBillCents = parsePriceCents(finalBillValue);
  if (vendorFinalBillCents === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20final%20bill%20using%20numbers%20only.`);
  const vendorFinalTaxCents = parsePriceCents(finalTaxValue);
  if (vendorFinalTaxCents === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20a%20valid%20tax%20amount%20using%20numbers%20only.`);
  const vendorAdditionalCostsCents = parsePriceCents(additionalCostsValue);
  if (vendorAdditionalCostsCents === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20valid%20additional%20costs%20using%20numbers%20only.`);
  const vendorAdditionalTaxCents = parsePriceCents(additionalTaxValue);
  if (vendorAdditionalTaxCents === 'invalid') redirect(`/vendor/requests/${requestId}?error=Enter%20valid%20additional%20tax%20using%20numbers%20only.`);

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      isVendorVisible: true,
      OR: [
        { assignedVendorId: session.vendorId },
        { tenders: { some: { vendorId: session.vendorId, status: { in: [RequestTenderStatus.REQUESTED, RequestTenderStatus.SUBMITTED, RequestTenderStatus.AWARDED] } } } },
      ],
    },
    include: {
      assignedVendor: true,
      tenders: { where: { vendorId: session.vendorId }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!request) redirect('/unauthorized?requiredRole=vendor');
  const tender = request.tenders[0] ?? null;
  const responseStatus = responseStatusValue as VendorResponseStatus;
  const pricingType = pricingTypeValue as VendorPricingType;
  const isAwardedVendor = request.assignedVendorId === session.vendorId;

  if (!isAwardedVendor && responseStatus === VendorResponseStatus.DECLINED && !body) {
    redirect(`/vendor/requests/${requestId}?error=Add%20a%20note%20when%20declining%20a%20tender.`);
  }

  if (pricingType === VendorPricingType.NONE && vendorPriceCents !== null) {
    redirect(`/vendor/requests/${requestId}?error=Clear%20the%20price%20or%20choose%20a%20pricing%20type.`);
  }
  if (pricingType !== VendorPricingType.NONE && vendorPriceCents === null) {
    redirect(`/vendor/requests/${requestId}?error=Enter%20a%20price%20for%20the%20selected%20pricing%20type.`);
  }

  const bidAttachments = await persistVendorBidPdfs(request.id, bidFiles);
  const actorName = request.assignedVendor?.name || session.displayName;

  if (!isAwardedVendor) {
    if (!tender) redirect(`/vendor/requests/${requestId}?error=No%20active%20tender%20found.`);
    const nextTenderStatus = responseStatus === VendorResponseStatus.DECLINED ? RequestTenderStatus.DECLINED : (pricingType !== VendorPricingType.NONE || vendorPriceCents != null || body ? RequestTenderStatus.SUBMITTED : RequestTenderStatus.REQUESTED);
    if (!body && vendorPriceCents == null && bidAttachments.length === 0 && responseStatus === VendorResponseStatus.PENDING) {
      redirect(`/vendor/requests/${requestId}?error=Add%20a%20note,%20price,%20or%20PDF%20before%20saving.`);
    }

    await prisma.$transaction([
      prisma.requestTender.update({
        where: { id: tender.id },
        data: {
          status: nextTenderStatus,
          vendorNote: body || tender.vendorNote,
          pricingType,
          priceCents: vendorPriceCents,
          plannedStartDate,
          expectedCompletionDate,
          respondedAt: new Date(),
        },
      }),
      prisma.maintenanceRequest.update({
        where: { id: request.id },
        data: {
          vendorOfferStatus: nextTenderStatus === RequestTenderStatus.SUBMITTED ? VendorOfferStatus.PENDING_REVIEW : request.vendorOfferStatus,
          attachments: bidAttachments.length > 0 ? { create: bidAttachments } : undefined,
          events: {
            create: {
              type: RequestEventType.TENANT_UPDATE,
              actorRole: UserRole.VENDOR,
              actorName,
              body: nextTenderStatus === RequestTenderStatus.DECLINED
                ? `Vendor declined tender. ${body}`
                : `Vendor submitted tender${vendorPriceCents != null ? ` for $${(vendorPriceCents / 100).toFixed(2)}` : ''}.${body ? ` ${body}` : ''}`,
              visibility: EventVisibility.VENDOR,
            },
          },
        },
      }),
    ]);
  } else {
    if (!vendorAllowedStatuses.has(nextStatus as RequestStatus)) {
      redirect(`/vendor/requests/${requestId}?error=Choose%20a%20valid%20vendor%20status.`);
    }
    const status = nextStatus as RequestStatus;
    if (!canTransition(request.status, status) && request.status !== status) {
      redirect(`/vendor/requests/${requestId}?error=That%20status%20transition%20is%20not%20allowed.`);
    }
    if (request.paymentStatus === PaymentStatus.PAID_IN_FULL) {
      if (vendorFinalBillCents != null || vendorFinalTaxCents != null) {
        redirect(`/vendor/requests/${requestId}?error=This%20ticket%20is%20already%20marked%20paid%20in%20full.%20Only%20additional%20costs%20may%20be%20submitted.`);
      }
    } else if (status === RequestStatus.DONE && vendorFinalBillCents == null) {
      redirect(`/vendor/requests/${requestId}?error=Enter%20the%20final%20bill%20before%20marking%20the%20job%20complete.`);
    }

    await prisma.maintenanceRequest.update({
      where: { id: request.id },
      data: {
        status,
        closedAt: status === RequestStatus.DONE ? new Date() : null,
        vendorResponseStatus: responseStatus,
        vendorPlannedStartDate: plannedStartDate,
        vendorExpectedCompletionDate: expectedCompletionDate,
        vendorPricingType: pricingType,
        vendorPriceCents,
        vendorFinalBillCents,
        vendorFinalTaxCents,
        vendorAdditionalCostsCents,
        vendorAdditionalTaxCents,
        attachments: bidAttachments.length > 0 ? { create: bidAttachments } : undefined,
        events: {
          create: {
            type: RequestEventType.TENANT_UPDATE,
            actorRole: UserRole.VENDOR,
            actorName,
            body: body || 'Vendor updated dispatched work details.',
            visibility: shareWithTenant ? EventVisibility.ALL : EventVisibility.VENDOR,
          },
        },
      },
    });
  }

  revalidatePath('/vendor/queue');
  revalidatePath(`/vendor/requests/${requestId}`);
  revalidatePath('/operator');
  revalidatePath('/operator/requests');
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath(`/tenant/request/${requestId}`);
  redirect(`/vendor/requests/${requestId}?saved=1`);
}
