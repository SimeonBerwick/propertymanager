'use client'

import { useActionState } from 'react'
import type { Vendor } from '@/lib/types'
import { createVendorAction, updateVendorAction, type VendorActionState } from '@/lib/vendor-actions'

const INITIAL_STATE: VendorActionState = { error: null }
const CATEGORY_OPTIONS = ['Plumbing', 'HVAC', 'Exterior', 'Electrical', 'Appliance', 'General']
const LANGUAGE_OPTIONS = ['english', 'spanish', 'french']
const CURRENCY_OPTIONS = ['usd', 'peso', 'pound', 'euro']

function hasValue(values: string[] | undefined, value: string) {
  return values?.includes(value) ?? false
}

export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const action = vendor ? updateVendorAction : createVendorAction
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE)

  return (
    <form action={formAction} className="stack">
      {vendor ? <input type="hidden" name="vendorId" value={vendor.id} /> : null}
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
          <label key={language} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <input type="checkbox" name="supportedLanguages" value={language} defaultChecked={hasValue(vendor?.supportedLanguages, language)} />
            <span style={{ textTransform: 'capitalize' }}>{language}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="card stack">
        <legend style={{ fontWeight: 600 }}>Supported currencies</legend>
        {CURRENCY_OPTIONS.map((currency) => (
          <label key={currency} className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <input type="checkbox" name="supportedCurrencies" value={currency} defaultChecked={hasValue(vendor?.supportedCurrencies, currency)} />
            <span style={{ textTransform: currency === 'usd' ? 'none' : 'capitalize' }}>{currency === 'usd' ? 'US Dollar' : currency}</span>
          </label>
        ))}
      </fieldset>

      <button type="submit" className="button primary" disabled={isPending}>
        {isPending ? 'Saving…' : vendor ? 'Save vendor' : 'Create vendor'}
      </button>
    </form>
  )
}
