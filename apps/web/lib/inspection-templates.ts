import { prisma } from '@/lib/prisma'

export type InspectionChecklistItem = { section: string; label: string }

const DEFAULT_SECTION = 'General'

export function parseInspectionChecklist(text: string): InspectionChecklistItem[] {
  const items: InspectionChecklistItem[] = []
  let section = DEFAULT_SECTION

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const heading = line.match(/^\[(.+)]$/)
    if (heading) {
      section = heading[1].trim() || DEFAULT_SECTION
      continue
    }
    const separator = line.indexOf('|')
    const itemSection = separator >= 0 ? line.slice(0, separator).trim() : section
    const label = separator >= 0 ? line.slice(separator + 1).trim() : line.replace(/^[-*]\s*/, '')
    if (label) items.push({ section: itemSection || DEFAULT_SECTION, label })
  }

  if (!items.length) throw new Error('Add at least one checklist item.')
  if (items.length > 200) throw new Error('A template can contain up to 200 checklist items.')
  return items
}

export function serializeInspectionChecklist(items: InspectionChecklistItem[]) {
  let current = ''
  const lines: string[] = []
  for (const item of items) {
    if (item.section !== current) {
      if (lines.length) lines.push('')
      lines.push(`[${item.section}]`)
      current = item.section
    }
    lines.push(item.label)
  }
  return lines.join('\n')
}

export function decodeInspectionChecklist(json: string): InspectionChecklistItem[] {
  const value = JSON.parse(json) as unknown
  if (!Array.isArray(value)) throw new Error('The saved checklist is invalid.')
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('The saved checklist is invalid.')
    const row = item as Record<string, unknown>
    if (typeof row.section !== 'string' || typeof row.label !== 'string' || !row.label.trim()) {
      throw new Error('The saved checklist is invalid.')
    }
    return { section: row.section.trim() || DEFAULT_SECTION, label: row.label.trim() }
  })
}

export const DEFAULT_INSPECTION_TEMPLATES = [
  { name: 'Move-in inspection', inspectionType: 'move_in', checklist: `[Entry and safety]\nDoors, locks, and keys\nSmoke and carbon monoxide detectors\nWindows and screens\n\n[Kitchen]\nAppliances\nCabinets and counters\nSink and plumbing\n\n[Living areas]\nWalls, floors, and ceilings\nLights and outlets\n\n[Bathroom]\nFixtures and plumbing\nVentilation\n\n[Exterior]\nExterior condition and assigned areas` },
  { name: 'Move-out inspection', inspectionType: 'move_out', checklist: `[Condition]\nWalls, floors, and ceilings\nDoors, windows, and keys\n\n[Kitchen]\nAppliances\nCabinets, counters, and sink\n\n[Bathroom]\nFixtures, plumbing, and cleanliness\n\n[Closeout]\nPersonal property removed\nDamage beyond normal wear\nFinal meter or access notes` },
  { name: 'Routine inspection', inspectionType: 'routine', checklist: `[Safety]\nSmoke and carbon monoxide detectors\nClear exits and working locks\n\n[Systems]\nVisible plumbing leaks\nHeating and cooling operation\nElectrical concerns\n\n[Condition]\nInterior condition\nExterior or common-area condition\nPest or moisture concerns` },
  { name: 'Safety inspection', inspectionType: 'safety', checklist: `[Life safety]\nSmoke detectors\nCarbon monoxide detectors\nFire extinguisher\nClear exits\n\n[Building safety]\nLocks, railings, and trip hazards\nElectrical hazards\nWater leaks or mold indicators\nEmergency lighting and signage` },
] as const

export async function ensureDefaultInspectionTemplates(orgId: string) {
  const count = await prisma.inspectionTemplate.count({ where: { orgId } })
  if (count) return
  await prisma.inspectionTemplate.createMany({
    data: DEFAULT_INSPECTION_TEMPLATES.map((template) => ({
      orgId,
      name: template.name,
      inspectionType: template.inspectionType,
      checklistJson: JSON.stringify(parseInspectionChecklist(template.checklist)),
    })),
  })
}
