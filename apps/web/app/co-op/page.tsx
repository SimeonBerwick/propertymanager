import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { REQUEST_CATEGORIES } from '@/lib/maintenance-options'
import { RECURRING_WORK_TEMPLATES } from '@/lib/recurring-work'
import {
  addRecurringWorkTemplateAction,
  createBoardApprovalPolicyAction,
  createBoardApproverAction,
  createRecurringWorkPlanAction,
  deleteBoardApprovalPolicyAction,
  makePropertyCooperativeAction,
  overrideBoardApprovalAction,
  toggleBoardApproverAction,
  toggleRecurringWorkPlanAction,
  updateVendorCertificateAction,
} from './actions'

const dateInputValue = (date: Date) => date.toISOString().slice(0, 10)

export default async function CooperativeOperationsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const session = await getLandlordSession()
  if (!session) redirect('/login?error=session-expired')
  const query = await searchParams
  const [user, properties, approvers, policies, plans, vendors, pendingApprovals] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { subscriptionPlan: true, subscriptionStatus: true } }),
    prisma.property.findMany({ where: { ownerId: session.userId, isActive: true }, include: { units: { where: { isActive: true }, orderBy: { label: 'asc' } } }, orderBy: { name: 'asc' } }),
    prisma.boardApprover.findMany({ where: { orgId: session.userId }, orderBy: { name: 'asc' } }),
    prisma.boardApprovalPolicy.findMany({ where: { orgId: session.userId }, include: { property: true, approver: true }, orderBy: { createdAt: 'desc' } }),
    prisma.recurringWorkPlan.findMany({ where: { orgId: session.userId }, include: { property: true, unit: true, preferredVendor: true }, orderBy: { nextDueAt: 'asc' } }),
    prisma.vendor.findMany({ where: { orgId: session.userId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.boardApproval.findMany({ where: { status: 'pending', request: { property: { ownerId: session.userId } } }, include: { approver: true, request: { include: { property: true, unit: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ])
  const cooperativeProperties = properties.filter((property) => property.propertyType === 'cooperative')
  const cooperativeUnits = cooperativeProperties.flatMap((property) => property.units.map((unit) => ({ ...unit, propertyName: property.name })))
  const hasPro = user?.subscriptionPlan === 'pro'

  if (!hasPro) {
    return <main className="stack"><section className="card stack"><div className="kicker">Pro feature</div><h1 className="pageTitle">Co-op operations</h1><p className="muted">Board-controlled approvals, recurring building work, evidence reminders, and vendor certificate tracking are included with Pro.</p><Link className="button primary" href="/account/subscription">View Pro plan</Link></section></main>
  }

  return <main className="stack">
    <section className="card stack">
      <div className="kicker">Pro co-op mode</div>
      <h1 className="pageTitle">Co-op operations</h1>
      <p className="muted">Keep the manager in control while giving the board a clear, auditable approval step. This is operational support, not legal or regulatory advice.</p>
      {query.error ? <div className="notice error">{query.error}</div> : null}
      {query.success ? <div className="notice success">{query.success}</div> : null}
    </section>

    {!cooperativeProperties.length ? <section className="card stack"><h2 className="sectionTitle">Enable a cooperative property</h2><p className="muted">Choose an existing property to add its building areas and co-op workflows. New properties can also be created as a Cooperative building.</p><div className="stack">{properties.length ? properties.map((property) => <form action={makePropertyCooperativeAction} key={property.id} className="row"><span><strong>{property.name}</strong><span className="muted"> - {property.address}</span></span><input type="hidden" name="propertyId" value={property.id} /><button className="button" type="submit">Enable Co-op Mode</button></form>) : <Link className="button primary" href="/properties/new">Add a cooperative property</Link>}</div></section> : null}

    <section className="grid cols-2">
      <div className="card stack">
        <div><div className="kicker">Board</div><h2 className="sectionTitle">Board approvers</h2></div>
        <form action={createBoardApproverAction} className="grid cols-2">
          <label>Name<input name="name" maxLength={120} required /></label>
          <label>Email<input name="email" type="email" maxLength={254} required /></label>
          <button className="button primary" type="submit">Add board approver</button>
        </form>
        {approvers.length ? approvers.map((approver) => <div className="row" key={approver.id}><span><strong>{approver.name}</strong><span className="muted"> - {approver.email}</span></span><form action={toggleBoardApproverAction}><input type="hidden" name="id" value={approver.id} /><input type="hidden" name="isActive" value={String(!approver.isActive)} /><button className="button" type="submit">{approver.isActive ? 'Disable' : 'Enable'}</button></form></div>) : <div className="muted">Add the named people who may approve building work.</div>}
      </div>

      <div className="card stack">
        <div><div className="kicker">Approval rules</div><h2 className="sectionTitle">Send selected work to the board</h2></div>
        <form action={createBoardApprovalPolicyAction} className="stack">
          <label>Cooperative property<select name="propertyId" defaultValue=""><option value="">All cooperative properties</option>{cooperativeProperties.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
          <label>Category<select name="category" defaultValue="Safety">{REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Approver<select name="approverId" defaultValue=""><option value="">Any active board approver</option>{approvers.filter((approver) => approver.isActive).map((approver) => <option value={approver.id} key={approver.id}>{approver.name}</option>)}</select></label>
          <button className="button primary" type="submit" disabled={!cooperativeProperties.length || !approvers.some((approver) => approver.isActive)}>Add approval rule</button>
        </form>
        {policies.length ? policies.map((policy) => <div className="row" key={policy.id}><span><strong>{policy.category}</strong><span className="muted"> - {policy.property?.name ?? 'All co-op properties'} - {policy.approver?.name ?? 'Any active approver'}</span></span><form action={deleteBoardApprovalPolicyAction}><input type="hidden" name="id" value={policy.id} /><button className="button" type="submit">Remove</button></form></div>) : <div className="muted">No categories currently require board approval.</div>}
      </div>
    </section>

    <section className="card stack">
      <div><div className="kicker">Recurring work</div><h2 className="sectionTitle">Building maintenance calendar</h2><p className="muted">Simeonware creates the work order before it is due, then reminds the manager daily if it remains open after the due date.</p></div>
      <form action={addRecurringWorkTemplateAction} className="grid cols-3">
        <label>Starter template<select name="template">{RECURRING_WORK_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}</select></label>
        <label>Location<select name="unitId" required defaultValue=""><option value="" disabled>Choose location</option>{cooperativeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.propertyName} - {unit.label}</option>)}</select></label>
        <label>First due date<input name="nextDueAt" type="date" defaultValue={dateInputValue(new Date())} required /></label>
        <button className="button" type="submit" disabled={!cooperativeUnits.length}>Add starter plan</button>
      </form>
      <form action={createRecurringWorkPlanAction} className="stack">
        <div className="grid cols-3">
          <label>Title<input name="title" maxLength={200} required /></label>
          <label>Location<select name="unitId" required defaultValue=""><option value="" disabled>Choose location</option>{cooperativeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.propertyName} - {unit.label}</option>)}</select></label>
          <label>Category<select name="category" defaultValue="Safety">{REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Frequency<select name="frequency" defaultValue="annual"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semiannual">Every six months</option><option value="annual">Annual</option><option value="custom_days">Custom days</option></select></label>
          <label>Custom days<input name="customIntervalDays" type="number" min="1" max="730" /></label>
          <label>First due date<input name="nextDueAt" type="date" defaultValue={dateInputValue(new Date())} required /></label>
          <label>Days before due<input name="daysBeforeDue" type="number" min="0" max="90" defaultValue="14" required /></label>
          <label>Preferred vendor<select name="preferredVendorId" defaultValue=""><option value="">No preference</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
        </div>
        <label>Description<textarea name="description" maxLength={2000} required /></label>
        <label>Required evidence<input name="requiredEvidenceCsv" maxLength={300} placeholder="Example: inspection report, certificate, photo" /></label>
        <label className="row" style={{ justifyContent: 'flex-start' }}><input type="checkbox" name="requiresBoardApproval" value="true" /> Send this recurring work order to the board before it proceeds</label>
        <button className="button primary" type="submit" disabled={!cooperativeUnits.length}>Save recurring work plan</button>
      </form>
      {plans.length ? <div className="stack">{plans.map((plan) => <div className="row" key={plan.id}><span><strong>{plan.title}</strong><span className="muted"> - {plan.property.name} / {plan.unit.label} - due {plan.nextDueAt.toLocaleDateString()} - {plan.frequency.replaceAll('_', ' ')}</span></span><form action={toggleRecurringWorkPlanAction}><input type="hidden" name="id" value={plan.id} /><input type="hidden" name="isActive" value={String(!plan.isActive)} /><button className="button" type="submit">{plan.isActive ? 'Pause' : 'Enable'}</button></form></div>)}</div> : <div className="muted">No recurring building work has been scheduled yet.</div>}
    </section>

    <section className="grid cols-2">
      <div className="card stack">
        <div><div className="kicker">Certificate tracking</div><h2 className="sectionTitle">Vendor insurance and certificates</h2><p className="muted">You will receive a daily alert during the 30 days before an active vendor record expires.</p></div>
        {vendors.length ? vendors.map((vendor) => <form className="grid cols-3" action={updateVendorCertificateAction} key={vendor.id}><input type="hidden" name="vendorId" value={vendor.id} /><strong>{vendor.name}</strong><label>Expires<input type="date" name="certificateExpiresAt" defaultValue={vendor.insuranceCertificateExpiresAt ? dateInputValue(vendor.insuranceCertificateExpiresAt) : ''} /></label><label>Reference<input name="reference" maxLength={200} defaultValue={vendor.insuranceCertificateReference ?? ''} /></label><button className="button" type="submit">Save</button></form>) : <div className="muted">Add vendors before tracking their certificates.</div>}
      </div>
      <div className="card stack">
        <div><div className="kicker">Waiting for board</div><h2 className="sectionTitle">Open approvals</h2></div>
        {pendingApprovals.length ? pendingApprovals.map((approval) => <div className="stack" key={approval.id} style={{ gap: 8 }}><Link href={`/requests/${approval.requestId}`}><strong>{approval.request.title}</strong></Link><div className="muted">{approval.request.property.name} - {approval.request.unit.label} - sent to {approval.approver.name}</div><form action={overrideBoardApprovalAction} className="row"><input type="hidden" name="requestId" value={approval.requestId} /><input name="note" maxLength={500} required placeholder="Emergency override reason" /><button className="button" type="submit">Emergency override</button></form></div>) : <div className="emptyState"><strong>No board approvals waiting</strong><span>That is good news: there is no open work held up for the board.</span></div>}
      </div>
    </section>
  </main>
}
