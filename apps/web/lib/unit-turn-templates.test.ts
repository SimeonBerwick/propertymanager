import { describe, expect, it } from 'vitest'
import { daysBetween, parseUnitTurnTasks, serializeUnitTurnTasks, turnReadyError, turnTaskCompletionError } from '@/lib/unit-turn-templates'

describe('unit turn templates', () => {
  it('parses task duration and assignment defaults', () => {
    expect(parseUnitTurnTasks('Patch walls | 2 | vendor\nFinal check')).toEqual([
      { title: 'Patch walls', expectedDays: 2, assignedType: 'vendor' },
      { title: 'Final check', expectedDays: 1, assignedType: 'manager' },
    ])
  })
  it('round trips editable preferences', () => {
    const tasks = parseUnitTurnTasks('Clean | 1 | vendor')
    expect(parseUnitTurnTasks(serializeUnitTurnTasks(tasks))).toEqual(tasks)
  })
  it('calculates whole vacancy days without negative values', () => {
    expect(daysBetween(new Date('2026-07-01'), new Date('2026-07-03'))).toBe(2)
    expect(daysBetween(new Date('2026-07-03'), new Date('2026-07-01'))).toBe(0)
  })
  it('enforces saved evidence requirements only on completion', () => {
    expect(turnTaskCompletionError({ status: 'in_progress', note: null, hasPhoto: false, requireNote: true, requirePhoto: true })).toBeNull()
    expect(turnTaskCompletionError({ status: 'completed', note: null, hasPhoto: true, requireNote: true, requirePhoto: true })).toContain('note')
    expect(turnTaskCompletionError({ status: 'completed', note: 'Done', hasPhoto: true, requireNote: true, requirePhoto: true })).toBeNull()
  })
  it('blocks ready approval according to the saved template rule', () => {
    expect(turnReadyError(['completed', 'blocked'], true)).toContain('every')
    expect(turnReadyError(['completed', 'blocked'], false)).toBeNull()
    expect(turnReadyError(['not_started'], false)).toContain('at least one')
  })
})
