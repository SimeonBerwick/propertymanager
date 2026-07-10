import { sendNotification } from '@/lib/notify'
import { formatDateTime } from '@/lib/ui-utils'

export interface VendorDeliveryAdapter {
  sendOtp(input: { to: string; code: string; vendorName: string }): Promise<void>
  sendManagerAccessCode(input: { to: string; code: string; vendorName: string; requestTitle: string; expiresAt: Date; accessLink: string; ownerUserId?: string }): Promise<{ delivered: boolean }>
}

class DefaultVendorDeliveryAdapter implements VendorDeliveryAdapter {
  async sendOtp(input: { to: string; code: string; vendorName: string }) {
    await sendNotification({
      to: input.to,
      subject: 'Your vendor portal verification code',
      text: [
        `Hi ${input.vendorName},`,
        '',
        `Your vendor portal verification code is: ${input.code}`,
        '',
        'If you did not request this code, ignore this message.',
      ].join('\n'),
    })
  }

  async sendManagerAccessCode(input: { to: string; code: string; vendorName: string; requestTitle: string; expiresAt: Date; accessLink: string; ownerUserId?: string }) {
    const result = await sendNotification({
      to: input.to,
      subject: 'Your work-order sign-in code',
      text: [
        `Hi ${input.vendorName},`,
        '',
        `Your property manager created this one-time sign-in code for "${input.requestTitle}": ${input.code}`,
        `Enter it here: ${input.accessLink}`,
        `It expires ${formatDateTime(input.expiresAt)}.`,
        '',
        'This code grants access only to the listed work order.',
      ].join('\n'),
    }, { ownerUserId: input.ownerUserId })
    return { delivered: result.ok }
  }
}

const deliveryAdapter = new DefaultVendorDeliveryAdapter()

export function getVendorDeliveryAdapter(): VendorDeliveryAdapter {
  return deliveryAdapter
}
