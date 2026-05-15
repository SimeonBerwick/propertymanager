import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const startedAt = Date.now()
  const checks = {
    sessionSecretConfigured: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32),
    database: false,
    storageConfigured: Boolean(
      process.env.R2_BUCKET
      && process.env.R2_ACCESS_KEY_ID
      && process.env.R2_SECRET_ACCESS_KEY
      && (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID),
    ),
    automationSecretConfigured: Boolean(process.env.INTERNAL_AUTOMATION_SECRET),
    smokeRouteEnabled: Boolean(process.env.HOSTED_SMOKE_TOKEN),
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    return NextResponse.json({
      ok: false,
      service: 'property-manager-v1-web',
      checks,
      error: error instanceof Error ? error.message : 'Database check failed.',
      durationMs: Date.now() - startedAt,
    }, { status: 503 })
  }

  const ok = checks.sessionSecretConfigured && checks.database && checks.storageConfigured

  return NextResponse.json({
    ok,
    service: 'property-manager-v1-web',
    checks,
    durationMs: Date.now() - startedAt,
  }, { status: ok ? 200 : 503 })
}
