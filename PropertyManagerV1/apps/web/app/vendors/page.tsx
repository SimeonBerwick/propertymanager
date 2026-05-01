import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getReportData } from '@/lib/data'

function csvToList(value: string | null | undefined) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

export default async function VendorsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const [vendors, reportData] = await Promise.all([
    prisma.vendor.findMany({
      where: { orgId: session.userId },
      orderBy: { name: 'asc' },
    }).catch(() => []),
    getReportData(session.userId),
  ])

  return (
    <div className="stack">
      <div className="row">
        <div>
          <div className="kicker">Vendors</div>
          <h2 style={{ margin: '4px 0 0' }}>Vendor directory</h2>
        </div>
        <Link href="/vendors/new" className="button primary">Add vendor</Link>
      </div>

      {vendors.length ? (
        <div className="grid cols-2">
          {vendors.map((vendor) => {
            const scorecard = reportData.vendorScorecards.find((item) => item.vendorId === vendor.id)
            return (
            <section key={vendor.id} className="card stack">
              <div className="row">
                <div>
                  <h3 style={{ margin: 0 }}>{vendor.name}</h3>
                  <div className="muted">{vendor.isActive ? 'Active' : 'Inactive'}</div>
                </div>
                <Link href={`/vendors/${vendor.id}`} className="button">Edit</Link>
              </div>
              <div className="muted">{vendor.email ?? 'No email'}{vendor.phone ? ` · ${vendor.phone}` : ''}</div>
              <div><strong>Categories:</strong> {csvToList(vendor.categoriesCsv).join(', ') || 'None'}</div>
              <div><strong>Languages:</strong> {csvToList(vendor.supportedLanguagesCsv).join(', ') || 'None'}</div>
              <div><strong>Currencies:</strong> {csvToList(vendor.supportedCurrenciesCsv).join(', ') || 'None'}</div>
              <div><strong>Assignments:</strong> {scorecard?.assignmentCount ?? 0}</div>
              <div><strong>Accepted:</strong> {scorecard?.acceptedCount ?? 0} · <strong>Declined:</strong> {scorecard?.declinedCount ?? 0}</div>
              <div><strong>Completed:</strong> {scorecard?.completedCount ?? 0}{scorecard?.avgCompletionDays ? ` · Avg ${scorecard.avgCompletionDays.toFixed(1)}d` : ''}</div>
            </section>
          )})}
        </div>
      ) : (
        <div className="card stack" style={{ maxWidth: 520 }}>
          <h3 style={{ margin: 0 }}>No vendors yet</h3>
          <p className="muted" style={{ margin: 0 }}>Add vendors to manage matching and assignment.</p>
          <Link href="/vendors/new" className="button primary" style={{ alignSelf: 'flex-start' }}>Add vendor</Link>
        </div>
      )}
    </div>
  )
}
