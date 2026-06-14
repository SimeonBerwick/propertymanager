'use server'

import { revalidatePath } from 'next/cache'
import { getLandlordSession } from '@/lib/landlord-session'
import { REQUEST_CATEGORIES, REQUEST_URGENCIES } from '@/lib/maintenance-options'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit-log'
import { validateWorkflowRule } from '@/lib/workflow-rules'

export type WorkflowActionState = { error: string | null; success?: boolean }
const CONDITIONS = ['urgency', 'status', 'category', 'reviewState', 'autoFlag']
const ACTIONS = ['set_sla_bucket', 'set_review_state', 'add_triage_tag']

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function createAutomationRuleAction(_prev: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }
  const name = text(formData, 'name')
  const conditionField = text(formData, 'conditionField')
  const conditionValue = text(formData, 'conditionValue')
  const actionType = text(formData, 'actionType')
  const actionValue = text(formData, 'actionValue')
  if (!name || !conditionValue || !actionValue) return { error: 'Complete every rule field.' }
  if (!CONDITIONS.includes(conditionField) || !ACTIONS.includes(actionType)) return { error: 'Invalid rule configuration.' }
  const validationError = validateWorkflowRule({ conditionField, conditionValue, actionType, actionValue })
  if (validationError) return { error: validationError }

  const rule = await prisma.automationRule.create({ data: { orgId: session.userId, name, conditionField, conditionValue, actionType, actionValue } })
  await prisma.productEvent.create({ data: { orgId: session.userId, eventName: 'automation_rule_created', metadataJson: JSON.stringify({ ruleId: rule.id }) } }).catch(() => null)
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'automationRule', entityId: rule.id, action: 'automationRule.created', summary: `Created automation rule ${name}.` })
  revalidatePath('/workflows')
  return { error: null, success: true }
}

export async function toggleAutomationRuleAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) return
  const id = text(formData, 'id')
  const enabled = text(formData, 'enabled') === 'true'
  await prisma.automationRule.updateMany({ where: { id, orgId: session.userId }, data: { enabled } })
  revalidatePath('/workflows')
}

export async function createRequestTemplateAction(_prev: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  const session = await getLandlordSession()
  if (!session) return { error: 'Not authenticated.' }
  const name = text(formData, 'name')
  const title = text(formData, 'title')
  const description = text(formData, 'description')
  const category = text(formData, 'category')
  const urgency = text(formData, 'urgency')
  if (!name || !title || !description) return { error: 'Name, title, and description are required.' }
  if (!REQUEST_CATEGORIES.includes(category as never) || !REQUEST_URGENCIES.includes(urgency as never)) return { error: 'Choose valid template options.' }

  const template = await prisma.requestTemplate.create({ data: { orgId: session.userId, name, title, description, category, urgency: urgency as 'low' | 'medium' | 'high' | 'urgent' } })
  await prisma.productEvent.create({ data: { orgId: session.userId, eventName: 'request_template_created', metadataJson: JSON.stringify({ templateId: template.id }) } }).catch(() => null)
  await writeAuditLog({ orgId: session.userId, actorUserId: session.userId, entityType: 'requestTemplate', entityId: template.id, action: 'requestTemplate.created', summary: `Created request template ${name}.` })
  revalidatePath('/workflows')
  return { error: null, success: true }
}

export async function deleteWorkflowItemAction(formData: FormData) {
  const session = await getLandlordSession()
  if (!session) return
  const id = text(formData, 'id')
  const kind = text(formData, 'kind')
  if (kind === 'rule') await prisma.automationRule.deleteMany({ where: { id, orgId: session.userId } })
  if (kind === 'template') await prisma.requestTemplate.deleteMany({ where: { id, orgId: session.userId } })
  revalidatePath('/workflows')
}
