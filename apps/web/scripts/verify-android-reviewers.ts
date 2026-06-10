import { prisma } from '../lib/prisma'
import { verifyPassword } from '../lib/password'
import { REVIEWER_EMAILS, getReviewerOtpCode } from '../lib/reviewer-access'

async function main() {
  const password = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD?.trim()
  if (!password) throw new Error('Set ANDROID_REVIEWER_LANDLORD_PASSWORD before verification.')

  const [landlord, tenant, vendor, requestCount] = await Promise.all([
    prisma.user.findUnique({ where: { email: REVIEWER_EMAILS.landlord } }),
    prisma.tenantIdentity.findFirst({ where: { email: REVIEWER_EMAILS.tenant } }),
    prisma.vendor.findFirst({ where: { email: REVIEWER_EMAILS.vendor } }),
    prisma.maintenanceRequest.count({
      where: { id: { in: ['play-review-request-tenant', 'play-review-request-vendor'] } },
    }),
  ])

  const checks = {
    landlordPassword: Boolean(landlord && verifyPassword(password, landlord.passwordHash)),
    landlordActiveWithoutExpiry: landlord?.subscriptionStatus === 'active' && !landlord.subscriptionEndsAt,
    tenantActiveWithoutLeaseEnd: tenant?.status === 'active' && !tenant.leaseEndDate,
    vendorActive: vendor?.isActive === true,
    sampleRequests: requestCount === 2,
    tenantReviewerCode: Boolean(getReviewerOtpCode('tenant', REVIEWER_EMAILS.tenant)),
    vendorReviewerCode: Boolean(getReviewerOtpCode('vendor', REVIEWER_EMAILS.vendor)),
    normalUserHasNoReviewerCode: !getReviewerOtpCode('tenant', 'someone-else@example.com'),
  }

  console.log(checks)
  if (Object.values(checks).some((value) => !value)) {
    throw new Error('One or more Android reviewer checks failed.')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
