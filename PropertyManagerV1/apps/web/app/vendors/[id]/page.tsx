import { notFound, redirect } from 'next/navigation'
import { VendorForm } from '@/components/vendor-form'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { getReportData } from '@/lib/data'
import type { Vendor } from '@/lib/types'

function csvToList(value: string | null | undefined) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const { id } = await params

  const [record, reportData] = await Promise.all([
    prisma.vendor.findFirst({
      where: { id, orgId: session.userId },
    }).catch(() => null),
    getReportData(session.userId),
  ])

  if (!record) notFound()

  const vendor: Vendor = {
    id: record.id,
    orgId: record.orgId ?? undefined,
    name: record.name,
    email: record.email ?? undefined,
    phone: record.phone ?? undefined,
    categories: csvToList(record.categoriesCsv),
    supportedLanguages: csvToList(record.supportedLanguagesCsv) as Vendor['supportedLanguages'],
    supportedCurrencies: csvToList(record.supportedCurrenciesCsv) as Vendor['supportedCurrencies'],
    isActive: record.isActive,
  }

  const scorecard = reportData.vendorScorecards.find((item) => item.vendorId === vendor.id)

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="card stack">
        <div>
          <div className="kicker">Vendors</div>
          <h2 style={{ margin: '4px 0 0' }}>Edit vendor</h2>
        </div>
        {scorecard ? (
          <div className="grid cols-4">
            <div>
              <div className="kicker">Assignments</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.assignmentCount}</div>
            </div>
            <div>
              <div className="kicker">Accepted</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.acceptedCount}</div>
            </div>
            <div>
              <div className="kicker">Declined</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.declinedCount}</div>
            </div>
            <div>
              <div className="kicker">Avg completion</div>
              <div style={{ fontWeight: 700, fontSize: 24 }}>{scorecard.avgCompletionDays ? `${scorecard.avgCompletionDays.toFixed(1)}d` : '—'}</div>
            </div>
          </div>
        ) : null}
        <VendorForm vendor={vendor} />
      </div>
    </div>
  )
}
