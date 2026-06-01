import { describe, expect, test } from 'vitest'
import { buildNewRequestMessages } from '@/lib/notify'

describe('notification email markup', () => {
  test('renders Outlook and Gmail Android friendly table markup with a plain text fallback', () => {
    const [tenantMessage] = buildNewRequestMessages({
      requestId: 'req-123',
      title: 'Leaky sink',
      propertyName: 'Palm Court',
      unitLabel: '2A',
      tenantName: 'Maya',
      tenantEmail: 'maya@example.com',
      landlordEmail: 'landlord@example.com',
      urgency: 'medium',
      category: 'Plumbing',
      description: 'Sink is leaking under the cabinet.',
      preferredCurrency: 'usd',
      preferredLanguage: 'english',
    })

    expect(tenantMessage.text).toContain('Reference ID : req-123')
    expect(tenantMessage.html).toContain('role="presentation"')
    expect(tenantMessage.html).toContain('mso-table-lspace:0pt')
    expect(tenantMessage.html).toContain('bgcolor="#1a56db"')
    expect(tenantMessage.html).toContain('width="100%"')
    expect(tenantMessage.html).toContain('max-width:600px')
    expect(tenantMessage.html).toContain('overflow-wrap:break-word')
    expect(tenantMessage.html).not.toMatch(/border-radius|white-space:pre-wrap/)
  })
})
