'use server'

import { revalidatePath } from 'next/cache'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { syncMailboxReplies } from '@/lib/mailbox-sync'

export async function toggleEmailNotificationsAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) return

  const enabled = formData.get('enabled') === 'true'

  await prisma.user.update({
    where: { id: session.userId },
    data: { emailNotificationsEnabled: enabled },
  })

  revalidatePath('/dashboard')
}

export async function disconnectMailboxAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) return
  const mailboxId = String(formData.get('mailboxId') ?? '')
  if (!mailboxId) return
  await prisma.mailboxConnection.updateMany({
    where: { id: mailboxId, userId: session.userId },
    data: { status: 'disconnected', disconnectedAt: new Date() },
  })
  revalidatePath('/dashboard')
}

export async function syncMailboxAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) return
  const mailboxId = String(formData.get('mailboxId') ?? '')
  const mailbox = await prisma.mailboxConnection.findFirst({ where: { id: mailboxId, userId: session.userId }, select: { id: true } })
  if (mailbox) await syncMailboxReplies(mailbox.id)
  revalidatePath('/dashboard')
}
