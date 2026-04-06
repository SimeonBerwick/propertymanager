import { beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import {
  createBillingDocumentAction,
  duplicateBillingDocumentAction,
  resendBillingDocumentAction,
  updateBillingDocumentAction,
  voidBillingDocumentAction,
} from '@/lib/billing-actions'
import { scaffoldLandlord, createMaintenanceRequest } from '@/test/helpers'

type SessionShape = { userId: string; isLoggedIn: true }

vi.mock('@/lib/landlord-session')
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/notify', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
  buildBillingDocumentMessage: vi.fn().mockImplementation((input) => input),
}))

const PREV = { error: null }

function fd(fields: Record<string, string>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  return form
}

function fakeSession(userId: string): SessionShape {
  return { userId, isLoggedIn: true }
}

describe('billing slice QA rerun for 6a7fa22', () => {
  beforeEach(async () => {
    await prisma.billingEvent.deleteMany()
    await prisma.billingDocument.deleteMany()
    await prisma.vendorDispatchLink.deleteMany()
    await prisma.vendorDispatchEvent.deleteMany()
    vi.mocked(getLandlordSession).mockResolvedValue(null)
  })

  test('create and send, draft, resend, duplicate-as-draft, payment updates, void, and summary coherence all behave sanely', async () => {
    const { user, property, unit } = await scaffoldLandlord()
    vi.mocked(getLandlordSession).mockResolvedValue(fakeSession(user.id) as never)

    await prisma.unit.update({
      where: { id: unit.id },
      data: { tenantEmail: 'tenant@example.com' },
    })

    const request = await createMaintenanceRequest(property.id, unit.id, {
      submittedByName: 'Casey Tenant',
      submittedByEmail: 'tenant@example.com',
      assignedVendorName: 'Pipe Pros',
      assignedVendorEmail: 'vendor@example.com',
      preferredCurrency: 'usd',
    })

    const sentResult = await createBillingDocumentAction(PREV, fd({
      requestId: request.id,
      recipientType: 'tenant',
      title: 'Tenant damage chargeback invoice',
      description: 'Countertop repair',
      amount: '250.00',
      paidAmount: '0.00',
      sendMode: 'send',
      sentTo: 'tenant@example.com',
    }))
    expect(sentResult.error).toBeNull()

    const partialResult = await createBillingDocumentAction(PREV, fd({
      requestId: request.id,
      recipientType: 'vendor',
      title: 'Vendor partial payment remittance',
      description: 'Initial plumbing payout',
      amount: '400.00',
      paidAmount: '150.00',
      sendMode: 'send',
      sentTo: 'vendor@example.com',
    }))
    expect(partialResult.error).toBeNull()

    const draftResult = await createBillingDocumentAction(PREV, fd({
      requestId: request.id,
      recipientType: 'tenant',
      title: 'Tenant reimbursement invoice',
      description: 'Follow-up draft',
      amount: '125.00',
      paidAmount: '0.00',
      sendMode: 'draft',
    }))
    expect(draftResult.error).toBeNull()

    let docs = await prisma.billingDocument.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'asc' },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    })
    expect(docs).toHaveLength(3)
    expect(docs.map((doc) => doc.status)).toEqual(['sent', 'partial', 'draft'])
    expect(docs[0].events.at(-1)?.eventType).toBe('created_and_sent')
    expect(docs[1].events.at(-1)?.eventType).toBe('created_and_sent')
    expect(docs[2].events.at(-1)?.eventType).toBe('created')

    const draftResend = await resendBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[2].id,
      requestId: request.id,
    }))
    expect(draftResend.error).toMatch(/no recipient/i)

    const resendSent = await resendBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[0].id,
      requestId: request.id,
    }))
    expect(resendSent.error).toBeNull()

    const resentDoc = await prisma.billingDocument.findUnique({
      where: { id: docs[0].id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    })
    expect(resentDoc?.status).toBe('sent')
    expect(resentDoc?.sentAt).not.toBeNull()
    expect(resentDoc?.events.at(-1)?.eventType).toBe('resent')

    const duplicateResult = await duplicateBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[1].id,
      requestId: request.id,
    }))
    expect(duplicateResult.error).toBeNull()

    docs = await prisma.billingDocument.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: 'asc' },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    })
    expect(docs).toHaveLength(4)
    const duplicate = docs[3]
    expect(duplicate.title).toMatch(/copy$/i)
    expect(duplicate.status).toBe('draft')
    expect(duplicate.sentTo).toBeNull()
    expect(duplicate.sentAt).toBeNull()
    expect(duplicate.paidCents).toBe(0)
    expect(duplicate.totalCents).toBe(40000)
    expect(duplicate.events.at(-1)?.eventType).toBe('duplicated')

    const partialToPaid = await updateBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[1].id,
      requestId: request.id,
      paidAmount: '400.00',
    }))
    expect(partialToPaid.error).toBeNull()

    const paidDoc = await prisma.billingDocument.findUnique({
      where: { id: docs[1].id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    })
    expect(paidDoc?.status).toBe('paid')
    expect(paidDoc?.paidCents).toBe(40000)
    expect(paidDoc?.events.at(-1)?.eventType).toBe('payment_state_updated')

    const overpayAttempt = await updateBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[0].id,
      requestId: request.id,
      paidAmount: '999.00',
    }))
    expect(overpayAttempt.error).toMatch(/cannot exceed total/i)

    const voidResult = await voidBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[0].id,
      requestId: request.id,
    }))
    expect(voidResult.error).toBeNull()

    const voidedDoc = await prisma.billingDocument.findUnique({
      where: { id: docs[0].id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    })
    expect(voidedDoc?.status).toBe('void')
    expect(voidedDoc?.events.at(-1)?.eventType).toBe('voided')

    const resendVoided = await resendBillingDocumentAction(PREV, fd({
      billingDocumentId: docs[0].id,
      requestId: request.id,
    }))
    expect(resendVoided.error).toMatch(/void documents cannot be resent/i)

    const allDocs = await prisma.billingDocument.findMany({ where: { requestId: request.id } })
    const activeDocs = allDocs.filter((doc) => doc.status !== 'void')
    const summaryTotal = activeDocs.reduce((sum, doc) => sum + doc.totalCents, 0)
    const summaryPaid = activeDocs.reduce((sum, doc) => sum + doc.paidCents, 0)
    const summaryBalance = summaryTotal - summaryPaid

    expect(summaryTotal).toBe(92500)
    expect(summaryPaid).toBe(40000)
    expect(summaryBalance).toBe(52500)

    const timeline = await prisma.billingEvent.findMany({
      where: { billingDocument: { requestId: request.id } },
      orderBy: { createdAt: 'asc' },
    })
    expect(timeline.map((event) => event.eventType)).toEqual([
      'created_and_sent',
      'created_and_sent',
      'created',
      'resent',
      'duplicated',
      'payment_state_updated',
      'voided',
    ])
  })
})
