# Property Manager V1 - Elon + Bob Shared Handoff

## Shared mission
Work together to move Property Manager V1 forward toward a controlled private beta candidate.

Current focus is narrow and explicit:
- Property Manager V1 only
- current implementation target: operator triage surface upgrade
- no side quests
- no unrelated product expansion

---

## Current task
Use existing PM V1 data and workflow plumbing to upgrade the operator maintenance inbox and request detail into a true maintenance command center.

Primary target:
- `PROPERTY_MANAGER_NEXT_TASK_OPERATOR_TRIAGE.md`

Supporting context:
- `PROPERTY_MANAGER_ELON_BRIEF.md`
- `PROPERTY_MANAGER_BOB_EXECUTION_BRIEF.md`
- `PROPERTY_MANAGER_SPRINT_COMMAND_CENTER.md`

---

## Role split

### Elon
Own:
- implementation sequence
- product/technical coherence
- deciding what must be visible to operators for faster triage
- making sure the surface reflects real workflow state instead of cosmetic UI changes

### Bob
Own:
- adjacent implementation slices
- UI/detail/list improvements that support Elon’s direction
- reducing friction in the actual operator surface
- practical wiring of triage signals that already exist in the data model

---

## Immediate build goal
When an operator opens the inbox, they should be able to tell much faster:
- what is urgent
- what is unassigned
- what is waiting on a vendor
- what already has dates or pricing
- what has a PDF bid
- what needs action now

When an operator opens request detail, they should understand the current maintenance state without hunting.

---

## First implementation slice
Start with the operator inbox list and top-of-detail summary.

Specifically:
1. enrich `/operator/requests` cards with stronger triage signals
2. improve the top summary area of `/operator/requests/[id]`
3. surface vendor response / planned start / expected completion / pricing / bid presence more clearly
4. make operator next actions more obvious above the fold

Do not start with visual polish for its own sake.
Start with the information architecture that reduces operator decision friction.

---

## Success standard
This work is successful if it makes PM V1 feel more like a real operator command center and less like a thin record browser.
