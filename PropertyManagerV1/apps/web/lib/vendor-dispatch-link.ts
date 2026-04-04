import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'

const DISPATCH_LINK_TTL_DAYS = 7

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function createVendorDispatchLink(requestId: string, vendorId: string) {
  const rawToken = randomBytes(24).toString('hex')
  const tokenHash = sha256(rawToken)

  const link = await prisma.$transaction(async (tx) => {
    await tx.vendorDispatchLink.updateMany({
      where: { requestId, vendorId, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    })

    return tx.vendorDispatchLink.create({
      data: {
        requestId,
        vendorId,
        tokenHash,
        expiresAt: addDays(new Date(), DISPATCH_LINK_TTL_DAYS),
      },
    })
  })

  return {
    dispatchLinkId: link.id,
    rawToken,
    expiresAt: link.expiresAt,
  }
}

export async function validateVendorDispatchToken(rawToken: string) {
  if (!rawToken) return { ok: false as const, code: 'invalid' as const }

  const link = await prisma.vendorDispatchLink.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: {
      vendor: true,
      request: {
        include: {
          property: true,
          unit: true,
        },
      },
    },
  })

  if (!link) return { ok: false as const, code: 'invalid' as const }
  if (link.revokedAt) return { ok: false as const, code: 'revoked' as const }
  if (link.expiresAt <= new Date()) return { ok: false as const, code: 'expired' as const }

  return {
    ok: true as const,
    linkId: link.id,
    vendorId: link.vendorId,
    vendorName: link.vendor.name,
    requestId: link.requestId,
    requestTitle: link.request.title,
    propertyName: link.request.property.name,
    unitLabel: link.request.unit.label,
  }
}

export async function markVendorDispatchLinkUsed(linkId: string) {
  await prisma.vendorDispatchLink.update({
    where: { id: linkId },
    data: { lastUsedAt: new Date() },
  })
}
