import { NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { CAMPAIGN_COOKIE_NAME, parseAugustCampaignSource } from '@/lib/campaign-attribution'

const ALLOWED_EVENTS = [
  'page_view',
  'intake_draft_saved',
  'intake_started',
  'search_opened',
  'campaign_page_view',
  'campaign_consultation_click',
  'campaign_trial_click',
]

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { eventName?: string, metadata?: Record<string, unknown> } | null
  if (!body?.eventName || !ALLOWED_EVENTS.includes(body.eventName)) return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })
  const session = await getLandlordSession()
  const orgSlug = typeof body.metadata?.orgSlug === 'string' ? body.metadata.orgSlug : null
  const scopedOwner = !session && orgSlug
    ? await prisma.user.findUnique({ where: { slug: orgSlug }, select: { id: true } }).catch(() => null)
    : null
  const metadataJson = body.metadata ? JSON.stringify(body.metadata).slice(0, 2000) : null
  await prisma.productEvent.create({ data: { orgId: session?.userId ?? scopedOwner?.id, eventName: body.eventName, metadataJson } }).catch(() => null)
  const response = NextResponse.json({ ok: true })
  const campaignSource = parseAugustCampaignSource(body.metadata?.source)
  if (campaignSource && body.eventName.startsWith('campaign_')) {
    response.cookies.set(CAMPAIGN_COOKIE_NAME, campaignSource, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 24 * 60 * 60,
      path: '/',
    })
  }
  return response
}
