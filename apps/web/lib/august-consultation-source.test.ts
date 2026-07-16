import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('August conversation request', () => {
  test('keeps visitors in the browser instead of opening a mail app', () => {
    const page = source('app/august/page.tsx')

    expect(page).toContain("const consultationHref = '#conversation'")
    expect(page).toContain('<ConsultationForm source={source} />')
    expect(page).not.toContain('mailto:')
  })

  test('saves the lead before sending the alert and records conversion', () => {
    const action = source('app/august/actions.ts')
    const analytics = source('app/api/analytics/route.ts')
    const savePosition = action.indexOf('await prisma.supportRequest.create')
    const notifyPosition = action.indexOf('await sendNotification')

    expect(savePosition).toBeGreaterThan(-1)
    expect(notifyPosition).toBeGreaterThan(savePosition)
    expect(action).toContain("category: 'sales_consultation'")
    expect(action).toContain('takeRateLimitHit')
    expect(action).toContain('replyTo: email')
    expect(analytics).toContain("'campaign_consultation_submitted'")
  })
})
