import { execSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_test?schema=public'

async function waitForDatabase(url: string) {
  const parsed = new URL(url)
  const host = parsed.hostname
  const port = Number(parsed.port || 5432)
  const deadline = Date.now() + 15_000

  while (Date.now() < deadline) {
    if (await canConnect(host, port)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `Test database is unavailable at ${host}:${port}. ` +
    'Set TEST_DATABASE_URL or DATABASE_URL to a reachable Postgres instance before running the DB-backed test suite.',
  )
}

function canConnect(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1000 })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => resolve(false))
  })
}

export async function setup() {
  // Push schema to the test Postgres database and reset it before the suite.
  await waitForDatabase(TEST_DB_URL)
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  execSync(`${npx} prisma db push --force-reset --skip-generate`, {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: ROOT,
    stdio: 'pipe',
  })
}

export async function teardown() {
  // Nothing to tear down here - the next run resets the test database again.
}
