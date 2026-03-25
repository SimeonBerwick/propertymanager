import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DB_URL = 'file:./test.db'

export async function setup() {
  // Push schema to test database (creates or resets test.db in apps/web/)
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: ROOT,
    stdio: 'pipe',
  })
}

export async function teardown() {
  // Nothing to tear down — test.db is wiped on next run via --force-reset
}
