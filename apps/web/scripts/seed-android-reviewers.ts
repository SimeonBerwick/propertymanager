import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/password'
import { REVIEWER_EMAILS } from '../lib/reviewer-access'

const prisma = new PrismaClient()
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

const IDS = {
  property: 'play-review-property',
  unit: 'play-review-unit',
  tenant: 'play-review-tenant',
  vendor: 'play-review-vendor',
  tenantRequest: 'play-review-request-tenant',
  vendorRequest: 'play-review-request-vendor',
  vendorApprovedCost: 'play-review-vendor-approved-cost',
  staff: 'play-review-staff',
  staffRequest: 'play-review-request-staff',
} as const

async function main() {
  assertPostgresUrl()
  const password = process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD?.trim() || DEFAULT_REVIEWER_PASSWORD
  if (!password || password.length < 12) {
    throw new Error('Set ANDROID_REVIEWER_LANDLORD_PASSWORD to a stable password with at least 12 characters.')
  }

  const landlord = await prisma.user.upsert({
    where: { email: REVIEWER_EMAILS.landlord },
    update: {
      displayName: 'Play Review Property Manager',
      passwordHash: hashPassword(password),
      role: 'landlord',
      slug: 'play-review',
      subscriptionStatus: 'active',
      subscriptionPlan: 'pro',
      billingCadence: 'annual',
      trialEndsAt: null,
      subscriptionEndsAt: null,
      personalWorkEnabled: true,
      personalWorkHourlyRateCents: 6500,
    },
    create: {
      email: REVIEWER_EMAILS.landlord,
      displayName: 'Play Review Property Manager',
      passwordHash: hashPassword(password),
      role: 'landlord',
      slug: 'play-review',
      subscriptionStatus: 'active',
      subscriptionPlan: 'pro',
      billingCadence: 'annual',
      personalWorkEnabled: true,
      personalWorkHourlyRateCents: 6500,
    },
  })

  await prisma.property.upsert({
    where: { id: IDS.property },
    update: {
      ownerId: landlord.id,
      name: 'Play Review Apartments',
      address: '100 Review Way, Phoenix, AZ 85001',
      isActive: true,
      personalWorkAllowed: true,
    },
    create: {
      id: IDS.property,
      ownerId: landlord.id,
      name: 'Play Review Apartments',
      address: '100 Review Way, Phoenix, AZ 85001',
      personalWorkAllowed: true,
    },
  })

  await prisma.unit.upsert({
    where: { id: IDS.unit },
    update: {
      propertyId: IDS.property,
      label: 'Unit 101',
      tenantName: 'Play Review Tenant',
      tenantEmail: REVIEWER_EMAILS.tenant,
      isActive: true,
    },
    create: {
      id: IDS.unit,
      propertyId: IDS.property,
      label: 'Unit 101',
      tenantName: 'Play Review Tenant',
      tenantEmail: REVIEWER_EMAILS.tenant,
    },
  })

  await prisma.tenantIdentity.upsert({
    where: {
      orgId_phoneE164_unitId: {
        orgId: landlord.id,
        phoneE164: '+16025550101',
        unitId: IDS.unit,
      },
    },
    update: {
      propertyId: IDS.property,
      tenantName: 'Play Review Tenant',
      email: REVIEWER_EMAILS.tenant,
      leaseStartDate: new Date('2026-01-01T00:00:00Z'),
      leaseEndDate: null,
      status: 'active',
      verifiedAt: new Date(),
    },
    create: {
      id: IDS.tenant,
      orgId: landlord.id,
      propertyId: IDS.property,
      unitId: IDS.unit,
      tenantName: 'Play Review Tenant',
      phoneE164: '+16025550101',
      email: REVIEWER_EMAILS.tenant,
      leaseStartDate: new Date('2026-01-01T00:00:00Z'),
      status: 'active',
      verifiedAt: new Date(),
    },
  })

  await prisma.vendor.upsert({
    where: { id: IDS.vendor },
    update: {
      orgId: landlord.id,
      name: 'Play Review Maintenance',
      email: REVIEWER_EMAILS.vendor,
      phone: '+16025550102',
      categoriesCsv: 'plumbing,electrical,general',
      supportedLanguagesCsv: 'english',
      supportedCurrenciesCsv: 'usd',
      isActive: true,
    },
    create: {
      id: IDS.vendor,
      orgId: landlord.id,
      name: 'Play Review Maintenance',
      email: REVIEWER_EMAILS.vendor,
      phone: '+16025550102',
      categoriesCsv: 'plumbing,electrical,general',
      supportedLanguagesCsv: 'english',
      supportedCurrenciesCsv: 'usd',
      isActive: true,
    },
  })

  await prisma.maintenanceRequest.upsert({
    where: { id: IDS.tenantRequest },
    update: {
      propertyId: IDS.property,
      unitId: IDS.unit,
      orgId: landlord.id,
      tenantIdentityId: IDS.tenant,
      submittedByName: 'Play Review Tenant',
      submittedByEmail: REVIEWER_EMAILS.tenant,
      title: 'Kitchen faucet is leaking',
      description: 'Sample request for Google Play review. The faucet drips continuously.',
      category: 'plumbing',
      urgency: 'medium',
      status: 'requested',
    },
    create: {
      id: IDS.tenantRequest,
      propertyId: IDS.property,
      unitId: IDS.unit,
      orgId: landlord.id,
      tenantIdentityId: IDS.tenant,
      submittedByName: 'Play Review Tenant',
      submittedByEmail: REVIEWER_EMAILS.tenant,
      title: 'Kitchen faucet is leaking',
      description: 'Sample request for Google Play review. The faucet drips continuously.',
      category: 'plumbing',
      urgency: 'medium',
      status: 'requested',
    },
  })

  await prisma.maintenanceRequest.upsert({
    where: { id: IDS.vendorRequest },
    update: {
      propertyId: IDS.property,
      unitId: IDS.unit,
      orgId: landlord.id,
      tenantIdentityId: IDS.tenant,
      submittedByName: 'Play Review Tenant',
      submittedByEmail: REVIEWER_EMAILS.tenant,
      title: 'Replace hallway light fixture',
      description: 'Sample assigned request for Google Play vendor-portal review.',
      category: 'electrical',
      urgency: 'low',
      status: 'scheduled',
      assignedVendorId: IDS.vendor,
      assignedVendorName: 'Play Review Maintenance',
      assignedVendorEmail: REVIEWER_EMAILS.vendor,
      assignedVendorPhone: '+16025550102',
      dispatchStatus: 'scheduled',
      vendorScheduledStart: new Date('2030-01-15T16:00:00Z'),
      vendorScheduledEnd: new Date('2030-01-15T18:00:00Z'),
    },
    create: {
      id: IDS.vendorRequest,
      propertyId: IDS.property,
      unitId: IDS.unit,
      orgId: landlord.id,
      tenantIdentityId: IDS.tenant,
      submittedByName: 'Play Review Tenant',
      submittedByEmail: REVIEWER_EMAILS.tenant,
      title: 'Replace hallway light fixture',
      description: 'Sample assigned request for Google Play vendor-portal review.',
      category: 'electrical',
      urgency: 'low',
      status: 'scheduled',
      assignedVendorId: IDS.vendor,
      assignedVendorName: 'Play Review Maintenance',
      assignedVendorEmail: REVIEWER_EMAILS.vendor,
      assignedVendorPhone: '+16025550102',
      dispatchStatus: 'scheduled',
      vendorScheduledStart: new Date('2030-01-15T16:00:00Z'),
      vendorScheduledEnd: new Date('2030-01-15T18:00:00Z'),
    },
  })

  await prisma.vendorCommercialItem.upsert({
    where: { id: IDS.vendorApprovedCost },
    update: {
      requestId: IDS.vendorRequest,
      vendorId: IDS.vendor,
      orgId: landlord.id,
      itemType: 'service_fee',
      status: 'approved',
      paymentTiming: 'on_completion',
      currency: 'usd',
      amountCents: 12500,
      title: 'Approved service charge',
      description: 'Stable approved charge for Android WebView completion testing.',
    },
    create: {
      id: IDS.vendorApprovedCost,
      requestId: IDS.vendorRequest,
      vendorId: IDS.vendor,
      orgId: landlord.id,
      itemType: 'service_fee',
      status: 'approved',
      paymentTiming: 'on_completion',
      currency: 'usd',
      amountCents: 12500,
      title: 'Approved service charge',
      description: 'Stable approved charge for Android WebView completion testing.',
    },
  })

  const staff = await prisma.staffMember.upsert({
    where: { id: IDS.staff },
    update: { orgId: landlord.id, name: 'Play Review Handyman', email: REVIEWER_EMAILS.staff, phone: '+16025550103', skillsCsv: 'Appliance,Other', availabilityStatus: 'available', isActive: true },
    create: { id: IDS.staff, orgId: landlord.id, name: 'Play Review Handyman', email: REVIEWER_EMAILS.staff, phone: '+16025550103', skillsCsv: 'Appliance,Other', availabilityStatus: 'available' },
  })

  await prisma.maintenanceRequest.upsert({
    where: { id: IDS.staffRequest },
    update: { propertyId: IDS.property, unitId: IDS.unit, orgId: landlord.id, tenantIdentityId: IDS.tenant, submittedByName: 'Play Review Tenant', submittedByEmail: REVIEWER_EMAILS.tenant, title: 'Install window air conditioner', description: 'Sample tenant-paid personal work for Google Play staff-portal review.', category: 'Appliance', urgency: 'low', status: 'approved', assignedStaffId: staff.id, assignedStaffName: staff.name, assignedStaffEmail: staff.email, assignedStaffPhone: staff.phone, staffWorkStatus: 'assigned', workResponsibility: 'tenant_personal_work', personalWorkStatus: 'approved', personalWorkHourlyRateCents: 6500, personalWorkMinimumMinutes: 60, personalWorkAuthorizedMaxCents: 20000, personalWorkTenantAuthorizedAt: new Date(), personalWorkManagerApprovedAt: new Date() },
    create: { id: IDS.staffRequest, propertyId: IDS.property, unitId: IDS.unit, orgId: landlord.id, tenantIdentityId: IDS.tenant, submittedByName: 'Play Review Tenant', submittedByEmail: REVIEWER_EMAILS.tenant, title: 'Install window air conditioner', description: 'Sample tenant-paid personal work for Google Play staff-portal review.', category: 'Appliance', urgency: 'low', status: 'approved', assignedStaffId: staff.id, assignedStaffName: staff.name, assignedStaffEmail: staff.email, assignedStaffPhone: staff.phone, staffWorkStatus: 'assigned', workResponsibility: 'tenant_personal_work', personalWorkStatus: 'approved', personalWorkHourlyRateCents: 6500, personalWorkMinimumMinutes: 60, personalWorkAuthorizedMaxCents: 20000, personalWorkTenantAuthorizedAt: new Date(), personalWorkManagerApprovedAt: new Date() },
  })

  console.log(`Android reviewer fixtures ready for ${REVIEWER_EMAILS.landlord}, ${REVIEWER_EMAILS.tenant}, ${REVIEWER_EMAILS.vendor}, and ${REVIEWER_EMAILS.staff}.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
