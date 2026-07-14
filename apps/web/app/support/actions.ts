'use server'

import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getVendorSession } from '@/lib/vendor-session'
import { getStaffSession } from '@/lib/staff-auth'
import { takeRateLimitHit } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notify'

export type SupportState = { error: string | null; referenceId: string | null }

const CATEGORIES = new Set(['account_access', 'maintenance_workflow', 'billing', 'technical_problem', 'feedback'])

async function currentSupportPrincipal() {
  const manager = await getLandlordSession().catch(() => null)
  if (manager) {
    const user = await prisma.user.findUnique({ where: { id: manager.userId }, select: { id: true, email: true, displayName: true, businessName: true } })
    if (user) return { type: 'manager', id: user.id, orgId: user.id, email: user.email, name: user.displayName, organization: user.businessName }
  }
  const tenant = await getTenantMobileSession().catch(() => null)
  if (tenant) return { type: 'tenant', id: tenant.tenantIdentityId, orgId: tenant.orgId, email: tenant.email, name: tenant.tenantName, organization: tenant.propertyName }
  const vendor = await getVendorSession().catch(() => null)
  if (vendor) return { type: 'vendor', id: vendor.vendorId, orgId: vendor.orgId, email: vendor.email, name: vendor.vendorName, organization: null }
  const staff = await getStaffSession().catch(() => null)
  if (staff) return { type: 'staff', id: staff.staffMemberId, orgId: staff.orgId, email: staff.email, name: staff.staffName, organization: null }
  return null
}

export async function getRecentSupportRequests() {
  const principal = await currentSupportPrincipal()
  if (!principal) return []
  return prisma.supportRequest.findMany({
    where: { principalType: principal.type, principalId: principal.id },
    select: { referenceId: true, category: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
}

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function supportReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `SW-${date}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function submitSupportRequest(_state: SupportState, formData: FormData): Promise<SupportState> {
  const principal = await currentSupportPrincipal()
  const email = principal?.email?.trim().toLowerCase() || clean(formData.get('email'), 254).toLowerCase()
  const name = principal?.name || clean(formData.get('name'), 120) || null
  const organization = principal?.organization || clean(formData.get('organization'), 160) || null
  const category = clean(formData.get('category'), 40)
  const message = clean(formData.get('message'), 4000)
  const pagePath = clean(formData.get('pagePath'), 300) || null

  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter the email address where support should reply.', referenceId: null }
  if (!CATEGORIES.has(category)) return { error: 'Choose what you need help with.', referenceId: null }
  if (message.length < 20) return { error: 'Tell us a little more so support can investigate the problem.', referenceId: null }

  const rate = await takeRateLimitHit(`support:${principal?.id ?? email}`, { limit: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }).catch(async () => {
    const recentCount = await prisma.supportRequest.count({ where: { email, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } })
    return recentCount >= 5 ? { ok: false as const, retryAfterSeconds: 3600 } : { ok: true as const, remaining: 5 - recentCount }
  })
  if (!rate.ok) return { error: 'We already received several requests from you. Please wait before sending another.', referenceId: null }

  const referenceId = supportReference()
  await prisma.supportRequest.create({
    data: {
      referenceId,
      orgId: principal?.orgId ?? null,
      principalType: principal?.type ?? 'public',
      principalId: principal?.id ?? null,
      name,
      email,
      organization,
      category,
      message,
      pagePath,
    },
  })

  const destination = process.env.SUPPORT_EMAIL?.trim() || process.env.OPS_ALERT_EMAIL?.trim() || 'support@simeonware.com'
  await sendNotification({
    to: destination,
    subject: `[Support ${referenceId}] ${category.replaceAll('_', ' ')}`,
    text: [
      `Reference: ${referenceId}`,
      `Reply to: ${email}`,
      `Name: ${name ?? 'Not provided'}`,
      `Organization: ${organization ?? 'Not provided'}`,
      `Account type: ${principal?.type ?? 'Not signed in'}`,
      `Page: ${pagePath ?? 'Not provided'}`,
      '',
      message,
    ].join('\n'),
  }, { ownerUserId: principal?.orgId ?? undefined, bypassUserPreference: true })

  return { error: null, referenceId }
}
