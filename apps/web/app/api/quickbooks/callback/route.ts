import { NextResponse } from 'next/server'
import { connectQuickBooks, verifyQuickBooksState } from '@/lib/quickbooks'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const state = url.searchParams.get('state') ?? ''
  const verified = verifyQuickBooksState(state)
  const redirect = new URL('/account/quickbooks', request.url)
  if (!verified || url.searchParams.get('error')) { redirect.searchParams.set('error', 'authorization'); return NextResponse.redirect(redirect) }
  const code = url.searchParams.get('code'); const realmId = url.searchParams.get('realmId')
  if (!code || !realmId) { redirect.searchParams.set('error', 'authorization'); return NextResponse.redirect(redirect) }
  try { await connectQuickBooks(verified.userId, realmId, code); redirect.searchParams.set('connected', 'true') }
  catch { redirect.searchParams.set('error', 'connection') }
  return NextResponse.redirect(redirect)
}
