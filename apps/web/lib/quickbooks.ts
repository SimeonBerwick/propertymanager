import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { decryptMailboxSecret, encryptMailboxSecret } from '@/lib/mailbox-crypto'
import { getAppBaseUrl } from '@/lib/runtime-env'

type QboObject = Record<string, unknown>
type ReferenceMode = 'customer' | 'class' | 'location'
const MAX_AUTOMATIC_ATTEMPTS = 6
const RETRY_DELAYS_MS = [15 * 60_000, 60 * 60_000, 4 * 60 * 60_000, 12 * 60 * 60_000, 24 * 60 * 60_000]

class QuickBooksApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) {
    super(message)
    this.name = 'QuickBooksApiError'
  }
}

function env(name: string) { return process.env[name]?.trim() ?? '' }

export function quickBooksConfigured() {
  return Boolean(env('QUICKBOOKS_CLIENT_ID') && env('QUICKBOOKS_CLIENT_SECRET'))
}

export function verifyQuickBooksWebhookSignature(payload: string, signature: string | null) {
  const verifierToken = env('QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN')
  if (!verifierToken || !signature) return false
  const expected = createHmac('sha256', verifierToken).update(payload).digest()
  const actual = Buffer.from(signature, 'base64')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function quickBooksWebhookRealmIds(payload: unknown) {
  const ids: string[] = []
  if (Array.isArray(payload)) {
    for (const event of payload) {
      if (event && typeof event === 'object' && 'intuitaccountid' in event) ids.push(String(event.intuitaccountid ?? '').trim())
    }
  } else if (payload && typeof payload === 'object' && 'eventNotifications' in payload && Array.isArray(payload.eventNotifications)) {
    for (const event of payload.eventNotifications) {
      if (event && typeof event === 'object' && 'realmId' in event) ids.push(String(event.realmId ?? '').trim())
    }
  }
  return [...new Set(ids.filter(Boolean))]
}

export function quickBooksRequestId(recordId: string) {
  return `sw-${createHash('sha256').update(recordId).digest('hex').slice(0, 40)}`
}

export function quickBooksRetryAt(attemptCount: number, now = new Date()) {
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)]
  return new Date(now.getTime() + delay)
}

function environment() { return env('QUICKBOOKS_ENVIRONMENT') === 'sandbox' ? 'sandbox' : 'production' }
function apiBase(target = environment()) { return target === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com' }
function redirectUri() { return `${getAppBaseUrl('QuickBooks OAuth')}/api/quickbooks/callback` }

export function createQuickBooksState(userId: string, now = Date.now()) {
  const payload = `${userId}:${now}:${randomBytes(16).toString('base64url')}`
  const signature = createHmac('sha256', env('SESSION_SECRET')).update(payload).digest('base64url')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifyQuickBooksState(state: string, now = Date.now()) {
  try {
    const decodedBytes = Buffer.from(state, 'base64url')
    if (decodedBytes.toString('base64url') !== state) return null
    const [userId, issuedRaw, nonce, signature, ...extra] = decodedBytes.toString('utf8').split(':')
    if (!userId || !issuedRaw || !nonce || !signature || extra.length) return null
    const issuedAt = Number(issuedRaw)
    if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > 10 * 60_000) return null
    const payload = `${userId}:${issuedRaw}:${nonce}`
    const expected = createHmac('sha256', env('SESSION_SECRET')).update(payload).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    return { userId }
  } catch { return null }
}

export function quickBooksAuthorizationUrl(userId: string) {
  if (!quickBooksConfigured()) throw new Error('QuickBooks is not configured for this deployment.')
  const url = new URL('https://appcenter.intuit.com/connect/oauth2')
  url.searchParams.set('client_id', env('QUICKBOOKS_CLIENT_ID'))
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  url.searchParams.set('state', createQuickBooksState(userId))
  return url.toString()
}

async function tokenRequest(values: Record<string, string>) {
  const authorization = Buffer.from(`${env('QUICKBOOKS_CLIENT_ID')}:${env('QUICKBOOKS_CLIENT_SECRET')}`).toString('base64')
  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST', headers: { authorization: `Basic ${authorization}`, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values), cache: 'no-store',
  })
  const body = await response.json().catch(() => ({})) as QboObject
  if (!response.ok) throw new Error(String(body.error_description ?? body.error ?? 'QuickBooks authorization failed.'))
  return body as { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in?: number }
}

async function rawRequest(accessToken: string, realmId: string, targetEnvironment: string, path: string, init?: RequestInit) {
  let response: Response
  try {
    response = await fetch(`${apiBase(targetEnvironment)}/v3/company/${encodeURIComponent(realmId)}${path}${path.includes('?') ? '&' : '?'}minorversion=75`, {
      ...init, cache: 'no-store', headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json', 'content-type': 'application/json', ...init?.headers },
    })
  } catch (error) {
    throw new QuickBooksApiError(error instanceof Error ? error.message : 'QuickBooks could not be reached.', 0, true)
  }
  const body = await response.json().catch(() => ({})) as QboObject
  if (!response.ok) {
    const fault = body.Fault as QboObject | undefined
    const errors = fault?.Error as QboObject[] | undefined
    const message = String(errors?.[0]?.Detail ?? errors?.[0]?.Message ?? 'QuickBooks rejected the request.')
    throw new QuickBooksApiError(message, response.status, response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500)
  }
  return body
}

export async function connectQuickBooks(userId: string, realmId: string, code: string) {
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() })
  const targetEnvironment = environment()
  const companyBody = await rawRequest(tokens.access_token, realmId, targetEnvironment, `/companyinfo/${encodeURIComponent(realmId)}`)
  const company = companyBody.CompanyInfo as QboObject | undefined
  return prisma.quickBooksConnection.upsert({
    where: { userId },
    update: {
      realmId, companyName: String(company?.CompanyName ?? ''), environment: targetEnvironment, status: 'connected',
      accessTokenCipher: encryptMailboxSecret(tokens.access_token), refreshTokenCipher: encryptMailboxSecret(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      refreshTokenExpiresAt: tokens.x_refresh_token_expires_in ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000) : null,
      lastError: null, disconnectedAt: null, connectedAt: new Date(),
    },
    create: {
      userId, realmId, companyName: String(company?.CompanyName ?? ''), environment: targetEnvironment,
      accessTokenCipher: encryptMailboxSecret(tokens.access_token), refreshTokenCipher: encryptMailboxSecret(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      refreshTokenExpiresAt: tokens.x_refresh_token_expires_in ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000) : null,
    },
  })
}

async function accessToken(userId: string) {
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } })
  if (!connection || connection.status !== 'connected') throw new Error('Connect QuickBooks before syncing.')
  if (connection.accessTokenExpiresAt.getTime() > Date.now() + 120_000) return { connection, token: decryptMailboxSecret(connection.accessTokenCipher) }
  try {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decryptMailboxSecret(connection.refreshTokenCipher) })
    const updated = await prisma.quickBooksConnection.update({ where: { id: connection.id }, data: {
      accessTokenCipher: encryptMailboxSecret(tokens.access_token), refreshTokenCipher: encryptMailboxSecret(tokens.refresh_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      refreshTokenExpiresAt: tokens.x_refresh_token_expires_in ? new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000) : connection.refreshTokenExpiresAt,
      status: 'connected', lastError: null,
    } })
    return { connection: updated, token: tokens.access_token }
  } catch (error) {
    await prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { status: 'needs_reauth', lastError: 'QuickBooks access expired. Reconnect the company.' } })
    throw error
  }
}

async function qboRequest(userId: string, path: string, init?: RequestInit) {
  const { connection, token } = await accessToken(userId)
  return rawRequest(token, connection.realmId, connection.environment, path, init)
}

function quote(value: string) { return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") }
export async function quickBooksQuery(userId: string, query: string) {
  const body = await qboRequest(userId, `/query?query=${encodeURIComponent(query)}`)
  return (body.QueryResponse ?? {}) as QboObject
}

export async function getQuickBooksSetupOptions(userId: string) {
  const [accountResult, itemResult] = await Promise.all([
    quickBooksQuery(userId, 'select * from Account where Active = true maxresults 1000'),
    quickBooksQuery(userId, 'select * from Item where Active = true maxresults 1000'),
  ])
  const accounts = ((accountResult.Account ?? []) as QboObject[]).map((row) => ({ id: String(row.Id), name: String(row.FullyQualifiedName ?? row.Name), type: String(row.AccountType ?? '') }))
  const items = ((itemResult.Item ?? []) as QboObject[]).filter((row) => row.Type !== 'Category').map((row) => ({ id: String(row.Id), name: String(row.FullyQualifiedName ?? row.Name) }))
  return { accounts, items }
}

async function mappedEntity(userId: string, localType: string, localId: string, quickBooksType: string, displayName: string, payload: QboObject) {
  const mapped = await prisma.quickBooksEntityMapping.findUnique({ where: { userId_localType_localId_quickBooksType: { userId, localType, localId, quickBooksType } } })
  if (mapped) return mapped.quickBooksId
  const nameField = quickBooksType === 'Class' || quickBooksType === 'Department' ? 'Name' : 'DisplayName'
  const query = await quickBooksQuery(userId, `select * from ${quickBooksType} where ${nameField} = '${quote(displayName)}' maxresults 1`)
  const existing = ((query[quickBooksType] ?? []) as QboObject[])[0]
  const mappingRequestId = quickBooksRequestId(`mapping:${userId}:${localType}:${localId}:${quickBooksType}`)
  const entity = existing ?? ((await qboRequest(userId, `/${quickBooksType.toLowerCase()}?requestid=${encodeURIComponent(mappingRequestId)}`, { method: 'POST', body: JSON.stringify(payload) }))[quickBooksType] as QboObject)
  const quickBooksId = String(entity.Id)
  await prisma.quickBooksEntityMapping.create({ data: { userId, localType, localId, quickBooksType, quickBooksId, displayName } })
  return quickBooksId
}

async function propertyReference(userId: string, mode: ReferenceMode, property: { id: string; name: string }, unit: { id: string; label: string }) {
  if (mode === 'class') {
    const name = `${property.name} - ${unit.label}`.slice(0, 100)
    return { ClassRef: { value: await mappedEntity(userId, 'unit', unit.id, 'Class', name, { Name: name }) } }
  }
  if (mode === 'location') {
    const name = `${property.name} - ${unit.label}`.slice(0, 100)
    return { DepartmentRef: { value: await mappedEntity(userId, 'unit', unit.id, 'Department', name, { Name: name }) } }
  }
  const propertyId = await mappedEntity(userId, 'property', property.id, 'Customer', property.name, { DisplayName: property.name })
  const unitName = `${property.name}: ${unit.label}`.slice(0, 100)
  const unitId = await mappedEntity(userId, 'unit', unit.id, 'Customer', unitName, { DisplayName: unitName, ParentRef: { value: propertyId }, SubCustomer: true })
  return { CustomerRef: { value: unitId } }
}

export function quickBooksContentHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function dollars(cents: number) { return Math.round(cents) / 100 }
function docNumber(id: string) { return `SW-${id.slice(-10).toUpperCase()}` }

export function quickBooksApprovedLimit(input: {
  recipientType: 'tenant' | 'vendor'
  tenantBillbackDecision?: string | null
  tenantBillbackAmountCents?: number | null
  personalWorkBilledAt?: Date | string | null
  documentTotalCents?: number
  vendorCommercialItems?: { itemType: string; status: string; amountCents: number }[]
}) {
  if (input.recipientType === 'tenant') {
    if (input.tenantBillbackDecision === 'bill_tenant') return Math.max(input.tenantBillbackAmountCents ?? 0, 0)
    return input.personalWorkBilledAt ? Math.max(input.documentTotalCents ?? 0, 0) : 0
  }
  const approved = (input.vendorCommercialItems ?? []).filter((item) => item.status === 'approved' && item.itemType !== 'bid')
  const finalInvoice = approved.find((item) => item.itemType === 'bill_to_property_manager')
  return finalInvoice?.amountCents ?? approved.reduce((total, item) => total + item.amountCents, 0)
}

async function upsertAttempt(input: { userId: string; requestId: string; billingDocumentId?: string; sourceType: string; sourceId: string; contentHash: string }) {
  const previous = await prisma.quickBooksSyncRecord.findUnique({ where: { userId_sourceType_sourceId: { userId: input.userId, sourceType: input.sourceType, sourceId: input.sourceId } } })
  if (previous?.entityId && previous.contentHash !== input.contentHash) {
    await prisma.quickBooksSyncRecord.update({ where: { id: previous.id }, data: { status: 'needs_attention', errorMessage: 'The approved amount changed after it was sent. Review and adjust the existing QuickBooks transaction.', lastErrorAt: new Date(), nextRetryAt: null, lastAttemptAt: new Date(), attemptCount: { increment: 1 } } })
    throw new Error('This amount changed after syncing. Review the existing QuickBooks transaction before continuing.')
  }
  return prisma.quickBooksSyncRecord.upsert({
    where: { userId_sourceType_sourceId: { userId: input.userId, sourceType: input.sourceType, sourceId: input.sourceId } },
    update: { contentHash: input.contentHash, status: 'syncing', errorMessage: null, nextRetryAt: null, lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
    create: { ...input, status: 'syncing', lastAttemptAt: new Date(), attemptCount: 1 },
  })
}

function isRetryableQuickBooksError(error: unknown) {
  return error instanceof QuickBooksApiError ? error.retryable : error instanceof TypeError
}

async function markSyncFailure(record: { id: string; attemptCount: number }, error: unknown) {
  const message = error instanceof Error ? error.message : 'QuickBooks sync failed.'
  const retryable = isRetryableQuickBooksError(error) && record.attemptCount < MAX_AUTOMATIC_ATTEMPTS
  await prisma.quickBooksSyncRecord.update({
    where: { id: record.id },
    data: {
      status: retryable ? 'retry_scheduled' : 'needs_attention',
      errorMessage: message,
      lastErrorAt: new Date(),
      nextRetryAt: retryable ? quickBooksRetryAt(record.attemptCount) : null,
    },
  })
}

async function updatePaymentFromEntity(documentId: string, entity: QboObject) {
  const total = Number(entity.TotalAmt ?? 0)
  const balance = Number(entity.Balance ?? total)
  const paidCents = Math.max(0, Math.round((total - balance) * 100))
  const document = await prisma.billingDocument.findUniqueOrThrow({ where: { id: documentId } })
  const cappedPaid = Math.min(document.totalCents, paidCents)
  const status = cappedPaid >= document.totalCents ? 'paid' : cappedPaid > 0 ? 'partial' : document.status === 'paid' || document.status === 'partial' ? 'sent' : document.status
  const changed = cappedPaid !== document.paidCents || status !== document.status
  if (changed) {
    await prisma.$transaction([
      prisma.billingDocument.update({ where: { id: documentId }, data: { paidCents: cappedPaid, status } }),
      prisma.billingEvent.create({ data: { billingDocumentId: documentId, eventType: 'quickbooks_payment_refreshed', note: `QuickBooks confirmed ${cappedPaid >= document.totalCents ? 'payment in full' : cappedPaid > 0 ? 'a partial payment' : 'that no payment is recorded'}.` } }),
    ])
  }
  return { paidCents: cappedPaid, status, changed }
}

export async function syncBillingDocumentToQuickBooks(userId: string, billingDocumentId: string) {
  const document = await prisma.billingDocument.findFirst({ where: { id: billingDocumentId, status: { not: 'void' }, request: { property: { ownerId: userId } } }, include: { request: { include: { property: true, unit: true, assignedVendor: true, vendorCommercialItems: { orderBy: { submittedAt: 'desc' } } } } } })
  if (!document) throw new Error('That approved financial record is no longer available.')
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } })
  if (!connection || connection.status !== 'connected') throw new Error('Connect QuickBooks before syncing.')
  if (document.currency !== 'usd') throw new Error('The initial QuickBooks sync supports USD records only.')
  const approvedLimit = quickBooksApprovedLimit({ recipientType: document.recipientType, tenantBillbackDecision: document.request.tenantBillbackDecision, tenantBillbackAmountCents: document.request.tenantBillbackAmountCents, personalWorkBilledAt: document.request.personalWorkBilledAt, documentTotalCents: document.totalCents, vendorCommercialItems: document.request.vendorCommercialItems })
  if (approvedLimit <= 0 || document.totalCents > approvedLimit) throw new Error('Financial approval must cover this amount before it can be sent to QuickBooks.')
  const snapshot = { totalCents: document.totalCents, currency: document.currency, recipientType: document.recipientType, title: document.title, requestId: document.requestId }
  const contentHash = quickBooksContentHash(snapshot)
  const record = await upsertAttempt({ userId, requestId: document.requestId, billingDocumentId: document.id, sourceType: 'billing_document', sourceId: document.id, contentHash })
  try {
    if (record.entityId && record.entityType) {
      const body = await qboRequest(userId, `/${record.entityType.toLowerCase()}/${encodeURIComponent(record.entityId)}`)
      await updatePaymentFromEntity(document.id, body[record.entityType] as QboObject)
      await prisma.quickBooksSyncRecord.update({ where: { id: record.id }, data: { status: 'synced', errorMessage: null, attemptCount: 0, lastErrorAt: null, nextRetryAt: null, lastSyncedAt: new Date() } })
      return record
    }
    const reference = await propertyReference(userId, connection.referenceMode as ReferenceMode, document.request.property, document.request.unit)
    let entityType: 'Bill' | 'Invoice'; let payload: QboObject
    if (document.recipientType === 'vendor') {
      if (!connection.vendorExpenseAccountId) throw new Error('Choose a vendor expense account in QuickBooks settings.')
      const vendor = document.request.assignedVendor
      const vendorName = vendor?.name ?? document.request.assignedVendorName
      if (!vendorName) throw new Error('This record has no assigned vendor.')
      const vendorId = await mappedEntity(userId, 'vendor', vendor?.id ?? document.request.id, 'Vendor', vendorName, { DisplayName: vendorName, ...(vendor?.email ? { PrimaryEmailAddr: { Address: vendor.email } } : {}) })
      entityType = 'Bill'
      payload = { VendorRef: { value: vendorId }, DocNumber: docNumber(document.id), PrivateNote: `Simeonware work order: ${document.request.title}`, Line: [{ Amount: dollars(document.totalCents), Description: `${document.title} - ${document.request.property.name} - ${document.request.unit.label}`, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: connection.vendorExpenseAccountId }, ...(reference.ClassRef ? { ClassRef: reference.ClassRef } : {}), ...(reference.CustomerRef ? { CustomerRef: reference.CustomerRef } : {}) } }], ...(reference.DepartmentRef ? { DepartmentRef: reference.DepartmentRef } : {}) }
    } else {
      if (!connection.tenantIncomeItemId) throw new Error('Choose a tenant charge item in QuickBooks settings.')
      const tenantName = document.request.submittedByName || document.request.submittedByEmail
      if (!tenantName) throw new Error('This tenant charge has no tenant name or email.')
      const tenantId = await mappedEntity(userId, 'tenant', document.request.tenantIdentityId ?? document.request.id, 'Customer', tenantName, { DisplayName: tenantName, ...(reference.CustomerRef ? { ParentRef: reference.CustomerRef, SubCustomer: true } : {}), ...(document.request.submittedByEmail ? { PrimaryEmailAddr: { Address: document.request.submittedByEmail } } : {}) })
      entityType = 'Invoice'
      payload = { CustomerRef: { value: tenantId }, DocNumber: docNumber(document.id), PrivateNote: `Simeonware work order: ${document.request.title}`, Line: [{ Amount: dollars(document.totalCents), Description: `${document.title} - ${document.request.property.name} - ${document.request.unit.label}`, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { value: connection.tenantIncomeItemId }, ...(reference.ClassRef ? { ClassRef: reference.ClassRef } : {}) } }], ...(reference.DepartmentRef ? { DepartmentRef: reference.DepartmentRef } : {}) }
    }
    const body = await qboRequest(userId, `/${entityType.toLowerCase()}?requestid=${encodeURIComponent(quickBooksRequestId(record.id))}`, { method: 'POST', body: JSON.stringify(payload) })
    const entity = body[entityType] as QboObject
    await updatePaymentFromEntity(document.id, entity)
    return prisma.quickBooksSyncRecord.update({ where: { id: record.id }, data: { entityType, entityId: String(entity.Id), entityDocNumber: String(entity.DocNumber ?? docNumber(document.id)), status: 'synced', errorMessage: null, attemptCount: 0, lastErrorAt: null, nextRetryAt: null, lastSyncedAt: new Date() } })
  } catch (error) {
    await markSyncFailure(record, error)
    throw error
  }
}

export async function syncStaffCostsToQuickBooks(userId: string, requestId: string) {
  const request = await prisma.maintenanceRequest.findFirst({ where: { id: requestId, property: { ownerId: userId }, status: 'closed' }, include: { property: true, unit: true, staffWorkLogs: { include: { staffMember: true } } } })
  if (!request) throw new Error('Staff costs can be synced after the completed work order is approved and closed.')
  const laborCents = request.staffWorkLogs.reduce((sum, log) => sum + Math.round(log.laborMinutes * log.staffMember.hourlyRateCents / 60), 0)
  const materialsCents = request.staffWorkLogs.reduce((sum, log) => sum + log.materialsCents, 0)
  if (laborCents + materialsCents <= 0) throw new Error('There are no approved staff costs to sync.')
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } })
  if (!connection?.staffLaborExpenseAccountId || !connection.staffMaterialExpenseAccountId || !connection.staffOffsetAccountId) throw new Error('Choose all three staff cost accounts in QuickBooks settings.')
  const snapshot = { laborCents, materialsCents, requestId, logs: request.staffWorkLogs.map((log) => [log.id, log.laborMinutes, log.materialsCents]) }
  const record = await upsertAttempt({ userId, requestId, sourceType: 'staff_cost', sourceId: requestId, contentHash: quickBooksContentHash(snapshot) })
  if (record.entityId) return prisma.quickBooksSyncRecord.update({ where: { id: record.id }, data: { status: 'synced', errorMessage: null, attemptCount: 0, lastErrorAt: null, nextRetryAt: null, lastSyncedAt: new Date() } })
  try {
    const reference = await propertyReference(userId, connection.referenceMode as ReferenceMode, request.property, request.unit)
    const lineDetail = (accountId: string, postingType: 'Debit' | 'Credit') => ({ PostingType: postingType, AccountRef: { value: accountId }, ...(reference.ClassRef ? { ClassRef: reference.ClassRef } : {}) })
    const lines: QboObject[] = []
    if (laborCents) lines.push({ Amount: dollars(laborCents), Description: `Approved staff labor - ${request.title}`, DetailType: 'JournalEntryLineDetail', JournalEntryLineDetail: lineDetail(connection.staffLaborExpenseAccountId, 'Debit') })
    if (materialsCents) lines.push({ Amount: dollars(materialsCents), Description: `Approved staff materials - ${request.title}`, DetailType: 'JournalEntryLineDetail', JournalEntryLineDetail: lineDetail(connection.staffMaterialExpenseAccountId, 'Debit') })
    lines.push({ Amount: dollars(laborCents + materialsCents), Description: `Staff cost offset - ${request.title}`, DetailType: 'JournalEntryLineDetail', JournalEntryLineDetail: lineDetail(connection.staffOffsetAccountId, 'Credit') })
    const body = await qboRequest(userId, `/journalentry?requestid=${encodeURIComponent(quickBooksRequestId(record.id))}`, { method: 'POST', body: JSON.stringify({ DocNumber: docNumber(request.id), PrivateNote: `Simeonware staff costs: ${request.property.name} - ${request.unit.label}`, Line: lines, ...(reference.DepartmentRef ? { DepartmentRef: reference.DepartmentRef } : {}) }) })
    const entity = body.JournalEntry as QboObject
    return prisma.quickBooksSyncRecord.update({ where: { id: record.id }, data: { entityType: 'JournalEntry', entityId: String(entity.Id), entityDocNumber: String(entity.DocNumber ?? docNumber(request.id)), status: 'synced', errorMessage: null, attemptCount: 0, lastErrorAt: null, nextRetryAt: null, lastSyncedAt: new Date() } })
  } catch (error) {
    await markSyncFailure(record, error)
    throw error
  }
}

async function syncRecord(record: { userId: string; requestId: string; sourceType: string; sourceId: string }) {
  if (record.sourceType === 'billing_document') return syncBillingDocumentToQuickBooks(record.userId, record.sourceId)
  if (record.sourceType === 'staff_cost' && record.sourceId === record.requestId) return syncStaffCostsToQuickBooks(record.userId, record.requestId)
  throw new Error('This QuickBooks synchronization record has an unsupported source.')
}

export async function syncApprovedQuickBooksRecordsForRequest(userId: string, requestId: string) {
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } })
  if (!connection?.autoSyncEnabled || connection.status !== 'connected') return { attempted: 0, synchronized: 0, errors: [] as string[] }
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: requestId, property: { ownerId: userId } },
    include: {
      billingDocuments: { where: { status: { not: 'void' } } },
      vendorCommercialItems: true,
      staffWorkLogs: { include: { staffMember: true } },
    },
  })
  if (!request) return { attempted: 0, synchronized: 0, errors: ['Work order not found.'] }

  const jobs: Array<() => Promise<unknown>> = []
  for (const document of request.billingDocuments) {
    const approvedLimit = quickBooksApprovedLimit({
      recipientType: document.recipientType,
      tenantBillbackDecision: request.tenantBillbackDecision,
      tenantBillbackAmountCents: request.tenantBillbackAmountCents,
      personalWorkBilledAt: request.personalWorkBilledAt,
      documentTotalCents: document.totalCents,
      vendorCommercialItems: request.vendorCommercialItems,
    })
    if (approvedLimit > 0 && document.totalCents <= approvedLimit) jobs.push(() => syncBillingDocumentToQuickBooks(userId, document.id))
  }
  const staffCostCents = request.staffWorkLogs.reduce((sum, log) => sum + log.materialsCents + Math.round(log.laborMinutes * log.staffMember.hourlyRateCents / 60), 0)
  if (request.status === 'closed' && staffCostCents > 0) jobs.push(() => syncStaffCostsToQuickBooks(userId, requestId))

  const errors: string[] = []
  let synchronized = 0
  for (const job of jobs) {
    try { await job(); synchronized += 1 } catch (error) { errors.push(error instanceof Error ? error.message : 'QuickBooks sync failed.') }
  }
  return { attempted: jobs.length, synchronized, errors }
}

export async function reconcileQuickBooksConnection(userId: string, options: { force?: boolean; limit?: number } = {}) {
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } })
  if (!connection || connection.status !== 'connected') return { attempted: 0, synchronized: 0, errors: ['QuickBooks is not connected.'] }
  const records = await prisma.quickBooksSyncRecord.findMany({
    where: {
      userId,
      entityId: { not: null },
      billingDocumentId: { not: null },
      status: 'synced',
      ...(options.force ? {} : { lastSyncedAt: { lt: new Date(Date.now() - 60 * 60_000) } }),
    },
    orderBy: { lastSyncedAt: 'asc' },
    take: options.limit ?? 100,
  })
  const errors: string[] = []
  let synchronized = 0
  for (const record of records) {
    try { await syncRecord(record); synchronized += 1 } catch (error) { errors.push(error instanceof Error ? error.message : 'QuickBooks reconciliation failed.') }
  }
  await prisma.quickBooksConnection.update({ where: { id: connection.id }, data: { lastReconciledAt: new Date() } })
  return { attempted: records.length, synchronized, errors }
}

export async function runQuickBooksAutomation(now = new Date()) {
  const connections = await prisma.quickBooksConnection.findMany({ where: { status: 'connected' }, select: { id: true, userId: true, autoSyncEnabled: true } })
  let attempted = 0
  let synchronized = 0
  const errors: string[] = []

  for (const connection of connections) {
    const retries = await prisma.quickBooksSyncRecord.findMany({
      where: { userId: connection.userId, status: 'retry_scheduled', nextRetryAt: { lte: now } },
      orderBy: { nextRetryAt: 'asc' },
      take: 50,
    })
    for (const record of retries) {
      attempted += 1
      try { await syncRecord(record); synchronized += 1 } catch (error) { errors.push(error instanceof Error ? error.message : 'QuickBooks retry failed.') }
    }

    if (connection.autoSyncEnabled) {
      const candidates = await prisma.billingDocument.findMany({
        where: {
          status: { not: 'void' },
          request: { property: { ownerId: connection.userId } },
          quickBooksSyncRecords: { none: { userId: connection.userId } },
        },
        select: { requestId: true },
        distinct: ['requestId'],
        take: 100,
      })
      for (const candidate of candidates) {
        const result = await syncApprovedQuickBooksRecordsForRequest(connection.userId, candidate.requestId)
        attempted += result.attempted
        synchronized += result.synchronized
        errors.push(...result.errors)
      }
      const staffRequests = await prisma.maintenanceRequest.findMany({
        where: {
          status: 'closed',
          property: { ownerId: connection.userId },
          staffWorkLogs: { some: {} },
          quickBooksSyncRecords: { none: { userId: connection.userId, sourceType: 'staff_cost' } },
        },
        select: { id: true },
        take: 100,
      })
      for (const request of staffRequests) {
        const result = await syncApprovedQuickBooksRecordsForRequest(connection.userId, request.id)
        attempted += result.attempted
        synchronized += result.synchronized
        errors.push(...result.errors)
      }
    }

    const reconciliation = await reconcileQuickBooksConnection(connection.userId)
    attempted += reconciliation.attempted
    synchronized += reconciliation.synchronized
    errors.push(...reconciliation.errors)
  }
  return { ok: errors.length === 0, connections: connections.length, attempted, synchronized, ...(errors.length ? { errors } : {}) }
}

export function quickBooksTransactionUrl(environmentName: string, entityType: string, entityId: string) {
  const host = environmentName === 'sandbox' ? 'https://app.sandbox.qbo.intuit.com' : 'https://qbo.intuit.com'
  const page = entityType === 'Bill' ? 'bill' : entityType === 'Invoice' ? 'invoice' : 'journal'
  return `${host}/app/${page}?txnId=${encodeURIComponent(entityId)}`
}
