import { VendorOfferStatus } from '@prisma/client';

export function getVendorOfferStatusLabel(status: VendorOfferStatus) {
  switch (status) {
    case VendorOfferStatus.NONE:
      return 'No offer submitted';
    case VendorOfferStatus.PENDING_REVIEW:
      return 'Pending review';
    case VendorOfferStatus.REVISION_REQUESTED:
      return 'Revision requested';
    case VendorOfferStatus.ACCEPTED:
      return 'Accepted';
    case VendorOfferStatus.REJECTED:
      return 'Rejected';
  }
}

export function isCommercialOfferSubmitted(input: {
  vendorPricingType: string;
  vendorPriceCents: number | null;
  vendorFinalBillCents?: number | null;
  vendorAdditionalCostsCents?: number | null;
}) {
  return input.vendorPricingType !== 'NONE'
    || input.vendorPriceCents != null
    || input.vendorFinalBillCents != null
    || input.vendorAdditionalCostsCents != null;
}
