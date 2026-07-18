import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), ...path.split('/')), 'utf8')
}

describe('production fire-test regressions', () => {
  test('authorizes vendor and staff scheduling through the owning property', () => {
    const scheduling = source('app/scheduling/actions.ts')

    expect(scheduling).toContain('property: { ownerId: session.orgId! }')
    expect(scheduling).toContain('property: { ownerId: session.orgId }')
    expect(scheduling).not.toContain('id: requestId, orgId: session.orgId, assignedVendorId')
    expect(scheduling).not.toContain('id: requestId, orgId: session.orgId, assignedStaffId')
  })

  test('serializes provider calendar writes and checks active overlaps', () => {
    const scheduling = source('app/scheduling/actions.ts')

    expect(scheduling).toContain('pg_advisory_xact_lock')
    expect(scheduling).toContain("status: { in: ['pending', 'selected', 'processing', 'accepted'] }")
    expect(scheduling).toContain('PROVIDER_APPOINTMENT_CONFLICT')
  })

  test('allows manager-created common-area work orders without a resident', () => {
    const intake = source('app/submit/submit-request-form.tsx')

    expect(intake).toContain('managerMode && !selectedIsCommonArea && (!tenantName || !tenantEmail)')
  })

  test('clears the role-specific intake draft after submission', () => {
    const cleanup = source('components/intake-draft-cleanup.tsx')

    expect(cleanup).toContain('`${prefix}:manager`')
    expect(cleanup).toContain('`${prefix}:tenant`')
  })

  test('does not report a completed deletion as failed when confirmation email delivery fails', () => {
    const deletion = source('lib/account-deletion.ts')

    expect(deletion.indexOf('result.completed += 1')).toBeLessThan(deletion.indexOf('const messages = deletionCompletedMessages'))
    expect(deletion).toContain('notificationWarnings')
    expect(deletion).not.toContain("throw new Error('Deletion completed, but one or more completion emails could not be delivered.')")
  })

  test('delivers tenant messages to assigned in-house staff', () => {
    const tenantActions = source('app/mobile/(portal)/requests/[id]/actions.ts')

    expect(tenantActions).toContain('assignedStaffEmail: true')
    expect(tenantActions).toContain('to: request.assignedStaffEmail')
    expect(tenantActions).toContain('/maintenance/requests/${requestId}')
  })

  test('shows an actual paid amount instead of a zero remaining balance', () => {
    const vendorDashboard = source('app/vendor/page.tsx')

    expect(vendorDashboard).toContain('`Paid: ${formatMoney(document.paidCents, document.currency)}`')
  })
})
