import Link from 'next/link'
import { redirect } from 'next/navigation'
import { saveInspectionTemplateAction } from '@/app/inspections/actions'
import { getLandlordSession } from '@/lib/landlord-session'
import { decodeInspectionChecklist, ensureDefaultInspectionTemplates, serializeInspectionChecklist } from '@/lib/inspection-templates'
import { prisma } from '@/lib/prisma'

function TemplateFields({ template }: { template?: { id: string; name: string; inspectionType: string; checklistJson: string; requirePhotoForIssues: boolean; requireNoteForIssues: boolean; includePhotosInReport: boolean; defaultDueDays: number; reportTitle: string } }) {
  return <>
    {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
    <div className="grid cols-2"><label>Template name<input name="name" required defaultValue={template?.name} /></label><label>Type<input name="inspectionType" required defaultValue={template?.inspectionType} placeholder="routine" /></label></div>
    <label>Checklist<textarea name="checklist" rows={12} required defaultValue={template ? serializeInspectionChecklist(decodeInspectionChecklist(template.checklistJson)) : '[General]\nFirst checklist item'} /></label>
    <div className="grid cols-2"><label>Default due days<input name="defaultDueDays" type="number" min="0" max="365" required defaultValue={template?.defaultDueDays ?? 7} /></label><label>Report title<input name="reportTitle" required defaultValue={template?.reportTitle ?? 'Property inspection report'} /></label></div>
    <label className="row"><input type="checkbox" name="requirePhotoForIssues" defaultChecked={template?.requirePhotoForIssues ?? true} /> Require a photo when an item needs attention</label>
    <label className="row"><input type="checkbox" name="requireNoteForIssues" defaultChecked={template?.requireNoteForIssues ?? true} /> Require a note when an item needs attention</label>
    <label className="row"><input type="checkbox" name="includePhotosInReport" defaultChecked={template?.includePhotosInReport ?? true} /> Include evidence photos in reports</label>
    <button type="submit" className="button primary">Save preferences</button>
  </>
}

export default async function InspectionPreferencesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  await ensureDefaultInspectionTemplates(session.userId)
  const [templates, query] = await Promise.all([prisma.inspectionTemplate.findMany({ where: { orgId: session.userId }, orderBy: { name: 'asc' } }), searchParams])
  return <div className="stack"><div><Link href="/inspections">Inspections</Link><h1>Inspection preferences</h1><p className="muted">Saved templates keep future inspections fast while each completed inspection preserves the settings used at the time.</p></div>
    {query.saved ? <div className="notice success">Inspection preferences saved.</div> : null}{query.error ? <div className="notice error">{query.error}</div> : null}
    {templates.map((template) => <details className="card" key={template.id}><summary role="button"><strong>{template.name}</strong> <span className="muted">- {template.inspectionType.replaceAll('_', ' ')}</span></summary><form action={saveInspectionTemplateAction} className="stack" style={{ marginTop: 16 }}><TemplateFields template={template} /></form></details>)}
    <details className="card"><summary role="button"><strong>Add a custom template</strong></summary><form action={saveInspectionTemplateAction} className="stack" style={{ marginTop: 16 }}><TemplateFields /></form></details>
  </div>
}
