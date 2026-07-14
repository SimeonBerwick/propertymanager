import { describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import vercelConfig from '../vercel.json'

describe('hosted deployment configuration', () => {
  it('applies committed database migrations before the Vercel build', () => {
    expect(packageJson.scripts['vercel-build']).toBe('prisma migrate deploy && next build')
    expect(vercelConfig.buildCommand).toBe(packageJson.scripts['vercel-build'])
  })
})
