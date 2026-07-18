import { NextRequest, NextResponse } from 'next/server'
import { processDueAccountDeletionRequests } from '@/lib/account-deletion'
import { assertHostedRuntimeReady } from '@/lib/runtime-env'
import { resultHasFailures, sendOperatorFailureAlert } from '@/lib/operator-alerts'

function isAuthorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  assertHostedRuntimeReady('account deletion automation', ['base', 'notifications', 'media'])

  const result = await processDueAccountDeletionRequests()
  if (resultHasFailures(result)) await sendOperatorFailureAlert('Account deletion automation', result)
  return NextResponse.json({ ok: true, ...result })
}
