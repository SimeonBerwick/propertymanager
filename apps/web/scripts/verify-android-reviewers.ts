import { prisma } from '../lib/prisma'
import { verifyPassword } from '../lib/password'
import { REVIEWER_EMAILS, getReviewerOtpCode } from '../lib/reviewer-access'

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
  if (process.env.ANDROID_REVIEWER_ACCESS_ENABLED !== 'true') {
    throw new Error('Set ANDROID_REVIEWER_ACCESS_ENABLED=true while verifying the isolated reviewer accounts.')
  }
  const password = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD?.trim()
  if (!password) throw new Error('Set ANDROID_REVIEWER_LANDLORD_PASSWORD before verifying reviewer access.')

  const [landlord, tenant, vendor, staff, requestCount] = await Promise.all([
    prisma.user.findUnique({ where: { email: REVIEWER_EMAILS.landlord } }),
    prisma.tenantIdentity.findFirst({ where: { email: REVIEWER_EMAILS.tenant } }),
    prisma.vendor.findFirst({ where: { email: REVIEWER_EMAILS.vendor } }),
    prisma.staffMember.findFirst({ where: { email: REVIEWER_EMAILS.staff } }),
    prisma.maintenanceRequest.count({
      where: { id: { in: ['play-review-request-tenant', 'play-review-request-vendor', 'play-review-request-staff'] } },
    }),
  ])

  const checks = {
    landlordPassword: Boolean(landlord && verifyPassword(password, landlord.passwordHash)),
    landlordActiveWithoutExpiry: landlord?.subscriptionStatus === 'active' && !landlord.subscriptionEndsAt,
    tenantActiveWithoutLeaseEnd: tenant?.status === 'active' && !tenant.leaseEndDate,
    vendorActive: vendor?.isActive === true,
    staffActive: staff?.isActive === true,
    sampleRequests: requestCount === 3,
    tenantReviewerCode: Boolean(getReviewerOtpCode('tenant', REVIEWER_EMAILS.tenant)),
    vendorReviewerCode: Boolean(getReviewerOtpCode('vendor', REVIEWER_EMAILS.vendor)),
    staffReviewerCode: Boolean(getReviewerOtpCode('staff', REVIEWER_EMAILS.staff)),
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
