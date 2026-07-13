'use client'
import { useActionState } from 'react'
import { OtpCodeField } from '@/components/otp-code-field'
import { verifyStaffLoginAction, type StaffLoginState } from '../login/actions'
const INITIAL: StaffLoginState = { error: null }
export function StaffVerifyForm({ challengeId }: { challengeId: string }) { const [state, action, pending] = useActionState(verifyStaffLoginAction, INITIAL); return <form action={action} className="stack"><input type="hidden" name="challengeId" value={challengeId} />{state.error ? <div className="notice error">{state.error}</div> : null}<OtpCodeField /><button className="button primary" disabled={pending}>{pending ? 'Verifying...' : 'Verify and sign in'}</button></form> }
