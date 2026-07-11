import { NextRequest, NextResponse } from 'next/server'
import { deleteStoredMedia, readStoredMedia, saveStoredMedia } from '@/lib/media-storage'

function authorized(request: NextRequest) {
  const header = request.headers.get('authorization')
  return [process.env.INTERNAL_AUTOMATION_SECRET, process.env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => header === `Bearer ${secret}`)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = `uploads/requests/storage-proof-${crypto.randomUUID()}.txt`
  const expected = Buffer.from(`simeonware-storage-proof:${Date.now()}`)
  try {
    await saveStoredMedia(path, expected, 'text/plain')
    const stored = await readStoredMedia(path)
    const ok = Boolean(stored && stored.bytes.equals(expected))
    return NextResponse.json({ ok, bytes: stored?.bytes.length ?? 0 }, { status: ok ? 200 : 503 })
  } finally {
    await deleteStoredMedia(path)
  }
}
