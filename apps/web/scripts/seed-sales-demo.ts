import { createHash } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type RequestStatus } from '@prisma/client'
import { currentTermsAcceptanceKey, PRIVACY_VERSION, standardUseConsentText, TERMS_VERSION } from '../lib/legal-consent'
import { hashPassword } from '../lib/password'

const connectionString = process.env.DATABASE_URL?.trim()
const prisma = process.env.SALES_DEMO_USE_PG_ADAPTER === '1' && connectionString
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : new PrismaClient()

const IDS = {
  property: 'sales-demo-property',
  commonArea: 'sales-demo-common-area',
  unit101: 'sales-demo-unit-101',
  unit204: 'sales-demo-unit-204',
  tenant101: 'sales-demo-tenant-101',
  tenant204: 'sales-demo-tenant-204',
  vendor: 'sales-demo-vendor',
  staff: 'sales-demo-staff',
  boardApprover: 'sales-demo-board-approver',
  boardPolicy: 'sales-demo-board-policy',
  recurringPlan: 'sales-demo-recurring-plan',
  requests: {
    newRequest: 'sales-demo-request-new',
    boardReview: 'sales-demo-request-board-review',
    scheduled: 'sales-demo-request-scheduled',
    staffWork: 'sales-demo-request-staff',
    invoiceReview: 'sales-demo-request-invoice',
    closed: 'sales-demo-request-closed',
  },
  commercialItem: 'sales-demo-commercial-item',
  boardApproval: 'sales-demo-board-approval',
} as const

function requiredPassword() {
  const password = process.env.SALES_DEMO_PASSWORD?.trim()
  if (!password || password.length < 12) {
    throw new Error('Set SALES_DEMO_PASSWORD to a dedicated password with at least 12 characters.')
  }
  return password
}

function assertDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim()
  if (!value || (!value.startsWith('postgresql://') && !value.startsWith('postgres://'))) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
  }
}

function addDays(days: number, hour = 16) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() + days)
  value.setUTCHours(hour, 0, 0, 0)
  return value
}

function taggedEmail(base: string, tag: string) {
  const [local, domain] = base.split('@')
  if (!local || !domain) return base
  return `${local}+${tag}@${domain}`
}

async function upsertRequest(input: {
  id: string
  orgId: string
  propertyId: string
  unitId: string
  tenantIdentityId?: string
  submittedByName: string
  submittedByEmail: string
  title: string
  description: string
  category: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  status: RequestStatus
  createdAt: Date
  assignedVendorId?: string
  assignedVendorName?: string
  assignedVendorEmail?: string
  assignedStaffId?: string
  assignedStaffName?: string
  assignedStaffEmail?: string
  dispatchStatus?: 'assigned' | 'contacted' | 'accepted' | 'scheduled' | 'in_progress' | 'completed'
  vendorScheduledStart?: Date
  vendorScheduledEnd?: Date
  actualCompletedAt?: Date
  closedAt?: Date
  tenantBillbackAmountCents?: number
  tenantBillbackReason?: string
  boardApprovalRequired?: boolean
  boardApprovalState?: string
}) {
  const data = {
    orgId: input.orgId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantIdentityId: input.tenantIdentityId,
    submittedByName: input.submittedByName,
    submittedByEmail: input.submittedByEmail,
    title: input.title,
    description: input.description,
    category: input.category,
    urgency: input.urgency,
    status: input.status,
    createdAt: input.createdAt,
    assignedVendorId: input.assignedVendorId,
    assignedVendorName: input.assignedVendorName,
    assignedVendorEmail: input.assignedVendorEmail,
    assignedStaffId: input.assignedStaffId,
    assignedStaffName: input.assignedStaffName,
    assignedStaffEmail: input.assignedStaffEmail,
    staffWorkStatus: input.assignedStaffId ? 'assigned' : undefined,
    dispatchStatus: input.dispatchStatus,
    vendorScheduledStart: input.vendorScheduledStart,
    vendorScheduledEnd: input.vendorScheduledEnd,
    actualCompletedAt: input.actualCompletedAt,
    closedAt: input.closedAt,
    tenantBillbackDecision: input.tenantBillbackAmountCents ? 'bill_tenant' as const : 'none' as const,
    tenantBillbackAmountCents: input.tenantBillbackAmountCents ?? 0,
    tenantBillbackReason: input.tenantBillbackReason,
    boardApprovalRequired: input.boardApprovalRequired ?? false,
    boardApprovalState: input.boardApprovalState ?? 'not_required',
  }
  await prisma.maintenanceRequest.upsert({ where: { id: input.id }, update: data, create: { id: input.id, ...data } })
}

async function main() {
  assertDatabaseUrl()
  const email = process.env.SALES_DEMO_EMAIL?.trim().toLowerCase() || 'sales-demo@simeonware.com'
  const contactInbox = process.env.SALES_DEMO_CONTACT_EMAIL?.trim().toLowerCase() || 'founder@simeonware.com'
  const password = requiredPassword()

  const manager = await prisma.user.upsert({
    where: { email },
    update: {
      displayName: 'Jordan Lee', businessName: 'Desert View Cooperative', passwordHash: hashPassword(password), role: 'landlord', slug: 'sales-demo',
      subscriptionStatus: 'active', subscriptionPlan: 'pro', billingCadence: 'monthly', coOpModeEnabled: true, trialProgram: 'none',
      businessCountryCode: 'US', businessStateCode: 'AZ', personalWorkEnabled: true, personalWorkHourlyRateCents: 4800,
    },
    create: {
      email, displayName: 'Jordan Lee', businessName: 'Desert View Cooperative', passwordHash: hashPassword(password), role: 'landlord', slug: 'sales-demo',
      subscriptionStatus: 'active', subscriptionPlan: 'pro', billingCadence: 'monthly', coOpModeEnabled: true, trialProgram: 'none',
      businessCountryCode: 'US', businessStateCode: 'AZ', personalWorkEnabled: true, personalWorkHourlyRateCents: 4800,
    },
  })

  await prisma.legalConsent.upsert({
    where: { acceptanceKey: currentTermsAcceptanceKey('manager', manager.id) },
    update: {},
    create: {
      acceptanceKey: currentTermsAcceptanceKey('manager', manager.id), orgId: manager.id, principalType: 'manager', principalId: manager.id,
      context: 'sales_demo_seed', termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, consentText: standardUseConsentText('property manager'),
    },
  })

  await prisma.property.upsert({
    where: { id: IDS.property },
    update: { ownerId: manager.id, name: 'Desert View Cooperative', address: '1840 E Sonoran Avenue, Phoenix, AZ 85016', propertyType: 'cooperative', isActive: true, personalWorkAllowed: true },
    create: { id: IDS.property, ownerId: manager.id, name: 'Desert View Cooperative', address: '1840 E Sonoran Avenue, Phoenix, AZ 85016', propertyType: 'cooperative', personalWorkAllowed: true },
  })

  const units = [
    { id: IDS.commonArea, label: 'Main building and grounds', locationType: 'common_area' as const, areaType: 'Building common area' },
    { id: IDS.unit101, label: 'Unit 101', locationType: 'residential' as const, tenantName: 'Maria Alvarez', tenantEmail: taggedEmail(contactInbox, 'demo-tenant-101') },
    { id: IDS.unit204, label: 'Unit 204', locationType: 'residential' as const, tenantName: 'David Chen', tenantEmail: taggedEmail(contactInbox, 'demo-tenant-204') },
  ]
  for (const unit of units) {
    await prisma.unit.upsert({ where: { id: unit.id }, update: { propertyId: IDS.property, ...unit }, create: { propertyId: IDS.property, ...unit } })
  }

  const tenants = [
    { id: IDS.tenant101, unitId: IDS.unit101, name: 'Maria Alvarez', phone: '+16025550111', email: taggedEmail(contactInbox, 'demo-tenant-101') },
    { id: IDS.tenant204, unitId: IDS.unit204, name: 'David Chen', phone: '+16025550204', email: taggedEmail(contactInbox, 'demo-tenant-204') },
  ]
  for (const tenant of tenants) {
    await prisma.tenantIdentity.upsert({
      where: { orgId_phoneE164_unitId: { orgId: manager.id, phoneE164: tenant.phone, unitId: tenant.unitId } },
      update: { propertyId: IDS.property, tenantName: tenant.name, email: tenant.email, status: 'active', verifiedAt: new Date(), leaseStartDate: addDays(-180) },
      create: { id: tenant.id, orgId: manager.id, propertyId: IDS.property, unitId: tenant.unitId, tenantName: tenant.name, phoneE164: tenant.phone, email: tenant.email, status: 'active', verifiedAt: new Date(), leaseStartDate: addDays(-180) },
    })
  }

  const vendorEmail = taggedEmail(contactInbox, 'demo-vendor')
  await prisma.vendor.upsert({
    where: { id: IDS.vendor },
    update: { orgId: manager.id, name: 'Canyon Mechanical Services', email: vendorEmail, phone: '+16025550300', categoriesCsv: 'HVAC,Plumbing,Electrical', supportedLanguagesCsv: 'english,spanish', supportedCurrenciesCsv: 'usd', isActive: true },
    create: { id: IDS.vendor, orgId: manager.id, name: 'Canyon Mechanical Services', email: vendorEmail, phone: '+16025550300', categoriesCsv: 'HVAC,Plumbing,Electrical', supportedLanguagesCsv: 'english,spanish', supportedCurrenciesCsv: 'usd' },
  })

  const staffEmail = taggedEmail(contactInbox, 'demo-staff')
  await prisma.staffMember.upsert({
    where: { id: IDS.staff },
    update: { orgId: manager.id, name: 'Marcus Reed', email: staffEmail, phone: '+16025550400', skillsCsv: 'General,Appliance,Plumbing', hourlyRateCents: 4800, availabilityStatus: 'available', isActive: true },
    create: { id: IDS.staff, orgId: manager.id, name: 'Marcus Reed', email: staffEmail, phone: '+16025550400', skillsCsv: 'General,Appliance,Plumbing', hourlyRateCents: 4800, availabilityStatus: 'available' },
  })

  const boardEmail = taggedEmail(contactInbox, 'demo-board')
  await prisma.boardApprover.upsert({
    where: { orgId_email: { orgId: manager.id, email: boardEmail } },
    update: { name: 'Avery Morgan', isActive: true },
    create: { id: IDS.boardApprover, orgId: manager.id, name: 'Avery Morgan', email: boardEmail },
  })
  await prisma.boardApprovalPolicy.upsert({
    where: { id: IDS.boardPolicy },
    update: { orgId: manager.id, propertyId: IDS.property, approverId: IDS.boardApprover, category: 'Roofing', enabled: true },
    create: { id: IDS.boardPolicy, orgId: manager.id, propertyId: IDS.property, approverId: IDS.boardApprover, category: 'Roofing' },
  })

  await upsertRequest({ id: IDS.requests.newRequest, orgId: manager.id, propertyId: IDS.property, unitId: IDS.unit101, tenantIdentityId: IDS.tenant101, submittedByName: 'Maria Alvarez', submittedByEmail: tenants[0].email, title: 'Kitchen sink is draining slowly', description: 'The sink backs up after about a minute. No water is leaking under the cabinet.', category: 'Plumbing', urgency: 'medium', status: 'requested', createdAt: addDays(-1, 17) })
  await upsertRequest({ id: IDS.requests.boardReview, orgId: manager.id, propertyId: IDS.property, unitId: IDS.commonArea, submittedByName: 'Jordan Lee', submittedByEmail: email, title: 'Repair roof membrane above west stairwell', description: 'Inspection found a separated seam and moisture staining. Proposal requires board review before non-emergency work begins.', category: 'Roofing', urgency: 'high', status: 'approved', createdAt: addDays(-2, 15), boardApprovalRequired: true, boardApprovalState: 'pending' })
  await upsertRequest({ id: IDS.requests.scheduled, orgId: manager.id, propertyId: IDS.property, unitId: IDS.unit204, tenantIdentityId: IDS.tenant204, submittedByName: 'David Chen', submittedByEmail: tenants[1].email, title: 'Air conditioner is not cooling evenly', description: 'Bedroom remains warm while the living room reaches the thermostat setting.', category: 'HVAC', urgency: 'high', status: 'scheduled', createdAt: addDays(-4, 14), assignedVendorId: IDS.vendor, assignedVendorName: 'Canyon Mechanical Services', assignedVendorEmail: vendorEmail, dispatchStatus: 'scheduled', vendorScheduledStart: addDays(2, 16), vendorScheduledEnd: addDays(2, 18) })
  await upsertRequest({ id: IDS.requests.staffWork, orgId: manager.id, propertyId: IDS.property, unitId: IDS.commonArea, submittedByName: 'Jordan Lee', submittedByEmail: email, title: 'Adjust courtyard gate closer', description: 'Gate is latching too hard and needs a minor closer adjustment.', category: 'General', urgency: 'low', status: 'in_progress', createdAt: addDays(-3, 16), assignedStaffId: IDS.staff, assignedStaffName: 'Marcus Reed', assignedStaffEmail: staffEmail })
  await upsertRequest({ id: IDS.requests.invoiceReview, orgId: manager.id, propertyId: IDS.property, unitId: IDS.unit101, tenantIdentityId: IDS.tenant101, submittedByName: 'Maria Alvarez', submittedByEmail: tenants[0].email, title: 'Replace failed water heater', description: 'Vendor completed the approved replacement and submitted the final invoice for review.', category: 'Plumbing', urgency: 'urgent', status: 'completed', createdAt: addDays(-8, 16), assignedVendorId: IDS.vendor, assignedVendorName: 'Canyon Mechanical Services', assignedVendorEmail: vendorEmail, dispatchStatus: 'completed', actualCompletedAt: addDays(-1, 19) })
  await upsertRequest({ id: IDS.requests.closed, orgId: manager.id, propertyId: IDS.property, unitId: IDS.unit204, tenantIdentityId: IDS.tenant204, submittedByName: 'David Chen', submittedByEmail: tenants[1].email, title: 'Repair damaged bedroom door', description: 'Door damage was documented, repaired, and charged back after manager review.', category: 'Carpentry', urgency: 'low', status: 'closed', createdAt: addDays(-18, 15), actualCompletedAt: addDays(-12, 18), closedAt: addDays(-11, 17), tenantBillbackAmountCents: 8500, tenantBillbackReason: 'Resident-caused impact damage documented at inspection.' })

  await prisma.vendorCommercialItem.upsert({
    where: { id: IDS.commercialItem },
    update: { requestId: IDS.requests.invoiceReview, vendorId: IDS.vendor, orgId: manager.id, itemType: 'bill_to_property_manager', status: 'submitted', paymentTiming: 'on_completion', currency: 'usd', amountCents: 87500, title: 'Water heater replacement invoice', description: 'Equipment, installation, disposal, and permit.' },
    create: { id: IDS.commercialItem, requestId: IDS.requests.invoiceReview, vendorId: IDS.vendor, orgId: manager.id, itemType: 'bill_to_property_manager', status: 'submitted', paymentTiming: 'on_completion', currency: 'usd', amountCents: 87500, title: 'Water heater replacement invoice', description: 'Equipment, installation, disposal, and permit.' },
  })

  await prisma.boardApproval.upsert({
    where: { requestId_approverId: { requestId: IDS.requests.boardReview, approverId: IDS.boardApprover } },
    update: { tokenHash: createHash('sha256').update('sales-demo-board-approval').digest('hex'), status: 'pending', responseNote: null, respondedAt: null, expiresAt: addDays(14) },
    create: { id: IDS.boardApproval, requestId: IDS.requests.boardReview, approverId: IDS.boardApprover, tokenHash: createHash('sha256').update('sales-demo-board-approval').digest('hex'), expiresAt: addDays(14) },
  })

  await prisma.recurringWorkPlan.upsert({
    where: { id: IDS.recurringPlan },
    update: { orgId: manager.id, propertyId: IDS.property, unitId: IDS.commonArea, title: 'Quarterly fire alarm panel inspection', description: 'Inspect panel status, test communication, and attach the service report.', category: 'Fire safety', urgency: 'high', frequency: 'quarterly', nextDueAt: addDays(21), daysBeforeDue: 14, requiredEvidenceCsv: 'service report,panel photo', preferredVendorId: IDS.vendor, requiresBoardApproval: false, isActive: true },
    create: { id: IDS.recurringPlan, orgId: manager.id, propertyId: IDS.property, unitId: IDS.commonArea, title: 'Quarterly fire alarm panel inspection', description: 'Inspect panel status, test communication, and attach the service report.', category: 'Fire safety', urgency: 'high', frequency: 'quarterly', nextDueAt: addDays(21), daysBeforeDue: 14, requiredEvidenceCsv: 'service report,panel photo', preferredVendorId: IDS.vendor },
  })

  const comments = [
    { id: 'sales-demo-comment-1', requestId: IDS.requests.newRequest, body: 'The drain is still usable, but it is getting slower each day.', authorUserId: null },
    { id: 'sales-demo-comment-2', requestId: IDS.requests.scheduled, body: 'Tuesday afternoon works. Please ask the technician to call from the gate.', authorUserId: null },
    { id: 'sales-demo-comment-3', requestId: IDS.requests.invoiceReview, body: 'Work completed and hot water was restored. Final invoice attached for manager review.', authorUserId: null },
  ]
  for (const comment of comments) {
    await prisma.requestComment.upsert({ where: { id: comment.id }, update: comment, create: comment })
  }

  const events = [
    { id: 'sales-demo-event-1', requestId: IDS.requests.scheduled, fromStatus: 'approved' as const, toStatus: 'scheduled' as const, actorUserId: manager.id, createdAt: addDays(-2, 16) },
    { id: 'sales-demo-event-2', requestId: IDS.requests.invoiceReview, fromStatus: 'in_progress' as const, toStatus: 'completed' as const, actorUserId: null, createdAt: addDays(-1, 19) },
    { id: 'sales-demo-event-3', requestId: IDS.requests.closed, fromStatus: 'completed' as const, toStatus: 'closed' as const, actorUserId: manager.id, createdAt: addDays(-11, 17) },
  ]
  for (const event of events) {
    await prisma.statusEvent.upsert({ where: { id: event.id }, update: event, create: event })
  }

  console.log(`Sales demo refreshed for ${email}. Property: Desert View Cooperative. Requests: ${Object.keys(IDS.requests).length}.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
