import { describe, expect, test } from 'vitest'
import { deriveVendorNextAction, deriveVendorRequestViewState } from './vendor-request-state'

describe('deriveVendorRequestViewState', () => {
  test('shows schedule only to the awarded or assigned vendor', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: 'vendor-1',
      requestStatus: 'scheduled',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'awarded' },
    })

    expect(result.canSeeSchedule).toBe(true)
    expect(result.statusLabel).toBe('Scheduled with you')
    expect(result.isOpenWork).toBe(true)
  })

  test('suppresses scheduled state when another vendor owns the request', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: 'vendor-2',
      requestStatus: 'scheduled',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'bid_submitted' },
    })

    expect(result.canSeeSchedule).toBe(false)
    expect(result.isOpenWork).toBe(false)
    expect(result.statusLabel).toMatch(/another vendor/i)
    expect(result.heroNotice?.title).toMatch(/another vendor/i)
  })

  test('marks declined vendor work as inactive', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: null,
      requestStatus: 'approved',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'declined' },
    })

    expect(result.canSeeSchedule).toBe(false)
    expect(result.isOpenWork).toBe(false)
    expect(result.statusLabel).toMatch(/declined/i)
  })

  test('shows paid and closed when a closed work order has paid vendor remittance', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: 'vendor-1',
      requestStatus: 'closed',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'awarded' },
      billingDocuments: [{ status: 'paid', totalCents: 12000, paidCents: 12000 }],
    })

    expect(result.canControlDispatch).toBe(false)
    expect(result.isOpenWork).toBe(false)
    expect(result.statusLabel).toBe('Paid and closed')
    expect(result.heroNotice?.title).toBe('Paid and closed')
  })

  test('shows closed unpaid when a closed work order still has vendor balance', () => {
    const result = deriveVendorRequestViewState({
      assignedVendorId: 'vendor-1',
      requestStatus: 'closed',
      viewerVendorId: 'vendor-1',
      latestInvite: { status: 'awarded' },
      billingDocuments: [{ status: 'sent', totalCents: 12000, paidCents: 2000 }],
    })

    expect(result.canControlDispatch).toBe(false)
    expect(result.isOpenWork).toBe(false)
    expect(result.statusLabel).toBe('Closed - payment open')
    expect(result.heroNotice?.detail).toMatch(/payment balance is still open/i)
  })
})

describe('deriveVendorNextAction', () => {
  test('puts tenant appointment messages ahead of generic vendor updates', () => {
    const result = deriveVendorNextAction({
      requestStatus: 'scheduled',
      canControlDispatch: true,
      hasAppointmentTime: true,
      hasTenantAppointmentRequest: true,
    })

    expect(result.key).toBe('review_tenant_message')
    expect(result.href).toBe('#tenant-message')
  })

  test('asks vendor to accept or decline a newly assigned service call', () => {
    const result = deriveVendorNextAction({
      requestStatus: 'vendor_selected',
      canControlDispatch: true,
      needsAppointmentTime: true,
      hasAppointmentTime: false,
    })

    expect(result.key).toBe('accept_service_call')
    expect(result.initialResponse).toBe('accepted')
  })

  test('asks for service charge after the vendor accepts the service call', () => {
    const result = deriveVendorNextAction({
      requestStatus: 'vendor_selected',
      dispatchStatus: 'accepted',
      canControlDispatch: true,
      needsAppointmentTime: true,
      hasAppointmentTime: false,
    })

    expect(result.key).toBe('send_service_charge')
    expect(result.defaultItemType).toBe('service_fee')
  })

  test('asks for appointment after the service charge is approved', () => {
    const result = deriveVendorNextAction({
      requestStatus: 'vendor_selected',
      dispatchStatus: 'accepted',
      canControlDispatch: true,
      needsAppointmentTime: true,
      hasAppointmentTime: false,
      hasApprovedCostOrInvoice: true,
      hasActiveCostOrInvoice: true,
    })

    expect(result.key).toBe('add_appointment')
    expect(result.initialResponse).toBe('scheduled')
  })

  test('waits on manager after a submitted vendor charge', () => {
    const result = deriveVendorNextAction({
      requestStatus: 'scheduled',
      canControlDispatch: true,
      hasAppointmentTime: true,
      hasPendingCostOrInvoice: true,
    })

    expect(result.key).toBe('waiting_manager_cost')
    expect(result.showResponseForm).toBe(false)
  })

  test('asks for final invoice after completed work with no final invoice', () => {
    const result = deriveVendorNextAction({
      requestStatus: 'completed',
      canControlDispatch: true,
      workMarkedComplete: true,
      hasApprovedCostOrInvoice: true,
    })

    expect(result.key).toBe('send_final_invoice')
    expect(result.defaultItemType).toBe('bill_to_property_manager')
  })
})
