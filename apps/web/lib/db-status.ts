import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * Returns true if the database is reachable.
 * Uses React cache() so this runs at most once per server request render tree.
 * Server actions call this independently per action invocation.
 */
export const isDatabaseAvailable = cache(async (): Promise<boolean> => {
  if (!process.env.DATABASE_URL) return false
  try {
    await prisma.$executeRaw`SELECT 1`
    return true
  } catch {
    return false
  }
})
