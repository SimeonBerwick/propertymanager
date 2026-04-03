# Companion App V1

## Mission
Ship a narrow, trustworthy tenant companion app on top of the already-validated Property Manager V1 backend.

This is **not** a second operator console.
This is the tenant-facing mobile surface wrapped around the proven auth and request flows.

## Gate status
As of 2026-04-03, the auth gate is green:
- notification transport truth: validated
- auth abuse resistance: runtime-validated
- auth/session/object boundaries: runtime-validated

That means packaging prep can proceed without pretending the trust layer is still unfinished.

## Mission control status
Current lane: **companion-app packaging prep in progress**

Completed in this lane already:
- app-oriented tenant auth landing
- app-oriented tenant mobile shell
- app-oriented request list/dashboard
- app-oriented new-request flow

Next active slices:
1. tighten tenant request detail into the same app-quality system
2. review invite/deep-link/open-link behavior for package readiness
3. define installability/PWA-wrapper path and required assets

## V1 ship scope

### Included
- Tenant invite entry via mobile auth link
- Returning tenant login via OTP
- Clear delivery-state messaging in mobile auth UX
- Tenant session persistence and sign-out
- Tenant request list
- Tenant request detail view
- Tenant request submission
- Tenant-visible timeline/events only
- Attachment access only through app-controlled routes

### Explicitly excluded
- Operator workflow migration into the companion app
- Vendor workflow migration into the companion app
- Broad admin/reporting surfaces in the app
- Experimental messaging/push flows not needed for launch
- Any UX that weakens the already-validated auth boundary model

## Product rules
1. The app must reflect truth, not fake delivery semantics.
2. The app must preserve the validated auth boundary model.
3. Tenant-visible data stays tenant-visible only.
4. Vendor/private artifacts stay hidden from tenant-facing data.
5. App packaging should wrap the proven backend, not invent a second system.

## Release checklist

### Auth / access
- [ ] Invite link opens cleanly into mobile auth flow
- [ ] Returning login flow is clear and recoverable
- [ ] Session survives normal reopen behavior
- [ ] Sign-out is explicit and reliable
- [ ] Expired/tampered sessions recover cleanly

### Tenant request experience
- [x] Request list is readable on phone
- [ ] Request detail is readable on phone
- [x] New request flow is usable on phone
- [ ] Tenant-visible timeline is understandable
- [ ] Error states are explicit and non-ambiguous

### Packaging prep
- [x] Mobile shell/header is app-ready and not obviously web-admin styled
- [x] Auth entry screens read like a tenant app, not an internal tool
- [ ] Deep-link/open-link behavior is reviewed for invite/auth entry
- [x] Attachment access uses app-controlled routes
- [ ] Basic installability/PWA wrapper path is defined

## Current implementation slice
1. Tighten tenant request detail into the same product language as the shell/dashboard.
2. Keep operator/vendor complexity out of the companion-app shell.
3. Review invite/open-link/deep-link behavior before any wrapper/store work.
4. Preserve the validated route and auth boundaries while improving packaging readiness.

## Deep-link and packaging readiness

### Invite/open-link contract
The package/wrapper should treat the following as the canonical entry flow:
- `/mobile/auth/accept/[token]` → first-time invite entry
- `/mobile/auth/otp?...` → one-time verification continuation
- `/mobile` → authenticated tenant landing

Rules:
- invite links should open directly into the tenant auth flow
- expired/invalid invites must fail clearly and recover toward requesting a new invite
- authenticated mobile sessions should land in `/mobile`, not bounce through generic auth UI

### Wrapper/PWA path
Preferred order:
1. PWA/installability pass over the existing mobile web surface
2. lightweight wrapper only if install/distribution needs exceed PWA constraints
3. do not fork backend/auth logic for packaging

### Required packaging assets/work
- app name / short name
- theme color / background color
- icon set for install surfaces
- manifest definition
- installability review on iPhone/Android browsers
- link-opening review from SMS/email invite flows

## Non-blocking later work
- Push notification polish
- Better branding/app icon/splash handling
- Store/package metadata
- Offline niceties
- Memory/runtime ops cleanup outside the product surface
