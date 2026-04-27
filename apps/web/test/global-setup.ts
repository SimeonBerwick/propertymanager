import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_test?schema=public'

export async function setup() {
  // Push schema to the test Postgres database and reset it before the suite.
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: ROOT,
    stdio: 'pipe',
  })
}

export async function teardown() {
  // Nothing to tear down here — the next run resets the test database again.
}
