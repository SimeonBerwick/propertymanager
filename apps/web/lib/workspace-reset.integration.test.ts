import { beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

vi.mock('@/lib/notify', () => ({ sendNotification: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@/lib/media-storage', () => ({ deleteStoredMedia: vi.fn().mockResolvedValue(undefined) }))

import { processDueWorkspaceResetRequests } from '@/lib/workspace-reset'

describe('workspace reset processing', () => {
  beforeEach(() => vi.clearAllMocks())

  test('purges operational data while preserving login, plan, billing, and unit allowance', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'reset-manager@example.com',
        passwordHash: hashPassword('Reset-test-password-1'),
        role: 'landlord',
        subscriptionStatus: 'active',
        subscriptionPlan: 'pro',
        billingCadence: 'annual',
        stripeCustomerId: 'cus_workspace_reset_test',
        stripeSubscriptionId: 'sub_workspace_reset_test',
        additionalUnitAllowance: 12,
        workspaceResetPendingAt: new Date('2026-07-20T12:00:00.000Z'),
        workspaceResetScheduledFor: new Date('2026-07-21T12:00:00.000Z'),
      },
    })
    const property = await prisma.property.create({ data: { ownerId: user.id, name: 'Old Portfolio', address: '1 Old Street' } })
    const unit = await prisma.unit.create({ data: { propertyId: property.id, label: '1A' } })
    await prisma.maintenanceRequest.create({
      data: {
        propertyId: property.id,
        unitId: unit.id,
        title: 'Old request',
        description: 'Must be removed',
        category: 'Other',
        urgency: 'medium',
      },
    })
    const reset = await prisma.workspaceResetRequest.create({
      data: {
        userId: user.id,
        email: user.email,
        scheduledFor: new Date('2026-07-21T12:00:00.000Z'),
      },
    })

    const result = await processDueWorkspaceResetRequests(new Date('2026-07-21T13:00:00.000Z'))

    expect(result).toMatchObject({ processed: 1, completed: 1, failed: 0 })
    expect(await prisma.property.count({ where: { ownerId: user.id } })).toBe(0)
    expect(await prisma.maintenanceRequest.count({ where: { propertyId: property.id } })).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({
      email: user.email,
      subscriptionStatus: 'active',
      subscriptionPlan: 'pro',
      billingCadence: 'annual',
      stripeCustomerId: 'cus_workspace_reset_test',
      stripeSubscriptionId: 'sub_workspace_reset_test',
      additionalUnitAllowance: 12,
      workspaceResetPendingAt: null,
      workspaceResetScheduledFor: null,
    })
    expect(await prisma.workspaceResetRequest.findUnique({ where: { id: reset.id } })).toMatchObject({ status: 'completed' })
  })
})
