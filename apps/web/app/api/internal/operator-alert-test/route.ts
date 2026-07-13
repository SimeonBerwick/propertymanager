import { NextRequest, NextResponse } from 'next/server'
import { sendOperatorFailureAlert } from '@/lib/operator-alerts'
import { assertHostedRuntimeReady } from '@/lib/runtime-env'

function isAuthorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

export async function POST(request: NextRequest) {
  assertHostedRuntimeReady('operator alert test', ['notifications'])
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendOperatorFailureAlert('Operator alert test', {
    kind: 'manual delivery test',
    time: new Date().toISOString(),
  })

  return NextResponse.json(
    result.ok ? { ok: true } : { ok: false, error: 'Alert email was not delivered.' },
    { status: result.ok ? 200 : 503 },
  )
}
