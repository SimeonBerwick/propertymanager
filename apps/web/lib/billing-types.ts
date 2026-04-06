export type BillingRecipientType = 'tenant' | 'vendor'
export type BillingDocumentType = 'tenant_invoice' | 'vendor_remittance'
export type BillingDocumentStatus = 'draft' | 'sent' | 'partial' | 'paid'

export interface BillingDocumentView {
  id: string
  requestId: string
  recipientType: BillingRecipientType
  documentType: BillingDocumentType
  status: BillingDocumentStatus
  currency: 'usd' | 'peso' | 'pound' | 'euro'
  totalCents: number
  paidCents: number
  title: string
  description?: string
  pdfUrl?: string
  sentTo?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
}
