import { NextRequest, NextResponse } from 'next/server'
import { buildCsvExport, type CsvExportKind } from '@/lib/csv-export'
import { getLandlordSession } from '@/lib/landlord-session'

function changedSince(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('since')
  if (!raw) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getLandlordSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kind } = await params
  if (!['units', 'vendors', 'tickets'].includes(kind)) {
    return NextResponse.json({ error: 'Unsupported CSV export.' }, { status: 404 })
  }

  const file = await buildCsvExport(session.userId, kind as CsvExportKind, changedSince(request))
  return new NextResponse(file.content, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${file.filename}"`,
    },
  })
}
