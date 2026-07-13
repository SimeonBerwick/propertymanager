import { StaffLoginForm } from './form'
export default function StaffLoginPage() { return <div className="card stack" style={{ maxWidth: 560, margin: '48px auto' }}><div><div className="kicker">Maintenance staff</div><h1>Sign in</h1></div><p className="muted">Use the work email registered by your property manager.</p><StaffLoginForm /><a href="/login">Choose a different sign-in</a></div> }
