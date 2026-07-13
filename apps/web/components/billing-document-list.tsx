import Link from 'next/link'
import { billingDocumentTypeLabel, billingStatusLabel, formatMoney } from '@/lib/billing-utils'
import type { BillingDocumentView } from '@/lib/billing-types'
import { BillingStatusForm } from '@/components/billing-status-form'
import { BillingDocumentActions } from '@/components/billing-document-actions'
import { formatDateTime } from '@/lib/ui-utils'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'

export async function BillingDocumentList({ documents, requestId }: { documents: BillingDocumentView[]; requestId: string }) {
  if (!documents.length) {
    return <div className="muted">No tenant charges or vendor payment records have been created yet.</div>
  }

  const session = await getLandlordSession()
  const quickBooksConnected = session ? Boolean(await prisma.quickBooksConnection.count({ where: { userId: session.userId, status: 'connected' } })) : false

  return (
    <div className="stack" style={{ gap: 12 }}>
      {documents.map((doc) => {
        const balance = Math.max(doc.totalCents - doc.paidCents, 0)
        const isSettled = balance === 0 || doc.status === 'paid' || doc.status === 'void'
        return (
          <div key={doc.id} className="billingRowCard">
            <div className="billingRow">
              <div>
                <div style={{ fontWeight: 700 }}>{doc.title}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {billingDocumentTypeLabel(doc.documentType)} - {doc.recipientType} - {formatDateTime(doc.createdAt)}
                </div>
                {doc.sentTo ? <div className="muted">Sent to: {doc.sentTo}</div> : null}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{formatMoney(doc.totalCents, doc.currency)}</div>
                <div className="muted">Paid so far: {formatMoney(doc.paidCents, doc.currency)}</div>
                <div className="muted">{balance > 0 ? `Still owed: ${formatMoney(balance, doc.currency)}` : 'No balance due'}</div>
                <div className={`badge billing-${doc.status}`} style={{ marginTop: 8 }}>{billingStatusLabel(doc.status)}</div>
              </div>
            </div>
            <div className="billingActionsRow">
              <Link href={`/api/billing/${doc.id}`} className="button" target="_blank">Open document</Link>
              {!isSettled && !(quickBooksConnected && doc.recipientType === 'vendor') ? <BillingStatusForm document={doc} /> : null}
              {!isSettled && quickBooksConnected && doc.recipientType === 'vendor' ? <span className="muted">Payment status comes from QuickBooks.</span> : null}
              <BillingDocumentActions billingDocumentId={doc.id} requestId={requestId} status={doc.status} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
