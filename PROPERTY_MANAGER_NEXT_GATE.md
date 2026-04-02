# Property Manager — Next Gate

## Gate name
Post-hosted stabilization + companion-app packaging prep

## Why this gate exists
Hosted validation already proved the core maintenance engine in a real environment.

That changes the work.

The next move is not more random feature accumulation and not premature Outlook integration.
The next move is to:
1. keep hosted truth honest where still partially unproven,
2. turn the role surfaces into a cleaner product package,
3. prepare installable/mobile-first companion framing without breaking the one-backend model.

---

## What this gate should accomplish

### 1. Post-hosted stabilization
Close the remaining production-grade truth gaps that were not fully exercised in the hosted pass.

Primary targets:
- notification transport truth
- auth endpoint rate limiting / abuse resistance
- deployment/runtime observability where failures currently stay too quiet
- any follow-up reliability bugs surfaced by real hosted usage

### 2. Companion-app packaging prep
Clarify product packaging without splitting the platform.

Required framing:
- operator/property manager = full app
- tenant = free companion app
- vendor = free companion app
- one backend / one system of record / role-scoped shells

### 3. Installable/mobile-first prep
Prepare the app shells to feel like real companion products.

Practical scope:
- mobile-first UX tightening on tenant/vendor surfaces
- installability/PWA readiness
- role-specific framing/copy/navigation polish
- no premature native multi-stack explosion

---

## Explicit non-goals for this gate
Do **not** let this gate drift into:
- Outlook / Microsoft 365 integration work
- disconnected tenant/vendor codebases
- full native app packaging before installable web/PWA truth exists
- enterprise platform theater

Outlook remains the gate after this one.

---

## Recommended execution order inside this gate

### Track A — stabilize what is still partially unproven
1. verify notification delivery truth end to end, or make failure states brutally honest
2. add auth endpoint throttling / rate limiting
3. tighten any hosted observability/error visibility gaps

### Track B — package the role surfaces
4. define operator full-app framing in-app and in docs
5. define tenant free companion framing
6. define vendor free companion framing
7. make the role shells feel intentional rather than incidental

### Track C — prepare installable companion direction
8. assess and implement PWA/installability basics
9. tighten mobile-first UX on tenant/vendor surfaces
10. define what would justify native wrappers later, without building them now

---

## Exit criteria
This gate is complete when:
- remaining production-truth gaps are either fixed or explicitly narrowed
- operator/tenant/vendor packaging is reflected clearly in product language and roadmap
- companion-app direction is operationally prepared without fragmenting architecture
- Outlook work is still deferred until after this gate

---

## Honest status line
Core hosted truth is no longer the blocker.

Now the challenge is turning a working hosted maintenance engine into a cleanly packaged product without reintroducing fake complexity.
