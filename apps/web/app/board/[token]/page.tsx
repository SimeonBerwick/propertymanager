import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { hashBoardApprovalToken } from '@/lib/coop-board'
import { respondToBoardApprovalAction } from './actions'

export default async function BoardApprovalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { token } = await params
  const query = await searchParams
  const approval = await prisma.boardApproval.findUnique({ where: { tokenHash: hashBoardApprovalToken(token) }, include: { approver: true, request: { include: { property: true, unit: true } } } })
  if (!approval) notFound()
  const unavailable = approval.status !== 'pending' || approval.expiresAt <= new Date()
  return <main className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
    <section className="card stack">
      <div className="kicker">Simeonware board review</div>
      <h1 className="pageTitle">{approval.request.title}</h1>
      <div className="muted">{approval.request.property.name} - {approval.request.unit.label} - {approval.request.category}</div>
      <p>{approval.request.description}</p>
      <div className="notice">Requested for {approval.approver.name}. This secure link expires {approval.expiresAt.toLocaleDateString('en-US')}.</div>
      {query.error ? <div className="notice error">{query.error}</div> : null}
      {query.success ? <div className="notice success">Your decision has been recorded. The property manager can now continue the work order.</div> : null}
      {unavailable ? <div className="notice">This approval is no longer awaiting a response. Current status: {approval.status.replaceAll('_', ' ')}.</div> : <form action={respondToBoardApprovalAction} className="stack"><input type="hidden" name="token" value={token} /><label>Note for the property manager (optional)<textarea name="note" maxLength={1000} /></label><div className="row"><button className="button primary" name="response" value="approved">Approve</button><button className="button" name="response" value="returned">Return with question</button><button className="button" name="response" value="declined">Decline</button></div></form>}
    </section>
  </main>
}
