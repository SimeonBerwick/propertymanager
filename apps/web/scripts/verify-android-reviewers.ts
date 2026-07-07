import { prisma } from '../lib/prisma'
import { verifyPassword } from '../lib/password'
import { REVIEWER_EMAILS, getReviewerOtpCode } from '../lib/reviewer-access'

const DEFAULT_REVIEWER_PASSWORD = 'play-review-password-2026'

function assertPostgresUrl() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
    throw new Error('DATABASE_URL must be the hosted Postgres connection string. It should start with postgresql:// or postgres://.')
  }

  try {
    const parsed = new URL(url)
    if (!parsed.hostname || (parsed.port && !/^\d+$/.test(parsed.port))) {
      throw new Error()
    }
  } catch {
    throw new Error('DATABASE_URL is not a valid Postgres URL. Use the exact connection string from your database provider; the port must be a number, usually 5432. If the password contains @, :, /, ?, #, or &, use the pooled/Prisma URL copied from the provider so those characters are escaped.')
  }
}

async function main() {
  assertPostgresUrl()
  const password = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD?.trim() || DEFAULT_REVIEWER_PASSWORD

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
