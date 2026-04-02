import { Prisma, type Vendor } from '@prisma/client';

export const MAX_SERVICE_AREAS_PER_ORG = 10;

export type ParsedVendorImportRow = {
  name: string;
  trade: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  serviceAreaNames: string[];
  skillTags: string[];
  isActive: boolean;
  isAvailable: boolean;
};

function normalizeCell(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBooleanCell(value: string, defaultValue: boolean) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes', 'y', 'active', 'available'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'inactive', 'unavailable'].includes(normalized)) return false;
  throw new Error(`Invalid boolean value "${value}". Use true/false, yes/no, or 1/0.`);
}

function splitDelimitedList(value: string) {
  return value
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeVendorSkillTag(value: string) {
  const label = value
    .trim()
    .replace(/\s+/g, ' ');
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  if (!slug) return null;

  return {
    slug,
    label: label
      .split(' ')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
      .join(' '),
  };
}

export function parseVendorSkillTags(raw: string) {
  const tags = splitDelimitedList(raw)
    .map(normalizeVendorSkillTag)
    .filter((value): value is NonNullable<typeof value> => value !== null);

  const deduped = new Map(tags.map((tag) => [tag.slug, tag]));
  return [...deduped.values()];
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function parseVendorImportCsv(csvText: string): ParsedVendorImportRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV import needs a header row and at least one vendor row.');
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  if (!headerIndex.has('name') || !headerIndex.has('trade')) {
    throw new Error('CSV import must include name and trade columns.');
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line);
    const get = (header: string) => values[headerIndex.get(header) ?? -1] ?? '';

    const name = get('name').trim();
    const trade = get('trade').trim();
    if (!name) throw new Error(`Row ${rowIndex + 2}: name is required.`);
    if (!trade) throw new Error(`Row ${rowIndex + 2}: trade is required.`);

    return {
      name,
      trade,
      email: normalizeCell(get('email'))?.toLowerCase() ?? null,
      phone: normalizeCell(get('phone')),
      notes: normalizeCell(get('notes')),
      serviceAreaNames: splitDelimitedList(normalizeCell(get('serviceareas')) ?? normalizeCell(get('service_areas')) ?? normalizeCell(get('areas')) ?? ''),
      skillTags: parseVendorSkillTags(normalizeCell(get('skills')) ?? normalizeCell(get('skilltags')) ?? normalizeCell(get('skill_tags')) ?? '')
        .map((tag) => tag.label),
      isActive: parseBooleanCell(get('isactive') || get('active'), true),
      isAvailable: parseBooleanCell(get('isavailable') || get('available'), true),
    };
  });
}

export function isVendorEligibleForPreferredSelection(vendor: Pick<Vendor, 'isActive' | 'isAvailable' | 'deletedAt'>) {
  return vendor.isActive && vendor.isAvailable && vendor.deletedAt === null;
}

export function getVendorStatusLabel(vendor: Pick<Vendor, 'isActive' | 'isAvailable' | 'deletedAt'>) {
  if (vendor.deletedAt) return 'Deleted';
  if (!vendor.isActive) return 'Inactive';
  if (!vendor.isAvailable) return 'Unavailable';
  return 'Active';
}

export function getPreferredVendorIdOrNull(
  preferredVendorId: string | null | undefined,
  eligibleVendorIds: Iterable<string>,
) {
  if (!preferredVendorId) return null;
  const eligibleSet = new Set(eligibleVendorIds);
  return eligibleSet.has(preferredVendorId) ? preferredVendorId : null;
}

export function buildVendorPreferredVendorCleanup(regionIds: string[]) {
  return {
    where: {
      id: { in: regionIds },
      preferredVendor: {
        OR: [
          { deletedAt: { not: null } },
          { isActive: false },
          { isAvailable: false },
        ],
      },
    },
    data: {
      preferredVendorId: null,
    },
  } satisfies Prisma.RegionUpdateManyArgs;
}
