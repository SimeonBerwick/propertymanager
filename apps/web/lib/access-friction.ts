import { prisma } from '@/lib/prisma'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { sendNotification } from '@/lib/notify'

type AccessRole = 'tenant' | 'vendor'
type AccessEventType = 'invite_opened' | 'code_sent' | 'verification_failed' | 'resend_requested' | 'portal_reached'

const ALERT_WINDOW_MINUTES = 30
const ALERT_THRESHOLD = 3
const ALERT_DEDUPE_MINUTES = 60

function eventName(role: AccessRole, type: AccessEventType | 'manager_alert_sent') {
  return `${role}_access.${type}`
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000)
}

function metadataContains(role: AccessRole, principalId: string) {
  return role === 'tenant'
    ? `"tenantIdentityId":"${principalId}"`
    : `"vendorId":"${principalId}"`
}

async function recordProductEvent(input: {
  orgId?: string | null
  role: AccessRole
  type: AccessEventType | 'manager_alert_sent'
  metadata: Record<string, unknown>
}) {
  await prisma.productEvent.create({
    data: {
      orgId: input.orgId ?? null,
      eventName: eventName(input.role, input.type),
      metadataJson: JSON.stringify(input.metadata),
    },
  })
}

async function getTenantAlertContext(tenantIdentityId: string) {
  const identity = await prisma.tenantIdentity.findUnique({
    where: { id: tenantIdentityId },
    include: {
      property: { include: { owner: { select: { id: true, email: true, emailNotificationsEnabled: true } } } },
      unit: { select: { label: true } },
    },
  })
  if (!identity?.property.owner.email) return null
  return {
    orgId: identity.orgId,
    ownerId: identity.property.owner.id,
    ownerEmail: identity.property.owner.email,
    label: `${identity.tenantName} at ${identity.property.name} / ${identity.unit.label}`,
    actionUrl: `${getAppBaseUrl('access friction manager alerts')}/units/${identity.unitId}/edit`,
  }
}

async function getVendorAlertContext(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, orgId: true, name: true, email: true } })
  if (!vendor?.orgId) return null
  const owner = await prisma.user.findUnique({ where: { id: vendor.orgId }, select: { id: true, email: true, emailNotificationsEnabled: true } })
  if (!owner?.email) return null
  return {
    orgId: vendor.orgId,
    ownerId: owner.id,
    ownerEmail: owner.email,
    label: `${vendor.name}${vendor.email ? ` <${vendor.email}>` : ''}`,
    actionUrl: `${getAppBaseUrl('access friction manager alerts')}/vendors/${vendor.id}`,
  }
}

async function maybeAlertManager(input: {
  orgId?: string | null
  role: AccessRole
  principalId: string
  trigger: AccessEventType
}) {
  const contains = metadataContains(input.role, input.principalId)
  const recentFrictionCount = await prisma.productEvent.count({
    where: {
      orgId: input.orgId ?? null,
      eventName: { in: [eventName(input.role, 'verification_failed'), eventName(input.role, 'resend_requested')] },
      createdAt: { gte: minutesAgo(ALERT_WINDOW_MINUTES) },
      metadataJson: { contains },
    },
  })

  if (recentFrictionCount < ALERT_THRESHOLD) return

  const recentAlert = await prisma.productEvent.findFirst({
    where: {
      orgId: input.orgId ?? null,
      eventName: eventName(input.role, 'manager_alert_sent'),
      createdAt: { gte: minutesAgo(ALERT_DEDUPE_MINUTES) },
      metadataJson: { contains },
    },
    select: { id: true },
  })
  if (recentAlert) return

  const context = input.role === 'tenant'
    ? await getTenantAlertContext(input.principalId)
    : await getVendorAlertContext(input.principalId)
  if (!context) return

  await sendNotification({
    to: context.ownerEmail,
    subject: input.role === 'tenant' ? 'Tenant is having trouble accessing the portal' : 'Vendor is having trouble accessing the portal',
    text: [
      `${context.label} has had ${recentFrictionCount} access problems in the last ${ALERT_WINDOW_MINUTES} minutes.`,
      '',
      `Latest issue: ${input.trigger.replaceAll('_', ' ')}`,
      '',
      `Open details: ${context.actionUrl}`,
    ].join('\n'),
    actionUrl: context.actionUrl,
  }, { ownerUserId: context.ownerId, transportHint: 'system' })

  await recordProductEvent({
    orgId: context.orgId,
    role: input.role,
    type: 'manager_alert_sent',
    metadata: {
      role: input.role,
      principalId: input.principalId,
      tenantIdentityId: input.role === 'tenant' ? input.principalId : undefined,
      vendorId: input.role === 'vendor' ? input.principalId : undefined,
      recentFrictionCount,
      trigger: input.trigger,
    },
  })
}

async function trackAccessEvent(input: {
  orgId?: string | null
  role: AccessRole
  principalId: string
  type: AccessEventType
  metadata?: Record<string, unknown>
}) {
  const metadata = {
    role: input.role,
    principalId: input.principalId,
    tenantIdentityId: input.role === 'tenant' ? input.principalId : undefined,
    vendorId: input.role === 'vendor' ? input.principalId : undefined,
    ...input.metadata,
  }

  await recordProductEvent({
    orgId: input.orgId,
    role: input.role,
    type: input.type,
    metadata,
  })

  if (input.type === 'verification_failed' || input.type === 'resend_requested') {
    await maybeAlertManager({
      orgId: input.orgId,
      role: input.role,
      principalId: input.principalId,
      trigger: input.type,
    })
  }
}

export async function trackTenantAccessEvent(input: {
  tenantIdentityId: string
  orgId?: string | null
  type: AccessEventType
  metadata?: Record<string, unknown>
}) {
  await trackAccessEvent({
    role: 'tenant',
    principalId: input.tenantIdentityId,
    orgId: input.orgId,
    type: input.type,
    metadata: input.metadata,
  }).catch((error) => {
    console.error('[ACCESS_FRICTION] Tenant tracking failed:', error)
  })
}

export async function trackVendorAccessEvent(input: {
  vendorId: string
  orgId?: string | null
  type: AccessEventType
  metadata?: Record<string, unknown>
}) {
  await trackAccessEvent({
    role: 'vendor',
    principalId: input.vendorId,
    orgId: input.orgId,
    type: input.type,
    metadata: input.metadata,
  }).catch((error) => {
    console.error('[ACCESS_FRICTION] Vendor tracking failed:', error)
  })
}
