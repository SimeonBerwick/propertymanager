import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) throw new Error('DATABASE_URL is required.')

const prisma = process.env.SALES_DEMO_USE_PG_ADAPTER === '1'
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  : new PrismaClient()

const REQUEST_IDS = [
  'sales-demo-request-new',
  'sales-demo-request-board-review',
  'sales-demo-request-scheduled',
  'sales-demo-request-staff',
  'sales-demo-request-invoice',
  'sales-demo-request-closed',
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const email = process.env.SALES_DEMO_EMAIL?.trim().toLowerCase() || 'sales-demo@simeonware.com'
  const manager = await prisma.user.findUnique({ where: { email } })
  assert(manager, 'Sales-demo manager is missing.')
  assert(manager.coOpModeEnabled && manager.subscriptionPlan === 'pro', 'Sales-demo manager must be Pro with co-op mode enabled.')

  const property = await prisma.property.findUnique({ where: { id: 'sales-demo-property' } })
  assert(property?.ownerId === manager.id && property.propertyType === 'cooperative', 'Sales-demo cooperative property is missing or belongs to the wrong account.')

  const requests = await prisma.maintenanceRequest.findMany({ where: { id: { in: REQUEST_IDS } }, select: { id: true, orgId: true, status: true, boardApprovalState: true } })
  assert(requests.length === REQUEST_IDS.length, `Expected ${REQUEST_IDS.length} demo requests; found ${requests.length}.`)
  assert(requests.every((request) => request.orgId === manager.id), 'One or more demo requests are not isolated to the sales-demo account.')
  const statusById = new Map(requests.map((request) => [request.id, request.status]))
  assert(statusById.get('sales-demo-request-new') === 'requested', 'Incoming demo request is not in requested status.')
  assert(statusById.get('sales-demo-request-scheduled') === 'scheduled', 'Scheduled demo request is not scheduled.')
  assert(statusById.get('sales-demo-request-invoice') === 'completed', 'Invoice-review demo request is not completed.')
  assert(statusById.get('sales-demo-request-closed') === 'closed', 'Closed demo request is not closed.')

  const approval = await prisma.boardApproval.findUnique({ where: { id: 'sales-demo-board-approval' } })
  assert(approval?.status === 'pending', 'Demo board approval must be pending.')

  const invoice = await prisma.vendorCommercialItem.findUnique({ where: { id: 'sales-demo-commercial-item' } })
  assert(invoice?.status === 'submitted' && invoice.amountCents === 87500, 'Demo vendor invoice must remain submitted for $875.00.')

  const recurring = await prisma.recurringWorkPlan.findUnique({ where: { id: 'sales-demo-recurring-plan' } })
  assert(recurring?.isActive && recurring.frequency === 'quarterly', 'Quarterly demo recurring-work plan is missing or inactive.')

  console.log('Sales demo verified: isolated Pro co-op account, 6 requests, pending board approval, submitted $875 invoice, and active quarterly work plan.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
