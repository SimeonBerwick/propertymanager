# Realtor Aid v2

Realtor Aid v2 moves the app off the demo in-memory store and onto a real Postgres-backed persistence layer with Prisma.

## What changed
- Postgres + Prisma persistence
- normalized schema for organizations, users, leads, activities, and follow-up tasks
- seed path for a default demo organization + agent + leads
- dashboard, lead list, lead detail, activity logging, follow-up scheduling, and quick lead creation now read/write through the database
- early team-scoping foundation via `organizationId`, `ownerUserId`, and organization-scoped queries

## Stack
- Next.js 14
- React 18
- TypeScript
- Prisma ORM
- PostgreSQL

## Local setup
1. Create a Postgres database.
2. Copy the env file:
   ```bash
   cp .env.example .env
   ```
3. Set `DATABASE_URL` in `.env`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Generate Prisma client and run the first migration:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```
6. Seed demo data:
   ```bash
   npm run prisma:seed
   ```
7. Start the app:
   ```bash
   npm run dev
   ```

Then open `http://localhost:3000`.

## Verification
```bash
npm run typecheck
npm run build
```

## Data model notes
- `Organization` is the top-level tenancy boundary.
- `User` belongs to an organization.
- `Lead` belongs to an organization and can be assigned to a user.
- `Activity` is the immutable lead timeline.
- `FollowUpTask` gives follow-up scheduling a first-class table instead of hiding it as one timestamp.

## Next sprint
- add real auth and session-backed organization/user resolution
- add owner/team filters in the UI
- close the loop on task completion state from the lead detail view
- add validation and error handling around duplicate emails / bad inputs
