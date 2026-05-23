import { notFound, redirect } from 'next/navigation'
import { getVendorSession } from '@/lib/vendor-session'
import { markVendorDispatchLinkUsed, validateVendorDispatchToken } from '@/lib/vendor-dispatch-link'

export default async function VendorRespondPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await validateVendorDispatchToken(token)

  if (!result.ok) {
    notFound()
  }

  const session = await getVendorSession()
  if (session?.vendorId === result.vendorId) {
    await markVendorDispatchLinkUsed(result.linkId)
    redirect(`/vendor/requests/${result.requestId}` as never)
  }

  const paramsString = new URLSearchParams({
    next: `/vendor/requests/${result.requestId}`,
    email: result.vendorEmail ?? '',
    context: 'dispatch-link',
  })
  redirect(`/vendor/auth/login?${paramsString.toString()}` as never)
}
