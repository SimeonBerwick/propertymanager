import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createVendorSession } from '@/lib/vendor-session'
import { verifyVendorOtpChallenge } from '@/lib/vendor-otp-lib'
import { writeAuditLog } from '@/lib/audit-log'

export default async function VendorMagicLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ challengeId?: string; code?: string; next?: string }>
}) {
  const { challengeId = '', code = '', next } = await searchParams
  const result = await verifyVendorOtpChallenge(challengeId, code)
  if (!result.ok) redirect('/vendor/auth/login?error=magic-link' as never)

  await createVendorSession(result.vendorId)
  const vendor = await prisma.vendor.findUnique({ where: { id: result.vendorId }, select: { orgId: true } })
  await writeAuditLog({
    orgId: vendor?.orgId ?? null,
    actorUserId: null,
    entityType: 'vendor',
    entityId: result.vendorId,
    action: 'vendor.magicLoginCompleted',
    summary: 'Completed vendor sign-in through a secure one-tap link.',
    metadata: { challengeId },
  })
  redirect((next?.startsWith('/vendor') ? next : '/vendor') as never)
}
