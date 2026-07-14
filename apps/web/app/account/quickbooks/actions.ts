'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getQuickBooksSetupOptions, reconcileQuickBooksConnection, syncBillingDocumentToQuickBooks, syncStaffCostsToQuickBooks } from '@/lib/quickbooks'
import { writeAuditLog } from '@/lib/audit-log'

export type QuickBooksActionState = { error: string | null; success?: string }

function namedOption(id: string, options: { id: string; name: string }[]) {
  const match = options.find((option) => option.id === id)
  if (!match) throw new Error('Choose an available QuickBooks account or item.')
  return match
}

export async function saveQuickBooksSettingsAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const referenceMode = String(formData.get('referenceMode') ?? '')
  if (!['customer', 'class', 'location'].includes(referenceMode)) redirect('/account/quickbooks?error=invalid')
  try {
    const { accounts, items } = await getQuickBooksSetupOptions(session.userId)
    const vendor = namedOption(String(formData.get('vendorExpenseAccountId') ?? ''), accounts)
    const tenant = namedOption(String(formData.get('tenantIncomeItemId') ?? ''), items)
    const labor = namedOption(String(formData.get('staffLaborExpenseAccountId') ?? ''), accounts)
    const materials = namedOption(String(formData.get('staffMaterialExpenseAccountId') ?? ''), accounts)
    const offset = namedOption(String(formData.get('staffOffsetAccountId') ?? ''), accounts)
    const autoSyncEnabled = formData.get('autoSyncEnabled') === 'on'
    await prisma.quickBooksConnection.update({ where: { userId: session.userId }, data: {
      referenceMode,
      vendorExpenseAccountId: vendor.id, vendorExpenseAccountName: vendor.name,
      tenantIncomeItemId: tenant.id, tenantIncomeItemName: tenant.name,
      staffLaborExpenseAccountId: labor.id, staffLaborExpenseAccountName: labor.name,
      staffMaterialExpenseAccountId: materials.id, staffMaterialExpenseAccountName: materials.name,
      staffOffsetAccountId: offset.id, staffOffsetAccountName: offset.name,
      autoSyncEnabled,
      lastError: null,
    } })
    await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'quickbooks_connection', entityId: session.userId, action: 'quickbooks.settingsUpdated', summary: 'Updated QuickBooks accounting mappings and automation preference.', metadata: { referenceMode, autoSyncEnabled } })
  } catch { redirect('/account/quickbooks?error=save') }
  redirect('/account/quickbooks?saved=true')
}

export async function disconnectQuickBooksAction() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await prisma.quickBooksConnection.deleteMany({ where: { userId: session.userId } })
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'quickbooks_connection', entityId: session.userId, action: 'quickbooks.disconnected', summary: 'Disconnected QuickBooks Online.' })
  redirect('/account/quickbooks?disconnected=true')
}

export async function syncQuickBooksAction(_state: QuickBooksActionState, formData: FormData): Promise<QuickBooksActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Your session expired. Sign in again.' }
  const requestId = String(formData.get('requestId') ?? '')
  const sourceType = String(formData.get('sourceType') ?? '')
  const sourceId = String(formData.get('sourceId') ?? '')
  if (!requestId || !sourceId || !['billing_document', 'staff_cost'].includes(sourceType)) return { error: 'This QuickBooks record is invalid.' }
  try {
    if (sourceType === 'billing_document') await syncBillingDocumentToQuickBooks(session.userId, sourceId)
    else {
      if (sourceId !== requestId) return { error: 'This staff-cost record is invalid.' }
      await syncStaffCostsToQuickBooks(session.userId, requestId)
    }
    revalidatePath(`/requests/${requestId}`)
    return { error: null, success: sourceType === 'billing_document' ? 'QuickBooks transaction synchronized and payment status refreshed.' : 'Approved staff costs synchronized.' }
  } catch (error) {
    revalidatePath(`/requests/${requestId}`)
    return { error: error instanceof Error ? error.message : 'QuickBooks could not synchronize this record.' }
  }
}

export async function retryQuickBooksRecordAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const recordId = String(formData.get('recordId') ?? '')
  const record = await prisma.quickBooksSyncRecord.findFirst({ where: { id: recordId, userId: session.userId } })
  if (!record) redirect('/account/quickbooks?error=record')
  let succeeded = true
  try {
    if (record.sourceType === 'billing_document') await syncBillingDocumentToQuickBooks(session.userId, record.sourceId)
    else if (record.sourceType === 'staff_cost' && record.sourceId === record.requestId) await syncStaffCostsToQuickBooks(session.userId, record.requestId)
    else succeeded = false
  } catch { succeeded = false }
  revalidatePath(`/requests/${record.requestId}`)
  revalidatePath('/account/quickbooks')
  redirect(`/account/quickbooks?${succeeded ? 'retried=true' : 'error=retry'}`)
}

export async function reconcileQuickBooksAction() {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const result = await reconcileQuickBooksConnection(session.userId, { force: true })
  revalidatePath('/account/quickbooks')
  redirect(`/account/quickbooks?${result.errors.length ? 'error=reconcile' : 'reconciled=true'}`)
}
