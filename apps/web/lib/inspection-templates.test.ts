import { describe, expect, it } from 'vitest'
import { decodeInspectionChecklist, parseInspectionChecklist, serializeInspectionChecklist } from '@/lib/inspection-templates'

describe('inspection template checklists', () => {
  it('parses sections, bullets, and inline section labels', () => {
    expect(parseInspectionChecklist('[Safety]\n- Smoke detector\nKitchen | Sink')).toEqual([
      { section: 'Safety', label: 'Smoke detector' },
      { section: 'Kitchen', label: 'Sink' },
    ])
  })

  it('round trips an editable checklist', () => {
    const items = parseInspectionChecklist('[Exterior]\nRailings\nLighting')
    expect(parseInspectionChecklist(serializeInspectionChecklist(items))).toEqual(items)
  })

  it('rejects empty and malformed saved checklists', () => {
    expect(() => parseInspectionChecklist('  ')).toThrow('at least one')
    expect(() => decodeInspectionChecklist('[{"section":"Safety"}]')).toThrow('invalid')
  })
})
