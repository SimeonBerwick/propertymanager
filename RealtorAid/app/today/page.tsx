import { TodayBoard } from "@/components/today-board";
import { requireUser } from "@/lib/auth";
import { getDashboardQueues, listLeads } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const context = { userId: user.id, organizationId: user.organizationId };
  const leads = await listLeads(context);
  const queues = await getDashboardQueues(context);
  const unscheduled = leads.filter((lead) => !lead.nextFollowUpAt && lead.stage !== "closed");

  return <TodayBoard overdue={queues.overdue} dueToday={queues.dueToday} unscheduled={unscheduled} />;
}
