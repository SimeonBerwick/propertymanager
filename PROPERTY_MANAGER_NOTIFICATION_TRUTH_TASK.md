# Property Manager — First Task in Post-Hosted Stabilization Gate

## Task
Notification transport truth

## Why this is first
Hosted core workflow now works.

The next remaining production-grade ambiguity is not core request state. It is delivery truth.

Current app reality is mixed:
- transport plumbing exists for OTP delivery (`lib/otp-transport.ts`)
- production delivery is designed to fail loudly if env vars are missing
- operator mobile invite UX still emphasizes manual link sharing
- transport success/failure is not yet surfaced as a first-class operational truth layer across the product

That means the app is no longer lying badly, but it is still not fully explicit about what was actually delivered, what was only generated, and what failed.

---

## Objective
Make notification truth operationally honest.

For OTP/invite flows and any user-visible notification-triggering surfaces, the app should make these distinctions explicit:
- **generated only**
- **delivered successfully**
- **delivery failed**
- **manual delivery required**

No fake “sent” story.

---

## Best first implementation slice

### Slice 1 — operator-visible delivery semantics cleanup
Focus on the existing mobile invite / OTP access path first.

#### Required outcomes
1. operator mobile-access surfaces must clearly distinguish:
   - generated invite link
   - manual sharing required
   - whether any automatic transport was actually attempted
2. OTP flow must fail in a way that is visible and honest when transport is misconfigured or rejects delivery
3. errors must not disappear into logs only
4. product copy must stop implying delivery when only generation happened

#### Why this slice first
It is already close to the existing code path and avoids broad platform churn.
It gives us a clean vertical truth slice before we expand delivery semantics into broader notifications.

---

## Technical starting points already in repo
- `lib/otp-transport.ts`
  - Twilio + Resend transport code exists
  - production already throws on missing env
- `app/operator/units/[id]/page.tsx`
  - current operator mobile invite UI
  - currently framed around manual link generation and sharing
- mobile auth / OTP route flow
  - currently says “we sent a 6-digit verification code” which may be too strong unless delivery was truly attempted and succeeded

---

## Likely first defects to close
1. **Copy truth mismatch**
   - UI says or implies code was sent when generation happened but transport state is unknown
2. **Missing delivery result propagation**
   - delivery exceptions may not be shown in the final operator or tenant-facing UX clearly enough
3. **No delivery-status distinction**
   - generated/manual vs sent/failed is not modeled cleanly enough in user-facing flow

---

## Recommended implementation order
1. trace current OTP challenge creation + delivery path
2. identify where delivery result is lost
3. surface explicit delivery outcome in redirect/search params/state
4. update operator and mobile auth copy to match reality
5. add tests around configured / misconfigured / failed delivery cases

---

## Exit criteria
This task is complete when:
- operator can tell whether a flow generated a link only vs truly attempted delivery
- tenant/mobile auth copy no longer overclaims delivery
- delivery failures are visible and honest
- the path is documented as truthfully manual, automatic, or failed

---

## Non-goal
This task is **not** full Outlook/email integration.
It is **not** a broad notification center.
It is just the first clean truth slice for delivery semantics.
