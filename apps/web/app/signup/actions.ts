'use server'

import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseAvailable } from '@/lib/db-status'
import { hashPassword } from '@/lib/password'
import { getSessionOptions, type SessionData } from '@/lib/session'
import { parseCadence, parsePlan, trialEndsAtFrom } from '@/lib/billing-plans'
import { isCurrencyOption } from '@/lib/types'
import { writeAuditLog } from '@/lib/audit-log'
import { savedLanguagePreference } from '@/lib/localization-server'
import { verifyAssistedTrialInvite } from '@/lib/assisted-trial-invite'
import { ASSISTED_TRIAL_AGREEMENT_VERSION, currentTermsAcceptanceKey, PRIVACY_VERSION, requestLegalMetadata, signupConsentText, TERMS_VERSION } from '@/lib/legal-consent'
import { isUsStateCode } from '@/lib/us-states'
import { sendNotification } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'
import { augustTrialSource, CAMPAIGN_COOKIE_NAME } from '@/lib/campaign-attribution'

export type SignupState = { error: string | null }

function read(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function slugFromEmail(email: string) {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base || 'landlord'}-${Math.random().toString(36).slice(2, 7)}`
}

function onboardingReference() {
  return `SW-ONBOARD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  if (!await isDatabaseAvailable()) {
    return { error: 'Demo mode, no database connected. Signup is disabled.' }
  }

  const email = read(formData, 'email').toLowerCase()
  const displayName = read(formData, 'displayName')
  const businessName = read(formData, 'businessName')
  const password = read(formData, 'password')
  const plan = parsePlan(formData.get('plan'))
  const cadence = parseCadence(formData.get('cadence'))
  const defaultCurrency = read(formData, 'defaultCurrency') || 'usd'
  const businessStateCode = read(formData, 'businessStateCode').toUpperCase()
  const inviteToken = read(formData, 'inviteToken')
  const assistedInvite = inviteToken ? verifyAssistedTrialInvite(inviteToken, email) : null

  if (!displayName) return { error: 'Name is required.' }
  if (displayName.length > 120) return { error: 'Name must be 120 characters or fewer.' }
  if (businessName.length > 160) return { error: 'Business name must be 160 characters or fewer.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (!plan || !cadence) return { error: 'Choose a subscription plan.' }
  if (!isCurrencyOption(defaultCurrency)) return { error: 'Choose a valid default billing currency.' }
  if (!isUsStateCode(businessStateCode)) return { error: 'Choose the primary U.S. state where you manage property.' }
  if (read(formData, 'confirmUsEligibility') !== 'yes') return { error: 'Confirm that your business manages property in the United States.' }
  if (read(formData, 'acceptLegal') !== 'yes') return { error: 'Review and accept the Terms of Service and acknowledge the Privacy Policy.' }
  if (inviteToken && !assistedInvite) return { error: 'This assisted-trial invitation is invalid, expired, or was issued to a different email address.' }

  const trialStartedAt = new Date()
  const trialEndsAt = trialEndsAtFrom(trialStartedAt)
  const trialProgram = assistedInvite ? 'assisted_us_30' as const : 'self_service_30' as const
  const preferredLanguage = await savedLanguagePreference()
  const requestMetadata = await requestLegalMetadata()
  const consentText = signupConsentText({ trialProgram, trialStartedAt, trialEndsAt })
  const assistedOnboardingReference = assistedInvite ? onboardingReference() : null
  const campaignSource = (await cookies()).get(CAMPAIGN_COOKIE_NAME)?.value
  const trialSource = assistedInvite?.source ?? augustTrialSource(campaignSource)

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) return { error: 'An account already exists for that email.' }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          displayName,
          businessName: businessName || null,
          passwordHash: hashPassword(password),
          role: 'landlord',
          slug: slugFromEmail(email),
          subscriptionStatus: 'trialing',
          subscriptionPlan: plan,
          billingCadence: cadence,
          defaultCurrency,
          preferredLanguage: preferredLanguage ?? 'english',
          languagePreferenceExplicit: Boolean(preferredLanguage),
          trialProgram,
          trialStartedAt,
          trialEndsAt,
          trialSource,
          consultationStatus: assistedInvite ? 'pending' : 'not_included',
          assistedImportStatus: assistedInvite ? 'pending' : 'not_included',
          businessCountryCode: 'US',
          businessStateCode,
        },
      })
      await tx.legalConsent.create({
        data: {
          acceptanceKey: currentTermsAcceptanceKey('manager', created.id),
          orgId: created.id,
          principalType: 'manager',
          principalId: created.id,
          context: 'signup',
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
          trialAgreementVersion: assistedInvite ? ASSISTED_TRIAL_AGREEMENT_VERSION : null,
          consentText,
          trialProgram,
          subscriptionPlan: plan,
          billingCadence: cadence,
          trialStartedAt,
          trialEndsAt,
          ...requestMetadata,
        },
      })
      if (assistedOnboardingReference) {
        await tx.supportRequest.create({
          data: {
            referenceId: assistedOnboardingReference,
            orgId: created.id,
            principalType: 'manager',
            principalId: created.id,
            name: displayName,
            email,
            organization: businessName || null,
            category: 'assisted_trial_onboarding',
            message: `New assisted-trial customer needs one consultation and supported-record import assistance. Offer consultation times within a few business days. Trial ends ${trialEndsAt.toISOString()}.`,
            pagePath: '/signup',
          },
        })
      }
      return created
    })

    await prisma.productEvent.create({
      data: {
        orgId: user.id,
        eventName: 'trial_started',
        metadataJson: JSON.stringify({ source: trialSource, plan, cadence, trialProgram }),
      },
    }).catch(() => null)

    await writeAuditLog({
      orgId: user.id,
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'account.trialStarted',
      summary: `Started ${assistedInvite ? 'assisted' : 'self-service'} 30-day trial on ${plan} ${cadence}.`,
      metadata: { plan, cadence, defaultCurrency, trialProgram, trialStartedAt: trialStartedAt.toISOString(), trialEndsAt: trialEndsAt.toISOString(), trialSource, businessStateCode, legalVersions: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, trial: assistedInvite ? ASSISTED_TRIAL_AGREEMENT_VERSION : null } },
    })

    const baseUrl = (() => {
      try { return getAppBaseUrl('trial confirmation') }
      catch (error) { console.error('[signup] Trial confirmation URL is unavailable:', error); return 'https://simeonware.com' }
    })()
    await sendNotification({
      to: user.email,
      subject: `${assistedInvite ? 'Assisted trial' : 'Free trial'} confirmed`,
      text: [
        `Hi ${user.displayName ?? 'there'},`,
        '',
        `Your ${assistedInvite ? '30-day assisted trial' : '30-day free trial'} has started.`,
        `Trial start: ${trialStartedAt.toISOString()}`,
        `Trial end: ${trialEndsAt.toISOString()}`,
        '',
        'No payment method was collected. The trial will not automatically charge you or convert into a paid subscription.',
        assistedInvite ? 'Your invitation includes one onboarding consultation and assistance importing supported records. We will follow up about scheduling.' : '',
        '',
        `Terms: ${baseUrl}/terms`,
        `Privacy: ${baseUrl}/privacy`,
      ].filter(Boolean).join('\n'),
    }, { ownerUserId: user.id, bypassUserPreference: true, transportHint: 'system' }).catch(() => null)
    if (assistedOnboardingReference) {
      const supportDestination = process.env.SUPPORT_EMAIL?.trim() || process.env.OPS_ALERT_EMAIL?.trim() || 'support@simeonware.com'
      await sendNotification({
        to: supportDestination,
        subject: `[Assisted trial ${assistedOnboardingReference}] Onboarding needed`,
        text: [
          `Reference: ${assistedOnboardingReference}`,
          `Customer: ${displayName}`,
          `Business: ${businessName || 'Not provided'}`,
          `Email: ${email}`,
          `State: ${businessStateCode}`,
          `Trial end: ${trialEndsAt.toISOString()}`,
          '',
          'Offer consultation times within a few business days and coordinate the supported-record import.',
        ].join('\n'),
      }, { ownerUserId: user.id, bypassUserPreference: true, transportHint: 'system' }).catch(() => null)
    }

    const session = await getIronSession<SessionData>(await cookies(), getSessionOptions())
    session.isLoggedIn = true
    session.userId = user.id
    session.email = user.email
    session.role = user.role
    session.subscriptionStatus = user.subscriptionStatus
    session.subscriptionPlan = user.subscriptionPlan
    session.billingCadence = user.billingCadence
    session.trialEndsAt = user.trialEndsAt?.toISOString() ?? null
    session.subscriptionEndsAt = user.subscriptionEndsAt?.toISOString() ?? null
    await session.save()
  } catch (error) {
    console.error('[signup] Could not create trial account:', error)
    return { error: 'Could not create account. Please try again.' }
  }

  redirect('/dashboard')
}
