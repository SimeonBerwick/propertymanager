'use client'

import { useActionState } from 'react'
import type { Vendor } from '@/lib/types'
import { createVendorAction, updateVendorAction, type VendorActionState } from '@/lib/vendor-actions'

const INITIAL_STATE: VendorActionState = { error: null }
const CATEGORY_OPTIONS = ['Plumbing', 'HVAC', 'Exterior', 'Electrical', 'Appliance', 'General']
const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
] as const

function hasValue(values: string[] | undefined, value: string) {
  return values?.includes(value) ?? false
}

export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const action = vendor ? updateVendorAction : createVendorAction
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {vendor ? <input type="hidden" name="vendorId" value={vendor.id} /> : null}
      <input type="hidden" name="supportedCurrencies" value="usd" />
      {state.error ? <div className="notice error">{state.error}</div> : null}

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Vendor name</span>
          <input className="input" name="name" defaultValue={vendor?.name ?? ''} required />
        </label>
        <label className="field">
          <span className="field-label">Active</span>
          <select className="input" name="isActive" defaultValue={vendor?.isActive === false ? 'false' : 'true'}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>
      <div className="muted">Add an email so the vendor can receive invitations, sign-in codes, scheduling messages, and billing updates. Phone is optional.</div>

      <div className="grid cols-2">
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" name="email" defaultValue={vendor?.email ?? ''} />
        </label>
        <label className="field">
          <span className="field-label">Phone</span>
          <input className="input" type="tel" name="phone" defaultValue={vendor?.phone ?? ''} />
        </label>
      </div>

      <fieldset className="card stack">
        <legend style={{ fontWeight: 600 }}>Categories</legend>
        {CATEGORY_OPTIONS.map((category) => (
          <label key={category} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <input type="checkbox" name="categories" value={category} defaultChecked={hasValue(vendor?.categories, category)} />
            <span>{category}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="card stack">
        <legend style={{ fontWeight: 600 }}>Supported languages</legend>
        {LANGUAGE_OPTIONS.map((language) => (
          <label key={language.value} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <input type="checkbox" name="supportedLanguages" value={language.value} defaultChecked={hasValue(vendor?.supportedLanguages, language.value)} />
            <span>{language.label}</span>
          </label>
        ))}
      </fieldset>

      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Saving…' : vendor ? 'Save vendor' : 'Create vendor'}
      </button>
    </form>
  )
}
