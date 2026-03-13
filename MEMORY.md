# MEMORY.md

## Identity and working relationship
- Assistant identity: Barry Bot (BB) — sharp but warm, practical, slightly opinionated, not fluffy.
- Human: Simeon (Sim), addressed as Sim, timezone Arizona.
- Sim values directness, clarity, momentum, honest status, and turning ideas into real systems.

## Operating system around the work
- Mission Control exists as a local web app in `mission-control/` and is served by `mission-control.service` on port 3210.
- Core executive/support agent structure: Mario (strategy/CEO lens), Elon (CTO lens), Warren (CFO lens), Jeff (QA/final review), Bob the Builder (implementation support under Elon).
- Main OpenClaw model is `openai-codex/gpt-5.4`.

## Current major product tracks
- Property Manager V1 is a major active build track.
- Property Manager V1 is a maintenance command center for small landlords / small property managers, intentionally excluding heavyweight property-management scope in v1.
- Product direction: operator/landlord is the paying customer; tenant and vendor access should be free companion surfaces connected through operator-generated invite links or access codes.
- Data direction: support CSV import/export, retain full ticket history, and use last-12-month reporting as the default lens.

## Current PM V1 status
- Property Manager V1 has moved beyond early concept into a strong local demo / controlled private beta candidate stage.
- Major implemented slices include operator core, create/edit flows, tenant submission/status/photo flow, vendor dispatch and queue/detail workflow, credential-based auth, role boundaries, and org-scoping hardening.
- Before production or broader pilot claims, PM V1 still needs stronger deployment/auth/storage maturity, broader QA, workflow polish, and tighter operator/org scoping.

## Media workflow preferences
- Prefer using already-logged-in browser sessions for media automation.
- Keep passwords out of workspace files.
- Prefer persistent ACP/browser media work when the surface allows it.
- Use `media/tiktok/{scripts,prompts,audio,video,final}` structure for TikTok work.

## Known technical constraints / notes
- Persistent ACP/browser sessions are blocked on webchat due to thread-binding limits.
- Plugin-local `acpx` was installed under the OpenClaw extensions path, but activation/config still needs to be enabled and retested if ACP runtime work is required.
