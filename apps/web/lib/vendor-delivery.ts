import { sendNotification } from '@/lib/notify'

export interface VendorDeliveryAdapter {
  sendOtp(input: { to: string; code: string; vendorName: string }): Promise<void>
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
}

const deliveryAdapter = new DefaultVendorDeliveryAdapter()

export function getVendorDeliveryAdapter(): VendorDeliveryAdapter {
  return deliveryAdapter
}
