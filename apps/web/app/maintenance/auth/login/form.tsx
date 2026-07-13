'use client'
import { useActionState } from 'react'
import { startStaffLoginAction, type StaffLoginState } from './actions'
const INITIAL: StaffLoginState = { error: null }
export function StaffLoginForm() { const [state, action, pending] = useActionState(startStaffLoginAction, INITIAL); return <form action={action} className="stack">{state.error ? <div className="notice error">{state.error}</div> : null}<label>Work email<input type="email" name="email" autoComplete="email" required /></label><button className="button primary" disabled={pending}>{pending ? 'Sending...' : 'Send sign-in code'}</button></form> }
