'use server'

import { revalidatePath } from 'next/cache'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'

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
