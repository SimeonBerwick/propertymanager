import { NextResponse } from 'next/server'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'

const ALLOWED_EVENTS = ['page_view', 'intake_draft_saved', 'intake_template_used', 'intake_started', 'search_opened']

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
  return NextResponse.json({ ok: true })
}
