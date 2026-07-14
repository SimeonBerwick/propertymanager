import { describe, expect, test } from 'vitest'
import { prisma } from '@/lib/prisma'
import { currentTermsAcceptanceKey, hasCurrentTermsAcceptance, PRIVACY_VERSION, standardUseConsentText, TERMS_VERSION } from '@/lib/legal-consent'
import { sendDueTrialEndingReminders } from '@/lib/trial-reminders'

function createManager(email: string, data: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email,
      displayName: 'Trial Test Manager',
      passwordHash: 'test-only-hash',
      role: 'landlord',
      subscriptionPlan: 'starter',
      billingCadence: 'monthly',
      ...data,
    },
  })
}

describe('persisted trial and legal state', () => {
  test('stores current acceptance separately from account status', async () => {
    const user = await createManager('legal-consent@example.com')
    expect(await hasCurrentTermsAcceptance('manager', user.id)).toBe(false)
    await prisma.legalConsent.create({
      data: {
        acceptanceKey: currentTermsAcceptanceKey('manager', user.id),
        orgId: user.id,
        principalType: 'manager',
        principalId: user.id,
        context: 'test',
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        consentText: standardUseConsentText('property manager'),
      },
    })
    expect(await hasCurrentTermsAcceptance('manager', user.id)).toBe(true)
  })

  test('sends each trial-ending reminder at most once', async () => {
    const now = new Date('2030-01-01T12:00:00Z')
    const user = await createManager('trial-reminders@example.com', {
      subscriptionStatus: 'trialing',
      trialProgram: 'self_service_30',
      trialStartedAt: new Date('2029-12-09T12:00:00Z'),
      trialEndsAt: new Date('2030-01-08T12:00:00Z'),
    })

    const sevenDay = await sendDueTrialEndingReminders(now)
    expect(sevenDay).toMatchObject({ sent: 1, deliveryFailureCount: 0 })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).trialReminder7SentAt).toEqual(now)
    expect((await sendDueTrialEndingReminders(now)).sent).toBe(0)

    const twoDayNow = new Date('2030-01-06T12:00:00Z')
    const twoDay = await sendDueTrialEndingReminders(twoDayNow)
    expect(twoDay).toMatchObject({ sent: 1, deliveryFailureCount: 0 })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).trialReminder2SentAt).toEqual(twoDayNow)
    expect((await sendDueTrialEndingReminders(twoDayNow)).sent).toBe(0)
  })
})
