import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'

function csvToList(value: string | null | undefined) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

export default async function VendorsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  const vendors = await prisma.vendor.findMany({
    where: { orgId: session.userId },
    orderBy: { name: 'asc' },
  }).catch(() => [])

  return (
    <div className="stack">
      <div className="row">
        <div>
          <div className="kicker">Vendors</div>
          <h2 style={{ margin: '4px 0 0' }}>Vendor capability directory</h2>
        </div>
        <Link href="/vendors/new" className="button primary">Add vendor</Link>
      </div>

      {vendors.length ? (
        <div className="grid cols-2">
          {vendors.map((vendor) => (
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
            </section>
          ))}
        </div>
      ) : (
        <div className="card stack" style={{ maxWidth: 520 }}>
          <h3 style={{ margin: 0 }}>No vendors yet</h3>
          <p className="muted" style={{ margin: 0 }}>Create vendors here so request matching and assignment can be managed in-app.</p>
          <Link href="/vendors/new" className="button primary" style={{ alignSelf: 'flex-start' }}>Create first vendor</Link>
        </div>
      )}
    </div>
  )
}
