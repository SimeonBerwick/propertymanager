type ReportItem = { section: string; label: string; result: string; note: string | null; photoUrl: string | null; id: string }
type InspectionReportInput = {
  id: string
  reportTitle: string
  title: string
  inspectionType: string
  status: string
  dueAt: Date | null
  completedAt: Date | null
  includePhotosInReport: boolean
  unit: { label: string; property: { name: string; address: string } }
  items: ReportItem[]
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function date(value: Date | null) {
  return value ? value.toLocaleDateString('en-US') : 'Not set'
}

export function renderInspectionReportHtml(inspection: InspectionReportInput) {
  const groups = new Map<string, ReportItem[]>()
  for (const item of inspection.items) groups.set(item.section, [...(groups.get(item.section) ?? []), item])
  const attention = inspection.items.filter((item) => item.result === 'needs_attention').length
  const passed = inspection.items.filter((item) => item.result === 'pass').length
  const sections = [...groups.entries()].map(([section, items]) => `
    <section><h2>${escapeHtml(section)}</h2>${items.map((item) => `
      <article><div><strong>${escapeHtml(item.label)}</strong><span class="result ${escapeHtml(item.result)}">${escapeHtml(item.result.replaceAll('_', ' '))}</span></div>
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      ${inspection.includePhotosInReport && item.photoUrl ? `<img src="/api/inspections/media/${encodeURIComponent(item.id)}" alt="Inspection evidence for ${escapeHtml(item.label)}">` : ''}
      </article>`).join('')}</section>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(inspection.title)}</title><style>
    body{font:14px Arial,sans-serif;color:#17202a;max-width:900px;margin:32px auto;padding:0 24px}h1{margin-bottom:4px}h2{border-bottom:1px solid #ccd2d8;padding-bottom:6px;margin-top:28px}.meta{color:#59636e}.summary{display:flex;gap:24px;margin:20px 0;padding:14px;background:#f4f6f7}.result{float:right;text-transform:capitalize;font-weight:700}.needs_attention{color:#a33}.pass{color:#176b3a}article{padding:12px 0;border-bottom:1px solid #e4e7e9}article p{white-space:pre-wrap}img{display:block;max-width:520px;max-height:360px;margin-top:10px}@media print{body{margin:0}.no-print{display:none}}
  </style></head><body><button class="no-print" onclick="window.print()">Print or save PDF</button><h1>${escapeHtml(inspection.reportTitle)}</h1><h3>${escapeHtml(inspection.title)}</h3>
  <p class="meta">${escapeHtml(inspection.unit.property.name)} - ${escapeHtml(inspection.unit.label)}<br>${escapeHtml(inspection.unit.property.address)}<br>Type: ${escapeHtml(inspection.inspectionType.replaceAll('_', ' '))} | Status: ${escapeHtml(inspection.status)} | Due: ${date(inspection.dueAt)} | Completed: ${date(inspection.completedAt)}</p>
  <div class="summary"><strong>${passed} passed</strong><strong>${attention} need attention</strong><span>${inspection.items.length} total items</span></div>${sections}</body></html>`
}
