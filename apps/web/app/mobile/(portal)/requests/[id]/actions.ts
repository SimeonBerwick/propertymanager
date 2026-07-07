'use server'

import { revalidatePath } from 'next/cache'
import { requireTenantMobileSession } from '@/lib/tenant-mobile-session'
import { prisma } from '@/lib/prisma'
import { buildTenantRequestOwnershipWhere } from '@/lib/tenant-portal-data'
import { sendNotification } from '@/lib/notify'
import { getAppBaseUrl } from '@/lib/runtime-env'

export type TenantRequestActionState = { error: string | null; success?: boolean }

const TENANT_CANCELABLE_STATUSES = ['requested', 'approved', 'vendor_selected', 'scheduled', 'reopened'] as const

export async function cancelTenantMobileRequestAction(
  _prev: TenantRequestActionState,
  formData: FormData,
): Promise<TenantRequestActionState> {
  const session = await requireTenantMobileSession()
  const requestId = String(formData.get('requestId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!reason) return { error: 'Cancel reason is required.' }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildTenantRequestOwnershipWhere(session),
    },
    select: {
      id: true,
      status: true,
      assignedVendorId: true,
    },
  })

  if (!request) return { error: 'Request not found.' }
  if (!TENANT_CANCELABLE_STATUSES.includes(request.status as typeof TENANT_CANCELABLE_STATUSES[number])) {
    return { error: 'This request can no longer be canceled here because work is already underway or finished. Send a message instead.' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: 'canceled',
        cancelReason: reason,
        canceledByType: 'tenant',
        canceledByUserId: null,
        closedAt: new Date(),
        dispatchStatus: request.assignedVendorId ? 'canceled' : undefined,
        reviewState: 'none',
        reviewNote: null,
      },
    })

    await tx.statusEvent.create({
      data: {
        requestId,
        fromStatus: request.status,
        toStatus: 'canceled',
        visibility: 'tenant_visible',
      },
    })

    await tx.requestComment.create({
      data: {
        requestId,
        body: `Tenant canceled request: ${reason}`,
        visibility: 'external',
      },
    })

    if (request.assignedVendorId) {
      await tx.vendorDispatchEvent.create({
        data: {
          requestId,
          vendorId: request.assignedVendorId,
          status: 'canceled',
          note: `Tenant canceled request: ${reason}`,
        },
      })
    }
  })

  revalidatePath(`/mobile/requests/${requestId}`)
  revalidatePath('/mobile')
  revalidatePath(`/requests/${requestId}`)
  revalidatePath('/dashboard')
  return { error: null, success: true }
}

function tenantMessageText(input: {
  requestId: string
  title: string
  propertyName: string
  unitLabel: string
  tenantName: string
  tenantEmail?: string | null
  message: string
  actionUrl: string
}) {
  return [
    'Tenant message on maintenance request',
    '',
    `Reference ID : ${input.requestId}`,
    `Issue        : ${input.title}`,
    `Unit         : ${input.unitLabel} - ${input.propertyName}`,
    `Tenant       : ${input.tenantName}${input.tenantEmail ? ` <${input.tenantEmail}>` : ''}`,
    '',
    'Message:',
    input.message,
    '',
    `Open request: ${input.actionUrl}`,
  ].join('\n')
}

export async function sendTenantWorkOrderMessageAction(
  _prev: TenantRequestActionState,
  formData: FormData,
): Promise<TenantRequestActionState> {
  const session = await requireTenantMobileSession()
  const requestId = String(formData.get('requestId') ?? '')
  const body = String(formData.get('body') ?? '').trim()

  if (!body) return { error: 'Enter your message.' }
  if (body.length > 2000) return { error: 'Message must be 2,000 characters or fewer.' }

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: requestId,
      ...buildTenantRequestOwnershipWhere(session),
    },
    select: {
      id: true,
      status: true,
      title: true,
      submittedByEmail: true,
      submittedByName: true,
      assignedVendorEmail: true,
      property: { select: { name: true, owner: { select: { id: true, email: true } } } },
      unit: { select: { label: true } },
    },
  })

  if (!request) return { error: 'Request not found.' }

  await prisma.$transaction(async (tx) => {
    await tx.requestComment.create({
      data: {
        requestId,
        body: `Tenant message: ${body}`,
        visibility: 'external',
      },
    })

    if (request.status !== 'requested') {
      await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          reviewState: 'needs_follow_up',
          reviewNote: 'Tenant asked a question about this work order.',
        },
      })
    }

  })

  const appUrl = getAppBaseUrl('tenant work order messages')
  const managerActionUrl = request.status === 'requested'
    ? `${appUrl}/requests/${requestId}?comment=tenant#communication`
    : `${appUrl}/requests/${requestId}?comment=tenant#tenant-message-review`
  const tenantName = request.submittedByName ?? session.tenantName
  const tenantEmail = request.submittedByEmail ?? session.email
  const text = tenantMessageText({
    requestId,
    title: request.title,
    propertyName: request.property.name,
    unitLabel: request.unit.label,
    tenantName,
    tenantEmail,
    message: body,
    actionUrl: managerActionUrl,
  })

  await sendNotification({
    to: request.property.owner.email,
    subject: `Tenant message on ${request.title}`,
    text,
    requestId,
    actionUrl: managerActionUrl,
  }, { ownerUserId: request.property.owner.id, requestId })

  if (request.assignedVendorEmail) {
    const vendorActionUrl = `${appUrl}/vendor`
    await sendNotification({
      to: request.assignedVendorEmail,
      subject: `Tenant message on ${request.title}`,
      text: text.replace(managerActionUrl, vendorActionUrl),
      requestId,
      actionUrl: vendorActionUrl,
    }, { ownerUserId: request.property.owner.id, requestId })
  }

  revalidatePath(`/mobile/requests/${requestId}`)
  revalidatePath('/mobile')
  revalidatePath(`/requests/${requestId}`)
  revalidatePath('/dashboard')
  return { error: null, success: true }
}
