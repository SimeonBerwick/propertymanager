# Property Manager Release Checklist

## Purpose
This is the release checklist for Property Manager V1 in Mission Control terms.

Use it to separate:
- what must be true before a **controlled private beta**
- what must be true before a **public release**
- what is useful but can wait until **post-launch**

The goal is simple: stop calling something "release-ready" because it feels close.
Call it ready only when the trust, operations, and user-facing basics are actually there.

---

# 1. Release stage definitions

## A. Controlled private beta
Small number of real users, limited blast radius, direct support, manual intervention acceptable.

## B. Public release
Open or semi-open customer-facing release where the product must survive normal use without founder babysitting every flow.

## C. Post-launch hardening
Important improvements that matter, but do not need to block the first real release if the earlier gates are met.

---

# 2. Must-have before controlled private beta

## Product truth and workflow trust
- [ ] Operator core workflow works end-to-end in a production-like environment
- [ ] Tenant maintenance submission works end-to-end in a production-like environment
- [ ] Vendor assignment/update flow works end-to-end in a production-like environment
- [ ] No demo/read-only ambiguity remains anywhere user-facing
- [ ] Invite/mobile-access copy is honest about what is manual vs automated
- [ ] Error states are clear enough that users do not mistake failure for success

## Auth and security basics
- [ ] Session handling is verified in production mode
- [ ] Protected routes fail closed
- [ ] Sensitive object reads/writes remain org-scoped in production-like testing
- [ ] Login / OTP / invite endpoints have basic rate limiting
- [ ] Cookie settings are verified for production (`httpOnly`, `secure`, `sameSite` as intended)
- [ ] Dev-only OTP leakage/debug behavior is disabled outside local development

## Upload and file safety
- [ ] Current attachment validation is active in the production build
- [ ] Upload rejection paths are user-legible
- [ ] Upload storage path is not publicly guessable in an unsafe way
- [ ] File handling has a clear size limit and failure behavior
- [ ] Mixed-file failure behavior is coherent and tested

## Delivery / communication reality
- [ ] Every delivery-related UX path tells the truth
- [ ] If invites are manual, the UI says so clearly
- [ ] If email/SMS is enabled, delivery failure is visible to the operator
- [ ] Request notifications behave consistently in the configured environment

## Operations and reliability
- [ ] Production deployment target is chosen and documented
- [ ] Environment variables are documented and validated
- [ ] App can restart cleanly without manual repair
- [ ] Backups exist for the live database
- [ ] Basic monitoring/log visibility exists for app crashes and major failures
- [ ] One rollback path is documented

## QA gate
- [ ] Fresh full browser walkthrough passed on the release candidate
- [ ] Mobile tenant flow passed on the release candidate
- [ ] Regression suite passes on the release candidate
- [ ] Jeff signs off as PASS WITH CONDITIONS or better for the intended beta scope

---

# 3. Must-have before public release

Everything in controlled private beta, plus:

## Data and infrastructure maturity
- [ ] Production database choice is appropriate for broader release
- [ ] Migration/backfill/restore process is documented and tested
- [ ] Uploads are moved to real object storage or an equally durable production-safe setup
- [ ] Storage permissions/access model is production-safe
- [ ] Retention and cleanup behavior is defined

## Account lifecycle and recovery
- [ ] Password reset exists and works
- [ ] Invite resend / regenerate flows exist
- [ ] Tenant/vendor recovery flows are clear enough for self-service or low-touch support
- [ ] Session revocation and access removal are operationally usable by the operator/admin

## Abuse resistance
- [ ] OTP challenge throttling/lockout is in place
- [ ] Login throttling is in place
- [ ] Upload abuse controls are in place
- [ ] Basic anti-enumeration behavior is verified

## Delivery and notification maturity
- [ ] Real email provider is configured if email is part of the product promise
- [ ] Real SMS provider is configured if SMS is part of the product promise
- [ ] Delivery failure states are visible and actionable
- [ ] Notification logging is durable enough to troubleshoot failures

## Product/legal basics
- [ ] Privacy policy exists
- [ ] Terms/basic legal copy exists if charging or collecting real customer data
- [ ] Support path/contact method exists
- [ ] Data handling posture is documented enough for real customers

## QA and release discipline
- [ ] Final release candidate tested against production-like env and real config
- [ ] Known issues list is explicit and acceptable
- [ ] Jeff sign-off is PASS for the intended public scope, not just "usable with babysitting"

---

# 4. Nice-to-have after launch

## Product polish
- [ ] Better operator troubleshooting surfaces
- [ ] Better invite status visibility
- [ ] More polished empty/loading/error states
- [ ] Better reporting and exports
- [ ] Cleaner onboarding flow

## Trust and hardening upgrades
- [ ] Full decode/parse validation for uploaded images
- [ ] Live phone/carrier verification if product value justifies the cost
- [ ] More complete audit/event trail
- [ ] More granular regional/workspace controls if real usage demands them

## Operations
- [ ] Structured alerts to external monitoring
- [ ] Admin diagnostics panel
- [ ] Background job visibility
- [ ] Better runbooks for support/recovery

---

# 5. Mission Control framing

## Current likely label
Property Manager V1 should currently be framed as:
- **strong controlled beta candidate**
- **not yet public-release ready**

## What would move it to beta-ready
The shortest credible path:
1. production-like deploy
2. backup + env + restart confidence
3. disable dev-only OTP leakage outside dev
4. rate limits on login/OTP/invite paths
5. monitoring/log visibility
6. fresh release-candidate walkthrough

## What would move it to public-release ready
The shortest credible path after beta:
1. durable storage setup
2. stronger account recovery flows
3. abuse controls
4. real delivery provider setup if promised
5. legal/support basics
6. final public-scope QA sign-off

---

# 6. Plain-English summary

Do not ask "can we release it?"
Ask:
- can a small real user group use it without hidden trust failures?
- can we operate it when something breaks?
- are we telling the truth about what is manual vs automatic?
- if a user gets stuck, do we have a sane recovery path?

If the answer is yes for a small group, it is beta-ready.
If the answer is yes at customer scale with normal abuse and support expectations, it is public-release ready.
