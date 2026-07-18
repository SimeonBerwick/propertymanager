import { notFound, redirect } from 'next/navigation'
import { getVendorSession } from '@/lib/vendor-session'
import { markVendorDispatchLinkUsed, validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'
import { VendorResponseForm } from './form'

export default async function VendorRespondPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const result = await validateVendorDispatchToken(token)

  if (!result.ok) {
    notFound()
  }

  const session = await getVendorSession()
  if (session?.vendorId === result.vendorId && !result.tenderInviteId) {
    await markVendorDispatchLinkUsed(result.linkId)
    redirect(`/vendor/requests/${result.requestId}` as never)
  }

  await markVendorDispatchLinkUsed(result.linkId)
  return (
    <div className="card stack" style={{ maxWidth: 720, margin: '32px auto' }}>
      <div>
        <div className="kicker">Secure work-order link</div>
        <h2 style={{ marginTop: 4 }}>{result.requestTitle}</h2>
        <div className="muted">{result.propertyName} - {result.unitLabel}</div>
      </div>
      <div className="notice success">This link gives access only to this work order. No sign-in is required.</div>
      {query.submitted ? <div className="stack">
        <div className="notice success"><strong>{result.tenderInviteId ? 'Bid response recorded.' : 'Service-call response recorded.'}</strong><span style={{ display: 'block', marginTop: 4 }}>The property manager can now review your response.</span></div>
        <a className="button primary" href="/vendor/auth/login" style={{ alignSelf: 'flex-start' }}>Open vendor sign in</a>
      </div> : <VendorResponseForm token={token} mode={result.tenderInviteId ? 'bid' : 'service_call'} />}
    </div>
  )
}
