/**
 * OTP delivery transport.
 *
 * SMS  → Twilio REST API  (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 * EMAIL → Resend API      (RESEND_API_KEY, RESEND_FROM_ADDRESS)
 *
 * Uses native fetch — no additional npm packages required.
 *
 * Production: throws if required env vars are absent (fail loudly, not silently).
 * Development: logs a warning and no-ops if env vars are absent.
 */

import type { TenantOtpChannel } from '@prisma/client';

export async function deliverOtp(
  channel: TenantOtpChannel,
  destination: string,
  code: string,
): Promise<void> {
  if (channel === 'SMS') {
    await sendSms(destination, `Your verification code is: ${code}. It expires in 10 minutes. Do not share this code.`);
  } else {
    await sendEmail(destination, code);
  }
}

async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[otp-transport] SMS env vars not set — skipping delivery (dev mode)');
      return;
    }
    throw new Error(
      'SMS transport not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER',
    );
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(unreadable)');
    throw new Error(`Twilio SMS delivery failed (${res.status}): ${text}`);
  }
}

async function sendEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[otp-transport] RESEND_API_KEY / RESEND_FROM_ADDRESS not set — skipping delivery (dev mode)');
      return;
    }
    throw new Error(
      'Email transport not configured: set RESEND_API_KEY and RESEND_FROM_ADDRESS',
    );
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your verification code',
      text: `Your verification code is: ${code}\n\nIt expires in 10 minutes. Do not share this code.`,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(unreadable)');
    throw new Error(`Resend email delivery failed (${res.status}): ${text}`);
  }
}
