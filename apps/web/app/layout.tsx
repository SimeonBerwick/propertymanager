import './globals.css'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Route } from 'next'
import { cookies, headers } from 'next/headers'
import { getIronSession } from 'iron-session'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { isDatabaseAvailable } from '@/lib/db-status'
import { ThemeToggle } from '@/components/theme-toggle'
import { PushNotificationControl } from '@/components/push-notification-control'
import { BrandLogo } from '@/components/brand-logo'
import { MenuBehavior } from '@/components/menu-behavior'
import { CommandPalette } from '@/components/command-palette'
import { AnalyticsTracker } from '@/components/analytics-tracker'
import { ClientErrorMonitor } from '@/components/client-error-monitor'
import { ManagerMobileNav } from '@/components/manager-mobile-nav'
import { AndroidRuntimeMarker } from './android-runtime-marker'
import { PublicMarketingNav } from '@/components/public-marketing-nav'
import { getTenantMobileSession } from '@/lib/tenant-mobile-session'
import { getVendorSession } from '@/lib/vendor-session'
import { RouteScrollManager } from '@/components/route-scroll-manager'
import { isAndroidWebView } from '@/lib/android-webview'
import { getStaffSession } from '@/lib/staff-auth'
import { prisma } from '@/lib/prisma'
import { isLanguageOption, localeForLanguage, LOCALE_COOKIE } from '@/lib/localization'
import { LanguageSelector } from '@/components/language-selector'
import { LocalizationRuntime } from '@/components/localization-runtime'
import type { LanguageOption } from '@/lib/types'
import { planIncludesLocalization } from '@/lib/localization-entitlement'
import { hasCurrentTermsAcceptance, type LegalPrincipalType } from '@/lib/legal-consent'
import { RequiredLegalConsent } from '@/components/required-legal-consent'

export const metadata = {
  title: 'Simeonware | Property Maintenance Coordination',
  description: 'Coordinate maintenance requests, tenants, vendors, approvals, and billing from one organized workspace.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Simeonware',
    statusBarStyle: 'default',
  },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions())
  const headerStore = await headers()
  const pathname = headerStore.get('x-pathname') ?? ''
  const androidApp = isAndroidWebView(headerStore.get('user-agent'))
  const isTenantPortalRoute = pathname.startsWith('/mobile')
  const isVendorPortalRoute = pathname === '/vendor' || pathname.startsWith('/vendor/')
  const isStaffPortalRoute = pathname === '/maintenance' || pathname.startsWith('/maintenance/')
  const isManagerRoute = session.isLoggedIn && !isTenantPortalRoute && !isVendorPortalRoute && !isStaffPortalRoute
  const dbAvailable = await isDatabaseAvailable()
  const [tenantPortalSession, vendorPortalSession, staffPortalSession] = dbAvailable
    ? await Promise.all([
        isTenantPortalRoute ? getTenantMobileSession().catch(() => null) : null,
        isVendorPortalRoute ? getVendorSession().catch(() => null) : null,
        isStaffPortalRoute ? getStaffSession().catch(() => null) : null,
      ])
    : [null, null, null]
  let legalPrincipal: { type: LegalPrincipalType; id: string } | null = null
  if (isTenantPortalRoute && tenantPortalSession) legalPrincipal = { type: 'tenant', id: tenantPortalSession.tenantIdentityId }
  else if (isVendorPortalRoute && vendorPortalSession) legalPrincipal = { type: 'vendor', id: vendorPortalSession.vendorId }
  else if (isStaffPortalRoute && staffPortalSession) legalPrincipal = { type: 'staff', id: staffPortalSession.staffMemberId }
  else if (isManagerRoute && session.userId) legalPrincipal = { type: 'manager', id: session.userId }
  const currentLegalAccepted = legalPrincipal
    ? await hasCurrentTermsAcceptance(legalPrincipal.type, legalPrincipal.id)
    : true
  const savedLanguage = headerStore.get('x-app-language') ?? cookieStore.get(LOCALE_COOKIE)?.value
  let preferredLanguage: LanguageOption = isLanguageOption(savedLanguage ?? '') ? savedLanguage as LanguageOption : 'english'
  let hasAccountPreference = false
  let localizationEnabled = true
  if (dbAvailable) {
    let accountPreference: { preferredLanguage: LanguageOption; subscriptionPlan?: SessionData['subscriptionPlan'] } | null = null
    if (isManagerRoute && session.userId) {
      accountPreference = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { preferredLanguage: true, subscriptionPlan: true },
      }).catch(() => null)
    } else if (tenantPortalSession) {
      const [identity, owner] = await Promise.all([
        prisma.tenantIdentity.findUnique({ where: { id: tenantPortalSession.tenantIdentityId }, select: { preferredLanguage: true } }),
        prisma.user.findUnique({ where: { id: tenantPortalSession.orgId }, select: { subscriptionPlan: true } }),
      ]).catch(() => [null, null] as const)
      if (identity) accountPreference = { preferredLanguage: identity.preferredLanguage, subscriptionPlan: owner?.subscriptionPlan }
    } else if (vendorPortalSession?.orgId) {
      const [vendor, owner] = await Promise.all([
        prisma.vendor.findUnique({ where: { id: vendorPortalSession.vendorId }, select: { preferredLanguage: true } }),
        prisma.user.findUnique({ where: { id: vendorPortalSession.orgId }, select: { subscriptionPlan: true } }),
      ]).catch(() => [null, null] as const)
      if (vendor) accountPreference = { preferredLanguage: vendor.preferredLanguage, subscriptionPlan: owner?.subscriptionPlan }
    } else if (staffPortalSession) {
      const [staff, owner] = await Promise.all([
        prisma.staffMember.findUnique({ where: { id: staffPortalSession.staffMemberId }, select: { preferredLanguage: true } }),
        prisma.user.findUnique({ where: { id: staffPortalSession.orgId }, select: { subscriptionPlan: true } }),
      ]).catch(() => [null, null] as const)
      if (staff) accountPreference = { preferredLanguage: staff.preferredLanguage, subscriptionPlan: owner?.subscriptionPlan }
    } else {
      const scopedSubmitSlug = pathname.match(/^\/submit\/([^/]+)/)?.[1]
      if (scopedSubmitSlug) {
        const owner = await prisma.user.findUnique({ where: { slug: scopedSubmitSlug }, select: { subscriptionPlan: true } }).catch(() => null)
        localizationEnabled = planIncludesLocalization(owner?.subscriptionPlan)
      }
    }
    if (accountPreference) {
      hasAccountPreference = true
      localizationEnabled = planIncludesLocalization(accountPreference.subscriptionPlan)
      preferredLanguage = localizationEnabled ? accountPreference.preferredLanguage : 'english'
    }
  }
  const locale = localeForLanguage(preferredLanguage)
  const logoHref: Route = isTenantPortalRoute
    ? '/mobile'
    : isVendorPortalRoute
      ? '/vendor'
      : isStaffPortalRoute
        ? '/maintenance'
      : session.isLoggedIn
    ? '/dashboard'
    : tenantPortalSession
      ? '/mobile'
      : vendorPortalSession
        ? '/vendor'
        : pathname.startsWith('/mobile')
          ? '/mobile/auth'
          : pathname.startsWith('/vendor')
            ? '/vendor/auth'
            : '/'

  return (
    <html lang={locale.code} dir={locale.direction} data-theme="light" suppressHydrationWarning>
      <body>
        <MenuBehavior />
        <RouteScrollManager />
        <AnalyticsTracker />
        <ClientErrorMonitor />
        <AndroidRuntimeMarker />
        <LocalizationRuntime language={preferredLanguage} />
        <div className="page">
          {!dbAvailable && (
            <div
              className="notice demoModeNotice"
              style={{
                marginBottom: 16,
                background: '#fff8e1',
                borderColor: '#ffe082',
                color: '#7a5500',
                fontWeight: 500,
              }}
            >
              <strong>Demo Mode - Seed Data - Read-Only</strong>
              {': '}
              No database is connected. All data shown is sample data. Writes (submitting requests, status updates, comments, creating properties) are disabled.
            </div>
          )}
          <header className={`header ${isManagerRoute ? 'managerHeader' : ''}`}>
            <BrandLogo href={logoHref} />
            <LanguageSelector initialLanguage={preferredLanguage} hasSavedPreference={hasAccountPreference || isLanguageOption(savedLanguage ?? '')} localizationEnabled={localizationEnabled} />
            <div className="nav">
              {isManagerRoute && (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <CommandPalette />
                  <Link href="/ops">Activity</Link>
                  <details className="navMenu">
                    <summary role="button">Portfolio</summary>
                    <div className="navMenuPanel">
                      <Link href="/properties">Properties</Link>
                      <Link href="/vendors">Vendors</Link>
                      <Link href="/staff">Maintenance staff</Link>
                      <Link href="/reports">Reports</Link>
                      <Link href="/inspections">Inspections</Link>
                      <Link href="/turns">Unit turns</Link>
                      <Link href="/calendar">Calendar</Link>
                    </div>
                  </details>
                  <details className="navMenu">
                    <summary role="button">Operations</summary>
                    <div className="navMenuPanel">
                      <Link href="/access">Tenant and vendor access</Link>
                      <Link href="/ops">Data &amp; activity</Link>
                      <Link href="/workflows">Rules</Link>
                      <Link href={'/account/settings' as Route}>Account settings</Link>
                      <Link href="/support">Support</Link>
                      <a href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">Feedback</a>
                    </div>
                  </details>
                  <details className="navMenu">
                    <summary role="button">Preferences</summary>
                    <div className="navMenuPanel navMenuControls">
                      <ThemeToggle />
                      <PushNotificationControl />
                    </div>
                  </details>
                  <form action={logout}>
                    <button type="submit" className="button">Sign out</button>
                  </form>
                </>
              )}
              {!androidApp && !session.isLoggedIn && !isTenantPortalRoute && !isVendorPortalRoute && !isStaffPortalRoute && (
                <PublicMarketingNav />
              )}
            </div>
          </header>
          {children}
          <footer className="siteFooter">
            <BrandLogo href={logoHref} />
            <span>Property maintenance, clearly coordinated.</span>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
            <a href="mailto:support@simeonware.com?subject=Simeonware%20Maintenance%20Manager%20feedback">Feedback</a>
            <Link href="/account-deletion">Account deletion</Link>
          </footer>
          {isManagerRoute ? <ManagerMobileNav /> : null}
          {legalPrincipal && !currentLegalAccepted ? <RequiredLegalConsent principalType={legalPrincipal.type} returnPath={pathname || '/'} /> : null}
        </div>
      </body>
    </html>
  )
}
