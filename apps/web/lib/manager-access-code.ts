import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import { isTenantIdentityActiveOn } from '@/lib/tenant-occupancy'
import { takeRateLimitHit } from '@/lib/rate-limit'

export type ManagerAccessCodeRole = 'tenant' | 'vendor'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const VERIFY_RATE_LIMIT = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function makeCode() {
  return String(randomInt(100000, 1000000))
}

function hashCode(code: string, salt: string) {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

function lookupCode(code: string) {
  const secret = process.env.MANAGER_ACCESS_CODE_SECRET
    ?? process.env.SESSION_SECRET
    ?? 'local-manager-access-code-secret'
  return createHmac('sha256', secret).update(code).digest('hex')
}

function normalizeCode(code: string) {
  return code.replace(/\D/g, '')
}

async function createUniqueCode(role: ManagerAccessCodeRole) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makeCode()
    const codeLookup = lookupCode(code)
    const existing = await prisma.managerAccessCode.findFirst({
      where: {
        role,
        codeLookup,
        redeemedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    })
    if (!existing) return { code, codeLookup }
  }
  throw new Error('Could not generate a unique sign-in code. Try again.')
}

export async function createTenantManagerAccessCode(input: {
  actorUserId: string
  tenantIdentityId: string
  validFrom: Date
  expiresAt: Date
}) {
  const tenantIdentity = await prisma.tenantIdentity.findUnique({
    where: { id: input.tenantIdentityId },
    include: { property: true, unit: true },
  })
  if (!tenantIdentity || tenantIdentity.orgId !== input.actorUserId) {
    throw new Error('Tenant identity not found.')
  }
  if (!isTenantIdentityActiveOn(tenantIdentity) || !tenantIdentity.property.isActive || !tenantIdentity.unit.isActive) {
    throw new Error('Tenant access is not active for this unit.')
  }
  if (!tenantIdentity.email) {
    throw new Error('Add a tenant email before creating an sign-in code.')
  }

  const { code, codeLookup } = await createUniqueCode('tenant')
  const salt = randomBytes(12).toString('hex')
  const accessCode = await prisma.$transaction(async (tx) => {
    await tx.managerAccessCode.updateMany({
      where: { tenantIdentityId: tenantIdentity.id, role: 'tenant', redeemedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return tx.managerAccessCode.create({
      data: {
        orgId: tenantIdentity.orgId,
        createdByUserId: input.actorUserId,
        role: 'tenant',
        tenantIdentityId: tenantIdentity.id,
        propertyId: tenantIdentity.propertyId,
        unitId: tenantIdentity.unitId,
        codeLookup,
        codeHash: hashCode(code, salt),
        codeSalt: salt,
        validFrom: input.validFrom,
        expiresAt: input.expiresAt,
        maxAttempts: MAX_ATTEMPTS,
      },
    })
  })

  await writeAuditLog({
    orgId: tenantIdentity.orgId,
    actorUserId: input.actorUserId,
    entityType: 'tenantIdentity',
    entityId: tenantIdentity.id,
    action: 'tenantIdentity.managerAccessCodeCreated',
    summary: `Created a one-time sign-in code for ${tenantIdentity.tenantName}.`,
    metadata: { accessCodeId: accessCode.id, unitId: tenantIdentity.unitId, validFrom: input.validFrom, expiresAt: input.expiresAt },
  })

  return { accessCodeId: accessCode.id, code, expiresAt: accessCode.expiresAt, email: tenantIdentity.email, name: tenantIdentity.tenantName }
}

export async function createVendorManagerAccessCode(input: {
  actorUserId: string
  vendorId: string
  requestId: string
  validFrom: Date
  expiresAt: Date
}) {
  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: input.requestId,
      property: { ownerId: input.actorUserId },
      OR: [
        { assignedVendorId: input.vendorId },
        { tenderInvites: { some: { vendorId: input.vendorId, status: { in: ['invited', 'viewed', 'bid_submitted', 'awarded'] } } } },
      ],
    },
    include: { property: true, unit: true, assignedVendor: true },
  })
  const vendor = await prisma.vendor.findFirst({ where: { id: input.vendorId, orgId: input.actorUserId, isActive: true } })
  if (!vendor || !request) throw new Error('Vendor or assigned request not found.')
  if (!vendor.email) throw new Error('Add a vendor email before creating an sign-in code.')

  const { code, codeLookup } = await createUniqueCode('vendor')
  const salt = randomBytes(12).toString('hex')
  const accessCode = await prisma.$transaction(async (tx) => {
    await tx.managerAccessCode.updateMany({
      where: { vendorId: vendor.id, requestId: request.id, role: 'vendor', redeemedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return tx.managerAccessCode.create({
      data: {
        orgId: input.actorUserId,
        createdByUserId: input.actorUserId,
        role: 'vendor',
        vendorId: vendor.id,
        propertyId: request.propertyId,
        unitId: request.unitId,
        requestId: request.id,
        codeLookup,
        codeHash: hashCode(code, salt),
        codeSalt: salt,
        validFrom: input.validFrom,
        expiresAt: input.expiresAt,
        maxAttempts: MAX_ATTEMPTS,
      },
    })
  })

  await writeAuditLog({
    orgId: input.actorUserId,
    actorUserId: input.actorUserId,
    entityType: 'vendor',
    entityId: vendor.id,
    action: 'vendor.managerAccessCodeCreated',
    summary: `Created a one-time sign-in code for ${vendor.name}, limited to ${request.title}.`,
    metadata: { accessCodeId: accessCode.id, requestId: request.id, validFrom: input.validFrom, expiresAt: input.expiresAt },
  })

  return { accessCodeId: accessCode.id, code, expiresAt: accessCode.expiresAt, email: vendor.email, name: vendor.name, requestId: request.id }
}

export type VerifyManagerAccessCodeResult =
  | { ok: true; accessCodeId: string; role: 'tenant'; tenantIdentityId: string; expiresAt: Date }
  | { ok: true; accessCodeId: string; role: 'vendor'; vendorId: string; requestId: string; expiresAt: Date }
  | { ok: false; code: 'invalid' | 'not_started' | 'expired' | 'locked' }

export async function verifyManagerAccessCode(role: ManagerAccessCodeRole, submittedCode: string): Promise<VerifyManagerAccessCodeResult> {
  const code = normalizeCode(submittedCode)
  if (!/^\d{6}$/.test(code)) return { ok: false, code: 'invalid' }

  const codeLookup = lookupCode(code)
  const rateLimit = await takeRateLimitHit(`manager-access-code:${role}:${codeLookup}`, VERIFY_RATE_LIMIT)
  if (!rateLimit.ok) return { ok: false, code: 'locked' }

  const matches = await prisma.managerAccessCode.findMany({
    where: { role, codeLookup, redeemedAt: null, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 2,
  })
  if (matches.length !== 1) return { ok: false, code: 'invalid' }

  const accessCode = matches[0]
  const now = new Date()
  if (accessCode.lockedUntil && accessCode.lockedUntil > now) return { ok: false, code: 'locked' }
  if (accessCode.validFrom > now) return { ok: false, code: 'not_started' }
  if (accessCode.expiresAt <= now) return { ok: false, code: 'expired' }

  if (hashCode(code, accessCode.codeSalt) !== accessCode.codeHash) {
    const attemptCount = accessCode.attemptCount + 1
    const lockedUntil = attemptCount >= accessCode.maxAttempts ? addMinutes(now, LOCKOUT_MINUTES) : null
    await prisma.managerAccessCode.update({ where: { id: accessCode.id }, data: { attemptCount, lockedUntil } })
    return { ok: false, code: lockedUntil ? 'locked' : 'invalid' }
  }

  const redeemed = await prisma.managerAccessCode.updateMany({
    where: { id: accessCode.id, redeemedAt: null, revokedAt: null },
    data: { redeemedAt: now },
  })
  if (redeemed.count !== 1) return { ok: false, code: 'invalid' }

  await writeAuditLog({
    orgId: accessCode.orgId,
    actorUserId: null,
    entityType: role === 'tenant' ? 'tenantIdentity' : 'vendor',
    entityId: role === 'tenant' ? accessCode.tenantIdentityId! : accessCode.vendorId!,
    action: `${role}.managerAccessCodeRedeemed`,
    summary: `Redeemed a manager-issued ${role} sign-in code.`,
    metadata: { accessCodeId: accessCode.id, requestId: accessCode.requestId, unitId: accessCode.unitId },
  })

  if (role === 'tenant' && accessCode.tenantIdentityId) {
    return { ok: true, accessCodeId: accessCode.id, role, tenantIdentityId: accessCode.tenantIdentityId, expiresAt: accessCode.expiresAt }
  }
  if (role === 'vendor' && accessCode.vendorId && accessCode.requestId) {
    return { ok: true, accessCodeId: accessCode.id, role, vendorId: accessCode.vendorId, requestId: accessCode.requestId, expiresAt: accessCode.expiresAt }
  }
  return { ok: false, code: 'invalid' }
}
