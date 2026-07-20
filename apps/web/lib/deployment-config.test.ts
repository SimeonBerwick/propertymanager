import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import vercelConfig from '../vercel.json'

describe('hosted deployment configuration', () => {
  it('applies committed database migrations before the Vercel build', () => {
    expect(packageJson.scripts['vercel-build']).toBe('prisma migrate deploy && next build')
    expect(vercelConfig.buildCommand).toBe(packageJson.scripts['vercel-build'])
  })

  it('processes due account deletions every hour rather than waiting for the daily sweep', () => {
    expect(vercelConfig.crons).toContainEqual({ path: '/api/internal/account-deletions', schedule: '0 * * * *' })
  })

  it('uses the same hourly privacy job for workspace resets', async () => {
    const route = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../app/api/internal/account-deletions/route.ts', import.meta.url), 'utf8'))
    expect(route).toContain('processDueWorkspaceResetRequests')
  })
})
