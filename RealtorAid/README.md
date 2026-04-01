# Realtor Aid v1

Realtor Aid v1 is a minimal lead-ops CRM slice for real estate agents.

## What this build includes
- dashboard queues: New / Due Today / Overdue / Stale
- lead list
- lead detail view
- quick add lead
- activity logging
- follow-up scheduling
- seeded demo data
- simple lead stage updates

## Stack
- Next.js 14
- React 18
- TypeScript
- server actions + in-memory demo store

## Why this shape
This is the narrowest real v1 that proves workflow truth first:
1. capture a lead fast
2. see what needs attention now
3. open a record
4. log what happened
5. set the next follow-up

No fake enterprise scaffolding. No premature auth, queueing, or database complexity.

## Run locally
```bash
cd RealtorAid
npm install
npm run dev
```
Then open `http://localhost:3000`.

## Build checks
```bash
npm run typecheck
npm run build
```

## Demo behavior
Data is seeded in `lib/seed.ts` and stored in an in-memory server store in `lib/store.ts`.
That means data resets when the server restarts.

## Next obvious step
Replace the in-memory store with Postgres + Prisma, then add auth and multi-user ownership.
