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
  vendors as seedVendors,
} from '../lib/seed-data'
import { getLandlordEmail, getLandlordSlug, getDevFallbackPassword, assertProductionAuthEnv } from '../lib/auth-config'
import { hashPassword } from '../lib/password'

const prisma = new PrismaClient()

async function main() {
  assertProductionAuthEnv()

  const landlordEmail = getLandlordEmail()
  const landlordPasswordHash = hashPassword(getDevFallbackPassword())
  const landlordSlug = getLandlordSlug()

  const landlord = await prisma.user.upsert({
    where: { email: landlordEmail },
    update: {
      role: 'landlord',
      passwordHash: landlordPasswordHash,
      slug: landlordSlug,
    },
    create: {
      email: landlordEmail,
      role: 'landlord',
      passwordHash: landlordPasswordHash,
      slug: landlordSlug,
    },
  })

  for (const prop of seedProperties) {
    await prisma.property.upsert({
      where: { id: prop.id },
      update: {
        name: prop.name,
        address: prop.address,
        ownerId: landlord.id,
      },
      create: { id: prop.id, name: prop.name, address: prop.address, ownerId: landlord.id },
    })
  }

  for (const unit of seedUnits) {
    await prisma.unit.upsert({
      where: { id: unit.id },
      update: {
        propertyId: unit.propertyId,
        label: unit.label,
        tenantName: unit.tenantName,
        tenantEmail: unit.tenantEmail,
      },
      create: {
        id: unit.id,
        propertyId: unit.propertyId,
        label: unit.label,
        tenantName: unit.tenantName,
        tenantEmail: unit.tenantEmail,
      },
    })
  }

  for (const vendor of seedVendors) {
    await prisma.vendor.upsert({
      where: { id: vendor.id },
      update: {
        orgId: landlord.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        categoriesCsv: vendor.categories.join(','),
        supportedLanguagesCsv: vendor.supportedLanguages.join(','),
        supportedCurrenciesCsv: vendor.supportedCurrencies.join(','),
        isActive: vendor.isActive,
      },
      create: {
        id: vendor.id,
        orgId: landlord.id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        categoriesCsv: vendor.categories.join(','),
        supportedLanguagesCsv: vendor.supportedLanguages.join(','),
        supportedCurrenciesCsv: vendor.supportedCurrencies.join(','),
        isActive: vendor.isActive,
      },
    })
  }

  for (const req of seedRequests) {
    const unit = seedUnits.find((candidate) => candidate.id === req.unitId)
    const triageTags = [
      ...(req.preferredLanguage !== 'english' ? [`language:${req.preferredLanguage}`] : []),
      ...(req.preferredCurrency !== 'usd' ? [`currency:${req.preferredCurrency}`] : []),
    ]
    const triageTagsCsv = triageTags.join(',')
    const slaBucket = 'standard'

    await prisma.maintenanceRequest.upsert({
      where: { id: req.id },
      update: {
        propertyId: req.propertyId,
        unitId: req.unitId,
        submittedByName: req.submittedByName ?? unit?.tenantName,
        submittedByEmail: req.submittedByEmail ?? unit?.tenantEmail,
        preferredCurrency: req.preferredCurrency,
        preferredLanguage: req.preferredLanguage,
        slaBucket,
        triageTagsCsv,
        title: req.title,
        description: req.description,
        category: req.category,
        urgency: req.urgency as 'low' | 'medium' | 'high' | 'urgent',
        status: req.status as 'new' | 'scheduled' | 'in_progress' | 'done',
        assignedVendorName: req.assignedVendorName,
        assignedVendorEmail: req.assignedVendorEmail,
        assignedVendorPhone: req.assignedVendorPhone,
        createdAt: new Date(req.createdAt),
      },
      create: {
        id: req.id,
        propertyId: req.propertyId,
        unitId: req.unitId,
        submittedByName: req.submittedByName ?? unit?.tenantName,
        submittedByEmail: req.submittedByEmail ?? unit?.tenantEmail,
        preferredCurrency: req.preferredCurrency,
        preferredLanguage: req.preferredLanguage,
        slaBucket,
        triageTagsCsv,
        title: req.title,
        description: req.description,
        category: req.category,
        urgency: req.urgency as 'low' | 'medium' | 'high' | 'urgent',
        status: req.status as 'new' | 'scheduled' | 'in_progress' | 'done',
        assignedVendorName: req.assignedVendorName,
        assignedVendorEmail: req.assignedVendorEmail,
        assignedVendorPhone: req.assignedVendorPhone,
        createdAt: new Date(req.createdAt),
      },
    })
  }

  for (const comment of seedComments) {
    const authorUserId = comment.authorName === 'Elon PM Ops' ? landlord.id : null

    await prisma.requestComment.upsert({
      where: { id: comment.id },
      update: {
        requestId: comment.requestId,
        body: comment.body,
        visibility: comment.visibility,
        authorUserId,
        createdAt: new Date(comment.createdAt),
      },
      create: {
        id: comment.id,
        requestId: comment.requestId,
        body: comment.body,
        visibility: comment.visibility,
        authorUserId,
        createdAt: new Date(comment.createdAt),
      },
    })
  }

  for (const event of seedEvents) {
    const actorUserId = event.actorName === 'System' ? null : landlord.id

    await prisma.statusEvent.upsert({
      where: { id: event.id },
      update: {
        requestId: event.requestId,
        fromStatus: event.fromStatus as 'new' | 'scheduled' | 'in_progress' | 'done' | undefined,
        toStatus: event.toStatus as 'new' | 'scheduled' | 'in_progress' | 'done',
        actorUserId,
        createdAt: new Date(event.createdAt),
      },
      create: {
        id: event.id,
        requestId: event.requestId,
        fromStatus: event.fromStatus as 'new' | 'scheduled' | 'in_progress' | 'done' | undefined,
        toStatus: event.toStatus as 'new' | 'scheduled' | 'in_progress' | 'done',
        actorUserId,
        createdAt: new Date(event.createdAt),
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
