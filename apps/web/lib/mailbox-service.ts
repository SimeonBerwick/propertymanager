import { prisma } from '@/lib/prisma'
import { refreshMailboxAccessToken } from '@/lib/mailbox-providers'
import type { MailboxProvider } from '@prisma/client'
import type { NotificationMessage } from '@/lib/notify'

export interface NotificationContext {
  ownerUserId?: string | null
  requestId?: string | null
  transportHint?: 'system' | 'connected-mailbox' | string
  bypassUserPreference?: boolean
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function requestSubject(subject: string, requestId?: string | null) {
  if (!requestId || subject.includes(`[PMR:${requestId}]`)) return subject
  return `${subject} [PMR:${requestId}]`
}

function messageId(ownerUserId?: string | null, requestId?: string | null) {
  const host = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://propertymanager.local').hostname
  return `<pm-${requestId ?? 'general'}-${Date.now()}-${Math.random().toString(36).slice(2)}${ownerUserId ? `-${ownerUserId.slice(-6)}` : ''}@${host}>`
}

function mimeMessage(msg: NotificationMessage, context: NotificationContext, from: string, messageIdHeader: string) {
  const subject = requestSubject(msg.subject, context.requestId ?? msg.requestId)
  const attachments = msg.attachments ?? []
  const headers = [
    `From: ${from}`,
    `To: ${msg.to}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageIdHeader}`,
    context.requestId ?? msg.requestId ? `X-PropertyManager-Request-ID: ${context.requestId ?? msg.requestId}` : '',
    'MIME-Version: 1.0',
  ].filter(Boolean)
  if (!attachments.length) {
    headers.push(msg.html ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8')
    return `${headers.join('\r\n')}\r\n\r\n${msg.html ?? msg.text}`
  }

  const boundary = `pm-boundary-${Date.now()}-${Math.random().toString(36).slice(2)}`
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
  const body = [
    `--${boundary}`,
    msg.html ? 'Content-Type: text/html; charset=UTF-8' : 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    msg.html ?? msg.text,
    ...attachments.flatMap((attachment) => [
      `--${boundary}`,
      `Content-Type: ${attachment.contentType ?? 'text/csv; charset=utf-8'}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(attachment.content, 'utf8').toString('base64'),
    ]),
    `--${boundary}--`,
  ]
  return `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`
}

async function sendGmail(accessToken: string, rawMime: string) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw: base64Url(rawMime) }),
  })
  const json = await response.json() as { id?: string; threadId?: string; error?: { message?: string } }
  if (!response.ok) throw new Error(json.error?.message ?? 'Gmail send failed.')
  return { providerMessageId: json.id, providerThreadId: json.threadId }
}

async function sendOutlook(accessToken: string, msg: NotificationMessage, context: NotificationContext): Promise<{ providerMessageId?: string; providerThreadId?: string }> {
  const subject = requestSubject(msg.subject, context.requestId ?? msg.requestId)
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: msg.html ? 'HTML' : 'Text', content: msg.html ?? msg.text },
        toRecipients: [{ emailAddress: { address: msg.to } }],
        ...(msg.attachments?.length ? {
          attachments: msg.attachments.map((attachment) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.filename,
            contentType: attachment.contentType ?? 'text/csv',
            contentBytes: Buffer.from(attachment.content, 'utf8').toString('base64'),
          })),
        } : {}),
        internetMessageHeaders: [
          ...(context.requestId ?? msg.requestId ? [{ name: 'X-PropertyManager-Request-ID', value: context.requestId ?? msg.requestId }] : []),
        ],
      },
      saveToSentItems: true,
    }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Outlook send failed.')
  }
  return {}
}

export async function sendViaConnectedMailbox(msg: NotificationMessage, context: NotificationContext) {
  if (!context.ownerUserId) return { attempted: false as const }
  const connection = await prisma.mailboxConnection.findFirst({
    where: { userId: context.ownerUserId, status: 'connected' },
    orderBy: { connectedAt: 'desc' },
  })
  if (!connection) return { attempted: false as const }

  const outbound = await prisma.outboundEmail.create({
    data: {
      userId: context.ownerUserId,
      requestId: context.requestId ?? msg.requestId ?? null,
      mailboxConnectionId: connection.id,
      provider: connection.provider,
      transport: `oauth:${connection.provider}`,
      status: 'pending',
      to: msg.to,
      from: connection.email,
      subject: requestSubject(msg.subject, context.requestId ?? msg.requestId),
      messageIdHeader: messageId(context.ownerUserId, context.requestId ?? msg.requestId),
    },
  })

  try {
    const accessToken = await refreshMailboxAccessToken(connection.id)
    if (!accessToken) throw new Error('Mailbox connection needs reconnect.')
    const sent = connection.provider === 'gmail'
      ? await sendGmail(accessToken, mimeMessage(msg, context, connection.email, outbound.messageIdHeader!))
      : await sendOutlook(accessToken, msg, context)
    await prisma.outboundEmail.update({
      where: { id: outbound.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId: sent.providerMessageId,
        providerThreadId: sent.providerThreadId,
      },
    })
    return { attempted: true as const, ok: true as const, provider: connection.provider as MailboxProvider }
  } catch (error) {
    await prisma.outboundEmail.update({
      where: { id: outbound.id },
      data: { status: 'failed', error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000) },
    }).catch(() => null)
    await prisma.mailboxConnection.update({
      where: { id: connection.id },
      data: { status: 'needs_reauth', syncError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000) },
    }).catch(() => null)
    return { attempted: true as const, ok: false as const }
  }
}

export async function logFallbackEmail(msg: NotificationMessage, context: NotificationContext, transport: string, ok: boolean, error?: unknown) {
  await prisma.outboundEmail.create({
    data: {
      userId: context.ownerUserId ?? null,
      requestId: context.requestId ?? msg.requestId ?? null,
      transport,
      status: ok ? 'sent' : 'failed',
      to: msg.to,
      from: process.env.NOTIFY_FROM ?? null,
      subject: requestSubject(msg.subject, context.requestId ?? msg.requestId),
      sentAt: ok ? new Date() : null,
      error: error ? (error instanceof Error ? error.message : String(error)).slice(0, 1000) : null,
    },
  }).catch(() => null)
}

export function providerLabel(provider: MailboxProvider) {
  return provider === 'gmail' ? 'Gmail' : 'Outlook'
}
