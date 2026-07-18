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
import { runSchedulingCoordinationSweep } from '@/lib/scheduling-automation'
import { syncAllSubscriptionUnitPricing } from '@/lib/subscription-unit-pricing'
import { emergencyFeatureMessage, isEmergencyFeatureDisabled } from '@/lib/feature-switches'
import { sendDueTrialEndingReminders } from '@/lib/trial-reminders'
import { processRecurringWorkPlans, sendRecurringWorkReminders, sendVendorCertificateExpiryAlerts } from '@/lib/recurring-work'
import { processDueAccountDeletionRequests } from '@/lib/account-deletion'

function isAuthorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

async function runAutomation(request: NextRequest, body: { sendSummaries?: boolean; syncMailboxes?: boolean }) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isEmergencyFeatureDisabled('automation')) {
    return NextResponse.json({ ok: false, paused: true, error: emergencyFeatureMessage('automation') }, { status: 503 })
  }

  assertHostedRuntimeReady('internal automation route', ['base', 'notifications'])

  const sweep = await runAutomationSweep()
  const vendorReminders = await sendDailyVendorReminders()
  const mailboxSync = body.syncMailboxes === false ? null : await syncAllMailboxReplies()
  const dailyCsvExports = await sendDueDailyCsvExports()
  const subscriptionReconciliation = await reconcileStripeSubscriptions()
  const subscriptionUnitPricing = await syncAllSubscriptionUnitPricing()
  const outlookCalendarSync = await syncAllOutlookCalendars()
  const staffAssignmentFallbacks = await runStaffAssignmentFallbacks()
  const schedulingCoordination = await runSchedulingCoordinationSweep()
  const trialEndingReminders = await sendDueTrialEndingReminders()
  const recurringWork = await processRecurringWorkPlans()
  const recurringWorkReminders = await sendRecurringWorkReminders()
  const vendorCertificateAlerts = await sendVendorCertificateExpiryAlerts()
  const accountDeletions = await processDueAccountDeletionRequests()
  if (accountDeletions.notificationWarnings.length) {
    await sendOperatorFailureAlert('Account deletion completion email', accountDeletions.notificationWarnings)
  }
  const operationalResults = { mailboxSync, dailyCsvExports, subscriptionReconciliation, subscriptionUnitPricing, vendorReminders, outlookCalendarSync, staffAssignmentFallbacks, schedulingCoordination, trialEndingReminders, recurringWork, recurringWorkReminders, vendorCertificateAlerts, accountDeletions }
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

  return NextResponse.json({ ok: true, sweep, vendorReminders, mailboxSync, outlookCalendarSync, staffAssignmentFallbacks, schedulingCoordination, trialEndingReminders, recurringWork, recurringWorkReminders, vendorCertificateAlerts, accountDeletions, dailyCsvExports, subscriptionReconciliation, subscriptionUnitPricing, summaryResults })
}

export async function GET(request: NextRequest) {
  return runAutomation(request, {})
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { sendSummaries?: boolean; syncMailboxes?: boolean }
  return runAutomation(request, body)
}
