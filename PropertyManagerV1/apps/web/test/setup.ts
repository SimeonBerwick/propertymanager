import { afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

// Wipe all tables between tests so each test starts with a clean state.
// Delete in FK-safe order (children before parents).
afterEach(async () => {
  await prisma.tenantSession.deleteMany()
  await prisma.tenantOtpChallenge.deleteMany()
  await prisma.tenantInvite.deleteMany()
  await prisma.billingEvent.deleteMany()
  await prisma.billingDocument.deleteMany()
  await prisma.maintenancePhoto.deleteMany()
  await prisma.statusEvent.deleteMany()
  await prisma.requestComment.deleteMany()
  await prisma.vendorDispatchLink.deleteMany()
  await prisma.vendorDispatchEvent.deleteMany()
  await prisma.maintenanceRequest.deleteMany()
  await prisma.tenantIdentity.deleteMany()
  await prisma.unit.deleteMany()
  await prisma.property.deleteMany()
  await prisma.user.deleteMany()
})

// Provide a no-op Next.js headers/cookies mock for all test files so modules
// that import `next/headers` or `next/navigation` at module scope don't crash.
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    // Throw a recognizable error so tests can detect and assert on redirects.
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), { digest: `NEXT_REDIRECT:${url}` })
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
