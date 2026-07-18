import { prisma } from '@/lib/prisma'
import { hashBoardApprovalToken } from '@/lib/coop-board'
import { respondToBoardApprovalAction } from './actions'

export default async function BoardApprovalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { token } = await params
  const query = await searchParams
  const approval = await prisma.boardApproval.findUnique({ where: { tokenHash: hashBoardApprovalToken(token) }, include: { approver: true, request: { include: { property: true, unit: true } } } })
  if (!approval) return <main className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
    <section className="card stack">
      <div className="kicker">Simeonware board review</div>
      <h1 className="pageTitle">Board approval link unavailable</h1>
      <p>This link is invalid or has been replaced by a newer approval request. Ask the property manager for the latest board approval email.</p>
    </section>
  </main>
  const expired = approval.expiresAt <= new Date()
  const unavailable = approval.status !== 'pending' || expired
  return <main className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
    <section className="card stack">
      <div className="kicker">Simeonware board review</div>
      <h1 className="pageTitle">{approval.request.title}</h1>
      <div className="muted">{approval.request.property.name} - {approval.request.unit.label} - {approval.request.category}</div>
      <p>{approval.request.description}</p>
      <div className="notice">Requested for {approval.approver.name}. This secure link expires {approval.expiresAt.toLocaleDateString('en-US')}.</div>
      {query.error ? <div className="notice error">{query.error}</div> : null}
      {query.success === 'approved' ? <div className="notice success">Your approval has been recorded. The property manager can now continue the work order.</div> : null}
      {query.success === 'returned' ? <div className="notice success">Your question has been sent to the property manager. The work order remains paused until it is revised and approved.</div> : null}
      {query.success === 'declined' ? <div className="notice success">Your decision has been recorded. The work order remains paused while the property manager reviews next steps.</div> : null}
      {unavailable ? <div className="notice">{expired && approval.status === 'pending' ? 'This approval link has expired. Ask the property manager to send a fresh board approval link.' : `This approval is no longer awaiting a response. Current status: ${approval.status.replaceAll('_', ' ')}.`}</div> : <form action={respondToBoardApprovalAction} className="stack"><input type="hidden" name="token" value={token} /><label>Note for the property manager <span className="muted">(required when returning or declining)</span><textarea name="note" maxLength={1000} /></label><div className="row"><button className="button primary" name="response" value="approved">Approve</button><button className="button" name="response" value="returned">Return with question</button><button className="button" name="response" value="declined">Decline</button></div></form>}
    </section>
  </main>
}
