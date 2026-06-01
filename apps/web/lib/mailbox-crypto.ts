import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function encryptionKey() {
  const secret = process.env.MAILBOX_TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('MAILBOX_TOKEN_ENCRYPTION_KEY or SESSION_SECRET must be at least 32 characters.')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptMailboxSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptMailboxSecret(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.')
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted mailbox secret.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
