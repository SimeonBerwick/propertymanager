import { DashboardOverview } from "@/components/dashboard-overview";
import { requireUser } from "@/lib/auth";
import { getDashboardQueues, listLeads } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const context = { userId: user.id, organizationId: user.organizationId };
  const leads = await listLeads(context);
  const queues = await getDashboardQueues(context);

  return <DashboardOverview leads={leads} queues={queues} />;
}
