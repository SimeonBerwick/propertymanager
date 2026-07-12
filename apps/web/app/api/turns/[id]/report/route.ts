import { getLandlordSession } from '@/lib/landlord-session'
import { prisma } from '@/lib/prisma'
import { daysBetween } from '@/lib/unit-turn-templates'

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getLandlordSession(); if (!session) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const turn = await prisma.unitTurn.findFirst({ where: { id, orgId: session.userId }, include: { unit: { include: { property: true } }, tasks: { include: { assignedVendor: true }, orderBy: { position: 'asc' } } } })
  if (!turn) return new Response('Not found', { status: 404 })
  const end = turn.readyAt ?? new Date()
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(turn.title)}</title><style>body{font:14px Arial;max-width:900px;margin:32px auto;padding:0 24px;color:#17202a}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}th{color:#59636e}button{margin-bottom:20px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print or save PDF</button><h1>Unit turn report</h1><h2>${escape(turn.title)}</h2><p>${escape(turn.unit.property.name)} - ${escape(turn.unit.label)}<br>Move-out: ${turn.moveOutAt.toLocaleDateString('en-US')} | Ready: ${turn.readyAt?.toLocaleDateString('en-US') ?? 'In progress'} | Vacancy duration: ${daysBetween(turn.moveOutAt, end)} days</p><table><thead><tr><th>Task</th><th>Owner</th><th>Due</th><th>Completed</th><th>Notes</th></tr></thead><tbody>${turn.tasks.map((task) => `<tr><td>${escape(task.title)}</td><td>${escape(task.assignedVendor?.name ?? task.assignedType)}</td><td>${task.dueAt?.toLocaleDateString('en-US') ?? ''}</td><td>${task.completedAt?.toLocaleDateString('en-US') ?? task.status.replaceAll('_', ' ')}</td><td>${escape(task.note ?? '')}</td></tr>`).join('')}</tbody></table></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
