import { sendNotification } from '@/lib/notify'

export interface TenantDeliveryAdapter {
  sendOtp(input: { to: string; code: string; tenantName: string }): Promise<void>
  sendManagerAccessCode(input: { to: string; code: string; tenantName: string; expiresAt: Date; accessLink: string; ownerUserId?: string }): Promise<{ delivered: boolean }>
  sendInviteLink(input: { to: string; inviteLink: string; tenantName: string; ownerUserId?: string }): Promise<{ delivered: boolean }>
}

class DefaultTenantDeliveryAdapter implements TenantDeliveryAdapter {
  async sendOtp(input: { to: string; code: string; tenantName: string }) {
    await sendNotification({
      to: input.to,
      subject: 'Your tenant portal verification code',
      text: [
        `Hi ${input.tenantName},`,
        ``,
        `Your verification code is: ${input.code}`,
        ``,
        `If you did not request this code, ignore this message.`,
      ].join('\n'),
    })
  }

  async sendInviteLink(input: { to: string; inviteLink: string; tenantName: string; ownerUserId?: string }): Promise<{ delivered: boolean }> {
    const result = await sendNotification({
      to: input.to,
      subject: 'Your tenant portal invite link',
      text: [
        `Hi ${input.tenantName},`,
        ``,
        `Use this secure link to access the tenant portal:`,
        input.inviteLink,
        ``,
        `If you did not expect this invite, ignore this message.`,
      ].join('\n'),
    }, { ownerUserId: input.ownerUserId })
    return { delivered: result.ok }
  }

  async sendManagerAccessCode(input: { to: string; code: string; tenantName: string; expiresAt: Date; accessLink: string; ownerUserId?: string }) {
    const result = await sendNotification({
      to: input.to,
      subject: 'Your tenant portal sign-in code',
      text: [
        `Hi ${input.tenantName},`,
        '',
        `Your property manager created this one-time tenant portal sign-in code: ${input.code}`,
        `Enter it here: ${input.accessLink}`,
        `It expires ${input.expiresAt.toLocaleString()}.`,
        '',
        'If you did not expect this code, contact your property manager.',
      ].join('\n'),
    }, { ownerUserId: input.ownerUserId })
    return { delivered: result.ok }
  }
}

const deliveryAdapter = new DefaultTenantDeliveryAdapter()

export function getTenantDeliveryAdapter(): TenantDeliveryAdapter {
  return deliveryAdapter
}
