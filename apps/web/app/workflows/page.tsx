import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { AutomationRuleForm, RequestTemplateForm } from './workflow-forms'
import { deleteWorkflowItemAction, toggleAutomationRuleAction } from './actions'

export default async function WorkflowsPage() {
  const session = await getLandlordSession()
  if (!session) redirect('/login')
  const [rules, templates, eventCounts] = await Promise.all([
    prisma.automationRule.findMany({ where: { orgId: session.userId }, orderBy: { createdAt: 'desc' } }),
    prisma.requestTemplate.findMany({ where: { orgId: session.userId }, orderBy: { name: 'asc' } }),
    prisma.productEvent.groupBy({ by: ['eventName'], where: { orgId: session.userId }, _count: { eventName: true } }),
  ])

  return <main className="stack">
    <section className="card stack"><div><div className="kicker">Workflows</div><h1 className="pageTitle">Automations and templates</h1></div><p className="muted">Standardize recurring work and automatically route matching requests.</p></section>
    <section className="grid cols-2">
      <div className="card stack"><h2 className="sectionTitle">New automation rule</h2><AutomationRuleForm /></div>
      <div className="card stack"><h2 className="sectionTitle">New request template</h2><RequestTemplateForm /></div>
    </section>
    <section className="card stack"><div><div className="kicker">Onboarding analytics</div><h2 className="sectionTitle">Product adoption</h2></div><div className="filterChipRow">{eventCounts.length ? eventCounts.map((event) => <span className="filterChip" key={event.eventName}>{event.eventName.replaceAll('_', ' ')}: {event._count.eventName}</span>) : <span className="muted">Events will appear as people use the app.</span>}</div></section>
    <section className="grid cols-2">
      <div className="card stack"><h2 className="sectionTitle">Automation rules</h2>{rules.length ? rules.map((rule) => <div className="workflowRow" key={rule.id}><div><strong>{rule.name}</strong><div className="muted">When {rule.conditionField} = {rule.conditionValue}, {rule.actionType.replaceAll('_', ' ')}: {rule.actionValue}</div><div className="muted">Applied {rule.runCount} times</div></div><div className="row"><form action={toggleAutomationRuleAction}><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="enabled" value={String(!rule.enabled)}/><button className="button">{rule.enabled ? 'Pause' : 'Enable'}</button></form><form action={deleteWorkflowItemAction}><input type="hidden" name="id" value={rule.id}/><input type="hidden" name="kind" value="rule"/><button className="button">Delete</button></form></div></div>) : <div className="emptyState"><strong>No automation rules yet</strong><span>Create one to route matching requests automatically.</span></div>}</div>
      <div className="card stack"><h2 className="sectionTitle">Request templates</h2>{templates.length ? templates.map((template) => <div className="workflowRow" key={template.id}><div><strong>{template.name}</strong><div className="muted">{template.category} - {template.urgency}</div></div><form action={deleteWorkflowItemAction}><input type="hidden" name="id" value={template.id}/><input type="hidden" name="kind" value="template"/><button className="button">Delete</button></form></div>) : <div className="emptyState"><strong>No templates yet</strong><span>Create one for frequently reported maintenance work.</span></div>}</div>
    </section>
  </main>
}
