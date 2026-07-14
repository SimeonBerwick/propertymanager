import { describe, expect, it } from 'vitest'
import { getInspectionCompletionIssues, inspectionCompletionError } from '@/lib/inspection-completion'

const rules = { requireNoteForIssues: true, requirePhotoForIssues: true }

describe('inspection completion validation', () => {
  it('identifies the exact missing result', () => {
    expect(getInspectionCompletionIssues([
      { id: 'one', label: 'Smoke detector', result: 'pending', note: null, hasPhoto: false },
    ], rules)).toEqual([{ id: 'one', label: 'Smoke detector', missing: ['result'] }])
  })

  it('identifies each missing evidence field on a finding', () => {
    expect(getInspectionCompletionIssues([
      { id: 'one', label: 'Window damage', result: 'needs_attention', note: null, hasPhoto: false },
    ], rules)).toEqual([{ id: 'one', label: 'Window damage', missing: ['note', 'photo'] }])
  })

  it('accepts an uploaded or previously saved photo', () => {
    expect(getInspectionCompletionIssues([
      { id: 'one', label: 'Window damage', result: 'needs_attention', note: 'Cracked pane', hasPhoto: true },
    ], rules)).toEqual([])
  })

  it('honors templates where evidence is optional', () => {
    expect(getInspectionCompletionIssues([
      { id: 'one', label: 'Paint', result: 'needs_attention', note: null, hasPhoto: false },
    ], { requireNoteForIssues: false, requirePhotoForIssues: false })).toEqual([])
  })

  it('explains that valid checklist work was saved', () => {
    expect(inspectionCompletionError([{ id: 'one', label: 'Window damage', missing: ['note'] }]))
      .toBe('Add a note for "Window damage". Your other answers and photos were saved.')
  })
})
