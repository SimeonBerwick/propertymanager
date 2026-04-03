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
- [ ] Request list is readable on phone
- [ ] Request detail is readable on phone
- [ ] New request flow is usable on phone
- [ ] Tenant-visible timeline is understandable
- [ ] Error states are explicit and non-ambiguous

### Packaging prep
- [ ] Mobile shell/header is app-ready and not obviously web-admin styled
- [ ] Auth entry screens read like a tenant app, not an internal tool
- [ ] Deep-link/open-link behavior is reviewed for invite/auth entry
- [ ] Attachment access uses app-controlled routes
- [ ] Basic installability/PWA wrapper path is defined

## First implementation slice
1. Tighten the tenant mobile shell so it feels like a tenant product surface.
2. Add a dedicated mobile landing/auth entry presentation that is app-oriented.
3. Keep operator/vendor complexity out of this shell.
4. Preserve the validated route and auth boundaries while improving packaging readiness.

## Non-blocking later work
- Push notification polish
- Better branding/app icon/splash handling
- Store/package metadata
- Offline niceties
- Memory/runtime ops cleanup outside the product surface
