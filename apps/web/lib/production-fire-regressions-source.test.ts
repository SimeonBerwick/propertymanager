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
    const form = source('app/submit/submit-request-form.tsx')
    const page = source('app/submit/page.tsx')

    expect(cleanup).toContain('`${prefix}:manager`')
    expect(cleanup).toContain('`${prefix}:tenant`')
    expect(cleanup).toContain('`pm-intake-draft:manager:${managerDraftScope}`')
    expect(form).toContain("window.localStorage.removeItem('pm-intake-draft:default:manager')")
    expect(form).toContain("`pm-intake-draft:manager:${managerDraftScope ?? 'unscoped'}`")
    expect(page).toContain('managerDraftScope={session?.userId}')
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

  test('keeps co-op board outcomes honest and emergency override reasons visible', () => {
    const requestPage = source('app/requests/[id]/page.tsx')
    const boardPage = source('app/board/[token]/page.tsx')

    expect(requestPage).toContain("['approved', 'returned', 'declined', 'overridden']")
    expect(requestPage).toContain('Emergency board override recorded.')
    expect(requestPage).toContain("'Manager-only reason'")
    expect(boardPage).toContain('The work order remains paused until it is revised and approved.')
    expect(boardPage).toContain('The work order remains paused while the property manager reviews next steps.')
    expect(boardPage).toContain('Board approval link unavailable')
    expect(boardPage).toContain('This approval link has expired.')
  })

  test('gives custom recurring work a safe starting interval', () => {
    const coopPage = source('app/co-op/page.tsx')

    expect(coopPage).toContain('name="customIntervalDays" type="number" min="1" max="730" defaultValue="30"')
  })

  test('lets a manager recover a pending board request with a fresh secure link', () => {
    const actions = source('lib/request-detail-actions.ts')
    const pendingPanel = source('app/requests/[id]/board-pending-panel.tsx')

    expect(actions).toContain("['pending', 'returned', 'declined'].includes(request.boardApprovalState)")
    expect(pendingPanel).toContain('This invalidates the earlier link')
    expect(pendingPanel).toContain('Send fresh board link')
  })

  test('blocks duplicate board rules and unsafe approver deactivation', () => {
    const actions = source('app/co-op/actions.ts')

    expect(actions).toContain('This board approval rule already exists.')
    expect(actions).toContain('This board approver still has an unanswered request.')
    expect(actions).toContain("status: 'pending'")
  })

  test('never exposes or accepts unscoped public maintenance intake', () => {
    const page = source('app/submit/page.tsx')
    const action = source('lib/request-actions.ts')
    const data = source('lib/data.ts')

    expect(page).toContain("Use your property's request link")
    expect(action).toContain('Invalid submission link. Please use the property-specific link provided by your property manager.')
    expect(data.match(/if \(!userId && !orgSlug\) return \[\]/g)).toHaveLength(2)
    expect(data).toContain('requestFormPath: user?.slug ? `/submit/${user.slug}`')
  })

  test('shows service-call acceptance instead of a bid form for direct assignments', () => {
    const page = source('app/vendor/respond/[token]/page.tsx')
    const form = source('app/vendor/respond/[token]/form.tsx')

    expect(page).toContain("mode={result.tenderInviteId ? 'bid' : 'service_call'}")
    expect(page).toContain('Service-call response recorded.')
    expect(form).toContain("mode === 'bid' ? 'Submit bid' : 'Accept service call'")
    expect(form).toContain("mode === 'bid' && response === 'accepted'")
  })

  test('does not ask a common-area work order to send a tenant update', () => {
    const page = source('app/requests/[id]/page.tsx')
    const controls = source('app/requests/[id]/request-control-panel.tsx')

    expect(page).toContain('It will be recorded on this common-area work order.')
    expect(controls).toContain('Appointment saved on this common-area work order.')
    expect(controls).toContain('dispatchState.success && request.submittedByEmail')
  })

  test('shows an actual paid amount instead of a zero remaining balance', () => {
    const vendorDashboard = source('app/vendor/page.tsx')

    expect(vendorDashboard).toContain('`Paid: ${formatMoney(document.paidCents, document.currency)}`')
  })
})
