'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireOperatorSession } from '@/lib/auth';
import {
  buildVendorPreferredVendorCleanup,
  isVendorEligibleForPreferredSelection,
  parseVendorImportCsv,
  parseVendorSkillTags,
} from '@/lib/vendor-management';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getBoolean(formData: FormData, key: string, defaultValue = false) {
  const value = formData.get(key);
  if (value === null) return defaultValue;
  return value === 'on';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'A vendor with that unique email already exists.';
  }
  if (error instanceof Error) return error.message;
  return 'Unable to save vendor changes.';
}

function vendorRedirect(error?: string) {
  return `/operator/vendors${error ? `?error=${encodeURIComponent(error)}` : ''}`;
}

function revalidateVendorPaths() {
  revalidatePath('/operator/vendors');
  revalidatePath('/operator/regions');
  revalidatePath('/operator/requests');
}

type VendorSkillTagTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function upsertSkillTags(tx: VendorSkillTagTx, organizationId: string, rawSkillTags: string[]) {
  const normalized = rawSkillTags
    .flatMap((value) => parseVendorSkillTags(value))
    .filter((value, index, array) => array.findIndex((candidate) => candidate.slug === value.slug) === index);

  if (normalized.length === 0) return [] as Array<{ id: string; slug: string; label: string }>;

  for (const tag of normalized) {
    await tx.vendorSkillTag.upsert({
      where: { organizationId_slug: { organizationId, slug: tag.slug } },
      update: { label: tag.label },
      create: { organizationId, slug: tag.slug, label: tag.label },
    });
  }

  return tx.vendorSkillTag.findMany({
    where: { organizationId, slug: { in: normalized.map((tag) => tag.slug) } },
    select: { id: true, slug: true, label: true },
  });
}

export async function createVendor(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const name = getString(formData, 'name');
    const trade = getString(formData, 'trade');
    if (!name) throw new Error('Vendor name is required.');
    if (!trade) throw new Error('Vendor trade is required.');

    const selectedRegionIds = formData.getAll('regionIds').filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    const preferredRegionIds = new Set(
      formData.getAll('preferredRegionIds').filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    );
    const skillTags = parseVendorSkillTags(getString(formData, 'skillTags'));

    const allowedRegions = await prisma.region.findMany({
      where: { organizationId: session.organizationId, id: { in: selectedRegionIds } },
      select: { id: true },
    });
    if (allowedRegions.length !== selectedRegionIds.length) {
      throw new Error('One or more selected service areas are invalid for this organization.');
    }

    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          organizationId: session.organizationId,
          name,
          trade,
          email: getOptionalString(formData, 'email')?.toLowerCase() ?? null,
          phone: getOptionalString(formData, 'phone'),
          notes: getOptionalString(formData, 'notes'),
          isActive: getBoolean(formData, 'isActive', true),
          isAvailable: getBoolean(formData, 'isAvailable', true),
          serviceAreaAssignments: selectedRegionIds.length
            ? { create: selectedRegionIds.map((regionId) => ({ regionId })) }
            : undefined,
        },
      });

      const tags = await upsertSkillTags(tx, session.organizationId, skillTags.map((tag) => tag.label));
      if (tags.length > 0) {
        await tx.vendorSkillAssignment.createMany({
          data: tags.map((tag) => ({ vendorId: created.id, skillTagId: tag.id })),
        });
      }

      return created;
    });

    if (isVendorEligibleForPreferredSelection(vendor) && preferredRegionIds.size > 0) {
      await prisma.region.updateMany({
        where: { organizationId: session.organizationId, id: { in: [...preferredRegionIds] } },
        data: { preferredVendorId: vendor.id },
      });
    }

    revalidateVendorPaths();
    redirect('/operator/vendors?created=1');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(vendorRedirect(getErrorMessage(error)) as any);
  }
}

export async function importVendors(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const csv = getString(formData, 'csv');
    const rows = parseVendorImportCsv(csv);
    const organizationRegions = await prisma.region.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
    });
    const regionByName = new Map(organizationRegions.map((region) => [region.name.toLowerCase(), region]));

    for (const row of rows) {
      await prisma.$transaction(async (tx) => {
        const vendor = await tx.vendor.upsert({
          where: { email: row.email ?? `missing-email-${row.name}-${row.trade}-${session.organizationId}` },
          update: {
            name: row.name,
            trade: row.trade,
            phone: row.phone,
            notes: row.notes,
            isActive: row.isActive,
            isAvailable: row.isAvailable,
            deletedAt: row.isActive ? null : undefined,
          },
          create: {
            organizationId: session.organizationId,
            name: row.name,
            trade: row.trade,
            email: row.email,
            phone: row.phone,
            notes: row.notes,
            isActive: row.isActive,
            isAvailable: row.isAvailable,
          },
        }).catch(async (error) => {
          if (row.email) throw error;
          return tx.vendor.create({
            data: {
              organizationId: session.organizationId,
              name: row.name,
              trade: row.trade,
              email: null,
              phone: row.phone,
              notes: row.notes,
              isActive: row.isActive,
              isAvailable: row.isAvailable,
            },
          });
        });

        await tx.vendorRegionAssignment.deleteMany({ where: { vendorId: vendor.id } });
        await tx.vendorSkillAssignment.deleteMany({ where: { vendorId: vendor.id } });
        const regionIds = row.serviceAreaNames.map((name) => {
          const region = regionByName.get(name.toLowerCase());
          if (!region) {
            throw new Error(`Unknown service area in import: ${name}`);
          }
          return region.id;
        });
        const skillTags = await upsertSkillTags(tx, session.organizationId, row.skillTags);
        if (regionIds.length > 0) {
          await tx.vendorRegionAssignment.createMany({ data: regionIds.map((regionId) => ({ vendorId: vendor.id, regionId })) });
        }
        if (skillTags.length > 0) {
          await tx.vendorSkillAssignment.createMany({ data: skillTags.map((tag) => ({ vendorId: vendor.id, skillTagId: tag.id })) });
        }
      });
    }

    await prisma.region.updateMany(buildVendorPreferredVendorCleanup(organizationRegions.map((region) => region.id)));
    revalidateVendorPaths();
    redirect(`/operator/vendors?imported=${rows.length}` as any);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(vendorRedirect(getErrorMessage(error)) as any);
  }
}

export async function updateVendorStatus(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const vendorId = getString(formData, 'vendorId');
    if (!vendorId) throw new Error('Vendor is required.');

    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, organizationId: session.organizationId } });
    if (!vendor) throw new Error('Vendor not found in your organization.');

    const isDeleted = getBoolean(formData, 'isDeleted');
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        isActive: getBoolean(formData, 'isActive', vendor.isActive) && !isDeleted,
        isAvailable: getBoolean(formData, 'isAvailable', vendor.isAvailable) && !isDeleted,
        deletedAt: isDeleted ? vendor.deletedAt ?? new Date() : null,
      },
    });

    const regionIds = (await prisma.region.findMany({
      where: { organizationId: session.organizationId, OR: [{ preferredVendorId: vendor.id }, { vendorAssignments: { some: { vendorId: vendor.id } } }] },
      select: { id: true },
    })).map((region) => region.id);

    if (regionIds.length > 0) {
      await prisma.region.updateMany(buildVendorPreferredVendorCleanup(regionIds));
    }

    revalidateVendorPaths();
    redirect('/operator/vendors?updated=1');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(vendorRedirect(getErrorMessage(error)) as any);
  }
}

export async function saveVendorAssignments(formData: FormData) {
  try {
    const session = await requireOperatorSession();
    const vendorId = getString(formData, 'vendorId');
    if (!vendorId) throw new Error('Vendor is required.');

    const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, organizationId: session.organizationId } });
    if (!vendor) throw new Error('Vendor not found in your organization.');

    const selectedRegionIds = formData.getAll('regionIds').filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    const preferredRegionIds = new Set(
      formData.getAll('preferredRegionIds').filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    );
    const skillTags = parseVendorSkillTags(getString(formData, 'skillTags'));

    const allowedRegions = await prisma.region.findMany({
      where: { organizationId: session.organizationId, id: { in: selectedRegionIds } },
      select: { id: true },
    });
    if (allowedRegions.length !== selectedRegionIds.length) {
      throw new Error('One or more selected service areas are invalid for this organization.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.vendorRegionAssignment.deleteMany({ where: { vendorId: vendor.id } });
      if (selectedRegionIds.length > 0) {
        await tx.vendorRegionAssignment.createMany({ data: selectedRegionIds.map((regionId) => ({ vendorId: vendor.id, regionId })) });
      }

      await tx.vendorSkillAssignment.deleteMany({ where: { vendorId: vendor.id } });
      const tags = await upsertSkillTags(tx, session.organizationId, skillTags.map((tag) => tag.label));
      if (tags.length > 0) {
        await tx.vendorSkillAssignment.createMany({ data: tags.map((tag) => ({ vendorId: vendor.id, skillTagId: tag.id })) });
      }

      const currentPreferredRegions = await tx.region.findMany({
        where: { organizationId: session.organizationId, preferredVendorId: vendor.id },
        select: { id: true },
      });
      const idsToClear = currentPreferredRegions
        .map((region) => region.id)
        .filter((regionId) => !preferredRegionIds.has(regionId));
      if (idsToClear.length > 0) {
        await tx.region.updateMany({ where: { id: { in: idsToClear } }, data: { preferredVendorId: null } });
      }

      if (preferredRegionIds.size > 0) {
        if (!isVendorEligibleForPreferredSelection(vendor)) {
          throw new Error('Only active, available, non-deleted vendors can be saved as preferred.');
        }
        const preferredIds = [...preferredRegionIds].filter((regionId) => selectedRegionIds.includes(regionId));
        if (preferredIds.length !== preferredRegionIds.size) {
          throw new Error('Preferred vendor regions must also be assigned service areas for that vendor.');
        }
        await tx.region.updateMany({
          where: { organizationId: session.organizationId, id: { in: preferredIds } },
          data: { preferredVendorId: vendor.id },
        });
      }
    });

    revalidateVendorPaths();
    redirect('/operator/vendors?assignmentsSaved=1');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    redirect(vendorRedirect(getErrorMessage(error)) as any);
  }
}
