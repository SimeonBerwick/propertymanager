/**
 * Seed the database from the canonical seed-data used in development fallback.
 * Run: npx tsx prisma/seed.ts   (or: npx prisma db seed)
 * Safe to re-run — all upserts are idempotent.
 */

import { PrismaClient } from '@prisma/client'
import {
  properties as seedProperties,
  units as seedUnits,
  requests as seedRequests,
  requestComments as seedComments,
  statusEvents as seedEvents,
} from '../lib/seed-data'

const prisma = new PrismaClient()

async function main() {
  // One landlord user so Property.ownerId is satisfiable.
  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@example.com' },
    update: {},
    create: { email: 'landlord@example.com', role: 'landlord' },
  })

  for (const prop of seedProperties) {
    await prisma.property.upsert({
      where: { id: prop.id },
      update: {},
      create: { id: prop.id, name: prop.name, address: prop.address, ownerId: landlord.id },
    })
  }

  for (const unit of seedUnits) {
    await prisma.unit.upsert({
      where: { id: unit.id },
      update: {},
      create: {
        id: unit.id,
        propertyId: unit.propertyId,
        label: unit.label,
        tenantName: unit.tenantName,
        tenantEmail: unit.tenantEmail,
      },
    })
  }

  for (const req of seedRequests) {
    await prisma.maintenanceRequest.upsert({
      where: { id: req.id },
      update: {},
      create: {
        id: req.id,
        propertyId: req.propertyId,
        unitId: req.unitId,
        title: req.title,
        description: req.description,
        category: req.category,
        // Prisma enum values match the string union in types.ts
        urgency: req.urgency as 'low' | 'medium' | 'high' | 'urgent',
        status: req.status as 'new' | 'scheduled' | 'in_progress' | 'done',
        assignedVendorName: req.assignedVendorName,
        createdAt: new Date(req.createdAt),
      },
    })
  }

  for (const comment of seedComments) {
    await prisma.requestComment.upsert({
      where: { id: comment.id },
      update: {},
      create: {
        id: comment.id,
        requestId: comment.requestId,
        body: comment.body,
        visibility: comment.visibility,
        createdAt: new Date(comment.createdAt),
        // authorUserId left null — no real user linkage until auth is wired
      },
    })
  }

  for (const event of seedEvents) {
    await prisma.statusEvent.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id,
        requestId: event.requestId,
        fromStatus: event.fromStatus as 'new' | 'scheduled' | 'in_progress' | 'done' | undefined,
        toStatus: event.toStatus as 'new' | 'scheduled' | 'in_progress' | 'done',
        createdAt: new Date(event.createdAt),
        // actorUserId left null — no real user linkage until auth is wired
      },
    })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
