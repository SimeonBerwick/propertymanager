import { sendNotification } from '@/lib/notify'

export interface TenantDeliveryAdapter {
  sendOtp(input: { to: string; code: string; tenantName: string }): Promise<void>
  sendInviteLink(input: { to: string; inviteLink: string; tenantName: string }): Promise<{ delivered: boolean }>
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

  async sendInviteLink(input: { to: string; inviteLink: string; tenantName: string }): Promise<{ delivered: boolean }> {
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
    })
    return { delivered: result.ok }
  }
}

const deliveryAdapter = new DefaultTenantDeliveryAdapter()

export function getTenantDeliveryAdapter(): TenantDeliveryAdapter {
  return deliveryAdapter
}
