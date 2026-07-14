import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { formatMoney } from '@/lib/billing-utils'
import { quickBooksApprovedLimit, quickBooksTransactionUrl } from '@/lib/quickbooks'
import { QuickBooksSyncButton } from '@/components/quickbooks-sync-button'

export async function QuickBooksSyncPanel({ requestId }: { requestId: string }) {
  const session = await getLandlordSession()
  if (!session) return null
  const [connection, request, records] = await Promise.all([
    prisma.quickBooksConnection.findUnique({ where: { userId: session.userId } }),
    prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: session.userId } }, include: { billingDocuments: { where: { status: { not: 'void' } }, orderBy: { createdAt: 'desc' } }, staffWorkLogs: { include: { staffMember: true } }, vendorCommercialItems: { orderBy: { submittedAt: 'desc' } } } }),
    prisma.quickBooksSyncRecord.findMany({ where: { userId: session.userId, requestId } }),
  ])
  if (!request) return null
  const staffLaborCents = request.staffWorkLogs.reduce((sum, log) => sum + Math.round(log.laborMinutes * log.staffMember.hourlyRateCents / 60), 0)
  const staffMaterialsCents = request.staffWorkLogs.reduce((sum, log) => sum + log.materialsCents, 0)
  const hasStaffCosts = staffLaborCents + staffMaterialsCents > 0
  if (!connection) return null
  if (!request.billingDocuments.length && !hasStaffCosts) return null
  const bySource = new Map(records.map((record) => [`${record.sourceType}:${record.sourceId}`, record]))
  const statusLabel = (status?: string) => status === 'synced' ? 'Synced successfully' : status === 'retry_scheduled' ? 'Retry scheduled' : status === 'needs_attention' ? 'Needs attention' : 'Ready to sync'

  return <section className="card stack" id="quickbooks">
    <div className="sectionHead"><div><div className="kicker">Accounting</div><h2 style={{ margin: '4px 0' }}>QuickBooks Online</h2><div className="muted">{connection.autoSyncEnabled ? 'Approved records sync automatically. Payment status comes back from QuickBooks.' : 'Send approved records once, then refresh payment balances from QuickBooks.'}</div></div><Link href="/account/quickbooks" className="button">Settings</Link></div>
    {connection.status !== 'connected' ? <div className="notice error">QuickBooks needs to be reconnected before syncing.</div> : null}
    <div className="stack" style={{ gap: 12 }}>
      {request.billingDocuments.map((document) => {
        const record = bySource.get(`billing_document:${document.id}`)
        const approvedLimit = quickBooksApprovedLimit({ recipientType: document.recipientType, tenantBillbackDecision: request.tenantBillbackDecision, tenantBillbackAmountCents: request.tenantBillbackAmountCents, personalWorkBilledAt: request.personalWorkBilledAt, documentTotalCents: document.totalCents, vendorCommercialItems: request.vendorCommercialItems })
        const financiallyApproved = approvedLimit > 0 && document.totalCents <= approvedLimit
        return <div className="billingRowCard" key={document.id}>
          <div className="billingRow"><div><strong>{document.title}</strong><div className="muted">{document.recipientType === 'vendor' ? 'QuickBooks bill' : 'QuickBooks customer invoice'} - {formatMoney(document.totalCents, document.currency)}</div></div><span className={`badge ${record?.status === 'synced' ? 'billing-paid' : record?.status === 'needs_attention' || record?.status === 'retry_scheduled' ? 'billing-partial' : ''}`}>{financiallyApproved ? statusLabel(record?.status) : 'Waiting for financial approval'}</span></div>
          {record?.errorMessage ? <div className="notice error">{record.errorMessage}</div> : null}
          <div className="billingActionsRow">{connection.status === 'connected' && financiallyApproved ? <QuickBooksSyncButton requestId={requestId} sourceType="billing_document" sourceId={document.id} previouslySynced={Boolean(record?.entityId)} /> : null}{record?.entityType && record.entityId ? <a className="button" href={quickBooksTransactionUrl(connection.environment, record.entityType, record.entityId)} target="_blank" rel="noreferrer">Open in QuickBooks</a> : null}</div>
        </div>
      })}
      {hasStaffCosts ? (() => { const record = bySource.get(`staff_cost:${requestId}`); return <div className="billingRowCard">
        <div className="billingRow"><div><strong>Approved in-house staff costs</strong><div className="muted">Labor {formatMoney(staffLaborCents, request.preferredCurrency)} - materials {formatMoney(staffMaterialsCents, request.preferredCurrency)}</div></div><span className={`badge ${record?.status === 'synced' ? 'billing-paid' : record?.status === 'needs_attention' ? 'billing-partial' : ''}`}>{request.status === 'closed' ? statusLabel(record?.status) : 'Available after closeout'}</span></div>
        {record?.errorMessage ? <div className="notice error">{record.errorMessage}</div> : null}
        <div className="billingActionsRow">{connection?.status === 'connected' && request.status === 'closed' ? <QuickBooksSyncButton requestId={requestId} sourceType="staff_cost" sourceId={requestId} previouslySynced={Boolean(record?.entityId)} /> : null}{connection && record?.entityType && record.entityId ? <a className="button" href={quickBooksTransactionUrl(connection.environment, record.entityType, record.entityId)} target="_blank" rel="noreferrer">Open in QuickBooks</a> : null}</div>
      </div> })() : null}
    </div>
  </section>
}
