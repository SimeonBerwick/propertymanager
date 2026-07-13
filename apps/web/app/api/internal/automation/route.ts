import { NextRequest, NextResponse } from 'next/server'
import { runAutomationSweep, sendDailyExceptionSummaryToLandlord, sendDailyVendorReminders } from '@/lib/automation'
import { syncAllMailboxReplies } from '@/lib/mailbox-sync'
import { prisma } from '@/lib/prisma'
import { assertHostedRuntimeReady } from '@/lib/runtime-env'
import { sendDueDailyCsvExports } from '@/lib/daily-csv-export'
import { reconcileStripeSubscriptions } from '@/lib/subscription-reconciliation'
import { resultHasFailures, sendOperatorFailureAlert } from '@/lib/operator-alerts'
import { syncAllOutlookCalendars } from '@/lib/outlook-calendar-sync'
import { runStaffAssignmentFallbacks } from '@/lib/staff-assignment'

function isAuthorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

async function runAutomation(request: NextRequest, body: { sendSummaries?: boolean; syncMailboxes?: boolean }) {
  assertHostedRuntimeReady('internal automation route', ['base', 'notifications'])

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sweep = await runAutomationSweep()
  const vendorReminders = await sendDailyVendorReminders()
  const mailboxSync = body.syncMailboxes === false ? null : await syncAllMailboxReplies()
  const dailyCsvExports = await sendDueDailyCsvExports()
  const subscriptionReconciliation = await reconcileStripeSubscriptions()
  const outlookCalendarSync = await syncAllOutlookCalendars()
  const staffAssignmentFallbacks = await runStaffAssignmentFallbacks()
  const operationalResults = { mailboxSync, dailyCsvExports, subscriptionReconciliation, vendorReminders, outlookCalendarSync, staffAssignmentFallbacks }
  if (resultHasFailures(operationalResults)) await sendOperatorFailureAlert('Daily automation', operationalResults)

  const summaryResults: Array<{ userId: string; ok: boolean }> = []
  if (body.sendSummaries) {
    const landlords = await prisma.user.findMany({
      where: { role: 'landlord' },
      select: { id: true },
    }).catch(() => [])

    for (const landlord of landlords) {
      const result = await sendDailyExceptionSummaryToLandlord(landlord.id)
      summaryResults.push({ userId: landlord.id, ok: !!result.ok })
    }
  }

  return NextResponse.json({ ok: true, sweep, vendorReminders, mailboxSync, outlookCalendarSync, staffAssignmentFallbacks, dailyCsvExports, subscriptionReconciliation, summaryResults })
}

export async function GET(request: NextRequest) {
  return runAutomation(request, {})
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { sendSummaries?: boolean; syncMailboxes?: boolean }
  return runAutomation(request, body)
}
