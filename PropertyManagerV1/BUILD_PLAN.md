# Property Manager V1 - Build Plan

## 1. Target platform / stack
- Frontend: Next.js + TypeScript
- Backend: Next.js route handlers or NestJS later if needed
- Database: SQLite (via Prisma)
- ORM: Prisma
- Auth: Clerk or Supabase Auth
- File storage: S3 / R2 for issue photos
- Notifications: email first, SMS later
- Hosting: Vercel (SQLite via embedded file; swap to Turso/Neon if distributed hosting is needed later)

## 2. MVP architecture

### Frontend surfaces
- landlord dashboard
- property/unit management
- tenant issue submission page
- maintenance request detail page
- reporting page

### Core backend modules
- auth and roles
- property/unit service
- maintenance request service
- photo upload service
- comments / communication trail service
- vendor assignment service
- reporting queries
- audit/event logging

### Core workflows
1. tenant submits issue
2. landlord sees request in inbox
3. landlord updates status / assigns vendor
4. tenant receives update trail
5. landlord reviews property/unit maintenance history

## 3. Initial data model
- User
- Property
- Unit
- MaintenanceRequest
- MaintenancePhoto
- RequestComment
- VendorAssignment
- StatusEvent

## 4. Risks
- role/permission complexity creeping in too early
- overbuilding toward a full PMS
- notification reliability
- messy request states if model is too loose
- landlord UX becoming cluttered

## 5. Success metric for first build
Jeff should be able to create properties/units, submit a maintenance request, track it through statuses, assign a vendor, and review the request history without confusion.
