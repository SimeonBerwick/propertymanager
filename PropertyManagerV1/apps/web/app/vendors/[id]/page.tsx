import { notFound, redirect } from 'next/navigation'
import { VendorForm } from '@/components/vendor-form'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import type { Vendor } from '@/lib/types'

function csvToList(value: string | null | undefined) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []
}

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const { id } = await params

  const record = await prisma.vendor.findFirst({
    where: { id, orgId: session.userId },
  }).catch(() => null)

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

  return (
    <div className="card stack" style={{ maxWidth: 760 }}>
      <div>
        <div className="kicker">Vendors</div>
        <h2 style={{ margin: '4px 0 0' }}>Edit vendor</h2>
      </div>
      <VendorForm vendor={vendor} />
    </div>
  )
}
