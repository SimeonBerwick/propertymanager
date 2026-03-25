import { sendNotification } from '@/lib/notify'
import { sendSms } from '@/lib/sms'

export interface TenantDeliveryAdapter {
  sendOtp(input: { to: string; channel: 'sms' | 'email'; code: string; tenantName: string }): Promise<void>
  sendInviteLink(input: { to: string; channel: 'sms' | 'email'; inviteLink: string; tenantName: string }): Promise<void>
}

class DefaultTenantDeliveryAdapter implements TenantDeliveryAdapter {
  async sendOtp(input: { to: string; channel: 'sms' | 'email'; code: string; tenantName: string }) {
    if (input.channel === 'sms') {
      await sendSms({
        to: input.to,
        body: [
          `Hi ${input.tenantName}, your verification code is: ${input.code}`,
          ``,
          `If you did not request this, ignore this message.`,
        ].join('\n'),
      })
    } else {
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
  }

  async sendInviteLink(input: { to: string; channel: 'sms' | 'email'; inviteLink: string; tenantName: string }) {
    if (input.channel === 'sms') {
      await sendSms({
        to: input.to,
        body: [
          `Hi ${input.tenantName}, use this secure link to access the tenant portal:`,
          input.inviteLink,
          ``,
          `If you did not expect this invite, ignore this message.`,
        ].join('\n'),
      })
    } else {
      await sendNotification({
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
    }
  }
}

const deliveryAdapter = new DefaultTenantDeliveryAdapter()

export function getTenantDeliveryAdapter(): TenantDeliveryAdapter {
  return deliveryAdapter
}
