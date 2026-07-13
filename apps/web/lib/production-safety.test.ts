import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

function workflow(name: string) {
  return readFileSync(resolve(process.cwd(), '..', '..', '.github', 'workflows', name), 'utf8')
}

describe('production recovery workflows', () => {
  test('checks production health independently and alerts on failure', () => {
    const source = workflow('property-manager-production-health.yml')
    expect(source).toContain("cron: '7,22,37,52 * * * *'")
    expect(source).toContain('$base_url/api/health')
    expect(source).toContain('payload?.database !== true')
    expect(source).toContain('PM_HEALTH_RESEND_API_KEY')
  })

  test('encrypts database archives and preserves media without copying deletions', () => {
    const source = workflow('property-manager-production-backup.yml')
    expect(source).toContain('pg_dump')
    expect(source).toContain('--symmetric --cipher-algo AES256')
    expect(source).toContain('s3api head-object')
    expect(source).toContain('media-preserved')
    expect(source).not.toContain('aws s3 sync "s3://$MEDIA_BUCKET" "s3://$BACKUP_BUCKET/media-preserved" \\\n+            --delete')
  })

  test('restore drill refuses production and verifies core restored records', () => {
    const source = workflow('property-manager-restore-drill.yml')
    expect(source).toContain('RESTORE_TEST_DATABASE_URL points to the production database')
    expect(source).toContain('target database name must contain restore, drill, or test')
    expect(source).toContain('pg_restore --clean --if-exists')
    expect(source).toContain('SELECT COUNT(*) AS users FROM "User"')
    expect(source).toContain('SELECT COUNT(*) AS requests FROM "MaintenanceRequest"')
  })
})
