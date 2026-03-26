## [LRN-20260326-001] correction

**Logged**: 2026-03-26T21:45:00Z
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
Do not update Mission Control from reported implementation summaries alone when the repo has not been re-verified.

### Details
I updated Mission Control multiple times based on reported PM app changes (upload hardening, phone-region support, delivery-failure visibility) without re-checking the actual code paths in `/home/simeo/.openclaw/workspace/property-manager`. Jeff QA against the real repo showed those claims did not hold on the inspected surfaces: upload validation still trusted MIME/size only in `lib/request-attachments.ts`, operator mobile setup still hardcoded `+1` normalization in `app/operator/mobile-identity/actions.ts`, the UI lacked a region selector in `app/operator/units/[id]/page.tsx`, and the invite flow remained manual-link based rather than implementing meaningful delivery-failure handling. This created false confidence in Mission Control.

### Suggested Action
Before changing Mission Control status for implementation claims, verify the actual repo surface first: inspect the relevant files, run the relevant tests, and word updates as either verified repo truth or unverified reported work. Prefer explicit uncertainty over optimistic restatement. Also: when a later QA pass overturns an earlier one, update status to match the newest verified evidence rather than anchoring on the prior correction.

### Metadata
- Source: user_feedback
- Related Files: mission-control/data/app-workflow.json, mission-control/data/kanban.json, /home/simeo/.openclaw/workspace/property-manager/lib/request-attachments.ts, /home/simeo/.openclaw/workspace/property-manager/app/operator/mobile-identity/actions.ts, /home/simeo/.openclaw/workspace/property-manager/app/operator/units/[id]/page.tsx
- Tags: correction, qa, mission-control, verification, property-manager
- Pattern-Key: verify.repo_before_status_update
- Recurrence-Count: 1
- First-Seen: 2026-03-26
- Last-Seen: 2026-03-26

---
