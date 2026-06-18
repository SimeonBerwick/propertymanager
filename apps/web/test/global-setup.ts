import { execSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_test?schema=public'

function assertPostgresReachable(databaseUrl: string) {
  const parsed = new URL(databaseUrl)
  const host = parsed.hostname
  const port = Number(parsed.port || 5432)

  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Timed out connecting to ${host}:${port}.`))
    }, 3000)

    socket.once('connect', () => {
      clearTimeout(timeout)
      socket.end()
      resolve()
    })

    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

export async function setup() {
  try {
    await assertPostgresReachable(TEST_DB_URL)
  } catch (error) {
    throw new Error([
      `Vitest DB setup could not reach Postgres for TEST_DATABASE_URL/DATABASE_URL (${TEST_DB_URL}).`,
      'Start a local Postgres test database or set TEST_DATABASE_URL before running npm test.',
      `Original error: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'))
  }

  // Push schema to the test Postgres database and reset it before the suite.
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    cwd: ROOT,
    stdio: 'pipe',
  })
}

export async function teardown() {
  // Nothing to tear down here - the next run resets the test database again.
}
