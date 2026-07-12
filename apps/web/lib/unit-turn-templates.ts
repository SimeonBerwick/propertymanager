import { prisma } from '@/lib/prisma'

export type UnitTurnTemplateTask = { title: string; expectedDays: number; assignedType: 'manager' | 'vendor' }

export function parseUnitTurnTasks(text: string): UnitTurnTemplateTask[] {
  const tasks = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [rawTitle, rawDays, rawAssignee] = line.split('|').map((value) => value.trim())
    const title = rawTitle.replace(/^[-*]\s*/, '')
    const expectedDays = Math.min(90, Math.max(0, Number.parseInt(rawDays || '1', 10) || 0))
    const assignedType = rawAssignee?.toLowerCase() === 'vendor' ? 'vendor' as const : 'manager' as const
    if (!title) throw new Error('Every turn task needs a title.')
    return { title, expectedDays, assignedType }
  })
  if (!tasks.length) throw new Error('Add at least one turn task.')
  if (tasks.length > 100) throw new Error('A turn template can contain up to 100 tasks.')
  return tasks
}

export function decodeUnitTurnTasks(json: string): UnitTurnTemplateTask[] {
  const value = JSON.parse(json) as unknown
  if (!Array.isArray(value)) throw new Error('The saved turn template is invalid.')
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('The saved turn template is invalid.')
    const row = item as Record<string, unknown>
    if (typeof row.title !== 'string' || !row.title.trim() || typeof row.expectedDays !== 'number' || !['manager', 'vendor'].includes(String(row.assignedType))) throw new Error('The saved turn template is invalid.')
    return { title: row.title.trim(), expectedDays: row.expectedDays, assignedType: row.assignedType as 'manager' | 'vendor' }
  })
}

export function serializeUnitTurnTasks(tasks: UnitTurnTemplateTask[]) {
  return tasks.map((task) => `${task.title} | ${task.expectedDays} | ${task.assignedType}`).join('\n')
}

export const DEFAULT_UNIT_TURN_TASKS = `Move-out condition inspection | 1 | manager
Remove abandoned items and trash | 1 | vendor
Complete repairs | 4 | vendor
Paint and patch | 2 | vendor
Deep clean | 1 | vendor
Safety and systems check | 1 | manager
Final readiness inspection | 1 | manager
Photograph ready unit | 0 | manager`

export async function ensureDefaultUnitTurnTemplate(orgId: string) {
  if (await prisma.unitTurnTemplate.count({ where: { orgId } })) return
  await prisma.unitTurnTemplate.create({ data: { orgId, name: 'Standard unit turn', tasksJson: JSON.stringify(parseUnitTurnTasks(DEFAULT_UNIT_TURN_TASKS)) } })
}

export function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
}

export function turnTaskCompletionError(input: { status: string; note: string | null; hasPhoto: boolean; requireNote: boolean; requirePhoto: boolean }) {
  if (input.status !== 'completed') return null
  if (input.requireNote && !input.note) return 'A completion note is required by this turn template.'
  if (input.requirePhoto && !input.hasPhoto) return 'A completion photo is required by this turn template.'
  return null
}

export function turnReadyError(statuses: string[], requireAll: boolean) {
  if (requireAll && statuses.some((status) => status !== 'completed')) return 'Complete every required task before marking the unit ready.'
  if (!statuses.some((status) => status === 'completed')) return 'Complete at least one task before marking the unit ready.'
  return null
}
