import { notFound } from 'next/navigation'
import { validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'
import { VendorResponseForm } from './form'

export default async function VendorRespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const { token } = await params
  const { submitted } = await searchParams
  const result = await validateVendorDispatchToken(token)

  if (!result.ok) {
    notFound()
  }

  return (
    <div className="card stack" style={{ maxWidth: 760, margin: '48px auto' }}>
      <div>
        <div className="kicker">Vendor response</div>
        <h2 style={{ marginTop: 4 }}>{result.requestTitle}</h2>
        <div className="muted">{result.propertyName} · {result.unitLabel}</div>
      </div>
      {submitted ? <div className="notice success">Response submitted. The operator can now see your update.</div> : null}
      <p className="muted" style={{ margin: 0 }}>
        Hello {result.vendorName}. Use this page to confirm whether you accepted the job, declined it, scheduled it, or completed it.
      </p>
      <VendorResponseForm token={token} />
    </div>
  )
}
