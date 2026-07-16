import { describe, expect, test } from 'vitest'
import { buildNewRequestMessages, buildTenantVendorUpdateMessage, notificationReplyTo } from '@/lib/notify'

describe('notification email markup', () => {
  test('routes replies to support unless a message or environment override is provided', () => {
    expect(notificationReplyTo(undefined, undefined)).toBe('support@simeonware.com')
    expect(notificationReplyTo(undefined, ' feedback@simeonware.com ')).toBe('feedback@simeonware.com')
    expect(notificationReplyTo(' manager@example.com ', 'support@simeonware.com')).toBe('manager@example.com')
  })

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
    expect(tenantMessage.html).toContain('Reply to this email')
    expect(tenantMessage.html).not.toMatch(/border-radius|white-space:pre-wrap/)
  })

  test('renders scheduled vendor updates as appointment notices with the time', () => {
    const message = buildTenantVendorUpdateMessage({
      requestId: 'req-456',
      title: 'AC tuneup',
      propertyName: 'Palm Court',
      unitLabel: '2A',
      tenantName: 'Maya',
      tenantEmail: 'maya@example.com',
      vendorName: 'Desert Air',
      dispatchStatus: 'scheduled',
      scheduledStart: '2026-07-03T23:30:00.000Z',
      note: 'Vendor will call on arrival.',
    })

    expect(message.subject).toContain('Maintenance work scheduled')
    expect(message.text).toContain('Your maintenance work has been scheduled.')
    expect(message.text).toContain('Schedule     : Jul 3, 4:30 PM')
    expect(message.text).not.toContain(' to ')
    expect(message.text).toContain('Vendor will call on arrival.')
    expect(message.html).toContain('Your maintenance work has been scheduled.')
  })
})
