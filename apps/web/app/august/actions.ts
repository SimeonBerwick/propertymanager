'use server'

import { randomBytes } from 'node:crypto'
import { parseAugustCampaignSource } from '@/lib/campaign-attribution'
import { sendNotification } from '@/lib/notify'
import { prisma } from '@/lib/prisma'
import { takeRateLimitHit } from '@/lib/rate-limit'

export type ConsultationState = {
  error: string | null
  referenceId: string | null
}

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function cleanLine(value: FormDataEntryValue | null, max: number) {
  return clean(value, max).replace(/[\r\n]+/g, ' ')
}

const PORTFOLIO_SIZES = new Set([
  '1-25 units',
  '26-75 units',
  '76-250 units',
  '251-500 units',
  'More than 500 units',
])

function consultationReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `SW-CALL-${date}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function submitConsultationRequest(
  _state: ConsultationState,
  formData: FormData,
): Promise<ConsultationState> {
  const name = cleanLine(formData.get('name'), 120)
  const email = cleanLine(formData.get('email'), 254).toLowerCase()
  const organization = cleanLine(formData.get('organization'), 160)
  const portfolioSize = cleanLine(formData.get('portfolioSize'), 40)
  const phone = cleanLine(formData.get('phone'), 40)
  const notes = clean(formData.get('notes'), 2000)
  const source = parseAugustCampaignSource(clean(formData.get('source'), 40)) ?? 'direct'

  // Bots commonly fill fields hidden from people. Return the normal confirmation
  // without storing or emailing their submission.
  if (clean(formData.get('website'), 200)) {
    return { error: null, referenceId: 'SW-CALL-RECEIVED' }
  }

  if (name.length < 2) return { error: 'Enter your name so we know who to ask for.', referenceId: null }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter the work email where we should reply.', referenceId: null }
  if (organization.length < 2) return { error: 'Enter your company or property-management organization.', referenceId: null }
  if (!PORTFOLIO_SIZES.has(portfolioSize)) return { error: 'Choose the approximate number of units you manage.', referenceId: null }

  const rate = await takeRateLimitHit(`consultation:${email}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  }).catch(async () => {
    const recentCount = await prisma.supportRequest.count({
      where: {
        email,
        category: 'sales_consultation',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })
    return recentCount >= 3
      ? { ok: false as const, retryAfterSeconds: 3600 }
      : { ok: true as const, remaining: 3 - recentCount }
  })

  if (!rate.ok) {
    return { error: 'We already received your request. Please give us time to reply before sending another.', referenceId: null }
  }

  const referenceId = consultationReference()
  const message = [
    `Portfolio size: ${portfolioSize}`,
    `Phone: ${phone || 'Not provided'}`,
    `Campaign source: ${source}`,
    'Campaign: AUGUSTFOUNDERS',
    '',
    notes || 'No additional note provided.',
  ].join('\n')

  try {
    await prisma.supportRequest.create({
      data: {
        referenceId,
        principalType: 'public',
        name,
        email,
        organization,
        category: 'sales_consultation',
        message,
        pagePath: `/august?utm_source=${source}`,
      },
    })
  } catch (error) {
    console.error('[CONSULTATION] Request could not be saved:', error)
    return { error: 'We could not save your request just now. Please wait a moment and try again.', referenceId: null }
  }

  const destination = process.env.SALES_EMAIL?.trim() || 'sales@simeonware.com'
  await sendNotification({
    to: destination,
    subject: `[Founding manager ${referenceId}] ${organization}`,
    text: [
      'A visitor requested a 20-minute founding-manager conversation.',
      '',
      `Reference: ${referenceId}`,
      `Name: ${name}`,
      `Reply to: ${email}`,
      `Organization: ${organization}`,
      message,
    ].join('\n'),
  }, { bypassUserPreference: true })

  return { error: null, referenceId }
}
