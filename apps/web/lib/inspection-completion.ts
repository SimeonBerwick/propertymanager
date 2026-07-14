export type InspectionCompletionItem = {
  id: string
  label: string
  result: string
  note: string | null
  hasPhoto: boolean
}

export type InspectionCompletionIssue = {
  id: string
  label: string
  missing: Array<'result' | 'note' | 'photo'>
}

export function getInspectionCompletionIssues(
  items: InspectionCompletionItem[],
  rules: { requireNoteForIssues: boolean; requirePhotoForIssues: boolean },
) {
  return items.flatMap<InspectionCompletionIssue>((item) => {
    const missing: InspectionCompletionIssue['missing'] = []
    if (item.result === 'pending') missing.push('result')
    if (item.result === 'needs_attention') {
      if (rules.requireNoteForIssues && !item.note) missing.push('note')
      if (rules.requirePhotoForIssues && !item.hasPhoto) missing.push('photo')
    }
    return missing.length ? [{ id: item.id, label: item.label, missing }] : []
  })
}

export function inspectionCompletionError(issues: InspectionCompletionIssue[]) {
  if (issues.length !== 1) {
    return `${issues.length} checklist items still need information. They are marked below. Your other answers and photos were saved.`
  }

  const [issue] = issues
  if (issue.missing.includes('result')) {
    return `Finish "${issue.label}" before completing. Your other answers and photos were saved.`
  }
  const evidence = issue.missing.length === 2 ? 'a note and photo' : issue.missing[0] === 'note' ? 'a note' : 'a photo'
  return `Add ${evidence} for "${issue.label}". Your other answers and photos were saved.`
}
