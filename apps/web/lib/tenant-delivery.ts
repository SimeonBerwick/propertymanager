import { sendNotification } from '@/lib/notify'

export interface TenantDeliveryAdapter {
  sendOtp(input: { to: string; channel: 'sms' | 'email'; code: string; tenantName: string }): Promise<void>
  sendInviteLink(input: { to: string; channel: 'sms' | 'email'; inviteLink: string; tenantName: string }): Promise<void>
}

class DefaultTenantDeliveryAdapter implements TenantDeliveryAdapter {
  async sendOtp(input: { to: string; channel: 'sms' | 'email'; code: string; tenantName: string }) {
    const subject = input.channel === 'sms' ? 'Your verification code' : 'Your tenant portal verification code'
    const text = [
      `Hi ${input.tenantName},`,
      '',
      `Your verification code is: ${input.code}`,
      '',
      'If you did not request this code, ignore this message.',
    ].join('\n')

    await sendNotification({ to: input.to, subject, text })
  }

  async sendInviteLink(input: { to: string; channel: 'sms' | 'email'; inviteLink: string; tenantName: string }) {
    const subject = input.channel === 'sms' ? 'Your tenant portal invite' : 'Your tenant portal invite link'
    const text = [
      `Hi ${input.tenantName},`,
      '',
      'Use this secure link to access the tenant portal:',
      input.inviteLink,
      '',
      'If you did not expect this invite, ignore this message.',
    ].join('\n')

    await sendNotification({ to: input.to, subject, text })
  }
}

const deliveryAdapter = new DefaultTenantDeliveryAdapter()

export function getTenantDeliveryAdapter(): TenantDeliveryAdapter {
  return deliveryAdapter
}
