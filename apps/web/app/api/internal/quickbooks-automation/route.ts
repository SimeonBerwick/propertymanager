import { NextRequest, NextResponse } from 'next/server'
import { runQuickBooksAutomation } from '@/lib/quickbooks'
import { resultHasFailures, sendOperatorFailureAlert } from '@/lib/operator-alerts'

function isAuthorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await runQuickBooksAutomation()
  if (resultHasFailures(result)) await sendOperatorFailureAlert('QuickBooks automation', result)
  return NextResponse.json(result)
}
