import { describe, expect, it } from 'vitest'
import { renderInspectionReportHtml } from '@/lib/inspection-report'

const inspection = {
  id: 'inspection-1', reportTitle: 'Routine report', title: '<Unit 2>', inspectionType: 'routine', status: 'completed',
  dueAt: new Date('2026-07-10T12:00:00Z'), completedAt: new Date('2026-07-09T12:00:00Z'), includePhotosInReport: true,
  unit: { label: '2A', property: { name: 'Elm Court', address: '12 Main St' } },
  items: [{ id: 'item-1', section: 'Safety', label: 'Smoke detector', result: 'needs_attention', note: '<replace>', photoUrl: 'uploads/requests/photo.jpg' }],
}

describe('inspection report', () => {
  it('renders findings and private evidence without trusting user HTML', () => {
    const html = renderInspectionReportHtml(inspection)
    expect(html).toContain('Smoke detector')
    expect(html).toContain('/api/inspections/media/item-1')
    expect(html).toContain('&lt;replace&gt;')
    expect(html).not.toContain('<replace>')
    expect(html).toContain('&lt;Unit 2&gt;')
  })

  it('omits evidence images when the saved preference disables them', () => {
    expect(renderInspectionReportHtml({ ...inspection, includePhotosInReport: false })).not.toContain('/api/inspections/media/item-1')
  })
})
