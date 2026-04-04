import { DisplayLanguage, getCompletedStages, getRequestCopy, getTicketStage, TicketStageKey } from '@/lib/request-display';

const orderedStages: TicketStageKey[] = ['CREATED', 'WITH_PROPERTY_MANAGER', 'WITH_VENDOR', 'COMPLETED', 'CANCELED'];

export function TicketProgress({
  language,
  status,
  assignedVendorId,
  vendorResponseStatus,
  completedAt,
}: {
  language: DisplayLanguage;
  status: Parameters<typeof getTicketStage>[0]['status'];
  assignedVendorId?: string | null;
  vendorResponseStatus?: Parameters<typeof getTicketStage>[0]['vendorResponseStatus'];
  completedAt?: string | null;
}) {
  const currentStage = getTicketStage({ status, assignedVendorId, vendorResponseStatus });
  const completedStages = new Set(getCompletedStages(currentStage));
  const copy = getRequestCopy(language);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {orderedStages.map((stage, index) => {
          const isComplete = completedStages.has(stage);
          const isCurrent = currentStage === stage;
          const connectorClass = index < orderedStages.length - 1
            ? isComplete && orderedStages[index + 1] !== currentStage
              ? 'bg-emerald-500'
              : isComplete && orderedStages[index + 1] === currentStage
                ? 'bg-brand-500'
                : 'bg-slate-200'
            : '';

          return (
            <div key={stage} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4">
              {index < orderedStages.length - 1 ? (
                <div className={`absolute left-[calc(100%-0.25rem)] top-6 hidden h-1 w-[calc(100%+0.5rem)] rounded-full lg:block ${connectorClass}`} />
              ) : null}
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isComplete ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{copy.stageLabels[stage]}</p>
                  <p className="text-xs text-slate-600">{copy.stageDescriptions[stage]}</p>
                </div>
              </div>
              {isCurrent ? (
                <p className="mt-3 text-xs font-medium text-brand-700">{copy.currentStage}</p>
              ) : null}
              {stage === 'COMPLETED' && completedAt ? (
                <p className="mt-2 text-xs text-slate-600">{copy.completedOn}: {completedAt}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
