import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const STALE_PROCESSING_MS = 5 * 60 * 1000

export function stableOperationKey(...parts: Array<string | number | null | undefined>) {
  return createHash('sha256').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex')
}

export async function beginExternalOperation(input: {
  provider: string
  operationType: string
  operationKey: string
  orgId?: string | null
}) {
  const where = {
    provider_operationType_operationKey: {
      provider: input.provider,
      operationType: input.operationType,
      operationKey: input.operationKey,
    },
  }

  let operation = await prisma.externalOperation.findUnique({ where })
  if (!operation) {
    try {
      operation = await prisma.externalOperation.create({ data: input })
      return { operation, shouldProcess: true, duplicate: false }
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      operation = await prisma.externalOperation.findUniqueOrThrow({ where })
    }
  }

  if (operation.status === 'completed') return { operation, shouldProcess: false, duplicate: true }
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS)
  if (operation.status === 'pending' && operation.updatedAt > staleBefore) {
    return { operation, shouldProcess: false, duplicate: true }
  }

  const claimed = await prisma.externalOperation.updateMany({
    where: {
      id: operation.id,
      updatedAt: operation.updatedAt,
      OR: [{ status: 'failed' }, { status: 'pending', updatedAt: { lte: staleBefore } }],
    },
    data: { status: 'pending', lastError: null, attemptCount: { increment: 1 } },
  })
  if (!claimed.count) return { operation, shouldProcess: false, duplicate: true }
  operation = await prisma.externalOperation.findUniqueOrThrow({ where: { id: operation.id } })
  return { operation, shouldProcess: true, duplicate: false }
}

export async function completeExternalOperation(id: string, details: {
  providerObjectId?: string | null
  resultUrl?: string | null
  expiresAt?: Date | null
} = {}) {
  return prisma.externalOperation.update({
    where: { id },
    data: { ...details, status: 'completed', processedAt: new Date(), lastError: null },
  })
}

export async function failExternalOperation(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return prisma.externalOperation.update({
    where: { id },
    data: { status: 'failed', lastError: message.slice(0, 1000) },
  })
}
