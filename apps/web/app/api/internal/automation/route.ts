import { NextRequest, NextResponse } from 'next/server'
import { runAutomationSweep, sendDailyExceptionSummaryToLandlord } from '@/lib/automation'
import { prisma } from '@/lib/prisma'

function isAuthorized(request: NextRequest) {
  const expected = process.env.INTERNAL_AUTOMATION_SECRET
  if (!expected) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${expected}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { sendSummaries?: boolean }
  const sweep = await runAutomationSweep()

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

  return NextResponse.json({ ok: true, sweep, summaryResults })
}
