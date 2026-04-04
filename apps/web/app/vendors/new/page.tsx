import { redirect } from 'next/navigation'
import { VendorForm } from '@/components/vendor-form'
import { getLandlordSession } from '@/lib/landlord-session'

export default async function NewVendorPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')

  return (
    <div className="card stack" style={{ maxWidth: 760 }}>
      <div>
        <div className="kicker">Vendors</div>
        <h2 style={{ margin: '4px 0 0' }}>Create vendor</h2>
      </div>
      <VendorForm />
    </div>
  )
}
