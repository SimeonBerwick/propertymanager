import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getLandlordSession } from '@/lib/landlord-session'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getVendorSession } from '@/lib/vendor-session'
import { getStaffSession } from '@/lib/staff-auth'
import { isLanguageOption, LOCALE_COOKIE, localeForLanguage } from '@/lib/localization'
import { planIncludesLocalization } from '@/lib/localization-entitlement'

type Portal = 'manager' | 'tenant' | 'vendor' | 'staff' | 'public'

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { language?: unknown; portal?: unknown }
  const language = typeof payload.language === 'string' ? payload.language : ''
  const portal = typeof payload.portal === 'string' ? payload.portal as Portal : 'public'
  if (!isLanguageOption(language)) return NextResponse.json({ error: 'Unsupported language.' }, { status: 400 })

  try {
    if (portal === 'manager') {
      const session = await getLandlordSession()
      if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
      const owner = await prisma.user.findUnique({ where: { id: session.userId }, select: { subscriptionPlan: true } })
      if (language !== 'english' && !planIncludesLocalization(owner?.subscriptionPlan)) return NextResponse.json({ error: 'Multilingual communication is included with Growth and Pro.' }, { status: 403 })
      await prisma.user.update({ where: { id: session.userId }, data: { preferredLanguage: language, languagePreferenceExplicit: true } })
    } else if (portal === 'tenant') {
      const session = await getTenantMobileSession()
      if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
      const owner = await prisma.user.findUnique({ where: { id: session.orgId }, select: { subscriptionPlan: true } })
      if (language !== 'english' && !planIncludesLocalization(owner?.subscriptionPlan)) return NextResponse.json({ error: 'Multilingual communication is included with Growth and Pro.' }, { status: 403 })
      await prisma.tenantIdentity.update({ where: { id: session.tenantIdentityId }, data: { preferredLanguage: language, languagePreferenceExplicit: true } })
    } else if (portal === 'vendor') {
      const session = await getVendorSession()
      if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
      const owner = session.orgId ? await prisma.user.findUnique({ where: { id: session.orgId }, select: { subscriptionPlan: true } }) : null
      if (language !== 'english' && !planIncludesLocalization(owner?.subscriptionPlan)) return NextResponse.json({ error: 'Multilingual communication is included with Growth and Pro.' }, { status: 403 })
      await prisma.vendor.update({ where: { id: session.vendorId }, data: { preferredLanguage: language, languagePreferenceExplicit: true } })
    } else if (portal === 'staff') {
      const session = await getStaffSession()
      if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
      const owner = await prisma.user.findUnique({ where: { id: session.orgId }, select: { subscriptionPlan: true } })
      if (language !== 'english' && !planIncludesLocalization(owner?.subscriptionPlan)) return NextResponse.json({ error: 'Multilingual communication is included with Growth and Pro.' }, { status: 403 })
      await prisma.staffMember.update({ where: { id: session.staffMemberId }, data: { preferredLanguage: language, languagePreferenceExplicit: true } })
    }
  } catch (error) {
    console.error('[LOCALIZATION] Could not persist account language preference:', error)
    return NextResponse.json({ error: 'Could not save language preference.' }, { status: 500 })
  }

  const locale = localeForLanguage(language)
  ;(await cookies()).set(LOCALE_COOKIE, language, {
    path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  })
  return NextResponse.json({ ok: true, language, code: locale.code, direction: locale.direction })
}
