import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const PASSWORD_PREFIX = 'scrypt'
const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  if (!password) {
    throw new Error('Password is required')
  }

  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')

  return `${PASSWORD_PREFIX}:${salt}:${hash}`
}

export function verifyPassword(password: string, storedPasswordHash: string): boolean {
  const [prefix, salt, expectedHash] = storedPasswordHash.split(':')

  if (prefix !== PASSWORD_PREFIX || !salt || !expectedHash) {
    return false
  }

  const expected = Buffer.from(expectedHash, 'hex')
  const actual = scryptSync(password, salt, expected.length)

  if (expected.length !== actual.length) {
    return false
  }

  return timingSafeEqual(expected, actual)
}
