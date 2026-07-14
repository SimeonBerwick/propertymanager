import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getQuickBooksSetupOptions, quickBooksConfigured } from '@/lib/quickbooks'
import { formatDateTime } from '@/lib/ui-utils'
import { disconnectQuickBooksAction, reconcileQuickBooksAction, retryQuickBooksRecordAction, saveQuickBooksSettingsAction } from './actions'

export default async function QuickBooksSettingsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const query = searchParams ? await searchParams : {}
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId: session.userId } })
  const attentionRecords = await prisma.quickBooksSyncRecord.findMany({
    where: { userId: session.userId, status: { in: ['needs_attention', 'retry_scheduled'] } },
    include: { request: { select: { title: true } }, billingDocument: { select: { title: true } } },
    orderBy: [{ lastErrorAt: 'desc' }, { updatedAt: 'desc' }],
  })
  let options: Awaited<ReturnType<typeof getQuickBooksSetupOptions>> | null = null
  let loadError = false
  if (connection?.status === 'connected') {
    try { options = await getQuickBooksSetupOptions(session.userId) } catch { loadError = true }
  }
  const expenseAccounts = options?.accounts.filter((account) => ['Expense', 'Other Expense', 'Cost of Goods Sold'].includes(account.type)) ?? []
  const offsetAccounts = options?.accounts.filter((account) => ['Other Current Liability', 'Current Liability', 'Accounts Payable', 'Bank', 'Other Current Asset'].includes(account.type)) ?? []

  return <main className="stack">
    <section className="card stack">
      <div><div className="kicker">Accounting integration</div><h2 className="sectionTitle">QuickBooks Online</h2></div>
      <p className="muted" style={{ margin: 0 }}>Send approved maintenance costs to QuickBooks and bring payment balances back without re-entering transactions.</p>
      <Link href="/account/settings" className="button" style={{ alignSelf: 'flex-start' }}>Back to settings</Link>
    </section>

    {!quickBooksConfigured() ? <div className="notice error">QuickBooks credentials have not been added to this deployment.</div> : null}
    {query.connected === 'true' ? <div className="notice success">QuickBooks connected. Finish the account mappings below before syncing.</div> : null}
    {query.saved === 'true' ? <div className="notice success">QuickBooks mappings saved.</div> : null}
    {query.retried === 'true' ? <div className="notice success">The QuickBooks record synchronized successfully.</div> : null}
    {query.reconciled === 'true' ? <div className="notice success">QuickBooks payment statuses are up to date.</div> : null}
    {query.disconnected === 'true' ? <div className="notice success">QuickBooks disconnected.</div> : null}
    {query.error ? <div className="notice error">QuickBooks could not complete that request. Reconnect and try again.</div> : null}

    {!connection ? <section className="card stack">
      <div><div className="kicker">Company connection</div><h3 style={{ margin: '4px 0 0' }}>Connect your company</h3></div>
      <p className="muted" style={{ margin: 0 }}>You will sign in to Intuit and choose the QuickBooks Online company that should receive approved maintenance records.</p>
      {quickBooksConfigured() ? <a href="/api/quickbooks/connect" className="button primary" style={{ alignSelf: 'flex-start' }}>Connect QuickBooks</a> : null}
    </section> : <>
      <section className="card stack">
        <div><div className="kicker">Connected company</div><h3 style={{ margin: '4px 0 0' }}>{connection.companyName || 'QuickBooks company'}</h3></div>
        <div className={`badge ${connection.status === 'connected' ? 'billing-paid' : 'billing-partial'}`} style={{ alignSelf: 'flex-start' }}>{connection.status === 'connected' ? 'Connected' : 'Reconnect required'}</div>
        {connection.lastError ? <div className="notice error">{connection.lastError}</div> : null}
        <div className="muted">{connection.lastReconciledAt ? `Last reconciled ${formatDateTime(connection.lastReconciledAt)}.` : 'Payment reconciliation has not run yet.'}{connection.lastWebhookAt ? ` Last QuickBooks update received ${formatDateTime(connection.lastWebhookAt)}.` : ''}</div>
        <div className="row" style={{ justifyContent: 'flex-start' }}><form action={reconcileQuickBooksAction}><button className="button primary" type="submit">Reconcile now</button></form><a href="/api/quickbooks/connect" className="button">Reconnect</a><form action={disconnectQuickBooksAction}><button className="button" type="submit">Disconnect</button></form></div>
      </section>

      <section className="card stack">
        <div><div className="kicker">Integration health</div><h3 style={{ margin: '4px 0 0' }}>QuickBooks attention queue</h3></div>
        {attentionRecords.length ? attentionRecords.map((record) => <div className="billingRowCard" key={record.id}>
          <div className="billingRow"><div><strong>{record.billingDocument?.title || record.request.title}</strong><div className="muted">{record.sourceType === 'staff_cost' ? 'In-house staff costs' : 'Financial record'} - attempt {record.attemptCount}</div></div><span className="badge billing-partial">{record.status === 'retry_scheduled' ? 'Retry scheduled' : 'Needs attention'}</span></div>
          {record.errorMessage ? <div className="notice error">{record.errorMessage}</div> : null}
          {record.nextRetryAt ? <div className="muted">Automatic retry after {formatDateTime(record.nextRetryAt)}.</div> : null}
          <div className="billingActionsRow"><form action={retryQuickBooksRecordAction}><input type="hidden" name="recordId" value={record.id}/><button className="button primary" type="submit">Retry now</button></form><Link className="button" href={`/requests/${record.requestId}#quickbooks`}>Open work order</Link></div>
        </div>) : <div className="notice success">No QuickBooks synchronization problems need attention.</div>}
      </section>

      {loadError ? <div className="notice error">QuickBooks accounts and items could not be loaded. Reconnect the company and try again.</div> : options ? <form action={saveQuickBooksSettingsAction} className="card stack">
        <div><div className="kicker">Accounting mappings</div><h3 style={{ margin: '4px 0 0' }}>Choose where approved records belong</h3></div>
        <p className="muted" style={{ margin: 0 }}>These choices control accounting classification. Simeonware never chooses a chart-of-accounts destination silently.</p>
        <label className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><input type="checkbox" name="autoSyncEnabled" defaultChecked={connection.autoSyncEnabled}/><span><strong>Automatically sync after financial approval</strong><span className="muted" style={{ display: 'block' }}>Approved bills, tenant charges, and closed staff costs will be sent automatically. Payment is recorded only after QuickBooks confirms it.</span></span></label>
        <label className="field"><span className="field-label">Property and unit tracking</span><select className="input" name="referenceMode" defaultValue={connection.referenceMode} required><option value="customer">Customer / project hierarchy</option><option value="class">Class</option><option value="location">Location</option></select></label>
        <label className="field"><span className="field-label">Vendor bill expense account</span><select className="input" name="vendorExpenseAccountId" defaultValue={connection.vendorExpenseAccountId ?? ''} required><option value="">Choose account</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label className="field"><span className="field-label">Tenant charge product/service item</span><select className="input" name="tenantIncomeItemId" defaultValue={connection.tenantIncomeItemId ?? ''} required><option value="">Choose item</option>{options.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="grid cols-2">
          <label className="field"><span className="field-label">Staff labor expense account</span><select className="input" name="staffLaborExpenseAccountId" defaultValue={connection.staffLaborExpenseAccountId ?? ''} required><option value="">Choose account</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="field"><span className="field-label">Staff materials expense account</span><select className="input" name="staffMaterialExpenseAccountId" defaultValue={connection.staffMaterialExpenseAccountId ?? ''} required><option value="">Choose account</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        </div>
        <label className="field"><span className="field-label">Staff cost offset account</span><select className="input" name="staffOffsetAccountId" defaultValue={connection.staffOffsetAccountId ?? ''} required><option value="">Choose payroll liability or clearing account</option>{offsetAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><span className="muted">Ask your bookkeeper which payroll liability or clearing account should balance staff labor and materials.</span></label>
        <button className="button primary" type="submit" style={{ alignSelf: 'flex-start' }}>Save QuickBooks settings</button>
      </form> : null}
    </>}
  </main>
}
