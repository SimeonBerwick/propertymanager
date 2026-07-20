import { prisma } from '@/lib/prisma'
import { refreshMailboxAccessToken } from '@/lib/mailbox-providers'
import type { MailboxConnection } from '@prisma/client'

function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function requestIdFromText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const match = value?.match(/\[PMR:([a-z0-9_-]+)\]/i) ?? value?.match(/X-PropertyManager-Request-ID:\s*([a-z0-9_-]+)/i)
    if (match?.[1]) return match[1]
  }
  return null
}

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((entry) => entry.name?.toLowerCase() === name.toLowerCase())?.value ?? null
}

function decodeBase64Url(value?: string) {
  if (!value) return ''
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function gmailBody(payload: any): { text: string; html: string } {
  const parts = [payload, ...(payload?.parts ?? []), ...((payload?.parts ?? []).flatMap((part: any) => part.parts ?? []))]
  const textPart = parts.find((part: any) => part?.mimeType === 'text/plain')
  const htmlPart = parts.find((part: any) => part?.mimeType === 'text/html')
  const html = decodeBase64Url(htmlPart?.body?.data)
  return { text: decodeBase64Url(textPart?.body?.data) || stripHtml(html), html }
}

async function syncGmail(connection: MailboxConnection, accessToken: string) {
  const after = Math.floor(((connection.lastSyncedAt?.getTime() ?? Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000))
  const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`after:${after} -from:me`)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const listJson = await list.json() as { messages?: Array<{ id: string }> }
  let imported = 0
  for (const item of listJson.messages ?? []) {
    const detail = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (!detail.ok) continue
    const message = await detail.json() as any
    const headers = message.payload?.headers ?? []
    const subject = header(headers, 'Subject') ?? ''
    const from = header(headers, 'From') ?? ''
    const to = header(headers, 'To')
    const messageIdHeader = header(headers, 'Message-ID')
    const inReplyToHeader = header(headers, 'In-Reply-To')
    const { text, html } = gmailBody(message.payload)
    const requestId = requestIdFromText(subject, text, html)
    if (!requestId) continue
    const created = await importInboundReply(connection, {
      providerMessageId: message.id,
      providerThreadId: message.threadId,
      from,
      to,
      subject,
      textBody: text,
      htmlBody: html,
      messageIdHeader,
      inReplyToHeader,
      requestId,
      receivedAt: message.internalDate ? new Date(Number(message.internalDate)) : null,
    })
    if (created) imported += 1
  }
  return imported
}

async function syncOutlook(connection: MailboxConnection, accessToken: string) {
  const since = (connection.lastSyncedAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).toISOString()
  const params = new URLSearchParams({
    $top: '25',
    $orderby: 'receivedDateTime desc',
    $filter: `receivedDateTime ge ${since}`,
  })
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params.toString()}`
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const json = await response.json() as { value?: any[] }
  let imported = 0
  for (const message of json.value ?? []) {
    const subject = message.subject ?? ''
    const text = message.bodyPreview ?? stripHtml(message.body?.content ?? '')
    const requestId = requestIdFromText(subject, text, message.body?.content)
    if (!requestId) continue
    const created = await importInboundReply(connection, {
      providerMessageId: message.id,
      providerThreadId: message.conversationId,
      from: message.from?.emailAddress?.address ?? '',
      to: message.toRecipients?.map((item: any) => item.emailAddress?.address).filter(Boolean).join(', ') ?? null,
      subject,
      textBody: text,
      htmlBody: message.body?.content ?? null,
      messageIdHeader: message.internetMessageId ?? null,
      inReplyToHeader: null,
      requestId,
      receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : null,
    })
    if (created) imported += 1
  }
  return imported
}

async function importInboundReply(connection: MailboxConnection, input: {
  providerMessageId: string
  providerThreadId?: string | null
  from: string
  to?: string | null
  subject: string
  textBody?: string | null
  htmlBody?: string | null
  messageIdHeader?: string | null
  inReplyToHeader?: string | null
  requestId: string
  receivedAt?: Date | null
}) {
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: input.requestId, property: { ownerId: connection.userId } },
    select: { id: true },
  })
  if (!request) return false
  const existing = await prisma.inboundEmail.findUnique({
    where: { provider_providerMessageId: { provider: connection.provider, providerMessageId: input.providerMessageId } },
  })
  if (existing) return false
  const body = input.textBody?.trim() || stripHtml(input.htmlBody ?? '') || '(No reply body)'
  await prisma.$transaction(async (tx) => {
    const comment = await tx.requestComment.create({
      data: {
        requestId: request.id,
        body: `Email reply from ${input.from}:\n\n${body}`.slice(0, 2000),
        visibility: 'external',
      },
    })
    await tx.inboundEmail.create({
      data: {
        userId: connection.userId,
        requestId: request.id,
        mailboxConnectionId: connection.id,
        provider: connection.provider,
        status: 'received',
        from: input.from,
        to: input.to,
        subject: input.subject,
        textBody: input.textBody,
        htmlBody: input.htmlBody,
        providerMessageId: input.providerMessageId,
        providerThreadId: input.providerThreadId,
        messageIdHeader: input.messageIdHeader,
        inReplyToHeader: input.inReplyToHeader,
        receivedAt: input.receivedAt,
        commentId: comment.id,
      },
    })
  })
  return true
}

export async function syncMailboxReplies(connectionId: string) {
  const connection = await prisma.mailboxConnection.findUnique({
    where: { id: connectionId },
    include: { user: { select: { emailNotificationsEnabled: true } } },
  })
  if (!connection || connection.status !== 'connected') return { imported: 0, skipped: true }
  if (connection.user.emailNotificationsEnabled === false) return { imported: 0, skipped: true }
  try {
    const accessToken = await refreshMailboxAccessToken(connection.id)
    if (!accessToken) return { imported: 0, skipped: true }
    const imported = connection.provider === 'gmail'
      ? await syncGmail(connection, accessToken)
      : await syncOutlook(connection, accessToken)
    await prisma.mailboxConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date(), syncError: null } })
    return { imported, skipped: false }
  } catch (error) {
    await prisma.mailboxConnection.update({
      where: { id: connection.id },
      data: { status: 'needs_reauth', syncError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000) },
    }).catch(() => null)
    return { imported: 0, skipped: false, error: true }
  }
}

export async function syncAllMailboxReplies() {
  const connections = await prisma.mailboxConnection.findMany({ where: { status: 'connected', user: { workspaceResetPendingAt: null } } })
  const results = []
  for (const connection of connections) {
    results.push({ connectionId: connection.id, provider: connection.provider, ...(await syncMailboxReplies(connection.id)) })
  }
  return { checked: connections.length, results }
}
