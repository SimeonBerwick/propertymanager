#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const bin = (name) => isWindows ? `${name}.cmd` : name

const env = {
  ...process.env,
  DATABASE_URL: process.env.E2E_DATABASE_URL
    ?? process.env.DATABASE_URL
    ?? 'postgresql://postgres:postgres@127.0.0.1:5432/propertymanager_e2e?schema=public',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'e2e-session-secret-2026-abcdefghijklmnopqrstuvwxyz',
  LANDLORD_EMAIL: process.env.LANDLORD_EMAIL ?? 'landlord@example.com',
  LANDLORD_PASSWORD: process.env.LANDLORD_PASSWORD ?? 'changeme',
  LANDLORD_SLUG: process.env.LANDLORD_SLUG ?? 'landlord',
  APP_URL: process.env.APP_URL ?? 'http://localhost:3005',
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3005',
  NOTIFY_TRANSPORT: process.env.NOTIFY_TRANSPORT ?? 'log',
  SMS_TRANSPORT: process.env.SMS_TRANSPORT ?? 'log',
  ANDROID_REVIEWER_ACCESS_ENABLED: process.env.ANDROID_REVIEWER_ACCESS_ENABLED ?? 'true',
  ANDROID_REVIEWER_LANDLORD_PASSWORD: process.env.ANDROID_REVIEWER_LANDLORD_PASSWORD ?? 'local-reviewer-password-not-for-production',
  ANDROID_REVIEWER_TENANT_EMAIL: process.env.ANDROID_REVIEWER_TENANT_EMAIL ?? 'play-review-tenant@simeonware.com',
  ANDROID_REVIEWER_VENDOR_EMAIL: process.env.ANDROID_REVIEWER_VENDOR_EMAIL ?? 'play-review-vendor@simeonware.com',
  ANDROID_REVIEWER_STAFF_EMAIL: process.env.ANDROID_REVIEWER_STAFF_EMAIL ?? 'play-review-staff@simeonware.com',
  ANDROID_REVIEWER_OTP_CODE: process.env.ANDROID_REVIEWER_OTP_CODE ?? '731946',
  NODE_ENV: 'development',
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    shell: isWindows,
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run(bin('npx'), ['prisma', 'db', 'push', '--force-reset', '--skip-generate'])
run(bin('npm'), ['run', 'prisma:seed'])
run(bin('npm'), ['run', 'seed:android-reviewers'])

const server = spawn(bin('npx'), ['next', 'dev', '-H', '127.0.0.1', '-p', '3005'], {
  cwd: root,
  env,
  shell: isWindows,
  stdio: 'inherit',
})

function stop() {
  if (!server.killed) server.kill()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
