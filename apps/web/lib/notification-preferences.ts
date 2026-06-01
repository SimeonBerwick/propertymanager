import { prisma } from '@/lib/prisma'

export async function areEmailNotificationsEnabled(userId?: string | null): Promise<boolean> {
  if (!userId) return true

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailNotificationsEnabled: true },
    })
    return user?.emailNotificationsEnabled ?? true
  } catch {
    return true
  }
}
